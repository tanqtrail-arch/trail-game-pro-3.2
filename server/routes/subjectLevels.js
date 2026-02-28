/**
 * Subject Levels Routes - 科目レベル API
 * TRAIL Game Pro 3.2
 */

'use strict';

const { Router } = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { SUBJECT_LEVEL_THRESHOLDS } = require('../config/gameBalance');
const { calcSubjectLevel } = require('../lib/subjectLevelUpdater');
const { v4: uuidv4 } = require('uuid');

const router = Router();

// ═══ 科目レベル一覧取得 ═══
router.get('/:tenantSlug/subject-levels', requireAuth, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

    const studentId = req.user.studentId;
    if (!studentId) return res.status(403).json({ error: '生徒のみアクセスできます' });

    // 既存の科目レベルを取得
    let levels = db.prepare(
      'SELECT * FROM student_subject_levels WHERE student_id = ? AND tenant_id = ?'
    ).all(studentId, tenant.id);

    // レコードがなければ games テーブルの subject から初期化
    if (levels.length === 0) {
      const subjects = db.prepare(`
        SELECT DISTINCT subject FROM games
        WHERE tenant_id = ? AND is_active = 1 AND subject IS NOT NULL
      `).all(tenant.id);

      if (subjects.length > 0) {
        const insert = db.prepare(`
          INSERT OR IGNORE INTO student_subject_levels
          (id, student_id, tenant_id, subject, total_alt, current_level, correct_count, total_count)
          VALUES (?, ?, ?, ?, 0, 1, 0, 0)
        `);
        db.transaction(() => {
          for (const s of subjects) {
            insert.run(uuidv4(), studentId, tenant.id, s.subject);
          }
        })();

        levels = db.prepare(
          'SELECT * FROM student_subject_levels WHERE student_id = ? AND tenant_id = ?'
        ).all(studentId, tenant.id);
      }
    }

    // レベル閾値情報を付与
    const result = levels.map(l => {
      const currentThreshold = SUBJECT_LEVEL_THRESHOLDS.find(t => t.level === l.current_level);
      const nextThreshold = SUBJECT_LEVEL_THRESHOLDS.find(t => t.level === l.current_level + 1);
      return {
        subject: l.subject,
        totalAlt: l.total_alt,
        currentLevel: l.current_level,
        levelTitle: currentThreshold?.title || '見習い',
        correctCount: l.correct_count,
        totalCount: l.total_count,
        accuracy: l.total_count > 0 ? Math.round((l.correct_count / l.total_count) * 100) : 0,
        nextLevel: nextThreshold ? {
          level: nextThreshold.level,
          title: nextThreshold.title,
          requiredAlt: nextThreshold.minAlt,
          remaining: Math.max(0, nextThreshold.minAlt - l.total_alt),
        } : null,
      };
    });

    res.json({ subjectLevels: result });
  } catch (err) {
    console.error('科目レベル取得エラー:', err);
    res.status(500).json({ error: '科目レベルの取得に失敗しました' });
  }
});

module.exports = router;
