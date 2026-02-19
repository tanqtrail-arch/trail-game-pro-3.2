/**
 * Analytics Routes - ダッシュボード・分析 API
 */
const { Router } = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = Router();

// ═══ ダッシュボード統計 ═══
router.get('/:tenantSlug/analytics/dashboard', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const tid = tenant.id;

  const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students WHERE tenant_id = ?').get(tid).c;
  const totalGames = db.prepare('SELECT COUNT(*) as c FROM games WHERE tenant_id = ? AND is_active = 1').get(tid).c;
  const totalCoins = db.prepare('SELECT COALESCE(SUM(amount), 0) as c FROM coin_logs WHERE tenant_id = ?').get(tid).c;
  const totalBadges = db.prepare('SELECT COUNT(*) as c FROM badges WHERE tenant_id = ?').get(tid).c;
  const totalRankings = db.prepare('SELECT COUNT(*) as c FROM rankings WHERE tenant_id = ?').get(tid).c;
  const totalPlays = db.prepare('SELECT COUNT(*) as c FROM game_play_logs WHERE tenant_id = ?').get(tid).c;

  // クラス別統計
  const classStats = db.prepare(`
    SELECT c.id, c.name,
      (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count,
      COALESCE((SELECT SUM(cl.amount) FROM coin_logs cl JOIN students s ON cl.student_id = s.id WHERE s.class_id = c.id), 0) as total_coins
    FROM classes c WHERE c.tenant_id = ?
    ORDER BY c.name
  `).all(tid);

  // ゲーム利用ランキング
  const gameUsage = db.prepare(`
    SELECT g.id, g.name, g.emoji,
      (SELECT COUNT(*) FROM game_play_logs WHERE game_id = g.id) as play_count,
      (SELECT COUNT(DISTINCT student_id) FROM game_play_logs WHERE game_id = g.id) as unique_players
    FROM games g WHERE g.tenant_id = ? AND g.is_active = 1
    ORDER BY play_count DESC LIMIT 10
  `).all(tid);

  // 最近のアクティビティ
  const recentActivity = db.prepare(
    'SELECT * FROM activity_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 30'
  ).all(tid);

  // 今日のアクティブ生徒
  const todayActive = db.prepare(`
    SELECT COUNT(DISTINCT student_id) as c FROM login_logs
    WHERE tenant_id = ? AND date(login_at) = date('now')
  `).get(tid).c;

  res.json({
    stats: { totalStudents, totalGames, totalCoins, totalBadges, totalRankings, totalPlays, todayActive },
    classStats,
    gameUsage,
    recentActivity,
    plan: { name: tenant.plan, maxStudents: tenant.max_students, maxGames: tenant.max_games, maxClasses: tenant.max_classes },
  });
});

// ═══ ログイン履歴 ═══
router.get('/:tenantSlug/analytics/logins', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const logs = db.prepare(`
    SELECT ll.id, ll.login_at, ll.logout_at, ll.duration_seconds,
      s.name as student_name, c.name as class_name
    FROM login_logs ll
    JOIN students s ON ll.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    WHERE ll.tenant_id = ?
    ORDER BY ll.login_at DESC LIMIT 200
  `).all(tenant.id);

  res.json({ logs });
});

// ═══ ゲーム利用統計 ═══
router.get('/:tenantSlug/analytics/gameplay', requireAdmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  const perPlayer = db.prepare(`
    SELECT s.name as student_name, c.name as class_name,
      COUNT(*) as total_plays,
      SUM(gpl.duration_seconds) as total_duration,
      COUNT(DISTINCT gpl.game_id) as games_played
    FROM game_play_logs gpl
    JOIN students s ON gpl.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    WHERE gpl.tenant_id = ?
    GROUP BY gpl.student_id
    ORDER BY total_plays DESC
  `).all(tenant.id);

  const perGame = db.prepare(`
    SELECT g.name as game_name, g.emoji,
      COUNT(*) as total_plays,
      COUNT(DISTINCT gpl.student_id) as unique_players,
      SUM(gpl.duration_seconds) as total_duration
    FROM game_play_logs gpl
    JOIN games g ON gpl.game_id = g.id
    WHERE gpl.tenant_id = ?
    GROUP BY gpl.game_id
    ORDER BY total_plays DESC
  `).all(tenant.id);

  res.json({ perPlayer, perGame });
});

// ═══ ゲームプレイ記録（生徒/管理者から） ═══
router.post('/:tenantSlug/analytics/gameplay', requireAdmin, (req, res) => {
  const { studentId, gameId, durationSeconds } = req.body;
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant || req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

  db.prepare(
    'INSERT INTO game_play_logs (tenant_id, student_id, game_id, duration_seconds) VALUES (?, ?, ?, ?)'
  ).run(tenant.id, studentId, gameId, durationSeconds || 0);

  res.status(201).json({ ok: true });
});

// ═══ ログアウト記録 ═══
router.post('/:tenantSlug/analytics/logout', (req, res) => {
  const { studentId, durationSeconds } = req.body;
  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
  if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });

  const lastLogin = db.prepare(
    'SELECT id FROM login_logs WHERE tenant_id = ? AND student_id = ? AND logout_at IS NULL ORDER BY login_at DESC LIMIT 1'
  ).get(tenant.id, studentId);

  if (lastLogin) {
    db.prepare(
      "UPDATE login_logs SET logout_at = datetime('now'), duration_seconds = ? WHERE id = ?"
    ).run(durationSeconds || 0, lastLogin.id);
  }

  res.json({ ok: true });
});

module.exports = router;
