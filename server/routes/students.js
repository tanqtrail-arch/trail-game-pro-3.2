/**
 * Students Routes - 生徒管理 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = Router();

// ═══ 生徒一覧 ═══
router.get('/:tenantSlug/students', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const students = db.prepare(`
    SELECT s.id, s.name, c.name as className, s.created_at,
      COALESCE((SELECT SUM(amount) FROM coin_logs WHERE student_id = s.id), 0) as totalCoins,
      COALESCE((SELECT COUNT(*) FROM badges WHERE student_id = s.id), 0) as totalBadges
    FROM students s JOIN classes c ON s.class_id = c.id
    WHERE s.tenant_id = ?
    ORDER BY c.name, s.name
  `).all(tenant.id);

  res.json({ students });
});

// ═══ 生徒追加 ═══
router.post('/:tenantSlug/students', requireAdmin, (req, res) => {
  const { name, className } = req.body;
  if (!name || !className) return res.status(400).json({ error: '名前とクラスは必須です' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const count = db.prepare('SELECT COUNT(*) as c FROM students WHERE tenant_id = ?').get(tenant.id);
  if (count.c >= tenant.max_students) {
    return res.status(403).json({ error: `生徒数の上限(${tenant.max_students})に達しています` });
  }

  const cls = db.prepare('SELECT * FROM classes WHERE tenant_id = ? AND name = ?').get(tenant.id, className);
  if (!cls) return res.status(404).json({ error: 'クラスが見つかりません' });

  const existing = db.prepare('SELECT id FROM students WHERE tenant_id = ? AND name = ? AND class_id = ?').get(tenant.id, name, cls.id);
  if (existing) return res.status(409).json({ error: 'この生徒は既に登録されています' });

  const result = db.prepare('INSERT INTO students (tenant_id, name, class_id) VALUES (?, ?, ?)').run(tenant.id, name, cls.id);

  db.prepare(`INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'player', ?, ?)`).run(
    tenant.id, req.user.displayName || req.user.email, `生徒「${name}」を${className}に登録`
  );

  res.status(201).json({ id: result.lastInsertRowid, name, className });
});

// ═══ 生徒削除 ═══
router.delete('/:tenantSlug/students/:id', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  db.prepare('DELETE FROM students WHERE id = ? AND tenant_id = ?').run(req.params.id, tenant.id);
  res.json({ ok: true });
});

module.exports = router;
