/**
 * Parent Routes - 保護者 API
 * POST /api/auth/parent-tokens      - 保護者トークン＋PIN発行
 * POST /api/auth/parent-login       - 保護者ログイン（生徒名＋PIN）
 * GET  /api/parent/dashboard        - 保護者ダッシュボード
 * GET  /api/parent-verify           - トークンでの保護者認証
 * GET  /api/parent-dashboard        - 保護者ダッシュボード（完全版）
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

// ═══ トークンベース保護者認証 (GET /api/parent-verify?token=xxx) ═══
router.get('/parent-verify', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'トークンが必要です' });
  }

  const row = db.prepare(`
    SELECT pt.*, s.id as student_id, s.name as student_name, s.created_at as student_created_at,
           c.name as class_name, t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug
    FROM parent_tokens pt
    JOIN students s ON pt.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN tenants t ON pt.tenant_id = t.id
    WHERE pt.token = ?
  `).get(token);

  if (!row) {
    return res.status(404).json({ error: 'リンクが無効または期限切れです' });
  }

  res.json({
    student: { id: row.student_id, name: row.student_name, className: row.class_name, created_at: row.student_created_at },
    tenant: { id: row.tenant_id, name: row.tenant_name, slug: row.tenant_slug },
  });
});

// ═══ 保護者ダッシュボード完全版 (GET /api/parent-dashboard?tenant_id=x&student_id=y) ═══
router.get('/parent-dashboard', (req, res) => {
  // トークン認証（Bearerヘッダー or クエリのtokenパラメータ）
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  let tenantId, studentId;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = verifyToken(authHeader.slice(7));
      if (decoded.role !== 'parent') {
        return res.status(403).json({ error: '保護者のアクセスが必要です' });
      }
      tenantId = decoded.tenantId;
      studentId = decoded.parentOf;
    } catch (e) {
      return res.status(401).json({ error: 'トークンが無効です' });
    }
  } else if (queryToken) {
    const row = db.prepare(`
      SELECT pt.tenant_id, pt.student_id
      FROM parent_tokens pt WHERE pt.token = ?
    `).get(queryToken);
    if (!row) {
      return res.status(401).json({ error: 'トークンが無効です' });
    }
    tenantId = row.tenant_id;
    studentId = row.student_id;
  } else {
    // クエリパラメータからも取得可能（parent-verifyで認証済みの場合）
    tenantId = req.query.tenant_id;
    studentId = req.query.student_id ? parseInt(req.query.student_id) : null;
    if (!tenantId || !studentId) {
      return res.status(401).json({ error: '認証が必要です' });
    }
    // クエリパラメータの場合、tokenが必要
    return res.status(401).json({ error: '認証が必要です' });
  }

  // ── stats: 今日/今週/累計 ──
  const todayAlt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs
    WHERE tenant_id = ? AND student_id = ? AND created_at >= date('now')
  `).get(tenantId, studentId).alt;

  const todayPlays = db.prepare(`
    SELECT COUNT(*) as c FROM game_play_logs
    WHERE tenant_id = ? AND student_id = ? AND played_at >= date('now')
  `).get(tenantId, studentId).c;

  const todayMinutes = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as s FROM game_play_logs
    WHERE tenant_id = ? AND student_id = ? AND played_at >= date('now')
  `).get(tenantId, studentId).s;

  const weekAlt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs
    WHERE tenant_id = ? AND student_id = ? AND created_at >= date('now', '-7 days')
  `).get(tenantId, studentId).alt;

  const weekPlays = db.prepare(`
    SELECT COUNT(*) as c FROM game_play_logs
    WHERE tenant_id = ? AND student_id = ? AND played_at >= date('now', '-7 days')
  `).get(tenantId, studentId).c;

  const weekMinutes = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as s FROM game_play_logs
    WHERE tenant_id = ? AND student_id = ? AND played_at >= date('now', '-7 days')
  `).get(tenantId, studentId).s;

  const totalAlt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs
    WHERE tenant_id = ? AND student_id = ?
  `).get(tenantId, studentId).alt;

  const totalPlays = db.prepare(`
    SELECT COUNT(*) as c FROM game_play_logs
    WHERE tenant_id = ? AND student_id = ?
  `).get(tenantId, studentId).c;

  const totalMinutes = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as s FROM game_play_logs
    WHERE tenant_id = ? AND student_id = ?
  `).get(tenantId, studentId).s;

  // ── rank: テナント内ALT合計ランキング ──
  const allStudentAlts = db.prepare(`
    SELECT s.id, COALESCE(SUM(cl.amount), 0) as total_alt
    FROM students s
    LEFT JOIN coin_logs cl ON s.id = cl.student_id AND cl.tenant_id = s.tenant_id
    WHERE s.tenant_id = ?
    GROUP BY s.id
    ORDER BY total_alt DESC
  `).all(tenantId);

  const totalStudents = allStudentAlts.length;
  const rankPosition = allStudentAlts.findIndex(r => r.id === studentId) + 1;
  let rankLabel = 'ルーキー';
  if (rankPosition === 1) rankLabel = 'チャンピオン';
  else if (rankPosition <= 3) rankLabel = 'チャレンジャー';
  else if (rankPosition <= Math.ceil(totalStudents * 0.3)) rankLabel = 'エリート';
  else if (rankPosition <= Math.ceil(totalStudents * 0.6)) rankLabel = 'レギュラー';

  // ── teacherComments: teacher_commentsテーブルから ──
  const teacherComments = db.prepare(`
    SELECT comment, month, created_at
    FROM teacher_comments
    WHERE tenant_id = ? AND student_id = ?
    ORDER BY month DESC, created_at DESC
    LIMIT 12
  `).all(tenantId, studentId);

  // ── aiComments: ai_commentsテーブルから ──
  const aiComments = db.prepare(`
    SELECT comment, date as month, generated_at
    FROM ai_comments
    WHERE tenant_id = ? AND student_id = ? AND comment IS NOT NULL AND comment != ''
    ORDER BY date DESC, generated_at DESC
    LIMIT 12
  `).all(tenantId, studentId);

  // ── calendar: 今月の活動日ごと集計 ──
  const calendar = db.prepare(`
    SELECT date(played_at) as date, COUNT(*) as plays,
           COALESCE((SELECT SUM(cl.amount) FROM coin_logs cl
             WHERE cl.tenant_id = ? AND cl.student_id = ?
             AND date(cl.created_at) = date(gpl.played_at)), 0) as alt
    FROM game_play_logs gpl
    WHERE gpl.tenant_id = ? AND gpl.student_id = ?
      AND played_at >= date('now', 'start of month')
    GROUP BY date(played_at)
    ORDER BY date DESC
  `).all(tenantId, studentId, tenantId, studentId);

  // ── categoryStats: ゲームカテゴリ別プレイ＆正答率 ──
  const categoryStats = db.prepare(`
    SELECT g.category, COUNT(ps.id) as plays,
           COALESCE(SUM(ps.correct_count), 0) as correct,
           COALESCE(SUM(ps.total_count), 0) as total
    FROM play_sessions ps
    JOIN games g ON ps.game_id = g.id
    WHERE ps.tenant_id = ? AND ps.student_id = ?
    GROUP BY g.category
    ORDER BY plays DESC
  `).all(tenantId, studentId);

  // ── rankHistory: 月ごとのランキング推移（過去6ヶ月分を計算） ──
  const rankHistory = [];
  for (let i = 0; i < 6; i++) {
    const monthOffset = `-${i} months`;
    const monthStr = db.prepare(`SELECT strftime('%Y-%m', date('now', ?)) as m`).get(monthOffset).m;
    const monthStart = monthStr + '-01';
    const monthEnd = db.prepare(`SELECT date(?, '+1 month') as d`).get(monthStart).d;

    const monthRanks = db.prepare(`
      SELECT s.id, COALESCE(SUM(cl.amount), 0) as total_alt
      FROM students s
      LEFT JOIN coin_logs cl ON s.id = cl.student_id AND cl.tenant_id = s.tenant_id
        AND cl.created_at >= ? AND cl.created_at < ?
      WHERE s.tenant_id = ?
      GROUP BY s.id
      ORDER BY total_alt DESC
    `).all(monthStart, monthEnd, tenantId);

    const pos = monthRanks.findIndex(r => r.id === studentId) + 1;
    if (pos > 0) {
      rankHistory.push({ month: monthStr, position: pos });
    }
  }

  // ── bestScores: ゲーム別ベストスコア ──
  const bestScores = db.prepare(`
    SELECT r.game_id, g.name as game_name, g.emoji as game_emoji,
           MAX(r.score) as score, r.score_label
    FROM rankings r
    JOIN games g ON r.game_id = g.id
    WHERE r.tenant_id = ? AND r.student_id = ?
    GROUP BY r.game_id
    ORDER BY score DESC
    LIMIT 10
  `).all(tenantId, studentId);

  // ── recentPlays: 直近10件のプレイ記録 ──
  const recentPlays = db.prepare(`
    SELECT g.name as game_name, g.emoji as game_emoji,
           COALESCE(gpl.duration_seconds, 0) as duration_seconds,
           gpl.played_at as date
    FROM game_play_logs gpl
    JOIN games g ON gpl.game_id = g.id
    WHERE gpl.tenant_id = ? AND gpl.student_id = ?
    ORDER BY gpl.played_at DESC
    LIMIT 10
  `).all(tenantId, studentId);

  // ALTも含めた最近のプレイ
  const recentPlaysWithAlt = recentPlays.map(p => {
    const altRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs
      WHERE tenant_id = ? AND student_id = ? AND date(created_at) = date(?)
      AND game_id IN (SELECT id FROM games WHERE name = ?)
    `).get(tenantId, studentId, p.date, p.game_name);
    return {
      game_name: p.game_name,
      game_emoji: p.game_emoji,
      alt: altRow ? altRow.alt : 0,
      date: p.date,
    };
  });

  // ── attendance: 出席日数 ──
  const thisMonthAttendance = db.prepare(`
    SELECT COUNT(DISTINCT date(login_at)) as days FROM login_logs
    WHERE tenant_id = ? AND student_id = ? AND login_at >= date('now', 'start of month')
  `).get(tenantId, studentId).days;

  const lastMonthAttendance = db.prepare(`
    SELECT COUNT(DISTINCT date(login_at)) as days FROM login_logs
    WHERE tenant_id = ? AND student_id = ?
      AND login_at >= date('now', 'start of month', '-1 month')
      AND login_at < date('now', 'start of month')
  `).get(tenantId, studentId).days;

  const totalAttendance = db.prepare(`
    SELECT COUNT(DISTINCT date(login_at)) as days FROM login_logs
    WHERE tenant_id = ? AND student_id = ?
  `).get(tenantId, studentId).days;

  // ── nextGoal: (teacher_commentsなどから取得。なければnull) ──
  // 専用テーブルがないのでnullを返す
  const nextGoal = null;

  res.json({
    stats: {
      today: { alt: todayAlt, plays: todayPlays, minutes: Math.round(todayMinutes / 60) },
      week: { alt: weekAlt, plays: weekPlays, minutes: Math.round(weekMinutes / 60) },
      total: { alt: totalAlt, plays: totalPlays, minutes: Math.round(totalMinutes / 60) },
    },
    rank: { position: rankPosition || 1, total: totalStudents, label: rankLabel },
    teacherComments,
    aiComments,
    calendar,
    categoryStats: categoryStats.map(c => ({
      category: c.category,
      plays: c.plays,
      correct: c.correct,
      total: c.total,
    })),
    rankHistory: rankHistory.reverse(),
    bestScores: bestScores.map(s => ({
      game_id: s.game_id,
      game_name: s.game_name,
      game_emoji: s.game_emoji,
      score: s.score,
      score_label: s.score_label || '点',
    })),
    recentPlays: recentPlaysWithAlt,
    attendance: {
      thisMonth: thisMonthAttendance,
      lastMonth: lastMonthAttendance,
      total: totalAttendance,
    },
    nextGoal,
  });
});

module.exports = router;
