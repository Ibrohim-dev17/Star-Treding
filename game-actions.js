/* O'yin ekrani, 2-qism: harakatlar (yurish, kompyuter, taslim, durang, chat, natija) */
(function () {
  'use strict';
  var A = window.A, S = A.S, esc = A.esc, ic = A.ic, GV = A.GameView, P = GV.prototype;
  var ACT = A.ACT = A.ACT || {};
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- Onlayn holatni qabul qilish ---------- */
  P.refetch = function () {
    var self = this;
    this.lastFetch = Date.now();
    if (this.kind !== 'online') return Promise.resolve();
    return A.api('GET', '/api/game/' + this.id).then(function (r) { if (S.cur === self) self.setOnline(r.game, true); }, function () { /* tarmoq yo'q */ });
  };

  P.setOnline = function (d, force) {
    if (!force && this.data && d.moves.length < this.moves.length && !d.over) return;
    var prevLen = this.moves.length, wasOver = this.over, first = !this.inited, prevChat = this.data ? this.data.chat.length : 0, lastSan;
    this.data = d; this.off = Date.now() - d.now; this.lastFetch = Date.now();
    this.moves = d.moves.map(function (m) { return { from: m.from, to: m.to, promotion: m.promotion, san: m.san }; });
    this.myColor = d.myColor || 'w'; this.players = { w: d.white, b: d.black };
    this.over = d.over; this.reason = d.reason; this.winner = d.winner;
    this.pending = false; this.hint = null; this.derive();
    if (this.view !== null && this.view >= this.pos.length) this.view = null;
    var grew = !first && this.moves.length > prevLen;
    if (this.chatLayer) { this.chatSeen = d.chat.length; this.renderChatList(); }
    else if (!first && d.chat.length > prevChat) {
      var lm = d.chat[d.chat.length - 1];
      if (lm && lm.c !== this.myColor) { A.toast(lm.t, '', null); A.sfx('notify'); }
    }
    this.inited = true;
    this.update(grew && this.moves.length - prevLen === 1 && this.view === null);
    if (grew) {
      lastSan = this.moves[this.moves.length - 1].san;
      A.sfx(A.sfxSan(lastSan)); A.hap();
    }
    if (!wasOver && this.over && !first) this.onOver();
  };

  /* ---------- Yurish ---------- */
  P.applyLocal = function (f, to, promo) {
    var r = this.chess.move({ from: f, to: to, promotion: promo || undefined });
    if (!r) return null;
    this.moves.push({ from: f, to: to, promotion: r.promotion, san: r.san });
    this.pos.push({ fen: r.fen, last: [f, to], check: this.chess.inCheck() ? this.chess.kingSquare(this.chess.turn) : null });
    this.hint = null; this.view = null;
    return r;
  };

  P.onMove = function (f, to, promo) {
    if (!this.interactive()) return;
    var r = this.applyLocal(f, to, promo), self = this;
    if (!r) return;
    A.sfx(A.sfxSan(r.san)); A.hap();
    if (this.kind === 'ai') { this.afterAiMove(false); return; }
    this.pending = true; this.update(true);
    A.api('POST', '/api/game/' + this.id + '/move', { from: f, to: to, promotion: promo || undefined }).then(function (res) {
      if (S.cur === self) self.setOnline(res.game, true);
    }, function (e) {
      A.errToast(e);
      if (S.cur === self) { self.setOnline(self.data, true); self.refetch(); }
    });
  };

  /* ---------- Kompyuter raqib ---------- */
  P.ensureWorker = function () {
    var self = this;
    if (this.worker || typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker('ai-worker.js');
      this.worker.onmessage = function (e) {
        var rq = self.reqs[e.data.id];
        if (rq) { delete self.reqs[e.data.id]; rq(e.data.move); }
      };
      this.worker.onerror = function () {
        var r = self.reqs; self.reqs = {}; self.worker = null;
        Object.keys(r).forEach(function (k) { r[k](null); });
      };
    } catch (e) { this.worker = null; }
  };
  P.ask = function (fen, level, cb) {
    this.ensureWorker();
    var id = ++this.reqId;
    if (!this.worker) {
      var ms = new window.Chess(fen).moves(), m = ms[Math.floor(Math.random() * ms.length)];
      setTimeout(function () { cb(m ? { from: m.from, to: m.to, promotion: m.promotion } : null); }, 60);
      return;
    }
    this.reqs[id] = cb; this.worker.postMessage({ id: id, fen: fen, level: level });
  };
  P.askAi = function (animate) {
    var self = this, tok = ++this.aiTok, t0 = Date.now();
    this.thinking = true; this.update(animate);
    this.ask(this.pos[this.pos.length - 1].fen, this.level, function (mv) {
      if (tok !== self.aiTok || !self.el) return;
      if (!mv) {
        var ms = self.chess.moves();
        if (!ms.length) return;
        mv = ms[Math.floor(Math.random() * ms.length)];
      }
      setTimeout(function () {
        if (tok !== self.aiTok || !self.el) return;
        self.thinking = false;
        var r = self.applyLocal(mv.from, mv.to, mv.promotion);
        if (!r) { self.update(); return; }
        A.sfx(A.sfxSan(r.san)); self.afterAiMove(true);
      }, Math.max(0, 550 - (Date.now() - t0)));
    });
  };
  P.afterAiMove = function (fromAi) {
    this.saveAi();
    var st = this.chess.status();
    if (st.over) { this.over = true; this.reason = st.reason; this.winner = st.winner; this.update(true); this.onOver(); return; }
    if (fromAi) this.update(true); else this.askAi(true);
  };
  P.saveAi = function () {
    if (this.over) { A.ls.del('ai'); return; }
    A.ls.set('ai', JSON.stringify({
      level: this.level, color: this.myColor,
      moves: this.moves.map(function (m) { return { from: m.from, to: m.to, promotion: m.promotion }; })
    }));
  };
  P.undo = function () {
    if (this.kind !== 'ai' || this.thinking) return;
    var n = this.turn() === this.myColor ? 2 : 1;
    if (this.moves.length - n < (this.myColor === 'w' ? 0 : 1)) return;
    this.moves.splice(-n, n);
    this.over = false; this.reason = null; this.winner = null; this.resultShown = false;
    this.derive(); this.hint = null; this.view = null; this.aiTok++;
    this.saveAi(); this.update();
  };
  P.doHint = function () {
    var self = this;
    if (this.kind !== 'ai' || this.thinking || this.turn() !== this.myColor || this.over) return;
    this.ask(this.pos[this.pos.length - 1].fen, 3, function (mv) {
      if (!mv || !self.el) return;
      self.hint = [mv.from, mv.to]; self.update(); A.toast(t('hintShown'), 'ok');
    });
  };

  /* ---------- Taslim, durang, qayta o'ynash ---------- */
  P.resign = function () {
    var self = this;
    if (this.kind === 'ai') {
      this.over = true; this.reason = 'resign'; this.winner = A.opp(this.myColor);
      this.aiTok++; this.thinking = false; this.saveAi(); this.update(); this.onOver();
      return;
    }
    A.api('POST', '/api/game/' + this.id + '/resign').then(function (r) { if (S.cur === self) self.setOnline(r.game, true); }, A.errToast);
  };
  P.draw = function (action) {
    var self = this;
    A.api('POST', '/api/game/' + this.id + '/draw', { action: action }).then(function (r) { if (S.cur === self) self.setOnline(r.game, true); }, A.errToast);
  };
  P.rematch = function () {
    var self = this;
    if (this.kind === 'ai') { A.openAi({ level: this.level, color: this.myColor }); return; }
    A.api('POST', '/api/game/' + this.id + '/rematch').then(function (r) {
      if (r.gameId) A.openGame(r.gameId); else if (S.cur === self) self.refetch();
    }, A.errToast);
  };

  /* ---------- Natija oynasi ---------- */
  P.onOver = function () {
    var self = this;
    if (this.resultShown) return;
    this.resultShown = true; A.sfx('end');
    setTimeout(function () { if (S.cur === self && self.el) self.showResult(); }, 700);
  };
  P.showResult = function () {
    var self = this, me = this.myColor, o, em, title, dl = null;
    o = this.reason === 'aborted' ? 'abort' : this.winner === me ? 'win' : this.winner ? 'loss' : 'draw';
    em = { win: '🏆', loss: '😞', draw: '🤝', abort: '⚪' }[o];
    title = { win: t('youWon'), loss: t('youLost'), draw: t('drawn'), abort: t('aborted') }[o];
    function build(extra) {
      if (S.cur !== self || !self.el) return;
      A.openModal({
        emoji: em, title: title, text: o === 'abort' ? '' : self.resultText(), html: extra || '',
        buttons: [
          { label: t('rematch'), cls: 'primary', fn: function () { self.rematch(); } },
          { label: t('review'), fn: function () { /* taxtaga qaytish */ } },
          { label: t('close'), cls: 'ghost', fn: function () { A.closeLayer(self.layer); } }
        ]
      });
    }
    if (this.kind === 'online' && this.data.ratingChange && o !== 'abort') {
      dl = this.data.ratingChange[me];
      var box = function () {
        return '<div class="result-box"><div>' + esc(t('rating')) + '<b>' + S.me.rating +
          ' <span class="delta ' + (dl >= 0 ? 'up' : 'down') + '">' + (dl > 0 ? '+' : '') + dl + '</span></b></div></div>';
      };
      A.refreshMe().then(function () { build(box()); }, function () { build(''); });
    } else build('');
  };

  /* ---------- O'yin ichidagi chat ---------- */
  P.openChat = function () {
    var self = this, l = A.openSheet(
      '<h3>' + esc(t('chat')) + '</h3><div class="msgs mini-chat" id="gcl"></div>' +
      '<div class="quick">' + [1, 2, 3, 4].map(function (i) { return '<button data-act="gquick" data-i="' + i + '">' + esc(t('quick' + i)) + '</button>'; }).join('') + '</div>' +
      '<form class="composer" id="gcf" style="padding:6px 0 0;border:0;background:none"><input class="input" id="gci" maxlength="300" autocomplete="off" placeholder="' + esc(t('typeMessage')) + '">' +
      '<button class="send" type="submit" aria-label="' + esc(t('send')) + '">' + ic('send') + '</button></form>',
      function () { self.chatLayer = null; });
    this.chatLayer = l; this.chatSeen = this.data.chat.length;
    this.renderChatList(); this.renderActions();
    l.el.querySelector('#gcf').addEventListener('submit', function (e) {
      e.preventDefault();
      var i = l.el.querySelector('#gci'), v = i.value.trim();
      if (v) { i.value = ''; self.sendChat(v); }
    });
  };
  P.sendChat = function (v) { A.api('POST', '/api/game/' + this.id + '/chat', { text: v }).then(null, A.errToast); };
  P.renderChatList = function () {
    if (!this.chatLayer) return;
    var box = this.chatLayer.el.querySelector('#gcl'), me = this.myColor, c = this.data.chat;
    box.innerHTML = c.length ? c.map(function (m) {
      return '<div class="msg ' + (m.c === me ? 'me' : 'them') + '">' + esc(m.t) + '<time>' + A.hhmm(m.ts) + '</time></div>';
    }).join('') : '<div class="empty sub">' + esc(t('noMessages')) + '</div>';
    box.scrollTop = box.scrollHeight;
  };

  P.pgn = function () {
    var res = this.over && this.reason !== 'aborted' ? (this.winner === 'w' ? '1-0' : this.winner === 'b' ? '0-1' : '1/2-1/2') : '*';
    var d = new Date(), mv = '';
    this.moves.forEach(function (m, i) { if (i % 2 === 0) mv += ((i >> 1) + 1) + '. '; mv += m.san + ' '; });
    return '[Event "Shaxmat"]\n[Date "' + d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '"]\n[White "' +
      this.players.w.name + '"]\n[Black "' + this.players.b.name + '"]\n[Result "' + res + '"]\n\n' + mv + res;
  };

  /* ---------- Ochish ---------- */
  A.openGame = function (id) {
    return A.api('GET', '/api/game/' + id).then(function (r) {
      A.closeAll();
      var gv = new GV('online');
      gv.id = id; S.cur = gv; gv.mount(); gv.setOnline(r.game, true);
    }, A.errToast);
  };
  A.openAi = function (o) {
    A.closeAll();
    var gv = new GV('ai'), saved = null;
    if (o.resume) { try { saved = JSON.parse(A.ls.get('ai')); } catch (e) { saved = null; } }
    gv.level = saved ? saved.level : o.level;
    gv.myColor = saved ? saved.color : (o.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : o.color);
    gv.moves = saved ? saved.moves : [];
    var me = { name: S.me.name, rating: S.me.rating, avatar: S.me.avatar },
      ai = { name: t('computer') + ' · ' + t('lvl' + gv.level), ai: true };
    gv.players = gv.myColor === 'w' ? { w: me, b: ai } : { w: ai, b: me };
    S.cur = gv; gv.mount(); gv.derive();
    var st = gv.chess.status();
    if (st.over) { gv.over = true; gv.reason = st.reason; gv.winner = st.winner; gv.resultShown = true; }
    gv.inited = true; gv.update(); gv.saveAi();
    if (!gv.over && gv.turn() !== gv.myColor) gv.askAi(false);
  };

  /* ---------- Tugmalar ---------- */
  function seek(i) {
    var g = S.cur;
    if (!g) return;
    i = Math.max(0, Math.min(g.moves.length, i));
    g.view = i >= g.moves.length ? null : i; g.hint = null; g.update();
  }
  ACT.gback = function () { if (S.cur) A.closeLayer(S.cur.layer); };
  ACT.gflip = function () { if (S.cur) { S.cur.flip = !S.cur.flip; S.cur.update(); } };
  ACT.gprev = function () { if (S.cur) seek(S.cur.shownIdx() - 1); };
  ACT.gnext = function () { if (S.cur) seek(S.cur.shownIdx() + 1); };
  ACT.gseek = function (el) { seek(+el.dataset.i); };
  ACT.glive = function () { seek(1e9); };
  ACT.gundo = function () { if (S.cur) S.cur.undo(); };
  ACT.ghint = function () { if (S.cur) S.cur.doHint(); };
  ACT.gchat = function () { if (S.cur && S.cur.kind === 'online') S.cur.openChat(); };
  ACT.gquick = function (el) { if (S.cur) S.cur.sendChat(t('quick' + el.dataset.i)); };
  ACT.gdraw = function () { if (S.cur) S.cur.draw('offer'); };
  ACT.gdrawacc = function () { if (S.cur) S.cur.draw('accept'); };
  ACT.gdrawdec = function () { if (S.cur) S.cur.draw('decline'); };
  ACT.grematch = function () { if (S.cur) S.cur.rematch(); };
  ACT.gpgn = function () { if (S.cur) A.copyText(S.cur.pgn()); };
  ACT.gresign = function () {
    A.confirmBox(t('confirmResign'), t('confirmResignText'), t('resign'), true).then(function (ok) { if (ok && S.cur) S.cur.resign(); });
  };
})();
