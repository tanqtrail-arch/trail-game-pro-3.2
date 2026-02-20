/**
 * Rankings Routes - ランキング API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin, requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

// ═══ ランキング取得 ═══
router.get('/:tenantSlug/rankings', optionalAuth, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

  const { gameId } = req.query;
  let rankings;

  if (gameId) {
    rankings = db.prepare(`
      SELECT r.id, r.score, r.score_label, r.created_at,
        s.name as student_name, c.name as class_name,
        g.name as game_name, g.emoji as game_emoji
      FROM rankings r
      JOIN students s ON r.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN games g ON r.game_id = g.id
      WHERE r.tenant_id = ? AND r.game_id = ?
      ORDER BY r.score DESC LIMIT 50
    `).all(tenant.id, gameId);
  } else {
    // グローバルランキング（ALT合計順）
    rankings = db.prepare(`
      SELECT s.id as student_id, s.name as student_name, c.name as class_name,
        COALESCE(SUM(cl.amount), 0) as total_coins,
        COALESCE((SELECT COUNT(*) FROM badges WHERE student_id = s.id), 0) as total_badges
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN coin_logs cl ON cl.student_id = s.id
      WHERE s.tenant_id = ?
      GROUP BY s.id
      ORDER BY total_coins DESC LIMIT 50
    `).all(tenant.id);
  }

  res.json({ rankings });
});

// ═══ ランキング登録（外部ゲームからの送信） ═══
router.post('/:tenantSlug/rankings', requireAuth, (req, res) => {
  const { gameId, score, scoreLabel } = req.body;
  if (!gameId || score == null) return res.status(400).json({ error: 'ゲームIDとスコアは必須です' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

  const studentId = req.user.studentId;
  if (!studentId) return res.status(403).json({ error: '生徒のみスコアを登録できます' });

  const result = db.prepare(
    'INSERT INTO rankings (tenant_id, game_id, student_id, score, score_label) VALUES (?, ?, ?, ?, ?)'
  ).run(tenant.id, gameId, studentId, score, scoreLabel || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ═══ ランキング削除（管理者） ═══
router.delete('/:tenantSlug/rankings/:id', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  db.prepare('DELETE FROM rankings WHERE id = ? AND tenant_id = ?').run(req.params.id, tenant.id);
  res.json({ ok: true });
});

module.exports = router;
