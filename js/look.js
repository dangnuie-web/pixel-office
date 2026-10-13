(function (root) {
  'use strict';
  const T = 16;

  const ROOM = {
    work:    { floor: 'tile',   c: ['#cfd3d8', '#c9cdd3', '#b3b8bf', '#dde0e4'], face: ['#ffffff', '#e6e8eb', '#dfe2e6', '#9aa1ab', '#c9ced5', '#6c7380'] },
    meeting: { floor: 'carpet', c: ['#b4bbc5', '#afb6c0', '#bac1ca', '#a3aab5'], face: ['#ffffff', '#e3e7ec', '#dce1e7', '#7f8fa3', '#b8c3cf', '#5a6676'] },
    break:   { floor: 'tile',   c: ['#d8dcd8', '#d2d6d1', '#bcc2bc', '#e5e8e4'], face: ['#ffffff', '#e8ebe6', '#e1e5df', '#7f9a84', '#a9bfa9', '#5c6b5e'] },
    lobby:   { floor: 'tile',   c: ['#dfe2e6', '#d9dce1', '#c3c8cf', '#eaecef'], face: ['#ffffff', '#eceef0', '#e5e8eb', '#a3a9b1', '#d3d7dc', '#6c7380'] },
    archive: { floor: 'plank',  c: ['#bdbcb9', '#b4b3b0', '#c8c7c4', '#9c9b98'], face: ['#ffffff', '#e6e6e8', '#dfdfe2', '#8e8c99', '#c5c3cc', '#62606c'] },
  };
  const CAP = { base: '#f3f4f6', inner: '#d6d9de', line: '#363b45' };
  const VOID = '#23262c';

  function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function roomOf(L, x, y) { return root.POLayoutCheck.roomAt(L, x, y); }
  function isFloor(L, x, y) { const r = L.rows[y]; return !!r && x >= 0 && x < L.w && (r[x] === '.' || r[x] === 'd'); }

  function floorTile(ctx, kind, c, gx, gy) {
    const x0 = gx * T, y0 = gy * T;
    if (kind === 'plank') {
      for (let r = 0; r < 4; r++) {
        const row = gy * 4 + r, y = y0 + r * 4;
        const shift = Math.floor(hash(row, 7, 1) * 40);
        for (let i = 0; i < T; i++) {
          const X = x0 + i, seg = Math.floor((X + shift) / 40);
          const tone = hash(seg, row, 2) < 0.5 ? c[0] : c[1];
          px(ctx, X, y, 1, 3, tone);
          if (hash(X, row, 3) < 0.06) px(ctx, X, y + 1, 1, 1, c[2]);
          px(ctx, X, y + 3, 1, 1, c[3]);
          if ((X + shift) % 40 === 0) px(ctx, X, y, 1, 3, c[3]);
        }
        px(ctx, x0, y, T, 1, 'rgba(255,255,255,0.12)');
      }
    } else if (kind === 'tile') {
      const v = hash(gx, gy, 4);
      px(ctx, x0, y0, T, T, v < 0.5 ? c[0] : c[1]);
      px(ctx, x0, y0, T, 1, c[2]); px(ctx, x0, y0, 1, T, c[2]);
      px(ctx, x0 + 1, y0 + 1, T - 1, 1, c[3]); px(ctx, x0 + 1, y0 + 1, 1, T - 1, c[3]);
      for (let k = 0; k < 2; k++) px(ctx, x0 + 3 + Math.floor(hash(gx, gy, 30 + k) * 10), y0 + 3 + Math.floor(hash(gy, gx, 40 + k) * 10), 1, 1, 'rgba(90,100,115,0.12)');
    } else if (kind === 'carpet') {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const X = x0 + i * 8, Y = y0 + j * 8, alt = ((gx * 2 + i) + (gy * 2 + j)) % 2;
        px(ctx, X, Y, 8, 8, alt ? c[0] : c[1]);
        for (let k = 0; k < 4; k++) alt ? px(ctx, X + 1, Y + 1 + k * 2, 6, 1, c[2]) : px(ctx, X + 1 + k * 2, Y + 1, 1, 6, c[2]);
      }
      for (let k = 0; k < 3; k++) { const a = hash(gx, gy, 10 + k); px(ctx, x0 + Math.floor(a * 16), y0 + Math.floor(hash(gy, gx, 20 + k) * 16), 1, 1, c[3]); }
    } else if (kind === 'check') {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const X = x0 + i * 8, Y = y0 + j * 8, alt = ((gx * 2 + i) + (gy * 2 + j)) % 2;
        px(ctx, X, Y, 8, 8, alt ? c[1] : c[0]);
        px(ctx, X, Y, 8, 1, alt ? '#c7d8b2' : '#f8efdc');
        px(ctx, X, Y + 7, 8, 1, alt ? c[3] : c[2]);
      }
    } else if (kind === 'stone') {
      const v = hash(gx, gy, 4);
      px(ctx, x0, y0, T, T, v < 0.33 ? c[0] : v < 0.66 ? c[1] : c[2]);
      px(ctx, x0, y0, T, 1, c[3]); px(ctx, x0, y0, 1, T, c[3]);
      px(ctx, x0 + 1, y0 + 1, T - 1, 1, 'rgba(255,255,255,0.18)');
      for (let k = 0; k < 4; k++) px(ctx, x0 + 2 + Math.floor(hash(gx, gy, 30 + k) * 12), y0 + 2 + Math.floor(hash(gy, gx, 40 + k) * 12), 1, 1, 'rgba(120,100,70,0.25)');
    } else if (kind === 'parquet') {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) {
        const X = x0 + i * 8, Y = y0 + j * 4, alt = (i + j + gx + gy) % 2;
        px(ctx, X, Y, 8, 4, hash(gx * 2 + i, gy * 4 + j, 5) < 0.5 ? c[0] : c[1]);
        if (alt) { px(ctx, X + 3, Y, 1, 4, c[3]); } else { px(ctx, X, Y + 3, 8, 1, c[3]); }
        px(ctx, X, Y, 8, 1, c[2]);
      }
    }
  }

  function wallFace(ctx, f, gx, gy) {
    const x = gx * T, y = gy * T;
    px(ctx, x, y, T, 2, CAP.base); px(ctx, x, y + 2, T, 1, CAP.line);
    px(ctx, x, y + 3, T, 1, f[0]);
    px(ctx, x, y + 4, T, 6, f[1]);
    for (let i = 0; i < T; i += 8) px(ctx, x + i, y + 4, 1, 6, f[2]);
    px(ctx, x, y + 10, T, 1, f[3]);
    px(ctx, x, y + 11, T, 4, f[4]);
    px(ctx, x, y + 11, T, 1, 'rgba(255,255,255,0.25)');
    px(ctx, x, y + 15, T, 1, f[5]);
  }
  function wallCap(ctx, L, gx, gy) {
    const x = gx * T, y = gy * T;
    const solid = (dx, dy) => { const r = L.rows[gy + dy]; const ch = r && r[gx + dx]; return ch === '#' || ch === 'e'; };
    px(ctx, x, y, T, T, CAP.base);
    const open = { l: !solid(-1, 0) && gx > 0, r: !solid(1, 0) && gx < L.w - 1, u: !solid(0, -1) && gy > 0, d: !solid(0, 1) && gy < L.h - 1 };
    if (gx === 0) open.l = true; if (gx === L.w - 1) open.r = true; if (gy === 0) open.u = true; if (gy === L.h - 1) open.d = true;
    if (open.l) { px(ctx, x, y, 1, T, CAP.line); px(ctx, x + 3, y, 1, T, CAP.inner); }
    if (open.r) { px(ctx, x + T - 1, y, 1, T, CAP.line); px(ctx, x + T - 4, y, 1, T, CAP.inner); }
    if (open.u) { px(ctx, x, y, T, 1, CAP.line); px(ctx, x, y + 3, T, 1, CAP.inner); }
    if (open.d) { px(ctx, x, y + T - 1, T, 1, CAP.line); px(ctx, x, y + T - 4, T, 1, CAP.inner); }
  }

  function wallShadows(ctx, L) {
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!isFloor(L, x, y)) continue;
      const wall = (dx, dy) => { const r = L.rows[y + dy]; return !!r && (r[x + dx] === '#' || r[x + dx] === 'e'); };
      if (wall(0, -1)) { px(ctx, x * T, y * T, T, 3, 'rgba(25,30,40,0.22)'); px(ctx, x * T, y * T + 3, T, 2, 'rgba(25,30,40,0.10)'); }
      if (wall(-1, 0)) { px(ctx, x * T, y * T, 2, T, 'rgba(25,30,40,0.16)'); px(ctx, x * T + 2, y * T, 1, T, 'rgba(25,30,40,0.07)'); }
      if (wall(1, 0)) px(ctx, x * T + T - 1, y * T, 1, T, 'rgba(25,30,40,0.10)');
    }
  }

  let bgCache = null;
  function background(L) {
    if (bgCache) return bgCache;
    const c = document.createElement('canvas'); c.width = L.w * T; c.height = L.h * T;
    const ctx = c.getContext('2d');
    px(ctx, 0, 0, c.width, c.height, VOID);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const ch = L.rows[y][x];
      if (ch === '.' || ch === 'd') {
        let r = roomOf(L, x, y);
        if (!r && ch === 'd') { const d = L.doors.find((q) => q.x === x && q.y === y); r = d && L.rooms.find((q) => q.id === d.b); }
        const R = ROOM[r ? r.id : 'lobby'];
        floorTile(ctx, R.floor, R.c, x, y);
      } else if (isFloor(L, x, y + 1) && L.rows[y + 1][x] !== 'd') {
        const r = roomOf(L, x, y + 1);
        wallFace(ctx, ROOM[r ? r.id : 'lobby'].face, x, y);
      } else {
        wallCap(ctx, L, x, y);
      }
    }
    wallShadows(ctx, L);
    bgCache = c;
    return c;
  }

  const silCache = new Map();
  function silhouette(src) {
    let s = silCache.get(src);
    if (s) return s;
    s = document.createElement('canvas'); s.width = src.width; s.height = src.height;
    const g = s.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(25,30,40,0.20)'; g.fillRect(0, 0, s.width, s.height);
    silCache.set(src, s);
    return s;
  }
  function objectShadow(ctx, key, frame, x, y) {
    const S = root.POSprites;
    if (!S.has(key)) return;
    ctx.drawImage(silhouette(S.frameCanvas(key, frame || 0)), x + 2, y + 1);
  }

  let lightCache = null;
  function lightLayer(L) {
    if (lightCache) return lightCache;
    const W = L.w * T, H = L.h * T;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const win = L.objects.find((o) => o.type === 'window');
    if (win) {
      g.fillStyle = 'rgba(235,245,255,0.16)';
      g.beginPath(); g.moveTo(win.x * T, T); g.lineTo((win.x + win.w) * T, T); g.lineTo((win.x + win.w - 1.5) * T, 5 * T); g.lineTo((win.x - 2) * T, 5 * T); g.fill();
    }
    const im = g.getImageData(0, 0, W, H), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = Math.round(d[i] / 12) * 12;
    g.putImageData(im, 0, 0);
    lightCache = c;
    return c;
  }
  function drawLight(ctx, L) {
    ctx.save();
    ctx.drawImage(lightLayer(L), 0, 0);
    ctx.restore();
  }

  const CHAR = { o: '#4a505b', p: '#6b7280', q: '#363b44', W: '#262a31', T: '#2a2e35' };
  const LG = { J: '#d5d9de', M: '#b9bfc7' };
  const PAL = {
    desk: { b: '#eef0f2', d: '#d5d9de', v: '#f7f8f9', P: '#9aa1ab', O: '#6c7380', T: '#4a505a', p: '#7cc4ea' },
    chair: CHAR,
    cafechair: { o: '#3f6fb5', p: '#6b95d1', q: '#2c5390', W: '#22324a', T: '#22324a' },
    meetingtable: { b: '#e8eaed', d: '#cfd3d8', v: '#f4f5f6', w: '#fafafa', h: '#d9dce0', T: '#5a616b' },
    rug: { q: '#7d8796', o: '#a3acb8', p: '#c9d0d8', w: '#eef1f4' },
    entrancemat: { q: '#4a505b', o: '#6b7280' },
    sofa: { o: '#5b7da6', p: '#86a3c6', q: '#3f5f86', T: '#2f3b4c' },
    door_ns: { f: '#e4e7ea', h: '#c3c8cf', v: '#f0f2f4', T: '#6c7380' },
    door_we: { f: '#e4e7ea', h: '#c3c8cf', v: '#f0f2f4', T: '#6c7380' },
    exitdoor: { p: '#8fa3b8', B: '#b3c3d3', T: '#4a505a' },
    reception: Object.assign({ P: '#5a616b', h: '#c9ced5', v: '#e3e6ea', w: '#f4f5f7' }, LG),
    plant: { P: '#e9ebee', O: '#b9bfc7', l: '#6fae5e', L: '#3f7d43' },
    bookshelf: Object.assign({ b: '#eef0f2', d: '#d3d7dc', T: '#6c7380' }, LG),
    window: { p: '#bfe3f2', B: '#94cae2', v: '#e9f5fa' },
    sidetable: { b: '#d5d9de', d: '#b9bfc7', T: '#5a616b' },
    coffee: { p: '#9aa1ab' },
    filebox: LG, whiteboard: LG,
  };
  function palFor(key) { return PAL[key] || (/^tray_/.test(key) ? { b: '#d5d9de', T: '#5a616b' } : /^filebox/.test(key) ? LG : null); }

  root.POLook = { background, objectShadow, drawLight, ROOM, palFor };
})(window);
