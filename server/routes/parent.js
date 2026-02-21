/**
 * TRAIL Game Pro - 保護者ダッシュボードAPI
 * トークン認証・ダッシュボードデータ・先生コメント・おうちヒント
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// ============================================================
// 保護者トークン発行（管理者用）
// POST /api/parent-tokens
// ============================================================
router.post('/parent-tokens', (req, res) => {
  try {
    const { tenant_id, student_id } = req.body;
    if (!tenant_id || !student_id) {
      return res.status(400).json({ error: 'tenant_id and student_id are required' });
    }

    // 既存トークンがあればそれを返す
    const existing = db.prepare(
      "SELECT * FROM parent_tokens WHERE tenant_id = ? AND student_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).get(tenant_id, student_id);

    if (existing) {
      return res.json({
        token: existing.token,
        url: `/parent.html?token=${existing.token}`,
        existing: true
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.prepare(
      'INSERT INTO parent_tokens (tenant_id, student_id, token) VALUES (?, ?, ?)'
    ).run(tenant_id, student_id, token);

    res.json({ token, url: `/parent.html?token=${token}`, existing: false });
  } catch (err) {
    console.error('Token creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// トークン一覧（管理者用）
// GET /api/parent-tokens?tenant_id=xxx
// ============================================================
router.get('/parent-tokens', (req, res) => {
  try {
    const { tenant_id } = req.query;
    let sql = `
      SELECT pt.*, s.name as student_name
      FROM parent_tokens pt
      JOIN students s ON pt.student_id = s.id
      WHERE (pt.expires_at IS NULL OR pt.expires_at > datetime('now'))
    `;
    const params = [];
    if (tenant_id) {
      sql += ' AND pt.tenant_id = ?';
      params.push(tenant_id);
    }
    const tokens = db.prepare(sql).all(...params);
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// トークン無効化（管理者用）
// DELETE /api/parent-tokens/:id
// ============================================================
router.delete('/parent-tokens/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM parent_tokens WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 先生コメント投稿（管理者用）
// POST /api/teacher-comments
// ============================================================
router.post('/teacher-comments', (req, res) => {
  try {
    const { tenant_id, student_id, comment, month } = req.body;
    if (!tenant_id || !student_id || !comment || !month) {
      return res.status(400).json({ error: 'tenant_id, student_id, comment, month are required' });
    }

    const existing = db.prepare(
      'SELECT id FROM teacher_comments WHERE tenant_id = ? AND student_id = ? AND month = ?'
    ).get(tenant_id, student_id, month);

    if (existing) {
      db.prepare('UPDATE teacher_comments SET comment = ? WHERE id = ?').run(comment, existing.id);
    } else {
      db.prepare(
        'INSERT INTO teacher_comments (tenant_id, student_id, comment, month) VALUES (?, ?, ?, ?)'
      ).run(tenant_id, student_id, comment, month);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 先生コメント取得
// GET /api/teacher-comments/:studentId?month=2026-02
// ============================================================
router.get('/teacher-comments/:studentId', (req, res) => {
  try {
    const { month } = req.query;
    let sql = 'SELECT * FROM teacher_comments WHERE student_id = ?';
    const params = [req.params.studentId];
    if (month) {
      sql += ' AND month = ?';
      params.push(month);
    }
    sql += ' ORDER BY month DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 保護者ダッシュボード用データ（トークン認証）
// GET /api/parent/:token
// ============================================================
router.get('/parent/:token', (req, res) => {
  try {
    const tokenRow = db.prepare(
      "SELECT * FROM parent_tokens WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).get(req.params.token);

    if (!tokenRow) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { tenant_id, student_id } = tokenRow;

    // 生徒基本情報
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // 参加日数
    const daysSinceJoin = db.prepare(
      "SELECT CAST(julianday('now') - julianday(created_at) AS INTEGER) as days FROM students WHERE id = ?"
    ).get(student_id);

    // --- 今月・先月の期間計算 ---
    const now = new Date();
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lmStart = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const lmEnd = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`;

    // --- 今月の統計 ---
    const monthlyStats = db.prepare(`
      SELECT
        COUNT(*) as total_plays,
        COALESCE(SUM(duration_seconds), 0) as total_seconds,
        ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) as avg_accuracy,
        MAX(score) as max_score
      FROM play_sessions
      WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
    `).get(student_id, tenant_id, thisMonthStart);

    // --- 先月の統計 ---
    const prevMonthStats = db.prepare(`
      SELECT
        COUNT(*) as total_plays,
        COALESCE(SUM(duration_seconds), 0) as total_seconds,
        ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) as avg_accuracy
      FROM play_sessions
      WHERE student_id = ? AND tenant_id = ? AND started_at >= ? AND started_at <= ?
    `).get(student_id, tenant_id, lmStart, lmEnd);

    const growthPct = prevMonthStats.total_seconds > 0
      ? Math.round((monthlyStats.total_seconds - prevMonthStats.total_seconds) / prevMonthStats.total_seconds * 100)
      : null;

    // --- バッジ判定（ルールベース 5種）---
    const badges = [];

    // 🔥 連続参加: 4週連続でプレイあり
    const weekChecks = [];
    for (let i = 0; i < 4; i++) {
      const wStart = new Date(now); wStart.setDate(wStart.getDate() - 7 * (i + 1));
      const wEnd = new Date(now); wEnd.setDate(wEnd.getDate() - 7 * i);
      const cnt = db.prepare(
        'SELECT COUNT(*) as c FROM play_sessions WHERE student_id = ? AND tenant_id = ? AND started_at >= ? AND started_at < ?'
      ).get(student_id, tenant_id, wStart.toISOString().split('T')[0], wEnd.toISOString().split('T')[0]);
      weekChecks.push(cnt.c > 0);
    }
    if (weekChecks.every(Boolean)) badges.push('🔥 連続参加');

    // 📈 ぐんぐん成長: 正答率が先月比+10%以上
    if (monthlyStats.avg_accuracy && prevMonthStats.avg_accuracy &&
        monthlyStats.avg_accuracy - prevMonthStats.avg_accuracy >= 10) {
      badges.push('📈 ぐんぐん成長');
    }

    // 🏆 チャレンジャー: 今月新しいゲームに2つ以上挑戦
    const newGames = db.prepare(`
      SELECT COUNT(DISTINCT game_id) as c FROM play_sessions
      WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
      AND game_id NOT IN (
        SELECT DISTINCT game_id FROM play_sessions
        WHERE student_id = ? AND tenant_id = ? AND started_at < ?
      )
    `).get(student_id, tenant_id, thisMonthStart, student_id, tenant_id, thisMonthStart);
    if (newGames.c >= 2) badges.push('🏆 チャレンジャー');

    // 💪 粘り強さ: 同じゲームを5回以上プレイ
    const persistence = db.prepare(`
      SELECT game_id, COUNT(*) as c FROM play_sessions
      WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
      GROUP BY game_id HAVING c >= 5
    `).all(student_id, tenant_id, thisMonthStart);
    if (persistence.length > 0) badges.push('💪 粘り強さ');

    // ⭐ マスター: 正答率90%以上のゲームが1つ以上
    const mastery = db.prepare(`
      SELECT game_id FROM play_sessions
      WHERE student_id = ? AND tenant_id = ? AND started_at >= ? AND total_count > 0
      GROUP BY game_id HAVING AVG(correct_count * 100.0 / total_count) >= 90
    `).all(student_id, tenant_id, thisMonthStart);
    if (mastery.length > 0) badges.push('⭐ マスター');

    // --- 週別データ（直近8週間）---
    const weekly = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date(now); wStart.setDate(wStart.getDate() - 7 * (i + 1));
      const wEnd = new Date(now); wEnd.setDate(wEnd.getDate() - 7 * i);
      const wsStr = wStart.toISOString().split('T')[0];
      const weStr = wEnd.toISOString().split('T')[0];
      const wStats = db.prepare(`
        SELECT
          COALESCE(SUM(duration_seconds), 0) as seconds,
          ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) as accuracy,
          COUNT(*) as plays
        FROM play_sessions
        WHERE student_id = ? AND tenant_id = ? AND started_at >= ? AND started_at < ?
      `).get(student_id, tenant_id, wsStr, weStr);
      weekly.push({
        week: `${wStart.getMonth() + 1}/${wStart.getDate()}〜`,
        seconds: wStats.seconds,
        accuracy: wStats.accuracy,
        plays: wStats.plays
      });
    }

    // --- ゲーム別データ ---
    const byGame = db.prepare(`
      SELECT
        g.id as game_id, g.name, g.emoji,
        COUNT(*) as plays,
        COALESCE(SUM(ps.duration_seconds), 0) as seconds,
        ROUND(AVG(CASE WHEN ps.total_count > 0 THEN ps.correct_count * 100.0 / ps.total_count END), 1) as avg_accuracy,
        MAX(ps.score) as max_score
      FROM play_sessions ps
      JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ? AND ps.tenant_id = ? AND ps.started_at >= ?
      GROUP BY g.id ORDER BY seconds DESC
    `).all(student_id, tenant_id, thisMonthStart);

    const byGameWithTrend = byGame.map(g => {
      const trend = db.prepare(`
        SELECT ROUND(correct_count * 100.0 / total_count, 0) as acc
        FROM play_sessions
        WHERE student_id = ? AND game_id = ? AND tenant_id = ? AND total_count > 0
        ORDER BY started_at DESC LIMIT 5
      `).all(student_id, g.game_id, tenant_id).reverse().map(r => r.acc);

      let comment = '';
      if (trend.length >= 2 && trend[trend.length - 1] > trend[0]) {
        comment = `${g.plays}回挑戦して正答率が${Math.round(trend[0])}%→${Math.round(trend[trend.length - 1])}%に向上！`;
      } else if (g.plays === 1) {
        comment = '初挑戦！これからが楽しみです';
      } else if (g.avg_accuracy >= 90) {
        comment = `正答率${g.avg_accuracy}%のマスターレベル！`;
      } else {
        comment = `${g.plays}回プレイ中。着実に取り組んでいます`;
      }

      return { ...g, accuracy_trend: trend, comment };
    });

    // --- 先生コメント ---
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const teacherComment = db.prepare(
      'SELECT comment FROM teacher_comments WHERE student_id = ? AND tenant_id = ? AND month = ?'
    ).get(student_id, tenant_id, currentMonth);

    // --- AI生成コメント（キャッシュ確認）---
    const today = now.toISOString().split('T')[0];
    const aiCache = db.prepare(
      'SELECT * FROM ai_comments WHERE student_id = ? AND tenant_id = ? AND date = ?'
    ).get(student_id, tenant_id, today);

    // --- おうちヒント（ルールベース）---
    const homeHints = generateHomeHints(byGameWithTrend);

    // --- レスポンス ---
    res.json({
      student: {
        name: student.name,
        days_since_join: daysSinceJoin ? daysSinceJoin.days : 0
      },
      monthly: {
        total_seconds: monthlyStats.total_seconds,
        total_plays: monthlyStats.total_plays,
        avg_accuracy: monthlyStats.avg_accuracy,
        max_score: monthlyStats.max_score,
        prev_month_seconds: prevMonthStats.total_seconds,
        growth_pct: growthPct
      },
      badges,
      weekly,
      byGame: byGameWithTrend,
      teacherComment: teacherComment ? teacherComment.comment : null,
      homeHints,
      aiComment: aiCache ? {
        highlight: aiCache.highlight,
        comment: aiCache.comment,
        home_hints: aiCache.home_hints ? JSON.parse(aiCache.home_hints) : []
} : null,
      scheduledComments: (() => {
        const today = new Date().toISOString().split('T')[0];
        return db.prepare(
          `SELECT type, highlight, comment, home_hints FROM ai_comments
           WHERE student_id = ? AND tenant_id = ? AND date = ?
           AND type IN ('morning', 'evening')
           ORDER BY created_at DESC`
        ).all(student_id, tenant_id, today).map(r => ({
          ...r,
          home_hints: r.home_hints ? JSON.parse(r.home_hints) : []
        }));
      })()    });
  } catch (err) {
    console.error('Parent dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// おうちヒント自動生成（ルールベース）
// ============================================================
function generateHomeHints(games) {
  const hints = [];
  const subjectHints = {
    geography: [
      'お子さんに「日本で一番大きい湖はどこ？」と聞いてみてください',
      '地図を広げて「行ってみたい都道府県」を一緒に選んでみてください',
      'ニュースで地名が出たら「どこにある県？」とクイズにしてみてください'
    ],
    math: [
      '料理の時に「これの半分は？3分の1は？」と聞くと、ゲームの知識とつながります',
      'おやつを分ける時に「3人で平等に分けるには？」と聞いてみてください',
      '買い物で「合計いくらになるかな？」と一緒に計算してみてください'
    ],
    science: [
      '散歩中に「この雲は何ていう雲？」と聞いてみてください',
      '料理中に「なぜ卵は加熱すると固まるの？」と聞いてみてください',
      '夜空を見上げて「あの星座は何？」と一緒に探してみてください'
    ],
    history: [
      'テレビで歴史ドラマを見た時に「この人知ってる？」と聞いてみてください',
      '旅行先の歴史スポットで「ここで何があったか知ってる？」と聞いてみてください'
    ],
    language: [
      '一緒に本を読んで「この言葉の意味は？」とクイズにしてみてください',
      'しりとりや言葉遊びで語彙力を楽しく伸ばせます'
    ],
    business: [
      'お店に行った時に「このお店はどうやって儲けてると思う？」と聞いてみてください',
      'おこづかいの使い方を一緒に考えてみてください'
    ]
  };

  for (const game of games) {
    try {
      if (game.metadata) {
        const meta = typeof game.metadata === 'string' ? JSON.parse(game.metadata) : game.metadata;
        if (meta.subject && subjectHints[meta.subject]) {
          const available = subjectHints[meta.subject];
          hints.push(available[Math.floor(Math.random() * available.length)]);
        }
      }
    } catch (e) { /* skip */ }
  }

  // ゲーム名・emojiからの推測フォールバック
  if (hints.length === 0) {
    for (const game of games) {
      const name = (game.name || '').toLowerCase();
      const emoji = game.emoji || '';
      if (name.includes('地理') || name.includes('県') || name.includes('都道府県') || name.includes('特産') || emoji === '🗾') {
        hints.push(subjectHints.geography[0]); break;
      } else if (name.includes('分数') || name.includes('算数') || name.includes('計算') || name.includes('暗算')) {
        hints.push(subjectHints.math[0]); break;
      } else if (name.includes('理科') || name.includes('星座') || name.includes('科学') || name.includes('元素') || name.includes('気候')) {
        hints.push(subjectHints.science[0]); break;
      } else if (name.includes('歴史') || name.includes('江戸') || name.includes('文明')) {
        hints.push(subjectHints.history[0]); break;
      }
    }
  }

  if (hints.length < 2) {
    hints.push('「今日TRAILで何やったの？」と聞いてみてください。お子さんの言葉で説明する力が育ちます');
  }

  return [...new Set(hints)].slice(0, 3);
}

// ============================================================
// AI自動コメント生成（Sonnet API）
// POST /api/parent/:token/ai-comment
// ============================================================
router.post('/parent/:token/ai-comment', async (req, res) => {
  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // トークン認証
    const tokenRow = db.prepare(
      "SELECT * FROM parent_tokens WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).get(req.params.token);
    if (!tokenRow) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { tenant_id, student_id } = tokenRow;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // キャッシュ確認（1日1回）
    const cached = db.prepare(
      'SELECT * FROM ai_comments WHERE student_id = ? AND tenant_id = ? AND date = ?'
    ).get(student_id, tenant_id, today);
    if (cached) {
      return res.json({
        highlight: cached.highlight,
        comment: cached.comment,
        home_hints: cached.home_hints ? JSON.parse(cached.home_hints) : [],
        cached: true
      });
    }

    // 生徒情報取得
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // 今月の統計
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthlyStats = db.prepare(`
      SELECT COUNT(*) as total_plays,
        COALESCE(SUM(duration_seconds), 0) as total_seconds,
        ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) as avg_accuracy
      FROM play_sessions WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
    `).get(student_id, tenant_id, thisMonthStart);

    // ゲーム別データ
    const byGame = db.prepare(`
      SELECT g.name, g.emoji, COUNT(*) as plays,
        COALESCE(SUM(ps.duration_seconds), 0) as seconds,
        ROUND(AVG(CASE WHEN ps.total_count > 0 THEN ps.correct_count * 100.0 / ps.total_count END), 1) as avg_accuracy
      FROM play_sessions ps JOIN games g ON ps.game_id = g.id
      WHERE ps.student_id = ? AND ps.tenant_id = ? AND ps.started_at >= ?
      GROUP BY g.id ORDER BY seconds DESC LIMIT 5
    `).all(student_id, tenant_id, thisMonthStart);

    // バッジ情報
    const badgeCount = db.prepare(
      'SELECT COUNT(*) as c FROM badges WHERE student_id = ? AND tenant_id = ?'
    ).get(student_id, tenant_id);

    // ALT（コイン）合計
    const coinTotal = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM coin_logs WHERE student_id = ?'
    ).get(student_id);

    // プロンプト構築
    const gameInfo = byGame.length > 0
      ? byGame.map(g => `${g.emoji}${g.name}: ${g.plays}回プレイ, 正答率${g.avg_accuracy || '—'}%`).join('\n')
      : 'まだゲームのプレイ記録がありません';

    const totalMin = Math.round((monthlyStats.total_seconds || 0) / 60);

    const prompt = `あなたは探究教室TRAILの先生AIです。以下の生徒データから、保護者向けの温かく具体的なコメントを生成してください。

【生徒情報】
名前: ${student.name}
今月のプレイ回数: ${monthlyStats.total_plays || 0}回
今月の学習時間: ${totalMin}分
平均正答率: ${monthlyStats.avg_accuracy || '—'}%
獲得ALT（ポイント）: ${coinTotal.total || 0}
バッジ数: ${badgeCount.c || 0}

【今月プレイしたゲーム】
${gameInfo}

以下のJSON形式で回答してください。日本語で、保護者が読んで嬉しくなる内容にしてください:
{
  "highlight": "今月のハイライト（15文字以内、例: 地理マスターに成長中！）",
  "comment": "保護者向けコメント（80文字以内。具体的なゲーム名や数字を使い、お子さんの頑張りを褒める内容。データがない場合は「これから一緒に成長していきましょう」的な温かいメッセージ）",
  "home_hints": ["おうちでできるヒント1（30文字以内）", "おうちでできるヒント2（30文字以内）"]
}

JSONのみ出力してください。マークダウンのバッククォートは不要です。`;

    // Anthropic API呼び出し
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(502).json({ error: 'AI API error: ' + apiRes.status });
    }

    const apiData = await apiRes.json();
    const rawText = (apiData.content || []).map(c => c.text || '').join('');

    // JSON解析
    let aiResult;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      aiResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('AI response parse error:', rawText);
      aiResult = {
        highlight: '探究の旅が始まっています！',
        comment: `${student.name}さんはTRAILで新しいことに挑戦中です。これからの成長が楽しみですね！`,
        home_hints: ['「今日TRAILで何やったの？」と聞いてみてください', 'ゲームの話を一緒に楽しんでください']
      };
    }

    // キャッシュ保存
    db.prepare(
      'INSERT INTO ai_comments (tenant_id, student_id, date, highlight, comment, home_hints) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(tenant_id, student_id, today, aiResult.highlight, aiResult.comment, JSON.stringify(aiResult.home_hints || []));

    res.json({
      highlight: aiResult.highlight,
      comment: aiResult.comment,
      home_hints: aiResult.home_hints || [],
      cached: false
    });

  } catch (err) {
    console.error('AI comment generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// F4: 定時AI自動配信 — parent.js に追加するコード
// 既存の module.exports = router; の直前に貼り付ける
// ============================================================

// ============================================================
// cronエンドポイント共通: 生徒データ収集 & AI呼び出し
// ============================================================
async function generateScheduledComment(tenantId, studentId, type, ANTHROPIC_API_KEY) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 既存キャッシュ確認（同日・同typeなら再生成しない）
  const cached = db.prepare(
    'SELECT * FROM ai_comments WHERE student_id = ? AND tenant_id = ? AND date = ? AND type = ?'
  ).get(studentId, tenantId, today, type);
  if (cached) return { skipped: true };

  // 生徒情報
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) return { error: 'student not found' };

  // 今月統計
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthlyStats = db.prepare(`
    SELECT COUNT(*) as total_plays,
      COALESCE(SUM(duration_seconds), 0) as total_seconds,
      ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) as avg_accuracy
    FROM play_sessions WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
  `).get(studentId, tenantId, thisMonthStart);

  // 今日のデータ（夜用）
  const todayStats = db.prepare(`
    SELECT COUNT(*) as plays,
      COALESCE(SUM(duration_seconds), 0) as seconds,
      ROUND(AVG(CASE WHEN total_count > 0 THEN correct_count * 100.0 / total_count END), 1) as accuracy
    FROM play_sessions WHERE student_id = ? AND tenant_id = ? AND date(started_at) = ?
  `).get(studentId, tenantId, today);

  // ゲーム別
  const byGame = db.prepare(`
    SELECT g.name, g.emoji, COUNT(*) as plays,
      ROUND(AVG(CASE WHEN ps.total_count > 0 THEN ps.correct_count * 100.0 / ps.total_count END), 1) as avg_accuracy
    FROM play_sessions ps JOIN games g ON ps.game_id = g.id
    WHERE ps.student_id = ? AND ps.tenant_id = ? AND ps.started_at >= ?
    GROUP BY g.id ORDER BY plays DESC LIMIT 5
  `).all(studentId, tenantId, thisMonthStart);

  const gameInfo = byGame.length > 0
    ? byGame.map(g => `${g.emoji}${g.name}: ${g.plays}回プレイ, 正答率${g.avg_accuracy || '-'}%`).join(', ')
    : 'まだゲームのプレイ記録がありません';

  const totalMin = Math.round((monthlyStats.total_seconds || 0) / 60);
  const todayMin = Math.round((todayStats.seconds || 0) / 60);

  // プロンプト分岐
  let prompt;
  if (type === 'morning') {
    prompt = `あなたは探究教室TRAILの先生AIです。以下の生徒の最近のプレイデータから、今日おすすめの学習内容を保護者向けに提案してください。

【生徒情報】
名前: ${student.name}
今月のプレイ回数: ${monthlyStats.total_plays || 0}回
今月の学習時間: ${totalMin}分
平均正答率: ${monthlyStats.avg_accuracy || '-'}%
今月プレイしたゲーム: ${gameInfo}

以下のJSON形式のみで回答してください。日本語で、保護者が読んで嬉しくなる内容にしてください:
{
  "type": "morning",
  "highlight": "🌅 今日のおすすめ（15文字以内）",
  "comment": "今日の学習提案（80文字以内。具体的なゲーム名を使い、お子さんの頑張りを伸ばす提案）",
  "home_hints": ["今日家でできること（30文字以内）", "もう一つのヒント（30文字以内）"]
}

JSONのみ出力してください。マークダウンのバッククォートは不要です。`;
  } else {
    prompt = `あなたは探究教室TRAILの先生AIです。以下の生徒の今日のプレイデータから、1日の振り返りと明日への提案を保護者向けに作ってください。

【生徒情報】
名前: ${student.name}
今日のプレイ回数: ${todayStats.plays || 0}回
今日の学習時間: ${todayMin}分
今日の正答率: ${todayStats.accuracy || '-'}%
今月プレイしたゲーム: ${gameInfo}

以下のJSON形式のみで回答してください。日本語で、保護者が読んで嬉しくなる内容にしてください:
{
  "type": "evening",
  "highlight": "🌙 今日のふりかえり（15文字以内）",
  "comment": "今日の振り返り＋明日への一言（80文字以内。今日の頑張りを具体的に褒め、明日への期待を込める）",
  "home_hints": ["今夜おうちでできること（30文字以内）", "明日に向けた一言（30文字以内）"]
}

JSONのみ出力してください。マークダウンのバッククォートは不要です。`;
  }

  // Anthropic API呼び出し
  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!apiRes.ok) {
    const errText = await apiRes.text();
    throw new Error(`Anthropic API error: ${apiRes.status} ${errText}`);
  }

  const apiData = await apiRes.json();
  const rawText = (apiData.content || []).map(c => c.text || '').join('');

  let aiResult;
  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    aiResult = JSON.parse(cleaned);
  } catch (parseErr) {
    // フォールバック
    aiResult = {
      type,
      highlight: type === 'morning' ? '🌅 今日も頑張ろう！' : '🌙 よく頑張りました！',
      comment: `${student.name}さん、${type === 'morning' ? '今日も楽しく学びましょう！' : '今日もよく頑張りました！'}`,
      home_hints: ['「今日TRAILで何やったの？」と聞いてみてください', 'ゲームの話を一緒に楽しんでください']
    };
  }

  // DB保存（type カラム付き）
  db.prepare(
'INSERT OR REPLACE INTO ai_comments (tenant_id, student_id, date, type, highlight, comment, home_hints) VALUES (?, ?, ?, ?, ?, ?, ?)' 
 ).run(tenantId, studentId, today, type, aiResult.highlight, aiResult.comment, JSON.stringify(aiResult.home_hints || []));
  return { ok: true, studentId, name: student.name };
}

// ============================================================
// POST /api/cron/morning-ai?secret=CRON_SECRET
// ============================================================
router.post('/cron/morning-ai', async (req, res) => {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // アクティブ全生徒を取得
  const students = db.prepare(
'SELECT s.id, s.tenant_id FROM students s INNER JOIN tenants t ON s.tenant_id = t.id'  ).all();

  const results = [];
  for (const s of students) {
    try {
      const r = await generateScheduledComment(s.tenant_id, s.id, 'morning', ANTHROPIC_API_KEY);
      results.push({ studentId: s.id, ...r });
    } catch (e) {
      results.push({ studentId: s.id, error: e.message });
    }
  }

  console.log(`[CRON] morning-ai: ${students.length}人処理`, results.filter(r => r.ok).length + '件生成');
  res.json({ type: 'morning', total: students.length, results });
});

// ============================================================
// POST /api/cron/evening-ai?secret=CRON_SECRET
// ============================================================
router.post('/cron/evening-ai', async (req, res) => {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const students = db.prepare(
'SELECT s.id, s.tenant_id FROM students s INNER JOIN tenants t ON s.tenant_id = t.id'  ).all();

  const results = [];
  for (const s of students) {
    try {
      const r = await generateScheduledComment(s.tenant_id, s.id, 'evening', ANTHROPIC_API_KEY);
      results.push({ studentId: s.id, ...r });
    } catch (e) {
      results.push({ studentId: s.id, error: e.message });
    }
  }

  console.log(`[CRON] evening-ai: ${students.length}人処理`, results.filter(r => r.ok).length + '件生成');
  res.json({ type: 'evening', total: students.length, results });
});
module.exports = router;