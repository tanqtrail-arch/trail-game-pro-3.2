/**
 * Subject Level Updater - TRAIL Game Pro 3.2
 * 科目レベルの更新処理
 *
 * ★ altEngine.js とは独立。セッション終了後にフックとして呼ばれる。
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { SUBJECT_LEVEL_THRESHOLDS } = require('../config/gameBalance');

/**
 * 科目レベルを計算する（純粋関数）
 * @param {number} totalAlt - 科目の累計ALT
 * @returns {number} レベル（1〜10）
 */
function calcSubjectLevel(totalAlt) {
  let level = 1;
  for (const t of SUBJECT_LEVEL_THRESHOLDS) {
    if (totalAlt >= t.minAlt) level = t.level;
  }
  return level;
}

/**
 * セッション終了後に科目レベルを更新する
 *
 * @param {number} studentId
 * @param {string} tenantId
 * @param {number} gameId
 * @param {number} altAmount  - 今回獲得したALT
 * @param {number} correctCount - 正答数
 * @param {number} totalCount   - 総問題数
 * @param {object} db         - better-sqlite3 インスタンス
 */
function updateSubjectLevel(studentId, tenantId, gameId, altAmount, correctCount, totalCount, db) {
  // 1. games テーブルから subject を取得
  const game = db.prepare('SELECT subject FROM games WHERE id = ?').get(gameId);
  if (!game || !game.subject) return; // subject が NULL なら何もしない

  const subject = game.subject;

  // 2. 既存レコードを取得
  const existing = db.prepare(
    'SELECT id, total_alt, correct_count, total_count FROM student_subject_levels WHERE student_id = ? AND subject = ?'
  ).get(studentId, subject);

  if (existing) {
    // 3a. 既存レコードを更新
    const newTotalAlt = existing.total_alt + (altAmount || 0);
    const newCorrect = existing.correct_count + (correctCount || 0);
    const newTotal = existing.total_count + (totalCount || 0);
    const newLevel = calcSubjectLevel(newTotalAlt);

    db.prepare(`
      UPDATE student_subject_levels
         SET total_alt     = ?,
             current_level = ?,
             correct_count = ?,
             total_count   = ?,
             updated_at    = datetime('now')
       WHERE id = ?
    `).run(newTotalAlt, newLevel, newCorrect, newTotal, existing.id);
  } else {
    // 3b. 新規レコードを作成
    const newLevel = calcSubjectLevel(altAmount || 0);
    db.prepare(`
      INSERT INTO student_subject_levels (id, student_id, tenant_id, subject, total_alt, current_level, correct_count, total_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), studentId, tenantId, subject, altAmount || 0, newLevel, correctCount || 0, totalCount || 0);
  }
}

module.exports = { updateSubjectLevel, calcSubjectLevel };
