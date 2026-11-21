/* Shaxmat dvigateli: bog'liqliksiz, brauzerda ham, Node.js'da ham ishlaydi.
 * Qoidalar: shoh/mat/pat, qal'alash, en passant, piyoda almashishi,
 * 50 yurish, uch marta takrorlanish, yetarsiz material. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chess = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var BD = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var RD = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var PROMO = ['q', 'r', 'b', 'n'];

  function isWhite(p) { return p < 'a'; }
  function sqName(s) { return 'abcdefgh'.charAt(s & 7) + (8 - (s >> 3)); }
  function sqIdx(n) { return (8 - parseInt(n.charAt(1), 10)) * 8 + (n.charCodeAt(0) - 97); }
  function fileOf(s) { return 'abcdefgh'.charAt(s & 7); }
  function rankOf(s) { return String(8 - (s >> 3)); }

  function Chess(fen) { this.trackKeys = true; this.load(fen || START); }
  var P = Chess.prototype;

  P.load = function (fen) {
    var parts = String(fen).trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Noto\'g\'ri FEN');
    var rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Noto\'g\'ri FEN');
    var b = new Array(64), i, r, f, ch;
    for (i = 0; i < 64; i++) b[i] = 0;
    this.k = { w: -1, b: -1 };
    for (r = 0; r < 8; r++) {
      f = 0;
      for (i = 0; i < rows[r].length; i++) {
        ch = rows[r].charAt(i);
        if (ch >= '1' && ch <= '8') f += +ch;
        else {
          if ('PNBRQKpnbrqk'.indexOf(ch) < 0 || f > 7) throw new Error('Noto\'g\'ri FEN');
          b[r * 8 + f] = ch;
          if (ch === 'K') this.k.w = r * 8 + f;
          if (ch === 'k') this.k.b = r * 8 + f;
          f++;
        }
      }
      if (f !== 8) throw new Error('Noto\'g\'ri FEN');
    }
    if (this.k.w < 0 || this.k.b < 0) throw new Error('Shoh topilmadi');
    this.b = b;
    this.turn = parts[1] === 'b' ? 'b' : 'w';
    var c = parts[2] === '-' ? '' : parts[2], cs = '';
    'KQkq'.split('').forEach(function (x) { if (c.indexOf(x) >= 0) cs += x; });
    this.castle = cs;
    this.ep = parts[3] === '-' ? -1 : sqIdx(parts[3]);
    this.half = parseInt(parts[4], 10) || 0;
    this.full = parseInt(parts[5], 10) || 1;
    this.hist = [];
    this.keys = [this._key()];
  };

  P.reset = function () { this.load(START); };

  P.fen = function () {
    var s = '', r, f, e, p;
    for (r = 0; r < 8; r++) {
      e = 0;
      for (f = 0; f < 8; f++) {
        p = this.b[r * 8 + f];
        if (!p) e++;
        else { if (e) { s += e; e = 0; } s += p; }
      }
      if (e) s += e;
      if (r < 7) s += '/';
    }
    return s + ' ' + this.turn + ' ' + (this.castle || '-') + ' ' +
      (this.ep < 0 ? '-' : sqName(this.ep)) + ' ' + this.half + ' ' + this.full;
  };

  /* Takrorlanishni aniqlash uchun pozitsiya kaliti */
  P._key = function () {
    var s = '', i, p, epOk = false;
    for (i = 0; i < 64; i++) { p = this.b[i]; s += p || '1'; }
    if (this.ep >= 0) {
      var white = this.turn === 'w', r = this.ep >> 3, f = this.ep & 7, pr = white ? r + 1 : r - 1;
      var mine = white ? 'P' : 'p';
      if (pr >= 0 && pr < 8) {
        if (f > 0 && this.b[pr * 8 + f - 1] === mine) epOk = true;
        if (f < 7 && this.b[pr * 8 + f + 1] === mine) epOk = true;
      }
    }
    return s + this.turn + this.castle + (epOk ? this.ep : '');
  };

  /* sq maydoni 'by' rangi tomonidan hujum ostidami */
  P._att = function (sq, by) {
    var b = this.b, r = sq >> 3, f = sq & 7, i, nr, nf, d, p, w = by === 'w';
    var pr = w ? r + 1 : r - 1, pc = w ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === pc) return true;
      if (f < 7 && b[pr * 8 + f + 1] === pc) return true;
    }
    var N = w ? 'N' : 'n', K = w ? 'K' : 'k', B = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q';
    for (i = 0; i < 8; i++) {
      nr = r + KN[i][0]; nf = f + KN[i][1];
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8 && b[nr * 8 + nf] === N) return true;
      nr = r + KG[i][0]; nf = f + KG[i][1];
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8 && b[nr * 8 + nf] === K) return true;
    }
    for (d = 0; d < 4; d++) {
      nr = r + BD[d][0]; nf = f + BD[d][1];
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        p = b[nr * 8 + nf];
        if (p) { if (p === B || p === Q) return true; break; }
        nr += BD[d][0]; nf += BD[d][1];
      }
      nr = r + RD[d][0]; nf = f + RD[d][1];
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        p = b[nr * 8 + nf];
        if (p) { if (p === R || p === Q) return true; break; }
        nr += RD[d][0]; nf += RD[d][1];
      }
    }
    return false;
  };

  /* Psevdo-qonuniy yurishlar (shohni himoya qilish tekshirilmagan) */
  P._pseudo = function () {
    var b = this.b, white = this.turn === 'w', foe = white ? 'b' : 'w', out = [];
    var sq, p, t, r, f, i, d, nr, nf, to, c, k;
    function add(from, to, piece, cap, flags, promo) {
      out.push({ from: from, to: to, piece: piece, cap: cap, flags: flags, promotion: promo });
    }
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (!p || isWhite(p) !== white) continue;
      t = p.toLowerCase(); r = sq >> 3; f = sq & 7;
      if (t === 'p') {
        var dir = white ? -1 : 1, promoRank = white ? 0 : 7, start = white ? 6 : 1;
        nr = r + dir;
        if (nr < 0 || nr > 7) continue;
        to = nr * 8 + f;
        if (!b[to]) {
          if (nr === promoRank) { for (k = 0; k < 4; k++) add(sq, to, p, 0, 'np', PROMO[k]); }
          else {
            add(sq, to, p, 0, 'n');
            if (r === start && !b[to + dir * 8]) add(sq, to + dir * 8, p, 0, 'b');
          }
        }
        for (i = -1; i <= 1; i += 2) {
          nf = f + i;
          if (nf < 0 || nf > 7) continue;
          to = nr * 8 + nf; c = b[to];
          if (c) {
            if (isWhite(c) !== white) {
              if (nr === promoRank) { for (k = 0; k < 4; k++) add(sq, to, p, c, 'cp', PROMO[k]); }
              else add(sq, to, p, c, 'c');
            }
          } else if (to === this.ep) add(sq, to, p, white ? 'p' : 'P', 'ec');
        }
      } else if (t === 'n' || t === 'k') {
        var offs = t === 'n' ? KN : KG;
        for (i = 0; i < 8; i++) {
          nr = r + offs[i][0]; nf = f + offs[i][1];
          if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
          to = nr * 8 + nf; c = b[to];
          if (!c) add(sq, to, p, 0, 'n');
          else if (isWhite(c) !== white) add(sq, to, p, c, 'c');
        }
        if (t === 'k') {
          if (white && sq === 60) {
            if (this.castle.indexOf('K') >= 0 && b[63] === 'R' && !b[61] && !b[62] &&
              !this._att(60, foe) && !this._att(61, foe) && !this._att(62, foe)) add(60, 62, p, 0, 'k');
            if (this.castle.indexOf('Q') >= 0 && b[56] === 'R' && !b[57] && !b[58] && !b[59] &&
              !this._att(60, foe) && !this._att(59, foe) && !this._att(58, foe)) add(60, 58, p, 0, 'q');
          } else if (!white && sq === 4) {
            if (this.castle.indexOf('k') >= 0 && b[7] === 'r' && !b[5] && !b[6] &&
              !this._att(4, foe) && !this._att(5, foe) && !this._att(6, foe)) add(4, 6, p, 0, 'k');
            if (this.castle.indexOf('q') >= 0 && b[0] === 'r' && !b[1] && !b[2] && !b[3] &&
              !this._att(4, foe) && !this._att(3, foe) && !this._att(2, foe)) add(4, 2, p, 0, 'q');
          }
        }
      } else {
        var dirs = t === 'b' ? BD : t === 'r' ? RD : BD.concat(RD);
        for (d = 0; d < dirs.length; d++) {
          nr = r + dirs[d][0]; nf = f + dirs[d][1];
          while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
            to = nr * 8 + nf; c = b[to];
            if (!c) add(sq, to, p, 0, 'n');
            else { if (isWhite(c) !== white) add(sq, to, p, c, 'c'); break; }
            nr += dirs[d][0]; nf += dirs[d][1];
          }
        }
      }
    }
    return out;
  };

  P._make = function (m) {
    var b = this.b, us = this.turn, white = us === 'w';
    var u = { m: m, castle: this.castle, ep: this.ep, half: this.half, full: this.full, capSq: m.to, cap: b[m.to] };
    var piece = b[m.from];
    b[m.from] = 0;
    if (m.flags.indexOf('e') >= 0) {
      u.capSq = m.to + (white ? 8 : -8);
      u.cap = b[u.capSq];
      b[u.capSq] = 0;
    }
    b[m.to] = m.promotion ? (white ? m.promotion.toUpperCase() : m.promotion) : piece;
    if (m.flags === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
    else if (m.flags === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
    if (piece === 'K') this.k.w = m.to;
    else if (piece === 'k') this.k.b = m.to;
    var c = this.castle;
    if (c) {
      if (piece === 'K') c = c.replace('K', '').replace('Q', '');
      else if (piece === 'k') c = c.replace('k', '').replace('q', '');
      if (m.from === 63 || m.to === 63) c = c.replace('K', '');
      if (m.from === 56 || m.to === 56) c = c.replace('Q', '');
      if (m.from === 7 || m.to === 7) c = c.replace('k', '');
      if (m.from === 0 || m.to === 0) c = c.replace('q', '');
      this.castle = c;
    }
    this.ep = m.flags === 'b' ? (m.from + m.to) / 2 : -1;
    this.half = (piece === 'P' || piece === 'p' || m.cap) ? 0 : this.half + 1;
    if (!white) this.full++;
    this.turn = white ? 'b' : 'w';
    this.hist.push(u);
    if (this.trackKeys) this.keys.push(this._key());
  };

  P._unmake = function () {
    var u = this.hist.pop(), m = u.m, b = this.b;
    if (this.trackKeys) this.keys.pop();
    this.turn = this.turn === 'w' ? 'b' : 'w';
    var white = this.turn === 'w';
    b[m.from] = m.piece;
    b[m.to] = 0;
    if (m.flags.indexOf('e') >= 0) b[u.capSq] = u.cap;
    else b[m.to] = u.cap;
    if (m.flags === 'k') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
    else if (m.flags === 'q') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
    if (m.piece === 'K') this.k.w = m.from;
    else if (m.piece === 'k') this.k.b = m.from;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.full = u.full;
    return m;
  };

  /* Qonuniy yurishlar (ichki ko'rinish) */
  P.legal = function () {
    var us = this.turn, foe = us === 'w' ? 'b' : 'w', res = [], ps = this._pseudo(), i, ok;
    for (i = 0; i < ps.length; i++) {
      this._make(ps[i]);
      ok = !this._att(this.k[us], foe);
      this._unmake();
      if (ok) res.push(ps[i]);
    }
    return res;
  };

  P.inCheck = function () { return this._att(this.k[this.turn], this.turn === 'w' ? 'b' : 'w'); };

  P._san = function (m, legal) {
    if (m.flags === 'k') return this._suffix(m, 'O-O');
    if (m.flags === 'q') return this._suffix(m, 'O-O-O');
    var s = '', t = m.piece.toLowerCase(), i, o, amb = false, sameF = false, sameR = false;
    if (t !== 'p') {
      s += t.toUpperCase();
      for (i = 0; i < legal.length; i++) {
        o = legal[i];
        if (o !== m && o.to === m.to && o.piece === m.piece) {
          amb = true;
          if ((o.from & 7) === (m.from & 7)) sameF = true;
          if ((o.from >> 3) === (m.from >> 3)) sameR = true;
        }
      }
      if (amb) { if (!sameF) s += fileOf(m.from); else if (!sameR) s += rankOf(m.from); else s += sqName(m.from); }
    } else if (m.cap) s += fileOf(m.from);
    if (m.cap) s += 'x';
    s += sqName(m.to);
    if (m.promotion) s += '=' + m.promotion.toUpperCase();
    return this._suffix(m, s);
  };

  P._suffix = function (m, s) {
    var tk = this.trackKeys; this.trackKeys = false;
    this._make(m);
    if (this.inCheck()) s += this.legal().length ? '+' : '#';
    this._unmake();
    this.trackKeys = tk;
    return s;
  };

  /* Ochiq API: [{from:'e2', to:'e4', promotion?, san, piece, captured, flags}] */
  P.moves = function (square) {
    var legal = this.legal(), out = [], i, m, from = square ? sqIdx(square) : -1;
    for (i = 0; i < legal.length; i++) {
      m = legal[i];
      if (from >= 0 && m.from !== from) continue;
      out.push({
        from: sqName(m.from), to: sqName(m.to), promotion: m.promotion || null,
        san: this._san(m, legal), piece: m.piece, captured: m.cap || null, flags: m.flags
      });
    }
    return out;
  };

  P.move = function (inp) {
    if (!inp || typeof inp.from !== 'string' || typeof inp.to !== 'string') return null;
    if (!/^[a-h][1-8]$/.test(inp.from) || !/^[a-h][1-8]$/.test(inp.to)) return null;
    var from = sqIdx(inp.from), to = sqIdx(inp.to), legal = this.legal(), found = null, i, m;
    var want = (inp.promotion || 'q').toString().toLowerCase();
    for (i = 0; i < legal.length; i++) {
      m = legal[i];
      if (m.from === from && m.to === to) {
        if (m.promotion) { if (m.promotion === want) { found = m; break; } }
        else { found = m; break; }
      }
    }
    if (!found) return null;
    var san = this._san(found, legal);
    this._make(found);
    return {
      san: san, from: inp.from, to: inp.to, promotion: found.promotion || null,
      piece: found.piece, captured: found.cap || null, flags: found.flags, fen: this.fen()
    };
  };

  P.undo = function () { return this.hist.length ? this._unmake() : null; };

  P.get = function (name) { return this.b[sqIdx(name)] || null; };
  P.board = function () { return this.b.slice(); };
  P.kingSquare = function (color) { return sqName(this.k[color]); };

  P.isInsufficient = function () {
    var minors = [], i, p, t;
    for (i = 0; i < 64; i++) {
      p = this.b[i];
      if (!p) continue;
      t = p.toLowerCase();
      if (t === 'k') continue;
      if (t === 'n' || t === 'b') minors.push({ t: t, sq: ((i >> 3) + (i & 7)) & 1 });
      else return false;
    }
    if (minors.length <= 1) return true;
    for (i = 0; i < minors.length; i++) if (minors[i].t !== 'b') return false;
    for (i = 1; i < minors.length; i++) if (minors[i].sq !== minors[0].sq) return false;
    return true;
  };

  P.repetitions = function () {
    var k = this.keys[this.keys.length - 1], n = 0, i;
    for (i = 0; i < this.keys.length; i++) if (this.keys[i] === k) n++;
    return n;
  };

  /* {over, reason, winner} */
  P.status = function () {
    if (!this.legal().length) {
      if (this.inCheck()) return { over: true, reason: 'checkmate', winner: this.turn === 'w' ? 'b' : 'w' };
      return { over: true, reason: 'stalemate', winner: null };
    }
    if (this.isInsufficient()) return { over: true, reason: 'insufficient', winner: null };
    if (this.half >= 100) return { over: true, reason: 'fifty', winner: null };
    if (this.trackKeys && this.repetitions() >= 3) return { over: true, reason: 'repetition', winner: null };
    return { over: false, reason: null, winner: null };
  };

  Chess.perft = function (fen, depth) {
    var g = new Chess(fen); g.trackKeys = false;
    function go(d) {
      if (d === 0) return 1;
      var ms = g.legal(), n = 0, i;
      if (d === 1) return ms.length;
      for (i = 0; i < ms.length; i++) { g._make(ms[i]); n += go(d - 1); g._unmake(); }
      return n;
    }
    return go(depth);
  };

  Chess.START = START;
  Chess.sqName = sqName;
  Chess.sqIdx = sqIdx;
  return Chess;
});
