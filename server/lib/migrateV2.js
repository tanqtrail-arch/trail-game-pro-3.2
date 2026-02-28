/**
 * Migration V2 - TRAIL Game Pro 3.2
 * バージョン管理付きマイグレーション
 *
 * ★ 既存の migrations/run.js / server/index.js bootstrap() は触らない。
 *   新機能のスキーマ変更はここに追加していく。
 */

'use strict';

// カテゴリ → 科目マッピング
const CATEGORY_TO_SUBJECT = {
  '算数': '算数',
  '国語': '国語',
  '理科': '理科',
  '地理': '社会',
  '歴史': '社会',
  // 'その他' → NULL（マッピングなし）
};

function runMigrationsV2(db) {
  // マイグレーション管理テーブル
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations_v2 (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);

  const MIGRATIONS = [
    // ── 第1段階 ──
    {
      version: 'v2_001',
      description: 'Add is_course_game and subject to games',
      fn: (db) => {
        const cols = db.pragma('table_info(games)').map(c => c.name);
        if (!cols.includes('is_course_game')) {
          db.exec('ALTER TABLE games ADD COLUMN is_course_game INTEGER DEFAULT 0');
        }
        if (!cols.includes('subject')) {
          db.exec('ALTER TABLE games ADD COLUMN subject TEXT DEFAULT NULL');
        }
        // 既存ゲームの category から subject を自動マッピング
        for (const [category, subject] of Object.entries(CATEGORY_TO_SUBJECT)) {
          db.prepare(
            'UPDATE games SET subject = ? WHERE category = ? AND subject IS NULL'
          ).run(subject, category);
        }
      },
    },
    {
      version: 'v2_002',
      description: 'Create student_subject_levels',
      fn: (db) => {
        db.exec(`CREATE TABLE IF NOT EXISTS student_subject_levels (
          id TEXT PRIMARY KEY,
          student_id INTEGER NOT NULL,
          tenant_id TEXT NOT NULL,
          subject TEXT NOT NULL,
          total_alt INTEGER DEFAULT 0,
          current_level INTEGER DEFAULT 1,
          correct_count INTEGER DEFAULT 0,
          total_count INTEGER DEFAULT 0,
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(student_id, subject)
        )`);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_ssl_student ON student_subject_levels(student_id);
          CREATE INDEX IF NOT EXISTS idx_ssl_tenant ON student_subject_levels(tenant_id);
          CREATE INDEX IF NOT EXISTS idx_ssl_subject ON student_subject_levels(subject);
        `);
      },
    },
    // ── 第2段階のマイグレーションはここに追加 ──
  ];

  for (const m of MIGRATIONS) {
    const applied = db.prepare(
      'SELECT 1 FROM _migrations_v2 WHERE version = ?'
    ).get(m.version);
    if (!applied) {
      console.log(`  [migrateV2] Applying ${m.version}: ${m.description}`);
      m.fn(db);
      db.prepare(
        'INSERT INTO _migrations_v2 (version, description) VALUES (?, ?)'
      ).run(m.version, m.description);
    }
  }
  console.log('  [migrateV2] All migrations up to date');
}

module.exports = { runMigrationsV2 };
