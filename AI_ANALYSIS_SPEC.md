# AI分析・AIコメント関連コード仕様書

## 調査日: 2026-03-01

---

## 1. AIコメント生成のAPIエンドポイント

### 結論: **AI生成API（エンドポイント）は未実装**

現在のコードベースには、Claude API / OpenAI / Gemini 等の外部AI APIを呼び出してコメントを生成するエンドポイントは**存在しない**。

`@anthropic-ai/sdk` が `node_modules` にインストールされているが、`server/` 配下のどのルートファイルにも `require('@anthropic-ai/sdk')` や `import` は存在せず、`ANTHROPIC_API_KEY` 等の環境変数参照もない。

### 既存のAIコメント関連エンドポイント（読み取りのみ）

| メソッド | URL | ファイル | 説明 |
|---------|-----|---------|------|
| GET | `/api/parent-dashboard` | `server/routes/parent.js:219` | 保護者ダッシュボード（aiCommentsを含む） |
| GET | `/api/parent/dashboard` | `server/routes/parent.js:123` | 保護者ダッシュボード（認証付き） |

これらはいずれも `ai_comments` テーブルから**読み取るのみ**で、AI生成処理は含まない。

---

## 2. Claude APIに送っているプロンプト内容

### 結論: **プロンプトは存在しない**

サーバーコード全体を `Anthropic`, `claude`, `sonnet`, `messages.create`, `prompt` で検索したが、AI APIへのリクエストコードは一切見つからなかった。

`ai_comments` テーブルにデータを `INSERT` している箇所も見つからないため、現時点ではAIコメントを書き込む手段自体が未実装。

---

## 3. 生成結果の保存先（DBテーブル/カラム）

### テーブル: `ai_comments`

定義場所: `server/index.js:221-235`

```sql
CREATE TABLE IF NOT EXISTS ai_comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id     TEXT NOT NULL,
  student_id    INTEGER NOT NULL,
  date          TEXT NOT NULL,
  highlight     TEXT,          -- ハイライト（要約/見出し）
  comment       TEXT,          -- AIが生成したコメント本文
  badges        TEXT,          -- バッジ情報（JSON等）
  home_hints    TEXT,          -- 家庭向けヒント
  generated_at  TEXT DEFAULT (datetime('now')),
  type          TEXT DEFAULT 'on_demand',  -- 朝/夜/手動を区別
  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  UNIQUE(tenant_id, student_id, date)
);
```

### インデックス

| インデックス名 | カラム | 定義場所 |
|---------------|--------|---------|
| `idx_ai_type` | `(tenant_id, student_id, date, type)` | `server/index.js:243-244` |
| `idx_ai_student_date` | `(student_id, date)` | `server/index.js:251` |

### typeカラムの想定値

`server/index.js:236-238` のコメントから:
- `'on_demand'` (デフォルト) - 手動リクエスト
- 朝・夜の定期生成用の値も想定（未実装）

---

## 4. フロントからの呼び出し箇所

### 保護者ダッシュボード HTML

**ファイル: `public/parent.html:441-468`**

```javascript
// ⑤ AIからのコメント
if (data.aiComments && data.aiComments.length > 0) {
  const grouped = groupByMonth(data.aiComments, 'month');
  // アコーディオンUIで月別表示
}
```

- `/api/parent-dashboard` のレスポンスに含まれる `aiComments` 配列を受け取り表示
- `groupByMonth()` で月別にグルーピング
- 各コメントは `accordion-content` として描画、`AI` バッジ付き
- データがない場合は「まだAIコメントはありません」を表示

### データフロー

```
[未実装] AI生成処理 → INSERT ai_comments
                           ↓
GET /api/parent-dashboard → SELECT FROM ai_comments → res.json({ aiComments })
                           ↓
public/parent.html → data.aiComments → アコーディオンUI描画
```

---

## 5. 全APIルート一覧

### 認証 (`/api/auth`)
| メソッド | パス | ファイル |
|---------|------|---------|
| POST | `/api/auth/register` | `auth.js:17` |
| POST | `/api/auth/admin/login` | `auth.js:58` |
| POST | `/api/auth/student/login` | `auth.js:99` |

### 保護者 (`/api/parent`, `/api/auth`)
| メソッド | パス | ファイル |
|---------|------|---------|
| POST | `/api/auth/parent-tokens` | `parent.js:24` |
| POST | `/api/auth/parent-login` | `parent.js:55` |
| GET | `/api/parent/dashboard` | `parent.js:123` |
| GET | `/api/parent-verify` | `parent.js:192` |
| GET | `/api/parent-dashboard` | `parent.js:219` |
| POST | `/api/parent-change-pin` | `parent.js:497` |

### テナント (`/api/t/:tenantSlug`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/info` | `tenants.js:11` |
| PUT | `/:tenantSlug/settings` | `tenants.js:18` |
| GET | `/plans` | `tenants.js:32` |

### 生徒 (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/students` | `students.js:11` |
| POST | `/:tenantSlug/students` | `students.js:28` |
| DELETE | `/:tenantSlug/students/:id` | `students.js:56` |

### クラス (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/classes` | `classes.js:11` |
| POST | `/:tenantSlug/classes` | `classes.js:20` |
| DELETE | `/:tenantSlug/classes/:id` | `classes.js:40` |

### ゲーム (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/games` | `games.js:11` |
| POST | `/:tenantSlug/games` | `games.js:20` |
| PUT | `/:tenantSlug/games/:id` | `games.js:45` |
| DELETE | `/:tenantSlug/games/:id` | `games.js:63` |

### コイン (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/coins` | `coins.js:11` |
| POST | `/:tenantSlug/coins` | `coins.js:44` |

### バッジ (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/badges` | `badges.js:11` |
| POST | `/:tenantSlug/badges` | `badges.js:30` |

### ランキング (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/rankings` | `rankings.js:11` |
| POST | `/:tenantSlug/rankings` | `rankings.js:59` |
| DELETE | `/:tenantSlug/rankings/:id` | `rankings.js:77` |

### 分析 (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/analytics/dashboard` | `analytics.js:11` |
| GET | `/:tenantSlug/analytics/logins` | `analytics.js:63` |
| GET | `/:tenantSlug/analytics/gameplay` | `analytics.js:81` |
| POST | `/:tenantSlug/analytics/gameplay` | `analytics.js:114` |
| POST | `/:tenantSlug/analytics/logout` | `analytics.js:127` |

### プレイセッション (`/api/play-sessions`)
| メソッド | パス | ファイル |
|---------|------|---------|
| POST | `/start` | `playSessions.js:21` |
| PATCH | `/:id/end` | `playSessions.js:57` |
| GET | `/` | `playSessions.js:202` |
| GET | `/stats/student/:studentId` | `playSessions.js:256` |
| GET | `/stats/game/:gameId` | `playSessions.js:327` |
| GET | `/stats/tenants/compare` | `playSessions.js:380` |
| GET | `/export/csv` | `playSessions.js:415` |

### ゲームセーブ (`/api/game-saves`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:studentId/:gameId` | `gameSaves.js:25` |
| PUT | `/:studentId/:gameId` | `gameSaves.js:60` |
| DELETE | `/:studentId/:gameId` | `gameSaves.js:108` |

### 問題 (`/api/questions`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/` | `questions.js:27` |
| GET | `/:id` | `questions.js:80` |
| POST | `/` | `questions.js:95` |
| PUT | `/:id` | `questions.js:141` |
| DELETE | `/:id` | `questions.js:201` |
| POST | `/bulk` | `questions.js:224` |

### ストリーク (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/streaks/:studentId` | `streaks.js:22` |
| GET | `/:tenantSlug/streaks` | `streaks.js:109` |

### 生徒ダッシュボード (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/student-dashboard` | `studentDashboard.js:95` |

### コース (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/courses` | `courses.js:17` |
| GET | `/:tenantSlug/courses/:courseId` | `courses.js:80` |
| POST | `/:tenantSlug/courses/:courseId/like` | `courses.js:148` |
| PATCH | `/:tenantSlug/courses/:courseId` | `courses.js:184` |

### 教科レベル (`/api/t`)
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/:tenantSlug/subject-levels` | `subjectLevels.js:18` |

### 外部連携 (`/api/external`)
| メソッド | パス | ファイル |
|---------|------|---------|
| POST | `/game-result` | `external.js:17` |

### スーパー管理者
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/api/super/tenants` | `superAdmin.js:25` |
| PATCH | `/api/super/tenants/:id` | `superAdmin.js:42` |
| DELETE | `/api/super/tenants/:id` | `superAdmin.js:50` |
| POST | `/api/super/tenants` | `superAdmin.js:56` |
| POST | `/api/super/games/broadcast` | `superAdmin.js:68` |
| GET | `/api/super/games` | `superAdmin.js:81` |
| PATCH | `/api/super/games/:id` | `superAdmin.js:90` |
| DELETE | `/api/super/games/:id` | `superAdmin.js:98` |

### その他
| メソッド | パス | ファイル |
|---------|------|---------|
| GET | `/api/health` | `index.js:95` |
| GET | `/api/plans` | → `tenants.js` |

---

## 6. 実装状況サマリ

| コンポーネント | 状態 | 詳細 |
|--------------|------|------|
| DBテーブル `ai_comments` | 完了 | スキーマ・インデックス定義済み |
| AIコメント読み取りAPI | 完了 | `parent-dashboard` でSELECT |
| フロントUI表示 | 完了 | `parent.html` でアコーディオン表示 |
| AI生成エンドポイント | **未実装** | Claude API呼び出しコードなし |
| AI生成用プロンプト | **未実装** | プロンプト定義なし |
| AIコメントINSERT処理 | **未実装** | `ai_comments` へのINSERTコードなし |
| 定期生成（cron等） | **未実装** | スケジューラーなし |
| `@anthropic-ai/sdk` | インストール済み | `node_modules` に存在するが未使用 |
| `ANTHROPIC_API_KEY` | **未設定** | `.env` / `process.env` に参照なし |
