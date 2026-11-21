/* Ijtimoiy qism: do'stlar, qidiruv, chaqiriqlar, chat */
(function () {
  'use strict';
  var A = window.A, S = A.S, esc = A.esc, ic = A.ic, ACT = A.ACT = A.ACT || {};
  var sres = null, sq = '', sTimer = null;

  function post(path, body) { return A.api('POST', path, body); }
  function findFriend(id) {
    var l = S.friends ? S.friends.friends : [], i;
    for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function row(u, meta, end, act) {
    return '<div class="item"' + (act ? ' data-act="' + act + '" data-id="' + u.id + '" role="button" tabindex="0"' : '') + '>' + A.avatar(u, '', true) +
      '<div class="grow"><div class="name ellipsis">' + esc(u.name) + ' <span class="rating-pill">' + u.rating + '</span></div><div class="meta ellipsis">' + meta + '</div></div>' +
      '<div class="end">' + (end || '') + '</div></div>';
  }

  /* ---------- Ma'lumot yuklash ---------- */
  A.loadFriends = function () {
    return A.api('GET', '/api/friends').then(function (r) {
      S.friends = r; A.renderTabbar();
      if (S.tab === 'friends') fill(); else if (S.tab === 'play') A.renderTab();
    }, function () { /* */ });
  };
  A.loadGames = function () {
    return A.api('GET', '/api/games').then(function (r) {
      S.games = r.games; A.renderTabbar();
      if (S.tab === 'play') A.renderTab();
    }, function () { /* */ });
  };

  /* ---------- Chaqiriq kartasi ---------- */
  A.challengeCard = function (x) {
    var mine = x.color === 'r' ? t('random') : x.color === 'w' ? t('black') : t('white');
    return '<div class="card challenge-card"><div class="row">' + A.avatar(x.from, '', true) + '<div class="grow"><b>' + esc(t('challengeFrom', { name: x.from.name })) +
      '</b><div class="sub">' + esc(A.timeLabel(x.timeKey)) + ' · ' + esc(t('youPlay')) + ': ' + esc(mine) + '</div></div></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn gold grow" data-act="chacc" data-id="' + x.id + '">' + esc(t('accept')) + '</button>' +
      '<button class="btn" data-act="chdec" data-id="' + x.id + '" aria-label="' + esc(t('decline')) + '">' + ic('x') + '</button></div></div>';
  };
  ACT.chacc = function (el) {
    post('/api/challenge/accept', { id: el.dataset.id }).then(function (r) { A.openGame(r.gameId); }, function (e) { A.errToast(e); A.loadFriends(); });
  };
  ACT.chdec = function (el) { post('/api/challenge/decline', { id: el.dataset.id }).then(A.loadFriends, A.errToast); };

  /* ---------- Do'stlar ekrani ---------- */
  A.renderFriends = function () {
    A.$('#tabc').innerHTML = '<div class="page-title"><span>' + esc(t('friendsTitle')) + '</span><button class="btn sm primary" data-act="invite">' + ic('share') + ' ' + esc(t('invite')) + '</button></div>' +
      '<div class="search-box">' + ic('search') + '<input class="input" id="fsearch" placeholder="' + esc(t('searchUser')) + '" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="20" value="' + esc(sq) + '"></div>' +
      '<div id="fres"></div><div id="fbody"></div>';
    fillRes(); fill();
  };
  function fill() {
    var body = A.$('#fbody'), d = S.friends, h = '';
    if (!body) return;
    if (!d) { body.innerHTML = '<div class="center" style="padding:30px"><span class="spinner"></span></div>'; return; }
    d.challenges.forEach(function (c) { h += A.challengeCard(c); });
    if (d.incoming.length) {
      h += '<div class="sec-title">' + esc(t('requests')) + '</div><div class="list">' + d.incoming.map(function (u) {
        return row(u, '@' + esc(u.username), '<button class="btn sm primary" data-act="facc" data-id="' + u.id + '">' + esc(t('accept')) +
          '</button><button class="icon-btn" style="width:36px;height:36px" data-act="fdec" data-id="' + u.id + '" aria-label="' + esc(t('decline')) + '">' + ic('x') + '</button>');
      }).join('') + '</div>';
    }
    if (d.friends.length) {
      h += '<div class="sec-title">' + esc(t('friendsTitle')) + ' · ' + d.friends.length + '</div><div class="list">' + d.friends.map(function (f) {
        var meta = f.last ? (f.last.mine ? esc(t('you')) + ': ' : '') + esc(f.last.t) : (f.online ? '<span class="dot-live"></span> ' + esc(t('online')) : esc(t('offline')));
        return row(f, meta, (f.unread ? '<span class="badge">' + f.unread + '</span>' : '') +
          '<button class="icon-btn" data-act="fchall" data-id="' + f.id + '" aria-label="' + esc(t('challenge')) + '">' + ic('play') + '</button>' +
          '<button class="icon-btn" data-act="fmore" data-id="' + f.id + '" aria-label="menu">' + ic('dots') + '</button>', 'fchat');
      }).join('') + '</div>';
    } else if (!d.incoming.length) {
      h += '<div class="empty"><div class="big">🤝</div><b>' + esc(t('noFriends')) + '</b>' + esc(t('noFriendsDesc')) +
        '<br><button class="btn primary" style="margin-top:14px" data-act="invite">' + ic('share') + ' ' + esc(t('invite')) + '</button></div>';
    }
    if (d.outgoing.length) {
      h += '<div class="sec-title">' + esc(t('pendingOut')) + '</div><div class="list">' + d.outgoing.map(function (u) {
        return row(u, '@' + esc(u.username), '<button class="icon-btn" style="width:36px;height:36px" data-act="fdec" data-id="' + u.id + '" aria-label="' + esc(t('cancel')) + '">' + ic('x') + '</button>');
      }).join('') + '</div>';
    }
    body.innerHTML = h;
  }
  function fillRes() {
    var box = A.$('#fres');
    if (!box) return;
    if (sq.length < 2) { box.innerHTML = ''; return; }
    if (sres === null) { box.innerHTML = '<div class="center" style="padding:14px"><span class="spinner"></span></div>'; return; }
    box.innerHTML = '<div class="sec-title">' + esc(t('searchUser')) + '</div>' + (sres.length ? '<div class="list">' + sres.map(function (u) {
      var end = u.relation === 'friend' ? '<span class="sub">✓ ' + esc(t('alreadyFriend')) + '</span>'
        : u.relation === 'sent' ? '<span class="sub">' + esc(t('requestSent')) + '</span>'
          : '<button class="btn sm primary" data-act="freq" data-id="' + u.id + '">' + ic('uplus') + ' ' + esc(u.relation === 'received' ? t('accept') : t('add')) + '</button>';
      return row(u, '@' + esc(u.username), end);
    }).join('') + '</div>' : '<div class="empty">' + esc(t('noResults')) + '</div>');
  }
  A.onSearch = function (v) {
    sq = v.trim(); sres = null; clearTimeout(sTimer);
    if (sq.length < 2) { fillRes(); return; }
    fillRes();
    var mine = sq;
    sTimer = setTimeout(function () {
      A.api('GET', '/api/users/search?q=' + encodeURIComponent(mine)).then(function (r) { if (mine === sq) { sres = r.users; fillRes(); } }, function () { if (mine === sq) { sres = []; fillRes(); } });
    }, 300);
  };
  ACT.freq = function (el) {
    post('/api/friends/request', { id: el.dataset.id }).then(function (r) {
      A.toast(r.friends ? t('friendAdded', { name: '' }).replace('  ', ' ') : t('requestSent'), 'ok');
      if (sres) sres.forEach(function (u) { if (u.id === el.dataset.id) u.relation = r.friends ? 'friend' : 'sent'; });
      fillRes(); A.loadFriends();
    }, A.errToast);
  };
  ACT.facc = function (el) { post('/api/friends/accept', { id: el.dataset.id }).then(A.loadFriends, A.errToast); };
  ACT.fdec = function (el) { post('/api/friends/decline', { id: el.dataset.id }).then(A.loadFriends, A.errToast); };
  ACT.fchat = function (el) { A.openChat(el.dataset.id); };
  ACT.fchall = function (el) { var f = findFriend(el.dataset.id); if (f) A.openChallengeSheet(f); };
  ACT.invite = function () {
    var link = A.inviteLink();
    if (A.tg && A.inTg) { try { A.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(t('inviteMsg'))); return; } catch (e) { /* */ } }
    if (navigator.share) { navigator.share({ title: t('app'), text: t('inviteMsg'), url: link }).then(null, function () { /* bekor */ }); return; }
    A.copyText(link);
  };

  /* ---------- Do'st menyusi ---------- */
  function friendSheet(f) {
    var l = A.openSheet('<div class="row" style="margin-bottom:14px">' + A.avatar(f, '', true) + '<div class="grow"><b>' + esc(f.name) + '</b><div class="sub">@' + esc(f.username) +
      '</div></div><span class="rating-pill">' + f.rating + '</span></div><div class="list">' +
      '<button class="item" data-sh="chall"><span style="width:22px">' + ic('play') + '</span><span class="grow name">' + esc(t('challenge')) + '</span></button>' +
      '<button class="item" data-sh="chat"><span style="width:22px">' + ic('chat') + '</span><span class="grow name">' + esc(t('openChat')) + '</span></button>' +
      '<button class="item" data-sh="remove" style="color:var(--danger)"><span style="width:22px">' + ic('x') + '</span><span class="grow name">' + esc(t('removeFriend')) + '</span></button>' +
      '<button class="item" data-sh="block" style="color:var(--danger)"><span style="width:22px">' + ic('ban') + '</span><span class="grow name">' + esc(t('block')) + '</span></button></div>');
    l.el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-sh]') : null;
      if (!b) return;
      var k = b.dataset.sh;
      A.closeLayer(l);
      if (k === 'chall') A.openChallengeSheet(f);
      else if (k === 'chat') A.openChat(f.id);
      else A.confirmBox(k === 'remove' ? t('confirmRemove', { name: f.name }) : t('confirmBlock', { name: f.name }), '', k === 'remove' ? t('removeFriend') : t('block'), true).then(function (ok) {
        if (!ok) return;
        if (S.chat && S.chat.fid === f.id) A.closeLayer(S.chat.layer);
        post(k === 'remove' ? '/api/friends/remove' : '/api/friends/block', { id: f.id }).then(A.loadFriends, A.errToast);
      });
    });
  }
  ACT.fmore = function (el) { var f = findFriend(el.dataset.id); if (f) friendSheet(f); };

  /* ---------- Chaqiriq yuborish ---------- */
  A.openChallengeSheet = function (f) {
    var l = A.openSheet('<h3>' + esc(t('challenge')) + ' · ' + esc(f.name) + '</h3><div id="chbox"></div>' +
      '<button class="btn primary block" style="margin-top:18px" id="chs">' + esc(t('sendChallenge')) + '</button>');
    function paint() {
      l.el.querySelector('#chbox').innerHTML = '<span class="field-label" style="margin-top:0">' + esc(t('chooseTime')) + '</span><div class="chips">' +
        (S.cfg.times || []).map(function (k) { return '<button class="chip ' + (k === S.chTime ? 'on' : '') + '" data-ct="' + k + '">' + esc(A.timeLabel(k)) + '</button>'; }).join('') +
        '</div><span class="field-label">' + esc(t('chooseColor')) + '</span><div class="seg">' +
        [['w', 'white'], ['r', 'random'], ['b', 'black']].map(function (c) { return '<button class="' + (S.chColor === c[0] ? 'on' : '') + '" data-cc="' + c[0] + '">' + esc(t(c[1])) + '</button>'; }).join('') + '</div>';
    }
    paint();
    l.el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-ct],[data-cc]') : null;
      if (b) { if (b.dataset.ct) S.chTime = b.dataset.ct; else S.chColor = b.dataset.cc; paint(); }
    });
    l.el.querySelector('#chs').addEventListener('click', function () {
      post('/api/challenge', { to: f.id, time: S.chTime, color: S.chColor }).then(function () { A.closeLayer(l); A.toast(t('challengeSent'), 'ok'); }, A.errToast);
    });
  };

  /* ---------- Reytingdagi o'yinchi ---------- */
  ACT.user = function (el) {
    var p = S.top && S.top.players.filter(function (x) { return x.id === el.dataset.id; })[0];
    if (!p) return;
    var me = p.id === S.me.id, fr = findFriend(p.id) || (me ? {} : null), act = '';
    if (!me) act = fr ? '<button class="btn primary block" data-us="chall">' + esc(t('challenge')) + '</button>' : '<button class="btn primary block" data-us="add">' + ic('uplus') + ' ' + esc(t('add')) + '</button>';
    var l = A.openSheet('<div class="profile-head" style="padding-top:0">' + A.avatar(p, 'lg', true) + '<h2>' + esc(p.name) + '</h2><div class="sub">@' + esc(p.username) + '</div></div>' +
      '<div class="stats" style="grid-template-columns:repeat(4,1fr)"><div class="stat gold"><b>' + p.rating + '</b><span>' + esc(t('rating')) + '</span></div><div class="stat win"><b>' + p.wins + '</b><span>' + esc(t('wins')) +
      '</span></div><div class="stat"><b>' + p.draws + '</b><span>' + esc(t('draws')) + '</span></div><div class="stat loss"><b>' + p.losses + '</b><span>' + esc(t('losses')) + '</span></div></div>' + act);
    l.el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-us]') : null;
      if (!b) return;
      A.closeLayer(l);
      if (b.dataset.us === 'chall') A.openChallengeSheet(fr);
      else post('/api/friends/request', { id: p.id }).then(function (r) { A.toast(r.friends ? t('friendAdded', { name: p.name }) : t('requestSent'), 'ok'); A.loadFriends(); }, A.errToast);
    });
  };

  /* ---------- Chat ekrani ---------- */
  A.openChat = function (fid) {
    if (S.chat) A.closeLayer(S.chat.layer);
    var f = findFriend(fid), el = document.createElement('div'), c, vvh;
    el.className = 'screen chat-screen';
    el.innerHTML = '<div class="chat-head"><button class="icon-btn" data-act="cback" aria-label="' + esc(t('back')) + '">' + ic('back') + '</button><span id="cav">' + (f ? A.avatar(f, 'sm', true) : '') +
      '</span><div class="grow"><b id="cnm">' + esc(f ? f.name : '') + '</b><div class="sub" id="cst"></div></div>' +
      '<button class="icon-btn" data-act="cchall" aria-label="' + esc(t('challenge')) + '">' + ic('play') + '</button><button class="icon-btn" data-act="cmore" aria-label="menu">' + ic('dots') + '</button></div>' +
      '<div class="msgs" id="cmsgs"><div class="center"><span class="spinner"></span></div></div>' +
      '<form class="composer" id="cform"><input class="input" id="cin" maxlength="500" autocomplete="off" placeholder="' + esc(t('typeMessage')) + '"><button class="send" type="submit" aria-label="' + esc(t('send')) + '">' + ic('send') + '</button></form>';
    A.app.appendChild(el);
    vvh = function () { if (window.visualViewport) el.style.height = window.visualViewport.height + 'px'; };
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', vvh); vvh(); }
    c = S.chat = { fid: fid, el: el, msgs: [], friend: f };
    c.layer = A.pushLayer({
      close: function () {
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', vvh);
        if (el.parentNode) el.parentNode.removeChild(el);
        if (S.chat === c) S.chat = null;
        A.loadFriends();
      }
    });
    c.append = function (m) { c.msgs.push(m); render(c); };
    el.querySelector('#cform').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = el.querySelector('#cin'), v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      var m = { f: S.me.id, t: v, ts: Date.now() };
      c.append(m);
      post('/api/chat/' + fid, { text: v }).then(null, function (er) {
        var i = c.msgs.indexOf(m);
        if (i >= 0) c.msgs.splice(i, 1);
        render(c); A.errToast(er);
      });
    });
    A.api('GET', '/api/chat/' + fid).then(function (r) {
      if (S.chat !== c) return;
      c.msgs = r.messages; c.friend = r.friend; render(c);
    }, function (er) { A.errToast(er); if (S.chat === c) A.closeLayer(c.layer); });
  };
  function render(c) {
    var box = c.el.querySelector('#cmsgs'), h = '', last = '', f = c.friend;
    if (f) {
      c.el.querySelector('#cav').innerHTML = A.avatar(f, 'sm', true); c.el.querySelector('#cnm').textContent = f.name;
      c.el.querySelector('#cst').textContent = f.online ? t('online') : t('offline');
    }
    if (!c.msgs.length) h = '<div class="empty" style="margin:auto">' + esc(t('noMessages')) + '</div>';
    c.msgs.forEach(function (m) {
      var d = A.dayLabel(m.ts);
      if (d !== last) { h += '<div class="day-sep">' + esc(d) + '</div>'; last = d; }
      h += '<div class="msg ' + (m.f === S.me.id ? 'me' : 'them') + '">' + esc(m.t) + '<time>' + A.hhmm(m.ts) + '</time></div>';
    });
    box.innerHTML = h; box.scrollTop = box.scrollHeight;
  }
  ACT.cback = function () { if (S.chat) A.closeLayer(S.chat.layer); };
  ACT.cchall = function () { if (S.chat && S.chat.friend) A.openChallengeSheet(S.chat.friend); };
  ACT.cmore = function () { if (S.chat && S.chat.friend) friendSheet(S.chat.friend); };
})();
