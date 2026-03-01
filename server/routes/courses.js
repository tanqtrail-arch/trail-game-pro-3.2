/**
 * Courses Routes - 探究コース API
 * TRAIL Game Pro 3.2
 */

'use strict';

const { Router } = require('express');
const db = require('../db');
const { requireAdmin, requireStudent, optionalAuth } = require('../middleware/auth');
const { getCourseGameAccess } = require('../lib/courseEngine');
const { COURSE_GRADE_THRESHOLDS } = require('../config/gameBalance');

const router = Router();

// ═══ コース一覧取得 ═══
router.get('/:tenantSlug/courses', optionalAuth, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

    const courses = db.prepare(
      'SELECT * FROM course_definitions ORDER BY sort_order'
    ).all();

    const studentId = req.user?.studentId;

    const result = courses.map(c => {
      const data = {
        id: c.id,
        name: c.name,
        courseType: c.course_type,
        titleFormat: c.title_format,
        emoji: c.emoji,
        description: c.description,
        status: c.status,
        sortOrder: c.sort_order,
      };

      // いいね数
      const likeRow = db.prepare(
        'SELECT COUNT(*) AS cnt FROM course_likes WHERE course_id = ?'
      ).get(c.id);
      data.likeCount = likeRow?.cnt || 0;

      // 自分がいいね済みか
      if (studentId) {
        const myLike = db.prepare(
          'SELECT 1 FROM course_likes WHERE course_id = ? AND student_id = ?'
        ).get(c.id, studentId);
        data.liked = !!myLike;

        const grade = db.prepare(
          'SELECT * FROM student_course_grades WHERE student_id = ? AND course_id = ?'
        ).get(studentId, c.id);

        const gameCount = db.prepare(
          'SELECT COUNT(*) AS cnt FROM course_games WHERE course_id = ?'
        ).get(c.id);

        data.progress = {
          currentGrade: grade?.current_grade || '4級',
          gamesPassed: grade?.games_passed || 0,
          gamesMastered: grade?.games_mastered || 0,
          totalGames: gameCount?.cnt || 0,
        };
      }

      return data;
    });

    res.json({ courses: result });
  } catch (err) {
    console.error('コース一覧取得エラー:', err);
    res.status(500).json({ error: 'コース一覧の取得に失敗しました' });
  }
});

// ═══ コース詳細取得 ═══
router.get('/:tenantSlug/courses/:courseId', optionalAuth, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

    const course = db.prepare(
      'SELECT * FROM course_definitions WHERE id = ?'
    ).get(req.params.courseId);
    if (!course) return res.status(404).json({ error: 'コースが見つかりません' });

    const studentId = req.user?.studentId;
    let games = [];
    let grade = null;

    if (studentId) {
      games = getCourseGameAccess(studentId, course.id, db);
      const gradeRow = db.prepare(
        'SELECT * FROM student_course_grades WHERE student_id = ? AND course_id = ?'
      ).get(studentId, course.id);
      grade = {
        currentGrade: gradeRow?.current_grade || '4級',
        gamesPassed: gradeRow?.games_passed || 0,
        gamesMastered: gradeRow?.games_mastered || 0,
      };
    } else {
      games = db.prepare(`
        SELECT cg.game_id, cg.step_number, cg.pass_threshold, cg.badge_threshold,
               g.name AS game_name, g.emoji AS game_emoji
        FROM course_games cg
        JOIN games g ON cg.game_id = g.id
        WHERE cg.course_id = ?
        ORDER BY cg.step_number
      `).all(course.id).map(g => ({
        gameId: g.game_id,
        stepNumber: g.step_number,
        gameName: g.game_name,
        gameEmoji: g.game_emoji,
        passThreshold: g.pass_threshold,
        badgeThreshold: g.badge_threshold,
        bestAchievement: 0, passed: false, mastered: false, attempts: 0, unlocked: false,
      }));
    }

    // コースのバッジ一覧
    const badges = db.prepare(
      "SELECT * FROM badge_definitions WHERE condition_type = 'course_grade' AND condition_value LIKE ?"
    ).all(`%"course_id":"${course.id}"%`);

    res.json({
      course: {
        id: course.id, name: course.name, courseType: course.course_type,
        emoji: course.emoji, description: course.description, status: course.status,
      },
      games,
      grade,
      gradeThresholds: COURSE_GRADE_THRESHOLDS,
      badges: badges.map(b => ({
        id: b.id, name: b.name, emoji: b.emoji, rarity: b.rarity,
        conditionValue: JSON.parse(b.condition_value),
      })),
    });
  } catch (err) {
    console.error('コース詳細取得エラー:', err);
    res.status(500).json({ error: 'コース詳細の取得に失敗しました' });
  }
});

// ═══ コースいいね（トグル）═══
router.post('/:tenantSlug/courses/:courseId/like', requireStudent, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

    const courseId = req.params.courseId;
    const studentId = req.user.studentId;
    const tenantId = req.user.tenantId;

    const course = db.prepare('SELECT id FROM course_definitions WHERE id = ?').get(courseId);
    if (!course) return res.status(404).json({ error: 'コースが見つかりません' });

    const existing = db.prepare(
      'SELECT id FROM course_likes WHERE course_id = ? AND student_id = ?'
    ).get(courseId, studentId);

    if (existing) {
      db.prepare('DELETE FROM course_likes WHERE id = ?').run(existing.id);
    } else {
      db.prepare(
        'INSERT INTO course_likes (course_id, student_id, tenant_id) VALUES (?, ?, ?)'
      ).run(courseId, studentId, tenantId);
    }

    const count = db.prepare(
      'SELECT COUNT(*) AS cnt FROM course_likes WHERE course_id = ?'
    ).get(courseId);

    res.json({ ok: true, liked: !existing, likeCount: count.cnt });
  } catch (err) {
    console.error('コースいいねエラー:', err);
    res.status(500).json({ error: 'いいね処理に失敗しました' });
  }
});

// ═══ コースステータス変更（管理者）═══
router.patch('/:tenantSlug/courses/:courseId', requireAdmin, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

    const { status } = req.body;
    if (!status || !['active', 'coming_soon', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'statusは active / coming_soon / archived のいずれかです' });
    }

    const course = db.prepare('SELECT * FROM course_definitions WHERE id = ?').get(req.params.courseId);
    if (!course) return res.status(404).json({ error: 'コースが見つかりません' });

    db.prepare('UPDATE course_definitions SET status = ? WHERE id = ?').run(status, req.params.courseId);

    res.json({ ok: true, courseId: req.params.courseId, status });
  } catch (err) {
    console.error('コースステータス変更エラー:', err);
    res.status(500).json({ error: 'コースステータスの変更に失敗しました' });
  }
});

module.exports = router;
