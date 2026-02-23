/**
 * Parent Routes - 保護者 API
 * POST /api/auth/parent-tokens      - 保護者トークン＋PIN発行
 * POST /api/auth/parent-login       - 保護者ログイン（生徒名＋PIN）
 * GET  /api/parent/dashboard        - 保護者ダッシュボード
 */
const { Router } = require('express');
const crypto = require('crypto');
const db = require('../db');
const { signToken, verifyToken, requireAdmin } = require('../middleware/auth');

const router = Router();

/**
 * 4桁PINを生成
 */
function generatePin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

// ═══ 保護者トークン発行（管理者のみ） ═══
router.post('/parent-tokens', requireAdmin, (req, res) => {
  const { studentId } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: '生徒IDが必要です' });
  }

  const student = db.prepare(
    'SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND s.tenant_id = ?'
  ).get(studentId, req.tenantId);
  if (!student) {
    return res.status(404).json({ error: '生徒が見つかりません' });
  }

  const pin = generatePin();
  const token = crypto.randomUUID();

  // UPSERT: 既存があれば更新、なければ挿入
  db.prepare(`
    INSERT INTO parent_tokens (tenant_id, student_id, token, pin)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id, student_id) DO UPDATE SET token = excluded.token, pin = excluded.pin, created_at = datetime('now')
  `).run(req.tenantId, studentId, token, pin);

  res.json({
    token,
    pin,
    student: { id: student.id, name: student.name, className: student.class_name },
  });
});

// ═══ 保護者ログイン（生徒名＋PIN） ═══
router.post('/parent-login', (req, res) => {
  const { tenantSlug, studentName, pin } = req.body;
  if (!tenantSlug || !studentName || !pin) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(tenantSlug);
  if (!tenant) {
    return res.status(404).json({ error: 'テナントが見つかりません' });
  }

  // 生徒名でparent_tokensを検索
  const row = db.prepare(`
    SELECT pt.*, s.name as student_name, s.id as sid, c.name as class_name
    FROM parent_tokens pt
    JOIN students s ON pt.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    WHERE pt.tenant_id = ? AND s.name = ? AND pt.pin = ?
  `).get(tenant.id, studentName, pin);

  if (!row) {
    return res.status(401).json({ error: '生徒名またはPINが正しくありません' });
  }

  const jwt = signToken({
    parentOf: row.sid,
    tenantId: tenant.id,
    studentName: row.student_name,
    className: row.class_name,
    role: 'parent',
  }, '24h');

  res.json({
    token: jwt,
    student: { id: row.sid, name: row.student_name, className: row.class_name },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  });
});

// ═══ 保護者認証ミドルウェア ═══
function requireParent(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const decoded = verifyToken(auth.slice(7));
    if (decoded.role !== 'parent') {
      return res.status(403).json({ error: '保護者のアクセスが必要です' });
    }
    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

// ═══ 保護者ダッシュボード ═══
router.get('/dashboard', requireParent, (req, res) => {
  const { parentOf, tenantId, studentName, className } = req.user;

  const tenant = db.prepare('SELECT name, slug FROM tenants WHERE id = ?').get(tenantId);

  // 今月のALT合計
  const monthlyCoins = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM coin_logs
    WHERE tenant_id = ? AND student_id = ?
      AND created_at >= date('now', 'start of month')
  `).get(tenantId, parentOf).total;

  // ALT全期間合計
  const totalCoins = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM coin_logs WHERE tenant_id = ? AND student_id = ?
  `).get(tenantId, parentOf).total;

  // バッジ数
  const badgeCount = db.prepare(`
    SELECT COUNT(*) as c FROM badges WHERE tenant_id = ? AND student_id = ?
  `).get(tenantId, parentOf).c;

  // ALT履歴（最新20件）
  const coinLogs = db.prepare(`
    SELECT cl.amount, cl.note, cl.created_at,
      g.name as game_name, g.emoji as game_emoji
    FROM coin_logs cl
    LEFT JOIN games g ON cl.game_id = g.id
    WHERE cl.tenant_id = ? AND cl.student_id = ?
    ORDER BY cl.created_at DESC LIMIT 20
  `).all(tenantId, parentOf);

  // ゲームプレイ履歴（最新20件）
  const playLogs = db.prepare(`
    SELECT gpl.duration_seconds, gpl.played_at,
      g.name as game_name, g.emoji as game_emoji
    FROM game_play_logs gpl
    JOIN games g ON gpl.game_id = g.id
    WHERE gpl.tenant_id = ? AND gpl.student_id = ?
    ORDER BY gpl.played_at DESC LIMIT 20
  `).all(tenantId, parentOf);

  // 先生からのコメント（バッジのreason + コインのnote）
  const comments = db.prepare(`
    SELECT reason as message, awarded_by as teacher, created_at
    FROM badges
    WHERE tenant_id = ? AND student_id = ? AND reason IS NOT NULL AND reason != ''
    UNION ALL
    SELECT note as message, awarded_by as teacher, created_at
    FROM coin_logs
    WHERE tenant_id = ? AND student_id = ? AND note IS NOT NULL AND note != ''
    ORDER BY created_at DESC LIMIT 20
  `).all(tenantId, parentOf, tenantId, parentOf);

  res.json({
    student: { id: parentOf, name: studentName, className },
    tenant: { name: tenant ? tenant.name : '', slug: tenant ? tenant.slug : '' },
    monthlyCoins,
    totalCoins,
    badgeCount,
    coinLogs,
    playLogs,
    comments,
  });
});

module.exports = router;
