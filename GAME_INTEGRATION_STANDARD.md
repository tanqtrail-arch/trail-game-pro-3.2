# TRAIL Game Pro 3.2 — ゲーム連携規約

> **このドキュメントの目的**: 新しいゲームを追加・連携するとき、必ずこのファイルを最初に読め。
> ここに書かれたルールを破ると、ログアウト・ALT消失・二重記録などの障害が発生する。
> 過去にビルビルタウンがこのルールを知らずに作られ、システム全体に影響する障害を引き起こした。

---

## 第1章：ビルビルタウン事故の根本原因分析

### 1-1. 何が起きたか

ビルビルタウン（外部ゲーム）の追加により、以下の3つの障害が同時発生した。

| 障害 | 現象 | 影響範囲 |
|------|------|---------|
| ログアウト問題 | ゲーム終了後「他のゲームで遊ぶ」を押すとログアウト状態になる | 全ゲームユーザー |
| ALT消失 | ゲームをプレイしてもALTが正しく記録されない・0になる | ビルビルプレイヤー全員 |
| 報酬設計バイパス | 逓減・キャップ・チャレンジボーナスが一切適用されない | ビルビルプレイヤー全員 |

### 1-2. なぜログアウト問題が起きたか

ポータル（index.html）は単一ファイルSPAで、ログイン状態はJavaScriptのグローバル変数（S.token, S.user）とlocalStorageに保持される。ゲームは `target="_blank"` で新タブに開かれるため、ポータルタブはバックグラウンドで生存しJS状態は保持される。

**ビルビルタウンが壊した箇所**:

ビルビルタウンは独自の `trail-nav.js` を持ち、「他のゲームで学ぶ」ボタンを以下のように実装していた：

```javascript
// ❌ ビルビルタウンの実装（障害の原因）
function goToTGP32() {
  window.location.href = 'https://trail-game-pro-3-2.onrender.com?token=...';
}
```

これにより：
1. ゲームタブ内でindex.htmlが新規ロードされる
2. SPAの状態（S.token等）はゼロから初期化される
3. URLパラメータからのトークン復元に失敗
4. ログアウト状態で表示される

**正しい実装は `window.close()` でゲームタブを閉じ、元のポータルタブに戻すこと。**

### 1-3. なぜALT消失が起きたか

**正規のALT計算パイプライン**:

```
ゲーム終了 → POST /api/external/game-result
  → play_sessions にセッション記録
  → processSessionALT()（altEngine.js）
    → ① calculateBaseAlt() — 正答率からALT算出（最大30）
    → ② calcDiminishedAlt() — 同日逓減
    → ③ applyGameCap() — ゲーム別キャップ
    → ④ calcBonusRate() — チャレンジボーナス
  → coin_logs に最終ALTを記録
```

**ビルビルタウンが行ったこと**:

```
❌ trail-nav.js が /api/alt/add に直接POST
  → processSessionALT() を完全にバイパス
  → 逓減・キャップ・ボーナスが一切適用されない
  → play_sessions にも記録されない
```

### 1-4. 根本的な教訓

ゲーム連携の規約がなかったことが全ての原因：
1. 帰還方法の規約がなかった → `window.close()` を使うべきなのに `window.location.href` を使った
2. ALT送信先の規約がなかった → 正規APIを使うべきなのに独自APIを新設した
3. 必須パラメータの規約がなかった → 正答データを送らず固定ALTを送った
4. テスト手順の規約がなかった → ログイン維持・ALT記録のテストが行われなかった

---

## 第2章：ゲーム連携の絶対ルール

### 2-1. ゲームの種類と連携方式

**■ 方式A: 内蔵ゲーム（TrailSDK方式）** — 推奨

```
ファイル配置: public/games/ゲーム名/index.html
表示方法: ポータルSPA内のiframeまたはコンポーネント
連携: TrailSDK.endSession() でスコア送信
帰還: TrailSDK.backToPortal() でポータルに戻る
```

**■ 方式B: 外部ゲーム（API方式）**

```
表示方法: target="_blank" で新タブに開く
連携: POST /api/external/game-result でスコア送信
帰還: window.close() で自タブを閉じる
```

### 2-2. 帰還方法のルール（★最重要★）

```
✅ 許可:
  window.close()  → ゲームタブを閉じる。ポータルのJS状態は保持される

✅ 許可（フォールバック）:
  window.close() が効かない場合 → 「ポータルタブに戻ってください」メッセージ表示

❌ 絶対禁止:
  window.location.href = 'ポータルURL'  → SPAが再ロードされログアウトする
  window.location.replace('ポータルURL')  → 同上
  <a href="ポータルURL">（target="_blank"なし）  → 同上
```

**帰還処理テンプレート（全ゲーム共通・改変禁止）**:

```javascript
function backToPortal() {
  window.close();
  setTimeout(() => {
    document.body.innerHTML = `
      <div style="text-align:center; padding:60px 20px; font-family:sans-serif;
                  background:#1a1a2e; color:#fff; min-height:100vh;
                  display:flex; flex-direction:column; justify-content:center;">
        <h2 style="font-size:24px; margin-bottom:16px;">🎮 ゲーム終了！</h2>
        <p style="font-size:16px; color:#aaa;">ブラウザのタブから<br>TRAILポータルに戻ってください。</p>
      </div>
    `;
  }, 500);
}
```

### 2-3. ALT送信のルール（★最重要★）

**ALTを記録するAPIは1つだけ。独自APIの新設は禁止。**

```
✅ 正規:
  方式A → TrailSDK.endSession({ score, correctCount, totalCount, maxStreak })
  方式B → POST /api/external/game-result

❌ 禁止:
  × coin_logs への直接INSERT
  × 独自のALT記録API新設
  × processSessionALT() をバイパスするいかなる方法
```

### 2-4. 必須パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| score | Number | ✅ | ゲーム内スコア |
| correct_count | Number | ✅ | 正解した問題数 |
| total_count | Number | ✅ | 出題された総問題数 |
| max_streak | Number | 推奨 | 最大連続正解数（省略時0） |

これらが送信されないと `calculateBaseAlt(0, 0, 0, 0) = 1` となり、常に最低ALT（1）しか付与されない。

### 2-5. ポータルからゲームに渡すパラメータ

buildGameUrl() が以下をURLに付与する。ゲーム側はこれを受け取って使用する。

| パラメータ | 内容 | 用途 |
|-----------|------|------|
| token | JWT | API認証 |
| student_id | 生徒ID | スコア送信の識別子 |
| player | 生徒名 | 表示名・スコア送信 |
| class_name | クラス名 | 表示用 |
| tenant_slug | テナントスラッグ | API呼び出し |
| tenant_id | テナントID | API呼び出し |
| return_url | ポータルURL（認証情報付き） | フォールバック帰還用 |

---

## 第3章：新規ゲーム追加チェックリスト

### 開発時チェックリスト

```
□ 1. 方式を決定したか？（A: TrailSDK / B: 外部API）
□ 2. 帰還は window.close() か？（window.location.href 禁止）
□ 3. ALT送信は正規ルートか？（TrailSDK.endSession or POST /api/external/game-result）
□ 4. 独自ALT記録APIを新設していないか？
□ 5. score, correct_count, total_count を全て送信しているか？
□ 6. ポータルからの player, tenant_slug を受け取っているか？
□ 7. gamesテーブルに name, category, emoji, url, is_active=1 を登録したか？
```

### テストチェックリスト

```
□ テスト1: ゲーム完了 → 「戻る」ボタン → ポータルでログイン維持されるか
□ テスト2: ゲーム完了 → ポータルタブに切替 → ALTポップアップが出るか
□ テスト3: 同じゲーム3回連続 → 逓減が適用されるか（100%→60%→30%）
□ テスト4: パーフェクトクリア → 25〜30 ALT が付与されるか
□ テスト5: score=null で送信 → 1 ALT（最低保証）のみか
□ テスト6: F5リロード後もログイン維持されるか
□ テスト7: ゲーム別ALT上限到達 → ALT 0 表示されるか
```

---

## 第4章：外部ゲーム最小テンプレート（方式B）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>【ゲーム名】 - TRAIL</title>
</head>
<body>
  <div id="game-container"><!-- ゲーム本体 --></div>
  <div id="result-screen" style="display:none;">
    <h2>ゲーム終了！</h2>
    <p>スコア: <span id="final-score"></span></p>
    <button onclick="backToPortal()">🎮 他のゲームで遊ぶ</button>
  </div>

  <script>
    // ① パラメータ受信
    const params = new URLSearchParams(window.location.search);
    const PLAYER = params.get('player') || '';
    const SLUG = params.get('tenant_slug') || '';
    const API_BASE = window.location.origin;

    // ② ゲーム内変数
    let correctCount = 0, totalCount = 0, maxStreak = 0, currentStreak = 0, score = 0;

    // ③ 正答処理
    function onCorrectAnswer(points) {
      correctCount++; totalCount++; currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak); score += points;
    }
    function onWrongAnswer() { totalCount++; currentStreak = 0; }

    // ④ ゲーム終了 → スコア送信（★正規ルートのみ★）
    function finishGame() {
      document.getElementById('final-score').textContent = score;
      document.getElementById('game-container').style.display = 'none';
      document.getElementById('result-screen').style.display = 'block';
      fetch(API_BASE + '/api/external/game-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: PLAYER, game_id: 'GAME_SLUG', game_name: 'GAME_NAME',
          score, correct_count: correctCount, total_count: totalCount, max_streak: maxStreak
        })
      }).catch(err => console.error('ALT報告エラー:', err));
    }

    // ⑤ 帰還処理（★改変禁止★）
    function backToPortal() {
      window.close();
      setTimeout(() => {
        document.body.innerHTML = `
          <div style="text-align:center;padding:60px 20px;font-family:sans-serif;
                      background:#1a1a2e;color:#fff;min-height:100vh;
                      display:flex;flex-direction:column;justify-content:center;">
            <h2>🎮 ゲーム終了！</h2>
            <p style="color:#aaa;">ブラウザのタブから<br>TRAILポータルに戻ってください。</p>
          </div>`;
      }, 500);
    }
  </script>
</body>
</html>
```

---

## 第5章：禁止事項まとめ

| # | 禁止事項 | 理由 | 過去の事故 |
|---|---------|------|-----------|
| 1 | window.location.href でポータルに遷移 | SPA状態消失→ログアウト | ビルビルタウン |
| 2 | 独自ALT記録APIの新設 | processSessionALTバイパス | ビルビルタウンの/api/alt/add |
| 3 | coin_logsへの直接INSERT | 逓減・キャップ未適用 | ビルビルタウン |
| 4 | score/correct_count/total_count未送信 | ALTが常に1 | ビルビルタウン |
| 5 | coin_logs/students のDROP/DELETE/TRUNCATE | 学習履歴消失 | データ保護ルール |
| 6 | mainブランチへのpush/merge | デプロイ事故 | ブランチ運用ルール |

---

## 第6章：使い方

新ゲーム追加時、Claude Codeへの指示テンプレート：

```
以下のファイルを先に読め：
GAME_INTEGRATION_STANDARD.md

上記の規約に従って、新しいゲーム「○○○」をTRAILポータルに追加しろ。

方式: B（外部ゲーム）
URL: https://...
カテゴリ: 算数
ゲーム内の終了関数: gameOver()
ゲーム内のスコア変数: score, correctCount, totalCount

第3章のチェックリストを全て実行し、結果を報告しろ。
```
