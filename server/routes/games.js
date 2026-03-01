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

// ═══ [一時] ゲームURL一括更新マイグレーション（認証不要・デプロイ後に削除） ═══
router.post('/_migrate/game-urls-v2', (req, res) => {
  const SECRET = 'migrate-2026-03-trailnav-v2';
  if (req.headers['x-migrate-key'] !== SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const updates = [
    { id: 12, url: 'https://tanqtrail-arch.github.io/Meiro-atakku/' },
    { id: 10, url: 'https://tanqtrail-arch.github.io/Painting-quiz2/' },
  ];
  const stmt = db.prepare("UPDATE games SET url = ?, updated_at = datetime('now') WHERE id = ?");
  const results = [];
  db.transaction(() => {
    for (const u of updates) {
      const r = stmt.run(u.url, u.id);
      results.push({ id: u.id, url: u.url, changes: r.changes });
    }
  })();
  res.json({ ok: true, results });
});

module.exports = router;
