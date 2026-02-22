/**
 * Auth Routes - 認証 API
 * POST /api/auth/admin/login   - 管理者ログイン
 * POST /api/auth/student/login - 生徒ログイン
 * POST /api/auth/register      - テナント新規登録
 */
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = Router();

// ═══ テナント新規登録（サインアップ） ═══
router.post('/register', (req, res) => {
  const { tenantName, slug, email, password, displayName } = req.body;
  if (!tenantName || !slug || !email || !password) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'スラッグは英小文字・数字・ハイフンのみ使用できます' });
  }
  const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
  if (existing) {
    return res.status(409).json({ error: 'このスラッグは既に使用されています' });
  }
  const existingEmail = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
  if (existingEmail) {
    return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
  }

  const tenantId = uuidv4();
  const userId = uuidv4();
  const hash = bcrypt.hashSync(password, 12);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO tenants (id, name, slug, plan) VALUES (?, ?, ?, 'free')
    `).run(tenantId, tenantName, slug);

    db.prepare(`
      INSERT INTO admin_users (id, tenant_id, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?, 'owner')
    `).run(userId, tenantId, email, hash, displayName || tenantName);

    // デフォルトクラス作成
    const insertClass = db.prepare('INSERT INTO classes (tenant_id, name) VALUES (?, ?)');
    ['クラスA', 'クラスB', 'クラスC'].forEach(c => insertClass.run(tenantId, c));
  })();

  const token = signToken({ userId, tenantId, email, role: 'owner', displayName: displayName || tenantName });
  res.status(201).json({ token, tenant: { id: tenantId, name: tenantName, slug, plan: 'free' } });
});

// ═══ 管理者ログイン ═══
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
  }
  const user = db.prepare(`
    SELECT au.*, t.slug as tenant_slug, t.name as tenant_name, t.plan
    FROM admin_users au JOIN tenants t ON au.tenant_id = t.id
    WHERE au.email = ?
  `).get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
  }

  const token = signToken({
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    },
    tenant: {
      id: user.tenant_id,
      name: user.tenant_name,
      slug: user.tenant_slug,
      plan: user.plan,
    },
  });
});

// ═══ 生徒ログイン ═══
router.post('/student/login', (req, res) => {
  const { tenantSlug, className, studentName } = req.body;
  if (!tenantSlug || !className || !studentName) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(tenantSlug);
  if (!tenant) {
    return res.status(404).json({ error: 'テナントが見つかりません' });
  }

  const cls = db.prepare('SELECT * FROM classes WHERE tenant_id = ? AND name = ?').get(tenant.id, className);
  if (!cls) {
    return res.status(404).json({ error: 'クラスが見つかりません' });
  }

  const student = db.prepare('SELECT * FROM students WHERE tenant_id = ? AND name = ? AND class_id = ?').get(tenant.id, studentName, cls.id);
  if (!student) {
    return res.status(404).json({ error: '生徒が見つかりません。先生に登録を依頼してください' });
  }

  // ログイン記録
  db.prepare('INSERT INTO login_logs (tenant_id, student_id) VALUES (?, ?)').run(tenant.id, student.id);
  db.prepare(`INSERT INTO activity_logs (tenant_id, type, actor, detail) VALUES (?, 'login', ?, ?)`).run(
    tenant.id, studentName, `${className} - ${studentName} がログインしました`
  );

  const expiresIn = `${process.env.STUDENT_SESSION_EXPIRY_HOURS || 2}h`;
  const token = signToken({
    studentId: student.id,
    tenantId: tenant.id,
    name: studentName,
    className,
    classId: cls.id,
    role: 'student',
  }, expiresIn);

  res.json({
    token,
    student: { id: student.id, name: studentName, className },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  });
});

module.exports = router;
