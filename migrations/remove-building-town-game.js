#!/usr/bin/env node
/**
 * Migration: ビルビルタウン 完全削除
 * 全テナントからビルビルタウンとその関連データを削除する
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || './data/trail-game.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Removing ビルビルタウン from all tenants...');

// ビルビルタウンのgame_idを取得
const games = db.prepare("SELECT id, tenant_id FROM games WHERE name LIKE '%ビルビル%'").all();

if (games.length === 0) {
  console.log('  No ビルビルタウン games found. Nothing to do.');
  db.close();
  process.exit(0);
}

console.log(`  Found ${games.length} ビルビルタウン game entries.`);

const gameIds = games.map(g => g.id);

db.transaction(() => {
  // 関連する play_sessions を削除
  const delSessions = db.prepare('DELETE FROM play_sessions WHERE game_id = ?');
  let sessionCount = 0;
  for (const gid of gameIds) {
    sessionCount += delSessions.run(gid).changes;
  }
  console.log(`  Deleted ${sessionCount} play_sessions records.`);

  // 関連する coin_logs を削除（game_id カラムがある場合）
  try {
    const delCoins = db.prepare('DELETE FROM coin_logs WHERE game_id = ?');
    let coinCount = 0;
    for (const gid of gameIds) {
      coinCount += delCoins.run(gid).changes;
    }
    console.log(`  Deleted ${coinCount} coin_logs records.`);
  } catch (e) {
    console.log('  coin_logs: game_id column not found or no matching records. Skipping.');
  }

  // 関連する game_sessions を削除（テーブルがある場合）
  try {
    const delGameSessions = db.prepare('DELETE FROM game_sessions WHERE game_id = ?');
    let gsCount = 0;
    for (const gid of gameIds) {
      gsCount += delGameSessions.run(gid).changes;
    }
    console.log(`  Deleted ${gsCount} game_sessions records.`);
  } catch (e) {
    console.log('  game_sessions: table not found or no matching records. Skipping.');
  }

  // games テーブルから削除
  const delGames = db.prepare("DELETE FROM games WHERE name LIKE '%ビルビル%'");
  const gamesDeleted = delGames.run().changes;
  console.log(`  Deleted ${gamesDeleted} games records.`);
})();

console.log('Done. ビルビルタウン completely removed.');
db.close();
