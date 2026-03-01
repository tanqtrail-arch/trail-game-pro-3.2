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
    // ── 第2段階 ──
    {
      version: 'v2_003',
      description: 'Create course_definitions',
      fn: (db) => {
        db.exec(`CREATE TABLE IF NOT EXISTS course_definitions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          course_type TEXT NOT NULL,
          title_format TEXT NOT NULL,
          emoji TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'coming_soon',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`);
      },
    },
    {
      version: 'v2_004',
      description: 'Create course_games',
      fn: (db) => {
        db.exec(`CREATE TABLE IF NOT EXISTS course_games (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          course_id TEXT NOT NULL,
          game_id INTEGER NOT NULL,
          step_number INTEGER NOT NULL,
          pass_threshold REAL DEFAULT 60.0,
          badge_threshold REAL DEFAULT 80.0,
          UNIQUE(course_id, game_id),
          UNIQUE(course_id, step_number),
          FOREIGN KEY (course_id) REFERENCES course_definitions(id)
        )`);
      },
    },
    {
      version: 'v2_005',
      description: 'Create student_course_progress',
      fn: (db) => {
        db.exec(`CREATE TABLE IF NOT EXISTS student_course_progress (
          id TEXT PRIMARY KEY,
          student_id INTEGER NOT NULL,
          tenant_id TEXT NOT NULL,
          course_id TEXT NOT NULL,
          game_id INTEGER NOT NULL,
          best_achievement REAL DEFAULT 0,
          passed INTEGER DEFAULT 0,
          mastered INTEGER DEFAULT 0,
          attempts INTEGER DEFAULT 0,
          passed_at TEXT,
          mastered_at TEXT,
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(student_id, course_id, game_id)
        )`);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_scp_student ON student_course_progress(student_id);
          CREATE INDEX IF NOT EXISTS idx_scp_course ON student_course_progress(course_id);
        `);
      },
    },
    {
      version: 'v2_006',
      description: 'Create student_course_grades',
      fn: (db) => {
        db.exec(`CREATE TABLE IF NOT EXISTS student_course_grades (
          id TEXT PRIMARY KEY,
          student_id INTEGER NOT NULL,
          tenant_id TEXT NOT NULL,
          course_id TEXT NOT NULL,
          current_grade TEXT DEFAULT '4級',
          games_passed INTEGER DEFAULT 0,
          games_mastered INTEGER DEFAULT 0,
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(student_id, course_id)
        )`);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_scg_student ON student_course_grades(student_id);
          CREATE INDEX IF NOT EXISTS idx_scg_course ON student_course_grades(course_id);
        `);
      },
    },
    {
      version: 'v2_007',
      description: 'Create badge_definitions',
      fn: (db) => {
        db.exec(`CREATE TABLE IF NOT EXISTS badge_definitions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          emoji TEXT NOT NULL,
          condition_type TEXT NOT NULL,
          condition_value TEXT NOT NULL,
          rarity TEXT DEFAULT 'common',
          sort_order INTEGER DEFAULT 0
        )`);
      },
    },
    {
      version: 'v2_008',
      description: 'Seed 12 course definitions',
      fn: (db) => {
        const courses = [
          ['space','宇宙博士','hakase','{name}{grade}','🔭','太陽系・星座・宇宙開発','coming_soon',1],
          ['flags','国旗博士','hakase','{name}{grade}','🏴','世界の国旗・国名・首都','coming_soon',2],
          ['jp_history','日本史博士','hakase','{name}{grade}','🏯','日本の歴史・人物・出来事','coming_soon',3],
          ['world_history','世界史博士','hakase','{name}{grade}','🌍','世界の歴史・文明・偉人','coming_soon',4],
          ['dinosaur','恐竜博士','hakase','{name}{grade}','🦕','恐竜・古生物・地質時代','coming_soon',5],
          ['fish','魚博士','hakase','{name}{grade}','🐟','魚・海の生き物・海洋','coming_soon',6],
          ['insect','昆虫博士','hakase','{name}{grade}','🦗','昆虫・生態・変態','coming_soon',7],
          ['animal','動物博士','hakase','{name}{grade}','🐾','動物全般・生態・分類','coming_soon',8],
          ['color','カラーデザイナー','designer','{name}{grade}','🎨','色彩・配色・デザイン','coming_soon',9],
          ['sweets','スイーツパティシエ','designer','{name}{grade}','🧁','お菓子・計量・化学反応','coming_soon',10],
          ['flower','フラワーアーティスト','designer','{name}{grade}','🌸','花・植物・ガーデニング','coming_soon',11],
          ['business','ビジネスエキスパート','expert','{name}{grade}','💼','お金・経営・マーケティングを体験しながら学ぼう','coming_soon',12],
        ];
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO course_definitions
           (id, name, course_type, title_format, emoji, description, status, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const c of courses) stmt.run(...c);
      },
    },
    {
      version: 'v2_009',
      description: 'Seed 72 course badges',
      fn: (db) => {
        const courseBadges = {
          space:         { name: '宇宙博士',           grades: { '3級': '🔭⭐', '準2級': '🔭🌙', '2級': '🔭🪐', '準1級': '🔭🚀', '1級': '🔭🌌', '特級': '🔭👑' } },
          flags:         { name: '国旗博士',           grades: { '3級': '🏴⭐', '準2級': '🏴🌐', '2級': '🏴🗺️', '準1級': '🏴🏛️', '1級': '🏴🌍', '特級': '🏴👑' } },
          jp_history:    { name: '日本史博士',         grades: { '3級': '🏯⭐', '準2級': '🏯⚔️', '2級': '🏯📜', '準1級': '🏯🏰', '1級': '🏯🎌', '特級': '🏯👑' } },
          world_history: { name: '世界史博士',         grades: { '3級': '🌍⭐', '準2級': '🌍🏛️', '2級': '🌍📜', '準1級': '🌍⚔️', '1級': '🌍🗿', '特級': '🌍👑' } },
          dinosaur:      { name: '恐竜博士',           grades: { '3級': '🦕⭐', '準2級': '🦕🦴', '2級': '🦕🌋', '準1級': '🦕🔬', '1級': '🦕🦖', '特級': '🦕👑' } },
          fish:          { name: '魚博士',             grades: { '3級': '🐟⭐', '準2級': '🐟🐠', '2級': '🐟🦈', '準1級': '🐟🐙', '1級': '🐟🌊', '特級': '🐟👑' } },
          insect:        { name: '昆虫博士',           grades: { '3級': '🦗⭐', '準2級': '🦗🐛', '2級': '🦗🦋', '準1級': '🦗🐝', '1級': '🦗🔬', '特級': '🦗👑' } },
          animal:        { name: '動物博士',           grades: { '3級': '🐾⭐', '準2級': '🐾🦁', '2級': '🐾🐘', '準1級': '🐾🦅', '1級': '🐾🌿', '特級': '🐾👑' } },
          color:         { name: 'カラーデザイナー',     grades: { '3級': '🎨⭐', '準2級': '🎨🌈', '2級': '🎨💎', '準1級': '🎨✨', '1級': '🎨🖼️', '特級': '🎨👑' } },
          sweets:        { name: 'スイーツパティシエ',   grades: { '3級': '🧁⭐', '準2級': '🧁🍰', '2級': '🧁🎂', '準1級': '🧁🍫', '1級': '🧁👨‍🍳', '特級': '🧁👑' } },
          flower:        { name: 'フラワーアーティスト', grades: { '3級': '🌸⭐', '準2級': '🌸🌷', '2級': '🌸🌹', '準1級': '🌸💐', '1級': '🌸🌺', '特級': '🌸👑' } },
          business:      { name: 'ビジネスエキスパート', grades: { '3級': '💼⭐', '準2級': '💼📊', '2級': '💼💰', '準1級': '💼🏢', '1級': '💼🚀', '特級': '💼👑' } },
        };
        const rarityMap = { '3級': 'common', '準2級': 'rare', '2級': 'rare', '準1級': 'epic', '1級': 'epic', '特級': 'legendary' };
        let sortOrder = 200;
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO badge_definitions
           (id, name, description, emoji, condition_type, condition_value, rarity, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const [courseId, info] of Object.entries(courseBadges)) {
          for (const [grade, emoji] of Object.entries(info.grades)) {
            const gradeKey = grade === '準2級' ? 'j2' : grade === '準1級' ? 'j1'
              : grade === '3級' ? '3' : grade === '2級' ? '2'
              : grade === '1級' ? '1' : 'sp';
            const id = `${courseId}_${gradeKey}`;
            const name = `${info.name}${grade}`;
            const desc = `${name}に到達`;
            const condValue = JSON.stringify({ course_id: courseId, grade });
            stmt.run(id, name, desc, emoji, 'course_grade', condValue, rarityMap[grade], sortOrder++);
          }
        }
      },
    },
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
