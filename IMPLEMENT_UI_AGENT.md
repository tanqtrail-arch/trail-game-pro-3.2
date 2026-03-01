# TRAIL GP3 ダッシュボードUI刷新 - エージェント方式

## 全体方針

**Phase 1（今回）: UIを作り込む + AIコメント表示枠を用意**
**Phase 2（後日）: AI生成エンジン + cronで毎日データを流す**

今回はPhase 1のみ。AIコメントの「箱」は作るが、中身の生成ロジックは後回し。
データがない時は「まだAIコメントはありません」と表示する。

---

## CLAUDE.mdに追記する内容

以下をCLAUDE.mdの末尾にコピペしてください。

---

```markdown
# ============================================
# ダッシュボードUI刷新タスク（エージェント方式）
# ============================================

## 実行方法
このタスクは「Task tool（サブエージェント）」で分担して実行すること。
各TaskはTask toolで独立したサブエージェントとして呼び出す。
オーケストレーターは全体を監督し、各Taskの結果を検証してから次に進む。

## プロジェクト概要
- TRAIL Game Pro 3.2: 子ども向け探究学習ゲームプラットフォーム
- バックエンド: Express.js + SQLite（server/）
- フロント: HTML + Vanilla JS + CSS（public/）
- デプロイ: Render.com（git push で自動デプロイ）
- ブランドカラー: ダークネイビー背景 + 紫→青グラデーション

## 現状の画面構成
- public/super-admin.html: スーパー管理者用（教室管理・生徒管理・ゲーム管理・データエクスポート）
- public/parent.html: 保護者用（子どものプレイ状況・AIコメント表示枠あり）
- 両方ともダークテーマ、テーブル中心のUI

## 既存API（使えるもの）
- GET /api/play-sessions/stats/tenants/compare → 教室比較データ
- GET /api/play-sessions/stats/student/:studentId → 生徒個別統計
- GET /api/play-sessions/stats/game/:gameId → ゲーム別統計
- GET /api/play-sessions → プレイセッション一覧
- GET /api/play-sessions/export/csv → CSVエクスポート
- GET /api/t/:slug/students → 生徒一覧
- GET /api/t/:slug/games → ゲーム一覧
- GET /api/t/:slug/streaks/:studentId → ストリーク情報
- GET /api/t/:slug/streaks → 全生徒ストリーク
- GET /api/t/:slug/coins → コイン情報
- GET /api/t/:slug/rankings → ランキング
- GET /api/t/:slug/analytics/dashboard → 分析ダッシュボード
- GET /api/t/:slug/analytics/gameplay → ゲームプレイ分析
- GET /api/t/:slug/student-dashboard → 生徒ダッシュボード
- GET /api/parent-dashboard → 保護者ダッシュボード（aiCommentsを含む）
- GET /api/super/tenants → 全テナント一覧
- GET /api/super/games → 全ゲーム一覧

## ai_commentsテーブル（既存）
```sql
CREATE TABLE IF NOT EXISTS ai_comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id     TEXT NOT NULL,
  student_id    INTEGER NOT NULL,
  date          TEXT NOT NULL,
  highlight     TEXT,
  comment       TEXT,
  badges        TEXT,
  home_hints    TEXT,
  generated_at  TEXT DEFAULT (datetime('now')),
  type          TEXT DEFAULT 'on_demand',
  UNIQUE(tenant_id, student_id, date)
);
```

## デザイン方針
- ダークネイビー背景（既存テーマ踏襲）
- TRAILブランド: 紫→青グラデーション
- 角丸カード（border-radius: 12px）
- テーブルは正答率セルを色分け（80%↑緑、50-80%黄、50%↓赤）
- Chart.jsをCDNから読み込んでグラフ表示
- モバイル対応（レスポンシブ）
- 既存のCSS変数・クラスがあればそれを活用
- アニメーションは控えめ（transition程度）

## ============================================
## タスク一覧（6つのサブエージェント）
## ============================================

### Task 1: 管理者ダッシュボード - レイアウト刷新 [UIアーキテクト]
ファイル: public/super-admin.html（既存を編集）

#### 目的
テーブル中心の現UIを、サイドナビ＋KPIカード＋グラフのモダンなダッシュボードに変える。

#### 変更内容

1. レイアウトをサイドナビ＋メインに変更:
```
┌──────────┬────────────────────────────┐
│ サイドナビ │  メインコンテンツ            │
│          │                            │
│ 📊 概要   │  [KPI] [KPI] [KPI] [KPI]  │
│ 👤 生徒   │                            │
│ 🎮 ゲーム │  [グラフ] [グラフ]          │
│ 🤖 AI分析 │                            │
│ 🏫 教室   │  [テーブル]                 │
│ 📥 出力   │                            │
└──────────┴────────────────────────────┘
```

2. サイドナビの実装:
- 左に固定幅(220px)のサイドバー
- 各メニュー項目クリックでメインエリアの内容が切り替わる
- アクティブ項目はハイライト（紫→青グラデ背景）
- モバイルではハンバーガーメニューで開閉

3. 概要タブ（デフォルト表示）:
- 上部にKPIカード4枚を横並び:
  - 総生徒数（/api/super/tenantsから集計）
  - 今日のアクティブ数（/api/play-sessions?today=trueから、またはanalytics/dashboardから）
  - 累計プレイ回数（/api/play-sessions/stats/tenants/compareから）
  - 全体平均正答率（同上）
- KPIカードのデザイン: ダーク背景、大きい数字(36px)、ラベル(14px)、アイコン付き、微グラデーション

4. 既存の機能（教室一覧・ゲーム一覧・教室作成・ゲーム登録）は該当タブに移動するだけ。機能自体は壊さない。

5. CSS:
- 既存のstyleタグ内に追記（外部CSSファイルは作らない）
- CSS変数で色管理:
  --bg-primary: #0a0e1a;
  --bg-card: #141828;
  --bg-card-hover: #1a2035;
  --accent-purple: #7c3aed;
  --accent-blue: #3b82f6;
  --gradient: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --success: #22c55e;
  --warning: #eab308;
  --danger: #ef4444;

#### 注意
- 既存のJavaScript関数（ログイン、テナント操作、ゲーム操作等）は壊さないこと
- 既存のfetch呼び出しはそのまま活かす
- サイドナビの切り替えはCSSクラスのtoggleで実装（フレームワーク不使用）

---

### Task 2: 管理者ダッシュボード - グラフ＋データ強化 [データビジュアライザー]
ファイル: public/super-admin.html（Task 1の結果を編集）

#### 前提: Task 1のサイドナビ＋KPIが完了していること

#### 追加内容

1. Chart.jsの読み込み:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

2. 概要タブにグラフ2つ追加（KPIカードの下）:
- 左: 日別プレイ数推移（折れ線グラフ、7日間）
  → /api/play-sessions から日付でグルーピングして集計
  → 背景グラデーション付きのラインチャート
- 右: ゲーム別人気ランキング（横棒グラフ、上位10）
  → /api/play-sessions からgame_nameでグルーピング
  → 紫→青のグラデーションバー

3. 生徒タブのテーブル強化:
- 正答率セルの色分け: 80%↑ var(--success), 50-80% var(--warning), 50%↓ var(--danger)
- 最終プレイ日カラム追加: 7日以上前なら ⚠️ アイコン付き
- 行クリックで展開: 生徒詳細パネル（プレイ履歴・ストリーク・コイン）

4. ゲームタブに追加:
- ゲームごとのミニ統計カード: プレイヤー数・平均正答率・総プレイ時間

5. Chart.jsの共通設定:
```javascript
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';
Chart.defaults.font.family = "'Noto Sans JP', sans-serif";
```

6. グラフはデータがない場合「データがありません」のプレースホルダー表示

---

### Task 3: 管理者ダッシュボード - AI分析タブ [UIエンジニア]
ファイル: public/super-admin.html（Task 2の結果を編集）

#### 目的
サイドナビの「🤖 AI分析」タブの中身を作る。
AIデータがまだない想定で、プレースホルダーUIをしっかり作る。

#### AI分析タブの構成

1. 上部: 手動実行ボタン（将来用、今は見た目だけ）
```html
<div class="ai-actions">
  <button class="btn-gradient" onclick="runMorningAI()" disabled>
    🌅 朝のAI分析を実行
  </button>
  <button class="btn-gradient" onclick="runEveningAI()" disabled>
    🌙 夜のAI分析を実行
  </button>
  <span class="ai-status">⏳ AI生成機能は準備中です</span>
</div>
```
- ボタンはdisabledだがスタイルは整える
- runMorningAI / runEveningAI 関数は空実装で定義しておく:
```javascript
async function runMorningAI() {
  // Phase 2で実装: fetch('/api/cron/morning-ai?secret=...')
  alert('AI生成機能はまもなく追加されます');
}
async function runEveningAI() {
  // Phase 2で実装: fetch('/api/cron/evening-ai?secret=...')
  alert('AI生成機能はまもなく追加されます');
}
```

2. クラスAIサマリーセクション:
```html
<div class="ai-section">
  <h3>📊 クラスAIサマリー</h3>
  <div class="ai-cards-row">
    <div class="ai-card strength">
      <h4>💪 強み</h4>
      <p class="placeholder">AIが分析すると、クラスの強みがここに表示されます</p>
    </div>
    <div class="ai-card weakness">
      <h4>⚠️ 改善ポイント</h4>
      <p class="placeholder">AIが分析すると、改善ポイントがここに表示されます</p>
    </div>
    <div class="ai-card recommendation">
      <h4>💡 おすすめアクション</h4>
      <p class="placeholder">AIが分析すると、おすすめがここに表示されます</p>
    </div>
  </div>
</div>
```
- strength: 左ボーダー4px var(--success)
- weakness: 左ボーダー4px var(--warning)
- recommendation: 左ボーダー4px var(--accent-blue)

3. アラートセクション:
```html
<div class="ai-section">
  <h3>🚨 要注意アラート</h3>
  <div id="ai-alerts-container">
    <p class="placeholder">AIが分析すると、注意が必要な生徒がここに表示されます</p>
  </div>
</div>
```
- 将来、アラートデータが入ると: 赤カード(inactive)、黄カード(struggling)、オレンジカード(streak_broken)で表示
- 表示用の関数 renderAlerts(alerts) を空データでも動くように実装:
```javascript
function renderAlerts(alerts) {
  const container = document.getElementById('ai-alerts-container');
  if (!alerts || alerts.length === 0) {
    container.innerHTML = '<p class="placeholder">要注意の生徒はいません 🎉</p>';
    return;
  }
  // alertsをカードとして描画（色分け付き）
  container.innerHTML = alerts.map(a => `
    <div class="alert-card alert-${a.type}">
      <span class="alert-name">${a.studentName}</span>
      <span class="alert-type">${a.type === 'inactive' ? '🔴 未プレイ' : a.type === 'struggling' ? '🟡 正答率低下' : '🟠 ストリーク途切れ'}</span>
      <span class="alert-detail">${a.detail}</span>
    </div>
  `).join('');
}
```

4. 成長ハイライトセクション:
- アラートと同じ構造で緑系カード
- renderGrowthHighlights(highlights) 関数を実装

5. AIコメント一覧テーブル:
```html
<div class="ai-section">
  <h3>💬 生徒別AIコメント</h3>
  <div id="ai-comments-container">
    <p class="placeholder">AIコメントが生成されると、ここに一覧表示されます</p>
  </div>
</div>
```
- 将来ai_commentsにデータが入ると: 生徒名|ハイライト|バッジ|生成日 のテーブル
- 行クリック展開でcomment全文 + home_hints
- renderAIComments(comments) 関数を実装

6. データ取得関数（将来のAPI用の枠）:
```javascript
async function loadAIData(tenantSlug) {
  // Phase 2で実装
  // const comments = await fetch(`/api/ai/comments/${tenantSlug}`).then(r => r.json());
  // const summary = await fetch(`/api/ai/class-summary/${tenantSlug}`).then(r => r.json());
  // const alerts = await fetch(`/api/ai/alerts/${tenantSlug}`).then(r => r.json());
  // const highlights = await fetch(`/api/ai/growth-highlights/${tenantSlug}`).then(r => r.json());
  
  // 今はプレースホルダー表示
  renderAlerts([]);
  renderGrowthHighlights([]);
  renderAIComments([]);
}
```

---

### Task 4: 保護者ダッシュボード - UI刷新 [UIデザイナー]
ファイル: public/parent.html（既存を編集）

#### 目的
保護者画面をよりわかりやすく、温かみのあるデザインに刷新。
AIコメント表示セクションを目立つ位置に配置。

#### 事前確認
まずparent.htmlの現在の構造を読んで理解すること。
既存の機能（ログイン、プレイ履歴表示、AIコメント表示）は壊さない。

#### 変更内容

1. ヘッダーエリア改善:
- 子どもの名前を大きく表示
- 「今日のひとこと」カード（AIコメントのhighlightを表示する枠）
- ストリーク表示（🔥連続ログイン X日）

2. 統計カード（KPI）:
- 総プレイ回数
- 総学習時間（分→時間に変換して表示）
- 平均正答率（大きい数字 + 円グラフ小）
- 獲得コイン

3. AIコメントセクション（メインエリア上部、目立つ位置）:
```html
<div class="ai-coach-section">
  <div class="ai-coach-header">
    <span class="ai-icon">🤖</span>
    <h3>TRAILコーチからのメッセージ</h3>
  </div>
  <div id="ai-comment-display">
    <!-- AIコメントがある場合 -->
    <!-- <div class="ai-comment-card">
      <div class="highlight">算数ゲームで急成長中！</div>
      <div class="comment">お子さまは今週、分数ゲームに集中的に取り組み...</div>
      <div class="badges">🏆 正答率UP 🔥 連続ログイン</div>
      <div class="home-hints">💡 ヒント: 家庭では...</div>
    </div> -->
    <!-- AIコメントがない場合 -->
    <div class="ai-comment-empty">
      <p>🤖 TRAILコーチが準備中です</p>
      <p class="sub">もうすぐ、お子さまの学習についてのコメントが届きます</p>
    </div>
  </div>
</div>
```

- 既存のai_comments表示ロジック（data.aiComments を使うコード）はそのまま活かす
- ai_commentsにデータが入れば自動的に表示される仕組みを維持
- 表示のデザインのみ改善

4. AIコメントのデザイン:
- 背景: ダーク中にわずかに明るいグラデーションカード
- highlightは大きめフォント(18px)、太字
- commentは通常フォント、行間広め
- badgesはpillスタイル（小さい角丸タグ、紫背景白文字）
- home_hintsは点線ボーダーの別セクション、💡アイコン付き

5. プレイ履歴セクション:
- 既存のテーブルをカード形式に変更
- 各プレイ: ゲーム名 + 絵文字アイコン | スコア | 正答率(色付き) | 日時
- 正答率の色分け: 80%↑緑、50-80%黄、50%↓赤

6. 月別アコーディオン（既存のAIコメント表示）:
- デザインのみ改善、ロジックは触らない
- アコーディオンのアニメーション追加（height transition）

7. フッター:
- 「保護者の方へ: AIコメントは毎朝更新されます」の説明テキスト

#### デザイン
- parent.htmlは保護者向けなので、super-admin.htmlより温かみのある色使い
- ダークベースだが、AIコメントカードは微妙に明るい背景
- Noto Sans JP フォント使用
- モバイルファースト（保護者はスマホで見る想定）

---

### Task 5: AI分析API枠の追加 [APIエンジニア]
ファイル: server/routes/aiRoutes.js（新規作成）

#### 目的
管理者ダッシュボードのAI分析タブが将来使うAPIの枠を先に作る。
データがなくても空配列・空オブジェクトを返す。

#### エンドポイント

1. GET /api/ai/comments/:tenantSlug
```javascript
router.get('/comments/:tenantSlug', async (req, res) => {
  try {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    
    const comments = db.prepare(`
      SELECT ac.*, s.name as student_name 
      FROM ai_comments ac 
      JOIN students s ON ac.student_id = s.id 
      WHERE ac.tenant_id = ? AND ac.type != 'class_summary'
      ORDER BY ac.generated_at DESC
    `).all(tenant.id);
    
    res.json(comments.map(c => ({
      ...c,
      badges: c.badges ? JSON.parse(c.badges) : []
    })));
  } catch (err) {
    console.error('[AI API]', err);
    res.json([]);
  }
});
```

2. GET /api/ai/class-summary/:tenantSlug
- ai_commentsからtype='class_summary'の最新1件取得
- commentカラムをJSONパースして返す
- データなければ { summary: null, strengths: [], weaknesses: [], recommendations: [] }

3. GET /api/ai/alerts/:tenantSlug
- ルールベースで検出（AI不要）:
  - 7日以上未プレイの生徒
  - 直近5回の平均正答率50%未満の生徒
- データなければ空配列

4. GET /api/ai/growth-highlights/:tenantSlug
- ルールベースで検出（AI不要）:
  - 直近7日のAVG正答率が前7日より15%以上UP
  - 直近7日のプレイ数が前7日の2倍以上
- データなければ空配列

#### server/index.jsへの登録
app.use('/api/ai', require('./routes/aiRoutes'));

#### 注意
- dbオブジェクトの参照方法は既存ルートファイル（例: routes/students.js）に合わせる
- better-sqlite3の場合は.prepare().all() / .get()、sqlite3の場合はcallback
- 既存コードのDB参照パターンを必ず確認してから実装すること

---

### Task 6: 総合QA + 統合テスト [テスター]

#### 確認項目

管理者ダッシュボード:
1. ログインが正常に動作する
2. サイドナビの全タブが切り替わる
3. KPIカードに数値が表示される（0でもエラーにならない）
4. グラフがレンダリングされる（データなしでもエラーにならない）
5. AI分析タブでプレースホルダーが表示される
6. 手動実行ボタンがdisabledで表示される
7. 既存機能（教室作成・ゲーム登録・一覧表示）が壊れていない
8. モバイル幅(375px)でレイアウトが崩れない

保護者ダッシュボード:
9. ログインが正常に動作する
10. KPI統計カードが表示される
11. AIコメントセクションに「準備中」が表示される（ai_commentsが空の場合）
12. プレイ履歴が表示される
13. 既存の機能が壊れていない
14. モバイル幅(375px)でレイアウトが崩れない

API:
15. GET /api/ai/comments/trail → 200（空配列でもOK）
16. GET /api/ai/class-summary/trail → 200
17. GET /api/ai/alerts/trail → 200
18. GET /api/ai/growth-highlights/trail → 200

コンソール:
19. ブラウザコンソールにエラーが出ていない
20. サーバーログにエラーが出ていない

#### 問題があれば修正して再テストすること
```

---

## Claude Codeでの実行

CLAUDE.mdを保存したら:

```bash
claude "CLAUDE.mdの「ダッシュボードUI刷新タスク」を実行して。
Task toolでサブエージェントに分担しながら、
Task 1→2→3→4→5→6の順で全タスクを完了させて。
各タスクの完了後、結果を検証してから次に進んで。
既存の機能は絶対に壊さないこと。"
```

## デプロイ

```bash
git add -A
git commit -m "feat: dashboard UI overhaul + AI analysis tab placeholder"
git push
```

---

## Phase 2（後日やること）のメモ

UIが完成したら、以下を追加するだけでAIが毎日コメントを流すようになる:

1. server/services/aiAnalysis.js - Claude API呼び出しでコメント生成
2. server/routes/cron.js - cron-job.orgが叩くエンドポイント
3. super-admin.htmlのAI分析タブのdisabledを外す
4. loadAIData()のコメントアウトを外す

→ UI側の準備は今回で完了しているので、バックエンドだけ追加すればOK。