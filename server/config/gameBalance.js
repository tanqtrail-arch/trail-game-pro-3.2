/**
 * Game Balance Config - TRAIL Game Pro 3.2
 * 全ゲームバランス定数の一元管理
 *
 * ★ altCalculator.js の既存値を転記。altCalculator.js 自体は変更しない。
 *   将来的にこちらを参照元に切り替える。
 */

'use strict';

module.exports = {
  // --- ALT関連（altCalculator.js の既存値を転記）---
  ALT_CAP: 30,
  DIMINISH_RATES: [1.0, 0.6, 0.3, 0.1],
  RANK_THRESHOLDS: [
    { rank: 'F', label: '見習い探究者',   min: 0 },
    { rank: 'E', label: '初級探究者',     min: 1000 },
    { rank: 'D', label: '中級探究者',     min: 5000 },
    { rank: 'C', label: '上級探究者',     min: 15000 },
    { rank: 'B', label: '探究エキスパート', min: 30000 },
    { rank: 'A', label: '探究マスター',   min: 50000 },
    { rank: 'S', label: '探究レジェンド', min: 99999 },
  ],
  DAILY_NEW_GAME_BONUS_LIMIT: 3,

  // --- 科目レベル（新規）---
  SUBJECT_LEVEL_THRESHOLDS: [
    { level: 1,  title: '見習い',     minAlt: 0 },
    { level: 2,  title: 'かけだし',   minAlt: 100 },
    { level: 3,  title: '修行中',     minAlt: 300 },
    { level: 4,  title: '一人前',     minAlt: 600 },
    { level: 5,  title: '達人見習い', minAlt: 1000 },
    { level: 6,  title: '達人',       minAlt: 1500 },
    { level: 7,  title: '名人見習い', minAlt: 2200 },
    { level: 8,  title: '名人',       minAlt: 3000 },
    { level: 9,  title: '超名人',     minAlt: 4000 },
    { level: 10, title: '伝説',       minAlt: 5500 },
  ],

  // --- コース段位（新規・第2段階で使用）---
  COURSE_GRADE_THRESHOLDS: [
    { grade: '4級',   minMastered: 0 },
    { grade: '3級',   minMastered: 2 },
    { grade: '準2級', minMastered: 3 },
    { grade: '2級',   minMastered: 4 },
    { grade: '準1級', minMastered: 5 },
    { grade: '1級',   minMastered: 6 },
    { grade: '特級',  minMastered: 7 },
  ],

  // --- ログインボーナス ---
  LOGIN_BONUS: {
    daily: 5,
    weekStreak: 20,
  },

  // --- ミッション報酬 ---
  MISSION_REWARDS: {
    daily_3games: 10,
    daily_perfect: 10,
    daily_2subjects: 5,
    weekly_4days: 90,
  },
};
