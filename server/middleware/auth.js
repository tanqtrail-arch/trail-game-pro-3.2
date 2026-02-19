/**
 * Authentication & Authorization Middleware
 * JWT検証 + テナント分離
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * JWT トークン生成
 */
function signToken(payload, expiresIn) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn || '24h' });
}

/**
 * JWT トークン検証
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * 管理者認証ミドルウェア
 * Authorization: Bearer <token>
 */
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const decoded = verifyToken(auth.slice(7));
    if (decoded.role !== 'teacher' && decoded.role !== 'owner') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

/**
 * 生徒認証ミドルウェア
 */
function requireStudent(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const decoded = verifyToken(auth.slice(7));
    if (decoded.role !== 'student') {
      return res.status(403).json({ error: '生徒のアクセスが必要です' });
    }
    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

/**
 * 任意のログインユーザー（管理者 or 生徒）
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const decoded = verifyToken(auth.slice(7));
    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

/**
 * オプショナル認証（ゲスト許可）
 */
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(auth.slice(7));
      req.tenantId = req.user.tenantId;
    } catch (e) {
      // ignore invalid token for optional auth
    }
  }
  next();
}

module.exports = { signToken, verifyToken, requireAdmin, requireStudent, requireAuth, optionalAuth };
