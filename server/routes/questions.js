/**
 * Questions Routes - TRAIL Game Pro 3.2
 * 問題データベース CRUD API
 * Task 0-6
 *
 * GET    /api/questions              - 問題一覧（フィルタ対応）
 * GET    /api/questions/:id          - 問題1件取得
 * POST   /api/questions              - 問題登録（管理者）
 * PUT    /api/questions/:id          - 問題更新（管理者）
 * DELETE /api/questions/:id          - 問題削除（管理者）
 * POST   /api/questions/bulk         - 問題一括登録（管理者）
 */

'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = Router();

// ════════════════════════════════════════════════════════
//  GET /api/questions
//  問題一覧（ゲームID・教科・難易度・学年でフィルタ）
// ════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const { game_id, subject, difficulty, grade, limit, offset, active } = req.query;

    let sql = `
      SELECT
        id, game_id, category, subject, unit,
        difficulty, grade_min, grade_max,
        question_data, answer_data, explanation,
        tags, is_active, created_at, updated_at
      FROM questions
      WHERE 1=1
    `;
    const params = [];

    if (game_id)    { sql += ' AND game_id = ?';        params.push(game_id);            }
    if (subject)    { sql += ' AND subject = ?';        params.push(subject);            }
    if (difficulty) { sql += ' AND difficulty = ?';     params.push(parseInt(difficulty)); }
    if (grade)      { sql += ' AND grade_min <= ? AND grade_max >= ?';
                      params.push(parseInt(grade), parseInt(grade));                      }

    // デフォルトはアクティブな問題のみ
    const showActive = active === 'all' ? null : 1;
    if (showActive !== null) { sql += ' AND is_active = ?'; params.push(showActive); }

    sql += ' ORDER BY difficulty ASC, created_at DESC';
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit) || 100, parseInt(offset) || 0);

    const questions = db.prepare(sql).all(...params);

    // question_data / answer_data / tags はJSONパース
    const parsed = questions.map(q => parseQuestion(q));

    // 総件数（ページネーション用）
    const countSql = sql
      .replace(/SELECT[\s\S]+?FROM questions/, 'SELECT COUNT(*) AS cnt FROM questions')
      .replace(/ORDER BY[\s\S]+$/, '');
    const countParams = params.slice(0, -2); // LIMIT/OFFSETを除く
    const total = db.prepare(countSql).get(...countParams)?.cnt ?? 0;

    res.json({ total, questions: parsed });

  } catch (err) {
    console.error('問題一覧取得エラー:', err);
    res.status(500).json({ error: '問題一覧の取得に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  GET /api/questions/:id
//  問題1件取得
// ════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: '問題が見つかりません' });
    res.json(parseQuestion(row));
  } catch (err) {
    console.error('問題取得エラー:', err);
    res.status(500).json({ error: '問題の取得に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  POST /api/questions
//  問題登録（管理者のみ）
// ════════════════════════════════════════════════════════
router.post('/', requireAdmin, (req, res) => {
  try {
    const err = validateQuestion(req.body);
    if (err) return res.status(400).json({ error: err });

    const id = req.body.id || uuidv4();
    const {
      game_id, category, subject, unit,
      difficulty = 3, grade_min = 4, grade_max = 6,
      question_data, answer_data, explanation,
      tags, is_active = 1,
    } = req.body;

    db.prepare(`
      INSERT INTO questions
        (id, game_id, category, subject, unit,
         difficulty, grade_min, grade_max,
         question_data, answer_data, explanation,
         tags, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, game_id, category || null, subject, unit || null,
      difficulty, grade_min, grade_max,
      JSON.stringify(question_data),
      JSON.stringify(answer_data),
      explanation || null,
      tags ? JSON.stringify(tags) : null,
      is_active ? 1 : 0,
    );

    const created = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    res.status(201).json(parseQuestion(created));

  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'この問題IDは既に存在します' });
    }
    console.error('問題登録エラー:', err);
    res.status(500).json({ error: '問題の登録に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  PUT /api/questions/:id
//  問題更新（管理者のみ）
// ════════════════════════════════════════════════════════
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '問題が見つかりません' });

    const {
      game_id, category, subject, unit,
      difficulty, grade_min, grade_max,
      question_data, answer_data, explanation,
      tags, is_active,
    } = req.body;

    // 部分更新対応：現在値を取得してマージ
    const current = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);

    db.prepare(`
      UPDATE questions SET
        game_id       = ?,
        category      = ?,
        subject       = ?,
        unit          = ?,
        difficulty    = ?,
        grade_min     = ?,
        grade_max     = ?,
        question_data = ?,
        answer_data   = ?,
        explanation   = ?,
        tags          = ?,
        is_active     = ?,
        updated_at    = datetime('now')
      WHERE id = ?
    `).run(
      game_id       ?? current.game_id,
      category      ?? current.category,
      subject       ?? current.subject,
      unit          ?? current.unit,
      difficulty    ?? current.difficulty,
      grade_min     ?? current.grade_min,
      grade_max     ?? current.grade_max,
      question_data ? JSON.stringify(question_data) : current.question_data,
      answer_data   ? JSON.stringify(answer_data)   : current.answer_data,
      explanation   ?? current.explanation,
      tags          ? JSON.stringify(tags)           : current.tags,
      is_active     !== undefined ? (is_active ? 1 : 0) : current.is_active,
      req.params.id,
    );

    const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    res.json(parseQuestion(updated));

  } catch (err) {
    console.error('問題更新エラー:', err);
    res.status(500).json({ error: '問題の更新に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  DELETE /api/questions/:id
//  問題削除（管理者のみ）・論理削除（is_active=0）
// ════════════════════════════════════════════════════════
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '問題が見つかりません' });

    // 論理削除（データは残す）
    db.prepare(`
      UPDATE questions SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).run(req.params.id);

    res.json({ success: true, id: req.params.id });

  } catch (err) {
    console.error('問題削除エラー:', err);
    res.status(500).json({ error: '問題の削除に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  POST /api/questions/bulk
//  問題一括登録（管理者のみ）
//  AIで生成した問題データをまとめて投入する用途
// ════════════════════════════════════════════════════════
router.post('/bulk', requireAdmin, (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions 配列が必要です' });
    }
    if (questions.length > 200) {
      return res.status(400).json({ error: '一度に登録できるのは200問までです' });
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO questions
        (id, game_id, category, subject, unit,
         difficulty, grade_min, grade_max,
         question_data, answer_data, explanation,
         tags, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped  = 0;

    db.transaction(() => {
      for (const q of questions) {
        const validErr = validateQuestion(q);
        if (validErr) { skipped++; continue; }

        const id = q.id || uuidv4();
        const result = insert.run(
          id,
          q.game_id,
          q.category      || null,
          q.subject,
          q.unit          || null,
          q.difficulty    || 3,
          q.grade_min     || 4,
          q.grade_max     || 6,
          JSON.stringify(q.question_data),
          JSON.stringify(q.answer_data),
          q.explanation   || null,
          q.tags          ? JSON.stringify(q.tags) : null,
          q.is_active     !== undefined ? (q.is_active ? 1 : 0) : 1,
        );
        if (result.changes > 0) inserted++;
        else skipped++;
      }
    })();

    res.status(201).json({
      success:  true,
      inserted,
      skipped,
      total:    questions.length,
    });

  } catch (err) {
    console.error('問題一括登録エラー:', err);
    res.status(500).json({ error: '問題の一括登録に失敗しました' });
  }
});

// ─────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────

/** JSONカラムをパースして返す */
function parseQuestion(q) {
  return {
    ...q,
    question_data: tryParse(q.question_data),
    answer_data:   tryParse(q.answer_data),
    tags:          tryParse(q.tags),
    is_active:     q.is_active === 1,
  };
}

function tryParse(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

/** 必須項目バリデーション */
function validateQuestion(q) {
  if (!q.game_id)       return 'game_id は必須です';
  if (!q.subject)       return 'subject は必須です';
  if (!q.question_data) return 'question_data は必須です';
  if (!q.answer_data)   return 'answer_data は必須です';
  return null;
}

module.exports = router;