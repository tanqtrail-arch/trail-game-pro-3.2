#!/usr/bin/env node
/**
 * TRAIL Game Pro SaaS - Database Migration
 * マルチテナント対応のSQLiteスキーマ
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/trail-game.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Running migrations...');

db.exec(`
  -- ════════════════════════════════════════
  -- テナント（学校・教室単位）
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free',
    max_students INTEGER NOT NULL DEFAULT 30,
    max_games INTEGER NOT NULL DEFAULT 20,
    max_classes INTEGER NOT NULL DEFAULT 6,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════
  -- 管理者ユーザー（教師アカウント）
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_admin_users_tenant ON admin_users(tenant_id);

  -- ════════════════════════════════════════
  -- クラス
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_classes_tenant ON classes(tenant_id);

  -- ════════════════════════════════════════
  -- 生徒
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, name, class_id)
  );
  CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

  -- ════════════════════════════════════════
  -- ゲーム
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🎮',
    url TEXT,
    category TEXT NOT NULL DEFAULT 'その他',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_games_tenant ON games(tenant_id);

  -- ════════════════════════════════════════
  -- コイン（ALT）ログ
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS coin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    awarded_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_coin_logs_tenant ON coin_logs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_coin_logs_student ON coin_logs(student_id);

  -- ════════════════════════════════════════
  -- バッジ
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reason TEXT,
    awarded_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_badges_tenant ON badges(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_badges_student ON badges(student_id);

  -- ════════════════════════════════════════
  -- ランキング
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    score_label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rankings_tenant ON rankings(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_rankings_game ON rankings(game_id);

  -- ════════════════════════════════════════
  -- ログイン履歴
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    login_at TEXT NOT NULL DEFAULT (datetime('now')),
    logout_at TEXT,
    duration_seconds INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_login_logs_tenant ON login_logs(tenant_id);

  -- ════════════════════════════════════════
  -- ゲームプレイ履歴
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS game_play_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_game_play_logs_tenant ON game_play_logs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_game_play_logs_student ON game_play_logs(student_id);

  -- ════════════════════════════════════════
  -- アクティビティログ
  -- ════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    actor TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
`);

console.log('Migrations completed successfully.');
db.close();
