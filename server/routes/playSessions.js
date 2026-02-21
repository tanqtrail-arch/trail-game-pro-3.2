// server/routes/playSessions.js
// プレイセッション（学習ログ）API
const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================================
//  POST /api/play-sessions/start
//  ゲーム開始時に呼ばれる。セッションIDを返す。
// ============================================================
router.post('/start', (req, res) => {
  try {
    const { tenant_id, student_id, game_id } = req.body;

    // バリデーション
    if (!tenant_id || !student_id || !game_id) {
      return res.status(400).json({
        error: 'tenant_id, student_id, game_id は必須です'
      });
    }

    // 生徒の存在確認
    const student = db.prepare(
      'SELECT id FROM students WHERE id = ? AND tenant_id = ?'
    ).get(student_id, tenant_id);

    if (!student) {
      return res.status(404).json({ error: '生徒が見つかりません' });
    }

    // ゲームの存在確認
    const game = db.prepare(
      'SELECT id FROM games WHERE id = ? AND tenant_id = ?'
    ).get(game_id, tenant_id);

    if (!game) {
      return res.status(404).json({ error: 'ゲームが見つかりません' });
    }

    // セッション作成
    const result = db.prepare(`
      INSERT INTO play_sessions (tenant_id, student_id, game_id, started_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(tenant_id, student_id, game_id);

    res.json({
      success: true,
      session_id: result.lastInsertRowid
    });

  } catch (err) {
    console.error('セッション開始エラー:', err);
    res.status(500).json({ error: 'セッション開始に失敗しました' });
  }
});

// ============================================================
//  PATCH /api/play-sessions/:id/end
//  ゲーム終了時に呼ばれる。スコア等を記録する。
// ============================================================
router.patch('/:id/end', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { score, correct_count, total_count, metadata } = req.body;

    // セッション存在確認
    const session = db.prepare(
      'SELECT id, started_at, ended_at FROM play_sessions WHERE id = ?'
    ).get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }

    if (session.ended_at) {
      return res.status(400).json({ error: 'このセッションは既に終了しています' });
    }

    // プレイ時間を計算（秒）
    const durationQuery = db.prepare(`
      SELECT CAST(
        (julianday(datetime('now')) - julianday(?)) * 86400 AS INTEGER
      ) as duration
    `).get(session.started_at);

    const duration_seconds = durationQuery.duration;

    // 異常値チェック（6時間以上は異常とみなす）
    const MAX_DURATION = 6 * 60 * 60;
    const safeDuration = duration_seconds > MAX_DURATION ? MAX_DURATION : duration_seconds;

    // セッション更新
    db.prepare(`
      UPDATE play_sessions
      SET ended_at = datetime('now'),
          duration_seconds = ?,
          score = ?,
          correct_count = ?,
          total_count = ?,
          metadata = ?
      WHERE id = ?
    `).run(
      safeDuration,
      score || null,
      correct_count || null,
      total_count || null,
      metadata ? JSON.stringify(metadata) : null,
      sessionId
    );

    res.json({
      success: true,
      duration_seconds: safeDuration
    });

  } catch (err) {
    console.error('セッション終了エラー:', err);
    res.status(500).json({ error: 'セッション終了に失敗しました' });
  }
});

// ============================================================
//  GET /api/play-sessions
//  セッション一覧取得（フィルタ対応）
//  クエリパラメータ: tenant_id, student_id, game_id, from, to, limit
// ============================================================
router.get('/', (req, res) => {
  try {
    const { tenant_id, student_id, game_id, from, to, limit } = req.query;

    let sql = `
      SELECT
        ps.id,
        ps.tenant_id,
        ps.student_id,
        s.name AS student_name,
        ps.game_id,
        g.name AS game_name,
        g.emoji AS game_emoji,
        ps.started_at,
        ps.ended_at,
        ps.duration_seconds,
        ps.score,
        ps.correct_count,
        ps.total_count,
        CASE
          WHEN ps.total_count > 0
          THEN ROUND(ps.correct_count * 100.0 / ps.total_count, 1)
          ELSE NULL
        END AS accuracy_pct,
        ps.metadata
      FROM play_sessions ps
      JOIN students s ON ps.student_id = s.id
      JOIN games g ON ps.game_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (tenant_id) {
      sql += ' AND ps.tenant_id = ?';
      params.push(tenant_id);
    }
    if (student_id) {
      sql += ' AND ps.student_id = ?';
      params.push(student_id);
    }
    if (game_id) {
      sql += ' AND ps.game_id = ?';
      params.push(game_id);
    }
    if (from) {
      sql += ' AND ps.started_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND ps.started_at <= ?';
      params.push(to);
    }

    sql += ' ORDER BY ps.started_at DESC';
    sql += ` LIMIT ?`;
    params.push(parseInt(limit) || 100);

    const sessions = db.prepare(sql).all(...params);
    res.json(sessions);

  } catch (err) {
    console.error('セッション取得エラー:', err);
    res.status(500).json({ error: 'セッション取得に失敗しました' });
  }
});

// ============================================================
//  GET /api/play-sessions/stats/student/:studentId
//  生徒別の集計データ
// ============================================================
router.get('/stats/student/:studentId', (req, res) => {
  try {
    const { studentId } = req.params;
    const { from, to } = req.query;

    let dateFilter = '';
    const params = [studentId];

    if (from) {
      dateFilter += ' AND ps.started_at >= ?';
      params.push(from);
    }
    if (to) {
      dateFilter += ' AND ps.started_at <= ?';
      params.push(to);
    }

    // 総合統計
    const overview = db.prepare(`
      SELECT
        COUNT(*) AS total_plays,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(ps.duration_seconds), 0) AS avg_seconds_per_play,
        ROUND(AVG(CASE WHEN ps.total_count > 0
          THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy,
        MAX(ps.score) AS best_score
      FROM play_sessions ps
      WHERE ps.student_id = ? AND ps.ended_at IS NOT NULL
      ${dateFilter}
    `).get(...params);

    // ゲーム別統計
    const byGame = db.prepare(`
      SELECT
        g.id AS game_id,
        g.name AS game_name,
        g.emoji,
        COUNT(*) AS play_count,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(CASE WHEN ps.total_count > 0
          THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy,
        MAX(ps.score) AS best_score
      FROM play_sessions ps
      JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ? AND ps.ended_at IS NOT NULL
      ${dateFilter}
      GROUP BY g.id
      ORDER BY total_seconds DESC
    `).all(...params);

    // 日別推移（直近30日）
    const daily = db.prepare(`
      SELECT
        DATE(ps.started_at) AS date,
        COUNT(*) AS play_count,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(CASE WHEN ps.total_count > 0
          THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy
      FROM play_sessions ps
      WHERE ps.student_id = ? AND ps.ended_at IS NOT NULL
      ${dateFilter}
      GROUP BY DATE(ps.started_at)
      ORDER BY date DESC
      LIMIT 30
    `).all(...params);

    res.json({ overview, byGame, daily });

  } catch (err) {
    console.error('生徒統計エラー:', err);
    res.status(500).json({ error: '統計取得に失敗しました' });
  }
});

// ============================================================
//  GET /api/play-sessions/stats/game/:gameId
//  ゲーム別の集計データ
// ============================================================
router.get('/stats/game/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const { tenant_id } = req.query;

    let tenantFilter = '';
    const params = [gameId];

    if (tenant_id) {
      tenantFilter = ' AND ps.tenant_id = ?';
      params.push(tenant_id);
    }

    // ゲーム総合統計
    const overview = db.prepare(`
      SELECT
        COUNT(DISTINCT ps.student_id) AS unique_players,
        COUNT(*) AS total_plays,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(ps.duration_seconds), 0) AS avg_seconds_per_play,
        ROUND(AVG(CASE WHEN ps.total_count > 0
          THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy,
        MAX(ps.score) AS high_score
      FROM play_sessions ps
      WHERE ps.game_id = ? AND ps.ended_at IS NOT NULL
      ${tenantFilter}
    `).get(...params);

    // プレイヤーランキング（スコア順）
    const leaderboard = db.prepare(`
      SELECT
        s.id AS student_id,
        s.name AS student_name,
        COUNT(*) AS play_count,
        MAX(ps.score) AS best_score,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(CASE WHEN ps.total_count > 0
          THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy
      FROM play_sessions ps
      JOIN students s ON ps.student_id = s.id
      WHERE ps.game_id = ? AND ps.ended_at IS NOT NULL
      ${tenantFilter}
      GROUP BY s.id
      ORDER BY best_score DESC
      LIMIT 20
    `).all(...params);

    res.json({ overview, leaderboard });

  } catch (err) {
    console.error('ゲーム統計エラー:', err);
    res.status(500).json({ error: '統計取得に失敗しました' });
  }
});

// ============================================================
//  GET /api/play-sessions/stats/tenants/compare
//  教室間比較（スーパー管理者向け）
// ============================================================
router.get('/stats/tenants/compare', (req, res) => {
  try {
    const comparison = db.prepare(`
      SELECT
        t.id AS tenant_id,
        t.name AS tenant_name,
        COUNT(DISTINCT ps.student_id) AS active_students,
        COUNT(*) AS total_plays,
        COALESCE(SUM(ps.duration_seconds), 0) AS total_seconds,
        ROUND(AVG(ps.duration_seconds), 0) AS avg_seconds_per_play,
        ROUND(AVG(CASE WHEN ps.total_count > 0
          THEN ps.correct_count * 100.0 / ps.total_count END), 1) AS avg_accuracy,
        ROUND(
          COALESCE(SUM(ps.duration_seconds), 0) * 1.0 /
          NULLIF(COUNT(DISTINCT ps.student_id), 0), 0
        ) AS avg_seconds_per_student
      FROM tenants t
      LEFT JOIN play_sessions ps ON t.id = ps.tenant_id AND ps.ended_at IS NOT NULL
      GROUP BY t.id
      ORDER BY total_seconds DESC
    `).all();

    res.json(comparison);

  } catch (err) {
    console.error('教室比較エラー:', err);
    res.status(500).json({ error: '教室比較データの取得に失敗しました' });
  }
});

// ============================================================
//  GET /api/play-sessions/export/csv
//  CSVエクスポート（バックアップ用）
// ============================================================
router.get('/export/csv', (req, res) => {
  try {
    const { tenant_id, from, to } = req.query;

    let sql = `
      SELECT
        ps.id,
        t.name AS tenant_name,
        s.name AS student_name,
        g.name AS game_name,
        ps.started_at,
        ps.ended_at,
        ps.duration_seconds,
        ps.score,
        ps.correct_count,
        ps.total_count,
        CASE
          WHEN ps.total_count > 0
          THEN ROUND(ps.correct_count * 100.0 / ps.total_count, 1)
          ELSE ''
        END AS accuracy_pct
      FROM play_sessions ps
      JOIN tenants t ON ps.tenant_id = t.id
      JOIN students s ON ps.student_id = s.id
      JOIN games g ON ps.game_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (tenant_id) {
      sql += ' AND ps.tenant_id = ?';
      params.push(tenant_id);
    }
    if (from) {
      sql += ' AND ps.started_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND ps.started_at <= ?';
      params.push(to);
    }

    sql += ' ORDER BY ps.started_at DESC';

    const rows = db.prepare(sql).all(...params);

    // CSVヘッダー
    const header = 'ID,教室名,生徒名,ゲーム名,開始日時,終了日時,プレイ時間(秒),スコア,正答数,問題数,正答率(%)';

    // CSV行生成
    const csvRows = rows.map(r =>
      [r.id, r.tenant_name, r.student_name, r.game_name,
       r.started_at, r.ended_at || '', r.duration_seconds || '',
       r.score || '', r.correct_count || '', r.total_count || '',
       r.accuracy_pct
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );

    const csv = '\uFEFF' + header + '\n' + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="play_sessions_${new Date().toISOString().slice(0,10)}.csv"`
    );
    res.send(csv);

  } catch (err) {
    console.error('CSVエクスポートエラー:', err);
    res.status(500).json({ error: 'CSVエクスポートに失敗しました' });
  }
});

module.exports = router;
