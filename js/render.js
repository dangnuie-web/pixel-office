(function (root) {
  'use strict';
  const T = 16;
  const COL = {
    k: '#29262F', W: '#56585F', w: '#F4F3EF', v: '#E4E3DE', b: '#C4BAAD', Tt: '#6B6661',
    f: '#E3E0DA', g: '#D9D6CF', h: '#C7C3BB', d: '#B3AFA8',
    o: '#8F99A8', p: '#B6BEC9', q: '#707A8A', l: '#86B07E', L: '#5C8458', P: '#A9A6A0',
    y: '#F5DDB6', Y: '#D9B892', a: '#3B3437', c: '#464B57', e: '#353944', n: '#E08A3C',
  };
  const MARK = {
    '?': ['.kkkkk.', 'kwwwwwk', 'kwkkkwk', 'kwwwkwk', 'kwwkkwk', 'kwwkwwk', 'kwwwwwk', 'kwwkwwk', '.kkkkk.'],
    '!': ['.kkkkk.', 'kkkwkkk', 'kkkwkkk', 'kkkwkkk', 'kkkwkkk', 'kkkkkkk', 'kkkwkkk', 'kkkkkkk', '.kkkkk.'],
  };

  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function drawMark(ctx, sym, cx, bottomY) {
    const m = MARK[sym]; if (!m) return;
    const x0 = Math.round(cx - 3), y0 = Math.round(bottomY - 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 7; x++) { const ch = m[y][x]; if (ch !== '.') px(ctx, x0 + x, y0 + y, 1, 1, COL[ch]); }
  }

  function drawGoal(ctx, x, y) {
    const x0 = x * T + 2, y0 = y * T + 2;
    px(ctx, x0, y0, 12, 1, COL.k); px(ctx, x0, y0 + 11, 12, 1, COL.k); px(ctx, x0, y0 + 1, 1, 10, COL.k); px(ctx, x0 + 11, y0 + 1, 1, 10, COL.k);
  }
  function drawMap(ctx, L) {
    if (root.POLook && root.PORender.look !== false) { ctx.drawImage(root.POLook.background(L), 0, 0); return; }
    const LC = root.POLayoutCheck;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const ch = L.rows[y][x];
      if (ch === '#') {
        px(ctx, x * T, y * T, T, T, COL.W);
        px(ctx, x * T, y * T + T - 3, T, 3, COL.Tt);
      } else if (ch === 'e') {
        px(ctx, x * T, y * T, T, T, COL.W); px(ctx, x * T + 2, y * T + 2, T - 4, T - 2, COL.b);
      } else {
        const r = LC.roomAt(L, x, y);
        px(ctx, x * T, y * T, T, T, ch === 'd' ? COL.f : (r ? r.color : COL.f));
        if (ch !== 'd') px(ctx, x * T, y * T + T - 1, T, 1, r ? r.shade : COL.h);
      }
    }
  }

  function spriteXY(key, cx, cy, cw, ch, dx, dy) {
    const sz = root.POSprites.size(key);
    return { x: cx * T + Math.floor((cw * T - sz.w) / 2) + (dx || 0), y: (cy + ch) * T - sz.h + (dy || 0) };
  }
  function drawSpriteAt(ctx, key, frame, cx, cy, cw, ch, dx, dy, shadow) {
    const p = spriteXY(key, cx, cy, cw, ch, dx, dy);
    if (shadow && root.POLook && root.PORender.look !== false) root.POLook.objectShadow(ctx, key, frame, p.x, p.y);
    ctx.drawImage(root.POSprites.frameCanvas(key, frame), p.x, p.y);
  }
  function objFrame(o, t) {
    if (o.frame != null) return o.frame;
    const n = root.POSprites.frameCount(o.sprite);
    return (o.frameMs && n > 1) ? Math.floor((t || 0) / o.frameMs) % n : 0;
  }
  function paperCount(o, st) {
    if (o.type !== 'desk') return 0;
    const s = st && st.staff.find((p) => p.key === o.owner);
    return s ? Math.min(5, s.todayDone.length) : 0;
  }
  function cabinetLevel(st) {
    return { unknown: 0, empty: 0, few: 1, many: 2 }[trayState(st)];
  }
  function trayState(st) {
    const m = st && st.approvals;
    if (typeof m !== 'number') return 'unknown';
    return m <= 0 ? 'empty' : m <= 3 ? 'few' : 'many';
  }
  function paperStage(n) { return n <= 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3; }
  function drawPaper(ctx, o, st) {
    const b = o.paper || { x: 4, y: 8 };
    const x = o.x * T + b.x, y = o.y * T + b.y;
    for (let i = 0; i < paperCount(o, st); i++) { px(ctx, x, y - i * 2, 8, 2, COL.k); px(ctx, x + 1, y - i * 2, 6, 1, COL.w); }
  }
  function drawFiles(ctx, o, st) {
    const b = o.paper || { x: 4, y: 9 };
    const x = o.x * T + b.x, y = o.y * T + b.y;
    for (let i = 0; i < cabinetLevel(st); i++) { px(ctx, x, y - i * 3, 8, 3, COL.k); px(ctx, x + 1, y - i * 3, 6, 2, COL.w); }
  }

  function objSprite(o, st) { return o.sprites ? o.sprites[trayState(st)] : o.sprite; }
  function drawObject(ctx, o, st, useSprites, t) {
    const S = root.POSprites;
    const key = objSprite(o, st);
    if (useSprites !== false && S.has(key)) {
      if (o.chair && !o.chairSeparate && S.has(o.chairSprite)) drawSpriteAt(ctx, o.chairSprite, 0, o.chair.x, o.chair.y, 1, 1, o.chairDx, o.chairDy, true);
      else if (o.chair && !o.chairSeparate) drawChairBlock(ctx, o.chair);
      drawSpriteAt(ctx, key, objFrame(o, t), o.x, o.y, o.w, o.h, o.dx, o.dy, o.type !== 'acornbasket');
      if (o.type === 'desk') {
        const pk = o.paperSprites && o.paperSprites[paperStage(paperCount(o, st)) - 1];
        if (pk && S.has(pk)) drawSpriteAt(ctx, pk, 0, o.x, o.y, o.w, o.h, (o.dx || 0) + (o.paperDx || 0), (o.dy || 0) + (o.paperDy || 0));
        else if (paperCount(o, st) && !(o.paperSprites && S.has(o.paperSprites[0]))) drawPaper(ctx, o, st);
      }
      return;
    }
    drawObjectBlock(ctx, o, st);
  }
  function drawDecor(ctx, L, layer, useSprites) {
    if (useSprites === false) return;
    const S = root.POSprites;
    L.objects.forEach((o) => { if (o[layer] && S.has(o.sprite)) drawSpriteAt(ctx, o.sprite, 0, o.x, o.y, o.w, o.h, o.dx, o.dy); });
  }
  function drawChairBlock(ctx, c) { px(ctx, c.x * T + 4, c.y * T + 3, 8, 7, COL.k); px(ctx, c.x * T + 5, c.y * T + 4, 6, 5, COL.h); }

  function drawObjectBlock(ctx, o, st) {
    const x = o.x * T, y = o.y * T;
    if (o.type === 'desk' || o.type === 'toriDesk') {
      px(ctx, x + 1, y + 3, 14, 10, COL.k); px(ctx, x + 2, y + 4, 12, 8, COL.b); px(ctx, x + 2, y + 10, 12, 2, COL.Tt);
      if (o.chair) drawChairBlock(ctx, o.chair);
      drawPaper(ctx, o, st);
    } else if (o.type === 'tray') {
      px(ctx, x + 2, y + 2, 12, 12, COL.k); px(ctx, x + 3, y + 3, 10, 10, COL.P);
      drawFiles(ctx, o, st);
    } else if (o.type === 'shelf') {
      px(ctx, x, y + 1, o.w * T, T - 2, COL.k); px(ctx, x + 1, y + 2, o.w * T - 2, T - 4, COL.b);
      for (let i = 0; i < o.w * 4; i++) { px(ctx, x + 2 + i * 4, y + 4, 2, 8, [COL.q, COL.Tt, COL.P, COL.L][i % 4]); }
    } else if (o.type === 'table') {
      px(ctx, x + 1, y + 2, o.w * T - 2, o.h * T - 4, COL.k); px(ctx, x + 2, y + 3, o.w * T - 4, o.h * T - 6, COL.b);
    } else if (o.type === 'sofa') {
      px(ctx, x + 1, y + 2, o.w * T - 2, 12, COL.k); px(ctx, x + 2, y + 3, o.w * T - 4, 5, COL.p); px(ctx, x + 2, y + 8, o.w * T - 4, 5, COL.o);
    } else if (o.type === 'roundtable') {
      px(ctx, x + 2, y + 6, o.w * T - 4, o.h * T - 10, COL.k); px(ctx, x + 3, y + 7, o.w * T - 6, o.h * T - 14, COL.w);
    } else if (o.type === 'cafechair') {
      px(ctx, x + (o.dx || 0) + 4, y + (o.dy || 0) + 6, 8, 8, COL.k); px(ctx, x + (o.dx || 0) + 5, y + (o.dy || 0) + 7, 6, 6, COL.o);
    } else if (o.type === 'watercooler') {
      px(ctx, x + 3, y - 12, 10, 27, COL.k); px(ctx, x + 4, y - 11, 8, 10, COL.p); px(ctx, x + 4, y, 8, 14, COL.w);
    } else if (o.type === 'plant') {
      px(ctx, x + 4, y + 9, 8, 6, COL.k); px(ctx, x + 5, y + 10, 6, 4, COL.P); px(ctx, x + 3, y + 1, 10, 9, COL.L); px(ctx, x + 4, y + 2, 8, 6, COL.l);
    }
  }

  const WALK = {
    frameMs: 130,
    order3: { cycle: [0, 1, 2, 1], stand: 1 },
    sheetOrder: ['down', 'left', 'right', 'up'],
  };
  const WALKERS = { get avatar() { const LN = root.PO_LINES, p = LN && LN.ownerPrefix ? LN.ownerPrefix() : 'avatar'; return { walk: p + '_walk', idle: p + '_idle' }; }, '토리': { walk: 'tori_walk', idle: 'tori_idle' } };
  const MIRROR = { left: 'right', right: 'left' };

  function walkSource(prefix, face) {
    const S = root.POSprites;
    const one = prefix + '_' + face;
    if (S.has(one)) return { key: one, base: 0, n: S.frameCount(one), flip: false };
    if (MIRROR[face] && S.has(prefix + '_' + MIRROR[face])) { const k = prefix + '_' + MIRROR[face]; return { key: k, base: 0, n: S.frameCount(k), flip: true }; }
    if (S.has(prefix)) {
      const a = root.PO_ASSETS[prefix];
      const order = Array.isArray(a.directions) ? a.directions : WALK.sheetOrder;
      const n = Math.floor(a.frames.length / order.length);
      if (n < 1) return null;
      let di = order.indexOf(face), flip = false;
      if (di < 0 && MIRROR[face]) { di = order.indexOf(MIRROR[face]); flip = di >= 0; }
      if (di < 0) di = order.indexOf('down') >= 0 ? order.indexOf('down') : 0;
      return { key: prefix, base: di * n, n, flip };
    }
    return null;
  }
  function walkFrame(prefix, face, walking, t) {
    const src = walkSource(prefix, face || 'down');
    if (!src) return null;
    let i;
    if (src.n === 3) i = walking ? WALK.order3.cycle[Math.floor(t / WALK.frameMs) % 4] : WALK.order3.stand;
    else i = walking ? Math.floor(t / WALK.frameMs) % src.n : 0;
    return { key: src.key, frame: src.base + i, flip: src.flip };
  }
  function moverSprite(who, t) {
    const w = WALKERS[who.kind === 'avatar' ? 'avatar' : who.key];
    if (!w) return null;
    const S = root.POSprites;
    if (who.walking) { const f = walkFrame(w.walk, who.face, true, t - (who.walkT0 || 0)); if (f) return f; }
    if (S.has(w.idle)) return { key: w.idle, frame: Math.floor((t + (who.phase || 0)) / 500) % S.frameCount(w.idle), flip: false };
    return walkFrame(w.walk, who.face, false, 0);
  }
  function drawFeetSprite(ctx, f, sx, sy) {
    const c = root.POSprites.frameCanvas(f.key, f.frame, f.flip);
    ctx.drawImage(c, sx + Math.floor((T - c.width) / 2), sy + T - c.height);
  }

  function drawPerson(ctx, who, fx, fy, t, useSprites) {
    const LN = root.PO_LINES;
    const sx = Math.round(fx * T), sy = Math.round(fy * T);
    if (!(who.pose === 'sit' && useSprites)) {
      if (root.POLook && root.PORender.look !== false) { px(ctx, sx + 4, sy + T - 3, 8, 1, 'rgba(35,20,30,0.22)'); px(ctx, sx + 3, sy + T - 2, 10, 1, 'rgba(35,20,30,0.30)'); px(ctx, sx + 4, sy + T - 1, 8, 1, 'rgba(35,20,30,0.18)'); }
      else px(ctx, sx + 3, sy + T - 2, 10, 2, COL.d);
    }
    if (useSprites && (who.kind === 'avatar' || who.key === '토리')) {
      const f = moverSprite(who, t);
      if (f) { drawFeetSprite(ctx, f, sx, sy); return; }
    }
    if (who.kind === 'avatar') {
      px(ctx, sx + 4, sy - 2, 8, 8, COL.k); px(ctx, sx + 5, sy - 1, 6, 6, COL.y); px(ctx, sx + 5, sy - 1, 6, 2, COL.a);
      px(ctx, sx + 4, sy + 6, 8, 8, COL.k); px(ctx, sx + 5, sy + 7, 6, 6, COL.c);
      px(ctx, sx + 5, sy + 13, 2, 3, COL.e); px(ctx, sx + 9, sy + 13, 2, 3, COL.e);
      return;
    }
    if (useSprites && who.pose) {
      const LC = root.POLayoutCheck;
      const b = LC.personBox(who, T);
      const sp = b.sprite;
      if (sp.key && root.POSprites.has(sp.key)) {
        const lift = Math.round((who.y - fy) * T);
        ctx.drawImage(root.POSprites.frameCanvas(sp.key, poseFrame(who, sp.key, t), sp.flip), b.x, b.y - lift);
        return;
      }
    }
    const spriteKey = LN.SPRITE[who.key];
    if (useSprites && spriteKey && root.POSprites.has(spriteKey)) {
      const f = Math.floor((t + (who.phase || 0)) / 500) % root.POSprites.frameCount(spriteKey);
      drawFeetSprite(ctx, { key: spriteKey, frame: f, flip: false }, sx, sy);
      return;
    }
    const pc = LN.POINT[who.key] || '#999';
    px(ctx, sx + 3, sy + 1, 10, 13, COL.k); px(ctx, sx + 4, sy + 2, 8, 11, pc); px(ctx, sx + 5, sy + 3, 6, 4, COL.w);
  }

  const COFFEE_SIP_MS = 600;
  function coffeeHoldMs(key) { return 2000 + (root.POCore.hashStr(key) % 2001); }
  function poseFrame(who, key, t) {
    const n = root.POSprites.frameCount(key);
    if (n < 2) return 0;
    const tt = t + (who.phase || 0);
    if (who.pose === 'coffee') { const hold = coffeeHoldMs(who.key); return (tt % (hold + COFFEE_SIP_MS)) < hold ? 0 : 1; }
    return Math.floor(tt / 500) % n;
  }
  function headTop(who, useSprites) {
    const LN = root.PO_LINES;
    const key = LN.SPRITE[who.key];
    if (useSprites && key && root.POSprites.has(key)) {
      const fr = root.PO_ASSETS[key].frames[0];
      for (let y = 0; y < fr.length; y++) if (fr[y].indexOf('k') >= 0) return T - fr.length + y;
    }
    return 1;
  }

  root.PORender = { T, COL, MARK, poseFrame, coffeeHoldMs, drawDecor, drawGoal, trayState, paperStage, paperCount, cabinetLevel, WALK, WALKERS, drawMap, drawObject, drawPerson, drawMark, headTop, px, walkFrame, moverSprite, spriteXY };
})(window);
