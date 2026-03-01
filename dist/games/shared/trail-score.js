/**
 * TrailScore - スコア表示・管理UI
 * TRAIL Game Pro 3.2 / Task 0-11
 *
 * 使い方:
 *   <script src="/games/shared/trail-score.js"></script>
 *
 *   const score = new TrailScore({ max: 1000 });
 *   score.add(10);          // +10点
 *   score.get();            // 現在のスコア
 *   score.showResult(alt);  // ゲーム終了時の結果画面
 */

(function (global) {
  'use strict';

  class TrailScore {

    /**
     * @param {Object} options
     * @param {number} [options.max=1000]       - 満点
     * @param {number} [options.initial=0]      - 初期スコア
     * @param {string} [options.elementId]      - スコア表示するDOM要素のID
     * @param {boolean} [options.animate=true]  - 加算アニメーション
     */
    constructor({ max = 1000, initial = 0, elementId = null, animate = true } = {}) {
      this._score   = initial;
      this._max     = max;
      this._el      = elementId ? document.getElementById(elementId) : null;
      this._animate = animate;
      this._render();
    }

    // ── スコア加算 ──
    add(points) {
      if (points <= 0) return this;
      this._score = Math.min(this._score + points, this._max);
      this._render();
      if (this._animate) this._popEffect(points);
      return this;
    }

    // ── スコア減算 ──
    subtract(points) {
      if (points <= 0) return this;
      this._score = Math.max(this._score - points, 0);
      this._render();
      return this;
    }

    // ── スコアセット ──
    set(value) {
      this._score = Math.max(0, Math.min(value, this._max));
      this._render();
      return this;
    }

    // ── 現在スコア取得 ──
    get() { return this._score; }

    // ── 正答率計算 ──
    accuracy(correct, total) {
      if (!total) return 0;
      return Math.round(correct * 100 / total);
    }

    // ── DOM更新 ──
    _render() {
      if (!this._el) return;
      this._el.textContent = this._score.toLocaleString();
    }

    // ── 加点エフェクト ──
    _popEffect(points) {
      if (!this._el) return;
      const pop = document.createElement('span');
      pop.className = 'ts-pop';
      pop.textContent = `+${points}`;
      this._el.parentElement?.appendChild(pop);
      pop.addEventListener('animationend', () => pop.remove());
    }

    // ══════════════════════════════════════════
    //  showResult - ゲーム終了結果画面
    // ══════════════════════════════════════════
    /**
     * @param {Object} [altResult]  - TrailSDK.endSession() の戻り値の alt
     * @param {Object} [options]
     * @param {string} [options.title]
     * @param {number} [options.correct]
     * @param {number} [options.total]
     * @param {number} [options.durationSeconds]
     * @param {Function} [options.onClose]  - 閉じるボタンを押した時のコールバック
     */
    showResult(altResult = {}, options = {}) {
      const {
        title           = 'ゲーム終了！',
        correct         = null,
        total           = null,
        durationSeconds = 0,
        onClose         = null,
      } = options;

      const accuracyPct = (correct !== null && total)
        ? this.accuracy(correct, total) : null;

      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      const timeStr = durationSeconds
        ? `${minutes}分${String(seconds).padStart(2, '0')}秒`
        : null;

      // モーダル生成
      const overlay = document.createElement('div');
      overlay.id = 'ts-result-overlay';
      overlay.innerHTML = `
        <div class="ts-modal">
          <div class="ts-title">${title}</div>

          <div class="ts-score-big">${this._score.toLocaleString()}<span class="ts-score-unit">点</span></div>

          <div class="ts-stats">
            ${accuracyPct !== null ? `
              <div class="ts-stat">
                <span class="ts-stat-label">正答率</span>
                <span class="ts-stat-value ${accuracyPct === 100 ? 'ts-perfect' : ''}">${accuracyPct}%</span>
              </div>` : ''}
            ${timeStr ? `
              <div class="ts-stat">
                <span class="ts-stat-label">プレイ時間</span>
                <span class="ts-stat-value">${timeStr}</span>
              </div>` : ''}
          </div>

          ${altResult.total > 0 ? `
          <div class="ts-alt-section">
            <div class="ts-alt-total">🪙 +${altResult.total} ALT 獲得！</div>
            <ul class="ts-awards">
              ${(altResult.awards || []).map(a =>
                `<li><span class="ts-award-label">${a.label}</span><span class="ts-award-amount">+${a.amount}</span></li>`
              ).join('')}
            </ul>
          </div>` : ''}

          <button class="ts-close-btn" id="ts-close-btn">
            ${onClose ? 'ゲームに戻る' : 'とじる'}
          </button>
        </div>
      `;

      document.body.appendChild(overlay);

      document.getElementById('ts-close-btn').addEventListener('click', () => {
        overlay.remove();
        if (typeof onClose === 'function') onClose();
      });

      return overlay;
    }
  }

  // ─────────────────────────────────────────────
  // CSS をインジェクト（trail-ui.css が未適用の場合のフォールバック）
  // ─────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('trail-score-css')) return;
    const style = document.createElement('style');
    style.id = 'trail-score-css';
    style.textContent = `
      /* TrailScore スタイル */
      .ts-pop {
        position: absolute;
        color: #ff9500;
        font-weight: 900;
        font-size: 20px;
        pointer-events: none;
        animation: ts-pop 0.7s ease forwards;
      }
      @keyframes ts-pop {
        0%   { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-40px) scale(1.4); }
      }
      #ts-result-overlay {
        position: fixed; inset: 0;
        background: rgba(10,10,20,0.9);
        display: flex; align-items: center; justify-content: center;
        z-index: 9998;
        animation: ts-fadein 0.25s ease;
      }
      @keyframes ts-fadein {
        from { opacity: 0; transform: scale(0.95); }
        to   { opacity: 1; transform: scale(1); }
      }
      .ts-modal {
        background: #1a1a2e;
        border: 1px solid rgba(255,165,0,0.3);
        border-radius: 20px;
        padding: 36px 28px 28px;
        width: min(380px, 92vw);
        text-align: center;
        box-shadow: 0 0 40px rgba(255,140,0,0.15);
        font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif;
      }
      .ts-title {
        font-size: 22px; font-weight: 900;
        color: #ff9500; margin-bottom: 16px;
      }
      .ts-score-big {
        font-size: 56px; font-weight: 900;
        color: #fff; line-height: 1;
        margin-bottom: 20px;
      }
      .ts-score-unit { font-size: 24px; color: #aaa; }
      .ts-stats {
        display: flex; justify-content: center; gap: 24px;
        margin-bottom: 20px;
      }
      .ts-stat { text-align: center; }
      .ts-stat-label { display: block; font-size: 12px; color: #888; }
      .ts-stat-value { display: block; font-size: 22px; font-weight: 700; color: #fff; }
      .ts-perfect { color: #ff9500; }
      .ts-alt-section {
        background: rgba(255,149,0,0.1);
        border: 1px solid rgba(255,149,0,0.3);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 20px;
      }
      .ts-alt-total {
        font-size: 20px; font-weight: 900;
        color: #ff9500; margin-bottom: 8px;
      }
      .ts-awards {
        list-style: none; padding: 0; margin: 0;
        display: flex; flex-direction: column; gap: 4px;
      }
      .ts-awards li {
        display: flex; justify-content: space-between;
        font-size: 13px; color: #ccc;
      }
      .ts-award-amount { color: #ff9500; font-weight: 700; }
      .ts-close-btn {
        background: #ff9500; color: #000;
        border: none; border-radius: 12px;
        padding: 14px 40px;
        font-size: 16px; font-weight: 700;
        cursor: pointer; width: 100%;
        transition: opacity 0.15s;
      }
      .ts-close-btn:hover { opacity: 0.85; }
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

  global.TrailScore = TrailScore;

})(typeof window !== 'undefined' ? window : global);