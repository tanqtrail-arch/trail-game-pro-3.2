#!/usr/bin/env node
/**
 * Migration: 書き順マスター ゲーム追加
 * 既存テナントに「書き順マスター」ゲームを追加する
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || './data/trail-game.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const GAME = {
  name: '書き順マスター',
  emoji: '✍️',
  url: 'https://tanqtrail-arch.github.io/kanji-stroke/',
  category: '国語',
};

console.log(`Adding game: ${GAME.emoji} ${GAME.name} (${GAME.category})`);

const tenants = db.prepare('SELECT id, name FROM tenants').all();

if (tenants.length === 0) {
  console.log('No tenants found. Skipping.');
  process.exit(0);
}

const insertGame = db.prepare(`
  INSERT INTO games (tenant_id, name, emoji, url, category)
  SELECT ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1 FROM games WHERE tenant_id = ? AND name = ? AND is_active = 1
  )
`);

db.transaction(() => {
  for (const tenant of tenants) {
    const result = insertGame.run(
      tenant.id, GAME.name, GAME.emoji, GAME.url, GAME.category,
      tenant.id, GAME.name
    );
    if (result.changes > 0) {
      console.log(`  ✓ Added to tenant: ${tenant.name} (${tenant.id})`);
    } else {
      console.log(`  - Already exists in tenant: ${tenant.name}`);
    }
  }
})();

console.log('Done.');
db.close();
