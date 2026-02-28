/**
 * Course Engine - TRAIL Game Pro 3.2
 * 博士/デザイナー/エキスパートコースの進捗管理
 *
 * ★ altEngine.js とは完全独立。importもしない。
 * ★ coin_logs / students テーブルには絶対に触らない。
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { COURSE_GRADE_THRESHOLDS } = require('../config/gameBalance');

/**
 * 段位判定（純粋関数）
 * @param {number} masteredCount - マスターしたゲーム数（80%以上）
 * @returns {string} 段位名（4級〜特級）
 */
function calcCourseGrade(masteredCount) {
  let grade = '4級';
  for (const t of COURSE_GRADE_THRESHOLDS) {
    if (masteredCount >= t.minMastered) grade = t.grade;
  }
  return grade;
}

/**
 * コースゲーム終了時の処理
 * ★ ALTは一切付与しない。達成率のみで評価。
 *
 * @param {number} studentId
 * @param {string} tenantId
 * @param {string} courseId
 * @param {number} gameId
 * @param {{ correct_count: number, total_count: number }} gameResult
 * @param {object} db - better-sqlite3 インスタンス
 * @returns {{ achievement, passed, mastered, gradeUp, oldGrade?, newGrade, gamesPassed, gamesMastered, newBadge? }}
 */
function onCourseGameEnd(studentId, tenantId, courseId, gameId, gameResult, db) {
  const { correct_count, total_count } = gameResult;
  const achievement = total_count > 0 ? (correct_count / total_count) * 100 : 0;

  // コースゲーム設定を取得
  const courseGame = db.prepare(
    'SELECT pass_threshold, badge_threshold FROM course_games WHERE course_id = ? AND game_id = ?'
  ).get(courseId, gameId);

  if (!courseGame) {
    return { achievement: Math.round(achievement * 10) / 10, passed: false, mastered: false, gradeUp: false, newGrade: '4級', gamesPassed: 0, gamesMastered: 0 };
  }

  const passed = achievement >= courseGame.pass_threshold;
  const mastered = achievement >= courseGame.badge_threshold;

  // ── 進捗レコードを UPSERT（最高達成率を保持）──
  const existing = db.prepare(
    'SELECT id, best_achievement, passed, mastered FROM student_course_progress WHERE student_id = ? AND course_id = ? AND game_id = ?'
  ).get(studentId, courseId, gameId);

  if (existing) {
    const newBest = Math.max(existing.best_achievement, achievement);
    const newPassed = (existing.passed || passed) ? 1 : 0;
    const newMastered = (existing.mastered || mastered) ? 1 : 0;
    db.prepare(`
      UPDATE student_course_progress
         SET best_achievement = ?,
             passed = ?,
             mastered = ?,
             attempts = attempts + 1,
             passed_at = CASE WHEN ? = 1 AND passed_at IS NULL THEN datetime('now') ELSE passed_at END,
             mastered_at = CASE WHEN ? = 1 AND mastered_at IS NULL THEN datetime('now') ELSE mastered_at END,
             updated_at = datetime('now')
       WHERE id = ?
    `).run(newBest, newPassed, newMastered, newPassed, newMastered, existing.id);
  } else {
    const now = passed || mastered ? db.prepare("SELECT datetime('now') as n").get().n : null;
    db.prepare(`
      INSERT INTO student_course_progress
        (id, student_id, tenant_id, course_id, game_id, best_achievement, passed, mastered, attempts, passed_at, mastered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      uuidv4(), studentId, tenantId, courseId, gameId, achievement,
      passed ? 1 : 0, mastered ? 1 : 0,
      passed ? now : null,
      mastered ? now : null
    );
  }

  // ── コース全体の通過数/マスター数を再集計 ──
  const stats = db.prepare(`
    SELECT COUNT(CASE WHEN passed = 1 THEN 1 END) AS games_passed,
           COUNT(CASE WHEN mastered = 1 THEN 1 END) AS games_mastered
    FROM student_course_progress
    WHERE student_id = ? AND course_id = ?
  `).get(studentId, courseId);

  const gamesPassed = stats?.games_passed || 0;
  const gamesMastered = stats?.games_mastered || 0;
  const newGrade = calcCourseGrade(gamesMastered);

  // ── student_course_grades を UPSERT ──
  const existingGrade = db.prepare(
    'SELECT id, current_grade FROM student_course_grades WHERE student_id = ? AND course_id = ?'
  ).get(studentId, courseId);

  let gradeUp = false;
  let oldGrade = '4級';

  if (existingGrade) {
    oldGrade = existingGrade.current_grade;
    gradeUp = newGrade !== oldGrade;
    db.prepare(`
      UPDATE student_course_grades
         SET current_grade = ?, games_passed = ?, games_mastered = ?, updated_at = datetime('now')
       WHERE id = ?
    `).run(newGrade, gamesPassed, gamesMastered, existingGrade.id);
  } else {
    gradeUp = newGrade !== '4級';
    db.prepare(`
      INSERT INTO student_course_grades (id, student_id, tenant_id, course_id, current_grade, games_passed, games_mastered)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), studentId, tenantId, courseId, newGrade, gamesPassed, gamesMastered);
  }

  // ── 昇級時にバッジを自動付与 ──
  let newBadge = null;
  if (gradeUp && newGrade !== '4級') {
    const gradeKey = newGrade === '準2級' ? 'j2' : newGrade === '準1級' ? 'j1'
      : newGrade === '3級' ? '3' : newGrade === '2級' ? '2'
      : newGrade === '1級' ? '1' : 'sp';
    const badgeDefId = `${courseId}_${gradeKey}`;

    const badgeDef = db.prepare(
      'SELECT * FROM badge_definitions WHERE id = ?'
    ).get(badgeDefId);

    if (badgeDef) {
      const alreadyAwarded = db.prepare(
        "SELECT 1 FROM badges WHERE student_id = ? AND tenant_id = ? AND reason = ?"
      ).get(studentId, tenantId, `badge:${badgeDefId}`);

      if (!alreadyAwarded) {
        db.prepare(
          'INSERT INTO badges (tenant_id, student_id, reason, awarded_by) VALUES (?, ?, ?, ?)'
        ).run(tenantId, studentId, `badge:${badgeDefId}`, 'course_engine');
        newBadge = { id: badgeDefId, name: badgeDef.name, emoji: badgeDef.emoji, rarity: badgeDef.rarity };
      }
    }
  }

  return {
    achievement: Math.round(achievement * 10) / 10,
    passed,
    mastered,
    gradeUp,
    oldGrade: gradeUp ? oldGrade : undefined,
    newGrade,
    gamesPassed,
    gamesMastered,
    newBadge,
  };
}

/**
 * コースゲームのアンロック状態を取得
 * step_number 順で、前のゲームが passed でないと次はロック
 *
 * @param {number} studentId
 * @param {string} courseId
 * @param {object} db
 * @returns {Array}
 */
function getCourseGameAccess(studentId, courseId, db) {
  const games = db.prepare(`
    SELECT cg.game_id, cg.step_number, cg.pass_threshold, cg.badge_threshold,
           g.name AS game_name, g.emoji AS game_emoji, g.url AS game_url,
           scp.best_achievement, scp.passed, scp.mastered, scp.attempts
    FROM course_games cg
    JOIN games g ON cg.game_id = g.id
    LEFT JOIN student_course_progress scp
      ON scp.student_id = ? AND scp.course_id = cg.course_id AND scp.game_id = cg.game_id
    WHERE cg.course_id = ?
    ORDER BY cg.step_number
  `).all(studentId, courseId);

  return games.map((g, i) => {
    const unlocked = i === 0 || (games[i - 1].passed === 1);
    return {
      gameId: g.game_id,
      stepNumber: g.step_number,
      gameName: g.game_name,
      gameEmoji: g.game_emoji,
      gameUrl: g.game_url,
      passThreshold: g.pass_threshold,
      badgeThreshold: g.badge_threshold,
      bestAchievement: g.best_achievement || 0,
      passed: g.passed === 1,
      mastered: g.mastered === 1,
      attempts: g.attempts || 0,
      unlocked,
    };
  });
}

module.exports = { onCourseGameEnd, calcCourseGrade, getCourseGameAccess };
