/**
 * Super Admin Routes - 全教室管理
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// スーパー管理者認証ミドルウェア
function superAdminAuth(req, res, next) {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const auth = req.headers['x-super-admin'];
  if (!auth) return res.status(401).json({ error: '認証が必要です' });
  const decoded = Buffer.from(auth, 'base64').toString();
  const colonIndex = decoded.indexOf(':');
  const e = decoded.substring(0, colonIndex);
  const p = decoded.substring(colonIndex + 1);
  if (e !== email || p !== password) return res.status(403).json({ error: '認証失敗' });
  next();
}

// 全教室一覧
router.get('/api/super/tenants', superAdminAuth, (req, res) => {
  try {
    const tenants = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM students WHERE tenant_id = t.id) as student_count,
        (SELECT COUNT(*) FROM games WHERE tenant_id = t.id) as game_count,
        (SELECT email FROM admin_users WHERE tenant_id = t.id LIMIT 1) as admin_email
      FROM tenants t ORDER BY t.created_at DESC
    `).all();
    res.json(tenants);
  } catch (err) {
    console.error('GET /super/tenants error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 教室名・スラッグ更新
router.patch('/api/super/tenants/:id', superAdminAuth, (req, res) => {
  const { name, slug, plan } = req.body;
  db.prepare("UPDATE tenants SET name=?, slug=?, plan=?, updated_at=datetime('now') WHERE id=?")
    .run(name, slug, plan, req.params.id);
  res.json({ success: true });
});

// 教室削除
router.delete('/api/super/tenants/:id', superAdminAuth, (req, res) => {
  db.prepare('DELETE FROM tenants WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// 新教室作成
router.post('/api/super/tenants', superAdminAuth, (req, res) => {
  const { name, slug, adminEmail, adminPassword, plan } = req.body;
  const tenantId = uuidv4();
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.transaction(() => {
    db.prepare('INSERT INTO tenants (id, name, slug, plan) VALUES (?, ?, ?, ?)').run(tenantId, name, slug, plan || 'free');
    db.prepare('INSERT INTO admin_users (id, tenant_id, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), tenantId, adminEmail, hash, '管理者', 'owner');
  })();
  res.json({ success: true, tenantId });
});

// 全教室に一括ゲーム登録
router.post('/api/super/games/broadcast', superAdminAuth, (req, res) => {
  const { name, emoji, url, category } = req.body;
  if (!name || !emoji) return res.status(400).json({ error: '名前と絵文字は必須です' });
  const tenants = db.prepare('SELECT id FROM tenants').all();
  db.transaction(() => {
    for (const tenant of tenants) {
      db.prepare(`INSERT INTO games (tenant_id, name, emoji, url, category) VALUES (?, ?, ?, ?, ?)`)
        .run(tenant.id, name, emoji, url || null, category || 'その他');
    }
  })();
  res.json({ success: true, count: tenants.length });
});
module.exports = router;