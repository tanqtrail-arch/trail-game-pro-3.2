/**
 * ALT Calculator - 統一ALT計算関数
 * TRAIL Game Pro 3.2
 *
 * ALT計算の3段階フロー:
 *   ① calculateBaseAlt()  → 正答率・連続正解から基本ALT算出（最大30）
 *   ② calcDiminishedAlt() → 同日プレイ回数で逓減
 *   ③ applyGameCap()      → ゲーム別累計上限チェック
 *   ④ calcBonusRate()     → チャレンジボーナス（初プレイ・苦手カテゴリ）※キャップ後に適用
 */

'use strict';

// ─────────────────────────────────────────────
// ① 基本ALT計算（正答率ベース・統一関数）
// ─────────────────────────────────────────────
/**
 * @param {number} correctCount  - 正答数
 * @param {number} totalCount    - 総問題数
 * @param {number} maxStreak     - 最大連続正解数
 * @param {number} durationSeconds - プレイ時間（秒）
 * @returns {number} 獲得ALT（1〜30）
 */
function calculateBaseAlt(correctCount, totalCount, maxStreak, durationSeconds) {
  if (totalCount === 0) return 1; // 最低保証

  const correctRate = correctCount / totalCount;

  // 基本ALT（正答率ベース）
  let alt;
  if (correctRate >= 1.0) {
    alt = 25; // パーフェクト基本
  } else if (correctRate >= 0.8) {
    alt = 15;
  } else if (correctRate >= 0.5) {
    alt = 8;
  } else {
    alt = 3;
  }

  // 連続正解ボーナス（+1 ALT per 3 streak）
  alt += Math.floor((maxStreak || 0) / 3);

  // パーフェクトボーナス
  if (correctRate >= 1.0) {
    alt += 5; // パーフェクト時 +5 で合計30
  }

  // 上限30、下限1
  return Math.max(1, Math.min(30, alt));
}

// ─────────────────────────────────────────────
// ② 同一ゲーム連続プレイの逓減
// ─────────────────────────────────────────────
/**
 * @param {number} baseAlt        - 基本ALT（①の結果）
 * @param {number} todayPlayCount - 当日の同一ゲームプレイ回数（今回含む）
 * @returns {number} 逓減適用後ALT
 */
function calcDiminishedAlt(baseAlt, todayPlayCount) {
  const rates = [1.0, 0.6, 0.3, 0.1];
  const index = Math.min(todayPlayCount - 1, rates.length - 1);
  return Math.max(1, Math.round(baseAlt * rates[index]));
}

// ─────────────────────────────────────────────
// ③ ゲーム別ALTキャップ制
// ─────────────────────────────────────────────
/**
 * ランクに応じたゲーム別ALT上限を返す
 * @param {number} totalAlt - 生徒の全体累計ALT
 * @returns {number} ゲーム別ALT上限（Infinity = 無制限）
 */
function getGameAltCap(totalAlt) {
  if (totalAlt >= 99999) return Infinity;  // Sランク: 無制限
  if (totalAlt >= 50000) return 7000;      // Aランク
  if (totalAlt >= 30000) return 4000;      // Bランク
  if (totalAlt >= 15000) return 2000;      // Cランク
  if (totalAlt >= 5000)  return 1000;      // Dランク
  if (totalAlt >= 1000)  return 500;       // Eランク
  return 300;                               // Fランク
}

/**
 * キャップ適用後のALTを計算
 * @param {number} earnedAlt       - 今回獲得ALT（逓減適用済み）
 * @param {number} gameLifetimeAlt - このゲームの累計獲得ALT
 * @param {number} studentTotalAlt - 生徒の全体累計ALT
 * @returns {{ alt: number, capped: boolean, cap: number, gameLifetimeAlt: number }}
 */
function applyGameCap(earnedAlt, gameLifetimeAlt, studentTotalAlt) {
  const cap = getGameAltCap(studentTotalAlt);
  if (cap === Infinity) return { alt: earnedAlt, capped: false, cap, gameLifetimeAlt };

  const remaining = Math.max(0, cap - gameLifetimeAlt);
  if (remaining <= 0) return { alt: 0, capped: true, cap, gameLifetimeAlt };
  if (earnedAlt <= remaining) return { alt: earnedAlt, capped: false, cap, gameLifetimeAlt };
  return { alt: remaining, capped: true, cap, gameLifetimeAlt };
}

// ─────────────────────────────────────────────
// ④ チャレンジボーナス
// ─────────────────────────────────────────────
/**
 * @param {number}  alt            - キャップ適用済みALT
 * @param {boolean} isFirstPlay    - 初プレイかどうか
 * @param {boolean} isWeakCategory - 苦手カテゴリかどうか（正答率50%以下）
 * @returns {{ alt: number, bonusRate: number }}
 */
function calcBonusRate(alt, isFirstPlay, isWeakCategory) {
  let rate = 1.0;
  if (isFirstPlay && isWeakCategory) {
    rate = 2.5;
  } else if (isFirstPlay) {
    rate = 2.0;
  } else if (isWeakCategory) {
    rate = 1.5;
  }
  return {
    alt: Math.round(alt * rate),
    bonusRate: rate,
  };
}

// ─────────────────────────────────────────────
// ランク名取得（フロントエンド表示用）
// ─────────────────────────────────────────────
function getRankLabel(totalAlt) {
  if (totalAlt >= 99999) return { rank: 'S', name: '探究レジェンド' };
  if (totalAlt >= 50000) return { rank: 'A', name: '探究マスター' };
  if (totalAlt >= 30000) return { rank: 'B', name: '探究エキスパート' };
  if (totalAlt >= 15000) return { rank: 'C', name: '上級探究者' };
  if (totalAlt >= 5000)  return { rank: 'D', name: '中級探究者' };
  if (totalAlt >= 1000)  return { rank: 'E', name: '初級探究者' };
  return { rank: 'F', name: '見習い探究者' };
}

module.exports = {
  calculateBaseAlt,
  calcDiminishedAlt,
  getGameAltCap,
  applyGameCap,
  calcBonusRate,
  getRankLabel,
};
