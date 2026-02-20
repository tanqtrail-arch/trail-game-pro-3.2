/**
 * Tenants Routes - テナント管理 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = Router();

// ═══ テナント情報取得 ═══
router.get('/:tenantSlug/info', (req, res) => {
  const tenant = db.prepare('SELECT id, name, slug, plan FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });
  res.json({ tenant });
});

// ═══ テナント設定更新（オーナーのみ） ═══
router.put('/:tenantSlug/settings', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'オーナー権限が必要です' });

  const { name } = req.body;
  if (name) {
    db.prepare("UPDATE tenants SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, tenant.id);
  }

  res.json({ ok: true });
});

// ═══ プラン情報 ═══
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        nameJa: '無料プラン',
        price: 0,
        maxStudents: 30,
        maxGames: 20,
        maxClasses: 6,
        features: ['基本的なゲーム管理', 'ALTコインシステム', 'バッジ機能', 'ランキング表示'],
      },
      {
        id: 'pro',
        name: 'Pro',
        nameJa: 'プロプラン',
        price: 980,
        maxStudents: 100,
        maxGames: 50,
        maxClasses: 15,
        features: ['すべてのFree機能', '詳細アナリティクス', 'カスタムカテゴリ', 'CSV エクスポート', '優先サポート'],
      },
      {
        id: 'school',
        name: 'School',
        nameJa: 'スクールプラン',
        price: 4980,
        maxStudents: 500,
        maxGames: 200,
        maxClasses: 50,
        features: ['すべてのPro機能', '複数管理者', '学校全体の統計', 'API アクセス', 'SSO連携', '専任サポート'],
      },
    ],
  });
});

module.exports = router;
