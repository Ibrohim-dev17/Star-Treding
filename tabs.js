/* Asosiy ekranlar: O'yin, Reyting, Profil va pastki menyu */
(function () {
  'use strict';
  var A = window.A, S = A.S, esc = A.esc, ic = A.ic, ACT = A.ACT = A.ACT || {};
  var TABS = [['play', 'grid', 'tabPlay'], ['friends', 'users', 'tabFriends'], ['top', 'trophy', 'tabTop'], ['profile', 'user', 'tabProfile']];
  var THEMES = { registon: ['#efe3bf', '#2f8f93'], classic: ['#eeeed2', '#769656'], walnut: ['#e8c9a0', '#a8683e'], slate: ['#cfd8e3', '#5d7694'] };

  function badgeFor(k) {
    var n = 0;
    if (k === 'play' && S.games) n = S.games.filter(A.isMyTurnGame).length;
    if (k === 'friends' && S.friends) {
      n = S.friends.friends.reduce(function (a, f) { return a + f.unread; }, 0) + S.friends.incoming.length + S.friends.challenges.length;
    }
    return n;
  }
  A.renderTabbar = function () {
    var nav = A.$('#tabbar');
    if (!nav) return;
    nav.innerHTML = TABS.map(function (x) {
      var b = badgeFor(x[0]);
      return '<button class="tab ' + (S.tab === x[0] ? 'on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + ic(x[1]) +
        '<span>' + esc(t(x[2])) + '</span>' + (b ? '<span class="badge">' + b + '</span>' : '') + '</button>';
    }).join('');
  };
  A.renderTab = function () {
    var c = A.$('#tabc');
    if (!c) return;
    var st = c.scrollTop;
    if (S.tab === 'friends') A.renderFriends(); else if (S.tab === 'top') renderTop();
    else if (S.tab === 'profile') renderProfile(); else renderPlay();
    c.scrollTop = st; A.renderTabbar();
  };
  ACT.tab = function (el) {
    var v = el.dataset.v;
    if (S.tab !== v) { S.tab = v; A.ls.set('tab', v); A.$('#tabc').scrollTop = 0; }
    A.renderTab();
    if (v === 'friends') A.loadFriends(); else if (v === 'play') A.loadGames(); else if (v === 'top') A.loadTop();
  };

  /* ---------- O'yin ---------- */
  function outcome(g) {
    if (g.reason === 'aborted') return { cls: '', label: t('aborted') };
    var won = (g.result === '1-0' && g.myColor === 'w') || (g.result === '0-1' && g.myColor === 'b');
    var d = g.ratingChange ? g.ratingChange[g.myColor] : null, ds = d ? ' ' + (d > 0 ? '+' : '') + d : '';
    if (g.result === '1/2-1/2') return { cls: '', label: t('draws') + ds };
    return won ? { cls: 'up', label: t('wins') + ds } : { cls: 'down', label: t('losses') + ds };
  }
  function gameItem(g) {
    var o = g.myColor === 'w' ? g.black : g.white, end;
    if (!g.over) end = A.isMyTurnGame(g) ? '<span class="rating-pill">' + esc(t('yourTurn')) + '</span>' : '<span class="sub">' + esc(t('oppTurn')) + '</span>';
    else { var oc = outcome(g); end = '<span class="delta ' + oc.cls + '">' + esc(oc.label) + '</span>'; }
    return '<div class="item" data-act="opengame" data-id="' + g.id + '" role="button" tabindex="0">' + A.avatar(o, '', true) +
      '<div class="grow"><div class="name ellipsis">' + esc(o.name) + '</div><div class="meta">' + esc(t('movesCount', { n: g.moves })) + ' · ' + esc(A.timeLabel(g.timeKey)) + '</div></div>' +
      '<div class="end">' + end + '</div></div>';
  }
  function savedAi() {
    try { var s = JSON.parse(A.ls.get('ai')); return s && s.moves ? s : null; } catch (e) { return null; }
  }
  function renderPlay() {
    var ch = S.friends ? S.friends.challenges : [], h = '', ai = savedAi(), times = S.cfg.times || [];
    h += '<div class="page-title"><span>♟ ' + esc(t('app')) + '</span><span class="rating-pill">' + S.me.rating + '</span></div>';
    ch.forEach(function (x) { h += A.challengeCard(x); });
    h += '<div class="card hero"><h3>' + esc(t('quickTitle')) + '</h3><p>' + esc(t('quickDesc')) + '</p><div class="chips" style="margin-bottom:14px">' +
      times.map(function (k) { return '<button class="chip ' + (k === S.time ? 'on' : '') + '" data-act="qtime" data-v="' + k + '">' + esc(A.timeLabel(k)) + '</button>'; }).join('') + '</div>' +
      (S.queue ? '<div class="search-card"><span class="spinner"></span><div class="grow"><b>' + esc(t('searching')) + '</b></div><button class="btn sm" data-act="qcancel">' + esc(t('cancelSearch')) + '</button></div>'
        : '<button class="btn primary block" data-act="qstart">' + esc(t('findOpponent')) + '</button>') + '</div>';
    h += '<button class="card tap" style="width:100%;text-align:left" data-act="gofriends"><div class="row"><div class="grow"><h3>' + esc(t('friendsPlay')) + '</h3><p style="margin:0">' + esc(t('friendsPlayDesc')) +
      '</p></div><span style="color:var(--accent);width:28px">' + ic('next') + '</span></div></button>';
    h += '<div class="card"><h3>' + esc(t('vsComputer')) + '</h3><p>' + esc(t('vsComputerDesc')) + '</p><div class="seg" style="margin-bottom:12px">' +
      [1, 2, 3, 4].map(function (l) { return '<button class="' + (S.aiLevel === l ? 'on' : '') + '" data-act="ailvl" data-v="' + l + '">' + esc(t('lvl' + l)) + '</button>'; }).join('') + '</div>' +
      '<span class="field-label" style="margin-top:0">' + esc(t('youPlay')) + '</span><div class="seg">' +
      [['w', 'white'], ['r', 'random'], ['b', 'black']].map(function (c) { return '<button class="' + (S.aiColor === c[0] ? 'on' : '') + '" data-act="aicolor" data-v="' + c[0] + '">' + esc(t(c[1])) + '</button>'; }).join('') + '</div>' +
      '<button class="btn primary block" style="margin-top:14px" data-act="aistart">' + esc(t('startGame')) + '</button>' +
      (ai ? '<button class="btn block" style="margin-top:8px" data-act="aicont">' + esc(t('continueAi')) + ' · ' + esc(t('continueAiDesc', { n: ai.moves.length })) + '</button>' : '') + '</div>';
    h += '<div class="sec-title">' + esc(t('myGames')) + '</div>';
    if (!S.games) h += '<div class="center" style="padding:20px"><span class="spinner"></span></div>';
    else if (!S.games.length) h += '<div class="empty"><div class="big">♞</div>' + esc(t('noGames')) + '</div>';
    else h += '<div class="list">' + S.games.slice(0, 10).map(gameItem).join('') + '</div>';
    A.$('#tabc').innerHTML = h;
  }
  ACT.opengame = function (el) { A.openGame(el.dataset.id); };
  ACT.gofriends = function () { ACT.tab({ dataset: { v: 'friends' } }); };
  ACT.qtime = function (el) { S.time = el.dataset.v; A.ls.set('time', S.time); renderPlay(); };
  ACT.ailvl = function (el) { S.aiLevel = +el.dataset.v; A.ls.set('aiLevel', S.aiLevel); renderPlay(); };
  ACT.aicolor = function (el) { S.aiColor = el.dataset.v; A.ls.set('aiColor', S.aiColor); renderPlay(); };
  ACT.aistart = function () { A.openAi({ level: S.aiLevel, color: S.aiColor }); };
  ACT.aicont = function () { A.openAi({ resume: true }); };
  ACT.qstart = function () {
    S.queue = true; renderPlay();
    A.api('POST', '/api/queue', { time: S.time }).then(function (r) {
      if (r.gameId) { S.queue = false; A.openGame(r.gameId); }
    }, function (e) { S.queue = false; renderPlay(); A.errToast(e); });
  };
  ACT.qcancel = function () { S.queue = false; renderPlay(); A.api('POST', '/api/queue/cancel').then(null, function () { /* */ }); };

  /* ---------- Reyting ---------- */
  function topRow(p, i) {
    return '<div class="item' + (p.id === S.me.id ? ' me-row' : '') + '" data-act="user" data-id="' + p.id + '" role="button" tabindex="0"><span class="rank-num">' + (i + 1) + '</span>' +
      A.avatar(p, 'sm', true) + '<div class="grow"><div class="name ellipsis">' + esc(p.name) + '</div><div class="meta">' + esc(t('gamesCount', { n: p.wins + p.losses + p.draws })) + '</div></div>' +
      '<div class="end"><span class="rating-pill">' + p.rating + '</span></div></div>';
  }
  function renderTop() {
    var d = S.top, h = '<div class="page-title"><span>' + esc(t('topTitle')) + '</span></div>';
    if (!d) h += '<div class="center" style="padding:30px"><span class="spinner"></span></div>';
    else if (!d.players.length) h += '<div class="empty"><div class="big">🏆</div>' + esc(t('noPlayers')) + '</div>';
    else {
      var pl = d.players, rest = pl;
      if (d.myRank) h += '<div class="card hero row"><div class="grow"><div class="sub">' + esc(t('yourRank')) + '</div><b style="font-size:26px">#' + d.myRank + '</b></div><span class="rating-pill" style="font-size:16px">' + S.me.rating + '</span></div>';
      if (pl.length >= 3) {
        var pod = function (p, i, cls, medal) {
          return '<div class="pod ' + cls + '" data-act="user" data-id="' + p.id + '"><div class="medal">' + medal + '</div>' + A.avatar(p, '', true) +
            '<div class="pn ellipsis">' + esc(p.name) + '</div><span class="rating-pill">' + p.rating + '</span></div>';
        };
        h += '<div class="podium">' + pod(pl[1], 1, '', '🥈') + pod(pl[0], 0, 'p1', '🥇') + pod(pl[2], 2, '', '🥉') + '</div>';
        rest = pl.slice(3);
        h += rest.length ? '<div class="list">' + rest.map(function (p, i) { return topRow(p, i + 3); }).join('') + '</div>' : '';
      } else h += '<div class="list">' + rest.map(topRow).join('') + '</div>';
    }
    A.$('#tabc').innerHTML = h;
  }
  A.loadTop = function () {
    return A.api('GET', '/api/leaderboard').then(function (r) { S.top = r; if (S.tab === 'top') A.renderTab(); }, function () { /* */ });
  };

  /* ---------- Profil ---------- */
  function renderProfile() {
    var m = S.me, old = A.$('#pname'), nameVal = old ? old.value : m.name, h = '';
    h += '<div class="profile-head">' + A.avatar(m, 'lg') + '<h2>' + esc(m.name) + '</h2><div class="sub">@' + esc(m.username) + (m.tg ? ' · Telegram' : '') + '</div></div>';
    h += '<div class="stats"><div class="stat gold"><b>' + m.rating + '</b><span>' + esc(t('rating')) + '</span></div><div class="stat win"><b>' + m.wins + '</b><span>' + esc(t('wins')) +
      '</span></div><div class="stat"><b>' + m.draws + '</b><span>' + esc(t('draws')) + '</span></div><div class="stat loss"><b>' + m.losses + '</b><span>' + esc(t('losses')) + '</span></div></div>';
    h += '<div class="card"><span class="field-label" style="margin-top:0">' + esc(t('name')) + '</span><div class="row"><input class="input" id="pname" maxlength="40" value="' + esc(nameVal) + '"><button class="btn primary" data-act="savename">' + esc(t('save')) + '</button></div>' +
      '<span class="field-label">' + esc(t('avatarColor')) + '</span><div class="swatches">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<button class="swatch a' + i + (m.avatar === i ? ' on' : '') + '" data-act="pavatar" data-v="' + i + '" aria-label="' + i + '"></button>'; }).join('') + '</div></div>';
    h += '<div class="card"><span class="field-label" style="margin-top:0">' + esc(t('language')) + '</span><div class="seg">' +
      t.langs.map(function (l) { return '<button class="' + (t.get() === l[0] ? 'on' : '') + '" data-act="plang" data-v="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
      '<span class="field-label">' + esc(t('boardTheme')) + '</span><div class="theme-grid">' +
      Object.keys(THEMES).map(function (k) {
        return '<button class="theme-btn ' + (S.theme === k ? 'on' : '') + '" data-act="ptheme" data-v="' + k + '"><div class="sw"><i style="background:' + THEMES[k][0] + '"></i><i style="background:' + THEMES[k][1] +
          '"></i><i style="background:' + THEMES[k][1] + '"></i><i style="background:' + THEMES[k][0] + '"></i></div>' + esc(t('th_' + k)) + '</button>';
      }).join('') + '</div>' +
      '<div class="row" style="margin-top:16px"><span class="grow" style="font-weight:700">' + esc(t('sound')) + '</span><button class="toggle ' + (S.sound ? 'on' : '') + '" data-act="psound" aria-label="' + esc(t('sound')) + '"></button></div></div>';
    h += '<div class="list"><button class="item" data-act="ppass"><span style="width:22px">' + ic('lock') + '</span><span class="grow name">' + esc(t('changePassword')) + '</span></button>' +
      '<button class="item" data-act="pblocked"><span style="width:22px">' + ic('ban') + '</span><span class="grow name">' + esc(t('blockedUsers')) + '</span></button>' +
      (A.inTg ? '' : '<button class="item" data-act="plogout" style="color:var(--danger)"><span style="width:22px">' + ic('logout') + '</span><span class="grow name">' + esc(t('logout')) + '</span></button>') + '</div>';
    A.$('#tabc').innerHTML = h;
  }
  function saveMe(body) {
    return A.api('POST', '/api/me', body).then(function (r) { S.me = r.me; return r; }, function (e) { A.errToast(e); throw e; });
  }
  ACT.savename = function () {
    var v = (A.$('#pname').value || '').trim();
    if (!v) return;
    saveMe({ name: v }).then(function () { A.toast(t('saved'), 'ok'); renderProfile(); }, function () { /* */ });
  };
  ACT.pavatar = function (el) { saveMe({ avatar: +el.dataset.v }).then(renderProfile, function () { /* */ }); };
  ACT.plang = function (el) {
    A.applyLang(el.dataset.v);
    saveMe({ lang: el.dataset.v }).then(null, function () { /* */ });
    A.renderMain();
  };
  ACT.ptheme = function (el) { S.theme = el.dataset.v; A.ls.set('theme', S.theme); renderProfile(); };
  ACT.psound = function () { S.sound = !S.sound; A.ls.set('sound', S.sound ? '1' : '0'); renderProfile(); if (S.sound) A.sfx('notify'); };
  ACT.plogout = function () {
    A.confirmBox(t('confirmLogout'), '', t('logout'), true).then(function (ok) { if (ok) A.logout(); });
  };
  ACT.ppass = function () {
    var has = S.me.hasPassword, l = A.openSheet('<h3>' + esc(t('changePassword')) + '</h3><form id="pwf" style="display:grid;gap:10px">' +
      (has ? '<input class="input" type="password" id="pw0" placeholder="' + esc(t('oldPassword')) + '" autocomplete="current-password">' : '') +
      '<input class="input" type="password" id="pw1" placeholder="' + esc(t('newPassword')) + '" autocomplete="new-password"><div class="hint-text">' + esc(t('passwordHint')) +
      '</div><div class="err-text" id="pwe"></div><button class="btn primary block" type="submit">' + esc(t('save')) + '</button></form>');
    l.el.querySelector('#pwf').addEventListener('submit', function (e) {
      e.preventDefault();
      A.api('POST', '/api/password', { oldPassword: has ? l.el.querySelector('#pw0').value : '', newPassword: l.el.querySelector('#pw1').value }).then(function () {
        S.me.hasPassword = true; A.closeLayer(l); A.toast(t('passwordChanged'), 'ok');
      }, function (er) { l.el.querySelector('#pwe').textContent = A.errMsg(er); });
    });
  };
  ACT.pblocked = function () {
    var l = A.openSheet('<h3>' + esc(t('blockedUsers')) + '</h3><div class="sbody" id="blk"><span class="spinner"></span></div>');
    function load() {
      A.api('GET', '/api/blocked').then(function (r) {
        var box = l.el.querySelector('#blk');
        if (!box) return;
        box.innerHTML = r.users.length ? '<div class="list">' + r.users.map(function (u) {
          return '<div class="item">' + A.avatar(u, 'sm') + '<div class="grow name">' + esc(u.name) + '</div><button class="btn sm" data-act="unblock" data-id="' + u.id + '">' + esc(t('unblock')) + '</button></div>';
        }).join('') + '</div>' : '<div class="empty">' + esc(t('none')) + '</div>';
      }, A.errToast);
    }
    A.reloadBlocked = load; load();
  };
  ACT.unblock = function (el) {
    A.api('POST', '/api/friends/unblock', { id: el.dataset.id }).then(function () { if (A.reloadBlocked) A.reloadBlocked(); }, A.errToast);
  };
})();
