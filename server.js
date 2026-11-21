'use strict';
/* Shaxmat Mini App serveri: hech qanday tashqi kutubxonasiz (faqat Node.js).
 * Akkaunt, do'stlar, chat, o'yin, soat, reyting, SSE orqali real-time. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Chess = require('./public/chess.js');

const PORT = +process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const BOT_USERNAME = process.env.BOT_USERNAME || '';
const APP_NAME = process.env.APP_NAME || '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const TG_API = process.env.TG_API_BASE || 'https://api.telegram.org';
const APP_URL = process.env.APP_URL || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

const TIMES = {
  '1+0': { base: 60, inc: 0 }, '3+0': { base: 180, inc: 0 }, '3+2': { base: 180, inc: 2 },
  '5+0': { base: 300, inc: 0 }, '10+0': { base: 600, inc: 0 }, '15+10': { base: 900, inc: 10 },
  'none': null
};
const LANGS = ['uz', 'en', 'ru'];

/* ---------- Ma'lumotlar bazasi (JSON fayl) ---------- */
let db = { users: {}, sessions: {}, chats: {}, games: {}, challenges: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); } catch (e) { /* yangi baza */ }
const byName = {}, byTg = {}, active = new Set();
Object.values(db.users).forEach(indexUser);
Object.values(db.games).forEach(function (g) { if (!g.over) active.add(g.id); });

function indexUser(u) {
  byName[u.username.toLowerCase()] = u.id;
  if (u.tgId) byTg[u.tgId] = u.id;
}
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(flush, 600);
}
function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) { console.error('Saqlashda xato:', e.message); }
}

/* ---------- Yordamchilar ---------- */
class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
function bad(code, status) { throw new HttpError(status || 400, code); }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function rid(n) { return crypto.randomBytes(n).toString('hex'); }
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
function checkPw(u, pw) {
  const a = Buffer.from(hashPw(pw, u && u.salt ? u.salt : '00'), 'hex');
  if (!u || !u.hash) return false;
  const b = Buffer.from(u.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
function normLang(l) { return LANGS.indexOf(l) >= 0 ? l : 'uz'; }

const buckets = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  if (++b.n > max) bad('rate_limited', 429);
}
setInterval(function () {
  const now = Date.now();
  buckets.forEach(function (b, k) { if (b.reset < now) buckets.delete(k); });
}, 60000).unref();

/* ---------- Foydalanuvchilar ---------- */
function createUser(o) {
  const id = 'u_' + rid(5), salt = rid(16);
  const u = {
    id: id, username: o.username, name: cleanText(o.name || o.username, 40),
    salt: o.password ? salt : null, hash: o.password ? hashPw(o.password, salt) : null,
    tgId: o.tgId || null, rating: 1200, wins: 0, losses: 0, draws: 0,
    created: Date.now(), lastSeen: Date.now(), lang: normLang(o.lang),
    friends: [], inc: [], out: [], blocked: [], read: {}, avatar: crypto.randomInt(0, 8)
  };
  db.users[id] = u; indexUser(u); save();
  return u;
}
function newSession(uid) {
  const token = rid(32);
  db.sessions[sha(token)] = uid; save();
  return token;
}
function isOnline(id) { const s = clients.get(id); return !!(s && s.size); }
function userPub(id) {
  const u = db.users[id];
  if (!u) return null;
  return { id: u.id, username: u.username, name: u.name, rating: Math.round(u.rating), online: isOnline(id), avatar: u.avatar };
}
function mePub(u) {
  return {
    id: u.id, username: u.username, name: u.name, rating: Math.round(u.rating),
    wins: u.wins, losses: u.losses, draws: u.draws, lang: u.lang, avatar: u.avatar,
    tg: !!u.tgId, hasPassword: !!u.hash, created: u.created
  };
}
function isBlockedBy(targetId, byId) { const t = db.users[byId]; return !!(t && t.blocked.indexOf(targetId) >= 0); }
function chatKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
function unlink(arr, id) { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); }

function makeFriendsDone(a, b) { return a.friends.indexOf(b.id) >= 0; }
function makeFriends(a, b) {
  [[a, b], [b, a]].forEach(function (p) {
    const u = p[0];
    unlink(u.inc, p[1].id); unlink(u.out, p[1].id);
    if (u.friends.indexOf(p[1].id) < 0) u.friends.push(p[1].id);
  });
}

/* ---------- Real-time (SSE) ---------- */
const clients = new Map();
function push(uid, event, data) {
  const set = clients.get(uid);
  if (!set) return;
  const msg = 'event: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n';
  set.forEach(function (res) { try { res.write(msg); } catch (e) { /* uzilgan */ } });
}
function notifyFriends(u) { u.friends.forEach(function (f) { push(f, 'friends', {}); }); }
setInterval(function () {
  clients.forEach(function (set) { set.forEach(function (res) { try { res.write(': ping\n\n'); } catch (e) { /* */ } }); });
}, 25000).unref();

/* ---------- O'yinlar ---------- */
function newGame(whiteId, blackId, time, rated) {
  const id = rid(5), t = TIMES[time] || null;
  const g = {
    id: id, white: whiteId, black: blackId, timeKey: TIMES[time] ? time : 'none', time: t,
    clock: t ? { w: t.base * 1000, b: t.base * 1000 } : null, turnStart: Date.now(),
    fen: Chess.START, moves: [], over: false, result: null, reason: null, winner: null,
    drawOffer: null, rated: rated !== false, chat: [], created: Date.now(), updated: Date.now(),
    rematch: null, rematchGame: null, ratingChange: null
  };
  db.games[id] = g; active.add(id); save();
  return g;
}
function turnOf(g) { return g.fen.split(' ')[1]; }
function replay(g) {
  const ch = new Chess();
  for (let i = 0; i < g.moves.length; i++) {
    const m = g.moves[i];
    if (!ch.move({ from: m.from, to: m.to, promotion: m.promotion })) throw new Error('Buzilgan o\'yin ' + g.id);
  }
  return ch;
}
function gamePub(g, viewerId) {
  const mine = viewerId === g.white || viewerId === g.black;
  return {
    id: g.id, white: userPub(g.white), black: userPub(g.black),
    fen: g.fen, turn: turnOf(g), moves: g.moves, over: g.over, result: g.result, reason: g.reason,
    winner: g.winner, drawOffer: g.drawOffer, rated: g.rated, timeKey: g.timeKey, time: g.time,
    clock: g.clock, turnStart: g.turnStart, now: Date.now(), created: g.created, updated: g.updated,
    rematch: g.rematch, rematchGame: g.rematchGame, ratingChange: g.ratingChange,
    chat: mine ? g.chat.slice(-60) : [],
    myColor: viewerId === g.white ? 'w' : viewerId === g.black ? 'b' : null
  };
}
function broadcastGame(g) {
  [g.white, g.black].forEach(function (uid) { push(uid, 'game', { game: gamePub(g, uid) }); });
}
function finish(g, winner, reason) {
  if (g.over) return;
  g.over = true; g.winner = winner; g.reason = reason;
  g.result = reason === 'aborted' ? '*' : winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '1/2-1/2';
  g.drawOffer = null; g.updated = Date.now();
  active.delete(g.id);
  const counts = g.moves.length >= 2 && reason !== 'aborted' && reason !== 'abandoned';
  if (counts) {
    const w = db.users[g.white], b = db.users[g.black];
    if (w && b) {
      if (winner === 'w') { w.wins++; b.losses++; } else if (winner === 'b') { b.wins++; w.losses++; } else { w.draws++; b.draws++; }
      if (g.rated) {
        const sw = winner === 'w' ? 1 : winner === 'b' ? 0 : 0.5;
        const ew = 1 / (1 + Math.pow(10, (b.rating - w.rating) / 400)), K = 32;
        const dw = K * (sw - ew), db_ = K * ((1 - sw) - (1 - ew));
        w.rating += dw; b.rating += db_;
        g.ratingChange = { w: Math.round(dw), b: Math.round(db_) };
      }
    }
  }
  save();
  broadcastGame(g);
  [g.white, g.black].forEach(function (uid) { push(uid, 'me', {}); });
}
function colorOf(g, uid) { return g.white === uid ? 'w' : g.black === uid ? 'b' : null; }
function getGame(id) { const g = db.games[id]; if (!g) bad('not_found', 404); return g; }
function myGame(id, uid) {
  const g = getGame(id), c = colorOf(g, uid);
  if (!c) bad('forbidden', 403);
  return { g: g, c: c };
}

/* Soat tugashini tekshirish (har soniya) */
setInterval(function () {
  const now = Date.now();
  active.forEach(function (id) {
    const g = db.games[id];
    if (!g || g.over) { active.delete(id); return; }
    if (g.clock) {
      const t = turnOf(g);
      if (now - g.turnStart >= g.clock[t]) {
        g.clock[t] = 0;
        if (g.moves.length < 2) finish(g, null, 'aborted');
        else finish(g, t === 'w' ? 'b' : 'w', 'timeout');
      }
    } else if (now - g.updated > 7 * 86400000) {
      finish(g, null, 'abandoned');
    }
  });
}, 1000).unref();

/* Eski ma'lumotlarni tozalash (soatiga bir marta) */
setInterval(function () {
  const now = Date.now();
  Object.keys(db.games).forEach(function (id) {
    const g = db.games[id];
    if (g.over && now - g.updated > 60 * 86400000) delete db.games[id];
  });
  Object.keys(db.challenges).forEach(function (id) {
    if (now - db.challenges[id].created > 300000) { push(db.challenges[id].from, 'challenge_gone', { id: id }); delete db.challenges[id]; }
  });
  save();
}, 3600000).unref();
setInterval(function () {
  const now = Date.now();
  Object.keys(db.challenges).forEach(function (id) {
    const c = db.challenges[id];
    if (now - c.created > 300000) { delete db.challenges[id]; push(c.from, 'challenge_gone', { id: id }); push(c.to, 'challenge_gone', { id: id }); }
  });
}, 15000).unref();

/* Tezkor o'yin navbati */
let queue = [];
setInterval(function () { queue = queue.filter(function (q) { return isOnline(q.uid) || Date.now() - q.since < 10000; }); }, 5000).unref();
function tryMatch(uid, time) {
  queue = queue.filter(function (q) { return q.uid !== uid; });
  const me = db.users[uid];
  let best = null;
  queue.forEach(function (q) {
    if (q.time !== time || !isOnline(q.uid)) return;
    if (isBlockedBy(uid, q.uid) || isBlockedBy(q.uid, uid)) return;
    const d = Math.abs(db.users[q.uid].rating - me.rating);
    if (!best || d < best.d) best = { q: q, d: d };
  });
  if (!best) { queue.push({ uid: uid, time: time, since: Date.now() }); return null; }
  queue = queue.filter(function (q) { return q !== best.q; });
  const white = Math.random() < 0.5 ? uid : best.q.uid, black = white === uid ? best.q.uid : uid;
  const g = newGame(white, black, time, true);
  push(best.q.uid, 'matched', { gameId: g.id });
  return g;
}


/* ---------- Telegram xabarnomalari (foydalanuvchi ilovada bo'lmasa, bot yozadi) ---------- */
const NOTE = {
  uz: { turn: '♟ {name} yurish qildi. Sizning navbatingiz!', friend: '👋 {name} sizga do\'stlik so\'rovi yubordi', challenge: '⚔️ {name} sizni shaxmat o\'yiniga chaqirmoqda', chat: '💬 {name}: {text}', open: '♟ Ochish' },
  en: { turn: '♟ {name} moved. Your turn!', friend: '👋 {name} sent you a friend request', challenge: '⚔️ {name} challenges you to a chess game', chat: '💬 {name}: {text}', open: '♟ Open' },
  ru: { turn: '♟ {name} сделал ход. Ваш ход!', friend: '👋 {name} отправил вам заявку в друзья', challenge: '⚔️ {name} вызывает вас на партию', chat: '💬 {name}: {text}', open: '♟ Открыть' }
};
const lastNote = new Map();
function tgNotify(uid, kind, vars, gap) {
  const u = db.users[uid];
  if (!BOT_TOKEN || !u || !u.tgId || isOnline(uid)) return;
  const key = kind + ':' + uid + ':' + (vars.key || ''), now = Date.now();
  if (now - (lastNote.get(key) || 0) < (gap || 30000)) return;
  lastNote.set(key, now);
  const dict = NOTE[u.lang] || NOTE.uz;
  const text = (dict[kind] || '').replace('{name}', vars.name).replace('{text}', vars.text || '');
  const payload = { chat_id: u.tgId, text: text };
  if (/^https:\/\//.test(APP_URL)) payload.reply_markup = { inline_keyboard: [[{ text: dict.open, web_app: { url: APP_URL } }]] };
  try {
    const body = JSON.stringify(payload), url = new URL(TG_API + '/bot' + BOT_TOKEN + '/sendMessage');
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, function (res) { res.resume(); });
    req.on('error', function () { /* xabar yetmasa ham mayli */ });
    req.setTimeout(8000, function () { req.destroy(); });
    req.end(body);
  } catch (e) { /* noto'g'ri manzil */ }
}
setInterval(function () {
  const now = Date.now();
  lastNote.forEach(function (ts, k) { if (now - ts > 3600000) lastNote.delete(k); });
}, 600000).unref();

/* ---------- Telegram ---------- */
function verifyInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const p = new URLSearchParams(initData), hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const dcs = Array.from(p.entries()).map(function (e) { return e[0] + '=' + e[1]; }).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const h = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const a = Buffer.from(h), b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() / 1000 - (+p.get('auth_date') || 0) > 86400) return null;
  try { return JSON.parse(p.get('user')); } catch (e) { return null; }
}

/* ---------- Router ---------- */
const routes = [];
function route(method, pattern, auth, fn) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method: method, re: re, keys: keys, auth: auth, fn: fn });
}

route('GET', '/api/health', false, function () { return { ok: true, users: Object.keys(db.users).length, active: active.size }; });
route('GET', '/api/config', false, function () {
  return { botUsername: BOT_USERNAME, appName: APP_NAME, telegram: !!BOT_TOKEN, times: Object.keys(TIMES) };
});

route('POST', '/api/register', false, function (c) {
  limit('reg:' + c.ip, 8, 600000);
  const username = String(c.body.username || '').trim(), password = String(c.body.password || '');
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) bad('bad_username');
  if (password.length < 6 || password.length > 100) bad('bad_password');
  if (byName[username.toLowerCase()]) bad('username_taken', 409);
  const u = createUser({ username: username, password: password, lang: c.body.lang });
  return { token: newSession(u.id), me: mePub(u) };
});
route('POST', '/api/login', false, function (c) {
  limit('login:' + c.ip, 15, 300000);
  const username = String(c.body.username || '').trim().toLowerCase(), password = String(c.body.password || '');
  const u = db.users[byName[username]];
  if (!checkPw(u, password)) bad('bad_credentials', 401);
  return { token: newSession(u.id), me: mePub(u) };
});
route('POST', '/api/auth/telegram', false, function (c) {
  limit('tg:' + c.ip, 30, 300000);
  if (!BOT_TOKEN) bad('telegram_not_configured', 501);
  const tg = verifyInitData(String(c.body.initData || ''));
  if (!tg || !tg.id) bad('bad_telegram', 401);
  let u = db.users[byTg[tg.id]];
  if (!u) {
    let base = String(tg.username || 'tg' + tg.id).replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (base.length < 3) base = 'tg' + tg.id;
    let name = base, i = 1;
    while (byName[name.toLowerCase()]) name = base + (i++);
    const lang = tg.language_code === 'ru' ? 'ru' : tg.language_code === 'uz' ? 'uz' : tg.language_code ? 'en' : 'uz';
    u = createUser({ username: name, name: [tg.first_name, tg.last_name].filter(Boolean).join(' ') || name, tgId: tg.id, lang: lang });
  }
  return { token: newSession(u.id), me: mePub(u) };
});
route('POST', '/api/logout', true, function (c) {
  delete db.sessions[sha(c.token)]; save();
  return { ok: true };
});
route('GET', '/api/me', true, function (c) { return { me: mePub(c.user) }; });
route('POST', '/api/me', true, function (c) {
  if (c.body.lang) c.user.lang = normLang(c.body.lang);
  if (c.body.name != null) { const n = cleanText(c.body.name, 40); if (n.length >= 1) c.user.name = n; }
  if (c.body.avatar != null) c.user.avatar = Math.max(0, Math.min(7, parseInt(c.body.avatar, 10) || 0));
  save(); notifyFriends(c.user);
  return { me: mePub(c.user) };
});
route('POST', '/api/password', true, function (c) {
  limit('pw:' + c.user.id, 5, 600000);
  const np = String(c.body.newPassword || '');
  if (np.length < 6 || np.length > 100) bad('bad_password');
  if (c.user.hash && !checkPw(c.user, String(c.body.oldPassword || ''))) bad('bad_credentials', 401);
  c.user.salt = rid(16); c.user.hash = hashPw(np, c.user.salt); save();
  return { ok: true };
});

route('GET', '/api/users/search', true, function (c) {
  const q = cleanText(c.query.q, 20).toLowerCase();
  if (q.length < 2) return { users: [] };
  const u = c.user, out = [];
  Object.keys(byName).forEach(function (n) {
    if (out.length >= 10 || n.indexOf(q) !== 0) return;
    const id = byName[n];
    if (id === u.id || u.blocked.indexOf(id) >= 0 || isBlockedBy(u.id, id)) return;
    const p = userPub(id);
    p.relation = u.friends.indexOf(id) >= 0 ? 'friend' : u.out.indexOf(id) >= 0 ? 'sent' : u.inc.indexOf(id) >= 0 ? 'received' : 'none';
    out.push(p);
  });
  return { users: out };
});

function friendPub(u, id) {
  const p = userPub(id);
  const msgs = db.chats[chatKey(u.id, id)] || [];
  const readTs = u.read[id] || 0;
  let unread = 0;
  for (let i = msgs.length - 1; i >= 0 && msgs[i].ts > readTs; i--) if (msgs[i].f === id) unread++;
  const last = msgs[msgs.length - 1];
  p.unread = unread;
  p.last = last ? { t: last.t.slice(0, 60), mine: last.f === u.id, ts: last.ts } : null;
  return p;
}
route('GET', '/api/friends', true, function (c) {
  const u = c.user;
  const friends = u.friends.map(function (id) { return friendPub(u, id); }).filter(Boolean);
  friends.sort(function (a, b) {
    return (b.online - a.online) || ((b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0)) || a.username.localeCompare(b.username);
  });
  const ch = Object.keys(db.challenges).map(function (id) { return db.challenges[id]; })
    .filter(function (x) { return x.to === u.id; })
    .map(function (x) { return { id: x.id, from: userPub(x.from), timeKey: x.timeKey, color: x.color, created: x.created }; });
  return {
    friends: friends,
    incoming: u.inc.map(userPub).filter(Boolean),
    outgoing: u.out.map(userPub).filter(Boolean),
    challenges: ch
  };
});
route('POST', '/api/friends/request', true, function (c) {
  limit('fr:' + c.user.id, 20, 600000);
  const u = c.user, name = String(c.body.username || '').trim().toLowerCase();
  const t = db.users[c.body.id || byName[name]];
  if (!t) bad('user_not_found', 404);
  if (t.id === u.id) bad('self_request');
  if (isBlockedBy(u.id, t.id) || u.blocked.indexOf(t.id) >= 0) bad('user_not_found', 404);
  if (u.friends.indexOf(t.id) >= 0) bad('already_friends');
  if (u.inc.indexOf(t.id) >= 0) { makeFriends(u, t); }
  else if (u.out.indexOf(t.id) < 0) { u.out.push(t.id); t.inc.push(u.id); }
  save(); push(t.id, 'friends', { notify: 'request', from: userPub(u.id) }); push(u.id, 'friends', {});
  if (!makeFriendsDone(u, t)) tgNotify(t.id, 'friend', { name: u.name, key: u.id }, 60000);
  return { ok: true, friends: u.friends.indexOf(t.id) >= 0 };
});
route('POST', '/api/friends/accept', true, function (c) {
  const u = c.user, t = db.users[c.body.id];
  if (!t || u.inc.indexOf(t.id) < 0) bad('not_found', 404);
  makeFriends(u, t); save();
  push(t.id, 'friends', { notify: 'accepted', from: userPub(u.id) }); push(u.id, 'friends', {});
  return { ok: true };
});
route('POST', '/api/friends/decline', true, function (c) {
  const u = c.user, t = db.users[c.body.id];
  if (!t) bad('not_found', 404);
  unlink(u.inc, t.id); unlink(t.out, u.id); unlink(u.out, t.id); unlink(t.inc, u.id); save();
  push(t.id, 'friends', {}); push(u.id, 'friends', {});
  return { ok: true };
});
route('POST', '/api/friends/remove', true, function (c) {
  const u = c.user, t = db.users[c.body.id];
  if (!t) bad('not_found', 404);
  unlink(u.friends, t.id); unlink(t.friends, u.id); save();
  push(t.id, 'friends', {}); push(u.id, 'friends', {});
  return { ok: true };
});
route('POST', '/api/friends/block', true, function (c) {
  const u = c.user, t = db.users[c.body.id];
  if (!t || t.id === u.id) bad('not_found', 404);
  [u, t].forEach(function (x, i) {
    const o = i === 0 ? t : u;
    unlink(x.friends, o.id); unlink(x.inc, o.id); unlink(x.out, o.id);
  });
  if (u.blocked.indexOf(t.id) < 0) u.blocked.push(t.id);
  Object.keys(db.challenges).forEach(function (id) {
    const ch = db.challenges[id];
    if ((ch.from === u.id && ch.to === t.id) || (ch.from === t.id && ch.to === u.id)) delete db.challenges[id];
  });
  queue = queue.filter(function (q) { return q.uid !== u.id; });
  save(); push(u.id, 'friends', {});
  return { ok: true };
});
route('POST', '/api/friends/unblock', true, function (c) {
  unlink(c.user.blocked, c.body.id); save();
  return { ok: true };
});
route('GET', '/api/blocked', true, function (c) {
  return { users: c.user.blocked.map(userPub).filter(Boolean) };
});

/* Chat (do'stlar o'rtasida) */
route('GET', '/api/chat/:id', true, function (c) {
  const u = c.user, id = c.params.id;
  if (u.friends.indexOf(id) < 0) bad('not_friends', 403);
  const msgs = db.chats[chatKey(u.id, id)] || [];
  u.read[id] = Date.now(); save();
  return { messages: msgs.slice(-100), friend: userPub(id) };
});
route('POST', '/api/chat/:id', true, function (c) {
  const u = c.user, id = c.params.id;
  limit('chat:' + u.id, 30, 60000);
  if (u.friends.indexOf(id) < 0) bad('not_friends', 403);
  if (isBlockedBy(u.id, id)) bad('blocked', 403);
  const text = cleanText(c.body.text, 500);
  if (!text) bad('empty');
  const k = chatKey(u.id, id), arr = db.chats[k] || (db.chats[k] = []);
  const msg = { f: u.id, t: text, ts: Date.now() };
  arr.push(msg);
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  u.read[id] = msg.ts; save();
  push(id, 'chat', { from: u.id, msg: msg, user: userPub(u.id) });
  tgNotify(id, 'chat', { name: u.name, text: text.slice(0, 80), key: u.id }, 20000);
  return { msg: msg };
});

/* Chaqiriqlar (do'stni o'yinga taklif qilish) */
route('POST', '/api/challenge', true, function (c) {
  limit('ch:' + c.user.id, 15, 300000);
  const u = c.user, to = c.body.to;
  if (u.friends.indexOf(to) < 0) bad('not_friends', 403);
  if (isBlockedBy(u.id, to)) bad('blocked', 403);
  const timeKey = TIMES.hasOwnProperty(c.body.time) ? c.body.time : '10+0';
  const color = ['w', 'b', 'r'].indexOf(c.body.color) >= 0 ? c.body.color : 'r';
  Object.keys(db.challenges).forEach(function (id) {
    const x = db.challenges[id];
    if (x.from === u.id && x.to === to) { delete db.challenges[id]; push(to, 'challenge_gone', { id: id }); }
  });
  const ch = { id: rid(4), from: u.id, to: to, timeKey: timeKey, color: color, created: Date.now() };
  db.challenges[ch.id] = ch; save();
  push(to, 'challenge', { challenge: { id: ch.id, from: userPub(u.id), timeKey: timeKey, color: color, created: ch.created } });
  tgNotify(to, 'challenge', { name: u.name, key: u.id }, 30000);
  return { id: ch.id };
});
route('POST', '/api/challenge/accept', true, function (c) {
  const ch = db.challenges[c.body.id];
  if (!ch || ch.to !== c.user.id) bad('not_found', 404);
  delete db.challenges[ch.id];
  let white = ch.from, black = ch.to;
  if (ch.color === 'b') { white = ch.to; black = ch.from; }
  else if (ch.color === 'r' && Math.random() < 0.5) { white = ch.to; black = ch.from; }
  const g = newGame(white, black, ch.timeKey, true);
  push(ch.from, 'matched', { gameId: g.id });
  return { gameId: g.id };
});
route('POST', '/api/challenge/decline', true, function (c) {
  const ch = db.challenges[c.body.id];
  if (!ch || (ch.to !== c.user.id && ch.from !== c.user.id)) bad('not_found', 404);
  delete db.challenges[ch.id]; save();
  push(ch.from, 'challenge_gone', { id: ch.id, declined: ch.to === c.user.id }); push(ch.to, 'challenge_gone', { id: ch.id });
  return { ok: true };
});

/* Tezkor o'yin */
route('POST', '/api/queue', true, function (c) {
  limit('q:' + c.user.id, 30, 60000);
  const time = TIMES.hasOwnProperty(c.body.time) ? c.body.time : '10+0';
  const g = tryMatch(c.user.id, time);
  return g ? { gameId: g.id } : { queued: true };
});
route('POST', '/api/queue/cancel', true, function (c) {
  queue = queue.filter(function (q) { return q.uid !== c.user.id; });
  return { ok: true };
});

/* O'yin */
route('GET', '/api/games', true, function (c) {
  const u = c.user, mine = Object.keys(db.games).map(function (id) { return db.games[id]; })
    .filter(function (g) { return g.white === u.id || g.black === u.id; });
  mine.sort(function (a, b) { return (a.over - b.over) || (b.updated - a.updated); });
  return {
    games: mine.slice(0, 40).map(function (g) {
      return {
        id: g.id, white: userPub(g.white), black: userPub(g.black), over: g.over, result: g.result,
        reason: g.reason, turn: turnOf(g), moves: g.moves.length, updated: g.updated, timeKey: g.timeKey,
        myColor: colorOf(g, u.id), ratingChange: g.ratingChange
      };
    })
  };
});
route('GET', '/api/game/:id', true, function (c) {
  return { game: gamePub(getGame(c.params.id), c.user.id) };
});
route('POST', '/api/game/:id/move', true, function (c) {
  limit('mv:' + c.user.id, 120, 60000);
  const x = myGame(c.params.id, c.user.id), g = x.g;
  if (g.over) bad('game_over');
  if (turnOf(g) !== x.c) bad('not_your_turn');
  const now = Date.now();
  if (g.clock && now - g.turnStart >= g.clock[x.c]) {
    g.clock[x.c] = 0;
    if (g.moves.length < 2) finish(g, null, 'aborted'); else finish(g, x.c === 'w' ? 'b' : 'w', 'timeout');
    return { game: gamePub(g, c.user.id) };
  }
  const ch = replay(g);
  const m = ch.move({ from: String(c.body.from), to: String(c.body.to), promotion: c.body.promotion });
  if (!m) bad('illegal_move');
  if (g.clock) { g.clock[x.c] = Math.max(1, g.clock[x.c] - (now - g.turnStart)) + g.time.inc * 1000; }
  g.fen = m.fen; g.turnStart = now; g.updated = now; g.drawOffer = null;
  g.moves.push({ from: m.from, to: m.to, promotion: m.promotion, san: m.san });
  const st = ch.status();
  if (st.over) finish(g, st.winner, st.reason);
  else {
    save(); broadcastGame(g);
    const oppId = x.c === 'w' ? g.black : g.white;
    tgNotify(oppId, 'turn', { name: c.user.name, key: g.id }, 60000);
  }
  return { game: gamePub(g, c.user.id) };
});
route('POST', '/api/game/:id/resign', true, function (c) {
  const x = myGame(c.params.id, c.user.id);
  if (x.g.over) bad('game_over');
  if (x.g.moves.length < 2) finish(x.g, null, 'aborted');
  else finish(x.g, x.c === 'w' ? 'b' : 'w', 'resign');
  return { game: gamePub(x.g, c.user.id) };
});
route('POST', '/api/game/:id/draw', true, function (c) {
  limit('draw:' + c.user.id, 20, 60000);
  const x = myGame(c.params.id, c.user.id), g = x.g, a = c.body.action;
  if (g.over) bad('game_over');
  if (a === 'offer') {
    if (g.moves.length < 2) bad('too_early');
    if (g.drawOffer) bad('already_offered');
    g.drawOffer = x.c;
  } else if (a === 'accept') {
    if (!g.drawOffer || g.drawOffer === x.c) bad('no_offer');
    finish(g, null, 'agreement');
    return { game: gamePub(g, c.user.id) };
  } else if (a === 'decline') {
    if (!g.drawOffer) bad('no_offer');
    g.drawOffer = null;
  } else bad('bad_action');
  g.updated = Date.now(); save(); broadcastGame(g);
  return { game: gamePub(g, c.user.id) };
});
route('POST', '/api/game/:id/chat', true, function (c) {
  limit('gchat:' + c.user.id, 30, 60000);
  const x = myGame(c.params.id, c.user.id), text = cleanText(c.body.text, 300);
  if (!text) bad('empty');
  x.g.chat.push({ c: x.c, t: text, ts: Date.now() });
  if (x.g.chat.length > 100) x.g.chat.shift();
  save(); broadcastGame(x.g);
  return { ok: true };
});
route('POST', '/api/game/:id/rematch', true, function (c) {
  const x = myGame(c.params.id, c.user.id), g = x.g;
  if (!g.over) bad('game_not_over');
  if (g.rematchGame) return { gameId: g.rematchGame };
  const opp = x.c === 'w' ? g.black : g.white;
  if (isBlockedBy(c.user.id, opp)) bad('blocked', 403);
  if (g.rematch && g.rematch !== x.c) {
    const n = newGame(g.black, g.white, g.timeKey, g.rated);
    g.rematchGame = n.id; save();
    broadcastGame(g);
    push(opp, 'matched', { gameId: n.id });
    return { gameId: n.id };
  }
  g.rematch = x.c; save(); broadcastGame(g);
  return { ok: true };
});

route('GET', '/api/leaderboard', true, function (c) {
  const list = Object.keys(db.users).map(function (id) { return db.users[id]; })
    .filter(function (u) { return u.wins + u.losses + u.draws > 0; })
    .sort(function (a, b) { return (b.rating - a.rating) || (b.wins - a.wins); })
    .slice(0, 50)
    .map(function (u) { const p = userPub(u.id); p.wins = u.wins; p.losses = u.losses; p.draws = u.draws; return p; });
  const all = Object.keys(db.users).map(function (id) { return db.users[id]; })
    .filter(function (u) { return u.wins + u.losses + u.draws > 0; })
    .sort(function (a, b) { return (b.rating - a.rating) || (b.wins - a.wins); });
  const rank = all.findIndex(function (u) { return u.id === c.user.id; });
  return { players: list, myRank: rank >= 0 ? rank + 1 : null };
});

/* ---------- HTTP server ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'
};
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'self'"
};
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, SEC, headers));
  res.end(body);
}
function sendJson(res, status, obj, extra) {
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra));
}
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0, over = false; const chunks = [];
    req.on('data', function (d) {
      if (over) return;
      size += d.length;
      if (size > 32768) { over = true; chunks.length = 0; reject(new HttpError(413, 'too_large')); return; }
      chunks.push(d);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}); }
      catch (e) { reject(new HttpError(400, 'bad_json')); }
    });
    req.on('error', reject);
  });
}
function userFromReq(req, url) {
  let token = '';
  const h = req.headers.authorization || '';
  if (h.indexOf('Bearer ') === 0) token = h.slice(7);
  else if (url.searchParams.get('token')) token = url.searchParams.get('token');
  const uid = token && db.sessions[sha(token)];
  const u = uid && db.users[uid];
  return u ? { user: u, token: token } : null;
}
function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try { rel = decodeURIComponent(rel); } catch (e) { return send(res, 400, 'Bad request'); }
  const file = path.normalize(path.join(PUBLIC, rel));
  if (file.indexOf(PUBLIC + path.sep) !== 0) return send(res, 403, 'Forbidden');
  fs.readFile(file, function (err, data) {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;
  if (pathname.indexOf('/api/') !== 0) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, pathname);
  }

  /* SSE */
  if (pathname === '/api/events' && req.method === 'GET') {
    const a = userFromReq(req, url);
    if (!a) return sendJson(res, 401, { error: 'unauthorized' });
    res.writeHead(200, Object.assign({}, SEC, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'
    }));
    res.write('retry: 2000\n\n');
    const uid = a.user.id;
    let set = clients.get(uid);
    const wasOffline = !set || !set.size;
    if (!set) { set = new Set(); clients.set(uid, set); }
    set.add(res);
    a.user.lastSeen = Date.now();
    if (wasOffline) notifyFriends(a.user);
    res.write('event: hello\ndata: {}\n\n');
    req.on('close', function () {
      set.delete(res);
      if (!set.size) setTimeout(function () { if (!isOnline(uid)) notifyFriends(a.user); }, 4000);
    });
    return;
  }

  let r = null, params = {};
  for (let i = 0; i < routes.length; i++) {
    if (routes[i].method !== req.method) continue;
    const m = routes[i].re.exec(pathname);
    if (m) {
      r = routes[i];
      r.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); });
      break;
    }
  }
  if (!r) return sendJson(res, 404, { error: 'not_found' });

  (async function () {
    try {
      const ctx = { req: req, res: res, params: params, ip: clientIp(req), query: {}, body: {}, user: null, token: '' };
      url.searchParams.forEach(function (v, k) { ctx.query[k] = v; });
      if (r.auth) {
        const a = userFromReq(req, url);
        if (!a) bad('unauthorized', 401);
        ctx.user = a.user; ctx.token = a.token;
        ctx.user.lastSeen = Date.now();
      }
      if (req.method === 'POST') ctx.body = await readBody(req);
      sendJson(res, 200, r.fn(ctx));
    } catch (e) {
      if (e instanceof HttpError) sendJson(res, e.status, { error: e.code }, e.status === 413 ? { 'Connection': 'close' } : undefined);
      else { console.error(e); sendJson(res, 500, { error: 'server_error' }); }
    }
  })();
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('Shaxmat serveri ishga tushdi: http://localhost:' + PORT);
  if (!BOT_TOKEN) console.log('Eslatma: BOT_TOKEN berilmagan, Telegram orqali avtomatik kirish o\'chiq (login/parol ishlaydi).');
});
function shutdown() { flush(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
