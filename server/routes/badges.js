/**
 * Badges Routes - バッジ管理 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = Router();

// ═══ バッジ一覧 ═══
router.get('/:tenantSlug/badges', requireAuth, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const summary = db.prepare(`
    SELECT s.id as student_id, s.name as student_name, c.name as class_name,
      COUNT(b.id) as badge_count
    FROM students s
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN badges b ON b.student_id = s.id
    WHERE s.tenant_id = ?
    GROUP BY s.id
    ORDER BY badge_count DESC
  `).all(tenant.id);

  res.json({ summary });
});

// ═══ バッジ付与 ═══
router.post('/:tenantSlug/badges', requireAdmin, (req, res) => {
  const { studentId, reason } = req.body;
  if (!studentId) return res.status(400).json({ error: '生徒IDは必須です' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const student = db.prepare('SELECT * FROM students WHERE id = ? AND tenant_id = ?').get(studentId, tenant.id);
  if (!student) return res.status(404).json({ error: '生徒が見つかりません' });

  const result = db.prepare(
    'INSERT INTO badges (tenant_id, student_id, reason, awarded_by) VALUES (?, ?, ?, ?)'
  ).run(tenant.id, studentId, reason || null, req.user.displayName || req.user.email);

  db.prepare(`INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'badge', ?, ?)`).run(
    tenant.id, req.user.displayName || req.user.email, `${student.name}にバッジを付与`
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;
