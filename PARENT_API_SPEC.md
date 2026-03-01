# PARENT_API_SPEC - 保護者ダッシュボード強化 事前調査結果

> 調査日: 2026-03-02
> 対象: TRAIL Game Pro 3.2

---

## 1. テーブルスキーマ一覧

### 1-1. play_sessions（学習ログ ★メインテーブル）

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | INTEGER | NOT NULL | FK → tenants(id)。**注意: INTEGERで定義されているが、tenants.idはTEXT型**（UUIDv4）。SQLiteの型親和性で動作するが要注意 |
| student_id | INTEGER | NOT NULL | FK → students(id) |
| game_id | INTEGER | NOT NULL | FK → games(id) |
| started_at | TEXT | `datetime('now')` | ISO 8601 形式 |
| ended_at | TEXT | NULL | ゲーム終了時に設定。NULLの場合は進行中 |
| duration_seconds | INTEGER | NULL | `PATCH /:id/end` で計算して記録（julianday差 × 86400） |
| score | INTEGER | NULL | |
| correct_count | INTEGER | NULL | 正答数 |
| total_count | INTEGER | NULL | 問題数 |
| metadata | TEXT | NULL | JSON文字列 |
| alt_awarded | INTEGER | DEFAULT 0 | ALTER TABLEで後追加 |
| alt_amount | INTEGER | DEFAULT 0 | ALTER TABLEで後追加 |

**インデックス**: `idx_ps_student`, `idx_ps_game`, `idx_ps_tenant`, `idx_ps_started`

### 1-2. students

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | FK → tenants(id) |
| name | TEXT | NOT NULL | |
| class_id | INTEGER | NOT NULL | FK → classes(id) |
| created_at | TEXT | `datetime('now')` | |
| pin | TEXT | NULL | ALTER TABLE で後追加。デフォルト '0000' |

**UNIQUE**: `(tenant_id, name, class_id)`

### 1-3. coin_logs（ALTログ ※テーブル名に注意: coins ではなく coin_logs）

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | FK → tenants(id) |
| student_id | INTEGER | NOT NULL | FK → students(id) |
| game_id | INTEGER | NULL | FK → games(id) ON DELETE SET NULL |
| amount | INTEGER | NOT NULL | |
| note | TEXT | NULL | |
| awarded_by | TEXT | NULL | |
| created_at | TEXT | `datetime('now')` | |

### 1-4. streaks

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| student_id | INTEGER | NOT NULL | FK → students(id) ON DELETE CASCADE |
| tenant_id | TEXT | NOT NULL | FK → tenants(id) ON DELETE CASCADE |
| current_streak | INTEGER | DEFAULT 0 | |
| max_streak | INTEGER | DEFAULT 0 | |
| last_play_date | TEXT | NULL | YYYY-MM-DD形式 |
| updated_at | TEXT | `datetime('now')` | |

**UNIQUE**: `(student_id, tenant_id)`

### 1-5. ai_comments

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | FK → tenants(id) |
| student_id | INTEGER | NOT NULL | FK → students(id) |
| date | TEXT | NOT NULL | YYYY-MM-DD形式 |
| highlight | TEXT | NULL | ハイライト文 |
| comment | TEXT | NULL | コメント本文 |
| badges | TEXT | NULL | カンマ区切りのバッジ名 |
| home_hints | TEXT | NULL | 家庭向けヒント |
| generated_at | TEXT | `datetime('now')` | |
| type | TEXT | DEFAULT 'on_demand' | ALTER TABLE追加。'morning' / 'evening' / 'on_demand' |

**UNIQUE**: `(tenant_id, student_id, date)` ※typeを含まない元のUNIQUE制約が残っているため、同日に複数type登録時は注意

### 1-6. games

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | FK → tenants(id) |
| name | TEXT | NOT NULL | |
| emoji | TEXT | DEFAULT '🎮' | |
| url | TEXT | NULL | 外部ゲームURL |
| category | TEXT | DEFAULT 'その他' | 算数, 国語, 理科, 地理, 歴史, その他 |
| is_active | INTEGER | DEFAULT 1 | |
| created_at | TEXT | `datetime('now')` | |
| updated_at | TEXT | `datetime('now')` | |
| is_course_game | INTEGER | DEFAULT 0 | migrateV2追加 |
| subject | TEXT | DEFAULT NULL | migrateV2追加。算数, 国語, 理科, 社会 |

### 1-7. teacher_comments

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | |
| student_id | INTEGER | NOT NULL | |
| comment | TEXT | NOT NULL | |
| month | TEXT | NOT NULL | YYYY-MM形式 |
| created_at | TEXT | `datetime('now')` | |

### 1-8. parent_tokens

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | |
| student_id | INTEGER | NOT NULL | |
| token | TEXT | NOT NULL UNIQUE | UUIDv4 |
| created_at | TEXT | `datetime('now')` | |
| expires_at | TEXT | NULL | 未使用 |
| pin | TEXT | NULL | ALTER TABLE追加。デフォルト '0000' |

**UNIQUE INDEX**: `idx_parent_tokens_tenant_student ON (tenant_id, student_id)`

### 1-9. game_play_logs（旧来のプレイログ ★注意）

| カラム名 | 型 | デフォルト | 備考 |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| tenant_id | TEXT | NOT NULL | |
| student_id | INTEGER | NOT NULL | |
| game_id | INTEGER | NOT NULL | |
| duration_seconds | INTEGER | DEFAULT 0 | |
| played_at | TEXT | `datetime('now')` | |

**重要**: parent.js の `/api/parent-dashboard` は多くの統計を **game_play_logs** テーブルから取得している。play_sessions ではない。

---

## 2. 日付・正答率・時間のカラム名

### 日付カラム
| テーブル | カラム名 | 形式 |
|---|---|---|
| play_sessions | `started_at` | ISO 8601 (`datetime('now')`) |
| play_sessions | `ended_at` | ISO 8601 or NULL |
| game_play_logs | `played_at` | ISO 8601 |
| coin_logs | `created_at` | ISO 8601 |
| ai_comments | `date` | YYYY-MM-DD（**datetime形式ではない**） |
| streaks | `last_play_date` | YYYY-MM-DD |

### 正答率
- **play_sessions テーブルに `accuracy` カラムは存在しない**
- 正答率は **計算式で毎回算出**: `ROUND(correct_count * 100.0 / total_count, 1)`
- SELECTでのエイリアス名: `accuracy_pct`（playSessions.jsのGET `/`とCSVエクスポートで使用）
- PATCH `/:id/end` のレスポンスでは `accuracy` という名前で返す（整数、`Math.round(correct_count * 100 / total_count)`）

### 時間カラム
- play_sessions: `duration_seconds`（INTEGER）
- game_play_logs: `duration_seconds`（INTEGER）
- 分換算は `Math.round(duration_seconds / 60)` でJS側で行う

---

## 3. ゲーム名の取得方法

play_sessions テーブルには `game_id`（INTEGER FK）のみ。ゲーム名は **games テーブルとJOIN** して取得:

```sql
JOIN games g ON ps.game_id = g.id
-- g.name AS game_name
-- g.emoji AS game_emoji
```

---

## 4. 保護者認証の仕組み

### 4-1. 認証ミドルウェア

**parent.js 内で定義された `requireParent` 関数**（exportされていないローカル関数）:

```javascript
function requireParent(req, res, next) {
  const auth = req.headers.authorization;
  // 'Bearer <JWT>' 形式を要求
  const decoded = verifyToken(auth.slice(7));
  if (decoded.role !== 'parent') → 403
  req.user = decoded;
  req.tenantId = decoded.tenantId;
  next();
}
```

### 4-2. JWT ペイロード（保護者ログイン成功時に生成）

```javascript
{
  parentOf: student.id,      // ★ student_id はここ
  tenantId: tenant.id,       // ★ tenant_id はここ
  token_id: ptRow.id,        // parent_tokens.id
  studentName: student.name,
  className: className.name,
  role: 'parent',            // ★ ロール判定用
}
```

有効期限: **30日** (`'30d'`)

### 4-3. 認証ヘッダー形式

```
Authorization: Bearer <JWT文字列>
```

### 4-4. API エンドポイント一覧

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/api/auth/parent-tokens` | requireAdmin | トークン＋PIN発行（管理者用） |
| POST | `/api/auth/parent-login` | なし | 保護者PINログイン |
| GET | `/api/parent/dashboard` | requireParent | 簡易ダッシュボード |
| GET | `/api/parent-verify` | クエリtoken | UUIDトークン検証 |
| GET | `/api/parent-dashboard` | Bearer JWT or クエリtoken | **完全版ダッシュボード** ★メインAPI |
| POST | `/api/parent-change-pin` | requireParent | PIN変更 |

### 4-5. ルート登録の仕組み（server/index.js）

```javascript
const parentRoutes = require('./routes/parent');
app.use('/api/auth', parentRoutes);    // → /api/auth/parent-tokens, /api/auth/parent-login
app.use('/api/parent', parentRoutes);  // → /api/parent/dashboard
app.use('/api', parentRoutes);         // → /api/parent-verify, /api/parent-dashboard, /api/parent-change-pin
```

**注意**: parentRoutes は3回マウントされている。新ルートを追加する場合、どのプレフィックスで使われるか意識すること。

---

## 5. `/api/parent-dashboard` レスポンス構造

```typescript
{
  student: { id: number, name: string, className: string },
  tenant: { id: string, name: string, slug: string },
  stats: {
    today: { alt: number, plays: number, minutes: number },
    week:  { alt: number, plays: number, minutes: number },
    total: { alt: number, plays: number, minutes: number },
  },
  rank: { position: number, total: number, label: string, name: string },
  teacherComments: Array<{ comment: string, month: string, created_at: string }>,
  aiComments: Array<{ comment: string, month: string, generated_at: string }>,
  calendar: Array<{ date: string, plays: number, alt: number }>,
  categoryStats: Array<{ category: string, plays: number, correct: number, total: number }>,
  rankHistory: Array<{ month: string, position: number }>,
  bestScores: Array<{
    game_id: number, game_name: string, game_emoji: string,
    score: number, score_label: string
  }>,
  recentPlays: Array<{
    game_name: string, game_emoji: string, alt: number, date: string
  }>,
  attendance: { thisMonth: number, lastMonth: number, total: number },
  nextGoal: null,
}
```

---

## 6. parent.html フロントエンド情報

### 6-1. 利用可能なJS変数（IIFE内スコープ）

| 変数名 | スコープ | 内容 |
|---|---|---|
| `token` | IIFE内 `let` | URLクエリの `?token=xxx`。JWT文字列 or UUIDトークン |
| `isJwt` | IIFE内 `const` | `token.startsWith('eyJ')` で判定 |
| `params` | IIFE内 `const` | `new URLSearchParams(location.search)` |
| `app` | IIFE内 `const` | `document.getElementById('app')` |

**注意**: 全てのコードが即時実行関数 `(function(){ ... })()` の中にあり、グローバルにアクセスできる変数は**ない**。

### 6-2. fetch呼び出しパターン

#### JWT認証付きfetch（メインパターン）
```javascript
fetch('/api/parent-dashboard', {
  headers: { 'Authorization': 'Bearer ' + token }
})
```

#### UUIDトークンfetch
```javascript
fetch('/api/parent-verify?token=' + encodeURIComponent(token))
fetch('/api/parent-dashboard?token=' + encodeURIComponent(token))
```

#### POST（PIN変更）
```javascript
fetch('/api/parent-change-pin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
})
```

### 6-3. CSS変数一覧

```css
--bg:#faf7f2;
--bg-card:#ffffff;
--bg-card-alt:#fef9ef;
--sage:#7a9e7e;          /* メインカラー（緑系） */
--sage-light:#e8f0e9;
--sage-dark:#5a7e5e;
--gold:#c8a04a;          /* アクセントカラー（金系） */
--gold-light:#fdf3d7;
--gold-dark:#a07828;
--cream:#f5eed6;
--cream-dark:#e8ddb8;
--brown:#6b5443;
--brown-light:#8b7463;
--text:#3d3428;
--text-dim:#8a7e6d;
--text-light:#b0a594;
--accent:#d4896a;        /* アクセント（オレンジ系） */
--accent-light:#fbe8df;
--border:rgba(107,84,67,0.1);
--shadow:0 2px 12px rgba(107,84,67,0.08);
--radius:14px;
```

### 6-4. セクション構造（HTML挿入位置マップ）

renderDashboard 内の描画順序:

| 番号 | セクション | class/id | 挿入ポイント |
|---|---|---|---|
| 1 | ヘッダー | `.header` | 最上部 |
| 2 | 生徒カード | `.student-card` | |
| 3 | 統計タブ | `#statsTabs`, `#statsGrid` | |
| 4 | 今月の成績 | `.monthly-grid`, `.rank-card` | |
| 5 | TRAILコーチ（AI） | `.ai-coach-section` | |
| 6 | 先生コメント | `.card > .accordion` | |
| 7 | AIコメント履歴 | `.card > .accordion` | |
| 8 | 学習カレンダー | `.card > .calendar-grid` | **★ カレンダー挿入位置** |
| 9 | カテゴリ別成績 | `.card > .category-item` | |
| 10 | ランキング推移 | `.card > .rank-graph` | |
| 11 | ベストスコア | `.card > .score-cards` | |
| 12 | 次の目標 | `.goal-card` | **★ ゴール挿入位置** |
| 13 | PIN変更ボタン | `#pinChangeBtn` | |
| 14 | 最近のゲーム履歴 | `.card > .play-item` | |
| 15 | フッター | `.parent-footer` | 最下部 |

---

## 7. 注意事項・罠まとめ

### 7-1. テーブルの二重構造問題（最重要）
- **`play_sessions`** と **`game_play_logs`** という2つの類似テーブルが共存
- `parent.js` の `/api/parent-dashboard` は stats（今日/今週/累計のプレイ数・時間）を **`game_play_logs`** から取得
- 一方、`categoryStats` は **`play_sessions`** から取得
- 新機能追加時、どちらのテーブルを参照するか明確にする必要がある
- `play_sessions` の方が詳細（correct_count, total_count, score 等がある）

### 7-2. tenant_id の型不整合
- `tenants.id` は **TEXT**（UUIDv4）
- `play_sessions.tenant_id` は **INTEGER** で定義（CREATE TABLE文）
- SQLiteの型親和性により動作しているが、比較時に型が一致しない可能性がある
- 他のテーブル（students, coin_logs, streaks等）は正しく TEXT で定義

### 7-3. 正答率カラムが存在しない
- `play_sessions` に `accuracy` や `accuracy_pct` カラムは**ない**
- 毎回 `correct_count * 100.0 / total_count` で計算する必要がある
- `PATCH /end` レスポンスでは `accuracy`（整数）、SELECTでは `accuracy_pct`（小数1桁）と名前が異なる

### 7-4. recentPlays に正答率がない
- `/api/parent-dashboard` の `recentPlays` は **`game_play_logs`** テーブルから取得
- `game_play_logs` には `correct_count` / `total_count` が**ない**
- そのためフロントの recentPlays 表示に正答率を含めたい場合、`play_sessions` から別途取得するか API を拡張する必要がある

### 7-5. parentRoutes の多重マウント
- `server/index.js` で parentRoutes は3回マウントされている：
  - `app.use('/api/auth', parentRoutes)`
  - `app.use('/api/parent', parentRoutes)`
  - `app.use('/api', parentRoutes)`
- 新しいルートを追加すると3つのプレフィックスすべてで到達可能になる

### 7-6. フロントエンドはIIFE内
- `parent.html` の全JSコードは即時実行関数の中にある
- 外部から変数にアクセスするには、IIFEの中に新コードを追加するか、`window` にエクスポートする必要がある
- `token` 変数は IIFE スコープ内の `let` 宣言

### 7-7. カレンダーデータの制限
- 現在の `calendar` データは `game_play_logs` からの今月分のみ
- `play_sessions.started_at` ベースのデータは含まれていない

### 7-8. streak データがダッシュボードに未統合
- `/api/parent-dashboard` は `streaks` テーブルを直接参照していない
- フロントの生徒カード内に `data.streak` の表示コードがあるが、APIが `streak` フィールドを返していない
- ストリーク情報を表示するには API 側の拡張が必要

---

## 8. 既存APIルート登録パターン

新しいルートを追加する場合の推奨パターン:

```javascript
// server/routes/parent.js に追加する場合:
router.get('/parent-xxx', requireParent, (req, res) => {
  const { parentOf, tenantId } = req.user;
  // parentOf = student_id
  // tenantId = tenant.id (TEXT UUID)
  // ...
});

// → /api/parent-xxx で到達可能（app.use('/api', parentRoutes) 経由）
// → /api/auth/parent-xxx でも到達可能
// → /api/parent/parent-xxx でも到達可能（パスが冗長）
```

**ベストプラクティス**: `parent-` プレフィックスをルート名に付ける（多重マウントでも意味が通るように）。

---

## 9. play_sessions API（参考: `/api/play-sessions`）

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/play-sessions/start` | セッション開始 |
| PATCH | `/api/play-sessions/:id/end` | セッション終了（ALT付与） |
| GET | `/api/play-sessions` | セッション一覧（フィルタ対応） |
| GET | `/api/play-sessions/stats/student/:studentId` | 生徒別集計 |
| GET | `/api/play-sessions/stats/game/:gameId` | ゲーム別集計 |
| GET | `/api/play-sessions/stats/tenants/compare` | テナント間比較 |
| GET | `/api/play-sessions/export/csv` | CSVエクスポート |

**`/stats/student/:studentId` のレスポンス**（保護者ダッシュボード拡張に有用）:
```typescript
{
  overview: {
    total_plays: number,
    total_seconds: number,
    avg_seconds_per_play: number,
    avg_accuracy: number,    // 平均正答率（小数1桁）
    best_score: number,
    total_alt: number,
  },
  byGame: Array<{
    game_id: number, game_name: string, emoji: string,
    play_count: number, total_seconds: number,
    avg_accuracy: number, best_score: number, total_alt: number,
  }>,
  daily: Array<{
    date: string, play_count: number,
    total_seconds: number, avg_accuracy: number, total_alt: number,
  }>,
}
```
