/**
 * Games Routes - ゲーム管理 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin, optionalAuth } = require('../middleware/auth');

const router = Router();

// ═══ ゲーム一覧（テナント内） ═══
router.get('/:tenantSlug/games', optionalAuth, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

  const games = db.prepare('SELECT * FROM games WHERE tenant_id = ? AND is_active = 1 ORDER BY category, name').all(tenant.id);
  res.json({ games });
});

// ═══ ゲーム追加（管理者） ═══
router.post('/:tenantSlug/games', requireAdmin, (req, res) => {
  const { name, emoji, url, category } = req.body;
  if (!name) return res.status(400).json({ error: 'ゲーム名は必須です' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });
  if (req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const count = db.prepare('SELECT COUNT(*) as c FROM games WHERE tenant_id = ? AND is_active = 1').get(tenant.id);
  if (count.c >= tenant.max_games) {
    return res.status(403).json({ error: `ゲーム数の上限(${tenant.max_games})に達しています。プランのアップグレードをご検討ください` });
  }

  const result = db.prepare(
    'INSERT INTO games (tenant_id, name, emoji, url, category) VALUES (?, ?, ?, ?, ?)'
  ).run(tenant.id, name, emoji || '🎮', url || null, category || 'その他');

  db.prepare(`INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'game', ?, ?)`).run(
    tenant.id, req.user.displayName || req.user.email, `ゲーム「${name}」を追加`
  );

  res.status(201).json({ id: result.lastInsertRowid, name, emoji: emoji || '🎮', url, category: category || 'その他' });
});

// ═══ ゲーム更新 ═══
router.put('/:tenantSlug/games/:id', requireAdmin, (req, res) => {
  const { name, emoji, url, category } = req.body;
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const game = db.prepare('SELECT * FROM games WHERE id = ? AND tenant_id = ?').get(req.params.id, tenant.id);
  if (!game) return res.status(404).json({ error: 'ゲームが見つかりません' });

  db.prepare(`
    UPDATE games SET name = COALESCE(?, name), emoji = COALESCE(?, emoji),
    url = COALESCE(?, url), category = COALESCE(?, category),
    updated_at = datetime('now') WHERE id = ? AND tenant_id = ?
  `).run(name, emoji, url, category, req.params.id, tenant.id);

  res.json({ ok: true });
});

// ═══ ゲーム削除 ═══
router.delete('/:tenantSlug/games/:id', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  db.prepare('UPDATE games SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?').run(req.params.id, tenant.id);
  res.json({ ok: true });
});

module.exports = router;
