/**
 * TrailAuth - PIN入力UI
 * TRAIL Game Pro 3.2 / Task 0-9
 *
 * 使い方:
 *   <link rel="stylesheet" href="/games/shared/trail-auth.css">
 *   <script src="/js/trail-sdk.js"></script>
 *   <script src="/games/shared/trail-auth.js"></script>
 *
 *   TrailAuth.show({ tenantId: '...', gameId: 'A-1' })
 *     .then(({ student, token }) => startGame(student));
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────
  // 定数
  // ─────────────────────────────────────────────
  const PIN_LENGTH = 4;

  // ─────────────────────────────────────────────
  // 内部状態
  // ─────────────────────────────────────────────
  let _resolve = null;
  let _reject  = null;
  let _pin     = '';
  let _overlay = null;

  // ─────────────────────────────────────────────
  // DOM生成
  // ─────────────────────────────────────────────
  function buildUI() {
    // 二重表示防止
    if (document.getElementById('trail-auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'trail-auth-overlay';
    overlay.innerHTML = `
      <div class="ta-modal">
        <div class="ta-logo">🔥 TRAIL</div>
        <h2 class="ta-title">PINを入力してください</h2>

        <!-- PIN表示ドット -->
        <div class="ta-dots" id="ta-dots">
          ${Array.from({ length: PIN_LENGTH }, (_, i) =>
            `<div class="ta-dot" id="ta-dot-${i}"></div>`
          ).join('')}
        </div>

        <!-- エラーメッセージ -->
        <p class="ta-error" id="ta-error"></p>

        <!-- 数字キーパッド -->
        <div class="ta-keypad">
          ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
            <button
              class="ta-key ${k === '' ? 'ta-key--empty' : ''} ${k === '⌫' ? 'ta-key--del' : ''}"
              data-key="${k}"
              ${k === '' ? 'disabled' : ''}
            >${k}</button>
          `).join('')}
        </div>

        <p class="ta-hint">先生から教えてもらった4桁の番号を入力してね</p>
      </div>
    `;

    document.body.appendChild(overlay);
    _overlay = overlay;

    // キーパッドのイベント
    overlay.addEventListener('click', e => {
      const key = e.target.closest('[data-key]');
      if (!key) return;
      const val = key.dataset.key;
      if (val === '⌫') {
        handleDelete();
      } else if (val !== '') {
        handleInput(val);
      }
    });

    // キーボード入力にも対応
    document.addEventListener('keydown', handleKeydown);
  }

  function handleInput(digit) {
    if (_pin.length >= PIN_LENGTH) return;
    _pin += digit;
    updateDots();
    clearError();
    if (_pin.length === PIN_LENGTH) {
      setTimeout(submitPin, 150); // 入力完了後に少し待ってから送信
    }
  }

  function handleDelete() {
    _pin = _pin.slice(0, -1);
    updateDots();
    clearError();
  }

  function handleKeydown(e) {
    if (e.key >= '0' && e.key <= '9') handleInput(e.key);
    if (e.key === 'Backspace') handleDelete();
  }

  function updateDots() {
    for (let i = 0; i < PIN_LENGTH; i++) {
      const dot = document.getElementById(`ta-dot-${i}`);
      if (!dot) continue;
      dot.classList.toggle('ta-dot--filled', i < _pin.length);
    }
  }

  function showError(msg) {
    const el = document.getElementById('ta-error');
    if (el) el.textContent = msg;
    // ドットをシェイク
    const dots = document.getElementById('ta-dots');
    if (dots) {
      dots.classList.add('ta-shake');
      setTimeout(() => dots.classList.remove('ta-shake'), 500);
    }
  }

  function clearError() {
    const el = document.getElementById('ta-error');
    if (el) el.textContent = '';
  }

  function setLoading(loading) {
    const keys = document.querySelectorAll('.ta-key');
    keys.forEach(k => k.disabled = loading);
    const title = document.querySelector('.ta-title');
    if (title) title.textContent = loading ? '確認中...' : 'PINを入力してください';
  }

  async function submitPin() {
    if (_pin.length !== PIN_LENGTH) return;
    setLoading(true);

    try {
      const result = await global.TrailSDK.loginWithPin(_pin);
      destroy();
      if (_resolve) _resolve(result);
    } catch (err) {
      _pin = '';
      updateDots();
      setLoading(false);
      // エラーメッセージを表示
      if (err.status === 429) {
        showError(err.message || 'しばらく待ってから試してね');
      } else {
        showError('PINが違います。もう一度入力してね');
      }
    }
  }

  function destroy() {
    if (_overlay) {
      _overlay.remove();
      _overlay = null;
    }
    document.removeEventListener('keydown', handleKeydown);
    _pin     = '';
    _resolve = null;
    _reject  = null;
  }

  // ─────────────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────────────
  const TrailAuth = {

    /**
     * PIN入力UIを表示してログインを待つ
     *
     * @param {Object} config
     * @param {string} config.tenantId
     * @param {string} config.gameId
     * @param {number} [config.studentId]  - 既にわかっている場合
     * @returns {Promise<{ student, tenant, token }>}
     */
    show({ tenantId, gameId, studentId } = {}) {
      return new Promise((resolve, reject) => {
        // TrailSDK を初期化
        global.TrailSDK.init({ tenantId, gameId, studentId });

        // 既にログイン済みならスキップ
        if (global.TrailSDK.isLoggedIn()) {
          return resolve({ skipped: true });
        }

        _resolve = resolve;
        _reject  = reject;
        _pin     = '';

        buildUI();
      });
    },

    /**
     * UIを強制的に閉じる
     */
    hide() {
      destroy();
    },
  };

  global.TrailAuth = TrailAuth;

})(typeof window !== 'undefined' ? window : global);
