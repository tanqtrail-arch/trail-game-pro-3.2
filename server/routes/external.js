/**
 * External Games Routes - 外部ゲームからのALT連携
 * 配置場所: server/routes/external.js
 *
 * ★ Phase 3: 統一ALT計算エンジン経由に変更
 *   外部ゲームも processSessionALT() を通して
 *   逓減・キャップ・ボーナスの対象になる
 */
const { Router } = require('express');
const db = require('../db');
const { processSessionALT } = require('../lib/altEngine');
const router = Router();

// ═══ 外部ゲームからALT付与 ═══
// POST /api/external/game-result
// Body: { player, game_id, game_name, score, alt, correct_count, total_count, max_streak }
router.post('/game-result', (req, res) => {
  const { player, game_id, game_name, score, correct_count, total_count, max_streak } = req.body;

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

  const gameDbId = game ? game.id : null;

  // play_session を作成（外部ゲーム用：即座に start → end）
  const sessionResult = db.prepare(`
    INSERT INTO play_sessions (tenant_id, student_id, game_id, started_at, ended_at, duration_seconds, score, correct_count, total_count)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), 0, ?, ?, ?)
  `).run(
    student.tenant_id,
    student.id,
    gameDbId,
    score ?? null,
    correct_count ?? null,
    total_count ?? null
  );

  const sessionId = sessionResult.lastInsertRowid;

  // 正答率を計算
  const cc = Number(correct_count) || 0;
  const tc = Number(total_count) || 0;
  const accuracy = tc > 0 ? Math.round(cc * 100 / tc) : 0;

  // ★ 統一ALTエンジンで計算
  let altResult = { total: 0, breakdown: {}, awards: [] };
  try {
    altResult = processSessionALT({
      id:              sessionId,
      studentId:       student.id,
      tenantId:        student.tenant_id,
      gameId:          gameDbId,
      completed:       true,
      accuracy,
      durationSeconds: 0,
      score:           score ?? null,
      correctCount:    cc,
      totalCount:      tc,
      maxStreak:       Number(max_streak) || 0,
    });
  } catch (altErr) {
    console.error('[external] altEngine error (non-fatal):', altErr.message);
    // フォールバック: 固定10ALTを直接付与
    const fallbackAlt = 10;
    db.prepare(
      'INSERT INTO coin_logs (tenant_id, student_id, game_id, amount, note, awarded_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      student.tenant_id,
      student.id,
      gameDbId,
      fallbackAlt,
      `外部ゲーム(フォールバック): ${game_name || game_id} / スコア: ${score ?? '-'}`,
      'system'
    );
    altResult = { total: fallbackAlt, breakdown: { fallback: fallbackAlt }, awards: [{ reason: 'fallback', label: 'プレイ完了', amount: fallbackAlt }] };
  }

  // アクティビティログ
  db.prepare(
    `INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'coin', ?, ?)`
  ).run(
    student.tenant_id,
    'system',
    `${player} が ${game_name || game_id} で ${altResult.total} ALT を獲得（スコア: ${score ?? '-'}）`
  );

  console.log(`[External ALT] ${player} +${altResult.total} ALT / ${game_name || game_id} / score: ${score}`);

  res.status(201).json({
    success: true,
    player,
    alt: altResult.total,
    score,
    awards: altResult.awards,
    capInfo: altResult.capInfo || null,
  });
});

module.exports = router;
