// ═══════════════════════════════════════════════════════════
// 🪙 TRAIL Game Pro 3 - スプレッドシートAPI
// ═══════════════════════════════════════════════════════════
//
// 【セットアップ手順】
// 1. Google スプレッドシートを新規作成
// 2. 「拡張機能」→「Apps Script」を開く
// 3. このコードを全文コピペ
// 4. SPREADSHEET_ID を自分のスプレッドシートIDに変更
// 5. initSheets() を一度実行（シートが自動作成される）
// 6. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//    - 実行するユーザー: 自分
//    - アクセスできるユーザー: 全員
// 7. デプロイURLをポータルHTMLの GAS_URL に貼り付け
//
// ═══════════════════════════════════════════════════════════
// ★ ここを書き換え ★
const SPREADSHEET_ID = '1HRdcl0EMXr6eDIQqiQDvNC8gMgfHjC6JQc9h4i2TlFM';
// ═══ シート名 ═══
const SH_PLAYERS  = '生徒';
const SH_COINS    = 'ALTログ';
const SH_BADGES   = 'バッジ';
const SH_CLASSES  = 'クラス';
const SH_GAMES    = 'ゲーム';
const SH_RANKINGS = 'ランキング';
const SH_LOGIN_LOG    = '入退室ログ';     // ★ 追加
const SH_GAMEPLAY_LOG = 'ゲームプレイログ'; // ★ 追加
// ═══════════════════════════════════════════════════════════
// 初期化（最初に1回だけ手動実行）
// ═══════════════════════════════════════════════════════════
function initSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName(SH_PLAYERS)) {
    const s = ss.insertSheet(SH_PLAYERS);
    s.appendRow(['name', 'className', 'createdAt']);
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SH_COINS)) {
    const s = ss.insertSheet(SH_COINS);
    s.appendRow(['id', 'player', 'gameId', 'gameName', 'amount', 'date']);
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SH_BADGES)) {
    const s = ss.insertSheet(SH_BADGES);
    s.appendRow(['player', 'count']);
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SH_CLASSES)) {
    const s = ss.insertSheet(SH_CLASSES);
    s.appendRow(['className']);
    s.setFrozenRows(1);
    const defaults = ['探究キッズ','探究スターター','探究ベーシック','探究アドバンス','探究リミットレス','探究個別'];
    defaults.forEach(c => s.appendRow([c]));
  }
  if (!ss.getSheetByName(SH_GAMES)) {
    const s = ss.insertSheet(SH_GAMES);
    s.appendRow(['id', 'name', 'emoji', 'url', 'category']);
    s.setFrozenRows(1);
    const defaults = [
      [1,'分数融合','🧬','','算数'],
      [2,'分数ガンマン','🔫','','算数'],
      [3,'どっちがおおきい','⚖️','','算数'],
      [4,'約分工房','🔧','','算数'],
      [5,'分数テトリス','🧱','','算数'],
      [6,'暗算パネル','🧠','','算数'],
      [7,'特産品マッチング','🍎','','地理'],
      [8,'都道府県シルエットクイズ','🗾','','地理'],
      [9,'気候バトルカード','🌦️','','理科'],
      [10,'絵画クイズ','🎨','','その他'],
      [11,'元素クエスト','⚗️','','理科'],
      [12,'迷路アタック','🏃','','その他'],
      [13,'お土産暗算','🛍️','','算数'],
      [14,'江戸時代迷路クイズ','🏯','','歴史'],
      [15,'文明ビルダー','🏛️','','歴史'],
    ];
    defaults.forEach(r => s.appendRow(r));
  }
  if (!ss.getSheetByName(SH_RANKINGS)) {
    const s = ss.insertSheet(SH_RANKINGS);
    s.appendRow(['gameId', 'gameName', 'player', 'score', 'scoreLabel', 'date']);
    s.setFrozenRows(1);
    s.setColumnWidth(1, 70);
    s.setColumnWidth(2, 160);
    s.setColumnWidth(3, 120);
    s.setColumnWidth(4, 80);
    s.setColumnWidth(5, 80);
    s.setColumnWidth(6, 130);
  }
  // ★ 追加: 入退室ログシート
  if (!ss.getSheetByName(SH_LOGIN_LOG)) {
    const s = ss.insertSheet(SH_LOGIN_LOG);
    s.appendRow(['user', 'className', 'loginTime', 'loginTs', 'logoutTime', 'logoutTs', 'duration']);
    s.setFrozenRows(1);
    s.setColumnWidth(1, 120);
    s.setColumnWidth(2, 140);
    s.setColumnWidth(3, 120);
    s.setColumnWidth(4, 140);
    s.setColumnWidth(5, 120);
    s.setColumnWidth(6, 140);
    s.setColumnWidth(7, 100);
  }
  // ★ 追加: ゲームプレイログシート
  if (!ss.getSheetByName(SH_GAMEPLAY_LOG)) {
    const s = ss.insertSheet(SH_GAMEPLAY_LOG);
    s.appendRow(['user', 'gameId', 'gameName', 'duration', 'startTs', 'date']);
    s.setFrozenRows(1);
    s.setColumnWidth(1, 120);
    s.setColumnWidth(2, 70);
    s.setColumnWidth(3, 160);
    s.setColumnWidth(4, 100);
    s.setColumnWidth(5, 140);
    s.setColumnWidth(6, 120);
  }
  Logger.log('✅ シート初期化完了');
}
// ═══════════════════════════════════════════════════════════
// GET API（データ読み取り）
// ═══════════════════════════════════════════════════════════
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'all';
  let result = {};
  try {
    switch (action) {
      case 'all':
        result = getAllData();
        break;
      case 'players':
        result = getPlayers();
        break;
      case 'classes':
        result = getClasses();
        break;
      case 'rankings':
        result = getRankings();
        break;
      case 'rankingByGame':
        result = getRankingByGame(Number(e.parameter.gameId));
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}
// ═══════════════════════════════════════════════════════════
// POST API（データ書き込み）
// ═══════════════════════════════════════════════════════════
function doPost(e) {
  let result = {};
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    switch (action) {
      case 'addPlayer':
        result = addPlayer(data.name, data.className);
        break;
      case 'deletePlayer':
        result = deletePlayer(data.name);
        break;
      case 'addCoin':
        result = addCoin(data.player, data.gameId, data.gameName, data.amount);
        break;
      case 'addBadge':
        result = addBadge(data.player);
        break;
      case 'addClass':
        result = addClass(data.className);
        break;
      case 'deleteClass':
        result = deleteClass(data.className);
        break;
      case 'addGame':
        result = addGame(data.name, data.emoji, data.url, data.category);
        break;
      case 'deleteGame':
        result = deleteGame(data.gameId);
        break;
      case 'updateGameUrl':
        result = updateGameUrl(data.gameId, data.url);
        break;
      case 'saveRanking':
        result = saveRanking(data.gameId, data.gameName, data.player, data.score, data.scoreLabel);
        break;
      case 'deleteRankingEntry':
        result = deleteRankingEntry(data.gameId, data.player);
        break;
      // ★ 追加: 入退室ログ
      case 'logLogin':
        result = logLogin(data.user, data.className, data.loginTime);
        break;
      case 'logLogout':
        result = logLogout(data.user, data.logoutTime, data.duration);
        break;
      // ★ 追加: ゲームプレイログ
      case 'logGamePlay':
        result = logGamePlay(data.user, data.gameId, data.gameName, data.duration, data.date);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}
// ═══════════════════════════════════════════════════════════
// 読み取り関数
// ═══════════════════════════════════════════════════════════
function getAllData() {
  return {
    players:      getPlayers().players,
    classes:      getClasses().classes,
    coinLog:      getCoinLog().coinLog,
    badges:       getBadges().badges,
    games:        getGames().games,
    rankings:     getRankings().rankings,
    loginLog:     getLoginLog().loginLog,         // ★ 追加
    gamePlayLog:  getGamePlayLog().gamePlayLog,   // ★ 追加
  };
}
function getPlayers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_PLAYERS);
  if (!sh || sh.getLastRow() < 2) return { players: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  const players = rows.filter(r => r[0]).map(r => ({
    name: String(r[0]),
    className: String(r[1] || ''),
  }));
  return { players };
}
function getClasses() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_CLASSES);
  if (!sh || sh.getLastRow() < 2) return { classes: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  const classes = rows.filter(r => r[0]).map(r => String(r[0]));
  return { classes };
}
function getCoinLog() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_COINS);
  if (!sh || sh.getLastRow() < 2) return { coinLog: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  const coinLog = rows.filter(r => r[0]).map(r => ({
    id: Number(r[0]),
    player: String(r[1]),
    gameId: Number(r[2]),
    gameName: String(r[3]),
    amount: Number(r[4]),
    date: String(r[5]),
  }));
  return { coinLog };
}
function getBadges() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_BADGES);
  if (!sh || sh.getLastRow() < 2) return { badges: {} };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const badges = {};
  rows.forEach(r => { if (r[0]) badges[String(r[0])] = Number(r[1]); });
  return { badges };
}
function getRankings() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_RANKINGS);
  if (!sh || sh.getLastRow() < 2) return { rankings: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  const rankings = rows.filter(r => r[2]).map(r => ({
    gameId:     Number(r[0]),
    gameName:   String(r[1]),
    player:     String(r[2]),
    score:      Number(r[3]),
    scoreLabel: String(r[4] || '点'),
    date:       String(r[5]),
  }));
  return { rankings };
}
function getRankingByGame(gameId) {
  const all = getRankings().rankings;
  const filtered = all.filter(r => r.gameId === gameId);
  const best = {};
  filtered.forEach(r => {
    if (best[r.player] === undefined || r.score > best[r.player].score) {
      best[r.player] = r;
    }
  });
  const sorted = Object.values(best).sort((a, b) => b.score - a.score);
  return { gameId, ranking: sorted };
}
// ★ 追加: 入退室ログ読み取り
function getLoginLog() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_LOGIN_LOG);
  if (!sh || sh.getLastRow() < 2) return { loginLog: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  const loginLog = rows.filter(r => r[0]).map(r => ({
    user:       String(r[0]),
    className:  String(r[1] || ''),
    loginTime:  String(r[2]),
    loginTs:    Number(r[3]),
    logoutTime: r[4] ? String(r[4]) : null,
    logoutTs:   r[5] ? Number(r[5]) : null,
  }));
  return { loginLog };
}
// ★ 追加: ゲームプレイログ読み取り
function getGamePlayLog() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_GAMEPLAY_LOG);
  if (!sh || sh.getLastRow() < 2) return { gamePlayLog: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  const gamePlayLog = rows.filter(r => r[0]).map(r => ({
    user:     String(r[0]),
    gameId:   Number(r[1]),
    gameName: String(r[2]),
    duration: Number(r[3]),
    startTs:  Number(r[4]),
    date:     String(r[5]),
  }));
  return { gamePlayLog };
}
// ═══════════════════════════════════════════════════════════
// 書き込み関数
// ═══════════════════════════════════════════════════════════
function addPlayer(name, className) {
  if (!name) return { error: 'なまえが空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_PLAYERS);
  if (sh.getLastRow() >= 2) {
    const names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String);
    if (names.includes(name)) return { error: 'すでに登録されています' };
  }
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sh.appendRow([name, className || '', now]);
  return { ok: true, name, className };
}
function deletePlayer(name) {
  if (!name) return { error: 'なまえが空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_PLAYERS);
  if (sh.getLastRow() < 2) return { error: '生徒がいません' };
  const names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String);
  const idx = names.indexOf(name);
  if (idx === -1) return { error: '見つかりません' };
  sh.deleteRow(idx + 2);
  return { ok: true, deleted: name };
}
function addCoin(player, gameId, gameName, amount) {
  if (!player || !amount) return { error: 'パラメータ不足' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_COINS);
  let nextId = 1;
  if (sh.getLastRow() >= 2) {
    const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(Number);
    nextId = Math.max(...ids) + 1;
  }
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d H:mm');
  sh.appendRow([nextId, player, gameId || 0, gameName || '', Number(amount), now]);
  return { ok: true, id: nextId, player, amount };
}
function addBadge(player) {
  if (!player) return { error: 'プレイヤー名が空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_BADGES);
  if (sh.getLastRow() >= 2) {
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === player) {
        const newCount = Number(data[i][1]) + 1;
        sh.getRange(i + 2, 2).setValue(newCount);
        return { ok: true, player, count: newCount };
      }
    }
  }
  sh.appendRow([player, 1]);
  return { ok: true, player, count: 1 };
}
function addClass(className) {
  if (!className) return { error: 'クラス名が空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_CLASSES);
  if (sh.getLastRow() >= 2) {
    const names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String);
    if (names.includes(className)) return { error: 'すでにあります' };
  }
  sh.appendRow([className]);
  return { ok: true, className };
}
function deleteClass(className) {
  if (!className) return { error: 'クラス名が空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_CLASSES);
  if (sh.getLastRow() < 2) return { error: 'クラスがありません' };
  const names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String);
  const idx = names.indexOf(className);
  if (idx === -1) return { error: '見つかりません' };
  sh.deleteRow(idx + 2);
  return { ok: true, deleted: className };
}
// ═══════════════════════════════════════════════════════════
// ゲーム管理
// ═══════════════════════════════════════════════════════════
function getGames() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_GAMES);
  if (!sh || sh.getLastRow() < 2) return { games: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  const games = rows.filter(r => r[0]).map(r => ({
    id: Number(r[0]),
    name: String(r[1]),
    emoji: String(r[2] || '🎮'),
    url: String(r[3] || ''),
    category: String(r[4] || ''),
  }));
  return { games };
}
function addGame(name, emoji, url, category) {
  if (!name) return { error: 'ゲーム名が空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_GAMES);
  let nextId = 1;
  if (sh.getLastRow() >= 2) {
    const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(Number);
    nextId = Math.max(...ids) + 1;
  }
  sh.appendRow([nextId, name, emoji || '🎮', url || '', category || '']);
  return { ok: true, id: nextId, name };
}
function deleteGame(gameId) {
  if (!gameId) return { error: 'IDが空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_GAMES);
  if (sh.getLastRow() < 2) return { error: 'ゲームがありません' };
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(Number);
  const idx = ids.indexOf(Number(gameId));
  if (idx === -1) return { error: '見つかりません' };
  sh.deleteRow(idx + 2);
  return { ok: true, deleted: gameId };
}
function updateGameUrl(gameId, url) {
  if (!gameId) return { error: 'IDが空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_GAMES);
  if (sh.getLastRow() < 2) return { error: 'ゲームがありません' };
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(Number);
  const idx = ids.indexOf(Number(gameId));
  if (idx === -1) return { error: '見つかりません' };
  sh.getRange(idx + 2, 4).setValue(url || '');
  return { ok: true, gameId, url };
}
// ═══════════════════════════════════════════════════════════
// ランキング管理
// ═══════════════════════════════════════════════════════════
function saveRanking(gameId, gameName, player, score, scoreLabel) {
  if (!gameId || !player || score === undefined || score === null) {
    return { error: 'パラメータ不足' };
  }
  const ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh  = ss.getSheetByName(SH_RANKINGS);
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d H:mm');
  if (sh.getLastRow() >= 2) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (Number(rows[i][0]) === Number(gameId) && String(rows[i][2]) === String(player)) {
        const existing = Number(rows[i][3]);
        if (Number(score) > existing) {
          sh.getRange(i + 2, 4, 1, 3).setValues([[Number(score), scoreLabel || '点', now]]);
          return { ok: true, updated: true, player, score, prev: existing };
        } else {
          return { ok: true, updated: false, player, score, prev: existing };
        }
      }
    }
  }
  sh.appendRow([Number(gameId), gameName || '', String(player), Number(score), scoreLabel || '点', now]);
  return { ok: true, updated: true, player, score, prev: null };
}
function deleteRankingEntry(gameId, player) {
  if (!gameId || !player) return { error: 'パラメータ不足' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_RANKINGS);
  if (sh.getLastRow() < 2) return { error: '記録がありません' };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  let deleted = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (Number(rows[i][0]) === Number(gameId) && String(rows[i][2]) === String(player)) {
      sh.deleteRow(i + 2);
      deleted++;
    }
  }
  if (deleted === 0) return { error: '見つかりません' };
  return { ok: true, deleted, gameId, player };
}
// ═══════════════════════════════════════════════════════════
// ★ 入退室ログ管理
// ═══════════════════════════════════════════════════════════
function logLogin(user, className, loginTime) {
  if (!user) return { error: 'ユーザー名が空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_LOGIN_LOG);
  const loginTs = Date.now();
  sh.appendRow([user, className || '', loginTime || '', loginTs, '', '', '']);
  return { ok: true, user, loginTs };
}
function logLogout(user, logoutTime, duration) {
  if (!user) return { error: 'ユーザー名が空です' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_LOGIN_LOG);
  if (sh.getLastRow() < 2) return { error: '記録がありません' };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  // 該当ユーザーの最新ログイン行（logoutTimeが空）を探して更新
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) === user && !rows[i][4]) {
      const logoutTs = Date.now();
      sh.getRange(i + 2, 5, 1, 3).setValues([[logoutTime || '', logoutTs, duration || '']]);
      return { ok: true, user, logoutTs };
    }
  }
  return { error: 'ログイン記録が見つかりません' };
}
// ═══════════════════════════════════════════════════════════
// ★ ゲームプレイログ管理
// ═══════════════════════════════════════════════════════════
function logGamePlay(user, gameId, gameName, duration, date) {
  if (!user || !gameId) return { error: 'パラメータ不足' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SH_GAMEPLAY_LOG);
  const startTs = Date.now() - (Number(duration) || 0);
  sh.appendRow([user, Number(gameId), gameName || '', Number(duration) || 0, startTs, date || '']);
  return { ok: true, user, gameId };
}
