// ═══════════════════════════════════════════════════════════════
// TRAIL Game Pro 3 — Google Apps Script (Server-side)
// ═══════════════════════════════════════════════════════════════
//
// デプロイ手順:
// 1. Google Apps Script (https://script.google.com) で新規プロジェクト作成
// 2. このコードを貼り付け
// 3. 初回セットアップ: setupAdminPassword() を実行してパスワードを設定
// 4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//    - 実行ユーザー: 自分
//    - アクセスできるユーザー: 全員
// 5. 生成された URL を index.html の GAS_URL に設定
//
// ═══════════════════════════════════════════════════════════════

// ──── 設定 ────
const SPREADSHEET_ID = ''; // ★ スプレッドシートIDをここに設定
const ADMIN_TOKEN_EXPIRY_MS = 3600000; // トークン有効期限: 1時間
const RATE_LIMIT_WINDOW_MS = 60000;    // レート制限ウィンドウ: 60秒
const RATE_LIMIT_MAX_ATTEMPTS = 5;     // 最大ログイン試行回数

// ──── シート名 ────
const SHEETS = {
  PLAYERS: 'Players',
  GAMES: 'Games',
  COIN_LOG: 'CoinLog',
  BADGES: 'Badges',
  RANKINGS: 'Rankings',
  CLASSES: 'Classes',
  LOGIN_LOG: 'LoginLog',
  GAME_PLAY_LOG: 'GamePlayLog',
};

// ═══════════════════════════════════════════════════════════════
// 初期セットアップ（手動で1回だけ実行）
// ═══════════════════════════════════════════════════════════════

/**
 * 管理者パスワードを設定する。
 * Apps Script エディタで直接実行してください。
 * パスワードはSHA-256ハッシュとしてPropertiesServiceに保存されます。
 */
function setupAdminPassword() {
  const password = 'trail2024'; // ★ ここを変更してから実行
  const hash = hashPassword(password);
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASS_HASH', hash);
  Logger.log('Admin password hash saved: ' + hash);
  Logger.log('Setup complete. Change the password in this function before deploying.');
}

/**
 * スプレッドシートに必要なシートを作成する。
 * 初回のみ実行。
 */
function setupSheets() {
  const ss = getSpreadsheet();
  const existing = ss.getSheets().map(s => s.getName());

  const sheetsConfig = [
    { name: SHEETS.PLAYERS,       headers: ['name', 'className', 'createdAt'] },
    { name: SHEETS.GAMES,         headers: ['id', 'name', 'emoji', 'url', 'category', 'createdAt'] },
    { name: SHEETS.COIN_LOG,      headers: ['id', 'player', 'gameId', 'gameName', 'amount', 'date'] },
    { name: SHEETS.BADGES,        headers: ['player', 'count'] },
    { name: SHEETS.RANKINGS,      headers: ['gameId', 'gameName', 'player', 'score', 'scoreLabel', 'date'] },
    { name: SHEETS.CLASSES,       headers: ['className'] },
    { name: SHEETS.LOGIN_LOG,     headers: ['user', 'className', 'loginTime', 'loginTs', 'logoutTime', 'logoutTs', 'duration'] },
    { name: SHEETS.GAME_PLAY_LOG, headers: ['user', 'gameId', 'gameName', 'startTs', 'duration', 'date'] },
  ];

  sheetsConfig.forEach(cfg => {
    if (!existing.includes(cfg.name)) {
      const sheet = ss.insertSheet(cfg.name);
      sheet.appendRow(cfg.headers);
      Logger.log('Created sheet: ' + cfg.name);
    }
  });
  Logger.log('Sheet setup complete.');
}

// ═══════════════════════════════════════════════════════════════
// セキュリティ: パスワードハッシュ
// ═══════════════════════════════════════════════════════════════

function hashPassword(password) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return rawHash.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

// ═══════════════════════════════════════════════════════════════
// セキュリティ: トークン管理
// ═══════════════════════════════════════════════════════════════

function generateToken() {
  const bytes = Utilities.getUuid();
  return bytes + '-' + Date.now();
}

function saveToken(token) {
  const cache = CacheService.getScriptCache();
  // トークンを保存（有効期限: 1時間 = 3600秒）
  cache.put('admin_token_' + token, JSON.stringify({
    createdAt: Date.now(),
    valid: true,
  }), 3600);
}

function validateToken(token) {
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  const data = cache.get('admin_token_' + token);
  if (!data) return false;
  try {
    const parsed = JSON.parse(data);
    if (!parsed.valid) return false;
    if (Date.now() - parsed.createdAt > ADMIN_TOKEN_EXPIRY_MS) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function revokeToken(token) {
  if (!token) return;
  const cache = CacheService.getScriptCache();
  cache.remove('admin_token_' + token);
}

// ═══════════════════════════════════════════════════════════════
// セキュリティ: レート制限
// ═══════════════════════════════════════════════════════════════

function checkRateLimit(ip) {
  const cache = CacheService.getScriptCache();
  const key = 'rate_limit_' + (ip || 'unknown');
  const data = cache.get(key);

  if (!data) {
    cache.put(key, JSON.stringify({ attempts: 1, firstAttempt: Date.now() }), 120);
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 };
  }

  try {
    const parsed = JSON.parse(data);
    // ウィンドウが期限切れならリセット
    if (Date.now() - parsed.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      cache.put(key, JSON.stringify({ attempts: 1, firstAttempt: Date.now() }), 120);
      return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 };
    }
    // 上限チェック
    if (parsed.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - parsed.firstAttempt)) / 1000);
      return { allowed: false, remaining: 0, waitSeconds };
    }
    parsed.attempts++;
    cache.put(key, JSON.stringify(parsed), 120);
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - parsed.attempts };
  } catch (e) {
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 };
  }
}

// ═══════════════════════════════════════════════════════════════
// スプレッドシート操作
// ═══════════════════════════════════════════════════════════════

function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみ
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ═══════════════════════════════════════════════════════════════
// GET ハンドラ（読み取り専用 — 認証不要）
// ═══════════════════════════════════════════════════════════════

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  let result;

  try {
    switch (action) {
      case 'all':
        result = handleGetAll();
        break;
      case 'analyticsLogins':
        result = handleGetAnalyticsLogins();
        break;
      case 'analyticsGameplay':
        result = handleGetAnalyticsGameplay();
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
// POST ハンドラ（書き込み — 管理者操作は認証必須）
// ═══════════════════════════════════════════════════════════════

// 管理者認証が必要なアクション
const ADMIN_ACTIONS = [
  'addCoin', 'addPlayer', 'addBadge', 'addGame', 'deleteGame',
  'deleteRankingEntry', 'updateGameUrl', 'addClass', 'deleteClass',
];

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: 'Invalid JSON' });
  }

  const action = body.action || '';
  let result;

  try {
    // ──── 管理者認証 ────
    if (action === 'adminLogin') {
      result = handleAdminLogin(body);
      return jsonResponse(result);
    }
    if (action === 'adminLogout') {
      revokeToken(body.token);
      return jsonResponse({ ok: true });
    }

    // ──── 管理者操作: トークン検証 ────
    if (ADMIN_ACTIONS.includes(action)) {
      if (!validateToken(body.token)) {
        return jsonResponse({ error: 'AUTH_REQUIRED', message: '認証が必要です。再ログインしてください。' });
      }
    }

    // ──── アクション振り分け ────
    switch (action) {
      // --- 管理者操作 ---
      case 'addCoin':        result = handleAddCoin(body); break;
      case 'addPlayer':      result = handleAddPlayer(body); break;
      case 'addBadge':       result = handleAddBadge(body); break;
      case 'addGame':        result = handleAddGame(body); break;
      case 'deleteGame':     result = handleDeleteGame(body); break;
      case 'deleteRankingEntry': result = handleDeleteRankingEntry(body); break;
      case 'updateGameUrl':  result = handleUpdateGameUrl(body); break;
      case 'addClass':       result = handleAddClass(body); break;
      case 'deleteClass':    result = handleDeleteClass(body); break;

      // --- プレイヤー操作（認証不要） ---
      case 'logLogin':       result = handleLogLogin(body); break;
      case 'logLogout':      result = handleLogLogout(body); break;
      case 'logGamePlay':    result = handleLogGamePlay(body); break;
      case 'saveRanking':    result = handleSaveRanking(body); break;

      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return jsonResponse(result);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
// 管理者ログイン
// ═══════════════════════════════════════════════════════════════

function handleAdminLogin(body) {
  const password = body.password || '';

  // レート制限チェック（IPベースが取れないのでグローバルキーを使用）
  const rateCheck = checkRateLimit('admin_login');
  if (!rateCheck.allowed) {
    return {
      error: 'RATE_LIMITED',
      message: `ログイン試行回数の上限に達しました。${rateCheck.waitSeconds}秒後にお試しください。`,
      waitSeconds: rateCheck.waitSeconds,
    };
  }

  // パスワード検証
  const storedHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASS_HASH');
  if (!storedHash) {
    return { error: 'NOT_CONFIGURED', message: '管理者パスワードが未設定です。setupAdminPassword()を実行してください。' };
  }

  const inputHash = hashPassword(password);
  if (inputHash !== storedHash) {
    return {
      error: 'INVALID_PASSWORD',
      message: 'パスワードが違います',
      remaining: rateCheck.remaining,
    };
  }

  // トークン発行
  const token = generateToken();
  saveToken(token);

  return {
    ok: true,
    token: token,
    expiresIn: ADMIN_TOKEN_EXPIRY_MS,
  };
}

// ═══════════════════════════════════════════════════════════════
// GET アクション実装
// ═══════════════════════════════════════════════════════════════

function handleGetAll() {
  const players = getSheetData(SHEETS.PLAYERS).map(p => ({
    name: p.name,
    className: p.className,
  }));

  const games = getSheetData(SHEETS.GAMES).map(g => ({
    id: Number(g.id),
    name: g.name,
    emoji: g.emoji,
    url: g.url || '',
    category: g.category || '',
  }));

  const coinLog = getSheetData(SHEETS.COIN_LOG).map(c => ({
    id: Number(c.id),
    player: c.player,
    gameId: Number(c.gameId),
    gameName: c.gameName,
    amount: Number(c.amount),
    date: c.date,
  }));

  const badgesData = getSheetData(SHEETS.BADGES);
  const badges = {};
  badgesData.forEach(b => { badges[b.player] = Number(b.count) || 0; });

  const rankings = getSheetData(SHEETS.RANKINGS).map(r => ({
    gameId: Number(r.gameId),
    gameName: r.gameName,
    player: r.player,
    score: Number(r.score),
    scoreLabel: r.scoreLabel || '',
    date: r.date,
  }));

  const classes = getSheetData(SHEETS.CLASSES).map(c => c.className);

  const loginLog = getSheetData(SHEETS.LOGIN_LOG).map(l => ({
    user: l.user,
    className: l.className,
    loginTime: l.loginTime,
    loginTs: Number(l.loginTs),
    logoutTime: l.logoutTime || null,
    logoutTs: l.logoutTs ? Number(l.logoutTs) : null,
  }));

  const gamePlayLog = getSheetData(SHEETS.GAME_PLAY_LOG).map(g => ({
    user: g.user,
    gameId: Number(g.gameId),
    gameName: g.gameName,
    startTs: Number(g.startTs),
    duration: Number(g.duration),
    date: g.date,
  }));

  return { players, games, coinLog, badges, rankings, classes, loginLog, gamePlayLog };
}

function handleGetAnalyticsLogins() {
  const loginLog = getSheetData(SHEETS.LOGIN_LOG).map(l => ({
    user: l.user,
    className: l.className,
    loginTime: l.loginTime,
    loginTs: Number(l.loginTs),
    logoutTime: l.logoutTime || null,
    logoutTs: l.logoutTs ? Number(l.logoutTs) : null,
    duration: l.duration || null,
  }));

  // 最新100件を返す
  loginLog.sort((a, b) => b.loginTs - a.loginTs);
  const recent = loginLog.slice(0, 100);
  const active = loginLog.filter(l => !l.logoutTs);

  return { active, recent };
}

function handleGetAnalyticsGameplay() {
  const sessions = getSheetData(SHEETS.GAME_PLAY_LOG).map(g => ({
    user: g.user,
    gameId: Number(g.gameId),
    gameName: g.gameName,
    startTs: Number(g.startTs),
    duration: Number(g.duration),
    date: g.date,
  }));

  // ゲーム別統計
  const gameMap = {};
  sessions.forEach(s => {
    if (!gameMap[s.gameId]) gameMap[s.gameId] = { gameId: s.gameId, gameName: s.gameName, players: {}, plays: 0, totalDuration: 0 };
    gameMap[s.gameId].players[s.user] = true;
    gameMap[s.gameId].plays++;
    gameMap[s.gameId].totalDuration += s.duration;
  });
  const gameStats = Object.values(gameMap).map(g => ({
    ...g, uniquePlayers: Object.keys(g.players).length, players: undefined,
  })).sort((a, b) => b.plays - a.plays);

  // プレイヤー別統計
  const playerMap = {};
  sessions.forEach(s => {
    if (!playerMap[s.user]) playerMap[s.user] = { user: s.user, games: {}, totalPlays: 0, totalDuration: 0 };
    if (!playerMap[s.user].games[s.gameId]) playerMap[s.user].games[s.gameId] = { gameId: s.gameId, gameName: s.gameName, plays: 0, duration: 0 };
    playerMap[s.user].games[s.gameId].plays++;
    playerMap[s.user].games[s.gameId].duration += s.duration;
    playerMap[s.user].totalPlays++;
    playerMap[s.user].totalDuration += s.duration;
  });
  const playerStats = Object.values(playerMap).sort((a, b) => b.totalPlays - a.totalPlays);

  return { gameStats, playerStats, sessions: sessions.slice(-30).reverse() };
}

// ═══════════════════════════════════════════════════════════════
// POST アクション実装（管理者操作 — トークン認証済み）
// ═══════════════════════════════════════════════════════════════

function handleAddCoin(body) {
  const sheet = getSheet(SHEETS.COIN_LOG);
  const id = Date.now();
  const now = new Date();
  const date = body.date || ((now.getMonth() + 1) + '/' + now.getDate() + ' ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'));
  sheet.appendRow([id, body.player, body.gameId, body.gameName, Number(body.amount), date]);
  return { ok: true, id };
}

function handleAddPlayer(body) {
  // 重複チェック
  const players = getSheetData(SHEETS.PLAYERS);
  if (players.some(p => p.name === body.name)) {
    return { error: 'すでに登録されています' };
  }
  const sheet = getSheet(SHEETS.PLAYERS);
  sheet.appendRow([body.name, body.className, new Date().toISOString()]);
  return { ok: true };
}

function handleAddBadge(body) {
  const sheet = getSheet(SHEETS.BADGES);
  const data = sheet.getDataRange().getValues();
  // 既存行を探す
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.player) {
      const newCount = (Number(data[i][1]) || 0) + 1;
      sheet.getRange(i + 1, 2).setValue(newCount);
      return { ok: true, count: newCount };
    }
  }
  // 新規行
  sheet.appendRow([body.player, 1]);
  return { ok: true, count: 1 };
}

function handleAddGame(body) {
  const sheet = getSheet(SHEETS.GAMES);
  const id = Date.now();
  sheet.appendRow([id, body.name, body.emoji || '', body.url || '', body.category || '', new Date().toISOString()]);
  return { ok: true, id };
}

function handleDeleteGame(body) {
  const sheet = getSheet(SHEETS.GAMES);
  const data = sheet.getDataRange().getValues();
  const gameId = Number(body.gameId);
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === gameId) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Game not found' };
}

function handleDeleteRankingEntry(body) {
  const sheet = getSheet(SHEETS.RANKINGS);
  const data = sheet.getDataRange().getValues();
  const gameId = Number(body.gameId);
  // 逆順で削除（行番号がずれないように）
  const rowsToDelete = [];
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === gameId && data[i][2] === body.player) {
      rowsToDelete.push(i + 1);
    }
  }
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }
  return { ok: true, deleted: rowsToDelete.length };
}

function handleUpdateGameUrl(body) {
  const sheet = getSheet(SHEETS.GAMES);
  const data = sheet.getDataRange().getValues();
  const gameId = Number(body.gameId);
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === gameId) {
      sheet.getRange(i + 1, 4).setValue(body.url || ''); // URL は4列目
      return { ok: true };
    }
  }
  return { error: 'Game not found' };
}

function handleAddClass(body) {
  const classes = getSheetData(SHEETS.CLASSES);
  if (classes.some(c => c.className === body.className)) {
    return { error: 'すでに存在します' };
  }
  const sheet = getSheet(SHEETS.CLASSES);
  sheet.appendRow([body.className]);
  return { ok: true };
}

function handleDeleteClass(body) {
  const sheet = getSheet(SHEETS.CLASSES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.className) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Class not found' };
}

// ═══════════════════════════════════════════════════════════════
// POST アクション実装（プレイヤー操作 — 認証不要）
// ═══════════════════════════════════════════════════════════════

function handleLogLogin(body) {
  const sheet = getSheet(SHEETS.LOGIN_LOG);
  sheet.appendRow([body.user, body.className, body.loginTime, Date.now(), '', '', '']);
  return { ok: true };
}

function handleLogLogout(body) {
  const sheet = getSheet(SHEETS.LOGIN_LOG);
  const data = sheet.getDataRange().getValues();
  // 最新のログインセッションを探す（logoutTsが空のもの）
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === body.user && !data[i][5]) {
      sheet.getRange(i + 1, 5).setValue(body.logoutTime);
      sheet.getRange(i + 1, 6).setValue(Date.now());
      sheet.getRange(i + 1, 7).setValue(body.duration || '');
      return { ok: true };
    }
  }
  return { ok: true }; // ログインセッションが見つからなくてもエラーにしない
}

function handleLogGamePlay(body) {
  const sheet = getSheet(SHEETS.GAME_PLAY_LOG);
  sheet.appendRow([body.user, body.gameId, body.gameName, body.startTs || Date.now(), body.duration, body.date]);
  return { ok: true };
}

function handleSaveRanking(body) {
  const sheet = getSheet(SHEETS.RANKINGS);
  const now = new Date();
  const date = body.date || ((now.getMonth() + 1) + '/' + now.getDate() + ' ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'));
  sheet.appendRow([body.gameId, body.gameName, body.player, Number(body.score), body.scoreLabel || '', date]);
  return { ok: true };
}
