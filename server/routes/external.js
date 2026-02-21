/**
 * External Games Routes - 外部ゲームからのALT連携
 * 配置場所: server/routes/external.js
 */
const { Router } = require('express');
const db = require('../db');
const router = Router();

// ═══ 外部ゲームからALT付与 ═══
// POST /api/external/game-result
// Body: { player: "さとる", game_id: "fraction-fusion", game_name: "分数融合", score: 1500, alt: 10 }
router.post('/game-result', (req, res) => {
  const { player, game_id, game_name, score, alt } = req.body;

  if (!player || !game_id) {
    return res.status(400).json({ error: 'player と game_id は必須です' });
  }

  // プレイヤー名でstudentを検索
  const student = db.prepare(
    'SELECT * FROM students WHERE name = ? LIMIT 1'
  ).get(player);

  if (!student) {
    return res.status(404).json({ error: `プレイヤー "${player}" が見つかりません` });
  }

  // テナント内でゲームを名前検索（なければnull）
  const game = db.prepare(
    'SELECT * FROM games WHERE tenant_id = ? AND name = ? LIMIT 1'
  ).get(student.tenant_id, game_name || '');

  const altAmount = Number(alt) || 10;

  // ALT付与（coin_logsに追記）
  db.prepare(
    'INSERT INTO coin_logs (tenant_id, student_id, game_id, amount, note, awarded_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    student.tenant_id,
    student.id,
    game ? game.id : null,
    altAmount,
    `外部ゲーム: ${game_name || game_id} / スコア: ${score ?? '-'}`,
    'system'
  );

  // アクティビティログ
  db.prepare(
    `INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'coin', ?, ?)`
  ).run(
    student.tenant_id,
    'system',
    `${player} が ${game_name || game_id} で ${altAmount} ALT を獲得（スコア: ${score ?? '-'}）`
  );

  console.log(`[External ALT] ${player} +${altAmount} ALT / ${game_name || game_id} / score: ${score}`);

  res.status(201).json({ success: true, player, alt: altAmount, score });
});

module.exports = router;