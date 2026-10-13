'use strict';
(function () {
  const WALK_MS = 130;
  const WALK_BOB = false;
  const toriEl = document.getElementById('tori');
  const ctx = toriEl.getContext('2d');
  const wrap = document.getElementById('bwrap');
  const btext = document.getElementById('btext');
  const tail = document.getElementById('btail');
  const P_WALK_MS = 170;
  const P_WAVE_MS = 300;
  const P_LIFT_MS = 220;
  const BLINK_MIN = 3000, BLINK_MAX = 6000;
  let BLINK_MS = 150;
  let S = {}, scale = 4, gw = 16, gh = 21, winW = 300;
  let P = null;
  let cssW = 64, cssH = 84, headH = 84;
  let nextBlink = 0;
  let pose = { mode: 'idle', dir: 'left' }, poseAt = performance.now();
  let view = { left: 0, right: 300 };
  let bubbleTimer = null, lastKey = '';

  window.TP.on('pet:init', (d) => {
    S = d.sprites || {}; winW = d.winW;
    if (d.png) {
      const L = d.png.layout, dpr = window.devicePixelRatio || 1;
      P = { L, img: {}, pixelated: !!d.png.pixelated, dpr, ready: 0, total: 0 };
      Object.keys(d.png.images).forEach((k) => {
        P.img[k] = d.png.images[k].map((url) => { const im = new Image(); P.total++; im.onload = () => { P.ready++; lastKey = ''; }; im.src = url; return im; });
      });
      cssW = L.W; cssH = L.H; headH = L.headH;
      toriEl.width = Math.round(cssW * dpr); toriEl.height = Math.round(cssH * dpr);
      toriEl.style.imageRendering = 'auto';
      nextBlink = performance.now() + rnd(BLINK_MIN, BLINK_MAX);
    } else {
      scale = d.scale; gw = d.gw; gh = d.gh;
      cssW = gw * scale; cssH = gh * scale; headH = cssH;
      toriEl.width = gw; toriEl.height = gh;
    }
    toriEl.style.width = cssW + 'px'; toriEl.style.height = cssH + 'px';
    toriEl.style.left = toriLeft() + 'px';
    if (S.ui_tail) {
      const fr = S.ui_tail.frames[0]; tail.width = fr[0].length; tail.height = fr.length;
      tail.style.width = tail.width * 3 + 'px'; tail.style.height = tail.height * 3 + 'px';
      window.Pix.draw(tail.getContext('2d'), S.ui_tail, 0, 0, 0, false);
    }
    lastKey = ''; requestAnimationFrame(loop);
  });
  window.TP.on('pet:pose', (p) => { if (p.mode !== pose.mode) poseAt = performance.now(); pose = p; });
  window.TP.on('pet:view', (v) => { view = v; toriEl.style.left = toriLeft() + 'px'; if (!wrap.hidden) placeBubble(); });
  window.TP.on('pet:say', (d) => showBubble(d.text, d.ms, d.rich));
  window.TP.on('pet:hideBubble', () => hideBubble(false));

  const rnd = (a, b) => a + Math.random() * (b - a);
  function lookPng(t, now) {
    const m = pose.mode;
    const pick = (a, f) => { const fc = P.L.place[a].facing; return { a, f, flip: fc !== 'front' && fc !== pose.dir }; };
    if (m === 'walk') return pick('walk', Math.floor(t / P_WALK_MS) % 4);
    if (m === 'talk') return pick('wave', Math.floor(t / P_WAVE_MS) % 2);
    if (m === 'drag') return pick('lift', Math.floor(t / P_LIFT_MS) % 2);
    if (now >= nextBlink + BLINK_MS) nextBlink = now + rnd(BLINK_MIN, BLINK_MAX);
    return pick('stand', now >= nextBlink ? 1 : 0);
  }
  function drawPng(now) {
    if (P.ready < P.total) return;
    const L = lookPng(Math.max(0, now - poseAt), now);
    const key = L.a + ':' + L.f + ':' + L.flip + ':' + P.pixelated;
    if (key === lastKey) return;
    lastKey = key;
    const list = P.img[L.a], n = list.length;
    const pl = P.L.place[L.a], im = list[((L.f % n) + n) % n];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, toriEl.width, toriEl.height);
    ctx.imageSmoothingEnabled = !P.pixelated;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    if (L.flip) { ctx.translate(cssW, 0); ctx.scale(-1, 1); }
    ctx.drawImage(im, pl.x, pl.y, pl.w, pl.h);
  }

  function look(t) {
    const m = pose.mode, right = pose.dir === 'right';
    const idle = S.tori_idle;
    const slow = (ms, s) => Math.floor(t / ms) % ((s && s.frames.length) || 1);
    if (m === 'walk') {
      if (S.tori_walk_left) { const f = [0, 1, 2, 1][Math.floor(t / WALK_MS) % 4]; return { s: S.tori_walk_left, f, flip: right, dy: WALK_BOB && f !== 1 ? 0 : 1 }; }
      const s = S.tori_idle_left || idle;
      return { s, f: 0, flip: right && !!S.tori_idle_left, dy: Math.floor(t / WALK_MS) % 2 };
    }
    if (m === 'sit' && S.tori_sit) return { s: S.tori_sit, f: slow(700, S.tori_sit), flip: false, dy: 1 };
    if (m === 'coffee' && S.tori_coffee) return { s: S.tori_coffee, f: slow(700, S.tori_coffee), flip: false, dy: 1 };
    if (m === 'talk') return S.tori_wave ? { s: S.tori_wave, f: slow(350, S.tori_wave), flip: false, dy: 1 } : { s: idle, f: slow(600, idle), flip: false, dy: 1 };
    if (m === 'drag') return S.tori_wave ? { s: S.tori_wave, f: slow(160, S.tori_wave), flip: false, dy: 1 } : { s: idle, f: 1, flip: false, dy: Math.floor(t / 160) % 2 };
    return { s: idle, f: slow(600, idle), flip: false, dy: 1 };
  }
  function loop(now) {
    if (P) { try { drawPng(now); } finally { requestAnimationFrame(loop); } return; }
    const L = look(Math.max(0, now - poseAt));
    if (L.s) {
      const key = L.s.frames.length + ':' + L.f + ':' + L.flip + ':' + L.dy + ':' + Object.keys(S).find((k) => S[k] === L.s);
      if (key !== lastKey) {
        lastKey = key;
        ctx.clearRect(0, 0, gw, gh);
        const fr = L.s.frames[0];
        window.Pix.draw(ctx, L.s, L.f, Math.floor((gw - fr[0].length) / 2), gh - fr.length - 1 + L.dy, L.flip);
      }
    }
    requestAnimationFrame(loop);
  }

  function toriLeft() { return view.toriX != null ? view.toriX : Math.round((winW - cssW) / 2); }
  function placeBubble() {
    const bw = wrap.offsetWidth, bh = document.getElementById('bubble').offsetHeight;
    const cx = toriLeft() + cssW / 2;
    const lo = Math.max(4, view.left + 4), hi = Math.min(winW - 4, view.right - 4);
    let x = Math.round(cx - bw / 2); x = Math.max(lo, Math.min(x, hi - bw));
    const tailH = tail.height * 3;
    const top = window.innerHeight - headH - tailH - bh + 6;
    wrap.style.left = x + 'px'; wrap.style.top = Math.max(0, top) + 'px';
    const tx = Math.max(6, Math.min(Math.round(cx - x - tail.width * 3 / 2), bw - tail.width * 3 - 6));
    tail.style.left = tx + 'px'; tail.style.top = (bh - 3) + 'px';
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function colorInto(box, r) {
    box.appendChild(el('div', 'rm-h', r.head));
    const row = el('div', 'co-l'), chip = el('span', 'co-chip');
    if (/^#[0-9A-F]{6}$/.test(r.hex)) chip.style.background = r.hex;
    row.appendChild(chip); row.appendChild(el('b', 'co-hex', r.hex));
    box.appendChild(row);
  }
  function richInto(box, r) {
    if (r.kind === 'color') { colorInto(box, r); return; }
    const h = el('div', 'rm-h');
    if (S.ui_clock) {
      const fr = S.ui_clock.frames[0], c = el('canvas');
      c.width = fr[0].length; c.height = fr.length; c.style.width = c.width * 2 + 'px'; c.style.height = c.height * 2 + 'px';
      window.Pix.draw(c.getContext('2d'), S.ui_clock, 0, 0, 0, false);
      h.appendChild(c);
    }
    h.appendChild(el('span', null, r.head));
    box.appendChild(h);
    (r.lines || []).forEach((l) => {
      const row = el('div', 'rm-l');
      row.appendChild(el('span', 't', l.t)); row.appendChild(el('span', 'x', l.text));
      if (l.tag) row.appendChild(el('span', 'tag' + (l.src === 'house' ? ' house' : ''), l.tag));
      box.appendChild(row);
    });
    if (r.hint) box.appendChild(el('div', 'rm-hint', r.hint));
  }
  function showBubble(text, ms, rich) {
    btext.textContent = '';
    btext.classList.toggle('rich', !!rich);
    if (rich) richInto(btext, rich); else btext.textContent = text;
    wrap.hidden = false; wrap.classList.remove('pop'); void wrap.offsetWidth; wrap.classList.add('pop');
    placeBubble();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => hideBubble(true), ms);
  }
  function hideBubble(tell) {
    clearTimeout(bubbleTimer);
    if (wrap.hidden) return;
    wrap.hidden = true;
    if (tell) window.TP.send('pet:bubbleDone');
  }

  function onTori(x, y) {
    const r = toriEl.getBoundingClientRect();
    const sx = toriEl.width / r.width, sy = toriEl.height / r.height;
    const px = Math.floor((x - r.left) * sx), py = Math.floor((y - r.top) * sy);
    const rx = Math.max(1, Math.round(sx)), ry = Math.max(1, Math.round(sy));
    if (px < -rx || py < -ry || px >= toriEl.width + rx || py >= toriEl.height + ry) return false;
    const x0 = Math.max(0, px - rx), y0 = Math.max(0, py - ry);
    const w = Math.min(toriEl.width, px + rx + 1) - x0, h = Math.min(toriEl.height, py + ry + 1) - y0;
    if (w <= 0 || h <= 0) return false;
    const d = ctx.getImageData(x0, y0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) return true;
    return false;
  }
  function onBubble(x, y) {
    if (wrap.hidden) return false;
    const r = wrap.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  let hit = false, down = false;
  function setHit(h) { if (h !== hit) { hit = h; window.TP.send('pet:hit', h); } }
  window.addEventListener('mousemove', (e) => { if (!down) setHit(onTori(e.clientX, e.clientY) || onBubble(e.clientX, e.clientY)); });
  document.addEventListener('mouseleave', () => { if (!down) setHit(false); });
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (onBubble(e.clientX, e.clientY)) { hideBubble(true); return; }
    if (!onTori(e.clientX, e.clientY)) return;
    down = true; toriEl.setPointerCapture(e.pointerId);
    window.TP.send('pet:dragStart');
  });
  const up = () => { if (!down) return; down = false; window.TP.send('pet:dragEnd'); };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (onTori(e.clientX, e.clientY) || onBubble(e.clientX, e.clientY)) window.TP.send('pet:menu');
  });

  const pad = document.getElementById('pad');
  const IMG_TYPE = /^image\/(png|jpeg|gif|webp|avif|svg\+xml)$/;
  let dropKey = '';
  function dragInfo(dt) {
    const files = Array.from((dt && dt.items) || []).filter((i) => i.kind === 'file');
    return { files: files.length, img: files.filter((i) => IMG_TYPE.test(i.type)).length };
  }
  function showPad(kind) {
    pad.hidden = !kind; pad.className = kind === 'no' ? 'no' : '';
    if (kind) pad.style.left = Math.round(toriLeft() + cssW / 2 - 70) + 'px';
  }
  function hover(kind, n) {
    const key = kind ? kind + n : '';
    if (key === dropKey) return;
    dropKey = key; showPad(kind);
    window.TP.send('pet:dropHover', kind ? { kind, n } : null);
  }
  ['dragenter', 'dragover'].forEach((ev) => window.addEventListener(ev, (e) => {
    const inf = dragInfo(e.dataTransfer);
    if (!inf.files) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = inf.img ? 'copy' : 'none';
    hover(inf.img ? 'img' : 'no', inf.img);
  }));
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) { hover(null); window.TP.send('pet:hit', false); hit = false; } });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    hover(null);
    if (files.length) window.TP.send('pet:drop', window.TP.pathsOf(files));
  });

  window.__petDebug = () => ({ pose, bubble: wrap.hidden ? null : btext.textContent, rich: btext.classList.contains('rich'), bubbleBox: wrap.hidden ? null : wrap.getBoundingClientRect().toJSON(), hit, view, sprites: Object.keys(S), png: P ? { ready: P.ready, total: P.total, pixelated: P.pixelated, last: lastKey, cssW, cssH, headH } : null });
  window.__petSetPixelated = (on) => { if (P) { P.pixelated = !!on; lastKey = ''; } return !!(P && P.pixelated); };
  window.__petOnTori = onTori;
  window.__petPad = (kind) => { showPad(kind); return !pad.hidden; };
  window.__petBlinkNow = (hold) => { BLINK_MS = hold || 150; nextBlink = performance.now(); lastKey = ''; };
})();
