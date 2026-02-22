/**
 * Game Saves Routes - TRAIL Game Pro 3.2
 * ゲーム進捗サーバー保存 API
 * Task 0-7
 *
 * GET  /api/game-saves/:studentId/:gameId  - セーブデータ取得
 * PUT  /api/game-saves/:studentId/:gameId  - セーブデータ保存（upsert）
 * DELETE /api/game-saves/:studentId/:gameId - セーブデータ削除
 */

'use strict';

const { Router } = require('express');
const db = require('../db');

const router = Router();

// セーブデータのサイズ上限（64KB）
const MAX_SAVE_SIZE = 64 * 1024;

// ════════════════════════════════════════════════════════
//  GET /api/game-saves/:studentId/:gameId
//  セーブデータ取得
// ════════════════════════════════════════════════════════
router.get('/:studentId/:gameId', (req, res) => {
  try {
    const { studentId, gameId } = req.params;

    const row = db.prepare(`
      SELECT id, student_id, game_id, save_data, save_type, updated_at
        FROM game_saves
       WHERE student_id = ? AND game_id = ?
    `).get(studentId, gameId);

    if (!row) {
      // セーブデータなし → 空で返す（404にしない）
      return res.json({ exists: false, save_data: null, updated_at: null });
    }

    res.json({
      exists:     true,
      student_id: row.student_id,
      game_id:    row.game_id,
      save_data:  tryParse(row.save_data),
      save_type:  row.save_type,
      updated_at: row.updated_at,
    });

  } catch (err) {
    console.error('セーブデータ取得エラー:', err);
    res.status(500).json({ error: 'セーブデータの取得に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  PUT /api/game-saves/:studentId/:gameId
//  セーブデータ保存（upsert）
//  ゲーム終了・チェックポイント通過時に呼ぶ
// ════════════════════════════════════════════════════════
router.put('/:studentId/:gameId', (req, res) => {
  try {
    const { studentId, gameId } = req.params;
    const { save_data, save_type = 'auto' } = req.body;

    if (save_data === undefined || save_data === null) {
      return res.status(400).json({ error: 'save_data は必須です' });
    }

    // 生徒の存在確認
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
    if (!student) return res.status(404).json({ error: '生徒が見つかりません' });

    // サイズチェック
    const saveJson = JSON.stringify(save_data);
    if (saveJson.length > MAX_SAVE_SIZE) {
      return res.status(413).json({ error: `セーブデータが大きすぎます（上限${MAX_SAVE_SIZE / 1024}KB）` });
    }

    // UPSERT（INSERT OR REPLACE）
    db.prepare(`
      INSERT INTO game_saves (student_id, game_id, save_data, save_type, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(student_id, game_id)
      DO UPDATE SET
        save_data  = excluded.save_data,
        save_type  = excluded.save_type,
        updated_at = datetime('now')
    `).run(studentId, gameId, saveJson, save_type);

    res.json({
      success:    true,
      student_id: parseInt(studentId),
      game_id:    gameId,
      save_type,
      updated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('セーブデータ保存エラー:', err);
    res.status(500).json({ error: 'セーブデータの保存に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  DELETE /api/game-saves/:studentId/:gameId
//  セーブデータ削除（ゲームリセット用）
// ════════════════════════════════════════════════════════
router.delete('/:studentId/:gameId', (req, res) => {
  try {
    const { studentId, gameId } = req.params;

    const result = db.prepare(
      'DELETE FROM game_saves WHERE student_id = ? AND game_id = ?'
    ).run(studentId, gameId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'セーブデータが見つかりません' });
    }

    res.json({ success: true });

  } catch (err) {
    console.error('セーブデータ削除エラー:', err);
    res.status(500).json({ error: 'セーブデータの削除に失敗しました' });
  }
});

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────
function tryParse(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

module.exports = router;