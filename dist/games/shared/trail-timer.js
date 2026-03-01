/**
 * TrailTimer - タイマーUI
 * TRAIL Game Pro 3.2 / Task 0-12
 *
 * 使い方:
 *   <script src="/games/shared/trail-timer.js"></script>
 *
 *   // カウントアップ
 *   const timer = new TrailTimer({ elementId: 'my-timer' });
 *   timer.start();
 *   timer.getSeconds(); // 経過秒数
 *   timer.stop();
 *
 *   // カウントダウン
 *   const cd = new TrailTimer({ mode: 'down', seconds: 60, elementId: 'my-timer' });
 *   cd.start();
 *   cd.onExpire(() => gameOver());
 */

(function (global) {
  'use strict';

  class TrailTimer {

    /**
     * @param {Object} options
     * @param {string}   [options.mode='up']        - 'up'（カウントアップ）| 'down'（カウントダウン）
     * @param {number}   [options.seconds=0]         - カウントダウン時の初期秒数
     * @param {string}   [options.elementId=null]    - 表示するDOM要素のID
     * @param {string}   [options.format='mm:ss']    - 'mm:ss' | 'ss' | 's'
     * @param {boolean}  [options.autoStart=false]   - 初期化と同時に開始
     * @param {number}   [options.warningAt=10]      - カウントダウン時の警告秒数
     */
    constructor({
      mode      = 'up',
      seconds   = 0,
      elementId = null,
      format    = 'mm:ss',
      autoStart = false,
      warningAt = 10,
    } = {}) {
      this._mode      = mode;
      this._initial   = seconds;
      this._elapsed   = 0;
      this._remaining = seconds;
      this._format    = format;
      this._warningAt = warningAt;
      this._el        = elementId ? document.getElementById(elementId) : null;
      this._interval  = null;
      this._running   = false;
      this._startedAt = null;

      // コールバック
      this._onExpire  = null;
      this._onTick    = null;
      this._onWarn    = false; // 警告済みフラグ

      this._render();
      if (autoStart) this.start();
    }

    // ── 開始 ──
    start() {
      if (this._running) return this;
      this._running   = true;
      this._startedAt = Date.now() - this._elapsed * 1000;

      this._interval = setInterval(() => {
        const rawElapsed = Math.floor((Date.now() - this._startedAt) / 1000);
        this._elapsed = rawElapsed;

        if (this._mode === 'down') {
          this._remaining = Math.max(this._initial - rawElapsed, 0);
          this._render();

          // 警告（残りwarningAt秒）
          if (!this._onWarn && this._remaining <= this._warningAt) {
            this._onWarn = true;
            if (this._el) this._el.classList.add('tt-warning');
          }

          // 時間切れ
          if (this._remaining === 0) {
            this.stop();
            if (typeof this._onExpire === 'function') this._onExpire();
          }
        } else {
          this._render();
        }

        if (typeof this._onTick === 'function') {
          this._onTick(this._mode === 'down' ? this._remaining : this._elapsed);
        }
      }, 500); // 0.5秒ごとに更新（精度と負荷のバランス）

      return this;
    }

    // ── 停止 ──
    stop() {
      if (!this._running) return this;
      clearInterval(this._interval);
      this._interval = null;
      this._running  = false;
      return this;
    }

    // ── リセット ──
    reset() {
      this.stop();
      this._elapsed   = 0;
      this._remaining = this._initial;
      this._startedAt = null;
      this._onWarn    = false;
      if (this._el) this._el.classList.remove('tt-warning');
      this._render();
      return this;
    }

    // ── 経過秒数取得 ──
    getSeconds() {
      return this._elapsed;
    }

    // ── 残り秒数取得（カウントダウン用）──
    getRemaining() {
      return this._remaining;
    }

    // ── 実行中か ──
    isRunning() {
      return this._running;
    }

    // ── 時間切れコールバック（カウントダウン用）──
    onExpire(fn) {
      this._onExpire = fn;
      return this;
    }

    // ── 毎秒コールバック ──
    onTick(fn) {
      this._onTick = fn;
      return this;
    }

    // ── DOM更新 ──
    _render() {
      if (!this._el) return;
      const val = this._mode === 'down' ? this._remaining : this._elapsed;
      this._el.textContent = this._format === 'mm:ss' ? toMMSS(val) : val;
    }
  }

  // ─────────────────────────────────────────────
  // ユーティリティ
  // ─────────────────────────────────────────────
  function toMMSS(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ─────────────────────────────────────────────
  // CSS インジェクト
  // ─────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('trail-timer-css')) return;
    const style = document.createElement('style');
    style.id = 'trail-timer-css';
    style.textContent = `
      /* TrailTimer スタイル */
      .tt-warning {
        color: #ff4d4d !important;
        animation: tt-blink 0.5s ease infinite alternate;
      }
      @keyframes tt-blink {
        from { opacity: 1; }
        to   { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectCSS);
    } else {
      injectCSS();
    }
  }

  global.TrailTimer = TrailTimer;

})(typeof window !== 'undefined' ? window : global);