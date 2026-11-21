/* Shaxmat taxtasi: bosib yoki surib yurish, ko'rsatmalar, ot tanlash, silliq harakat */
(function (root) {
  'use strict';
  var FILES = 'abcdefgh';
  function nameOf(m) { return FILES.charAt(m & 7) + (8 - (m >> 3)); }
  function idxOf(n) { return (8 - parseInt(n.charAt(1), 10)) * 8 + FILES.indexOf(n.charAt(0)); }
  function fenBoard(fen) {
    var rows = fen.split(' ')[0].split('/'), b = [], r, i, ch, k;
    for (r = 0; r < 8; r++) {
      for (i = 0; i < rows[r].length; i++) {
        ch = rows[r].charAt(i);
        if (ch >= '1' && ch <= '8') { for (k = 0; k < +ch; k++) b.push(0); } else b.push(ch);
      }
    }
    return b;
  }

  /* o: {onMove(from,to,promo), legalFrom(sq)->[{to,capture}], needsPromo(from,to)->bool} */
  function Board(host, o) {
    var self = this, d, sq, w, c1, c2;
    this.o = o || {};
    this.flipped = false; this.board = fenBoard('8/8/8/8/8/8/8/8 w - - 0 1');
    this.sel = null; this.targets = []; this.movable = null;
    this.last = null; this.check = null; this.hint = null; this.skipAnim = false;
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.sqs = [];
    for (d = 0; d < 64; d++) {
      sq = document.createElement('div');
      sq.className = 'sq'; sq.dataset.d = d;
      w = document.createElement('div'); w.className = 'pcw';
      c1 = document.createElement('span'); c1.className = 'coord rk';
      c2 = document.createElement('span'); c2.className = 'coord fl';
      sq.appendChild(c1); sq.appendChild(c2); sq.appendChild(w);
      sq._w = w; sq._rk = c1; sq._fl = c2; sq._p = undefined;
      this.el.appendChild(sq); this.sqs.push(sq);
    }
    host.appendChild(this.el);
    this.el.addEventListener('pointerdown', function (e) { self._down(e); });
    this.el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  var P = Board.prototype;

  P._m = function (d) { return this.flipped ? 63 - d : d; };
  P._sqEl = function (m) { return this.sqs[this.flipped ? 63 - m : m]; };
  P._isTarget = function (m) {
    var i;
    for (i = 0; i < this.targets.length; i++) if (idxOf(this.targets[i].to) === m) return true;
    return false;
  };

  /* s: {fen, flipped, last:[from,to], check:'e1', movable:'w'|'b'|null, hint:[from,to], animate:{from,to}} */
  P.set = function (s) {
    this.board = fenBoard(s.fen);
    this.flipped = !!s.flipped;
    this.last = s.last || null; this.check = s.check || null; this.hint = s.hint || null;
    this.movable = s.movable || null;
    this.sel = null; this.targets = [];
    this._closePromo();
    this.render();
    if (s.animate && !this.skipAnim) this._anim(s.animate.from, s.animate.to);
    this.skipAnim = false;
  };

  P.render = function () {
    var d, m, el, p, cls, r, f, b = this.board, lastA = -1, lastB = -1, chk = -1, hA = -1, hB = -1, t;
    if (this.last) { lastA = idxOf(this.last[0]); lastB = idxOf(this.last[1]); }
    if (this.check) chk = idxOf(this.check);
    if (this.hint) { hA = idxOf(this.hint[0]); hB = idxOf(this.hint[1]); }
    var tmap = {};
    for (t = 0; t < this.targets.length; t++) tmap[idxOf(this.targets[t].to)] = this.targets[t].capture ? 2 : 1;
    for (d = 0; d < 64; d++) {
      m = this._m(d); el = this.sqs[d]; p = b[m];
      r = m >> 3; f = m & 7;
      if (el._p !== p) { el._w.innerHTML = p ? root.pieceSVG(p) : ''; el._p = p; }
      cls = 'sq ' + (((r + f) & 1) ? 'd' : 'l');
      if (m === lastA || m === lastB) cls += ' last';
      if (this.sel === m) cls += ' sel';
      if (m === chk) cls += ' chk';
      if (m === hA || m === hB) cls += ' hint';
      if (tmap[m]) cls += tmap[m] === 2 ? ' tgt cap' : ' tgt';
      if (p && this.movable && ((p < 'a') === (this.movable === 'w'))) cls += ' mine';
      el.className = cls;
      el._fl.textContent = d >= 56 ? FILES.charAt(f) : '';
      el._rk.textContent = (d & 7) === 0 ? String(8 - r) : '';
    }
  };

  P._select = function (m) {
    this.sel = m;
    this.targets = [];
    var list = this.o.legalFrom ? this.o.legalFrom(nameOf(m)) : [], i;
    for (i = 0; i < list.length; i++) this.targets.push(list[i]);
    this.render();
  };
  P._deselect = function () { if (this.sel !== null || this.targets.length) { this.sel = null; this.targets = []; this.render(); } };

  P._down = function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this.promoEl) return;
    var sqEl = e.target.closest ? e.target.closest('.sq') : null;
    if (!sqEl) return;
    var m = this._m(+sqEl.dataset.d), piece = this.board[m], self = this;
    if (this.sel !== null && this._isTarget(m)) {
      e.preventDefault();
      this._attempt(this.sel, m, false);
      return;
    }
    if (piece && this.movable && ((piece < 'a') === (this.movable === 'w'))) {
      e.preventDefault();
      var reselect = this.sel === m;
      this._select(m);
      var drag = { m: m, x: e.clientX, y: e.clientY, started: false, reselect: reselect, ghost: null, piece: piece };
      this._drag = drag;
      var move = function (ev) { self._dragMove(ev); };
      var up = function (ev) {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        self._dragEnd(ev);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
      return;
    }
    this._deselect();
  };

  P._dragMove = function (e) {
    var dr = this._drag;
    if (!dr) return;
    if (!dr.started) {
      if (Math.abs(e.clientX - dr.x) + Math.abs(e.clientY - dr.y) < 8) return;
      dr.started = true;
      var rect = this.sqs[0].getBoundingClientRect(), size = rect.width * 1.18;
      var g = document.createElement('div');
      g.className = 'drag-ghost'; g.style.width = size + 'px'; g.style.height = size + 'px';
      g.innerHTML = root.pieceSVG(dr.piece);
      document.body.appendChild(g);
      dr.ghost = g; dr.size = size;
      this._sqEl(dr.m)._w.style.opacity = '.3';
    }
    dr.ghost.style.transform = 'translate(' + (e.clientX - dr.size / 2) + 'px,' + (e.clientY - dr.size * 0.62) + 'px)';
  };

  P._dragEnd = function (e) {
    var dr = this._drag;
    this._drag = null;
    if (!dr) return;
    if (dr.started) {
      if (dr.ghost && dr.ghost.parentNode) dr.ghost.parentNode.removeChild(dr.ghost);
      this._sqEl(dr.m)._w.style.opacity = '';
      var t = document.elementFromPoint(e.clientX, e.clientY), sqEl = t && t.closest ? t.closest('.sq') : null;
      if (sqEl && this.el.contains(sqEl)) {
        var m2 = this._m(+sqEl.dataset.d);
        if (m2 !== dr.m && this._isTarget(m2)) { this._attempt(dr.m, m2, true); return; }
      }
      this._deselect();
    } else if (dr.reselect) {
      this._deselect();
    }
  };

  P._attempt = function (from, to, dragged) {
    var self = this, fn = nameOf(from), tn = nameOf(to);
    this.skipAnim = !!dragged;
    if (this.o.needsPromo && this.o.needsPromo(fn, tn)) {
      this._askPromo(this.board[from] < 'a', function (promo) {
        if (promo) self._commit(fn, tn, promo); else { self.skipAnim = false; self._deselect(); }
      });
    } else this._commit(fn, tn, null);
  };

  P._commit = function (fn, tn, promo) {
    this.sel = null; this.targets = [];
    this.render();
    if (this.o.onMove) this.o.onMove(fn, tn, promo);
  };

  P._askPromo = function (white, cb) {
    var self = this, wrap = document.createElement('div'), card = document.createElement('div'), list = ['q', 'n', 'r', 'b'];
    wrap.className = 'promo'; card.className = 'promo-card';
    list.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'promo-btn'; b.setAttribute('aria-label', p);
      b.innerHTML = root.pieceSVG(white ? p.toUpperCase() : p);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); self._closePromo(); cb(p); });
      card.appendChild(b);
    });
    wrap.appendChild(card);
    wrap.addEventListener('pointerdown', function (ev) { if (ev.target === wrap) { self._closePromo(); cb(null); } });
    this.el.appendChild(wrap);
    this.promoEl = wrap;
  };
  P._closePromo = function () {
    if (this.promoEl && this.promoEl.parentNode) this.promoEl.parentNode.removeChild(this.promoEl);
    this.promoEl = null;
  };

  P._anim = function (fromName, toName) {
    var a = this._sqEl(idxOf(fromName)), b = this._sqEl(idxOf(toName));
    if (!a || !b || !b._w.firstChild) return;
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), w = b._w;
    var dx = ra.left - rb.left, dy = ra.top - rb.top;
    if (!dx && !dy) return;
    w.style.transition = 'none'; w.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; w.style.zIndex = '5';
    void w.getBoundingClientRect();
    w.style.transition = 'transform .17s cubic-bezier(.2,.8,.3,1)'; w.style.transform = '';
    setTimeout(function () { w.style.transition = ''; w.style.zIndex = ''; }, 220);
  };

  P.setTheme = function (name) { this.el.dataset.theme = name; };
  root.Board = Board;
})(typeof self !== 'undefined' ? self : this);
