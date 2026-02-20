/**
 * Coins Routes - ALTコイン管理 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = Router();

// ═══ コインログ取得 ═══
router.get('/:tenantSlug/coins', requireAuth, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });
  if (req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  let logs;
  if (req.user.role === 'student') {
    // 生徒は自分のログのみ
    logs = db.prepare(`
      SELECT cl.id, cl.amount, cl.note, cl.created_at,
        s.name as student_name, g.name as game_name, g.emoji as game_emoji
      FROM coin_logs cl
      JOIN students s ON cl.student_id = s.id
      LEFT JOIN games g ON cl.game_id = g.id
      WHERE cl.tenant_id = ? AND cl.student_id = ?
      ORDER BY cl.created_at DESC LIMIT 200
    `).all(tenant.id, req.user.studentId);
  } else {
    logs = db.prepare(`
      SELECT cl.id, cl.amount, cl.note, cl.awarded_by, cl.created_at,
        s.name as student_name, g.name as game_name, g.emoji as game_emoji
      FROM coin_logs cl
      JOIN students s ON cl.student_id = s.id
      LEFT JOIN games g ON cl.game_id = g.id
      WHERE cl.tenant_id = ?
      ORDER BY cl.created_at DESC LIMIT 500
    `).all(tenant.id);
  }

  res.json({ logs });
});

// ═══ コイン付与（管理者） ═══
router.post('/:tenantSlug/coins', requireAdmin, (req, res) => {
  const { studentId, gameId, amount, note } = req.body;
  if (!studentId || amount == null) return res.status(400).json({ error: '生徒IDと金額は必須です' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const student = db.prepare('SELECT * FROM students WHERE id = ? AND tenant_id = ?').get(studentId, tenant.id);
  if (!student) return res.status(404).json({ error: '生徒が見つかりません' });

  const result = db.prepare(
    'INSERT INTO coin_logs (tenant_id, student_id, game_id, amount, note, awarded_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(tenant.id, studentId, gameId || null, amount, note || null, req.user.displayName || req.user.email);

  db.prepare(`INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'coin', ?, ?)`).run(
    tenant.id, req.user.displayName || req.user.email, `${student.name}に${amount}ALTを付与`
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;
