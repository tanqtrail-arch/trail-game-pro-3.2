# TRAIL GP3 全ページレスポンシブ対応タスク

## 現状の問題
PC表示でコンテンツが左半分にしか表示されず、右側が白い空白になっている。
スマホ・タブレット・PCすべてで最適表示されるよう、全ページを修正する。

## 対応方針
既存のデザイン・配色・機能は一切変更しない。レイアウトとサイズの最適化のみ行う。

---

## Step 1: index.html の viewport 確認・修正

`index.html` の `<head>` 内に以下があるか確認し、なければ追加：
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

---

## Step 2: グローバルCSS（index.css）の先頭に以下を追加

既存のスタイルは残したまま、**先頭に**以下を追加する：

```css
/* ============================================
   TRAIL GP3 - Responsive Global Foundation
   ============================================ */
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  overflow-x: hidden;
  background: #0f172a;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans',
    'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
}

#root {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
}

img, video, svg {
  max-width: 100%;
  height: auto;
}
```

---

## Step 3: 各ページ/コンポーネントの修正

プロジェクト内の全ページコンポーネント（`.jsx` / `.tsx`）を走査し、以下のルールで修正する。

### 3-1. ページのルートコンテナ

全ページの最外側の `<div>` に `width: '100%'` を確実に設定する。
固定幅（例: `width: '500px'`、`maxWidth: '500px'` のみで `width: '100%'` がない）を見つけたら修正。

**修正パターン：**
```jsx
// ❌ Before
<div style={{ maxWidth: '500px', padding: '2rem' }}>

// ✅ After
<div style={{ width: '100%', maxWidth: '500px', margin: '0 auto', padding: '1rem' }}>
```

### 3-2. ログイン画面（中央配置ページ）

ログイン画面のルート要素を以下の構造にする：
```jsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  width: '100%',
  padding: '1rem',
}}>
  <div style={{
    width: '100%',
    maxWidth: '480px',
    // 既存のpadding等はそのまま
  }}>
    {/* 既存のコンテンツ */}
  </div>
</div>
```

### 3-3. ダッシュボード・一覧系ページ

コンテンツ領域を中央配置にする：
```jsx
<div style={{
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '1rem',
}}>
  {/* 既存のコンテンツ */}
</div>
```

### 3-4. ゲーム画面

```jsx
<div style={{
  width: '100%',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}}>
  <div style={{
    width: '100%',
    maxWidth: '900px',
    padding: '0.5rem',
    flex: 1,
  }}>
    {/* 既存のゲームコンテンツ */}
  </div>
</div>
```

### 3-5. フォーム要素（input, select, button）

全ての `<input>`, `<select>`, `<textarea>` に以下を確認・追加：
- `width: '100%'`
- `fontSize: '16px'` 以上（16px未満だとiOSで自動ズームが発生する）
- `boxSizing: 'border-box'`

全ての `<button>` に以下を確認：
- `minHeight: '44px'`（タップターゲット）
- `width: '100%'`（フォーム内のメインボタンの場合）

### 3-6. カード/グリッド表示

ゲーム一覧等でカードを並べている箇所があれば、CSS Gridでレスポンシブにする：
```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '1rem',
  width: '100%',
}}>
  {/* カード要素 */}
</div>
```

### 3-7. ボトムナビゲーション

ボトムナビがある場合、Safe Area対応を追加：
```jsx
<nav style={{
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  background: '#1e293b',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  zIndex: 100,
}}>
```

ボトムナビがあるページのメインコンテンツには下部余白を追加：
```jsx
paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))'
```

---

## Step 4: 確認チェックリスト

修正完了後、以下を全ページで確認：

1. `body` と `#root` に `width: 100%` がある
2. `body` の `background` が `#0f172a`（白い空白なし）
3. 各ページのルートに `width: '100%'` がある
4. コンテンツ領域に `maxWidth` + `margin: '0 auto'` で中央配置
5. `<input>`, `<select>` の `fontSize` が `16px` 以上
6. 固定px幅（`width: '500px'` 等）が残っていない
7. `overflow-x: hidden` が body に設定されている

---

## 注意事項
- 既存の配色（グラデーション含む）は変更しない
- 既存の機能・ロジックには一切手を入れない
- inline style と CSS の両方を確認する（このプロジェクトはinline styleが多い可能性あり）
- CSS ModulesやTailwindを使っている場合はそちらも対応する
- `clamp()` を使ったフォントサイズは推奨だが、既存のサイズ指定を大幅に変えない範囲で
