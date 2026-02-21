/**
 * TRAIL Game Pro SaaS - Main Server
 * マルチテナント教育ゲームポータル
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ Security Middleware ═══
app.use(helmet({
  contentSecurityPolicy: false, // フロントエンドのinline scriptsを許可
}));
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ═══ Rate Limiting ═══
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらくしてからお試しください' },
});
app.use('/api/', limiter);

// ═══ Static Files ═══
app.use(express.static(path.join(__dirname, '../public')));

// ═══ API Routes ═══
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const coinRoutes = require('./routes/coins');
const badgeRoutes = require('./routes/badges');
const rankingRoutes = require('./routes/rankings');
const analyticsRoutes = require('./routes/analytics');
const tenantRoutes = require('./routes/tenants');
const externalRoutes = require('./routes/external'); // ← 追加
const playSessionsRoutes = require('./routes/playSessions');
const parentRoutes = require('./routes/parent');       // ★ NEW: 保護者ダッシュボード
app.use('/api/auth', authRoutes);
app.use('/api/t', gameRoutes);
app.use('/api/t', studentRoutes);
app.use('/api/t', classRoutes);
app.use('/api/t', coinRoutes);
app.use('/api/t', badgeRoutes);
app.use('/api/t', rankingRoutes);
app.use('/api/t', analyticsRoutes);
app.use('/api/t', tenantRoutes);
app.use('/api/external', externalRoutes); // ← 追加
app.get('/api/plans', tenantRoutes);
const superAdminRoutes = require('./routes/superAdmin');
app.use('/', superAdminRoutes);
app.use('/api/play-sessions', playSessionsRoutes);
app.use('/api', parentRoutes);                         // ★ NEW: 保護者ダッシュボード

// ═══ Health Check ═══
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '4.0.0', timestamp: new Date().toISOString() });
});

// ═══ SPA Fallback ═══
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══ Error Handler ═══
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// ═══ Auto-migrate & seed on startup ═══
(function bootstrap() {
  const db = require('./db');
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');

  // Run migrations (CREATE IF NOT EXISTS = safe to re-run)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, plan TEXT NOT NULL DEFAULT 'free', max_students INTEGER NOT NULL DEFAULT 30, max_games INTEGER NOT NULL DEFAULT 20, max_classes INTEGER NOT NULL DEFAULT 6, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'teacher', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_admin_users_tenant ON admin_users(tenant_id);
    CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(tenant_id, name));
    CREATE INDEX IF NOT EXISTS idx_classes_tenant ON classes(tenant_id);
    CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(tenant_id, name, class_id));
    CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🎮', url TEXT, category TEXT NOT NULL DEFAULT 'その他', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_games_tenant ON games(tenant_id);
    CREATE TABLE IF NOT EXISTS coin_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, game_id INTEGER REFERENCES games(id) ON DELETE SET NULL, amount INTEGER NOT NULL, note TEXT, awarded_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_coin_logs_tenant ON coin_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_coin_logs_student ON coin_logs(student_id);
    CREATE TABLE IF NOT EXISTS badges (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, reason TEXT, awarded_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_badges_tenant ON badges(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_badges_student ON badges(student_id);
    CREATE TABLE IF NOT EXISTS rankings (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, score REAL NOT NULL, score_label TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_rankings_tenant ON rankings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_rankings_game ON rankings(game_id);
    CREATE TABLE IF NOT EXISTS login_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, login_at TEXT NOT NULL DEFAULT (datetime('now')), logout_at TEXT, duration_seconds INTEGER);
    CREATE INDEX IF NOT EXISTS idx_login_logs_tenant ON login_logs(tenant_id);
    CREATE TABLE IF NOT EXISTS game_play_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE, duration_seconds INTEGER NOT NULL DEFAULT 0, played_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_game_play_logs_tenant ON game_play_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_game_play_logs_student ON game_play_logs(student_id);
    CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, type TEXT NOT NULL, actor TEXT, detail TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
    `);
    // ============================
// play_sessions テーブル（学習ログ）
// ============================
db.exec(`
  CREATE TABLE IF NOT EXISTS play_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_seconds INTEGER,
    score INTEGER,
    correct_count INTEGER,
    total_count INTEGER,
    metadata TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
  )
`);

// パフォーマンス用インデックス
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ps_student ON play_sessions(student_id);
  CREATE INDEX IF NOT EXISTS idx_ps_game ON play_sessions(game_id);
  CREATE INDEX IF NOT EXISTS idx_ps_tenant ON play_sessions(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_ps_started ON play_sessions(started_at);
`);

// ★ NEW ============================
// 保護者ダッシュボード用テーブル
// ==================================

// 保護者閲覧トークン
db.exec(`
  CREATE TABLE IF NOT EXISTS parent_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    student_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  )
`);

// 先生からのコメント
db.exec(`
  CREATE TABLE IF NOT EXISTS teacher_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    student_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    month TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  )
`);

// AI生成コメントのキャッシュ（1日1回）
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    highlight TEXT,
    comment TEXT,
    badges TEXT,
    home_hints TEXT,
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    UNIQUE(tenant_id, student_id, date)
  )
// F4: type カラム追加（朝/夜/手動を区別）
try {
  db.exec(`ALTER TABLE ai_comments ADD COLUMN type TEXT DEFAULT 'on_demand'`);
} catch (e) { /* 既に存在する場合は無視 */ }

// F4: UNIQUE制約を date+type の組み合わせに対応するインデックスを追加
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ai_type
  ON ai_comments(tenant_id, student_id, date, type)
`););

// 保護者ダッシュボード用インデックス
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pt_token ON parent_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_pt_student ON parent_tokens(student_id);
  CREATE INDEX IF NOT EXISTS idx_tc_student ON teacher_comments(student_id, month);
  CREATE INDEX IF NOT EXISTS idx_ai_student_date ON ai_comments(student_id, date);
`);
// ★ END NEW ========================

  console.log('  Migrations: OK');

  // Seed demo tenant if no tenants exist
  const count = db.prepare('SELECT COUNT(*) as c FROM tenants').get().c;
  if (count === 0) {
    const tenantId = uuidv4();
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@trail-game.com';
    const adminPass = process.env.SUPER_ADMIN_PASSWORD || 'trail2024';
    const adminHash = bcrypt.hashSync(adminPass, 12);

    db.transaction(() => {
      db.prepare("INSERT INTO tenants (id, name, slug, plan, max_students, max_games, max_classes) VALUES (?, ?, ?, ?, ?, ?, ?)").run(tenantId, 'デモ教室', 'demo', 'pro', 100, 50, 10);
      db.prepare("INSERT INTO admin_users (id, tenant_id, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?, ?)").run(uuidv4(), tenantId, adminEmail, adminHash, '管理者', 'owner');
      const insertClass = db.prepare('INSERT INTO classes (tenant_id, name) VALUES (?, ?)');
      ['探究キッズ','探究スターター','探究ベーシック','探究アドバンス','探究リミットレス','探究個別'].forEach(c => insertClass.run(tenantId, c));
      const insertGame = db.prepare('INSERT INTO games (tenant_id, name, emoji, category) VALUES (?, ?, ?, ?)');
      [['分数融合','🧬','算数'],['分数ガンマン','🔫','算数'],['どっちがおおきい','⚖️','算数'],['約分工房','🔧','算数'],['分数テトリス','🧱','算数'],['暗算パネル','🧠','算数'],['特産品マッチング','🍎','地理'],['都道府県シルエットクイズ','🗾','地理'],['気候バトルカード','🌦️','理科'],['絵画クイズ','🎨','その他'],['元素クエスト','⚗️','理科'],['迷路アタック','🏃','その他'],['お土産暗算','🛍️','算数'],['江戸時代迷路クイズ','🏯','歴史'],['文明ビルダー','🏛️','歴史']].forEach(g => insertGame.run(tenantId, g[0], g[1], g[2]));
    })();
    console.log(`  Seed: demo tenant created (slug: demo, email: ${adminEmail}, pass: ${adminPass})`);
  }
})();

// ═══ Start Server ═══
app.listen(PORT, () => {
  console.log(`TRAIL Game Pro SaaS server running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  URL: http://localhost:${PORT}`);
});

module.exports = app;