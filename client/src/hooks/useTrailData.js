import { useState, useEffect } from 'react';
import * as api from '../api/trailApi';

export function useTrailData(studentId) {
  const [data, setData] = useState({
    student: null,
    games: [],
    coins: [],
    streak: null,
    rankings: [],
    sessions: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!studentId) return;

    async function fetchAll() {
      try {
        const [games, coins, streak, rankings, sessions] =
          await Promise.allSettled([
            api.getGames(),
            api.getCoins(),
            api.getStreak(studentId),
            api.getRankings(),
            api.getPlaySessions(),
          ]);

        const allCoins = coins.status === 'fulfilled' ? coins.value : [];
        const myCoins = Array.isArray(allCoins)
          ? allCoins.filter(c => c.student_id === studentId)
          : [];

        const totalAlt = myCoins.reduce((sum, c) => sum + (c.amount || 0), 0);
        const rank = calculateRank(totalAlt);

        const allSessions = sessions.status === 'fulfilled' ? sessions.value : [];
        const mySessions = Array.isArray(allSessions)
          ? allSessions.filter(s => s.student_id === studentId)
          : [];

        setData({
          student: (() => {
            const cached = api.getCachedStudent();
            const storedName = localStorage.getItem('trail_student_name');
            return {
              id: studentId,
              name: cached?.name || storedName || '---',
              class_name: cached?.class_name || '',
              totalAlt,
              ...rank,
            };
          })(),
          games: games.status === 'fulfilled' && Array.isArray(games.value) ? games.value : [],
          coins: myCoins,
          streak: streak.status === 'fulfilled' ? streak.value : null,
          rankings: rankings.status === 'fulfilled' && Array.isArray(rankings.value) ? rankings.value : [],
          sessions: mySessions,
          loading: false,
          error: null,
        });
      } catch (err) {
        setData(prev => ({ ...prev, loading: false, error: err.message }));
      }
    }

    fetchAll();
  }, [studentId]);

  return data;
}

function calculateRank(totalAlt) {
  if (totalAlt >= 100000) return { rank: 'S', rankLabel: '達人' };
  if (totalAlt >= 50000)  return { rank: 'A', rankLabel: '上級' };
  if (totalAlt >= 25000)  return { rank: 'B', rankLabel: '中上級' };
  if (totalAlt >= 10000)  return { rank: 'C', rankLabel: '中級' };
  if (totalAlt >= 5000)   return { rank: 'D', rankLabel: '中初級' };
  if (totalAlt >= 1000)   return { rank: 'E', rankLabel: '初級' };
  return { rank: 'F', rankLabel: '見習い' };
}

// ─── ヘルパー関数 ──────────────────

export function buildRecentGames(sessions, games) {
  const gameMap = new Map(games.map(g => [g.id, g]));
  const latest = {};

  sessions.forEach(s => {
    if (!latest[s.game_id] || new Date(s.ended_at) > new Date(latest[s.game_id].ended_at)) {
      latest[s.game_id] = s;
    }
  });

  return Object.values(latest)
    .sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at))
    .slice(0, 5)
    .map(s => {
      const game = gameMap.get(s.game_id) || {};
      return {
        id: s.game_id,
        name: game.name || 'ゲーム' + s.game_id,
        emoji: game.emoji || '🎮',
        category: game.category || 'その他',
        lastScore: s.score || 0,
        bestScore: s.score || 0,
        lastPlayed: formatTimeAgo(s.ended_at),
      };
    });
}

export function buildWeeklyRanking(rankings, myId) {
  if (!Array.isArray(rankings)) return [];
  return rankings
    .sort((a, b) => (b.total_alt || 0) - (a.total_alt || 0))
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      name: r.student_name || r.name || '---',
      alt: r.total_alt || 0,
      isMe: r.student_id === myId,
    }));
}

export function buildSubjectLevels(coins, games) {
  const categoryMap = {};
  const gameMap = new Map(games.map(g => [g.id, g]));

  coins.forEach(c => {
    const game = gameMap.get(c.game_id);
    const cat = game?.category || 'その他';
    categoryMap[cat] = (categoryMap[cat] || 0) + (c.amount || 0);
  });

  const thresholds = [0, 100, 300, 600, 1000, 2000];
  const titles = ['見習い', 'かけだし', '修行中', '一人前', '達人', 'マスター'];
  const emojis = { '算数': '📐', '社会': '🌏', '理科': '🔬', '国語': '📝', 'その他': '🎮', '歴史': '🏯', '地理': '🗾', '思考系': '🧠' };

  return Object.entries(categoryMap).map(([subject, totalAlt]) => {
    let level = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (totalAlt >= thresholds[i]) { level = i; break; }
    }
    const nextAt = thresholds[level + 1] || thresholds[thresholds.length - 1] * 2;
    return { subject, level, title: titles[level], totalAlt, nextAt, emoji: emojis[subject] || '📊' };
  });
}

export function buildMissions(sessions, streak) {
  const todaySessions = sessions.filter(s => {
    const d = new Date(s.ended_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  return [
    {
      id: 1, title: '今日3つのゲームをプレイしよう', reward: 10,
      progress: new Set(todaySessions.map(s => s.game_id)).size,
      goal: 3, emoji: '🎮', category: 'daily',
    },
    {
      id: 2, title: '算数ゲームで80%以上を取ろう', reward: 10,
      progress: todaySessions.filter(s => s.score >= 80).length > 0 ? 1 : 0,
      goal: 1, emoji: '🎯', category: 'daily',
    },
    {
      id: 3, title: '苦手カテゴリに挑戦しよう', reward: 5,
      progress: 0, goal: 1, emoji: '💪', category: 'daily',
    },
    {
      id: 4, title: '4日間ログインしよう', reward: 90,
      progress: streak?.current_streak || 0,
      goal: 4, emoji: '📅', category: 'weekly',
    },
  ];
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '---';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + '分前';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + '時間前';
  const days = Math.floor(hours / 24);
  return days + '日前';
}
