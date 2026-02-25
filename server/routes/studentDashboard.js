/**
 * Student Dashboard Routes - 生徒ダッシュボード API
 * GET /:tenantSlug/student-dashboard
 */
'use strict';

const { Router } = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = Router();

// ═══ ランク定義 ═══
const RANK_TABLE = [
  { min: 0,    max: 99,   label: 'Fランク', name: '見習い探究者' },
  { min: 100,  max: 499,  label: 'Eランク', name: '初級探究者' },
  { min: 500,  max: 1499, label: 'Dランク', name: '中級探究者' },
  { min: 1500, max: 2999, label: 'Cランク', name: '上級探究者' },
  { min: 3000, max: 4999, label: 'Bランク', name: '探究エキスパート' },
  { min: 5000, max: 9998, label: 'Aランク', name: '探究マスター' },
  { min: 9999, max: Infinity, label: 'Sランク', name: '探究レジェンド' },
];

function getRank(totalAlt) {
  const alt = totalAlt || 0;
  for (const r of RANK_TABLE) {
    if (alt >= r.min && alt <= r.max) {
      const nextAlt = r.max === Infinity ? null : r.max + 1;
      return { label: r.label, name: r.name, nextAlt, currentAlt: alt };
    }
  }
  return { label: 'Fランク', name: '見習い探究者', nextAlt: 100, currentAlt: alt };
}

// ═══ バッジ定義 ═══
function computeBadges(studentId, tenantId, totalAlt, streak, categoryCount, totalCategories) {
  const badges = [];

  // はじめの一歩: 初めてゲームをプレイ
  const firstPlay = db.prepare(
    'SELECT COUNT(*) as c FROM play_sessions WHERE student_id = ? AND tenant_id = ?'
  ).get(studentId, tenantId);
  badges.push({ name: 'はじめの一歩', emoji: '🌱', earned: (firstPlay?.c || 0) > 0 });

  // 連続5日
  badges.push({ name: '連続5日', emoji: '🔥', earned: (streak || 0) >= 5 });

  // ALT100突破
  badges.push({ name: 'ALT100突破', emoji: '💯', earned: (totalAlt || 0) >= 100 });

  // 全カテゴリ制覇
  badges.push({ name: '全カテゴリ制覇', emoji: '🌟', earned: totalCategories > 0 && categoryCount >= totalCategories });

  // ALT200突破
  badges.push({ name: 'ALT200突破', emoji: '🏆', earned: (totalAlt || 0) >= 200 });

  // 連続30日
  badges.push({ name: '連続30日', emoji: '👑', earned: (streak || 0) >= 30 });

  return badges;
}

// ═══ 今日のミッション生成 ═══
function getTodayMission(studentId, tenantId, jstToday) {
  // カテゴリ別プレイ数を取得し、最もプレイ数が少ないカテゴリをミッションに
  const categories = db.prepare(`
    SELECT g.category, COUNT(ps.id) as plays
    FROM games g
    LEFT JOIN play_sessions ps ON ps.game_id = g.id AND ps.student_id = ? AND ps.tenant_id = ?
    WHERE g.tenant_id = ? AND g.is_active = 1 AND g.category IS NOT NULL
    GROUP BY g.category
    ORDER BY plays ASC
    LIMIT 1
  `).get(studentId, tenantId, tenantId);

  const cat = categories?.category || '算数';
  const emojiMap = { '歴史': '🏯', '算数': '🔢', '地理': '🗾', '理科': '🔬', '国語': '📖', 'その他': '🎮' };

  // 今日そのカテゴリをプレイ済みか
  const todayPlay = db.prepare(`
    SELECT COUNT(*) as c FROM play_sessions ps
    JOIN games g ON ps.game_id = g.id
    WHERE ps.student_id = ? AND ps.tenant_id = ? AND g.category = ?
      AND DATE(ps.started_at) = ?
  `).get(studentId, tenantId, cat, jstToday);

  return {
    category: cat,
    description: `${cat}ゲームを1回プレイしよう！`,
    completed: (todayPlay?.c || 0) > 0
  };
}

// ═══ メインエンドポイント ═══
router.get('/:tenantSlug/student-dashboard', (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: 'テナントが見つかりません' });
    }

    const tenantId = tenant.id;

    // Bearer認証 or クエリパラメータ ?student= で生徒を特定
    let studentId = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const decoded = verifyToken(auth.slice(7));
        if (decoded.role === 'student' && decoded.tenantId === tenantId) {
          studentId = decoded.studentId;
        }
      } catch (e) { /* ignore invalid token */ }
    }
    if (!studentId && req.query.student) {
      const studentRow = db.prepare(
        'SELECT id FROM students WHERE name = ? AND tenant_id = ?'
      ).get(req.query.student, tenantId);
      if (studentRow) studentId = studentRow.id;
    }
    if (!studentId) {
      return res.status(400).json({ error: '生徒の指定が必要です' });
    }

    // JST日付
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const jstToday = jstNow.toISOString().slice(0, 10);
    const jstWeekAgo = new Date(jstNow - 7 * 86400000).toISOString().slice(0, 10);

    // ── stats: 今日 / 今週 / 累計 ──
    const todayStats = db.prepare(`
      SELECT COALESCE(SUM(cl.amount), 0) as alt,
             COUNT(DISTINCT ps.id) as plays,
             COALESCE(SUM(ps.duration_seconds), 0) as seconds
      FROM coin_logs cl
      LEFT JOIN play_sessions ps ON ps.student_id = cl.student_id AND ps.tenant_id = cl.tenant_id
        AND DATE(ps.started_at) = ?
      WHERE cl.student_id = ? AND cl.tenant_id = ? AND DATE(cl.created_at) = ?
    `).get(jstToday, studentId, tenantId, jstToday);

    // Better: separate queries to avoid cross-join
    const todayAlt = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs WHERE student_id = ? AND tenant_id = ? AND DATE(created_at) = ?`
    ).get(studentId, tenantId, jstToday);
    const todayPlays = db.prepare(
      `SELECT COUNT(*) as plays, COALESCE(SUM(duration_seconds), 0) as seconds FROM play_sessions WHERE student_id = ? AND tenant_id = ? AND DATE(started_at) = ?`
    ).get(studentId, tenantId, jstToday);

    const weekAlt = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs WHERE student_id = ? AND tenant_id = ? AND DATE(created_at) >= ?`
    ).get(studentId, tenantId, jstWeekAgo);
    const weekPlays = db.prepare(
      `SELECT COUNT(*) as plays, COALESCE(SUM(duration_seconds), 0) as seconds FROM play_sessions WHERE student_id = ? AND tenant_id = ? AND DATE(started_at) >= ?`
    ).get(studentId, tenantId, jstWeekAgo);

    const totalAltRow = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as alt FROM coin_logs WHERE student_id = ? AND tenant_id = ?`
    ).get(studentId, tenantId);
    const totalPlays = db.prepare(
      `SELECT COUNT(*) as plays, COALESCE(SUM(duration_seconds), 0) as seconds FROM play_sessions WHERE student_id = ? AND tenant_id = ?`
    ).get(studentId, tenantId);

    const totalAlt = totalAltRow?.alt || 0;

    const stats = {
      today: { alt: todayAlt?.alt || 0, plays: todayPlays?.plays || 0, minutes: Math.round((todayPlays?.seconds || 0) / 60) },
      week: { alt: weekAlt?.alt || 0, plays: weekPlays?.plays || 0, minutes: Math.round((weekPlays?.seconds || 0) / 60) },
      total: { alt: totalAlt, plays: totalPlays?.plays || 0, minutes: Math.round((totalPlays?.seconds || 0) / 60) },
    };

    // ── streak ──
    const streakRow = db.prepare(
      'SELECT current_streak, max_streak FROM streaks WHERE student_id = ? AND tenant_id = ?'
    ).get(studentId, tenantId);
    const streak = streakRow?.current_streak || 0;

    // ── rank ──
    const rank = getRank(totalAlt);

    // ── categoryStats ──
    const emojiMap = { '歴史': '🏯', '算数': '🔢', '地理': '🗾', '理科': '🔬', '国語': '📖', 'その他': '🎮' };
    const categoryRows = db.prepare(`
      SELECT g.category,
             COUNT(ps.id) as plays,
             COALESCE(SUM(ps.correct_count), 0) as correct
      FROM play_sessions ps
      JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ? AND ps.tenant_id = ? AND g.category IS NOT NULL
      GROUP BY g.category
      ORDER BY plays DESC
    `).all(studentId, tenantId);

    const categoryStats = categoryRows.map(r => ({
      category: r.category,
      emoji: emojiMap[r.category] || '🎮',
      plays: r.plays,
      correct: r.correct,
    }));

    // ── bestScores ──
    const bestScores = db.prepare(`
      SELECT r.game_id, g.name as game_name, g.emoji as game_emoji,
             MAX(r.score) as score, r.score_label
      FROM rankings r
      JOIN games g ON r.game_id = g.id
      WHERE r.student_id = ? AND r.tenant_id = ?
      GROUP BY r.game_id
      ORDER BY score DESC
    `).all(studentId, tenantId);

    // ── unplayedGames ──
    const playedGameIds = db.prepare(
      `SELECT DISTINCT game_id FROM play_sessions WHERE student_id = ? AND tenant_id = ?`
    ).all(studentId, tenantId).map(r => r.game_id);
    const allGameIds = db.prepare(
      `SELECT id FROM games WHERE tenant_id = ? AND is_active = 1`
    ).all(tenantId).map(r => r.id);
    const unplayedGames = allGameIds.filter(id => !playedGameIds.includes(id));

    // ── todayMission ──
    const todayMission = getTodayMission(studentId, tenantId, jstToday);

    // ── badges ──
    const allCategories = db.prepare(
      `SELECT DISTINCT category FROM games WHERE tenant_id = ? AND is_active = 1 AND category IS NOT NULL`
    ).all(tenantId);
    const playedCategories = db.prepare(`
      SELECT COUNT(DISTINCT g.category) as c
      FROM play_sessions ps JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ? AND ps.tenant_id = ? AND g.category IS NOT NULL
    `).get(studentId, tenantId);
    const badges = computeBadges(studentId, tenantId, totalAlt, streak, playedCategories?.c || 0, allCategories.length);

    // ── calendar (今月) ──
    const firstOfMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const calendar = db.prepare(`
      SELECT DATE(started_at) as date,
             COUNT(*) as plays,
             COALESCE(SUM(ps.duration_seconds), 0) as seconds
      FROM play_sessions ps
      WHERE ps.student_id = ? AND ps.tenant_id = ? AND DATE(ps.started_at) >= ?
      GROUP BY DATE(ps.started_at)
      ORDER BY date DESC
    `).all(studentId, tenantId, firstOfMonth).map(r => ({
      date: r.date,
      plays: r.plays,
      alt: 0, // ALTは別テーブルから
    }));

    // カレンダーにALT情報を追加
    const calAlt = db.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as alt
      FROM coin_logs
      WHERE student_id = ? AND tenant_id = ? AND DATE(created_at) >= ?
      GROUP BY DATE(created_at)
    `).all(studentId, tenantId, firstOfMonth);
    const altByDate = {};
    calAlt.forEach(r => { altByDate[r.date] = r.alt; });
    calendar.forEach(d => { d.alt = altByDate[d.date] || 0; });

    // ── weeklyRanking ──
    const weeklyRanking = db.prepare(`
      SELECT s.name as student_name, COALESCE(SUM(cl.amount), 0) as total_coins
      FROM coin_logs cl
      JOIN students s ON cl.student_id = s.id
      WHERE cl.tenant_id = ? AND DATE(cl.created_at) >= ?
      GROUP BY cl.student_id
      ORDER BY total_coins DESC
      LIMIT 10
    `).all(tenantId, jstWeekAgo).map((r, i) => ({
      student_name: r.student_name,
      total_coins: r.total_coins,
      rank: i + 1,
    }));

    res.json({
      stats,
      streak,
      rank,
      categoryStats,
      bestScores,
      unplayedGames,
      todayMission,
      badges,
      calendar,
      weeklyRanking,
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ error: 'ダッシュボードの取得に失敗しました' });
  }
});

module.exports = router;
