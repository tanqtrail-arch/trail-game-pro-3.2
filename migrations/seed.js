#!/usr/bin/env node
/**
 * TRAIL Game Pro SaaS - Seed Data
 * デモテナントとデフォルトデータの投入
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.DATABASE_PATH || './data/trail-game.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Seeding database...');

const tenantId = uuidv4();
const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@trail-game.com';
const adminPass = process.env.SUPER_ADMIN_PASSWORD || 'trail2024';
const adminHash = bcrypt.hashSync(adminPass, 12);

db.transaction(() => {
  // テナント作成
  db.prepare(`
    INSERT OR IGNORE INTO tenants (id, name, slug, plan, max_students, max_games, max_classes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, 'デモ教室', 'demo', 'pro', 100, 50, 10);

  // 管理者作成
  db.prepare(`
    INSERT OR IGNORE INTO admin_users (id, tenant_id, email, password_hash, display_name, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), tenantId, adminEmail, adminHash, '管理者', 'owner');

  // デフォルトクラス
  const defaultClasses = ['探究キッズ', '探究スターター', '探究ベーシック', '探究アドバンス', '探究リミットレス', '探究個別'];
  const insertClass = db.prepare('INSERT OR IGNORE INTO classes (tenant_id, name) VALUES (?, ?)');
  defaultClasses.forEach(c => insertClass.run(tenantId, c));

  // デフォルトゲーム
  const defaultGames = [
    { name: '分数融合', emoji: '🧬', url: 'https://tanqtrail-arch.github.io/bunsu-fusion/', category: '算数' },
    { name: '分数ガンマン', emoji: '🔫', category: '算数' },
    { name: 'どっちがおおきい', emoji: '⚖️', category: '算数' },
    { name: '約分工房', emoji: '🔧', category: '算数' },
    { name: '分数テトリス', emoji: '🧱', category: '算数' },
    { name: '暗算パネル', emoji: '🧠', category: '算数' },
    { name: '特産品マッチング', emoji: '🍎', category: '地理' },
    { name: '都道府県シルエットクイズ', emoji: '🗾', url: 'https://tanqtrail-arch.github.io/silhouette-quiz-47/', category: '地理' },
    { name: '気候バトルカード', emoji: '🌦️', category: '理科' },
    { name: '絵画クイズ', emoji: '🎨', category: 'その他' },
    { name: '元素クエスト', emoji: '⚗️', category: '理科' },
    { name: '迷路アタック', emoji: '🏃', category: 'その他' },
    { name: 'お土産暗算', emoji: '🛍️', url: 'https://tanqtrail-arch.github.io/omiyage-anzan/', category: '算数' },
    { name: '江戸時代迷路クイズ', emoji: '🏯', category: '歴史' },
    { name: '文明ビルダー', emoji: '🏛️', category: '歴史' },
    { name: '書き順マスター', emoji: '✍️', url: 'https://tanqtrail-arch.github.io/kanji-stroke/', category: '国語' },
    { name: 'ここどこ？ドロップ', emoji: '🗾', url: 'https://tanqtrail-arch.github.io/kokodoko-drop/', category: '地理' },
    { name: 'どっちがデカい？', emoji: '📐', url: 'https://tanqtrail-arch.github.io/menseki-h-l/', category: '算数' },
    { name: '漢字道場【地理編】', emoji: '✍️', url: 'https://tanqtrail-arch.github.io/kanji-dojo-geography/', category: '国語' },
  ];
  const insertGame = db.prepare('INSERT OR IGNORE INTO games (tenant_id, name, emoji, url, category) VALUES (?, ?, ?, ?, ?)');
  defaultGames.forEach(g => insertGame.run(tenantId, g.name, g.emoji, g.url || null, g.category));
})();

console.log('Seed completed.');
console.log(`  Tenant ID: ${tenantId}`);
console.log(`  Admin: ${adminEmail}`);
console.log(`  Password: ${adminPass}`);
db.close();
