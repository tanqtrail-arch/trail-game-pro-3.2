/**
 * Tenant Guard Middleware
 * テナントスラッグからテナントIDを解決
 */
const db = require('../db');

const getTenant = db.prepare('SELECT * FROM tenants WHERE slug = ?');

function resolveTenant(req, res, next) {
  const slug = req.params.tenant || req.headers['x-tenant-slug'];
  if (!slug) {
    return res.status(400).json({ error: 'テナントが指定されていません' });
  }
  const tenant = getTenant.get(slug);
  if (!tenant) {
    return res.status(404).json({ error: 'テナントが見つかりません' });
  }
  req.tenant = tenant;
  // If user is authenticated, verify tenant matches
  if (req.tenantId && req.tenantId !== tenant.id) {
    return res.status(403).json({ error: 'このテナントへのアクセス権がありません' });
  }
  req.tenantId = tenant.id;
  next();
}

module.exports = { resolveTenant };
