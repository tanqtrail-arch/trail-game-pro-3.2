/**
 * Parent Calendar & Goals Routes
 * GET /calendar/:studentId       - 月別カレンダーデータ
 * GET /calendar/:studentId/day/:date - 日別詳細
 * GET /goals/:studentId          - 週間・月間目標と達成度
 */
const { Router } = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = Router();

// ═══ 目標定数 ═══
const GOALS = {
  weekly: {
    play_days: 5,
    play_count: 20,
    duration_min: 150
  },
  monthly: {
    play_days: 20,
    avg_accuracy: 70,
    game_types: 5
  }
};

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

// ═══ ヘルパー: studentIdの権限チェック ═══
function validateStudentAccess(req, res) {
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(studentId)) {
    res.status(400).json({ error: '無効な生徒IDです' });
    return null;
  }
  if (req.user.parentOf !== studentId) {
    res.status(403).json({ error: 'この生徒のデータにアクセスできません' });
    return null;
  }
  return studentId;
}

// ═══ GET /calendar/:studentId ═══
router.get('/calendar/:studentId', requireParent, (req, res) => {
  try {
    const studentId = validateStudentAccess(req, res);
    if (studentId === null) return;

    const monthParam = req.query.month; // YYYY-MM
    const now = new Date();
    let year, month;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split('-').map(Number);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = `${monthStr}-01`;
    // 翌月1日
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();

    // 日別サマリー (play_sessions)
    const dailyRows = db.prepare(`
      SELECT
        date(ps.started_at) AS play_date,
        COUNT(*) AS play_count,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(CASE WHEN ps.total_count > 0 THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy,
        GROUP_CONCAT(DISTINCT g.name) AS game_names
      FROM play_sessions ps
      LEFT JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ?
        AND date(ps.started_at) >= ?
        AND date(ps.started_at) < ?
      GROUP BY date(ps.started_at)
      ORDER BY play_date
    `).all(studentId, startDate, nextMonth);

    // コイン日別集計
    const coinRows = db.prepare(`
      SELECT
        date(created_at) AS coin_date,
        COALESCE(SUM(amount), 0) AS coins
      FROM coin_logs
      WHERE student_id = ?
        AND date(created_at) >= ?
        AND date(created_at) < ?
      GROUP BY date(created_at)
    `).all(studentId, startDate, nextMonth);

    const coinMap = {};
    for (const r of coinRows) {
      coinMap[r.coin_date] = r.coins;
    }

    const dailyMap = {};
    for (const r of dailyRows) {
      dailyMap[r.play_date] = r;
    }

    // 全日分のdays配列を作成
    const days = [];
    let activeDays = 0;
    let totalPlays = 0;
    let totalSeconds = 0;
    let allAccuracies = [];
    const allGames = new Set();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const row = dailyMap[dateStr];
      const coins = coinMap[dateStr] || 0;

      if (row) {
        const games = row.game_names ? row.game_names.split(',') : [];
        games.forEach(g => allGames.add(g));
        const dayData = {
          date: dateStr,
          play_count: row.play_count,
          duration_min: Math.round(row.total_seconds / 60),
          games: games,
          avg_accuracy: row.avg_accuracy !== null ? row.avg_accuracy : 0,
          coins_earned: coins,
          has_activity: true
        };
        days.push(dayData);
        activeDays++;
        totalPlays += row.play_count;
        totalSeconds += row.total_seconds;
        if (row.avg_accuracy !== null) {
          allAccuracies.push(row.avg_accuracy);
        }
      } else {
        days.push({
          date: dateStr,
          play_count: 0,
          duration_min: 0,
          games: [],
          avg_accuracy: 0,
          coins_earned: coins,
          has_activity: false
        });
      }
    }

    // most_played_game を集計
    const gameCountMap = {};
    for (const r of dailyRows) {
      if (r.game_names) {
        r.game_names.split(',').forEach(g => {
          gameCountMap[g] = (gameCountMap[g] || 0) + r.play_count;
        });
      }
    }
    let mostPlayedGame = '';
    let maxCount = 0;
    for (const [game, count] of Object.entries(gameCountMap)) {
      if (count > maxCount) {
        mostPlayedGame = game;
        maxCount = count;
      }
    }

    res.json({
      month: monthStr,
      days,
      summary: {
        active_days: activeDays,
        total_days: daysInMonth,
        total_plays: totalPlays,
        total_duration_min: Math.round(totalSeconds / 60),
        most_played_game: mostPlayedGame,
        avg_accuracy: allAccuracies.length > 0
          ? Math.round(allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length * 10) / 10
          : 0
      }
    });
  } catch (e) {
    console.error('Calendar error:', e);
    res.status(500).json({ error: 'カレンダーデータの取得に失敗しました' });
  }
});

// ═══ GET /calendar/:studentId/day/:date ═══
router.get('/calendar/:studentId/day/:date', requireParent, (req, res) => {
  try {
    const studentId = validateStudentAccess(req, res);
    if (studentId === null) return;

    const date = req.params.date; // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: '無効な日付形式です。YYYY-MM-DDで指定してください' });
    }

    const nextDate = (() => {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    // セッション一覧
    const sessions = db.prepare(`
      SELECT
        g.name AS game_name,
        ps.score,
        CASE WHEN ps.total_count > 0 THEN ROUND(ps.correct_count * 100.0 / ps.total_count, 1) ELSE 0 END AS accuracy,
        COALESCE(ROUND(ps.duration_seconds / 60.0, 0), 0) AS duration_min,
        substr(ps.started_at, 12, 5) AS played_at
      FROM play_sessions ps
      LEFT JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ?
        AND date(ps.started_at) >= ?
        AND date(ps.started_at) < ?
      ORDER BY ps.started_at ASC
    `).all(studentId, date, nextDate);

    // コイン
    const coinRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS coins
      FROM coin_logs
      WHERE student_id = ?
        AND date(created_at) >= ?
        AND date(created_at) < ?
    `).get(studentId, date, nextDate);

    const playCount = sessions.length;
    const totalDurationMin = sessions.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const accuracies = sessions.filter(s => s.accuracy > 0).map(s => s.accuracy);
    const avgAccuracy = accuracies.length > 0
      ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length * 10) / 10
      : 0;
    const bestScore = sessions.reduce((max, s) => Math.max(max, s.score || 0), 0);

    res.json({
      date,
      sessions: sessions.map(s => ({
        game_name: s.game_name || '不明',
        score: s.score || 0,
        accuracy: s.accuracy || 0,
        duration_min: s.duration_min || 0,
        played_at: s.played_at || ''
      })),
      summary: {
        play_count: playCount,
        duration_min: totalDurationMin,
        avg_accuracy: avgAccuracy,
        best_score: bestScore,
        coins_earned: coinRow ? coinRow.coins : 0
      }
    });
  } catch (e) {
    console.error('Day detail error:', e);
    res.status(500).json({ error: '日別データの取得に失敗しました' });
  }
});

// ═══ GET /goals/:studentId ═══
router.get('/goals/:studentId', requireParent, (req, res) => {
  try {
    const studentId = validateStudentAccess(req, res);
    if (studentId === null) return;

    const tenantId = req.tenantId;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // 今週月曜を計算
    const dayOfWeek = now.getDay(); // 0=日
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const mondayStr = monday.toISOString().slice(0, 10);

    // 今月1日
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // 今週の日曜を計算
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = sunday.toISOString().slice(0, 10);

    // === 週間集計 ===
    const weeklyStats = db.prepare(`
      SELECT
        COUNT(DISTINCT date(started_at)) AS play_days,
        COUNT(*) AS play_count,
        COALESCE(SUM(duration_seconds), 0) AS total_seconds
      FROM play_sessions
      WHERE student_id = ?
        AND date(started_at) >= ?
        AND date(started_at) <= ?
    `).get(studentId, mondayStr, today);

    // === 月間集計 ===
    const monthlyStats = db.prepare(`
      SELECT
        COUNT(DISTINCT date(started_at)) AS play_days,
        ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) AS avg_accuracy,
        COUNT(DISTINCT game_id) AS game_types
      FROM play_sessions
      WHERE student_id = ?
        AND date(started_at) >= ?
        AND date(started_at) <= ?
    `).get(studentId, monthStart, today);

    // === ストリーク ===
    const streakRow = db.prepare(`
      SELECT current_streak, max_streak
      FROM streaks
      WHERE student_id = ? AND tenant_id = ?
    `).get(studentId, tenantId);

    // 今週の日別プレイパターン（月〜日）
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push(d.toISOString().slice(0, 10));
    }

    const weekPlayDates = db.prepare(`
      SELECT DISTINCT date(started_at) AS play_date
      FROM play_sessions
      WHERE student_id = ?
        AND date(started_at) >= ?
        AND date(started_at) <= ?
    `).all(studentId, mondayStr, sundayStr);

    const playDateSet = new Set(weekPlayDates.map(r => r.play_date));
    const weekPattern = weekDays.map(d => playDateSet.has(d));

    // pct計算ヘルパー
    const pct = (actual, target) => target > 0 ? Math.round(actual / target * 100) : 0;

    const wPlayDays = weeklyStats.play_days || 0;
    const wPlayCount = weeklyStats.play_count || 0;
    const wDurationMin = Math.round((weeklyStats.total_seconds || 0) / 60);

    const mPlayDays = monthlyStats.play_days || 0;
    const mAvgAccuracy = monthlyStats.avg_accuracy || 0;
    const mGameTypes = monthlyStats.game_types || 0;

    res.json({
      weekly: {
        play_days: { target: GOALS.weekly.play_days, actual: wPlayDays, pct: pct(wPlayDays, GOALS.weekly.play_days) },
        play_count: { target: GOALS.weekly.play_count, actual: wPlayCount, pct: pct(wPlayCount, GOALS.weekly.play_count) },
        duration_min: { target: GOALS.weekly.duration_min, actual: wDurationMin, pct: pct(wDurationMin, GOALS.weekly.duration_min) }
      },
      monthly: {
        play_days: { target: GOALS.monthly.play_days, actual: mPlayDays, pct: pct(mPlayDays, GOALS.monthly.play_days) },
        avg_accuracy: { target: GOALS.monthly.avg_accuracy, actual: mAvgAccuracy, pct: pct(mAvgAccuracy, GOALS.monthly.avg_accuracy) },
        game_types: { target: GOALS.monthly.game_types, actual: mGameTypes, pct: pct(mGameTypes, GOALS.monthly.game_types) }
      },
      streak: {
        current: streakRow ? streakRow.current_streak : 0,
        longest: streakRow ? streakRow.max_streak : 0,
        week_pattern: weekPattern
      }
    });
  } catch (e) {
    console.error('Goals error:', e);
    res.status(500).json({ error: '目標データの取得に失敗しました' });
  }
});

module.exports = router;
