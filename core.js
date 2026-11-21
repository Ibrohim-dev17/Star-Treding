/* Umumiy yordamchilar: holat, API, ovoz, xabarlar, oynalar. Hammasi window.A ichida. */
(function () {
  'use strict';
  var A = window.A = {};
  var ls = A.ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
  };
  var tg = A.tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  A.inTg = !!(tg && tg.initData);
  A.app = document.getElementById('app');
  A.$ = function (s, r) { return (r || document).querySelector(s); };

  var TABS = ['play', 'friends', 'top', 'profile'];
  var S = A.S = {
    token: ls.get('token'), me: null, cfg: { times: ['1+0', '3+0', '3+2', '5+0', '10+0', '15+10', 'none'] },
    tab: TABS.indexOf(ls.get('tab')) >= 0 ? ls.get('tab') : 'play',
    theme: ls.get('theme') || 'registon', sound: ls.get('sound') !== '0',
    friends: null, games: null, top: null, queue: false,
    time: ls.get('time') || '10+0', aiLevel: +ls.get('aiLevel') || 2, aiColor: ls.get('aiColor') || 'w',
    chTime: '10+0', chColor: 'r', stack: [], sse: null, cur: null, chat: null, pendingFriend: null
  };

  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var esc = A.esc;

  var IC = {
    back: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    flip: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>', eq: '<path d="M5 9h14M5 15h14"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    uplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    check: '<path d="M5 12l5 5L20 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    play: '<path d="M7 4l13 8-13 8z"/>', refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    first: '<path d="M17 18l-6-6 6-6M7 6v12"/>', last: '<path d="M7 6l6 6-6 6M17 6v12"/>'
  };
  A.ic = function (n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
  };

  /* ---------- Til ---------- */
  A.applyLang = function (l) {
    t.set(l); ls.set('lang', t.get());
    document.documentElement.lang = t.get(); document.title = t('app');
  };
  A.detectLang = function () {
    var c = ls.get('lang');
    if (c) return c;
    var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    return t.detect(u && u.language_code) || t.detect(navigator.language) || 'uz';
  };

  /* ---------- Ovoz va tebranish ---------- */
  var actx = null;
  function tone(f, d, type, v, delay) {
    var t0 = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v || 0.15, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + d + 0.02);
  }
  var SND = {
    move: function () { tone(420, 0.06, 'triangle', 0.2); },
    capture: function () { tone(260, 0.08, 'square', 0.12); tone(180, 0.1, 'triangle', 0.18, 0.03); },
    check: function () { tone(660, 0.08, 'square', 0.1); tone(880, 0.12, 'square', 0.1, 0.09); },
    notify: function () { tone(740, 0.09, 'sine', 0.15); tone(988, 0.12, 'sine', 0.15, 0.1); },
    end: function () { tone(523, 0.14, 'sine', 0.18); tone(659, 0.14, 'sine', 0.18, 0.14); tone(784, 0.25, 'sine', 0.18, 0.28); }
  };
  A.sfx = function (n) {
    if (!S.sound) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      SND[n]();
    } catch (e) { /* ovoz ishlamasa ham mayli */ }
  };
  A.sfxSan = function (san) { return /[+#]/.test(san) ? 'check' : /x/.test(san) ? 'capture' : 'move'; };
  A.hap = function (k) { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(k || 'light'); } catch (e) { /* */ } };

  /* ---------- Xabarlar ---------- */
  A.toast = function (msg, kind, action) {
    var box = document.getElementById('toasts'), el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = '<span class="grow">' + esc(msg) + '</span>' + (action ? '<button class="btn sm primary">' + esc(action.label) + '</button>' : '');
    var rm = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    if (action) el.querySelector('button').onclick = function () { rm(); action.fn(); };
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(rm, action ? 6500 : 3500);
  };
  A.errMsg = function (e) {
    var k = 'e_' + (e && e.code || 'server_error'), s = t(k);
    return s === k ? t('e_server_error') : s;
  };
  A.errToast = function (e) { A.toast(A.errMsg(e), 'err'); };

  /* ---------- API ---------- */
  A.api = function (method, path, body, opts) {
    return fetch(path, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': S.token ? 'Bearer ' + S.token : '' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var er = new Error(j.error || 'server_error');
          er.code = j.error || 'server_error'; er.status = r.status;
          if (r.status === 401 && S.token && !(opts && opts.quiet)) A.forceLogout();
          throw er;
        }
        return j;
      });
    }, function () { var er = new Error('network'); er.code = 'network'; throw er; });
  };

  /* ---------- Qatlamlar (oynalar): orqaga tugmasi bilan yopiladi ---------- */
  function backBtn() {
    if (!tg || !tg.BackButton) return;
    try { if (S.stack.length) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) { /* */ }
  }
  A.pushLayer = function (l) { S.stack.push(l); backBtn(); return l; };
  A.closeLayer = function (l) {
    var i = S.stack.indexOf(l);
    if (i < 0) return;
    S.stack.splice(i, 1); l.close(); backBtn();
  };
  A.closeTop = function () { var l = S.stack[S.stack.length - 1]; if (l) A.closeLayer(l); };
  A.closeAll = function () { while (S.stack.length) A.closeTop(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') A.closeTop(); });
  if (tg) { try { tg.BackButton.onClick(A.closeTop); } catch (e) { /* */ } }

  A.openSheet = function (html, onClose) {
    var ov = document.createElement('div'), layer;
    ov.className = 'overlay';
    ov.innerHTML = '<div class="sheet" role="dialog"><div class="grab"></div>' + html + '</div>';
    layer = { el: ov, body: ov.firstChild, close: function () { if (ov.parentNode) ov.parentNode.removeChild(ov); if (onClose) onClose(); } };
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) A.closeLayer(layer); });
    A.app.appendChild(ov); A.pushLayer(layer);
    return layer;
  };
  /* o: {emoji,title,text,html,buttons:[{label,cls,fn}]} */
  A.openModal = function (o) {
    var ov = document.createElement('div'), layer, h = '';
    ov.className = 'overlay mid';
    if (o.emoji) h += '<div class="big-emoji">' + o.emoji + '</div>';
    h += '<h3>' + esc(o.title || '') + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') + (o.html || '');
    h += '<div class="btns ' + (o.buttons.length === 2 && o.twoCols ? 'two' : '') + '">' +
      o.buttons.map(function (b, i) { return '<button class="btn ' + (b.cls || '') + '" data-mb="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div>';
    ov.innerHTML = '<div class="modal" role="dialog">' + h + '</div>';
    layer = { el: ov, close: function () { if (ov.parentNode) ov.parentNode.removeChild(ov); if (o.onClose) o.onClose(); } };
    ov.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-mb]') : null;
      if (b) { var fn = o.buttons[+b.dataset.mb].fn; A.closeLayer(layer); if (fn) fn(); }
      else if (e.target === ov) A.closeLayer(layer);
    });
    A.app.appendChild(ov); A.pushLayer(layer);
    return layer;
  };
  A.confirmBox = function (title, text, okLabel, danger) {
    return new Promise(function (res) {
      var done = false, fin = function (v) { if (!done) { done = true; res(v); } };
      A.openModal({
        title: title, text: text, twoCols: true, onClose: function () { fin(false); },
        buttons: [{ label: t('cancel'), fn: function () { fin(false); } }, { label: okLabel || t('ok'), cls: danger ? 'danger' : 'primary', fn: function () { fin(true); } }]
      });
    });
  };

  /* ---------- Kichik yordamchilar ---------- */
  A.avatar = function (u, cls, dot) {
    var n = String(u.name || u.username || '?').trim(), ch = Array.from(n)[0] || '?';
    return '<div class="avatar ' + (cls || '') + ' a' + (u.avatar || 0) + '">' + esc(ch) +
      (dot ? '<i class="dot ' + (u.online ? 'on' : '') + '"></i>' : '') + '</div>';
  };
  A.timeLabel = function (k) { return k === 'none' ? t('unlimited') : k; };
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  A.hhmm = function (ts) { var d = new Date(ts); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  A.dayLabel = function (ts) {
    var d = new Date(ts), n = new Date(), y = new Date(Date.now() - 86400000);
    if (d.toDateString() === n.toDateString()) return t('today');
    if (d.toDateString() === y.toDateString()) return t('yesterday');
    return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear();
  };
  A.copyText = function (s) {
    var done = function () { A.toast(t('copied'), 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = s; ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* */ }
      document.body.removeChild(ta);
    }
  };
  A.inviteLink = function () {
    var u = S.me.username, c = S.cfg;
    if (c.botUsername) return 'https://t.me/' + c.botUsername + (c.appName ? '/' + c.appName : '') + '?startapp=f_' + encodeURIComponent(u);
    return location.origin + '/?f=' + encodeURIComponent(u);
  };
  A.isMyTurnGame = function (g) { return !g.over && g.moves > 0 && g.turn === g.myColor; };
})();
