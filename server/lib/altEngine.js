/**
 * ALT Engine - TRAIL Game Pro 3.2
 * 全ゲーム共通の報酬（ALT仮想通貨）自動計算エンジン
 *
 * DB: SQLite / better-sqlite3（同期API）
 * Task 0-3
 */

'use strict';

const db = require('../db');

// ─────────────────────────────────────────────
// デフォルトルール定数（DBにルールがない場合のフォールバック）
// alt_rules テーブルの seed 値と同じ
// ─────────────────────────────────────────────
const DEFAULT_RULES = {
  play_complete:  5,
  accuracy_80:   10,
  perfect:       20,   // accuracy_80 と排他：高い方のみ適用
  time_10min:     5,
  time_30min:    15,   // time_10min と排他：高い方のみ適用
  highscore:     15,
  new_game:      10,
  streak_3:      30,
  streak_7:     100,   // streak_3 と排他：最高段階のみ適用
  streak_30:    500,   // streak_7 と排他：最高段階のみ適用
  monthly_10:    50,
  monthly_30:   150,   // monthly_10 と排他：到達回数ピッタリの時のみ付与
};

// ─────────────────────────────────────────────
// テナント別ルールをDBから取得
// ─────────────────────────────────────────────
function getRules(tenantId) {
  const rows = db.prepare(
    'SELECT rule_key, alt_amount FROM alt_rules WHERE tenant_id = ? AND is_active = 1'
  ).all(tenantId);

  const rules = { ...DEFAULT_RULES };
  for (const row of rows) {
    rules[row.rule_key] = row.alt_amount;
  }
  return rules;
}

// ─────────────────────────────────────────────
// ALT付与額を計算する（純粋関数・DB不要）
// ─────────────────────────────────────────────
/**
 * @param {Object} rules         - getRules(tenantId) の戻り値
 * @param {Object} params
 * @param {boolean} params.completed
 * @param {number}  params.accuracy         0〜100（%）
 * @param {number}  params.durationSeconds
 * @param {boolean} params.isPersonalBest
 * @param {number}  params.currentStreak    更新後のストリーク日数
 * @param {number}  params.monthlyPlayCount 当月プレイ回数（今回分を含む）
 * @param {boolean} params.isFirstPlay      このゲームの初プレイか
 * @returns {{ total: number, breakdown: Object, awards: Array }}
 */
function calculateALT(rules, {
  completed        = false,
  accuracy         = 0,
  durationSeconds  = 0,
  isPersonalBest   = false,
  currentStreak    = 0,
  monthlyPlayCount = 0,
  isFirstPlay      = false,
} = {}) {
  const breakdown = {};
  const awards    = []; // TrailSDK の演出用リスト
  let   total     = 0;

  const add = (key, label) => {
    const amount = rules[key] || 0;
    if (amount <= 0) return;
    breakdown[key] = amount;
    awards.push({ reason: key, label, amount });
    total += amount;
  };

  // ① プレイ完了
  if (completed) add('play_complete', 'プレイ完了');

  // ② 正答率（100% と 80% は排他・高い方のみ）
  if (accuracy === 100)      add('perfect',     '正答率100%！');
  else if (accuracy >= 80)   add('accuracy_80', '正答率80%以上');

  // ③ 学習時間（30分 と 10分 は排他・高い方のみ）
  if      (durationSeconds >= 1800) add('time_30min', '30分以上プレイ');
  else if (durationSeconds >=  600) add('time_10min', '10分以上プレイ');

  // ④ 自己ベスト更新
  if (isPersonalBest) add('highscore', '自己ベスト更新！');

  // ⑤ ストリーク（ちょうど到達した日だけ付与・最高段階のみ）
  if      (currentStreak === 30) add('streak_30', '30日連続！');
  else if (currentStreak ===  7) add('streak_7',  '7日連続！');
  else if (currentStreak ===  3) add('streak_3',  '3日連続！');

  // ⑥ 月間マイルストーン（ちょうど到達回数のみ・重複防止）
  if      (monthlyPlayCount === 30) add('monthly_30', '今月30回達成！');
  else if (monthlyPlayCount === 10) add('monthly_10', '今月10回達成！');

  // ⑦ 新規ゲーム初プレイ
  if (isFirstPlay) add('new_game', '初プレイボーナス！');

  return { total, breakdown, awards };
}

// ─────────────────────────────────────────────
// ストリーク更新（同期）
// ─────────────────────────────────────────────
/**
 * 連続プレイ日数を更新し、更新後の値を返す
 * JST（UTC+9）基準で日付を判定
 * streaks テーブルは UNIQUE(student_id, tenant_id) ← ゲーム横断
 *
 * @param {number} studentId
 * @param {string} tenantId
 * @returns {number} 更新後の current_streak
 */
function updateAndGetStreak(studentId, tenantId) {
  // JST の今日（YYYY-MM-DD）
  const jstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today   = jstDate.toISOString().slice(0, 10);

  const row = db.prepare(
    'SELECT current_streak, max_streak, last_play_date FROM streaks WHERE student_id = ? AND tenant_id = ?'
  ).get(studentId, tenantId);

  if (!row) {
    db.prepare(`
      INSERT INTO streaks (student_id, tenant_id, current_streak, max_streak, last_play_date)
      VALUES (?, ?, 1, 1, ?)
    `).run(studentId, tenantId, today);
    return 1;
  }

  const lastPlay = row.last_play_date;
  const diffDays = lastPlay
    ? Math.round((new Date(today) - new Date(lastPlay)) / (1000 * 60 * 60 * 24))
    : 999;

  let newStreak;
  if (diffDays === 0) {
    newStreak = row.current_streak;      // 同日：変化なし
  } else if (diffDays === 1) {
    newStreak = row.current_streak + 1;  // 翌日：継続
  } else {
    newStreak = 1;                       // 2日以上の空き：リセット
  }

  const newMax = Math.max(newStreak, row.max_streak || 0);

  db.prepare(`
    UPDATE streaks
       SET current_streak = ?,
           max_streak     = ?,
           last_play_date = ?,
           updated_at     = datetime('now')
     WHERE student_id = ? AND tenant_id = ?
  `).run(newStreak, newMax, today, studentId, tenantId);

  return newStreak;
}

// ─────────────────────────────────────────────
// 月間プレイ回数（同期）
// ─────────────────────────────────────────────
/**
 * 当月（JST）のプレイ回数を返す（今回分を含む）
 *
 * @param {number} studentId
 * @param {string} tenantId
 * @returns {number}
 */
function getMonthlyPlayCount(studentId, tenantId) {
  const jstNow   = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const firstDay = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const row = db.prepare(`
    SELECT COUNT(*) AS cnt
      FROM play_sessions
     WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
  `).get(studentId, tenantId, firstDay);

  return row?.cnt ?? 0;
}

// ─────────────────────────────────────────────
// 初プレイ判定（同期）
// ─────────────────────────────────────────────
/**
 * そのゲームが生徒にとって初プレイかどうかを返す
 * ※今回のセッションを INSERT した後に呼ぶこと（cnt === 1 が初プレイ）
 *
 * @param {number} studentId
 * @param {number} gameId
 * @returns {boolean}
 */
function isFirstPlayForGame(studentId, gameId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM play_sessions WHERE student_id = ? AND game_id = ?
  `).get(studentId, gameId);
  return (row?.cnt ?? 0) === 1;
}

// ─────────────────────────────────────────────
// 自己ベスト更新判定（同期）
// ─────────────────────────────────────────────
/**
 * 今回のスコアが自己ベストを更新しているかを返す
 * ※今回のセッションを INSERT した後に呼ぶこと
 *
 * @param {number} studentId
 * @param {number} gameId
 * @param {number|null} currentScore
 * @returns {boolean}
 */
function checkPersonalBest(studentId, gameId, currentScore) {
  if (currentScore == null) return false;
  const row = db.prepare(`
    SELECT MAX(score) AS best
      FROM play_sessions
     WHERE student_id = ? AND game_id = ? AND ended_at IS NOT NULL
  `).get(studentId, gameId);
  return row?.best == null || currentScore >= row.best;
}

// ─────────────────────────────────────────────
// ALTをDBに記録・coin_logsに付与履歴を保存（同期トランザクション）
// ─────────────────────────────────────────────
/**
 * @param {number} studentId
 * @param {string} tenantId
 * @param {number} sessionId
 * @param {number} gameId
 * @param {number} altAmount
 * @param {string} breakdownJson
 */
function persistALT(studentId, tenantId, sessionId, gameId, altAmount, breakdownJson) {
  if (altAmount <= 0) return;

  db.transaction(() => {
    // play_sessions にフラグ＋金額を記録
    db.prepare(`
      UPDATE play_sessions SET alt_awarded = 1, alt_amount = ? WHERE id = ?
    `).run(altAmount, sessionId);

    // coin_logs に付与履歴を残す（保護者ダッシュボード・残高計算のソース）
    db.prepare(`
      INSERT INTO coin_logs (tenant_id, student_id, game_id, amount, note, awarded_by)
      VALUES (?, ?, ?, ?, ?, 'alt_engine')
    `).run(tenantId, studentId, gameId, altAmount, breakdownJson);
  })();
}

// ─────────────────────────────────────────────
// オールインワン：セッション終了時に呼ぶ統合関数
// playSessions.js の PATCH /:id/end から呼ぶ
// ─────────────────────────────────────────────
/**
 * @param {Object} session
 * @param {number}  session.id             - play_sessions.id
 * @param {number}  session.studentId
 * @param {string}  session.tenantId
 * @param {number}  session.gameId
 * @param {boolean} session.completed
 * @param {number}  session.accuracy       - 0〜100（%）null の場合は 0 扱い
 * @param {number}  session.durationSeconds
 * @param {number|null} session.score
 * @returns {{ total: number, breakdown: Object, awards: Array }}
 */
function processSessionALT(session) {
  const {
    id: sessionId, studentId, tenantId, gameId,
    completed, accuracy, durationSeconds, score,
  } = session;

  // 二重付与ガード
  const existing = db.prepare(
    'SELECT alt_awarded FROM play_sessions WHERE id = ?'
  ).get(sessionId);
  if (existing?.alt_awarded) {
    return { total: 0, breakdown: {}, awards: [] };
  }

  const rules            = getRules(tenantId);
  const currentStreak    = updateAndGetStreak(studentId, tenantId);
  const monthlyPlayCount = getMonthlyPlayCount(studentId, tenantId);
  const firstPlay        = isFirstPlayForGame(studentId, gameId);
  const personalBest     = checkPersonalBest(studentId, gameId, score);

  const result = calculateALT(rules, {
    completed,
    accuracy:        accuracy ?? 0,
    durationSeconds: durationSeconds ?? 0,
    isPersonalBest:  personalBest,
    currentStreak,
    monthlyPlayCount,
    isFirstPlay:     firstPlay,
  });

  // DB保存（失敗してもプレイ記録は壊さない）
  try {
    persistALT(studentId, tenantId, sessionId, gameId, result.total, JSON.stringify(result.breakdown));
  } catch (err) {
    console.error('[altEngine] persistALT error (non-fatal):', err.message);
    return { ...result, persistError: true };
  }

  return result;
}

// ─────────────────────────────────────────────
// エクスポート
// ─────────────────────────────────────────────
module.exports = {
  processSessionALT,    // ★ メイン: playSessions.js から使う
  calculateALT,         // 単体テスト・フロントプレビュー用
  getRules,
  updateAndGetStreak,
  getMonthlyPlayCount,
  isFirstPlayForGame,
  checkPersonalBest,
  persistALT,
};