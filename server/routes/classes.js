/**
 * Classes Routes - クラス管理 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin, optionalAuth } = require('../middleware/auth');

const router = Router();

// ═══ クラス一覧（ログイン画面用） ═══
router.get('/:tenantSlug/classes', optionalAuth, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

  const classes = db.prepare('SELECT id, name FROM classes WHERE tenant_id = ? ORDER BY name').all(tenant.id);
  res.json({ classes });
});

// ═══ クラス追加 ═══
router.post('/:tenantSlug/classes', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'クラス名は必須です' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const count = db.prepare('SELECT COUNT(*) as c FROM classes WHERE tenant_id = ?').get(tenant.id);
  if (count.c >= tenant.max_classes) {
    return res.status(403).json({ error: `クラス数の上限(${tenant.max_classes})に達しています` });
  }

  const existing = db.prepare('SELECT id FROM classes WHERE tenant_id = ? AND name = ?').get(tenant.id, name);
  if (existing) return res.status(409).json({ error: 'このクラスは既に存在します' });

  const result = db.prepare('INSERT INTO classes (tenant_id, name) VALUES (?, ?)').run(tenant.id, name);
  res.status(201).json({ id: result.lastInsertRowid, name });
});

// ═══ クラス削除 ═══
router.delete('/:tenantSlug/classes/:id', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const studentCount = db.prepare('SELECT COUNT(*) as c FROM students WHERE class_id = ? AND tenant_id = ?').get(req.params.id, tenant.id);
  if (studentCount.c > 0) {
    return res.status(400).json({ error: 'このクラスには生徒が所属しています。先に生徒を移動してください' });
  }

  db.prepare('DELETE FROM classes WHERE id = ? AND tenant_id = ?').run(req.params.id, tenant.id);
  res.json({ ok: true });
});

module.exports = router;
