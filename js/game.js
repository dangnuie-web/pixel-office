(function (root) {
  'use strict';
  const NM = (t) => (root.PONames ? root.PONames.sub(t) : t);
  const R = root.PORender, L = root.PO_LAYOUT, LC = root.POLayoutCheck, C = root.POCore, LN = root.PO_LINES;
  const T = 16, W = 384, H = 256;
  const STEP_MS = 170;
  const TORI_STEP_MS = 170;
  const AFTER_BUBBLE_IGNORE = 300;
  const TYPE_MS = 20;
  const DN_AUTO_MS = 800;
  const DN_LINE = { enter: '나 왔어', replay: '어디까지 했어?' };
  const DIRS = { ArrowUp: [0, -1, 'up'], ArrowDown: [0, 1, 'down'], ArrowLeft: [-1, 0, 'left'], ArrowRight: [1, 0, 'right'] };
  const FACE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const G = {
    app: null, st: null, scale: 2, useSprites: true, showRoomNames: false, entered: false, readFail: false,
    grid: null, people: [], avatar: null, tori: null, bubble: null, win: null, lastClose: 0, held: [], debug: null, t0: 0,
    els: {}, tagEls: {},
  };

  function place() {
    const st = G.st;
    G.people = [];
    if (!st) return;
    const desks = {}; L.objects.forEach((o) => { if (o.type === 'desk') desks[o.owner] = o; });
    let mi = 0, ori = false;
    const brk = [];
    st.staff.forEach((s, i) => {
      if (s.isTori) return;
      if (G.app && G.app.leave && G.app.leave.has(s.key)) return;
      let where = s.place, mark = s.mark;
      if (G.debug === 'allDesk') { where = desks[s.key] ? 'desk' : 'break'; }
      if (G.debug === 'allBreak' || G.debug === 'allBreak0') { where = 'break'; }
      if (G.debug === 'allBreak0') mark = '';
      else if (G.debug) mark = (G.debug === 'allDesk' ? (s.name === '몽글' ? '?' : '') : (s.name === '비트' ? '!' : s.name === '바나 쌤' ? '?' : ''));
      const p = { key: s.key, name: s.name, x: 0, y: 0, mark, phase: (i * 137) % 500, staff: s, pose: 'idle', face: 'down' };
      if (!ori && C.charOf(s) === 'organizer' && !G.debug && G.oriAct !== false && (ori = true)) {
        const memo = (s.latest && s.latest.memo) || (s.cells || []).map((c) => c.item).join(' ');
        where = s.place === 'desk' || s.place === 'meeting' ? (/계획/.test(memo) ? 'desk' : 'shelf') : 'mop';
        if (where === 'shelf') { Object.assign(p, { x: ORI.shelf[0], y: ORI.shelf[1], pose: 'idle', face: 'up', act: 'shelf' }); G.people.push(p); return; }
        if (where === 'mop') { Object.assign(p, { x: ORI.home[0], y: ORI.home[1], fx: ORI.home[0], fy: ORI.home[1], pose: 'idle', face: 'left', act: 'mop', next: 0 }); G.people.push(p); return; }
      }
      if (where === 'desk' && desks[s.key]) {
        const d = desks[s.key]; p.x = d.chair.x; p.y = d.chair.y;
        if (d.chairSeparate) Object.assign(p, { pose: 'sit', face: 'down', px: p.x * T, py: (p.y + 1) * T - 20 + 6 });
        else Object.assign(p, { pose: 'sit', face: 'up', px: p.x * T, py: (p.y + 1) * T - 20 + 1 });
      }
      else if (where === 'meeting' && mi < L.meetingSpots.length) { [p.x, p.y] = L.meetingSpots[mi++]; }
      else brk.push(p);
      G.people.push(p);
    });
    G.breakSeat = C.assignBreakFor(L, brk.map((p) => ({ key: p.key, name: p.name, mark: p.mark })), st.base);
    brk.forEach((p) => {
      const t = G.breakSeat && G.breakSeat.seats[p.key];
      if (t) Object.assign(p, { x: t.x, y: t.y, px: t.px, py: t.py, pose: t.pose, face: t.face, group: t.group, kind: t.kind, spot: t.spot });
      else { const f = C.firstFreeTile(L, 'break') || [1, 9]; p.x = f[0]; p.y = f[1]; }
    });
  }
  const ORI = { shelf: [19, 10], home: [19, 12], range: { x1: 18, x2: 21, y1: 10, y2: 12 }, stepMs: 700 };
  function stepOri(now) {
    const p = G.people.find((q) => q.act === 'mop'); if (!p) return;
    if (p.moving) {
      const k = Math.min(1, (now - p.moving.t0) / ORI.stepMs);
      p.fx = p.moving.from[0] + (p.x - p.moving.from[0]) * k; p.fy = p.moving.from[1] + (p.y - p.moving.from[1]) * k;
      if (k >= 1) { p.moving = null; p.fx = p.x; p.fy = p.y; p.next = now + 900 + (C.hashStr(String(now)) % 1600); }
    } else if (now >= p.next) {
      const R2 = ORI.range, opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map((d) => [p.x + d[0], p.y + d[1]])
        .filter(([x, y]) => x >= R2.x1 && x <= R2.x2 && y >= R2.y1 && y <= R2.y2 && walkable(x, y) && !G.people.some((q) => q !== p && q.x === x && q.y === y) && !(G.avatar && G.avatar.x === x && G.avatar.y === y));
      if (opts.length) {
        const n = opts[Math.floor(Math.random() * opts.length)];
        if (n[0] !== p.x) p.face = n[0] > p.x ? 'right' : 'left';
        p.moving = { from: [p.x, p.y], t0: now }; p.x = n[0]; p.y = n[1];
      } else p.next = now + 1000;
    }
    p.px = Math.round(p.fx * T); p.py = Math.round((p.fy + 1) * T - 20);
  }
  function drawMop(ctx, p, now) {
    const d = p.face === 'right' ? 1 : -1, sway = Math.floor(now / 260) % 2;
    const hx = p.px + (d > 0 ? 12 : 3), hy = p.py + 10;
    const bx = p.px + (d > 0 ? 17 : -2) + sway * d, by = p.py + 19;
    const n = Math.max(1, by - hy);
    for (let i = 0; i <= n; i++) R.px(ctx, Math.round(hx + (bx - hx) * i / n), hy + i, 1, 1, i === 0 ? '#363b45' : '#8a7560');
    R.px(ctx, bx - 3, by - 1, 7, 1, '#363b45'); R.px(ctx, bx - 3, by, 7, 1, '#e9ebee'); R.px(ctx, bx - 3, by + 1, 7, 1, '#b9bfc7');
    R.px(ctx, bx - 4, by + 1, 1, 1, '#363b45'); R.px(ctx, bx + 4, by + 1, 1, 1, '#363b45');
    R.px(ctx, bx - 5, by + 2, 11, 1, 'rgba(120,170,220,0.28)');
  }
  function drawShelfWork(ctx, p, now) {
    const ph = Math.floor(now / 600) % 4, x = p.x * T + (ph < 2 ? 3 : 9), y = p.y * T - 6 - (ph % 2 ? 2 : 0);
    R.px(ctx, x, y, 3, 5, '#363b45'); R.px(ctx, x + 1, y + 1, 1, 3, ['#7d8fa8', '#a3b5a0', '#c9a3a8', '#d8c48a'][Math.floor(now / 2400) % 4]);
  }
  function personAt(x, y) { return G.people.find((p) => p.x === x && p.y === y) || null; }
  function objAt(x, y) { return L.objects.find((o) => !o.floor && !o.wall && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) || null; }
  function walkable(x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
    return G.grid[y][x] === 'floor';
  }
  function bfs(from, to) {
    const key = (p) => p[0] + ',' + p[1];
    const prev = new Map([[key(from), null]]);
    const q = [from];
    while (q.length) {
      const c = q.shift();
      if (c[0] === to[0] && c[1] === to[1]) break;
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = [c[0] + d[0], c[1] + d[1]];
        if (!prev.has(key(n)) && walkable(n[0], n[1])) { prev.set(key(n), c); q.push(n); }
      }
    }
    if (!prev.has(key(to))) return null;
    const path = []; let c = to;
    while (c && !(c[0] === from[0] && c[1] === from[1])) { path.unshift(c); c = prev.get(key(c)); }
    return path;
  }

  function setData(result) {
    G.result = result;
    G.st = result.state;
    if (G.st && G.st.source === 'roadmap') G.st.approvals = G.st.ownerTurn.length;
    G.readFail = !!result.readFail;
    place();
    rebuildTags();
  }
  function enter(app) {
    G.app = app;
    G.grid = LC.grid(L);
    setupDom();
    setData(app.result);
    G.avatar = { x: L.spawn[0], y: L.spawn[1], fx: L.spawn[0], fy: L.spawn[1], face: L.spawnFace, moving: null };
    G.trail = [];
    G.tori = { x: L.toriHome[0], y: L.toriHome[1], fx: L.toriHome[0], fy: L.toriHome[1], face: 'down', mode: 'enter', path: [], moving: null, target: null };
    G.entered = true;
    const mode = app.settings.mode;
    const store = root.POLoader.store;
    const opened = store.get(mode, 'openedDates') || [];
    G.firstVisit = opened.length === 0;
    const today = new Date(); const ds = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (opened.indexOf(ds) < 0) { opened.push(ds); store.set(mode, 'openedDates', opened); }
    if (!needsCheck()) { G.tori.mode = 'desk'; G.tori.path = []; showNotice(); if (!G.loopOn) { G.loopOn = true; requestAnimationFrame(loop); } G.els.stage.focus(); return; }
    const side = [[L.spawn[0] - 1, L.spawn[1]], [L.spawn[0] + 1, L.spawn[1]], [L.spawn[0], L.spawn[1] - 1]].find((p) => walkable(p[0], p[1]));
    G.tori.path = (side && bfs([G.tori.x, G.tori.y], side)) || [];
    G.tori.target = side;
    showNotice();
    if (!G.loopOn) { G.loopOn = true; requestAnimationFrame(loop); }
    G.els.stage.focus();
  }
  function needsCheck() {
    const st = G.st;
    if (G.readFail || !st) return true;
    return (st.waits && st.waits.length > 0) || (st.exNames && st.exNames.length > 0) || (st.ownerTurn && st.ownerTurn.length > 0);
  }
  function startBriefing(kind) {
    if (!G.st && !G.readFail) return;
    const mode = G.app.settings.mode;
    const store = root.POLoader.store;
    const opts = { kind, readFail: G.readFail, hasLast: !!(G.result && G.result.hasLast), lastSaved: store.get(mode, 'lastSaved') };
    const br = C.buildBriefing(G.st, opts);
    G.bubble = { list: br.bubbles, i: 0, save: G.readFail ? null : C.compareValues(G.st), kind: br.kind,
      dn: kind === 'replay' ? DN_LINE.replay : DN_LINE.enter, onDn: true };
    if (kind === 'replay' && root.POPet && root.POPet.available()) { G.bubble.list = br.bubbles.concat([PET_LINE]); G.bubble.petAt = G.bubble.list.length - 1; }
    G.lastBriefing = br;
    setPage();
  }
  const PET_LINE = '바탕화면에도 제가 나가 있을까요? Enter를 누르면 펫을 띄워요.';
  async function petFromBubble() {
    closeBubble(true);
    const r = await root.POPet.launch();
    G.bubble = { list: [r.text], i: 0, save: null, kind: 'pet', dn: null, onDn: false };
    setPage();
  }
  function closeBubble(finished) {
    if (!G.bubble) return;
    if (finished && G.bubble.save) root.POLoader.store.set(G.app.settings.mode, 'lastSaved', G.bubble.save);
    G.bubble = null;
    G.lastClose = performance.now();
    if (G.tori && (G.tori.mode === 'follow' || G.tori.mode === 'enter')) { G.tori.mode = 'home'; G.tori.target = L.toriHome.slice(); }
    G.els.dlg.hidden = true;
  }
  function toriToFollow() { G.tori.mode = 'follow'; }
  function toriGoHome() { G.tori.mode = 'home'; G.tori.target = L.toriHome.slice(); }

  function onKeyDown(e) {
    if (!G.entered || G.app.tab !== 'office' || G.app.screen !== 'office') return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#tabs')) return;
    const k = e.key;
    if ((k === 'n' || k === 'N' || k === 'ㅜ') && !G.win && !e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleNames(); return; }
    const isArrow = !!DIRS[k];
    const isAct = k === ' ' || k === 'Enter';
    if (isArrow || isAct) e.preventDefault();
    if (G.win) {
      if (G.win.type === 'board' && boardKey(k)) return;
      if (G.win.type === 'shelf' && shelfKey(k, e)) return;
      if (G.win.type === 'desk' && G.win.drw && deskKey(k, e)) return;
      if (k === 'Escape') { closeWin(); return; }
      if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); scrollWin(k === 'PageDown' ? 1 : -1); return; }
      if (G.win.type === 'badge' && (k === 'ArrowLeft' || k === 'ArrowRight')) { flipBadge(k === 'ArrowLeft' ? -1 : 1); return; }
      if (G.win.type === 'approval' && (k === 'ArrowLeft' || k === 'ArrowRight')) { renderApproval(k === 'ArrowLeft' ? 0 : 1, true); return; }
      if (isArrow) { closeWin(); pressDir(k); return; }
      return;
    }
    if (G.bubble) {
      if (onWays() && !e.repeat && (k === 'Enter' || k === 'a' || k === 'A' || k === 'ㅁ')) { e.preventDefault(); if (k === 'Enter') wayNow(); else wayAI(); return; }
      if (k === 'Enter' && !e.repeat && G.bubble.petAt != null && !G.bubble.onDn && G.bubble.i === G.bubble.petAt) { petFromBubble(); return; }
      if (isAct) { if (e.repeat) return; nextBubble(); return; }
      if (isArrow) { closeBubble(false); if (G.tori.mode === 'enter') toriToFollow(); pressDir(k); return; }
      if (k === 'Escape') { closeBubble(false); return; }
      return;
    }
    if (isArrow) {
      if (G.tori.mode === 'enter') toriGoHome();
      G.avatar.goal = null;
      pressDir(k); return;
    }
    if (k === 'Escape' && G.avatar.goal) { G.avatar.goal = null; return; }
    if (isAct) {
      if (e.repeat) return;
      if (G.avatar.goal) return;
      if (performance.now() - G.lastClose < AFTER_BUBBLE_IGNORE) return;
      if (G.tori.mode === 'enter') return;
      interactFront();
    }
  }
  function onKeyUp(e) { G.held = G.held.filter((k) => k !== e.key); }
  function pressDir(k) { if (G.held.indexOf(k) < 0) G.held.push(k); G.tapDir = k; }
  function nextBubble() {
    const B = G.bubble;
    if (B.onDn) { B.onDn = false; B.i = 0; setPage(); return; }
    if (B.shown < B.len) { B.shown = B.len; B.doneAt = performance.now(); drawDialog(); return; }
    B.i++;
    if (B.i >= B.list.length) { closeBubble(true); return; }
    setPage();
  }
  function setPage() {
    const B = G.bubble, now = performance.now();
    B.text = NM(B.onDn ? B.dn : B.list[B.i]);
    B.chars = Array.from(B.text); B.len = B.chars.length;
    B.t0 = now;
    B.shown = reduceMotion() ? B.len : 0;
    B.doneAt = B.shown >= B.len ? now : null;
    drawDialog();
  }
  function stepDialog(now) {
    const B = G.bubble; if (!B) return;
    if (B.shown < B.len) {
      const n = Math.min(B.len, Math.floor((now - B.t0) / TYPE_MS));
      if (n !== B.shown) { B.shown = n; if (n >= B.len) B.doneAt = now; drawText(); }
    }
    if (B.onDn && B.doneAt != null && now - B.doneAt >= DN_AUTO_MS) { B.onDn = false; B.i = 0; setPage(); }
  }

  function targetAtTile(x, y, how) {
    if (G.tori && G.tori.x === x && G.tori.y === y) return { type: 'tori' };
    const p = personAt(x, y); if (p) return { type: 'staff', key: p.key };
    const o = objAt(x, y);
    if (o) {
      if (o.type === 'desk') return { type: 'desk', owner: o.owner };
      if (o.type === 'toriDesk') return { type: 'tori' };
      if (o.type === 'tray') return { type: 'approval' };
      if (o.type === 'shelf') return { type: 'shelf' };
      if (o.type === 'whiteboard') return { type: 'board' };
    }
    const d = LC.doorAt(L, x, y);
    if (d) {
      const here = LC.roomAt(L, G.avatar.x, G.avatar.y);
      const other = here && here.id === d.a ? d.b : d.a;
      if (how === 'space') return { type: 'room', room: other };
      return { type: 'room', room: d.a === 'lobby' ? d.b : d.b === 'lobby' ? d.a : other };
    }
    if (how === 'click' && L.objects.some((o) => o.type === 'exitdoor' && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)) return { type: 'room', room: 'lobby' };
    return null;
  }
  function interactFront() {
    const f = FACE[G.avatar.face];
    const t = targetAtTile(G.avatar.x + f[0], G.avatar.y + f[1], 'space');
    if (t && t.type !== 'tori') { openTarget(t); return; }
    const under = personAt(G.avatar.x, G.avatar.y);
    if (under) { openTalk(under.key); return; }
    startBriefing('replay');
  }
  function openTarget(t) {
    if (t.type === 'staff') openTalk(t.key);
    else if (t.type === 'tori') startBriefing('replay');
    else if (t.type === 'desk') openDesk(t.owner);
    else if (t.type === 'approval') openApproval();
    else if (t.type === 'shelf') openShelf();
    else if (t.type === 'board') openBoard();
    else if (t.type === 'room') openRoom(t.room);
  }
  function tileFromEvent(e) {
    const rect = G.els.cv.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / G.scale, cy = (e.clientY - rect.top) / G.scale;
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return null;
    return { x: Math.floor(cx / T), y: Math.floor(cy / T), low: cy - Math.floor(cy / T) * T >= T - 4, px: cx, py: cy };
  }
  function frameHit(c) {
    if (c.px == null || !G.useSprites) return null;
    const order = (G.drawOrder || G.people).slice().reverse();
    for (const p of order) {
      if (p.px == null) continue;
      const b = LC.personBox(p);
      if (c.px >= b.x && c.px < b.x + b.w && c.py >= b.y && c.py < b.y + b.h) return p;
    }
    return null;
  }
  const PICTURE_HIT = { whiteboard: { type: 'board' } };
  function pictureHit(c) {
    if (c.px == null) return null;
    for (const o of L.objects) {
      const t = PICTURE_HIT[o.type]; if (!t) continue;
      const S = root.POSprites, sz = G.useSprites && o.sprite && S && S.has(o.sprite) ? S.size(o.sprite) : null;
      const b = sz ? Object.assign(R.spriteXY(o.sprite, o.x, o.y, o.w, o.h, o.dx, o.dy), { w: sz.w, h: sz.h }) : { x: o.x * T, y: o.y * T, w: o.w * T, h: o.h * T };
      if (c.px >= b.x && c.px < b.x + b.w && c.py >= b.y && c.py < b.y + b.h) return t;
    }
    return null;
  }
  function clickTarget(c) {
    const fp = frameHit(c);
    if (fp) return (G.tori && G.tori.x === c.x && G.tori.y === c.y) ? { type: 'tori' } : { type: 'staff', key: fp.key };
    const pic = pictureHit(c); if (pic) return pic;
    if (c.low) {
      if (G.tori.x === c.x && G.tori.y === c.y + 1) return { type: 'tori' };
      const p = personAt(c.x, c.y + 1); if (p) return { type: 'staff', key: p.key };
    }
    return targetAtTile(c.x, c.y, 'click');
  }
  function walkGoal(c) {
    if (walkable(c.x, c.y)) return bfs([G.avatar.x, G.avatar.y], [c.x, c.y]) ? [c.x, c.y] : null;
    let best = null, bestLen = Infinity;
    [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach((d) => {
      const n = [c.x + d[0], c.y + d[1]];
      if (!walkable(n[0], n[1])) return;
      const p = bfs([G.avatar.x, G.avatar.y], n);
      if (p && p.length < bestLen) { best = n; bestLen = p.length; }
    });
    return best;
  }
  function onMouseDown(e) {
    if (!G.entered) return;
    if (e.button !== 0) return;
    if (G.win) {
      if (!G.els.win.contains(e.target)) { closeWin(); e.preventDefault(); }
      return;
    }
    const wb = e.target && e.target.closest && e.target.closest('.dl-ways button');
    if (wb && G.bubble) { e.preventDefault(); if (wb.dataset.way === 'now') wayNow(); else wayAI(); return; }
    if (G.els.dlg && G.els.dlg.contains(e.target)) { e.preventDefault(); if (G.bubble) nextBubble(); G.els.stage.focus(); return; }
    const c = tileFromEvent(e);
    if (!c) return;
    if (G.held.length) return;
    e.preventDefault();
    const t = clickTarget(c);
    if (t) {
      if (G.bubble) { closeBubble(false); if (G.tori.mode === 'enter') toriToFollow(); }
      G.avatar.goal = null;
      openTarget(t);
    } else {
      const g = walkGoal(c);
      if (G.bubble) { closeBubble(false); if (G.tori.mode === 'enter') toriToFollow(); }
      if (g) {
        if (G.tori.mode === 'enter') toriGoHome();
        setGoal(g);
      }
    }
    G.els.stage.focus();
  }
  function setGoal(g) {
    const a = G.avatar;
    if (a.goal && a.goal[0] === g[0] && a.goal[1] === g[1]) return;
    if (!a.moving && a.x === g[0] && a.y === g[1]) { a.goal = null; return; }
    a.goal = g;
  }
  function onMouseMove(e) {
    if (!G.entered) return;
    let cur = '';
    if (!G.win && !(G.els.dlg && G.els.dlg.contains(e.target))) { const c = tileFromEvent(e); if (c && clickTarget(c)) cur = 'pointer'; }
    if (G.els.stage.style.cursor !== cur) G.els.stage.style.cursor = cur;
    let hk = null;
    if (!G.win) { const c = tileFromEvent(e); const t = c && clickTarget(c); if (t && t.type === 'staff') hk = t.key; else if (t && t.type === 'tori' && G.tori && c.x === G.tori.x && c.y === G.tori.y) hk = '토리'; }
    G.hoverKey = hk;
  }

  const xBtn = (cls) => '<button class="pw-x' + (cls ? ' ' + cls : '') + '" data-close aria-label="닫기"></button>';
  const lastChip = (cls) => G.readFail ? '<span class="pw-chip' + (cls ? ' ' + cls : '') + '">지난 기록</span>' : '';
  const bar = (title) => '<div class="pw-bar"><span class="pw-title">' + esc(title) + '</span>' + lastChip() + xBtn() + '</div>';
  const mid = (cls, html, attrs) => '<div class="pw-mid"><div class="pw-body ' + cls + '"' + (attrs || '') + '>' + html + '</div><i class="pw-more up" hidden></i><i class="pw-more dn" hidden></i></div>';
  const foot = (l, r) => '<div class="pw-foot"><span>' + esc(l) + '</span><span>' + esc(r || '') + '</span></div>';
  const num = (n) => typeof n === 'number' ? '<span class="pw-num">' + n + '</span>' : '<span class="pw-unk" title="모름">?</span>';
  const markIcon = (sym) => sym ? '<i class="mk' + (sym === '!' ? ' ex' : '') + '" role="img" aria-label="' + (sym === '!' ? '멈춤' : '일이 길어짐') + '" data-mark="' + sym + '"></i>' : '';

  function showWin(type, html, extra, keep) {
    const el = G.els.win;
    G.win = Object.assign({ type }, extra || {});
    el.className = 'w-' + type;
    el.innerHTML = NM(html);
    el.hidden = false;
    bindWin();
    placeWin();
    updateMore();
    if (!keep) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  }
  function closeWin() { G.win = null; G.els.win.hidden = true; G.els.win.innerHTML = ''; G.els.win.className = ''; G.els.stage.focus(); }
  function placeWin() {
    const el = G.els.win;
    if (!G.win || el.hidden) return;
    const u = G.scale, sw = W * u, sh = H * u;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.round((sw - w) / 2), top = Math.round((sh - h) / 2);
    if (G.win.type === 'badge') top = Math.max(top, 12 * u);
    top = Math.max(top, 2 * u);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    el.style.setProperty('--win-top', top + 'px');
  }
  function updateMore() {
    const el = G.els.win;
    el.querySelectorAll('.pw-mid').forEach((m) => {
      const b = m.querySelector('.pw-body'); if (!b) return;
      m.querySelector('.pw-more.dn').hidden = !(b.scrollTop + b.clientHeight < b.scrollHeight - 1);
      m.querySelector('.pw-more.up').hidden = !(b.scrollTop > 0);
    });
  }
  function scrollWin(dir) {
    const b = G.els.win.querySelector('.pw-body'); if (!b) return;
    b.scrollTop += dir * Math.max(10 * G.scale, b.clientHeight - 10 * G.scale);
    updateMore();
  }
  function bindWin() {
    const el = G.els.win;
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); closeWin(); }));
    el.querySelectorAll('.pw-body').forEach((b) => b.addEventListener('scroll', updateMore));
    el.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); flipBadge(+b.dataset.nav); }));
  }
  function staffByKey(key) { return G.st.staff.find((s) => s.key === key); }
  function spriteCanvas(key) {
    const s = staffByKey(key) || { key };
    const c = document.createElement('canvas'); c.width = 16; c.height = 20;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const sk = LN.SPRITE[s.key];
    if (sk && root.POSprites.has(sk)) ctx.drawImage(root.POSprites.frameCanvas(sk, 0), 0, 0);
    else { ctx.fillStyle = LN.POINT[s.key] || '#999'; ctx.fillRect(3, 5, 10, 13); }
    return c;
  }
  const md = (t) => t.slice(5, 10).replace('-', '/') + ' ' + t.slice(11);

  function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }
  function badgeSay(s) {
    const t = LN.linesOf(s);
    if (!t) return '';
    if (s.isTori) return pick(t.any, G.badgeSeed);
    const sig = s.sig && s.sig.use;
    if (s.mark === '?') return sig ? t.long || '' : '';
    if (s.mark === '!') return sig ? t.stopSig || '' : t.stop || '';
    const pool = (s.place === 'desk' || s.place === 'meeting') ? t.desk : t.break;
    if (!pool) return '';
    let line = pick(pool, G.badgeSeed);
    if (line.indexOf('{프로젝트}') >= 0) {
      const pj = s.lastStart ? s.lastStart.project : root.PO_PUBLIC === true && s.cells && s.cells[0] ? s.cells[0].project : '';
      if (pj) line = line.replace('{프로젝트}', pj);
      else line = pool.find((l) => l.indexOf('{프로젝트}') < 0) || '';
    }
    return line;
  }
  const HOP_PX = 2, HOP_MS = 80;
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function hop(key) { G.hop = (key && !reduceMotion()) ? { key, t0: performance.now() } : null; }
  function hopOffset(key, now) {
    const h = G.hop;
    if (!h || h.key !== key) return 0;
    const dt = now - h.t0;
    if (dt >= 2 * HOP_MS) { G.hop = null; return 0; }
    return dt < HOP_MS ? HOP_PX : 0;
  }
  function openBadge(key) {
    G.badgeSeed = Math.floor(Math.random() * 1000);
    renderBadge(key, false);
  }
  function renderBadge(key, keep) {
    const s = staffByKey(key);
    if (!s) return;
    const all = G.st.staff;
    const idx = all.indexOf(s);
    const say = badgeSay(s);
    const t = LN.linesOf(s) || {};
    const locTxt = s.isTori ? '당니님 곁' : ({ desk: '책상', break: '휴게실', meeting: '회의실' }[s.place] || '');
    const last = badgeLast(s);
    const sub = [s.role, s.animal, s.id].filter((x) => x).join(' · ');
    const pc = LN.POINT[s.key] || '#999';
    const html =
      '<div class="bd-strap" style="--pc:' + pc + '"></div>' +
      '<div class="pw-lift"><div class="pw" style="--pc:' + pc + '">' +
        '<div class="bd-band"></div>' + xBtn('bd-x') + lastChip('bd-chip') +
        mid('bd-body',
          (say ? '<div class="say-wrap"><div class="pbox">' + esc(say) + '</div><i class="say-tail"></i></div>' : '') +
          '<div class="bd-top"><button class="pw-btn prev" data-nav="-1" aria-label="이전"><i></i></button><div class="bd-face" id="face"></div>' +
          '<button class="pw-btn next" data-nav="1" aria-label="다음"><i></i></button></div>' +
          '<div class="bd-name">' + esc(s.name) + '</div>' +
          '<div class="bd-sub">' + esc(sub) + '</div>' +
          (t.intro ? '<p class="bd-intro">' + esc(t.intro) + '</p>' : '') +
          '<hr class="pw-hr">' +
          '<div class="bd-row"><span class="lab">위치</span><span class="val">' + esc(locTxt) + markIcon(s.mark) + '</span></div>' +
          '<div class="bd-row"><span class="lab">마지막</span><span class="val" title="' + esc(last) + '">' + esc(last) + '</span></div>' +
          badgeCount(s)) +
        foot('← → 넘기기 · Esc 닫기', (idx + 1) + ' / ' + all.length) +
      '</div><i class="bd-hook"></i></div>';
    showWin('badge', html, { key }, keep);
    G.els.win.querySelector('#face').appendChild(spriteCanvas(s.key));
    hop(s.key);
  }
  function badgeLast(s) {
    const v = s.sig;
    if (v && v.use) {
      if (v.mark === '!') { const g = G.st.signal && G.st.signal.byName[s.name]; return '멈춤 · ' + (g ? C.fmtMin(g.t).slice(11) : ''); }
      return '일하는 중 · ' + v.age + '분째';
    }
    return s.latest ? md(s.latest.time) + ' ' + s.latest.statusWord + ' · ' + s.latest.memo : '기록 없음';
  }
  function badgeCount(s) {
    const row = (lab, val, unit) => '<div class="bd-row"><span class="lab">' + lab + '</span><span class="val">' + val + ' <span class="pw-unit">' + unit + '</span></span></div>';
    if (G.st.hasRecords) return row('오늘', num(s.todayDone.length), '건');
    return row('맡은 칸', num(G.st.source === 'roadmap' ? (s.cells || []).length : null), '칸');
  }
  function flipBadge(d) {
    const all = G.st.staff;
    const i = all.findIndex((s) => s.key === G.win.key);
    const n = all[(i + d + all.length) % all.length];
    G.badgeSeed = Math.floor(Math.random() * 1000);
    renderBadge(n.key, true);
  }

  function cutFront(f) { return f.length > 40 ? '…' + f.slice(-40) : f; }
  function cellRows(list, withWho) {
    return list.map((c) => '<div class="dk-rec"><span class="tm"></span><span class="tx" title="' + esc(c.project + ' · ' + c.item) + '"><b>' + esc(c.project) + '</b> · ' + esc(c.short) + '</span>' +
      '<span></span><span class="tx fl">' + (withWho ? esc(c.owners.join('·')) : '') + '</span></div>').join('');
  }
  function deskSignal(s, noRoadmap) {
    const v = s.sig;
    if (!v || !v.use) return null;
    const g = G.st.signal && G.st.signal.byName[s.name];
    const hm = g ? C.fmtMin(g.t).slice(11) : '';
    if (v.mark === '!') return { empty: ['하던 일이 멈췄어요.', '지금은 휴게실에 있어요.'], top: '하던 일이 멈췄어요. 맡은 칸은 그대로예요.', foot: '멈춘 시각 ' + hm, footAdd: '멈춘 시각 ' + hm };
    if (v.mark === '?') return { empty: ['부름을 받아 ' + v.age + '분째 일하는 중이에요.', '조금 길어지고 있어요.'], top: v.age + '분째 일하는 중이에요. 조금 길어지고 있어요.', foot: '일하는 중 · ' + v.age + '분째', footAdd: '일하는 중 ' + v.age + '분째' };
    return { empty: ['부름을 받아 일하는 중이에요.', noRoadmap ? '' : '로드맵 맨 위 칸에는 이름이 없어요.'], top: '', foot: '일하는 중 · ' + v.age + '분째', footAdd: '일하는 중 ' + v.age + '분째' };
  }
  function openDeskCells(s, owner, noRoadmap) {
    const list = noRoadmap ? [] : (s.cells || []);
    const sg = deskSignal(s, noRoadmap);
    const empty = (main, small) => '<div class="dk-empty"><span>' + esc(main) + '</span>' + (small ? '<span class="sm">' + esc(small) + '</span>' : '') + '</div>';
    let inner;
    if (list.length) inner = (sg && sg.top ? '<div class="dk-rec dk-sig"><span class="tm"></span><span class="tx">' + esc(sg.top) + '</span></div>' : '') + cellRows(list);
    else if (sg) inner = empty(sg.empty[0], sg.empty[1]);
    else inner = empty(noRoadmap ? C.NO_ROADMAP.desk : '지금 맡은 칸이 없어요.');
    const base = noRoadmap ? '로드맵을 못 읽음' : '로드맵 맨 위 칸 기준';
    const footR = !sg ? base : list.length ? base + ' · ' + sg.footAdd : sg.foot;
    const body =
      '<div class="dk-note"><div class="dk-head"><span class="face"></span><span class="pw-big">' + (noRoadmap ? '?' : list.length) + '</span><span class="pw-unit">칸</span><span class="cap">맡은 칸</span></div>' +
      '<div class="dk-list">' + inner + '</div></div>';
    const html = '<div class="pw" style="--pc:' + (LN.POINT[s.key] || '#999') + '">' + bar(s.name + ' 책상 · 맡은 칸') + '<i class="dk-rings"></i>' +
      mid('dk-body', body) + foot('Esc 닫기', footR) + '</div>';
    showWin('desk', html, { key: owner }, G.deskKeep);
    G.els.win.querySelector('.dk-head .face').replaceWith(spriteCanvas(s.key));
    addDrawer(owner);
    const desk = L.objects.find((o) => o.type === 'desk' && o.owner === owner);
    const me = G.people.find((p) => p.key === owner);
    if (!G.deskKeep) hop(desk && me && me.x === desk.chair.x && me.y === desk.chair.y ? owner : null);
  }
  function addDrawer(owner) {
    const TU = root.POToolsUI, TT = root.POTools;
    if (!TU || !TT || !TT.deskTool(owner) || !G.win) return;
    G.win.drw = G.win.drw || { focus: 0, picking: false, sel: 0, topics: null };
    if (TT.desktop()) TT.init();
    drawDrawer();
  }
  function drawDrawer() {
    const w = G.win, el = G.els.win; if (!w || !w.drw) return;
    const pw = el.querySelector('.pw'); if (!pw) return;
    const old = pw.querySelector('.drw'); if (old) old.remove();
    if (root.POToolsUI.deskLines(w.key) < 2) w.drw.focus = 0;
    const tmp = document.createElement('div'); tmp.innerHTML = root.POToolsUI.deskLine(w.key, w.drw);
    const d = tmp.firstChild; if (!d) return;
    pw.insertBefore(d, pw.querySelector('.pw-foot'));
    d.querySelectorAll('[data-dl]').forEach((ln) => ln.addEventListener('click', (ev) => { ev.stopPropagation(); w.drw.focus = +ln.dataset.dl; deskEnterNow(); }));
    updateMore(); placeWin();
  }
  function deskKey(k, e) {
    const w = G.win, d = w.drw, TU = root.POToolsUI;
    if (k === 'Enter') { if (!e.repeat) deskEnterNow(); return true; }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      if (d.picking) { const n = deskPickList().length; if (n) { d.sel = (d.sel + (k === 'ArrowDown' ? 1 : -1) + n) % n; drawPicking(); } return true; }
      if (TU.deskLines(w.key) === 2) { d.focus = d.focus ? 0 : 1; drawDrawer(); return true; }
      return false;
    }
    if (k === 'Escape' && d.picking) { d.picking = false; reopenDesk(w.key); return true; }
    return false;
  }
  function deskEnterNow() {
    const w = G.win; if (!w || !w.drw) return;
    const d = w.drw, TU = root.POToolsUI, TT = root.POTools, key = TT.DESK_TOOL[w.key];
    if (d.picking) {
      const it = deskPickList()[d.sel]; if (!it) return;
      TT.memo.frame = { label: it.f.name.replace(/\.md$/, ''), sub: it.topic, rel: it.f.rel };
      d.picking = false; reopenDesk(w.key);
      TU.runTool(key, { rel: it.f.rel });
      return;
    }
    const r = TU.deskEnter(w.key, d);
    if (r === 'pick') { startPicking(); return; }
    if (r === 'cards') { const owner = w.key; closeWin(); G.app.selectTab('cards'); TU.openDrawer(key, owner); }
  }
  function reopenDesk(owner) { const keep = G.win && G.win.drw; G.deskKeep = true; try { openDesk(owner); } finally { G.deskKeep = false; } if (G.win && keep) { G.win.drw = Object.assign(keep, { picking: false }); drawDrawer(); } }
  function deskPickList() { const t = G.win.drw.topics || []; return t.filter((x) => x.manus.length).map((x) => ({ topic: x.topic, f: x.manus[0], blog: x.blogs[0] })); }
  async function startPicking() {
    const w = G.win, d = w.drw;
    d.picking = true; d.sel = 0; d.topics = null;
    drawPicking();
    const topics = await root.POTools.lectureTopics();
    if (G.win !== w || !d.picking) return;
    d.topics = topics; drawPicking();
  }
  function drawPicking() {
    const w = G.win, d = w.drw, el = G.els.win, s = staffByKey(w.key);
    const list = deskPickList();
    const none = (d.topics || []).filter((x) => !x.manus.length).map((x) => x.topic);
    const mmdd = (f) => f.date ? f.date.slice(4, 6) + '/' + f.date.slice(6) : '';
    const v2 = (f) => 'v' + String(f.ver).padStart(2, '0');
    const rows = d.topics == null ? '<div class="dk-empty"><span>읽는 중…</span></div>' : !list.length ? '<div class="dk-empty"><span>강의 원고가 없어요.</span></div>' :
      list.map((x, i) => '<div class="dk-rec pick' + (i === d.sel ? ' sel' : '') + '" data-pi="' + i + '"><span class="tm">' + esc(mmdd(x.f)) + '</span><span class="tx" title="' + esc(x.f.name) + '"><b>' + esc(x.topic) + '</b> · 원고 ' + v2(x.f) + (x.blog ? '<span class="r">블로그 ' + v2(x.blog) + ' 있음</span>' : '') + '</span></div>').join('') +
      (none.length ? '<div class="dk-rec dim"><span></span><span class="tx" title="' + esc(none.join('·')) + '">원고가 아직 없는 주제 ' + none.length + '개 (' + esc(none.join('·')) + ')</span></div>' : '');
    el.querySelector('.pw-title').textContent = s.name + ' 책상 · 원고 고르기';
    const note = el.querySelector('.dk-note');
    note.innerHTML = '<div class="dk-head"><span class="face"></span><span class="pw-big">' + (d.topics == null ? '?' : list.length) + '</span><span class="pw-unit">개</span><span class="cap">강의 원고 · 주제마다 최신 판</span></div><div class="dk-list">' + rows + '</div>';
    note.querySelector('.dk-head .face').replaceWith(spriteCanvas(s.key));
    const ft = el.querySelectorAll('.pw-foot span'); if (ft.length === 2) { ft[0].textContent = 'Esc 돌아가기'; ft[1].textContent = '10_프로젝트/01_진행/강의/*/원고'; }
    note.querySelectorAll('[data-pi]').forEach((r) => r.addEventListener('click', (ev) => { ev.stopPropagation(); d.sel = +r.dataset.pi; drawPicking(); }));
    drawDrawer();
    const sel = note.querySelector('.dk-rec.sel'); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }
  function openDesk(owner) {
    const s = staffByKey(owner);
    if (!s) return;
    if (G.st.source === 'roadmap' || !G.st.hasRecords) { openDeskCells(s, owner, G.st.source !== 'roadmap'); return; }
    const list = s.todayDone;
    const recs = list.map((r) => {
      const line = r.project + ' · ' + r.memo;
      const file = r.file && r.file !== '-' ? r.file : '';
      return '<div class="dk-rec"><span class="tm">' + esc(r.time.slice(11)) + '</span><span class="tx" title="' + esc(line) + '"><b>' + esc(r.project) + '</b> · ' + esc(r.memo) + '</span>' +
        '<span></span><span class="tx fl" title="' + esc(file) + '">' + esc(cutFront(file)) + '</span></div>';
    }).join('');
    const body =
      '<div class="dk-note"><div class="dk-head"><span class="face"></span><span class="pw-big">' + list.length + '</span><span class="pw-unit">건</span><span class="cap">오늘 끝낸 일</span></div>' +
      '<div class="dk-list">' + (list.length ? recs : '<div class="dk-empty"><span>오늘 완료 기록 없음</span></div>') + '</div></div>';
    const html = '<div class="pw" style="--pc:' + (LN.POINT[s.key] || '#999') + '">' + bar(s.name + ' 책상 · 오늘 한 일') + '<i class="dk-rings"></i>' +
      mid('dk-body', body) + foot('Esc 닫기', G.st.baseBD + ' 업무일') + '</div>';
    showWin('desk', html, { key: owner }, G.deskKeep);
    G.els.win.querySelector('.dk-head .face').replaceWith(spriteCanvas(s.key));
    addDrawer(owner);
    const desk = L.objects.find((o) => o.type === 'desk' && o.owner === owner);
    const me = G.people.find((p) => p.key === owner);
    hop(desk && me && me.x === desk.chair.x && me.y === desk.chair.y ? owner : null);
  }

  const corkNote = (proj, memo, title, extra) => '<div class="pi"><i class="pin"></i><div class="proj" title="' + esc(proj) + '">' + esc(proj) + '</div>' +
    (memo ? '<div class="memo" title="' + esc(title || memo) + '">' + esc(memo) + '</div>' : '') + (extra || '') + '</div>';
  const corkEmpty = (t) => '<div class="ap-notes"><div class="pi empty"><i class="pin"></i>' + esc(t) + '</div></div>';
  const turnLabel = () => (root.PO_PUBLIC === true ? NM('당니님 차례') : '기다리는 일');
  const turnEmpty = () => (root.PO_PUBLIC === true ? NM('당니님 차례인 일 없음') : '기다리는 일 없음');
  function staffCells() { return G.st.source === 'roadmap' && G.st.roadmap ? G.st.roadmap.cells.filter((c) => c.owners.length) : null; }
  function approvalCork(page) {
    const st = G.st;
    if (page === 1) {
      const cs = staffCells();
      if (!cs) return corkEmpty(C.NO_ROADMAP.cork);
      if (!cs.length) return corkEmpty('맡은 칸 없음');
      return '<div class="ap-notes">' + cs.map((c) => corkNote(c.project, c.short, c.item, '<div class="tm">' + esc(c.owners.join('·')) + '</div>')).join('') + '</div>';
    }
    if (st.source === 'roadmap') {
      const cs = st.ownerTurn;
      if (!cs.length) return corkEmpty(turnEmpty());
      return '<div class="ap-notes">' + cs.map((c) => corkNote(c.project, c.short, c.item)).join('') + '</div>';
    }
    if (!st.hasRecords) return corkEmpty(C.NO_ROADMAP.cork);
    const ws = st.waits;
    if (!ws.length) return corkEmpty(turnEmpty());
    return '<div class="ap-notes">' + ws.map((w) => corkNote(w.project, w.memo && w.memo !== '-' ? w.memo : '', '', '<div class="tm">' + esc(md(w.time)) + '</div>')).join('') + '</div>';
  }
  function openApproval(page) { renderApproval(page || 0, false); hop(toriKey()); }
  function toriKey() { const t = G.st && G.st.staff.find((s) => s.isTori); return t ? t.key : '토리'; }
  function renderApproval(page, keep) {
    const st = G.st, sc = staffCells();
    const n0 = st.source === 'roadmap' ? st.ownerTurn.length : st.hasRecords ? st.waits.length : '?';
    const n1 = sc ? sc.length : '?';
    const tab = (i, label, n) => '<button class="ap-tab" role="tab" data-tab="' + i + '" aria-selected="' + (page === i) + '">' + label + ' ' + num(n) + '</button>';
    const html = '<div class="pw"><div class="pw-topband"></div>' +
      '<div class="pw-bar ap-bar"><div class="ap-tabs" role="tablist">' + tab(0, esc(turnLabel()), n0) + tab(1, '직원 맡은 칸', n1) + '</div>' + lastChip() + xBtn() + '</div>' +
      mid('ap-cork', approvalCork(page), ' role="tabpanel"') +
      foot('← → 탭 · Esc 닫기', st.source === 'roadmap' ? '로드맵 맨 위 칸 기준' : st.hasRecords && page === 0 ? '직원 기록 기준 · 최신순' : '') + '</div>';
    showWin('approval', html, { page }, keep);
    G.els.win.querySelectorAll('.ap-tab').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); renderApproval(+b.dataset.tab, true); }));
  }

  const IDEAS_PATH = '10_프로젝트/아이디어보관함.md';
  const PN_COLS = 4, PN_MAX = 8;
  const PN_STATE = { '대기': ['postit_wait', '#F2C641'], '검토 중': ['postit_review', '#F5A3C0'], '보류': ['postit_hold', '#B6BEC9'] };
  const pnState = (st) => PN_STATE[st] || PN_STATE['대기'];
  const pnHash = (s) => Array.from(s).reduce((a, c) => (a * 31 + c.codePointAt(0)) >>> 0, 7);
  function pnCanvas(name, fi) {
    const a = root.PO_ASSETS && root.PO_ASSETS[name];
    const c = document.createElement('canvas');
    if (!a) { c.width = 56; c.height = 50; return c; }
    const fr = a.frames[Math.min(fi, a.frames.length - 1)];
    c.width = fr[0].length; c.height = fr.length;
    const g = c.getContext('2d');
    fr.forEach((row, y) => Array.from(row).forEach((ch, x) => { const col = a.palette[ch]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
    return c;
  }
  const pnBox = (name) => ((root.PO_ASSETS && root.PO_ASSETS[name] && root.PO_ASSETS[name].text_box) || [5, 5, 46, 32]);
  async function readIdeas() {
    const P = root.POProjects, FSx = root.POFS;
    try { const r = await FSx.readText(G.app.handle, IDEAS_PATH); return { ok: true, list: P.parseIdeas(r.text).filter((i) => i.idea || i.date) }; }
    catch (e) {
      if (e && e.name === 'NotFoundError') return { ok: true, list: [] };
      return { ok: false, list: [] };
    }
  }
  function sortIdeas(list) {
    return list.map((x, i) => [x, i]).sort((a, b) => (b[0].date > a[0].date) - (b[0].date < a[0].date) || a[1] - b[1]).map((x) => x[0]);
  }
  async function openBoard() {
    hop(toriKey());
    const r = await readIdeas();
    G.board = { ok: r.ok, list: sortIdeas(r.list), sel: 0, open: -1 };
    renderBoard(false);
  }
  function boardWritable() { return !!(root.PODesktop && typeof root.PODesktop.write === 'function'); }
  function renderBoard(keep) {
    const B = G.board, list = B.list, n = list.length;
    const show = n > PN_MAX ? list.slice(0, PN_MAX - 1) : list;
    let say = '', body, right;
    if (!B.ok) {
      body = '<div class="ib-empty"><span class="ib-msg">아이디어보관함을 못 읽어서 칠판이 비었어요.<small>10_프로젝트/아이디어보관함.md 를 한번 봐 주세요.</small></span></div>';
      right = '아이디어보관함을 못 읽음';
    } else if (!n) {
      body = '<div class="ib-empty"><span class="pn more" data-slot="empty"><span class="tb"><span class="ti">아이디어 없음</span></span></span><span class="ib-msg">아직 붙은 아이디어가 없어요.<small>' +
        (boardWritable() ? '떠오르면 [+ 아이디어]로 하나 붙여 두세요.' : '붙이기는 데스크톱 앱에서 돼요.') + '</small></span></div>';
      right = '아이디어보관함 · 0개';
    } else {
      say = n > PN_MAX ? '아이디어 ' + n + '개 중 최신 ' + show.length + "개를 붙여 뒀어요. 나머지는 '더 보기'에." : '던져 두신 아이디어 ' + n + '개를 붙여 뒀어요. 누르면 메모까지 보여요.';
      const cnt = (st) => list.filter((x) => x.status === st).length;
      body = '<div class="ib-legend">' + Object.keys(PN_STATE).map((st) => '<span style="--c:' + PN_STATE[st][1] + '"><i></i>' + st + ' ' + cnt(st) + '</span>').join('') + '<em>최신순</em></div>' +
        '<div class="ib-grid" role="grid">' + show.map((x, i) => {
          const nm = pnState(x.status)[0], h = pnHash(x.date + x.idea), tb = pnBox(nm);
          return '<button class="pn' + (i === B.sel ? ' focus' : '') + '" data-pn="' + i + '" data-fi="' + (h % 3) + '" data-nm="' + nm + '" title="' + esc(x.idea) + '" style="--j:' + ((h >> 3) % 2) + ';--tx:' + tb[0] + ';--ty:' + tb[1] + ';--tw:' + tb[2] + ';--th:' + tb[3] + '">' +
            '<span class="tb"><span class="ti">' + esc(C.postitTitle(x.idea)) + '</span>' + (x.kind ? '<span class="kd">' + esc(x.kind) + '</span>' : '') + '</span></button>';
        }).join('') +
        (n > PN_MAX ? (() => { const tb = pnBox('postit_more'); return '<button class="pn more' + (B.sel === PN_MAX - 1 ? ' focus' : '') + '" data-pn="more" data-nm="postit_more" data-fi="0" style="--tx:' + tb[0] + ';--ty:' + tb[1] + ';--tw:' + tb[2] + ';--th:' + tb[3] + '"><span class="tb"><span class="ti">+' + (n - show.length) + '개 더</span><span class="sub">아이디어 보드에서 모두 보기</span></span></button>'; })() : '') +
        '</div>';
      right = '아이디어보관함 · 최신순';
    }
    const html = '<div class="pw">' + bar('회의실 칠판 · 아이디어') + '<div class="ib-body">' + (say ? '<p class="ib-say">' + esc(say) + '</p>' : '') + '<div class="ib-board">' + body + '</div></div>' +
      foot(n ? '↑↓←→ 고르기 · Enter 펼치기 · Esc 닫기' : 'Esc 닫기', right) + '</div>';
    showWin('board', html, {}, keep);
    G.els.win.querySelectorAll('.pn[data-nm]').forEach((b) => b.prepend(pnCanvas(b.dataset.nm, +b.dataset.fi)));
    const e0 = G.els.win.querySelector('[data-slot="empty"]'); if (e0) { const tb = pnBox('postit_more'); e0.style.cssText = '--tx:' + tb[0] + ';--ty:' + tb[1] + ';--tw:' + tb[2] + ';--th:' + tb[3]; e0.prepend(pnCanvas('postit_more', 0)); }
    G.els.win.querySelectorAll('.pn[data-pn]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); const k = b.dataset.pn; if (k === 'more') goIdeas(null); else openPostit(+k); }));
    placeWin();
  }
  function openPostit(i) {
    const B = G.board, x = B.list[i]; if (!x) return;
    B.open = i; B.sel = Math.min(i, PN_MAX - 1);
    const c = pnState(x.status)[1];
    const row = (k, v) => '<dt>' + k + '</dt><dd>' + esc(v || '-') + '</dd>';
    const html = '<div class="pw">' + bar('회의실 칠판 · 아이디어') + '<div class="ib-body"><div class="ib-board"><div class="ib-open" style="--c:' + c + '"><h4>' + esc(x.idea) + '</h4><dl>' +
      row('날짜', x.date) + row('종류', x.kind) + row('상태', x.status) + row('메모', x.memo) + '</dl>' +
      '<div class="ib-btns"><button class="ib-btn" data-act="back">칠판으로</button><button class="ib-btn go" data-act="edit">아이디어 보드에서 고치기</button></div></div></div></div>' +
      foot('← → 넘기기 · Esc 칠판으로', (i + 1) + ' / ' + B.list.length) + '</div>';
    showWin('board', html, { open: i }, true);
    G.els.win.querySelector('[data-act="back"]').addEventListener('click', (ev) => { ev.stopPropagation(); B.open = -1; renderBoard(true); });
    G.els.win.querySelector('[data-act="edit"]').addEventListener('click', (ev) => { ev.stopPropagation(); goIdeas(x); });
  }
  function goIdeas(idea) {
    closeWin();
    if (root.POProjects) root.POProjects.pending = idea ? { date: idea.date, idea: idea.idea } : { board: true };
    G.app.selectTab('ideas');
  }
  function boardKey(k) {
    const B = G.board; if (!B) return false;
    if (B.open >= 0) {
      if (k === 'Escape') { B.open = -1; renderBoard(true); return true; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') { const j = B.open + (k === 'ArrowLeft' ? -1 : 1); if (j >= 0 && j < B.list.length) openPostit(j); return true; }
      if (k === 'Enter' || k === ' ') { goIdeas(B.list[B.open]); return true; }
      return k === 'ArrowUp' || k === 'ArrowDown';
    }
    const slots = G.els.win.querySelectorAll('.pn[data-pn]').length;
    if (!slots) return false;
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -PN_COLS, ArrowDown: PN_COLS }[k];
    if (mv != null) {
      const j = B.sel + mv;
      if (j >= 0 && j < slots && !(k === 'ArrowLeft' && B.sel % PN_COLS === 0) && !(k === 'ArrowRight' && B.sel % PN_COLS === PN_COLS - 1)) { B.sel = j; G.els.win.querySelectorAll('.pn[data-pn]').forEach((b, bi) => b.classList.toggle('focus', bi === j)); }
      return true;
    }
    if (k === 'Enter' || k === ' ') { const b = G.els.win.querySelectorAll('.pn[data-pn]')[B.sel]; if (b) b.click(); return true; }
    return false;
  }

  const SHELF_EMPTY = '책꽂이가 비어 있어요.', SHELF_EMPTY_SUB = '40_자산/자료/프롬프트/ 에 md 파일을 넣으면 여기 꽂혀요.';
  function shelfNote(main, sub) {
    return '<div class="sh-board"><div class="sh-books"></div><div class="sh-shelf"></div><div class="sh-card"><i class="pin"></i>' + esc(main) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>';
  }
  function shelfWin(body, right, keep) {
    showWin('shelf', '<div class="pw">' + bar('자료보관함 · 책꽂이') + mid('sh-body', body) + foot(right ? '← → 고르기 · Enter 펼치기 · Esc 닫기' : 'Esc 닫기', right || '') + '</div>', { sel: -1 }, keep);
  }
  function openShelf() {
    hop(null);
    const SHf = root.POShelf;
    if (!SHf || !SHf.miniLoad) { shelfWin(shelfNote('책꽂이를 열 수 없어요.')); return; }
    const seq = G.shelfSeq = (G.shelfSeq || 0) + 1;
    const loaded = SHf.S && SHf.S.loaded && !SHf.S.pixelDirty && (!G.app || !G.app.handle || SHf.S.handle === G.app.handle);
    const fill = (r, keep) => {
      if (r.empty) { shelfWin(shelfNote(SHELF_EMPTY, SHELF_EMPTY_SUB), '', keep); return; }
      shelfWin('<div class="sh-mini"></div>', r.books + '권', keep);
      if (!SHf.miniCase(G.els.win.querySelector('.sh-mini'), (id) => goShelf(id))) return;
      const last = shelfSpines().findIndex((x) => x.tabIndex === 0);
      shelfPick(last >= 0 ? last : 0);
      placeWin(); updateMore();
    };
    if (loaded) { fill({ books: SHf.S.books.length, empty: SHf.isEmptyShelf() }, false); return; }
    shelfWin('<p class="sh-wait">책꽂이를 읽는 중…</p>');
    SHf.miniLoad(G.app && G.app.handle).then((r) => {
      if (seq !== G.shelfSeq || !G.win || G.win.type !== 'shelf') return;
      fill(r, true);
    }, (e) => {
      if (seq !== G.shelfSeq || !G.win || G.win.type !== 'shelf') return;
      shelfWin(shelfNote('자료를 읽지 못했어요.', String(e && e.message || e)), '', true);
    });
  }
  const shelfSpines = () => [...G.els.win.querySelectorAll('.sh-mini .sf-bk')];
  function shelfPick(i) {
    const bs = shelfSpines(); if (!bs.length || !G.win) return;
    G.win.sel = Math.max(0, Math.min(bs.length - 1, i));
    bs.forEach((x, j) => x.classList.toggle('on', j === G.win.sel));
    const b = bs[G.win.sel], body = G.els.win.querySelector('.pw-body');
    if (body) { const br = body.getBoundingClientRect(), r = b.getBoundingClientRect(); if (r.bottom > br.bottom) body.scrollTop += r.bottom - br.bottom + 4; else if (r.top < br.top) body.scrollTop -= br.top - r.top + 4; updateMore(); }
  }
  function shelfKey(k, e) {
    const bs = shelfSpines(); if (!bs.length) return false;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { shelfPick(G.win.sel + (k === 'ArrowRight' ? 1 : -1)); return true; }
    if (k === 'Home' || k === 'End') { shelfPick(k === 'Home' ? 0 : bs.length - 1); return true; }
    if (k === 'Enter' || k === ' ') { if (!e.repeat && G.win.sel >= 0) goShelf(bs[G.win.sel].dataset.id); return true; }
    return false;
  }
  function goShelf(id) {
    closeWin();
    G.app.selectTab('shelf');
    if (id && root.POShelf) return root.POShelf.openBook(id);
  }

  function pills(list) {
    return '<div class="rm-pills">' + list.map((s) => '<span class="rm-pill"><span class="tag" style="--pc:' + (LN.POINT[s.key] || '#999') + '">' + esc(s.name) + '</span>' + markIcon(s.mark) + '</span>').join('') + '</div>';
  }
  function openRoom(id) {
    const st = G.st;
    const room = L.rooms.find((r) => r.id === id);
    const R2 = LN.ROOMS[id] || {};
    let now = '';
    const here = (list, emptyText) => list.length
      ? '<div class="rm-now"><span class="lab">지금 여기</span>' + num(list.length) + '<span class="lab">명</span></div>' + pills(list)
      : '<p class="rm-text pw-empty" style="text-align:left">' + esc(emptyText) + '</p>';
    if (id === 'lobby') {
      if (st.source === 'roadmap') {
        const cs = st.ownerTurn;
        now = cs.length
          ? '<div class="rm-now"><span class="lab">당니님 결정 기다리는 칸</span>' + num(cs.length) + '<span class="lab">개</span></div>' +
            '<ul class="rm-cells">' + cs.map((c) => '<li title="' + esc(c.item) + '"><b>' + esc(c.project) + '</b> · ' + esc(c.short) + '</li>').join('') + '</ul>'
          : '<p class="rm-text pw-empty" style="text-align:left">당니님 결정 기다리는 칸은 없어요.</p>';
      } else now = st.hasRecords ? '<p class="rm-text">기다리는 일 ' + num(st.waits.length) + '</p>' : '<p class="rm-text pw-empty" style="text-align:left">' + esc(C.NO_ROADMAP.lobby) + '</p>';
    } else if (id === 'work') now = here(st.staff.filter((s) => !s.isTori && s.place === 'desk'), '지금은 모두 자리를 비웠어요.');
    else if (id === 'break') now = here(st.staff.filter((s) => !s.isTori && s.place === 'break'), '휴게실이 비었어요. 다들 일하는 중이에요.');
    else if (id === 'meeting') { if (C.TF_ENABLED) now = here(st.staff.filter((s) => !s.isTori && s.place === 'meeting'), '지금은 회의가 없어요.'); }
    else if (id === 'archive') { const SB = root.POShelf && root.POShelf.S; if (SB && SB.loaded) now = '<div class="rm-now"><span class="lab">꽂힌 책</span>' + num(SB.books.length) + '<span class="lab">권</span></div>'; }
    const text = id === 'meeting' && C.TF_ENABLED ? R2.textTF : R2.text;
    const html = '<div class="pw" style="--room:' + (room ? room.color : 'var(--v)') + '">' +
      '<div class="rm-plate">' + lastChip() + '<i class="screw"></i><span class="rm-name">' + esc(room ? room.name : id) + '</span><i class="screw"></i>' + xBtn() + '</div>' +
      mid('rm-body', '<p class="rm-text">' + esc(text || '') + '</p>' + (now ? '<hr class="pw-hr">' + now : '')) + foot('Esc 닫기') + '</div>';
    showWin('room', html, { key: id });
    hop(null);
  }

  function setupDom() {
    const stage = document.getElementById('stage');
    G.els = { stage, cv: document.getElementById('cv'), overlay: document.getElementById('overlay'), dlg: document.getElementById('dlg'), win: document.getElementById('win'), notice: document.getElementById('notice') };
    if (!document.getElementById('cvTop')) {
      const top = document.createElement('canvas'); top.id = 'cvTop'; top.width = W; top.height = H;
      top.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;image-rendering:pixelated;';
      G.els.overlay.after(top);
    }
    G.els.top = document.getElementById('cvTop');
    if (!document.getElementById('focusTag')) {
      const ft = document.createElement('div'); ft.id = 'focusTag'; ft.className = 'tag head'; ft.hidden = true; G.els.top.after(ft);
      const nb = document.createElement('button'); nb.id = 'nameBtn'; nb.type = 'button'; nb.textContent = '이름'; nb.title = '이름 모두 켜기/끄기 (N)';
      nb.addEventListener('click', (e) => { e.stopPropagation(); toggleNames(); G.els.stage.focus(); }); ft.after(nb);
    }
    G.els.focusTag = document.getElementById('focusTag'); G.els.nameBtn = document.getElementById('nameBtn');
    try { G.showNames = localStorage.getItem('po.showNames') === '1'; } catch (e) { G.showNames = false; }
    applyNames();
    if (!G.bound) {
      G.bound = true;
      document.addEventListener('keydown', onKeyDown);
      if (root.POTools) root.POTools.subscribe(() => { if (G.win && G.win.type === 'desk' && G.win.drw) drawDrawer(); });
      document.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', stopWalking);
      document.addEventListener('visibilitychange', () => { if (document.hidden) stopWalking(); });
      stage.addEventListener('mousedown', onMouseDown);
      stage.addEventListener('mousemove', onMouseMove);
      stage.addEventListener('mouseleave', () => { G.hoverKey = null; });
      window.addEventListener('resize', resize);
    }
    resize();
  }
  function stopWalking() { G.held = []; if (G.avatar) G.avatar.goal = null; }
  function resize() {
    const main = document.getElementById('main');
    const fit = Math.min(main.clientWidth / W, main.clientHeight / H);
    const s = Math.max(1, fit >= 2 && fit - Math.floor(fit) < 0.15 ? Math.floor(fit) : Math.floor(fit * 20) / 20);
    G.scale = s;
    [G.els.cv, G.els.top].forEach((c) => { if (c) { c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; } });
    G.els.stage.style.width = W * s + 'px'; G.els.stage.style.height = H * s + 'px';
    G.els.stage.style.setProperty('--stage-h', H * s + 'px');
    root.POUi.applyVars(G.els.stage, s);
    rebuildTags();
    placeWin(); updateMore();
  }
  function rebuildTags() {
    const ov = G.els.overlay; if (!ov) return;
    ov.innerHTML = ''; G.tagEls = {};
    const add = (key, name, color) => {
      const el = document.createElement('div'); el.className = 'tag'; el.textContent = name; el.style.setProperty('--pc', color);
      ov.appendChild(el); G.tagEls[key] = el;
    };
    G.people.forEach((p) => add(p.key, p.name, LN.POINT[p.key] || '#999'));
    if (G.st) { const tori = G.st.staff.find((s) => s.isTori); if (tori) add('토리', tori.name, LN.POINT['토리']); }
    if (G.showRoomNames) L.rooms.forEach((r) => {
      const el = document.createElement('div'); el.className = 'room-name'; el.textContent = r.name;
      el.style.left = (r.x1 * T * G.scale + 3) + 'px'; el.style.top = ((r.y2 + 1) * T * G.scale - 13) + 'px'; ov.appendChild(el);
    });
  }
  function toggleNames() {
    G.showNames = !G.showNames;
    try { localStorage.setItem('po.showNames', G.showNames ? '1' : '0'); } catch (e) {  }
    applyNames();
  }
  function applyNames() {
    if (G.els.overlay) G.els.overlay.classList.toggle('names-off', !G.showNames);
    if (G.els.nameBtn) G.els.nameBtn.setAttribute('aria-pressed', String(!!G.showNames));
  }
  function focusKey() {
    if (G.hoverKey) return G.hoverKey;
    const a = G.avatar; if (!a || a.moving || G.held.length) return null;
    const f = FACE[a.face]; const x = a.x + f[0], y = a.y + f[1];
    if (G.tori && G.tori.x === x && G.tori.y === y) return '토리';
    const p = personAt(x, y); return p ? p.key : null;
  }
  function placeFocusTag() {
    const el = G.els.focusTag; if (!el) return;
    const k = G.showNames ? null : focusKey();
    if (!k) { if (!el.hidden) el.hidden = true; return; }
    let name, fx, fy, top;
    if (k === '토리') { const t = G.st && G.st.staff.find((s) => s.isTori); name = t ? t.name : '토리'; fx = G.tori.fx; fy = G.tori.fy; top = fy * T - 6; }
    else {
      const p = G.people.find((q) => q.key === k); if (!p) { el.hidden = true; return; }
      name = p.name; fx = p.x; fy = p.y;
      if (p.pose && G.useSprites) { const b = LC.personBox(p); fx = (b.x + b.w / 2) / T - 0.5; top = b.y + b.top - 4; }
      else top = fy * T + R.headTop(p, G.useSprites) - 4;
    }
    if (el.textContent !== name) el.textContent = name;
    el.style.setProperty('--pc', LN.POINT[k] || '#999');
    el.style.left = Math.round((fx * T + T / 2) * G.scale) + 'px';
    el.style.top = Math.round(top * G.scale) + 'px';
    el.hidden = false;
  }
  function placeTag(key, fx, fy) {
    const el = G.tagEls[key]; if (!el) return;
    const l = Math.round((fx * T + T / 2) * G.scale), t = Math.round((fy + 1) * T * G.scale + 1);
    if (el._l !== l || el._t !== t) { el.style.left = l + 'px'; el.style.top = t + 'px'; el._l = l; el._t = t; }
  }
  const SPEAKERS = {
    get tori() { if (root.PO_PUBLIC !== true) return { name: '토리', sprite: 'tori_idle', color: '토리' }; const g = G.st && G.st.staff.find((s) => s.isTori); return { name: g ? g.name : C.PUBLIC_STAFF[0].job, sprite: 'tori_idle', color: '토리' }; },
    get dangnee() { return { name: '당니', sprite: LN.ownerSprite ? LN.ownerSprite() : 'avatar_idle', color: null }; },
  };
  function portraitEl(spk, frame) {
    const src = root.PO_LINES.portraitSrc(spk.sprite);
    if (src) { const img = new Image(); img.src = src; img.alt = ''; img.className = 'dl-img'; return img; }
    return portraitCanvas(spk, frame);
  }
  function portraitCanvas(spk, frame) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const sk = spk.sprite, pk = sk && sk.replace(/_idle$/, '_portrait'), S = root.POSprites;
    if (pk && S.has(pk)) ctx.drawImage(S.frameCanvas(pk, Math.min(frame || 0, S.frameCount(pk) - 1)), 0, 0);
    else if (sk && S.has(sk)) ctx.drawImage(S.frameCanvas(sk, 0), 0, 0, 16, 16, 0, 0, 48, 48);
    else { ctx.fillStyle = (spk.color && LN.POINT[spk.color]) || R.COL.c; ctx.fillRect(9, 9, 30, 39); }
    return c;
  }
  function drawDialog() {
    if (!G.bubble) return;
    const el = G.els.dlg, B = G.bubble;
    const spk = B.onDn ? SPEAKERS.dangnee : (B.speaker || SPEAKERS.tori);
    const frame = !B.onDn && B.i === 0 ? 1 : 0;
    const last = !B.onDn && B.i === B.list.length - 1;
    const face = el.querySelector('.dl-face'), fk = spk.name + '#' + frame;
    if (face.dataset.who !== fk) { face.innerHTML = ''; face.appendChild(portraitEl(spk, frame)); face.dataset.who = fk; }
    el.querySelector('.dl-name').textContent = NM(spk.name);
    el.querySelector('.dl-sr').textContent = B.text;
    drawText();
    let wy = el.querySelector('.dl-ways');
    if (onWays()) {
      const W = B.ways.w, key = B.ways.s.key + '#' + B.i;
      if (!wy) { wy = document.createElement('div'); wy.className = 'dl-ways'; el.querySelector('.dl-text').appendChild(wy); }
      if (wy.dataset.k !== key) { wy.dataset.k = key; wy.innerHTML = '<button type="button" data-way="now">바로 하기 · ' + esc(W.label) + '</button><button type="button" data-way="ai">AI에게 맡기기</button>'; }
    } else if (wy) wy.remove();
    if (onWays()) { el.querySelector('.dl-more').innerHTML = 'Enter 바로 · A AI · Space 닫기'; if (el.hidden) { el.hidden = false; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } return; }
    el.querySelector('.dl-more').innerHTML = B.onDn ? '<i class="go" aria-label="다음"></i>' : (B.i + 1) + ' / ' + B.list.length + (last ? (B.petAt === B.i ? ' · Enter 펫 띄우기 · Space 닫기' : ' · Space 닫기') : ' <i class="go" aria-label="다음"></i>');
    if (el.hidden) { el.hidden = false; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  }
  function openTalk(key) {
    const s = staffByKey(key); if (!s) return;
    G.badgeSeed = Math.floor(Math.random() * 1000);
    const t = LN.linesOf(s) || {};
    const cut = (x, n) => (x.length > n ? x.slice(0, n) + '…' : x);
    const ieyo = (w) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c % 28 ? '이에요' : '예요'); };
    const list = [badgeSay(s) || t.intro || (ieyo(s.name) + '.')];
    if (G.st.hasRecords) {
      if (s.latest) list.push('마지막 기록은 ' + md(s.latest.time) + ' ' + ieyo(s.latest.statusWord) + '. ' + cut(s.latest.memo, 70));
      else list.push('아직 남긴 기록이 없어요.');
      const n = (s.todayDone || []).length;
      list.push(s.mark === '?' ? '시작하고 기록이 한참 없어요. 확인이 필요해요.' : s.mark === '!' ? '오늘 일이 멈춰 있어요. 사정은 기록 메모에 있어요.' : n ? '오늘 ' + n + '건 끝냈어요.' : '오늘 끝낸 일은 아직 없어요.');
    }
    const SW = root.POStaffWays, W = SW && SW.waysOf(s);
    let ways = null;
    if (W) { list.push(W.guide ? '저한테는 그냥 말을 거시면 돼요. 앱에서 바로 하셔도 되고요.' : '일을 맡기는 길은 두 가지예요. 앱에서 바로 하거나, AI(Claude Code)에게 맡기거나요.'); ways = { s, w: W, at: list.length - 1 }; }
    G.bubble = { list, i: 0, save: null, kind: 'talk', dn: null, onDn: false, speaker: { name: s.name, sprite: LN.SPRITE[s.key], color: s.key }, who: s.key, ways };
    hop(s.key);
    setPage();
  }
  const onWays = () => { const B = G.bubble; return !!(B && B.ways && !B.onDn && B.i === B.ways.at); };
  function wayNow() { const B = G.bubble; if (!B || !B.ways) return; const s = B.ways.s; closeBubble(false); root.POStaffWays.doNow(s); }
  async function wayAI() {
    const B = G.bubble; if (!B || !B.ways) return;
    const SW = root.POStaffWays, r = await SW.askAI(B.ways.s);
    if (G.bubble !== B) return;
    B.list = B.list.slice(0, B.ways.at + 1).concat([r.ok ? '복사했어요: "' + r.text + '" ' + SW.PASTE : '복사하지 못했어요. Claude Code에서 이렇게 말해 보세요: "' + r.text + '"']);
    B.i = B.ways.at + 1; B.copied = r.text;
    setPage();
  }
  function drawText() {
    const B = G.bubble; if (!B) return;
    G.els.dlg.querySelector('.dl-vis').textContent = B.chars.slice(0, B.shown).join('');
  }
  function showNotice() {
    const n = G.els.notice;
    if (G.readFail) { n.textContent = '기록을 못 읽었어요'; n.hidden = false; } else n.hidden = true;
  }

  function stepAvatar(now) {
    const a = G.avatar;
    if (a.moving) {
      const k = Math.min(1, (now - a.moving.t0) / STEP_MS);
      a.fx = a.moving.from[0] + (a.x - a.moving.from[0]) * k;
      a.fy = a.moving.from[1] + (a.y - a.moving.from[1]) * k;
      if (k >= 1) { a.moving = null; a.fx = a.x; a.fy = a.y; a.stepEnd = now; }
      else return;
    }
    if (a.goal && a.x === a.goal[0] && a.y === a.goal[1]) a.goal = null;
    if (G.app.tab !== 'office') a.goal = null;
    if (G.win || G.bubble) return;
    const key = G.tapDir || G.held[G.held.length - 1];
    G.tapDir = null;
    let d;
    if (key) { a.goal = null; d = DIRS[key]; }
    else if (a.goal) {
      const p = bfs([a.x, a.y], a.goal);
      if (!p || !p.length) { a.goal = null; return; }
      const n = p[0];
      d = [n[0] - a.x, n[1] - a.y, n[0] > a.x ? 'right' : n[0] < a.x ? 'left' : n[1] > a.y ? 'down' : 'up'];
    } else return;
    a.face = d[2];
    const nx = a.x + d[0], ny = a.y + d[1];
    if (!walkable(nx, ny)) return;
    const from = [a.x, a.y];
    if (!a.walkT0 || now - (a.stepEnd || 0) > 60) a.walkT0 = now;
    a.x = nx; a.y = ny; a.moving = { from, t0: now };
    afterAvatarStep(from);
  }
  function afterAvatarStep(from) {
    G.trail.push(from); if (G.trail.length > 64) G.trail.shift();
    if (G.tori.mode === 'follow') G.tori.target = from;
  }
  function avatarSettled(now) {
    const a = G.avatar;
    return !a.moving && !a.goal && !G.held.length && !G.tapDir && now - (a.stepEnd || 0) > STEP_MS;
  }
  function toriRestTile() {
    for (let i = G.trail.length - 1; i >= 0; i--) {
      const c = G.trail[i];
      if (c[0] === G.avatar.x && c[1] === G.avatar.y) continue;
      if (!personAt(c[0], c[1])) return c;
    }
    return null;
  }
  function stepTori(now) {
    const t = G.tori;
    if (t.moving) {
      const k = Math.min(1, (now - t.moving.t0) / TORI_STEP_MS);
      t.fx = t.moving.from[0] + (t.x - t.moving.from[0]) * k;
      t.fy = t.moving.from[1] + (t.y - t.moving.from[1]) * k;
      if (k >= 1) { t.moving = null; t.fx = t.x; t.fy = t.y; t.stepEnd = now; } else return;
    }
    if (G.bubble) {
      const dx = G.avatar.x - t.x, dy = G.avatar.y - t.y;
      if (dx || dy) t.face = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    if (t.mode === 'desk') { if (!G.bubble) t.face = 'down'; return; }
    if (t.mode === 'home' && t.x === L.toriHome[0] && t.y === L.toriHome[1] && !t.path.length) { t.mode = 'desk'; t.face = 'down'; return; }
    if (t.mode === 'enter') {
      if (!t.path.length) {
        if (G.win) return;
        toriToFollow(); t.target = null; startBriefing(G.firstVisit ? 'first' : null); return;
      }
    } else {
      if (avatarSettled(now)) {
        const tg = t.target || [t.x, t.y];
        if (personAt(tg[0], tg[1])) { const alt = toriRestTile(); if (alt) t.target = alt; }
      }
      t.path = (t.target && !(t.x === t.target[0] && t.y === t.target[1])) ? (bfs([t.x, t.y], t.target) || []) : [];
    }
    const n = t.path.shift();
    if (!n) return;
    if (n[0] === G.avatar.x && n[1] === G.avatar.y && t.mode === 'follow') return;
    const from = [t.x, t.y];
    t.face = n[0] > t.x ? 'right' : n[0] < t.x ? 'left' : n[1] > t.y ? 'down' : 'up';
    if (!t.walkT0 || now - (t.stepEnd || 0) > 60) t.walkT0 = now;
    t.x = n[0]; t.y = n[1]; t.moving = { from, t0: now };
  }

  function loop(now) {
    if (G.entered) {
      stepAvatar(now);
      stepTori(now);
      stepOri(now);
      stepDialog(now);
      draw(now);
    }
    requestAnimationFrame(loop);
  }
  function draw(now) {
    const ctx = G.els.cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    R.drawMap(ctx, L);
    R.drawDecor(ctx, L, 'floor', G.useSprites);
    if (G.avatar.goal) R.drawGoal(ctx, G.avatar.goal[0], G.avatar.goal[1]);
    R.drawDecor(ctx, L, 'wall', G.useSprites);
    const people = G.people.slice().sort((a, b) => a.y - b.y || personX(a) - personX(b));
    const items = L.objects.filter((o) => !o.floor && !o.wall).map((o) => ({ y: o.y + o.h - 1, k: 0, o })).concat(people.map((p) => ({ y: p.y, k: 1, p })));
    items.sort((a, b) => a.y - b.y || a.k - b.k);
    items.forEach((it) => {
      if (it.o) R.drawObject(ctx, it.o, G.st, G.useSprites, now);
      else {
        const fx = it.p.fx != null ? it.p.fx : it.p.x, fy = it.p.fy != null ? it.p.fy : it.p.y;
        R.drawPerson(ctx, it.p, fx, fy - hopOffset(it.p.key, now) / T, now, G.useSprites); placeTag(it.p.key, fx, fy);
        if (it.p.act === 'mop' && G.useSprites) drawMop(ctx, it.p, now);
        else if (it.p.act === 'shelf' && G.useSprites) drawShelfWork(ctx, it.p, now);
      }
    });
    if (root.POLook && R.look !== false) root.POLook.drawLight(ctx, L);
    G.drawOrder = people;
    const top = G.els.top.getContext('2d');
    top.imageSmoothingEnabled = false;
    top.clearRect(0, 0, W, H);
    people.forEach((p) => {
      if (!p.mark) return;
      const bob = Math.floor((now + p.phase) / 400) % 2;
      if (G.useSprites && p.pose) {
        const b = LC.personBox(p);
        const pod = p.pose === 'sit' && p.face === 'up' && L.objects.find((o) => o.type === 'desk' && o.owner === p.key && o.frame != null);
        if (pod) { R.drawMark(top, p.mark, pod.frame ? b.x + b.w + 5 : b.x - 6, b.y + MARK_SIDE_DY - bob - hopOffset(p.key, now)); return; }
        const side = LC.markSide(L, p);
        if (side) { R.drawMark(top, p.mark, side > 0 ? b.x + b.w + 5 : b.x - 6, b.y + MARK_SIDE_DY - bob - hopOffset(p.key, now)); return; }
        R.drawMark(top, p.mark, b.x + b.w / 2, b.y + b.top - 2 - bob - hopOffset(p.key, now)); return;
      }
      R.drawMark(top, p.mark, p.x * T + T / 2, p.y * T + R.headTop(p, G.useSprites) - 2 - bob - hopOffset(p.key, now));
    });
    drawChat(top, now);
    const mv = (o, who) => Object.assign(who, { face: o.face, walking: !!o.moving, walkT0: o.walkT0 });
    const movers = [{ who: mv(G.avatar, { kind: 'avatar' }), fx: G.avatar.fx, fy: G.avatar.fy }].concat([{ who: mv(G.tori, { key: '토리', phase: 0 }), fx: G.tori.fx, fy: G.tori.fy - hopOffset(toriKey(), now) / T }]).sort((a, b) => a.fy - b.fy);
    movers.forEach((m) => R.drawPerson(top, m.who, m.fx, m.fy, now, G.useSprites));
    placeTag('토리', G.tori.fx, G.tori.fy);
    placeFocusTag();
  }

  const MARK_SIDE_DY = LC.MARK_SIDE_DY;
  function personX(p) { return p.px != null ? p.px : p.x * T; }
  const CHAT_SHOW_MS = 1200, CHAT_GAP_MS = 400, CHAT_KINDS = ['dots', 'note', 'laugh'];
  const DLG_BOX = { x1: 8, y1: 182, x2: 376, y2: 252 };
  function chatKind(g, n) {
    G.chatState = G.chatState || {};
    const cs = G.chatState[g] || (G.chatState[g] = { n: -1, k: -1 });
    if (cs.n !== n) {
      const h = C.hashStr((G.st ? G.st.breakSeed : '') + '|' + g + '|' + n);
      let k = h % 3;
      if (k === cs.k) k = (k + 1 + ((h >>> 8) & 1)) % 3;
      cs.n = n; cs.k = k;
    }
    return CHAT_KINDS[cs.k];
  }
  function chatNow(now) {
    const groups = {};
    G.people.forEach((p) => { if (p.kind === 'chat' || p.kind === 'table') (groups[p.group] = groups[p.group] || []).push(p); });
    const out = [];
    Object.keys(groups).forEach((g) => {
      const members = groups[g].slice().sort((a, b) => a.spot - b.spot);
      if (members.length < 2) return;
      const elig = members.filter((p) => !p.mark);
      if (!elig.length) return;
      if (reduceMotion()) { out.push({ g, p: elig[0], kind: 'dots', bob: 0 }); return; }
      const el = now - (G.t0 || 0), n = Math.floor(el / (CHAT_SHOW_MS + CHAT_GAP_MS));
      if (el - n * (CHAT_SHOW_MS + CHAT_GAP_MS) >= CHAT_SHOW_MS) return;
      out.push({ g, p: elig[n % elig.length], kind: chatKind(g, n), bob: Math.floor(now / 400) % 2 });
    });
    return out;
  }
  function drawChat(top, now) {
    G.chatDrawn = [];
    if (!G.useSprites) return;
    chatNow(now).forEach((c) => {
      const key = 'ui_chat_' + c.kind;
      if (!root.POSprites.has(key)) return;
      const b = LC.personBox(c.p);
      const x = b.x + LC.CHAT_DX, y = b.y + b.top + LC.CHAT_DY - c.bob - hopOffset(c.p.key, now);
      if (G.bubble && x < DLG_BOX.x2 && DLG_BOX.x1 < x + 9 && y < DLG_BOX.y2 && DLG_BOX.y1 < y + 9) return;
      top.drawImage(root.POSprites.frameCanvas(key, 0), x, y);
      G.chatDrawn.push({ key: c.p.key, g: c.g, kind: c.kind, x, y });
    });
  }

  function snapshot() {
    return {
      avatar: G.avatar && { x: G.avatar.x, y: G.avatar.y, face: G.avatar.face, goal: G.avatar.goal || null, moving: !!G.avatar.moving }, tori: G.tori && { x: G.tori.x, y: G.tori.y, mode: G.tori.mode, face: G.tori.face },
      bubble: G.bubble && { i: G.bubble.i, list: G.bubble.list, kind: G.bubble.kind, who: G.bubble.who || null, dn: G.bubble.dn, page: G.bubble.onDn ? 'dangnee' : 'tori', done: G.bubble.shown >= G.bubble.len, shown: G.bubble.text && G.bubble.chars.slice(0, G.bubble.shown).join('') }, win: G.win && { type: G.win.type, key: G.win.key, page: G.win.page },
      winText: G.win ? G.els.win.innerText : '', people: G.people.map((p) => ({ name: p.name, key: p.key, x: p.x, y: p.y, mark: p.mark, pose: p.pose, face: p.face, px: p.px, py: p.py, kind: p.kind })), scale: G.scale,
      firstVisit: G.firstVisit,
    };
  }

  function pathKeys(tx, ty) {
    const p = bfs([G.avatar.x, G.avatar.y], [tx, ty]);
    if (!p) return null;
    const keys = []; let c = [G.avatar.x, G.avatar.y];
    p.forEach((n) => { keys.push(n[0] > c[0] ? 'ArrowRight' : n[0] < c[0] ? 'ArrowLeft' : n[1] > c[1] ? 'ArrowDown' : 'ArrowUp'); c = n; });
    return keys;
  }

  root.POGame = { G, chatNow, frameHit, clickTarget, bfs, walkGoal, hopOffset, closeDialog: () => closeBubble(false), enter, setData, snapshot, resize, rebuildTags, place, startBriefing, closeWin, pathKeys, openTarget, openApproval, openBadge };
})(window);
