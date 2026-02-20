/**
 * TRAIL Game Pro SaaS - Main Server
 * マルチテナント教育ゲームポータル
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ Security Middleware ═══
app.use(helmet({
  contentSecurityPolicy: false, // フロントエンドのinline scriptsを許可
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ═══ Rate Limiting ═══
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらくしてからお試しください' },
});
app.use('/api/', limiter);

// ═══ Static Files ═══
app.use(express.static(path.join(__dirname, '../public')));

// ═══ API Routes ═══
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const coinRoutes = require('./routes/coins');
const badgeRoutes = require('./routes/badges');
const rankingRoutes = require('./routes/rankings');
const analyticsRoutes = require('./routes/analytics');
const tenantRoutes = require('./routes/tenants');

app.use('/api/auth', authRoutes);
app.use('/api/t', gameRoutes);
app.use('/api/t', studentRoutes);
app.use('/api/t', classRoutes);
app.use('/api/t', coinRoutes);
app.use('/api/t', badgeRoutes);
app.use('/api/t', rankingRoutes);
app.use('/api/t', analyticsRoutes);
app.use('/api/t', tenantRoutes);
app.get('/api/plans', tenantRoutes);

// ═══ Health Check ═══
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '4.0.0', timestamp: new Date().toISOString() });
});

// ═══ SPA Fallback ═══
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══ Error Handler ═══
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// ═══ Start Server ═══
app.listen(PORT, () => {
  console.log(`TRAIL Game Pro SaaS server running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  URL: http://localhost:${PORT}`);
});

module.exports = app;
