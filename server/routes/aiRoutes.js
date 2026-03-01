/**
 * AI Analysis Routes - AI分析 API
 * Phase 1: 枠のみ（データがなくても空配列を返す）
 * Phase 2: Claude APIでAIコメント生成
 */
const { Router } = require('express');
const db = require('../db');

const router = Router();

// ═══ AIコメント一覧 ═══
router.get('/comments/:tenantSlug', (req, res) => {
  try {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const comments = db.prepare(`
      SELECT ac.*, s.name as student_name
      FROM ai_comments ac
      JOIN students s ON ac.student_id = s.id
      WHERE ac.tenant_id = ? AND ac.type != 'class_summary'
      ORDER BY ac.generated_at DESC
    `).all(tenant.id);

    res.json(comments.map(c => ({
      ...c,
      badges: c.badges ? JSON.parse(c.badges) : []
    })));
  } catch (err) {
    console.error('[AI API] comments error:', err);
    res.json([]);
  }
});

// ═══ クラスAIサマリー ═══
router.get('/class-summary/:tenantSlug', (req, res) => {
  try {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const row = db.prepare(`
      SELECT comment FROM ai_comments
      WHERE tenant_id = ? AND type = 'class_summary'
      ORDER BY generated_at DESC LIMIT 1
    `).get(tenant.id);

    if (row && row.comment) {
      try {
        const parsed = JSON.parse(row.comment);
        res.json(parsed);
      } catch {
        res.json({ summary: row.comment, strengths: [], weaknesses: [], recommendations: [] });
      }
    } else {
      res.json({ summary: null, strengths: [], weaknesses: [], recommendations: [] });
    }
  } catch (err) {
    console.error('[AI API] class-summary error:', err);
    res.json({ summary: null, strengths: [], weaknesses: [], recommendations: [] });
  }
});

// ═══ 要注意アラート（ルールベース） ═══
router.get('/alerts/:tenantSlug', (req, res) => {
  try {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const alerts = [];

    // 7日以上未プレイの生徒
    const inactiveStudents = db.prepare(`
      SELECT s.id, s.name, MAX(ps.ended_at) as last_play
      FROM students s
      LEFT JOIN play_sessions ps ON ps.student_id = s.id AND ps.ended_at IS NOT NULL
      WHERE s.tenant_id = ?
      GROUP BY s.id
      HAVING last_play IS NULL OR last_play < datetime('now', '-7 days')
    `).all(tenant.id);

    inactiveStudents.forEach(s => {
      alerts.push({
        studentName: s.name,
        type: 'inactive',
        detail: s.last_play ? `最終プレイ: ${s.last_play.slice(0, 10)}` : '未プレイ'
      });
    });

    // 直近5回の平均正答率50%未満の生徒
    const students = db.prepare('SELECT id, name FROM students WHERE tenant_id = ?').all(tenant.id);
    students.forEach(s => {
      const recent = db.prepare(`
        SELECT CASE WHEN total_count > 0 THEN ROUND(correct_count * 100.0 / total_count, 1) ELSE NULL END as accuracy_pct
        FROM play_sessions
        WHERE student_id = ? AND ended_at IS NOT NULL AND total_count > 0
        ORDER BY ended_at DESC LIMIT 5
      `).all(s.id);

      if (recent.length >= 3) {
        const avg = recent.reduce((sum, r) => sum + r.accuracy_pct, 0) / recent.length;
        if (avg < 50) {
          alerts.push({
            studentName: s.name,
            type: 'struggling',
            detail: `直近${recent.length}回の平均正答率: ${avg.toFixed(1)}%`
          });
        }
      }
    });

    res.json(alerts);
  } catch (err) {
    console.error('[AI API] alerts error:', err);
    res.json([]);
  }
});

// ═══ 成長ハイライト（ルールベース） ═══
router.get('/growth-highlights/:tenantSlug', (req, res) => {
  try {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const highlights = [];
    const students = db.prepare('SELECT id, name FROM students WHERE tenant_id = ?').all(tenant.id);

    students.forEach(s => {
      // 直近7日 vs 前7日の正答率比較
      const recent7 = db.prepare(`
        SELECT AVG(CASE WHEN total_count > 0 THEN ROUND(correct_count * 100.0 / total_count, 1) ELSE NULL END) as avg_acc,
               COUNT(*) as cnt
        FROM play_sessions
        WHERE student_id = ? AND ended_at IS NOT NULL AND total_count > 0
          AND ended_at >= datetime('now', '-7 days')
      `).get(s.id);

      const prev7 = db.prepare(`
        SELECT AVG(CASE WHEN total_count > 0 THEN ROUND(correct_count * 100.0 / total_count, 1) ELSE NULL END) as avg_acc,
               COUNT(*) as cnt
        FROM play_sessions
        WHERE student_id = ? AND ended_at IS NOT NULL AND total_count > 0
          AND ended_at >= datetime('now', '-14 days') AND ended_at < datetime('now', '-7 days')
      `).get(s.id);

      // 正答率15%以上UP
      if (recent7.cnt >= 2 && prev7.cnt >= 2 && recent7.avg_acc != null && prev7.avg_acc != null) {
        const diff = recent7.avg_acc - prev7.avg_acc;
        if (diff >= 15) {
          highlights.push({
            studentName: s.name,
            type: 'accuracy_up',
            detail: `正答率 ${prev7.avg_acc.toFixed(0)}% → ${recent7.avg_acc.toFixed(0)}% (+${diff.toFixed(0)}%)`
          });
        }
      }

      // プレイ数2倍以上
      const recentPlays = db.prepare(`
        SELECT COUNT(*) as cnt FROM play_sessions
        WHERE student_id = ? AND ended_at IS NOT NULL AND ended_at >= datetime('now', '-7 days')
      `).get(s.id);

      const prevPlays = db.prepare(`
        SELECT COUNT(*) as cnt FROM play_sessions
        WHERE student_id = ? AND ended_at IS NOT NULL
          AND ended_at >= datetime('now', '-14 days') AND ended_at < datetime('now', '-7 days')
      `).get(s.id);

      if (recentPlays.cnt >= 4 && prevPlays.cnt > 0 && recentPlays.cnt >= prevPlays.cnt * 2) {
        highlights.push({
          studentName: s.name,
          type: 'plays_up',
          detail: `プレイ数 ${prevPlays.cnt}回 → ${recentPlays.cnt}回 (${(recentPlays.cnt / prevPlays.cnt).toFixed(1)}倍)`
        });
      }
    });

    res.json(highlights);
  } catch (err) {
    console.error('[AI API] growth-highlights error:', err);
    res.json([]);
  }
});

module.exports = router;
