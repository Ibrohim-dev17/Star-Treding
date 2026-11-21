/* O'yin ekrani, 1-qism: holat, chizish. 2-qism (game-actions.js) harakatlarni qo'shadi. */
(function () {
  'use strict';
  var A = window.A, S = A.S, esc = A.esc, ic = A.ic;
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 }, INIT = { p: 8, n: 2, b: 2, r: 2, q: 1 };

  function opp(c) { return c === 'w' ? 'b' : 'w'; }
  A.opp = opp;
  function material(fen) {
    var cnt = {}, capW = [], capB = [], w = 0, b = 0, i, c, s = fen.split(' ')[0];
    for (i = 0; i < s.length; i++) { c = s.charAt(i); if (VAL[c.toLowerCase()]) cnt[c] = (cnt[c] || 0) + 1; }
    ['q', 'r', 'b', 'n', 'p'].forEach(function (k) {
      var nb = cnt[k] || 0, nw = cnt[k.toUpperCase()] || 0;
      w += nw * VAL[k]; b += nb * VAL[k];
      for (i = nb; i < INIT[k]; i++) capW.push(k);
      for (i = nw; i < INIT[k]; i++) capB.push(k.toUpperCase());
    });
    return { capW: capW, capB: capB, diff: w - b };
  }
  function fmtClock(ms) {
    if (ms < 10000) return (Math.floor(ms / 100) / 10).toFixed(1);
    var s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function GameView(kind) {
    this.kind = kind; this.moves = []; this.pos = []; this.chess = null; this.view = null; this.flip = false;
    this.myColor = 'w'; this.over = false; this.reason = null; this.winner = null;
    this.players = { w: null, b: null }; this.data = null; this.pending = false; this.thinking = false;
    this.hint = null; this.inited = false; this.resultShown = false; this.timer = null; this.off = 0;
    this.chatSeen = 0; this.chatLayer = null; this.worker = null; this.level = 2; this.reqId = 0; this.reqs = {};
    this.aiTok = 0; this.lastFetch = 0;
  }
  var P = GameView.prototype;
  A.GameView = GameView;

  P.q = function (s) { return this.el.querySelector(s); };

  P.mount = function () {
    var self = this, el = this.el = document.createElement('div');
    el.className = 'screen game';
    el.innerHTML =
      '<div class="g-top"><button class="icon-btn" data-act="gback" aria-label="' + esc(t('back')) + '">' + ic('back') + '</button>' +
      '<div class="title"><span id="gtitle"></span><small id="gsub"></small></div>' +
      '<button class="icon-btn" data-act="gflip" aria-label="' + esc(t('flip')) + '">' + ic('flip') + '</button></div>' +
      '<div class="g-body"><div id="pTop"></div><div class="board-wrap" id="bwrap"></div><div id="pBot"></div>' +
      '<div class="status-line" id="gstat"></div><div id="gbanner"></div>' +
      '<div class="movebar"><button class="icon-btn sm" data-act="gprev" aria-label="prev">' + ic('back') + '</button>' +
      '<div class="moves" id="gmoves"></div><button class="icon-btn sm" data-act="gnext" aria-label="next">' + ic('next') + '</button></div></div>' +
      '<div class="g-actions" id="gact"></div>';
    A.app.appendChild(el);
    this.board = new window.Board(this.q('#bwrap'), {
      legalFrom: function (sq) { return self.legalFrom(sq); },
      needsPromo: function (f, to) { return self.needsPromo(f, to); },
      onMove: function (f, to, p) { self.onMove(f, to, p); }
    });
    this.board.setTheme(S.theme);
    this.layer = A.pushLayer({ close: function () { self.destroy(); } });
    this.timer = setInterval(function () { self.tick(); }, 200);
  };

  P.destroy = function () {
    clearInterval(this.timer); this.aiTok++;
    if (this.worker) { try { this.worker.terminate(); } catch (e) { /* */ } this.worker = null; }
    if (this.chatLayer) A.closeLayer(this.chatLayer);
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    if (S.cur === this) S.cur = null;
    if (S.tab === 'play' && A.renderTab) A.renderTab();
  };

  /* Yurishlar ro'yxatidan pozitsiyalarni qayta quradi */
  P.derive = function () {
    var ch = new window.Chess(), pos = [{ fen: window.Chess.START, last: null, check: null }], i, m, r;
    for (i = 0; i < this.moves.length; i++) {
      m = this.moves[i];
      r = ch.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (!r) { this.moves.length = i; break; }
      m.san = r.san;
      pos.push({ fen: r.fen, last: [m.from, m.to], check: ch.inCheck() ? ch.kingSquare(ch.turn) : null });
    }
    this.chess = ch; this.pos = pos;
  };
  P.turn = function () { return this.pos[this.pos.length - 1].fen.split(' ')[1]; };
  P.interactive = function () {
    return this.view === null && !this.over && this.turn() === this.myColor && !this.thinking && !this.pending;
  };
  P.legalFrom = function (sq) {
    if (!this.interactive()) return [];
    return this.chess.moves(sq).reduce(function (a, m) {
      if (!a.some(function (x) { return x.to === m.to; })) a.push({ to: m.to, capture: !!m.captured });
      return a;
    }, []);
  };
  P.needsPromo = function (f, to) {
    return this.chess.moves(f).some(function (m) { return m.to === to && m.promotion; });
  };
  P.shownIdx = function () { return this.view === null ? this.pos.length - 1 : this.view; };

  P.update = function (animate) {
    if (!this.el) return;
    var idx = this.shownIdx(), p = this.pos[idx], bottom = this.flip ? opp(this.myColor) : this.myColor;
    this.board.set({
      fen: p.fen, flipped: bottom === 'b', last: p.last, check: p.check, hint: this.hint,
      movable: this.interactive() ? this.myColor : null,
      animate: animate && p.last ? { from: p.last[0], to: p.last[1] } : null
    });
    this.renderHeader(); this.renderPlayers(p, bottom); this.renderMoves(idx);
    this.renderStatus(p, idx); this.renderBanner(); this.renderActions(); this.tick();
  };

  P.renderHeader = function () {
    var title, sub;
    if (this.kind === 'ai') { title = t('vsComputer'); sub = t('lvl' + this.level); }
    else {
      var o = this.players[opp(this.myColor)];
      title = o ? o.name : '';
      sub = A.timeLabel(this.data.timeKey) + ' · ' + (this.data.rated ? t('rated') : t('casual'));
    }
    this.q('#gtitle').textContent = title; this.q('#gsub').textContent = sub;
  };

  P.bar = function (color, p) {
    var pl = this.players[color] || { name: '?', avatar: 0 }, m = material(p.fen), caps, adv, hasClock = this.data && this.data.clock;
    caps = (color === 'w' ? m.capW : m.capB).map(function (k) {
      return window.pieceSVG(k).replace('class="pc', 'class="mini pc');
    }).join('');
    adv = color === 'w' ? m.diff : -m.diff;
    return (pl.ai ? '<div class="avatar sm a2">🤖</div>' : A.avatar(pl, 'sm', this.kind === 'online' && color !== this.myColor)) +
      '<div class="grow"><div class="pname ellipsis">' + esc(pl.name) +
      (pl.rating ? ' <span class="rating-pill">' + pl.rating + '</span>' : '') + '</div>' +
      '<div class="cap-row">' + caps + (adv > 0 ? '<span class="adv">+' + adv + '</span>' : '') + '</div></div>' +
      (hasClock ? '<div class="clock" data-clk="' + color + '"></div>' : '');
  };
  P.renderPlayers = function (p, bottom) {
    var top = this.q('#pTop'), bot = this.q('#pBot');
    top.className = 'player'; bot.className = 'player';
    top.innerHTML = this.bar(opp(bottom), p); bot.innerHTML = this.bar(bottom, p);
  };

  P.renderMoves = function (idx) {
    var box = this.q('#gmoves'), h = '', i, cur;
    for (i = 0; i < this.moves.length; i++) {
      h += '<button class="mv' + (i + 1 === idx ? ' cur' : '') + '" data-act="gseek" data-i="' + (i + 1) + '">' +
        (i % 2 === 0 ? '<i>' + ((i >> 1) + 1) + '.</i>' : '') + esc(this.moves[i].san) + '</button>';
    }
    box.innerHTML = h;
    cur = box.querySelector('.cur');
    if (cur) box.scrollLeft = cur.offsetLeft - box.clientWidth / 2 + cur.offsetWidth / 2;
    else box.scrollLeft = 0;
  };

  P.resultText = function () {
    if (this.reason === 'aborted') return t('aborted');
    var s = t('r_' + this.reason);
    if (this.winner) s += ' · ' + (this.winner === 'w' ? t('whiteWon') : t('blackWon'));
    return s;
  };

  P.renderStatus = function (p, idx) {
    var el = this.q('#gstat'), txt = '', cls = '';
    if (this.over) { txt = this.resultText(); cls = this.winner && this.winner !== this.myColor ? 'bad' : this.winner ? 'turn' : 'warn'; }
    else if (this.view !== null) { txt = t('review') + ' ' + idx + '/' + this.moves.length; }
    else if (this.thinking) { txt = t('thinking'); cls = 'warn'; }
    else if (this.turn() === this.myColor) { txt = (p.check ? t('check') + ' ' : '') + t('yourTurn'); cls = 'turn'; }
    else txt = (p.check ? t('check') + ' ' : '') + t('oppTurn');
    el.className = 'status-line ' + cls; el.textContent = txt;
  };

  P.renderBanner = function () {
    var d = this.data, h = '';
    if (this.view !== null) {
      h = '<div class="banner">⏪<span class="grow">' + esc(t('review')) + '</span><button class="btn sm primary" data-act="glive">' + esc(t('backToLive')) + '</button></div>';
    } else if (this.kind === 'online' && d && !this.over && d.drawOffer && d.drawOffer !== this.myColor) {
      h = '<div class="banner">🤝<span class="grow">' + esc(t('oppOffersDraw')) + '</span>' +
        '<button class="btn sm primary" data-act="gdrawacc">' + esc(t('accept')) + '</button>' +
        '<button class="btn sm" data-act="gdrawdec" aria-label="' + esc(t('decline')) + '">' + ic('x') + '</button></div>';
    } else if (this.kind === 'online' && d && this.over && d.rematch && d.rematch !== this.myColor && !d.rematchGame) {
      h = '<div class="banner">🔁<span class="grow">' + esc(t('rematchOffer')) + '</span><button class="btn sm primary" data-act="grematch">' + esc(t('accept')) + '</button></div>';
    }
    this.q('#gbanner').innerHTML = h;
  };

  P.chatUnread = function () {
    var me = this.myColor;
    return this.data && this.data.chat ? this.data.chat.slice(this.chatSeen).filter(function (c) { return c.c !== me; }).length : 0;
  };

  P.renderActions = function () {
    var d = this.data, b = [], on = this.kind === 'online';
    function btn(act, icon, label, extra, cls) {
      return '<button class="btn ' + (cls || '') + '" data-act="' + act + '"' + (extra || '') + '>' + ic(icon) + '<span>' + esc(label) + '</span></button>';
    }
    if (!this.over) {
      if (on) {
        var u = this.chatUnread(), offered = d.drawOffer === this.myColor;
        b.push(btn('gchat', 'chat', t('chat'), '', u ? 'alert' : '') + (u ? '' : ''));
        b.push(btn('gdraw', 'eq', offered ? t('drawOffered') : t('draw'), offered || d.moves.length < 2 ? ' disabled' : ''));
      } else {
        b.push(btn('gundo', 'undo', t('undo'), this.thinking || this.moves.length < (this.myColor === 'w' ? 1 : 2) ? ' disabled' : ''));
        b.push(btn('ghint', 'bulb', t('hint'), this.thinking || this.turn() !== this.myColor ? ' disabled' : ''));
      }
      b.push(btn('gresign', 'flag', t('resign')));
    } else {
      var waiting = on && d.rematch === this.myColor && !d.rematchGame;
      b.push(btn('grematch', 'refresh', waiting ? t('rematchWait') : t('rematch'), waiting ? ' disabled' : '', 'primary'));
      b.push(btn('gpgn', 'copy', t('copyPgn')));
      b.push(btn('gback', 'x', t('close')));
    }
    var html = b.join('');
    if (this.q('#gact').dataset.k !== html) { this.q('#gact').innerHTML = html; this.q('#gact').dataset.k = html; }
    var chatBtn = this.q('[data-act="gchat"]'), u2 = this.chatUnread();
    if (chatBtn) { var bd = chatBtn.querySelector('.badge'); if (bd) bd.remove(); if (u2) chatBtn.insertAdjacentHTML('beforeend', '<span class="badge" style="position:absolute;top:2px;right:8px">' + u2 + '</span>'); chatBtn.style.position = 'relative'; }
  };

  /* Soat: har 200 ms */
  P.remaining = function (color) {
    var d = this.data;
    if (!d || !d.clock) return null;
    var ms = d.clock[color];
    if (!this.over && this.turn() === color && !this.pending) ms -= Date.now() - this.off - d.turnStart;
    return Math.max(0, ms);
  };
  P.tick = function () {
    if (!this.el || this.kind !== 'online' || !this.data || !this.data.clock) return;
    var self = this, els = this.el.querySelectorAll('[data-clk]'), run = this.over ? null : this.turn();
    Array.prototype.forEach.call(els, function (e) {
      var c = e.dataset.clk, ms = self.remaining(c);
      e.textContent = fmtClock(ms);
      e.className = 'clock' + (run === c ? (ms < 20000 ? ' low' : ' run') : '');
      if (run === c && ms <= 0 && Date.now() - self.lastFetch > 2500) self.refetch();
    });
  };
})();
