/* Kompyuter raqib: alpha-beta qidiruv + sokin pozitsiya qidiruvi.
 * Web Worker sifatida ishlaydi (interfeys qotmaydi), Node.js'da ham tekshirish mumkin. */
(function () {
  'use strict';
  var Chess;
  var isWorker = typeof importScripts === 'function';
  if (isWorker) { importScripts('chess.js'); Chess = self.Chess; }
  else Chess = require('./chess.js');

  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  var MATE = 100000;
  var TIMEOUT = { timeout: true };

  function evaluate(g) {
    var b = g.b, i, p, t, r, f, white, rr, cen, v, s = 0, nonPawn = 0;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p) continue;
      t = p.toLowerCase();
      if (t !== 'p' && t !== 'k') nonPawn += VAL[t];
    }
    var endgame = nonPawn < 1400;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p) continue;
      t = p.toLowerCase(); white = p < 'a';
      r = i >> 3; f = i & 7;
      rr = white ? 7 - r : r;
      cen = 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
      v = VAL[t];
      if (t === 'n') { v += 12 * cen; if (rr === 0 && !endgame) v -= 8; }
      else if (t === 'b') { v += 6 * cen; if (rr === 0 && !endgame) v -= 8; }
      else if (t === 'q') v += 3 * cen;
      else if (t === 'r') { if (rr === 6) v += 15; if (f === 3 || f === 4) v += 4; }
      else if (t === 'p') {
        v += rr * 6 + (f === 3 || f === 4 ? 4 : 0);
        if (rr >= 5) v += 20;
      } else if (t === 'k') {
        if (endgame) v += 10 * cen;
        else { v -= 18 * rr; if (rr === 0 && (f === 1 || f === 2 || f === 6)) v += 22; else if (rr === 0 && (f === 3 || f === 4)) v -= 6; }
      }
      s += white ? v : -v;
    }
    return g.turn === 'w' ? s : -s;
  }

  function orderMoves(moves, first) {
    var i, m;
    for (i = 0; i < moves.length; i++) {
      m = moves[i];
      m.o = (m.cap ? 10 * VAL[m.cap.toLowerCase()] - VAL[m.piece.toLowerCase()] + 1000 : 0) + (m.promotion ? 800 : 0);
      if (first && m.from === first.from && m.to === first.to && m.promotion === first.promotion) m.o += 100000;
    }
    moves.sort(function (a, b) { return b.o - a.o; });
  }

  function quiesce(g, alpha, beta, ctx, qd) {
    if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw TIMEOUT;
    var stand = evaluate(g);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 4) return alpha;
    var moves = g.legal(), caps = [], i, sc;
    for (i = 0; i < moves.length; i++) if (moves[i].cap || moves[i].promotion) caps.push(moves[i]);
    orderMoves(caps);
    for (i = 0; i < caps.length; i++) {
      g._make(caps[i]);
      sc = -quiesce(g, -beta, -alpha, ctx, qd + 1);
      g._unmake();
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function search(g, depth, alpha, beta, ply, ctx) {
    if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw TIMEOUT;
    var inChk = g.inCheck();
    if (inChk && ply < 10) depth++;
    if (depth <= 0) return quiesce(g, alpha, beta, ctx, 0);
    var moves = g.legal(), i, sc;
    if (!moves.length) return inChk ? -MATE + ply : 0;
    if (g.half >= 100) return 0;
    orderMoves(moves);
    for (i = 0; i < moves.length; i++) {
      g._make(moves[i]);
      sc = -search(g, depth - 1, -beta, -alpha, ply + 1, ctx);
      g._unmake();
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  var LEVELS = {
    1: { depth: 1, ms: 300, window: 90, blunder: 0.3 },
    2: { depth: 2, ms: 900, window: 25, blunder: 0 },
    3: { depth: 3, ms: 2200, window: 6, blunder: 0 },
    4: { depth: 5, ms: 3800, window: 0, blunder: 0 }
  };

  function bestMove(fen, level) {
    var cfg = LEVELS[level] || LEVELS[2];
    var g = new Chess(fen);
    g.trackKeys = false;
    var moves = g.legal();
    if (!moves.length) return null;
    var ctx = { nodes: 0, deadline: Date.now() + cfg.ms };
    var scored = null, d, i, sc, list, best;

    /* Tanlov oynasi (window > 0) bo'lsa har bir yurish aniq ball bilan baholanadi,
     * aks holda faqat eng yaxshisi (alpha-beta kesish bilan, tezroq). */
    var exactAll = cfg.window > 0;
    for (d = 1; d <= cfg.depth; d++) {
      list = moves.slice();
      orderMoves(list, scored && scored[0].m);
      var cur = [], alpha = -MATE * 2, FULL = MATE * 2;
      try {
        for (i = 0; i < list.length; i++) {
          g._make(list[i]);
          sc = exactAll ? -search(g, d - 1, -FULL, FULL, 1, ctx) : -search(g, d - 1, -FULL, -alpha, 1, ctx);
          g._unmake();
          if (exactAll) cur.push({ m: list[i], s: sc });
          else if (sc > alpha) { alpha = sc; cur.push({ m: list[i], s: sc }); }
          else cur.push({ m: list[i], s: -Infinity });
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        while (g.hist.length) g._unmake();
        break;
      }
      cur.sort(function (a, b) { return b.s - a.s; });
      scored = cur;
      if (Math.abs(cur[0].s) > MATE - 100) break;
    }
    if (!scored) { scored = moves.map(function (m) { return { m: m, s: 0 }; }); }

    var topScore = scored[0].s, pool = [];
    for (i = 0; i < scored.length; i++) if (scored[i].s >= topScore - cfg.window) pool.push(scored[i]);
    if (cfg.blunder && Math.random() < cfg.blunder) pool = scored.slice(0, Math.min(5, scored.length));
    best = pool[Math.floor(Math.random() * pool.length)].m;
    return { from: Chess.sqName(best.from), to: Chess.sqName(best.to), promotion: best.promotion || null };
  }

  if (isWorker) {
    self.onmessage = function (e) {
      var d = e.data, mv = null;
      try { mv = bestMove(d.fen, d.level); } catch (err) { mv = null; }
      self.postMessage({ id: d.id, move: mv });
    };
  } else {
    module.exports = { bestMove: bestMove, evaluate: evaluate };
  }
})();
