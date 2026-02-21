/**
 * TrailSDK v1.0
 * ゲームに数行で組み込めるプレイ記録SDK
 *
 * ━━━ 使い方 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  1. ゲームのHTMLに以下を追加:
 *
 *     <script src="https://trail-game-pro-3-2.onrender.com/trail-sdk.js"></script>
 *
 *  2. ゲーム開始時:
 *
 *     await TrailSDK.start();
 *
 *  3. ゲーム終了時:
 *
 *     await TrailSDK.end({
 *       score: 850,
 *       correct_count: 17,
 *       total_count: 20,
 *       metadata: { difficulty: 'hard', stage: 3 }  // 任意
 *     });
 *
 *  ※ ゲームURLに ?student_id=XX&game_id=YY&tenant_id=ZZ が
 *    自動付与されるので、SDK側で自動取得します。
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

(function (global) {
  'use strict';

  // ---- 設定 ----
  const API_BASE = (() => {
    // SDKのスクリプトURLからAPIベースを自動検出
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || '';
      if (src.includes('trail-sdk.js')) {
        return src.replace('/trail-sdk.js', '');
      }
    }
    // フォールバック: 同じオリジン
    return window.location.origin;
  })();

  // ---- URLパラメータからコンテキスト取得 ----
  function getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      tenant_id: parseInt(params.get('tenant_id')) || null,
      student_id: parseInt(params.get('student_id')) || null,
      game_id: parseInt(params.get('game_id')) || null,
    };
  }

  // ---- 状態管理 ----
  let _sessionId = null;
  let _startTime = null;
  let _context = null;
  let _ended = false;

  // ---- SDK本体 ----
  const TrailSDK = {

    /**
     * セッション開始
     * @returns {Promise<{session_id: number}>}
     */
    async start() {
      _context = getParams();
      _ended = false;

      // パラメータ不足チェック
      if (!_context.tenant_id || !_context.student_id || !_context.game_id) {
        console.warn(
          '[TrailSDK] URLパラメータが不足しています。' +
          '?tenant_id=X&student_id=Y&game_id=Z を確認してください。' +
          ' → オフラインモードで動作します。'
        );
        _sessionId = null;
        _startTime = Date.now();
        return { session_id: null, offline: true };
      }

      try {
        const resp = await fetch(`${API_BASE}/api/play-sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(_context),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        _sessionId = data.session_id;
        _startTime = Date.now();

        console.log(`[TrailSDK] セッション開始: #${_sessionId}`);
        return { session_id: _sessionId, offline: false };

      } catch (err) {
        console.error('[TrailSDK] セッション開始失敗:', err.message);
        _startTime = Date.now();
        return { session_id: null, offline: true, error: err.message };
      }
    },

    /**
     * セッション終了
     * @param {Object} result - ゲーム結果
     * @param {number} [result.score] - スコア
     * @param {number} [result.correct_count] - 正答数
     * @param {number} [result.total_count] - 問題数
     * @param {Object} [result.metadata] - ゲーム固有データ（任意）
     * @returns {Promise<{duration_seconds: number}>}
     */
    async end(result = {}) {
      if (_ended) {
        console.warn('[TrailSDK] セッションは既に終了しています');
        return { duration_seconds: 0, already_ended: true };
      }
      _ended = true;

      const elapsed = _startTime
        ? Math.round((Date.now() - _startTime) / 1000)
        : 0;

      // オフラインモードの場合
      if (!_sessionId) {
        console.log(`[TrailSDK] オフライン終了 (${elapsed}秒)`);
        return { duration_seconds: elapsed, offline: true };
      }

      try {
        const resp = await fetch(
          `${API_BASE}/api/play-sessions/${_sessionId}/end`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              score: result.score || null,
              correct_count: result.correct_count || null,
              total_count: result.total_count || null,
              metadata: result.metadata || null,
            }),
          }
        );

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        console.log(
          `[TrailSDK] セッション終了: #${_sessionId} (${data.duration_seconds}秒)`
        );
        return { duration_seconds: data.duration_seconds, offline: false };

      } catch (err) {
        console.error('[TrailSDK] セッション終了失敗:', err.message);
        return { duration_seconds: elapsed, offline: true, error: err.message };
      }
    },

    /**
     * 現在のセッション情報を取得
     */
    getSessionInfo() {
      return {
        session_id: _sessionId,
        context: _context,
        started: _startTime ? new Date(_startTime).toISOString() : null,
        elapsed_seconds: _startTime
          ? Math.round((Date.now() - _startTime) / 1000)
          : 0,
        ended: _ended,
      };
    },

    /**
     * 中間スコアを送信（長いゲーム用、将来拡張）
     */
    async heartbeat() {
      if (!_sessionId || _ended) return;
      // 将来的にここでアクティブ確認を実装
      console.log(`[TrailSDK] ♥ alive (#${_sessionId})`);
    },
  };

  // ---- ページ離脱時の自動終了 ----
  window.addEventListener('beforeunload', () => {
    if (_sessionId && !_ended) {
      // sendBeaconで確実に送信
      const payload = JSON.stringify({
        score: null,
        correct_count: null,
        total_count: null,
        metadata: { auto_closed: true },
      });
      navigator.sendBeacon(
        `${API_BASE}/api/play-sessions/${_sessionId}/end`,
        new Blob([payload], { type: 'application/json' })
      );
      _ended = true;
      console.log('[TrailSDK] ページ離脱 → 自動終了');
    }
  });

  // ---- グローバル公開 ----
  global.TrailSDK = TrailSDK;

})(typeof window !== 'undefined' ? window : this);
