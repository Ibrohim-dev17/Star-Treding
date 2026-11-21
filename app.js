/* Ishga tushirish: kirish ekrani, real-time (SSE), voqealar, umumiy bosish boshqaruvchisi */
(function () {
  'use strict';
  var A = window.A, S = A.S, esc = A.esc, ic = A.ic, ACT = A.ACT = A.ACT || {}, tg = A.tg;
  var wasDown = false, netEl = null;

  A.refreshMe = function () {
    return A.api('GET', '/api/me').then(function (r) { S.me = r.me; if (S.tab === 'profile') A.renderTab(); return r; });
  };

  /* ---------- Asosiy ekran ---------- */
  A.renderMain = function () {
    A.closeAll();
    A.app.innerHTML = '<div class="screen" id="main"><div class="scroll" id="tabc"></div><nav class="tabbar" id="tabbar"></nav></div>';
    A.renderTab();
    if (S.tab === 'friends') A.loadFriends();
  };
  function setOffline(b) {
    if (b && !netEl) {
      netEl = document.createElement('div'); netEl.className = 'net-banner'; netEl.textContent = t('reconnecting');
      A.app.appendChild(netEl);
    } else if (!b && netEl) { netEl.remove(); netEl = null; }
  }

  /* ---------- Chiqish ---------- */
  function cleanup() {
    if (S.sse) { S.sse.close(); S.sse = null; }
    A.closeAll(); S.me = null; S.friends = null; S.games = null; S.top = null; S.queue = false; setOffline(false);
  }
  A.logout = function () {
    A.api('POST', '/api/logout', null, { quiet: true }).then(null, function () { /* */ });
    S.token = null; A.ls.del('token'); cleanup(); renderAuth('login');
  };
  A.forceLogout = function () {
    S.token = null; A.ls.del('token'); cleanup(); renderAuth('login');
    A.toast(t('e_unauthorized'), 'err');
  };

  /* ---------- Kirish / ro'yxatdan o'tish ---------- */
  function renderAuth(mode) {
    var u0 = A.$('#au') ? A.$('#au').value : '', reg = mode === 'register';
    A.closeAll();
    A.app.innerHTML = '<div class="screen auth"><div class="auth-inner"><img class="logo" src="icon.svg" alt=""><h1>' + esc(t('app')) + '</h1><div class="tag">' + esc(t('tagline')) + '</div>' +
      '<div class="lang-row">' + t.langs.map(function (l) { return '<button class="' + (t.get() === l[0] ? 'on' : '') + '" data-act="authlang" data-v="' + l[0] + '" data-m="' + mode + '">' + l[1] + '</button>'; }).join('') + '</div>' +
      '<form id="authform"><input class="input" id="au" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" placeholder="' + esc(t('username')) + '" value="' + esc(u0) + '">' +
      (reg ? '<div class="hint-text" style="margin-top:-4px">' + esc(t('usernameHint')) + '</div>' : '') +
      '<input class="input" id="ap" type="password" name="password" maxlength="100" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" placeholder="' + esc(t('password')) + '">' +
      (reg ? '<div class="hint-text" style="margin-top:-4px">' + esc(t('passwordHint')) + '</div>' : '') +
      '<div class="err-text" id="aerr"></div><button class="btn primary block" type="submit" id="abtn">' + esc(reg ? t('registerBtn') : t('loginBtn')) + '</button></form>' +
      '<div class="switch-line">' + esc(reg ? t('haveAccount') : t('noAccount')) + '<button data-act="authswitch" data-m="' + (reg ? 'login' : 'register') + '">' + esc(reg ? t('login') : t('register')) + '</button></div></div></div>';
    A.$('#authform').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = A.$('#abtn'), err = A.$('#aerr');
      err.textContent = ''; btn.disabled = true;
      A.api('POST', reg ? '/api/register' : '/api/login', { username: A.$('#au').value.trim(), password: A.$('#ap').value, lang: t.get() }, { quiet: true }).then(onLoggedIn, function (er) {
        btn.disabled = false; err.textContent = A.errMsg(er);
      });
    });
  }
  ACT.authlang = function (el) { A.applyLang(el.dataset.v); renderAuth(el.dataset.m); };
  ACT.authswitch = function (el) { renderAuth(el.dataset.m); };

  function onLoggedIn(r) {
    S.token = r.token; A.ls.set('token', r.token); S.me = r.me;
    A.applyLang(r.me.lang); startApp();
  }

  function startApp() {
    A.renderMain(); connectSSE(); A.loadFriends(); A.loadGames();
    if (S.tab === 'top') A.loadTop();
    if (S.pendingFriend) {
      var u = S.pendingFriend; S.pendingFriend = null;
      if (u.toLowerCase() !== S.me.username.toLowerCase()) {
        A.api('POST', '/api/friends/request', { username: u }).then(function (r) {
          A.toast(r.friends ? t('friendAdded', { name: u }) : t('requestSent'), 'ok'); A.loadFriends();
        }, function (e) { if (e.code !== 'already_friends') A.errToast(e); });
      }
    }
  }

  /* ---------- Real-time ---------- */
  function connectSSE() {
    if (S.sse) S.sse.close();
    if (!S.token || typeof EventSource === 'undefined') return;
    var es = S.sse = new EventSource('/api/events?token=' + encodeURIComponent(S.token));
    es.onopen = function () { setOffline(false); if (wasDown) { wasDown = false; refreshAll(); } };
    es.onerror = function () {
      wasDown = true; setOffline(true);
      A.api('GET', '/api/me').then(null, function () { /* 401 bo'lsa forceLogout ishlaydi */ });
    };
    ['friends', 'chat', 'challenge', 'challenge_gone', 'matched', 'game', 'me'].forEach(function (n) {
      es.addEventListener(n, function (e) { var d = {}; try { d = JSON.parse(e.data); } catch (x) { /* */ } onEvent(n, d); });
    });
  }
  function refreshAll() {
    A.loadFriends(); A.loadGames(); A.refreshMe().then(null, function () { /* */ });
    if (S.tab === 'top') A.loadTop();
    if (S.cur && S.cur.kind === 'online') S.cur.refetch();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.me) refreshAll(); });

  function goTab(v) { A.closeAll(); ACT.tab({ dataset: { v: v } }); }
  function onEvent(n, d) {
    if (!S.me) return;
    if (n === 'friends') {
      A.loadFriends();
      if (d.notify === 'request') { A.toast(t('requestFrom', { name: d.from.name }), '', { label: t('openGame'), fn: function () { goTab('friends'); } }); A.sfx('notify'); }
      else if (d.notify === 'accepted') { A.toast(t('friendAdded', { name: d.from.name }), 'ok'); A.sfx('notify'); }
    } else if (n === 'chat') {
      if (S.chat && S.chat.fid === d.from) { S.chat.append(d.msg); A.api('GET', '/api/chat/' + d.from).then(null, function () { /* */ }); }
      else { A.toast(d.user.name + ': ' + d.msg.t.slice(0, 60), '', { label: t('openChat'), fn: function () { A.openChat(d.from); } }); A.sfx('notify'); }
      A.loadFriends();
    } else if (n === 'challenge') {
      A.loadFriends(); A.sfx('notify');
      A.toast(t('challengeFrom', { name: d.challenge.from.name }), '', { label: t('openGame'), fn: function () { goTab('play'); } });
    } else if (n === 'challenge_gone') A.loadFriends();
    else if (n === 'matched') {
      S.queue = false; A.sfx('notify'); A.loadGames(); A.toast(t('gameStarted'), 'ok'); A.openGame(d.gameId);
    } else if (n === 'game') {
      var g = d.game;
      if (S.cur && S.cur.kind === 'online' && S.cur.id === g.id) S.cur.setOnline(g);
      else {
        A.loadGames();
        if (!g.over && g.moves.length > 0 && g.turn === g.myColor) {
          var o = g.myColor === 'w' ? g.black : g.white;
          A.toast(t('oppMoved', { name: o.name }), '', { label: t('openGame'), fn: function () { A.openGame(g.id); } }); A.sfx('notify');
        }
      }
    } else if (n === 'me') A.refreshMe().then(null, function () { /* */ });
  }

  /* ---------- Bosish va kiritish ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button') {
      e.preventDefault(); e.target.click();
    }
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'fsearch') A.onSearch(e.target.value); });

  /* ---------- Boshlash ---------- */
  function readStartParam() {
    var sp = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param, q = new URLSearchParams(location.search).get('f');
    if (sp && sp.indexOf('f_') === 0) S.pendingFriend = sp.slice(2);
    else if (q) S.pendingFriend = q;
  }
  function netError() {
    A.app.innerHTML = '<div class="splash"><div class="empty"><div class="big">📡</div><b>' + esc(t('e_network')) + '</b><button class="btn primary" style="margin-top:14px" data-act="retry">' + ic('refresh') + ' OK</button></div></div>';
  }
  ACT.retry = function () { boot(); };

  function boot() {
    A.applyLang(A.detectLang());
    A.app.innerHTML = '<div class="splash"><span class="spinner"></span></div>';
    readStartParam();
    fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) { S.cfg = c; }, function () { /* */ }).then(function () {
      if (S.token) {
        return A.api('GET', '/api/me', null, { quiet: true }).then(function (r) { S.me = r.me; A.applyLang(r.me.lang); startApp(); return true; }, function (e) {
          if (e.code === 'network') { netError(); return true; }
          S.token = null; A.ls.del('token'); return false;
        });
      }
      return false;
    }).then(function (done) {
      if (done) return;
      if (A.inTg && S.cfg.telegram) {
        return A.api('POST', '/api/auth/telegram', { initData: tg.initData }, { quiet: true }).then(onLoggedIn, function () { renderAuth('login'); });
      }
      renderAuth(S.pendingFriend ? 'register' : 'login');
    });
  }
  if (tg) {
    try {
      tg.ready(); tg.expand(); tg.setHeaderColor('#0a1020'); tg.setBackgroundColor('#0a1020');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch (e) { /* */ }
  }
  boot();
})();
