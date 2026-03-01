/**
 * Streaks Routes - TRAIL Game Pro 3.2
 * 連続プレイ日数 API
 * Task 0-4
 *
 * GET  /api/t/:tenantSlug/streaks/:studentId  - 生徒のストリーク情報取得
 * GET  /api/t/:tenantSlug/streaks             - テナント全生徒のストリーク一覧
 */

'use strict';

const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = Router();

// ════════════════════════════════════════════════════════
//  GET /:tenantSlug/streaks/:studentId
//  生徒のストリーク情報取得
// ════════════════════════════════════════════════════════
router.get('/:tenantSlug/streaks/:studentId', requireAuth, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });
    if (req.tenantId !== tenant.id) return res.status(403).json({ error: 'アクセス権がありません' });

    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: '無効な studentId です' });
    }

    const tenantId = tenant.id;

    // ストリーク情報
    const streak = db.prepare(`
      SELECT
        current_streak,
        max_streak,
        last_play_date,
        updated_at
      FROM streaks
      WHERE student_id = ? AND tenant_id = ?
    `).get(studentId, tenantId);

    // 今日JSTで連続中かどうか
    const jstDate   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today     = jstDate.toISOString().slice(0, 10);
    const yesterday = new Date(jstDate - 86400000).toISOString().slice(0, 10);

    const isAlive = streak
      ? streak.last_play_date === today || streak.last_play_date === yesterday
      : false;

    // 今月のプレイ回数（JST）
    const firstDay = `${jstDate.getUTCFullYear()}-${String(jstDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const monthRow = db.prepare(`
      SELECT COUNT(*) AS cnt
        FROM play_sessions
       WHERE student_id = ? AND tenant_id = ? AND started_at >= ?
    `).get(studentId, tenantId, firstDay);

    // 直近7日間のプレイ日カレンダー（今週の学習状況）
    const recentDays = db.prepare(`
      SELECT DISTINCT DATE(started_at) AS play_date
        FROM play_sessions
       WHERE student_id = ? AND tenant_id = ?
         AND started_at >= date(?, '-6 days')
       ORDER BY play_date ASC
    `).all(studentId, tenantId, today);

    // 7日分のカレンダーを生成（プレイ有無のフラグ付き）
    const calendar = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(jstDate - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      calendar.push({
        date:   dateStr,
        played: recentDays.some(r => r.play_date === dateStr),
      });
    }

    res.json({
      studentId,
      tenantId,
      streak: {
        current:       streak?.current_streak ?? 0,
        max:           streak?.max_streak     ?? 0,
        lastPlayDate:  streak?.last_play_date ?? null,
        isAlive,       // 昨日か今日プレイしていればストリーク継続中
      },
      monthly: {
        playCount: monthRow?.cnt ?? 0,
        firstDay,
      },
      calendar,
    });
  } catch (err) {
    console.error('ストリーク取得エラー:', err);
    res.status(500).json({ error: 'ストリーク情報の取得に失敗しました' });
  }
});

// ════════════════════════════════════════════════════════
//  GET /:tenantSlug/streaks
//  テナント全生徒のストリーク一覧（管理者向け）
//  ストリーク中の生徒を炎マークで強調するための一覧
// ════════════════════════════════════════════════════════
router.get('/:tenantSlug/streaks', requireAdmin, (req, res) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(req.params.tenantSlug);
    if (!tenant) return res.status(404).json({ error: 'テナントが見つかりません' });
    if (req.tenantId && req.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'アクセス権がありません' });
    }

    const tenantId = tenant.id;

    const jstDate   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today     = jstDate.toISOString().slice(0, 10);
    const yesterday = new Date(jstDate - 86400000).toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT
        s.id            AS student_id,
        s.name          AS student_name,
        c.name          AS class_name,
        st.current_streak,
        st.max_streak,
        st.last_play_date
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN streaks st ON st.student_id = s.id AND st.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
      ORDER BY COALESCE(st.current_streak, 0) DESC, s.name ASC
    `).all(tenantId);

    const result = rows.map(r => ({
      studentId:     r.student_id,
      studentName:   r.student_name,
      className:     r.class_name,
      currentStreak: r.current_streak ?? 0,
      maxStreak:     r.max_streak     ?? 0,
      lastPlayDate:  r.last_play_date ?? null,
      isAlive:       r.last_play_date === today || r.last_play_date === yesterday,
    }));

    res.json(result);
  } catch (err) {
    console.error('テナントストリーク取得エラー:', err);
    res.status(500).json({ error: 'ストリーク一覧の取得に失敗しました' });
  }
});

module.exports = router;