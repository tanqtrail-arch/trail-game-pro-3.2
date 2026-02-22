/**
 * TrailSDK - TRAIL Game Pro 3.2
 * 全ゲーム共通クライアントライブラリ
 *
 * 使い方:
 *   <script src="/js/trail-sdk.js"></script>
 *   await TrailSDK.init({ gameId: 'A-1', tenantId: '...', studentId: 1 });
 *   const session = await TrailSDK.startSession();
 *   const result  = await TrailSDK.endSession({ score, accuracy, duration });
 *
 * Task 0-8
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────
  // 内部状態
  // ─────────────────────────────────────────────
  const BASE_URL = '';  // 同一オリジン想定。外部ならフルURLを指定

  let _config = {
    gameId:    null,
    tenantId:  null,
    studentId: null,
    token:     null,   // JWTトークン（PIN認証後にセット）
  };

  let _sessionId    = null;
  let _sessionStart = null;

  // コールバック
  let _onAltEarned  = null;  // ALT獲得時の演出コールバック

  // ─────────────────────────────────────────────
  // ユーティリティ
  // ─────────────────────────────────────────────

  /**
   * 共通 fetch ラッパー（リトライ付き）
   */
  async function request(method, path, body, retry = 2) {
    const headers = { 'Content-Type': 'application/json' };
    if (_config.token) headers['Authorization'] = `Bearer ${_config.token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const res = await fetch(BASE_URL + path, options);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new TrailSDKError(err.error || 'APIエラー', res.status);
        }
        return await res.json();
      } catch (err) {
        if (attempt === retry) throw err;
        await sleep(500 * (attempt + 1));  // 指数バックオフ
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────
  // カスタムエラークラス
  // ─────────────────────────────────────────────
  class TrailSDKError extends Error {
    constructor(message, status) {
      super(message);
      this.name   = 'TrailSDKError';
      this.status = status;
    }
  }

  // ─────────────────────────────────────────────
  // localStorageヘルパー（トークン・生徒情報の永続化）
  // ─────────────────────────────────────────────
  const Storage = {
    set(key, value) {
      try { localStorage.setItem('trail_' + key, JSON.stringify(value)); } catch {}
    },
    get(key) {
      try { return JSON.parse(localStorage.getItem('trail_' + key)); } catch { return null; }
    },
    remove(key) {
      try { localStorage.removeItem('trail_' + key); } catch {}
    },
  };

  // ─────────────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────────────
  const TrailSDK = {

    // ══════════════════════════════════════════
    //  init - 初期化
    //  各ゲームの先頭で呼ぶ
    // ══════════════════════════════════════════
    /**
     * @param {Object} config
     * @param {string} config.gameId     - ゲームID（例: 'A-1'）
     * @param {string} config.tenantId   - テナントID
     * @param {number} [config.studentId] - 生徒ID（省略時はlocalStorageから復元）
     * @param {string} [config.token]     - JWTトークン（省略時はlocalStorageから復元）
     */
    init(config = {}) {
      if (!config.gameId)   throw new TrailSDKError('gameId は必須です');
      if (!config.tenantId) throw new TrailSDKError('tenantId は必須です');

      // localStorageから復元（引数が優先）
      const saved = Storage.get('auth') || {};
      _config = {
        gameId:    config.gameId,
        tenantId:  config.tenantId,
        studentId: config.studentId ?? saved.studentId ?? null,
        token:     config.token     ?? saved.token     ?? null,
      };

      console.log(`[TrailSDK] init: gameId=${_config.gameId}, studentId=${_config.studentId}`);
      return this;
    },

    // ══════════════════════════════════════════
    //  loginWithPin - PINで生徒ログイン
    // ══════════════════════════════════════════
    /**
     * @param {string} pin - 4桁PIN
     * @returns {Promise<{ student, tenant, token }>}
     */
    async loginWithPin(pin) {
      const data = await request('POST', '/api/auth/student/pin', {
        tenantId: _config.tenantId,
        pin,
      });
      // トークン・生徒情報を保存
      _config.token     = data.token;
      _config.studentId = data.student.id;
      Storage.set('auth', { token: data.token, studentId: data.student.id });
      return data;
    },

    // ══════════════════════════════════════════
    //  logout
    // ══════════════════════════════════════════
    logout() {
      _config.token     = null;
      _config.studentId = null;
      _sessionId        = null;
      _sessionStart     = null;
      Storage.remove('auth');
    },

    // ══════════════════════════════════════════
    //  isLoggedIn - ログイン済みかチェック
    // ══════════════════════════════════════════
    isLoggedIn() {
      return !!(_config.token && _config.studentId);
    },

    // ══════════════════════════════════════════
    //  startSession - ゲーム開始
    // ══════════════════════════════════════════
    /**
     * @returns {Promise<{ sessionId: number }>}
     */
    async startSession() {
      if (!_config.studentId) throw new TrailSDKError('ログインが必要です');
      if (!_config.gameId)    throw new TrailSDKError('gameId が未設定です');

      const data = await request('POST', '/api/play-sessions/start', {
        tenant_id:  _config.tenantId,
        student_id: _config.studentId,
        game_id:    _config.gameId,
      });

      _sessionId    = data.session_id;
      _sessionStart = Date.now();

      console.log(`[TrailSDK] startSession: sessionId=${_sessionId}`);
      return { sessionId: _sessionId };
    },

    // ══════════════════════════════════════════
    //  endSession - ゲーム終了 & ALT付与
    // ══════════════════════════════════════════
    /**
     * @param {Object} params
     * @param {number} params.score         - スコア
     * @param {number} params.accuracy      - 正答率 0〜100
     * @param {number} [params.duration]    - 省略時は startSession からの経過秒数を自動計算
     * @param {number} [params.correctCount]
     * @param {number} [params.totalCount]
     * @param {Object} [params.metadata]    - 任意の追加データ
     * @returns {Promise<{ duration, accuracy, alt: { total, awards, breakdown } }>}
     */
    async endSession({ score, accuracy, duration, correctCount, totalCount, metadata } = {}) {
      if (!_sessionId) throw new TrailSDKError('セッションが開始されていません');

      const body = {
        score:         score         ?? null,
        correct_count: correctCount  ?? null,
        total_count:   totalCount    ?? null,
        metadata:      metadata      ?? null,
      };

      const result = await request('PATCH', `/api/play-sessions/${_sessionId}/end`, body);

      console.log(`[TrailSDK] endSession: ALT=${result.alt?.total ?? 0}`);

      // ALT獲得コールバック
      if (result.alt?.awards?.length > 0 && typeof _onAltEarned === 'function') {
        _onAltEarned(result.alt);
      }

      _sessionId    = null;
      _sessionStart = null;

      return result;
    },

    // ══════════════════════════════════════════
    //  getBalance - ALT残高取得
    // ══════════════════════════════════════════
    /**
     * @returns {Promise<{ balance: number, logs: Array }>}
     */
    async getBalance() {
      if (!_config.studentId) throw new TrailSDKError('ログインが必要です');
      return await request(
        'GET',
        `/api/t/${_config.tenantId}/coins?student_id=${_config.studentId}`
      );
    },

    // ══════════════════════════════════════════
    //  getStreak - ストリーク情報取得
    // ══════════════════════════════════════════
    /**
     * @returns {Promise<{ streak, monthly, calendar }>}
     */
    async getStreak() {
      if (!_config.studentId) throw new TrailSDKError('ログインが必要です');
      return await request(
        'GET',
        `/api/streaks/${_config.studentId}?tenant_id=${_config.tenantId}`
      );
    },

    // ══════════════════════════════════════════
    //  getQuestions - 問題取得
    // ══════════════════════════════════════════
    /**
     * @param {Object} [filter]
     * @param {string} [filter.subject]
     * @param {number} [filter.difficulty]
     * @param {number} [filter.limit]
     * @returns {Promise<{ total, questions }>}
     */
    async getQuestions(filter = {}) {
      const params = new URLSearchParams({
        game_id: _config.gameId,
        ...filter,
      });
      return await request('GET', `/api/questions?${params}`);
    },

    // ══════════════════════════════════════════
    //  saveProgress - ゲーム進捗を保存
    // ══════════════════════════════════════════
    /**
     * @param {Object} saveData  - 保存するデータ（任意のJSONオブジェクト）
     * @param {string} [saveType] - 'auto' | 'manual'
     */
    async saveProgress(saveData, saveType = 'auto') {
      if (!_config.studentId) throw new TrailSDKError('ログインが必要です');
      return await request(
        'PUT',
        `/api/game-saves/${_config.studentId}/${_config.gameId}`,
        { save_data: saveData, save_type: saveType }
      );
    },

    // ══════════════════════════════════════════
    //  loadProgress - ゲーム進捗を読み込む
    // ══════════════════════════════════════════
    /**
     * @returns {Promise<{ exists, save_data, updated_at }>}
     */
    async loadProgress() {
      if (!_config.studentId) throw new TrailSDKError('ログインが必要です');
      return await request(
        'GET',
        `/api/game-saves/${_config.studentId}/${_config.gameId}`
      );
    },

    // ══════════════════════════════════════════
    //  onAltEarned - ALT獲得時のコールバック登録
    // ══════════════════════════════════════════
    /**
     * @param {Function} callback - ({ total, awards, breakdown }) => void
     *
     * 使い方:
     *   TrailSDK.onAltEarned(alt => {
     *     alt.awards.forEach(a => showPopup(a.label, a.amount));
     *   });
     */
    onAltEarned(callback) {
      _onAltEarned = callback;
      return this;
    },

    // ══════════════════════════════════════════
    //  getElapsedSeconds - 現在のプレイ時間（秒）
    // ══════════════════════════════════════════
    getElapsedSeconds() {
      if (!_sessionStart) return 0;
      return Math.floor((Date.now() - _sessionStart) / 1000);
    },

    // ══════════════════════════════════════════
    //  getConfig - 現在の設定を返す（デバッグ用）
    // ══════════════════════════════════════════
    getConfig() {
      return { ..._config, token: _config.token ? '***' : null };
    },

    // エラークラスを公開（ゲーム側でcatchできるよう）
    Error: TrailSDKError,
  };

  // グローバルに公開
  global.TrailSDK = TrailSDK;

})(typeof window !== 'undefined' ? window : global);