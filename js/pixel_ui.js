(function (root) {
  'use strict';
  const P = root.POPixelCore, FS = root.POFS;
  const D = () => root.PODesktop;
  const $ = (id) => document.getElementById(id);
  const KEY = (k, sh) => (root.POPlat ? root.POPlat.key(k, sh) : (sh ? '⇧⌘' : '⌘') + k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = root.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { root.localStorage.removeItem(k); } catch (e) {  } },
  };
  const CELL_PX = { 16: 28, 24: 18, 32: 14 };
  const CONV_PX = { 16: 24, 24: 16, 32: 12 };
  const BGS = [['f', '바닥', '#E3E0DA'], ['w', '벽', '#F4F3EF'], ['k', '먹', '#29262F']];
  const TOOLS = [['pen', '펜', 'B', 2], ['eraser', '지우개', 'E', 3], ['fill', '채우기', 'G', 4], ['picker', '스포이트', 'I', 5]];
  const HIST_MAX = 100;
  const canWrite = () => !!(D() && typeof D().write === 'function');
  const pub = () => root.PO_PUBLIC === true;
  const canConvert = () => !pub() && !!(D() && typeof D().toolRunJson === 'function');

  const W = {
    el: null, open: false, side: 'paint', back: null,
    g: P.blank(24), tool: 'pen', alt: false, color: '#29262F', mine: [], name: '', note: '',
    hist: [], fut: [], grid: true, bg: 'f', cur: null, stroke: null,
    files: [], saved: null, saving: false, err: '', msg: '', msgT: null, ask: null, pop: null, rescue: false, stored: true,
    conv: { src: null, w: 0, h: 0, url: null, crop: null, cells: 24, colors: 8, outline: true, bg: true, resample: '선', busy: false, res: null, json: null, err: '', seq: 0, t: null, drop: '' },
  };
  Object.assign(W.conv, (() => { const c = store.get('po.pixel.conv', null); return c && typeof c === 'object' ? { cells: P.SIZES.includes(c.cells) ? c.cells : 24, colors: c.colors >= 2 && c.colors <= 16 ? c.colors : 8, outline: c.outline !== false, bg: c.bg !== false, resample: ['선', '면', '사진'].includes(c.resample) ? c.resample : '선' } : {}; })());

  const iconCache = {};
  function icon(i, s) {
    const k = i + ':' + s;
    if (!(k in iconCache)) { const c = root.POSprites && root.POSprites.has('tool_icons_pixelshop') ? root.POSprites.frameCanvas('tool_icons_pixelshop', i) : null; iconCache[k] = c ? c.toDataURL() : ''; }
    return iconCache[k] ? '<img class="px-ic" alt="" src="' + iconCache[k] + '" width="' + 12 * s + '" height="' + 12 * s + '">' : '';
  }
  const colorName = (hex) => (hex ? (P.BY_HEX[hex] ? P.BY_HEX[hex].name : '내 색') : '투명');
  const colorTag = (hex) => (hex ? (P.BY_HEX[hex] ? P.BY_HEX[hex].l + ' · ' + hex : hex) : '지우개');

  function draftOf() { return { n: W.g.n, c: W.g.c, name: W.name, note: W.note, mine: W.mine, saved: W.saved }; }
  function applyDraft(d) {
    if (!d || !P.SIZES.includes(d.n) || !Array.isArray(d.c) || d.c.length !== d.n * d.n) return false;
    W.g = { n: d.n, c: d.c.map((x) => P.normHex(x)) };
    W.name = typeof d.name === 'string' ? d.name : ''; W.note = typeof d.note === 'string' ? d.note : '';
    W.mine = Array.isArray(d.mine) ? d.mine.map(P.normHex).filter(Boolean).slice(0, P.MAX_MINE) : [];
    W.saved = d.saved && typeof d.saved === 'object' ? d.saved : null;
    return true;
  }
  let draftT = null;
  function keepDraft(now) {
    clearTimeout(draftT);
    const f = () => { W.stored = store.set('po.pixel.draft', draftOf()); const u = W.el && W.el.querySelector('.px-local'); if (u) u.textContent = localText(); };
    if (now) f(); else draftT = setTimeout(f, 300);
  }
  const localText = () => (W.stored ? '그리던 그림은 이 기기에 남아요' : '이 기기에 남기지 못했어요 (저장 공간)');
  function stashRescue() {
    if (!P.filled(W.g)) return;
    W.rescue = store.set('po.pixel.rescue', draftOf());
  }
  function swapRescue() {
    const r = store.get('po.pixel.rescue', null);
    if (!r) { W.rescue = false; return; }
    const cur = draftOf();
    if (!applyDraft(r)) { W.rescue = false; return; }
    if (P.filled({ n: cur.n, c: cur.c })) store.set('po.pixel.rescue', cur); else { store.del('po.pixel.rescue'); W.rescue = false; }
    W.hist = []; W.fut = [];
    keepDraft(true); renderAll();
  }

  function open(opt) {
    opt = opt || {};
    if (!W.el) { W.el = $('pixel'); bind(); }
    const app = root.POApp;
    if (!W.open) W.back = app ? app.screen : null;
    if (!W.loaded) { W.loaded = true; applyDraft(store.get('po.pixel.draft', null)); W.rescue = !!store.get('po.pixel.rescue', null); }
    if (opt.load) loadAsset(opt.load);
    W.side = opt.side || (opt.load ? 'paint' : W.side || 'paint');
    if (pub()) W.side = 'paint';
    W.open = true;
    if (app && app.show) app.show('pixel');
    renderAll();
    refreshFiles().then(() => { if (W.open) renderName(); });
    const f = W.el.querySelector(W.side === 'paint' ? '.px-board' : '.px-seg [aria-pressed="true"]'); if (f) f.focus({ preventScroll: true });
    return true;
  }
  function loadAsset(ld) {
    const r = P.fromAsset(ld.asset);
    if (r.error) { W.msg = '그림을 열지 못했어요: ' + r.error; return false; }
    if (P.filled(W.g) && !P.sameGrid(W.g, r.grid)) stashRescue();
    W.g = r.grid; W.name = ld.name || ''; W.note = ld.note || '';
    W.mine = P.used(W.g).map((u) => u.hex).filter((h) => !P.isOffice(h)).slice(0, P.MAX_MINE);
    W.hist = []; W.fut = []; W.saved = null; W.ask = null; W.pop = null;
    keepDraft(true);
    return true;
  }
  function close() {
    if (!W.open) return;
    W.open = false; W.pop = null; W.ask = null;
    keepDraft(true);
    const app = root.POApp, back = W.back;
    if (app && app.show && back && back !== 'pixel') app.show(back);
    if (back === 'cards') { const b = document.querySelector('.ec-chip[data-key="shop"]'); if (b) b.focus(); }
    if (back === 'shelf' && root.POShelf && root.POShelf.refreshPixel) root.POShelf.refreshPixel();
  }
  function onHidden() { if (W.open) { W.open = false; keepDraft(true); } }

  function snap() { return { g: P.clone(W.g), mine: W.mine.slice() }; }
  function commit(before) {
    if (P.sameGrid(before.g, W.g) && before.mine.join() === W.mine.join()) return false;
    W.hist.push(before); if (W.hist.length > HIST_MAX) W.hist.shift();
    W.fut = [];
    keepDraft();
    return true;
  }
  function undo() { if (!W.hist.length) return; W.fut.push(snap()); const s = W.hist.pop(); W.g = s.g; W.mine = s.mine; W.ask = null; keepDraft(); refresh(); }
  function redo() { if (!W.fut.length) return; W.hist.push(snap()); const s = W.fut.pop(); W.g = s.g; W.mine = s.mine; keepDraft(); refresh(); }
  const curTool = () => (W.alt && (W.tool === 'pen' || W.tool === 'fill') ? 'picker' : W.tool);
  function setCell(i, col) { if (W.g.c[i] === col) return false; W.g = { n: W.g.n, c: W.g.c.slice() }; W.g.c[i] = col; return true; }
  function applyAt(x, y, tool, first) {
    const n = W.g.n; if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = y * n + x;
    if (tool === 'pen') setCell(i, W.color);
    else if (tool === 'eraser') setCell(i, null);
    else if (tool === 'fill' && first) W.g = P.fill(W.g, i, W.color);
    else if (tool === 'picker' && first) { const c = W.g.c[i]; if (c) { W.color = c; W.tool = 'pen'; W.alt = false; } }
  }
  function line(a, b, f) {
    let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let k = 0; k < 200; k++) { f(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function cellAt(e) {
    const cv = W.el.querySelector('.px-board'); const r = cv.getBoundingClientRect(), n = W.g.n;
    const x = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)), inside: e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom };
  }
  function onDown(e) {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const c = cellAt(e);
    const tool = e.button === 2 ? 'eraser' : curTool();
    W.stroke = { before: snap(), last: c, tool };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {  }
    W.cur = c; W.el.querySelector('.px-board').focus({ preventScroll: true });
    applyAt(c.x, c.y, tool, true);
    if (tool === 'picker' || tool === 'fill') { W.stroke = { before: W.stroke.before, last: c, tool, done: true }; }
    drawBoard(); drawPreview(); drawRulers();
    if (tool === 'picker') { renderColors(); renderRail(); }
  }
  function onMove(e) {
    const c = cellAt(e);
    if (W.stroke && !W.stroke.done && (e.buttons & 3)) {
      line(W.stroke.last, c, (x, y) => applyAt(x, y, W.stroke.tool, false));
      W.stroke.last = c;
      W.cur = c; drawBoard(); drawPreview(); drawRulers(); renderPos();
      return;
    }
    const nc = c.inside ? { x: c.x, y: c.y } : null;
    if ((nc && (!W.cur || W.cur.x !== nc.x || W.cur.y !== nc.y)) || (!nc && W.cur && !W.keyCur)) { W.cur = nc; W.keyCur = false; drawBoard(); drawRulers(); renderPos(); }
  }
  function onUp() {
    if (!W.stroke) return;
    const s = W.stroke; W.stroke = null;
    if (commit(s.before)) afterChange(); else refresh();
  }
  function afterChange() { if (W.saved) W.saved.stale = true; refresh(); }
  function setTool(t) { W.tool = t; W.alt = false; renderRail(); renderColors(); }
  function flip() { const b = snap(); W.g = P.flipH(W.g); if (commit(b)) afterChange(); }
  function clearAll() {
    if (!P.filled(W.g)) { flash('지울 칸이 없어요.'); return; }
    const b = snap(); W.g = P.blank(W.g.n);
    if (commit(b)) { afterChange(); flash('전체를 지웠어요. ' + KEY('Z') + '로 되돌릴 수 있어요.'); }
  }
  function setSize(n) {
    if (n === W.g.n) { W.ask = null; renderUnder(); return; }
    if (n < W.g.n && P.lostOnResize(W.g, n) > 0 && W.ask !== n) { W.ask = n; renderUnder(); return; }
    const b = snap(); W.g = P.resize(W.g, n); W.ask = null; W.cur = null;
    if (commit(b)) afterChange(); else refresh();
    renderAll();
  }
  let flashT = null;
  function flash(t) { W.msg = t; renderUnder(); clearTimeout(flashT); flashT = setTimeout(() => { W.msg = ''; if (W.open) renderUnder(); }, 6000); }

  const mineList = () => { const s = new Set(W.mine); P.used(W.g).forEach((u) => { if (!P.isOffice(u.hex)) s.add(u.hex); }); return [...s]; };
  function pickColor(hex) { W.color = hex; if (W.tool === 'eraser' || W.tool === 'picker') W.tool = 'pen'; W.pop = null; renderColors(); renderRail(); }
  function addMine(hex) {
    hex = P.normHex(hex); if (!hex) return;
    if (P.isOffice(hex) || mineList().includes(hex)) { pickColor(hex); return; }
    if (mineList().length >= P.MAX_MINE) return;
    const b = snap(); W.mine = W.mine.concat([hex]);
    commit(b); W.pop = null; pickColor(hex);
  }

  const ownerHost = () => pub() && !!root.POTools && typeof root.POTools.pubHost === 'function' && root.POTools.pubHost() === 'dangnee';
  function headHtml() {
    const LN = root.PO_LINES, own = ownerHost() && LN && LN.ownerPixelSrc ? LN.ownerPixelSrc() : '';
    const ps = own || (LN && LN.portraitSrc ? LN.portraitSrc(LN.SPRITE.designer) : null);
    const seg = pub() ? '' : [['paint', 0, '그림판'], ['convert', 1, '그림 → 픽셀']].map(([k, i, t]) => '<button data-side="' + k + '" aria-pressed="' + (W.side === k) + '">' + icon(i, 2) + t + '</button>').join('');
    return '<header class="px-head"><span class="px-pt' + (own ? ' px' : '') + '"' + (ps ? ' style="background-image:url(\'' + esc(ps) + '\')"' : '') + '></span><div><h2>픽셀 공방</h2><small>' + (pub() ? '' : '무늬 스킬 · ') + 'AI 없이, 사무실 색으로 그려요</small></div>' +
      (seg ? '<div class="px-seg" role="group" aria-label="쪽 고르기">' + seg + '</div>' : '') + '<span class="px-sp"></span><button class="px-close" data-act="close">닫기<kbd>Esc</kbd></button></header>';
  }
  function railHtml() {
    const t = curTool();
    const b = (act, label, key, ic, on, dis, extra, keyOnly) => '<button class="px-tool' + (extra ? ' ' + extra : '') + '" data-act="' + act + '" aria-pressed="' + !!on + '"' + (dis ? ' disabled' : '') + ' title="' + esc(label + (key ? ' (' + key + ')' : '')) + '" aria-label="' + esc(label) + '">' + (ic != null ? icon(ic, 2) : '') + '<span>' + (keyOnly ? '<kbd>' + key + '</kbd>' : label + (key ? ' <kbd>' + key + '</kbd>' : '')) + '</span></button>';
    return TOOLS.map(([k, label, key, ic]) => b('tool:' + k, label, key, ic, t === k)).join('') + '<hr>' +
      b('flip', '뒤집기', 'H', 8) + b('clear', '전체 지우기', '', null, false, !P.filled(W.g), 'wide') + '<hr>' +
      b('undo', '되돌리기', KEY('Z'), 6, false, !W.hist.length, '', true) + b('redo', '다시 하기', KEY('Z', true), 7, false, !W.fut.length, '', true);
  }
  function paintHtml() {
    return '<div class="px-body paint"><div class="px-rail" role="toolbar" aria-label="도구">' + railHtml() + '</div>' +
      '<div class="px-matcol"><div class="px-mat"><div class="px-matin"><div class="px-ruler top" aria-hidden="true"></div><div class="px-ruler left" aria-hidden="true"></div>' +
      '<canvas class="px-board" tabindex="0" role="img" aria-label="그림판 캔버스. 방향키로 칸 옮기고 Space로 칠해요."></canvas></div><span class="px-mattag"></span></div>' +
      '<div class="px-under"></div></div>' +
      '<aside class="px-paper"><section class="px-pv"></section><section class="px-colors"></section><section class="px-namebox">' + nameBoxHtml() + '</section></aside></div>';
  }
  function nameBoxHtml() {
    return '<label for="px-name">이름</label><input id="px-name" maxlength="80" autocomplete="off" spellcheck="false" value="' + esc(W.name) + '" placeholder="예: 커피 컵">' +
      '<div class="px-namenote"></div><p class="px-path"></p><div class="px-save"><button class="px-main" data-act="save">저장</button><span class="meta"></span></div><p class="px-saved" aria-live="polite"></p>' +
      '<p class="px-foot">이름은 40자까지, 파일 이름에 맞게 다듬어 저장해요. 같은 이름이 있으면 다음 번호로 새로 저장해요. 덮어쓰기·지우기는 없어요.</p>';
  }
  function renderAll() {
    if (!W.el) return;
    if (pub()) W.side = 'paint';
    W.el.className = 'px-wb side-' + W.side;
    W.el.innerHTML = headHtml() + (W.side === 'paint' ? paintHtml() : convertHtml());
    if (W.side === 'paint') refresh(); else refreshConv();
  }
  function refresh() {
    if (!W.el || W.side !== 'paint' || !W.el.querySelector('.px-board')) return;
    drawBoard(); drawRulers(); drawPreview(); renderRail(); renderUnder(); renderColors(); renderName();
  }
  function renderRail() { const r = W.el.querySelector('.px-rail'); if (r) r.innerHTML = railHtml(); }
  function renderPos() { const p = W.el.querySelector('.px-pos'); if (p) p.textContent = W.cur ? 'x ' + W.cur.x + ' · y ' + W.cur.y : 'x – · y –'; }
  function renderUnder() {
    const u = W.el.querySelector('.px-under'); if (!u) return;
    const n = W.g.n;
    let warn = '';
    if (W.ask) warn = '<div class="px-warn" role="alert"><span><b>' + n + ' → ' + W.ask + '칸</b> 가장자리 ' + (n - W.ask) / 2 + '칸씩 잘려요. 잘린 칸은 되돌리기로 살릴 수 있어요.</span><button class="px-btn" data-act="shrink">줄이기</button><button class="px-btn" data-act="noshrink">그대로</button></div>';
    else if (W.msg) warn = '<div class="px-warn note" role="status"><span>' + esc(W.msg) + '</span></div>';
    u.innerHTML = '<div class="px-row"><span class="lab">칸 수</span><div class="px-seg sm" role="group" aria-label="칸 수">' + P.SIZES.map((s) => '<button data-size="' + s + '" aria-pressed="' + (s === n) + '">' + s + '</button>').join('') + '</div>' +
      '<span class="px-pos"></span><button class="px-chk" data-act="grid" aria-pressed="' + W.grid + '"><i></i>칸 선</button><span class="px-sp"></span>' +
      (W.rescue ? '<button class="px-link" data-act="rescue">그리던 그림 되살리기</button>' : '') + '<span class="px-local">' + localText() + '</span></div>' + warn;
    renderPos();
    const tag = W.el.querySelector('.px-mattag'); if (tag) tag.textContent = n + ' × ' + n + '칸 · 화면 한 칸 ' + CELL_PX[n] + 'px';
  }
  function chipBtn(hex, mine) {
    const nm = colorName(hex);
    return '<button class="px-cc' + (mine ? ' mine' : '') + '" style="background:' + hex + '" data-color="' + hex + '" aria-pressed="' + (W.color === hex && curTool() !== 'eraser') + '" title="' + esc(nm + ' ' + (P.BY_HEX[hex] ? P.BY_HEX[hex].l + ' ' : '') + hex) + '" aria-label="' + esc(nm + ' ' + hex) + '"></button>';
  }
  function renderColors() {
    const s = W.el.querySelector('.px-colors'); if (!s) return;
    const er = curTool() === 'eraser', hex = er ? null : W.color;
    const u = P.used(W.g), mine = mineList(), full = mine.length >= P.MAX_MINE;
    let h = '<h3>색 <small>사무실 팔레트 56색</small><small class="r">우클릭 = 지우개</small></h3>' +
      '<div class="px-cur"><div class="sw' + (er ? ' clear' : '') + '"' + (er ? '' : ' style="background:' + hex + '"') + '></div><div><b>' + esc(er ? '지우개 (투명)' : colorName(hex)) + '</b><span>' + esc(colorTag(hex)) + '</span></div></div>' +
      '<div class="px-used"><span class="lab">쓴 색 ' + u.length + '</span>' + u.map((x) => chipBtn(x.hex, !P.isOffice(x.hex))).join('') +
      '<button class="px-add" data-act="addcolor"' + (full ? ' disabled title="내 색은 그림 하나에 4색까지예요"' : '') + '>+ 색 추가</button></div>';
    if (mine.length) h += '<div class="px-used minerow"><span class="lab">내 색 ' + mine.length + '/' + P.MAX_MINE + '</span>' + mine.map((m) => chipBtn(m, true)).join('') + '<small>이 파일 팔레트에만</small></div>';
    h += '<div class="px-pal">' + P.GROUPS.map(([g, cs]) => '<div class="px-pg"><span class="lab">' + g + '</span><div class="prow">' + cs.map(([, hx]) => chipBtn(hx, false)).join('') + '</div></div>').join('') + '</div>';
    if (W.pop) h += popHtml();
    s.innerHTML = h;
    const hi = s.querySelector('.px-pop input.hex'); if (hi && W.pop.focus) { hi.focus(); W.pop.focus = false; }
  }
  function popHtml() {
    const hex = P.normHex(W.pop.hex) || '#888888';
    const nr = P.nearestOffice(hex), full = mineList().length >= P.MAX_MINE, office = P.isOffice(hex);
    return '<div class="px-pop" role="dialog" aria-label="색 추가"><div class="r1"><span class="big" style="background:' + hex + '"></span>' +
      '<input class="hex" type="text" maxlength="7" value="' + hex + '" aria-label="색 hex"><input class="pick" type="color" value="' + hex.toLowerCase() + '" aria-label="색 고르기"><button class="px-x" data-act="popclose" aria-label="닫기">×</button></div>' +
      '<p class="near">가장 가까운 사무실 색 <i style="background:' + nr.p.hex + '"></i><b>' + esc(nr.p.name) + ' ' + nr.p.l + '</b> · ' + nr.word + '</p>' +
      '<div class="acts"><button class="px-btn dark" data-act="popadd"' + (full && !office ? ' disabled' : '') + '>' + (office ? '이 색 쓰기 (사무실 색)' : '이 색 넣기') + '</button><button class="px-btn" data-act="popnear">가까운 색 쓰기</button></div>' +
      '<p class="lim">' + (full && !office ? '내 색은 그림 하나에 4색까지예요. 지금 ' + P.MAX_MINE + '개.' : '내 색은 그림 하나에 4색까지, 이 파일 팔레트에만 들어가요. 사무실 팔레트는 그대로예요.') + '</p></div>';
  }

  async function refreshFiles() {
    const h = root.POApp && root.POApp.handle;
    if (!h) { W.files = []; return; }
    try { W.files = (await FS.listAll(h, P.DIR)).filter((x) => x.kind === 'file').map((x) => x.nfc); } catch (e) { W.files = []; }
  }
  function plan() {
    const tidy = P.tidyName(W.name);
    if (!tidy) return { tidy };
    return Object.assign({ tidy }, P.nextPath(W.files, P.KIND, tidy, 'json', P.today()));
  }
  const mmdd = (d) => d.slice(4, 6) + '/' + d.slice(6, 8);
  const vv = (v) => 'v' + String(v).padStart(2, '0');
  function renderName() {
    const box = W.el && W.el.querySelector('.px-namebox'); if (!box) return;
    const pl = plan(), n = W.g.n, filled = P.filled(W.g), u = P.used(W.g), mineN = u.filter((x) => !P.isOffice(x.hex)).length;
    const savedNow = W.saved && !W.saved.stale && W.saved.tidy === pl.tidy;
    let note = '';
    if (W.name.trim() && !pl.tidy) note = '<p class="px-bad">이름에 글자나 숫자를 넣어 주세요.</p>';
    else if (pl.tidy && pl.tidy !== W.name.trim()) note = '<p class="px-tidy">저장될 이름 <b>' + esc(pl.name) + '</b> · 띄어쓰기·_ 는 붙이거나 - 로 바꿔요' + (pl.name !== pl.tidy ? ' (같은 그림의 처음 표기)' : '') + '</p>';
    else if (pl.tidy && pl.name !== pl.tidy) note = '<p class="px-tidy">저장될 이름 <b>' + esc(pl.name) + '</b> · 영문 대소문자만 다르면 같은 그림이에요 (같은 그림의 처음 표기)</p>';
    if (pl.prev && !savedNow) {
      const one = pl.first.v === pl.prev.v;
      note += '<p class="px-v">‘' + esc(pl.name) + '’ <b>' + (one ? vv(pl.prev.v) + '</b>이 이미 있어요(' + mmdd(pl.prev.date) + ').' : vv(pl.first.v) + '~' + vv(pl.prev.v) + '</b>가 이미 있어요(마지막 ' + mmdd(pl.prev.date) + ').') + ' 새 파일 <b>' + vv(pl.v) + '</b>로 저장하고, 있던 파일은 그대로 둬요.</p>';
    }
    box.querySelector('.px-namenote').innerHTML = note;
    const file = savedNow ? W.saved.file : pl.tidy ? pl.file : P.today() + '_픽셀_(이름)_v01.json';
    box.querySelector('.px-path').innerHTML = esc(P.DIR + '/') + '<b>' + esc(file) + '</b>';
    const btn = box.querySelector('.px-main');
    const off = !canWrite();
    btn.disabled = off || W.saving || savedNow || !filled || !pl.tidy;
    btn.textContent = savedNow ? '저장됨' : W.saving ? '저장 중…' : pl.prev ? vv(pl.v) + '로 저장' : '저장';
    btn.classList.toggle('done', !!savedNow);
    box.querySelector('.meta').textContent = n + '×' + n + '칸 · ' + u.length + '색' + (mineN ? '(내 색 ' + mineN + ')' : '');
    const sv = box.querySelector('.px-saved');
    if (off) sv.innerHTML = '<span class="px-off">저장은 데스크톱 앱에서만 돼요. 그리던 그림은 이 기기에 남아요.</span>';
    else if (W.err) sv.innerHTML = '<span class="px-bad">' + esc(W.err) + '</span>';
    else if (savedNow) sv.innerHTML = '<span class="ok">✓ 픽셀 공방 책 ' + W.saved.page + '쪽에 붙었어요</span><button class="px-link" data-act="toBook">책에서 보기</button>' + (W.saved.bumped ? '<small>저장하는 사이 같은 번호가 생겨 ' + vv(W.saved.v) + '로 저장했어요.</small>' : '');
    else if (W.saved && W.saved.stale) sv.innerHTML = '<span class="was">마지막 저장 ' + esc(W.saved.file) + '</span>';
    else sv.innerHTML = '';
  }
  async function save() {
    const tidy = P.tidyName(W.name);
    if (!tidy || !P.filled(W.g) || !canWrite() || W.saving) return;
    W.saving = true; W.err = ''; renderName();
    try {
      await refreshFiles();
      let pl = P.nextPath(W.files, P.KIND, tidy, 'json', P.today());
      const want = pl.v;
      for (let k = 0; k < 50; k++) {
        const text = P.dumpAsset(P.toAsset(W.g, pl.name, W.note || undefined));
        try { await FS.writeNew(P.DIR + '/' + pl.file, text); break; } catch (e) {
          if (e && e.code === 'EEXIST') { W.files.push(pl.file); pl = P.nextPath(W.files, P.KIND, tidy, 'json', P.today()); if (k === 49) throw new Error('다음 번호를 찾지 못했어요'); continue; }
          throw e;
        }
      }
      W.files.push(pl.file);
      const groups = P.sketchGroups(W.files.map((f) => ({ file: f, text: null })));
      const gi = groups.findIndex((g) => g.key === pl.name.toLowerCase());
      W.saved = { file: pl.file, v: pl.v, name: pl.name, tidy, key: pl.name.toLowerCase(), page: Math.floor(Math.max(0, gi) / P.PER_PAGE) + 1, bumped: pl.v !== want };
      (W.justSaved = W.justSaved || new Set()).add(W.saved.key);
      keepDraft(true);
      if (root.POShelf && root.POShelf.markPixelDirty) root.POShelf.markPixelDirty();
    } catch (e) {
      W.err = '저장하지 못했어요: ' + String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    } finally { W.saving = false; }
    renderName();
    const b = W.el.querySelector('.px-saved .px-link'); if (b) b.focus();
  }
  async function toBook() {
    const key = W.saved && W.saved.key; if (!key) return;
    W.open = false; keepDraft(true);
    const app = root.POApp; if (app) app.selectTab('shelf');
    if (root.POShelf && root.POShelf.openPixel) await root.POShelf.openPixel(key);
  }

  const dpr = () => root.devicePixelRatio || 1;
  function sizeCanvas(cv, css) { const k = dpr(); cv.style.width = css + 'px'; cv.style.height = css + 'px'; if (cv.width !== Math.round(css * k)) { cv.width = Math.round(css * k); cv.height = Math.round(css * k); } const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.imageSmoothingEnabled = false; return g; }
  function drawGrid(cv, grid, cs, opt) {
    const n = grid.n, S = n * cs, g = sizeCanvas(cv, S), h = cs / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = grid.c[y * n + x], X = x * cs, Y = y * cs;
      if (c) { g.fillStyle = c; g.fillRect(X, Y, cs, cs); continue; }
      g.fillStyle = '#F4F3EF'; g.fillRect(X, Y, cs, cs);
      g.fillStyle = '#E4E3DE'; g.fillRect(X + h, Y, cs - h, h); g.fillRect(X, Y + h, h, cs - h);
    }
    if (opt.lines) {
      for (let i = 1; i < n; i++) {
        g.fillStyle = i % 8 === 0 ? 'rgba(41,38,47,.32)' : 'rgba(41,38,47,.12)';
        g.fillRect(i * cs, 0, 1, S); g.fillRect(0, i * cs, S, 1);
      }
      g.fillStyle = '#D03CC6';
      for (let y = 0; y < S; y += 6) g.fillRect(n / 2 * cs, y, 1, Math.min(3, S - y));
    }
    if (opt.cur) {
      const X = opt.cur.x * cs, Y = opt.cur.y * cs;
      g.strokeStyle = '#29262F'; g.lineWidth = 2; g.strokeRect(X + 1, Y + 1, cs - 2, cs - 2);
      g.strokeStyle = '#F4F3EF'; g.lineWidth = 1; g.strokeRect(X + 2.5, Y + 2.5, cs - 5, cs - 5);
    }
  }
  function drawBoard() {
    const cv = W.el.querySelector('.px-board'); if (!cv) return;
    drawGrid(cv, W.g, CELL_PX[W.g.n], { lines: W.grid, cur: W.cur });
  }
  function rulerHtml(n, cs, hot, top) {
    let h = '';
    for (let i = 0; i < n; i++) {
      const p = i * cs + cs / 2, isHot = hot === i, major = i % 4 === 0;
      h += '<i class="' + (isHot ? 'hot' : major ? 'm' : '') + '" style="' + (top ? 'left' : 'top') + ':' + p + 'px"></i>';
      if (major || isHot) h += '<b class="' + (isHot ? 'hot' : '') + '" style="' + (top ? 'left' : 'top') + ':' + p + 'px">' + i + '</b>';
    }
    return h;
  }
  function drawRulers() {
    const n = W.g.n, cs = CELL_PX[n];
    const t = W.el.querySelector('.px-ruler.top'), l = W.el.querySelector('.px-ruler.left');
    if (t) t.innerHTML = rulerHtml(n, cs, W.cur ? W.cur.x : -1, true);
    if (l) l.innerHTML = rulerHtml(n, cs, W.cur ? W.cur.y : -1, false);
  }
  function drawSmall(cv, grid, k, bgHex) {
    const n = grid.n, S = n * k, g = sizeCanvas(cv, S);
    g.clearRect(0, 0, S, S);
    if (bgHex) { g.fillStyle = bgHex; g.fillRect(0, 0, S, S); }
    for (let i = 0; i < n * n; i++) { const c = grid.c[i]; if (c) { g.fillStyle = c; g.fillRect((i % n) * k, Math.floor(i / n) * k, k, k); } }
  }
  function drawPreview() {
    const s = W.el.querySelector('.px-pv'); if (!s) return;
    if (!s.querySelector('canvas')) {
      s.innerHTML = '<h3>미리보기 <small>실제 크기와 사무실 배율</small></h3><div class="px-pvrow"><figure><div class="box b1"><canvas class="c1"></canvas></div><figcaption>1배</figcaption></figure>' +
        '<figure><div class="box b4"><canvas class="c4"></canvas></div><figcaption>4배</figcaption></figure><div class="px-bgs" role="group" aria-label="바탕">' +
        BGS.map(([k, t, c]) => '<button data-bg="' + k + '" aria-pressed="' + (W.bg === k) + '"><i style="background:' + c + '"></i>' + t + '</button>').join('') + '</div></div>';
    }
    const bg = BGS.find((b) => b[0] === W.bg)[2];
    s.querySelectorAll('.box').forEach((b) => { b.style.background = bg; });
    s.querySelectorAll('.px-bgs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bg === W.bg)));
    drawSmall(s.querySelector('.c1'), W.g, 1, null);
    drawSmall(s.querySelector('.c4'), W.g, W.g.n * 4 <= 128 ? 4 : 3, null);
  }

  const C = W.conv;
  function convertHtml() {
    if (!C.src) {
      const off = !canConvert();
      return '<div class="px-body conv empty"><div class="px-matcol"><div class="px-mat px-drop" data-drop="1"><div class="px-dz"><b>' + (off ? '그림 → 픽셀은 데스크톱 앱에서만 돼요' : '그림을 여기에 끌어다 놓으세요') + '</b>' +
        '<p>png · jpg · webp. 정사각 틀로 잘라 16·24·32칸으로 줄이고<br>사무실 팔레트 색으로 맞춰요. 원본 파일은 고치지 않아요.</p>' +
        '<button class="px-btn dark big" data-act="pick"' + (off ? ' disabled' : '') + '>이미지 고르기</button>' + (C.drop ? '<p class="px-bad">' + esc(C.drop) + '</p>' : '') + (root.PO_NM || String)('<p class="sm">당니오피스 안 그림만 받아요. 고르기 창은 40_자산에서 열려요.</p></div></div></div>') +
        '<aside class="px-paper"><section><h3>이렇게 바뀌어요</h3><ol class="px-ol"><li>정사각 틀로 자를 곳을 고르고</li><li>칸 수·색 수·외곽선·배경 빼기를 정하면 바로 결과가 보여요.</li><li>[그림판에서 다듬기]로 넘겨 손보고, 이름을 붙여 저장해요.</li></ol></section>' +
        '<section><h3>잘 되는 그림</h3><p class="px-small">물건 하나가 가운데 있고 배경이 한 색이거나 투명한 그림. 사진이나 배경이 복잡한 그림은 배경이 남으니 그림판 지우개로 다듬어요.</p></section></aside></div>';
    }
    const seg = (name, vals, cur) => '<div class="px-seg sm" role="group" aria-label="' + name + '">' + vals.map(([v, t]) => '<button data-conv="' + name + '" data-v="' + v + '" aria-pressed="' + (String(cur) === String(v)) + '">' + t + '</button>').join('') + '</div>';
    const sw = (name, on) => '<div class="px-sw" role="group" aria-label="' + name + '"><button data-conv="' + name + '" data-v="1" aria-pressed="' + on + '">켬</button><button data-conv="' + name + '" data-v="0" aria-pressed="' + !on + '">끔</button></div>';
    return '<div class="px-body conv"><section class="px-paper px-src"><h3>원본 <small>틀을 끌어 자를 곳을 골라요</small></h3><div class="px-stage" data-drop="1"></div>' +
      '<div class="fn"><b>' + esc(C.src.split('/').pop()) + '</b><small>' + esc(C.src.split('/').slice(0, -1).join('/')) + (C.w ? ' · ' + C.w + '×' + C.h : '') + '</small></div>' +
      '<div class="acts"><button class="px-btn" data-act="pick">다른 이미지</button></div>' + (C.drop ? '<p class="px-bad">' + esc(C.drop) + '</p>' : '') + '</section>' +
      '<div class="px-matcol"><div class="px-mat conv"><canvas class="px-result" role="img" aria-label="변환 결과"></canvas><span class="px-mattag"></span></div><div class="px-convnote"></div></div>' +
      '<aside class="px-paper"><section><h3>바꾸기</h3><div class="px-set">' +
      '<span>칸 수</span>' + seg('cells', P.SIZES.map((s) => [s, s]), C.cells) +
      '<span>색 수</span><div><input type="range" min="2" max="16" value="' + C.colors + '" data-conv="colors" aria-label="색 수"><output>' + C.colors + '</output></div>' +
      '<p class="hint">사무실 팔레트에서 가장 많이 쓰인 색부터 골라요. 외곽선 먹색은 따로예요.</p>' +
      '<span>줄이는 법</span>' + seg('resample', [['선', '선'], ['면', '면'], ['사진', '사진']], C.resample) +
      '<p class="hint">낙서·선 그림은 선, 색 면 아이콘은 면, 사진은 사진.</p>' +
      '<span>외곽선</span>' + sw('outline', C.outline) + '<p class="hint">그림 둘레에 먹색(k) 1칸 테를 둘러요. 그림은 한 칸 안쪽으로 들어가요.</p>' +
      '<span>배경 빼기</span>' + sw('bg', C.bg) + '<p class="hint">가장자리에서 이어진 투명·가장자리 색과 비슷한 곳을 빼요. 끔이면 원래 투명만 빼요.</p>' +
      '</div></section><section class="px-convused"></section><section><button class="px-main" data-act="toPaint">그림판에서 다듬기</button>' +
      '<p class="px-small">그림판에 이 결과가 열리고 이름 칸에 “' + esc(P.nameFromSource(C.src)) + '”가 미리 들어가요. 저장은 그림판에서 해요.</p></section></aside></div>';
  }
  function refreshConv() {
    if (!W.el || W.side !== 'convert' || !C.src) return;
    drawSource(); drawResult();
  }
  function drawResult() {
    const cv = W.el.querySelector('.px-result'); if (!cv) return;
    const grid = C.res || P.blank(C.cells);
    drawGrid(cv, grid, CONV_PX[grid.n], { lines: true });
    const tag = W.el.querySelector('.px-mattag'); if (tag) tag.textContent = C.busy ? '바꾸는 중' : C.res ? '결과 ' + C.res.n + ' × ' + C.res.n + '칸' : '';
    const nt = W.el.querySelector('.px-convnote');
    if (nt) {
      let h = '<p class="px-under-t">결과는 아직 저장 전이에요. 그림판으로 넘겨 다듬고 이름을 붙여 저장해요.</p>';
      if (C.err) h = '<p class="px-bad">' + esc(C.err) + '</p>' + h;
      else if (C.res && C.bg && P.bgRemains(C.res)) h = '<p class="px-warnline">배경이 여러 색인 그림이라 배경 일부가 남았어요. 그림판에서 지우개·채우기로 지워요.</p>' + h;
      nt.innerHTML = h;
    }
    const us = W.el.querySelector('.px-convused');
    if (us) {
      const u = C.res ? P.used(C.res) : [];
      us.innerHTML = '<h3>쓴 색 <small>' + (C.res ? u.length + '색' + (C.outline && u.some((x) => x.hex === P.OUTLINE) ? ' · 먹 외곽선 포함' : '') : C.busy ? '바꾸는 중' : '') + '</small></h3><div class="px-used">' + u.map((x) => '<span class="px-cc st" style="background:' + x.hex + '" title="' + esc(colorName(x.hex) + ' ' + x.hex + ' · ' + x.n + '칸') + '"></span>').join('') + '</div>';
    }
    const b = W.el.querySelector('[data-act="toPaint"]'); if (b) b.disabled = !C.res || C.busy;
  }
  const STAGE = 224;
  function stageGeom() { const k = Math.min(STAGE / C.w, STAGE / C.h); const iw = C.w * k, ih = C.h * k; return { k, ox: (STAGE - iw) / 2, oy: (STAGE - ih) / 2, iw, ih }; }
  function drawSource() {
    const st = W.el.querySelector('.px-stage'); if (!st) return;
    if (!C.url || !C.w) { st.innerHTML = '<p class="px-wait">' + (C.loadErr ? esc(C.loadErr) : '그림을 읽는 중…') + '</p>'; return; }
    const G = stageGeom(), cr = C.crop;
    const fx = G.ox + cr.x * G.k, fy = G.oy + cr.y * G.k, fs = cr.s * G.k;
    const hatch = (x, y, w, h) => (w > 0.5 && h > 0.5 ? '<i class="px-hatch" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px"></i>' : '');
    st.innerHTML = '<img alt="" src="' + C.url + '" style="left:' + G.ox + 'px;top:' + G.oy + 'px;width:' + G.iw + 'px;height:' + G.ih + 'px">' +
      hatch(G.ox, G.oy, G.iw, fy - G.oy) + hatch(G.ox, fy + fs, G.iw, G.oy + G.ih - fy - fs) + hatch(G.ox, fy, fx - G.ox, fs) + hatch(fx + fs, fy, G.ox + G.iw - fx - fs, fs) +
      '<div class="px-crop" data-crop="move" style="left:' + fx + 'px;top:' + fy + 'px;width:' + fs + 'px;height:' + fs + 'px" tabindex="0" aria-label="자를 곳 틀. 방향키로 옮겨요."><i data-crop="nw"></i><i data-crop="ne"></i><i data-crop="sw"></i><i data-crop="se"></i></div>';
  }
  async function setSource(rel) {
    if (C.url) { URL.revokeObjectURL(C.url); C.url = null; }
    Object.assign(C, { src: rel, w: 0, h: 0, crop: null, res: null, json: null, err: '', drop: '', loadErr: '' });
    W.side = 'convert'; renderAll();
    try {
      const r = await D().readBytes(rel, 0);
      const u = r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data);
      const blob = new Blob([u]);
      const bmp = await createImageBitmap(blob);
      if (C.src !== rel) { bmp.close(); return; }
      C.w = bmp.width; C.h = bmp.height; bmp.close();
      C.url = URL.createObjectURL(blob);
      const s = Math.min(C.w, C.h); C.crop = { x: Math.floor((C.w - s) / 2), y: Math.floor((C.h - s) / 2), s };
    } catch (e) { C.loadErr = '원본을 화면에 보이지 못했어요. 변환은 그대로 해 봐요.'; C.crop = null; }
    if (W.side === 'convert') renderAll();
    runConvert(true);
  }
  function scheduleConvert() { clearTimeout(C.t); C.busy = true; drawResult(); C.t = setTimeout(() => runConvert(true), 250); }
  async function runConvert() {
    if (!C.src || !canConvert()) return;
    clearTimeout(C.t);
    const seq = ++C.seq;
    C.busy = true; C.err = ''; if (W.side === 'convert') drawResult();
    store.set('po.pixel.conv', { cells: C.cells, colors: C.colors, outline: C.outline, bg: C.bg, resample: C.resample });
    const full = C.crop && C.crop.x === 0 && C.crop.y === 0 && C.crop.s === C.w && C.w === C.h;
    const params = P.convParams({ src: C.src, cells: C.cells, colors: C.colors, outline: C.outline, bg: C.bg, resample: C.resample, crop: C.crop && !full ? C.crop : null });
    let r;
    try { r = await D().toolRunJson('pixel-convert', params); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (seq !== C.seq || (r && r.canceled)) return;
    C.busy = false;
    if (!r || !r.ok) { C.err = '바꾸지 못했어요: ' + (r && r.error || '알 수 없음') + (r && r.missing ? ' (00_운영/도구/픽셀변환/변환.py 가 없어요)' : ''); C.res = null; }
    else {
      const fa = P.fromAsset(r.json.asset);
      if (fa.error) { C.err = '결과를 읽지 못했어요: ' + fa.error; C.res = null; } else { C.res = fa.grid; C.json = r.json; }
    }
    if (W.side === 'convert') drawResult();
  }
  function toPaint() {
    if (!C.res) return;
    const note = (C.json && C.json.asset && C.json.asset.note ? C.json.asset.note : '그림→픽셀 변환: ' + C.src.split('/').pop()) + ' · 원본 ' + C.src + ' · 그림판에서 고침';
    if (P.filled(W.g) && !P.sameGrid(W.g, C.res)) stashRescue();
    W.g = P.clone(C.res); W.name = P.nameFromSource(C.src); W.note = note; W.mine = [];
    W.hist = []; W.fut = []; W.saved = null; W.err = ''; W.ask = null; W.pop = null; W.cur = null;
    keepDraft(true);
    W.side = 'paint'; renderAll();
    const f = W.el.querySelector('.px-board'); if (f) f.focus({ preventScroll: true });
  }
  async function pickImage() {
    if (!canConvert() || !D().pickImage) return;
    const r = await D().pickImage();
    if (!r || r.canceled) return;
    if (!r.ok) { C.drop = (root.PO_NM || String)(r.error || '당니오피스 안 그림만 받아요.'); renderAll(); return; }
    setSource(r.rel);
  }
  async function onDrop(e) {
    e.preventDefault();
    const z = e.target.closest('[data-drop]'); if (z) z.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !canConvert() || !D().acceptDrop) return;
    const r = await D().acceptDrop(f);
    if (!r || !r.ok) { C.drop = (root.PO_NM || String)('당니오피스 안 png·jpg·webp 그림만 받아요. 밖 그림은 먼저 40_자산 안으로 옮겨 주세요.'); renderAll(); return; }
    setSource(r.rel);
  }
  function cropDown(e) {
    const h = e.target.closest('[data-crop]'); if (!h || !C.crop) return;
    e.preventDefault();
    const G = stageGeom(), mode = h.dataset.crop, c0 = Object.assign({}, C.crop), x0 = e.clientX, y0 = e.clientY;
    const mv = (ev) => {
      const dx = (ev.clientX - x0) / G.k, dy = (ev.clientY - y0) / G.k, min = Math.max(8, Math.round(Math.min(C.w, C.h) / 32));
      let { x, y, s } = c0;
      if (mode === 'move') { x = c0.x + dx; y = c0.y + dy; }
      else {
        const sx = mode.includes('e') ? 1 : -1, sy = mode.includes('s') ? 1 : -1;
        const ax = sx > 0 ? c0.x : c0.x + c0.s, ay = sy > 0 ? c0.y : c0.y + c0.s;
        s = Math.max(min, Math.min(c0.s + Math.max(dx * sx, dy * sy), sx > 0 ? C.w - ax : ax, sy > 0 ? C.h - ay : ay));
        x = sx > 0 ? ax : ax - s; y = sy > 0 ? ay : ay - s;
      }
      s = Math.round(Math.min(s, C.w, C.h)); x = Math.round(Math.max(0, Math.min(C.w - s, x))); y = Math.round(Math.max(0, Math.min(C.h - s, y)));
      C.crop = { x, y, s }; drawSource();
    };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); scheduleConvert(); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }

  function onClick(e) {
    const t = e.target.closest('button'); if (!t || !W.el.contains(t)) return;
    if (t.dataset.side) { if (t.dataset.side !== W.side && !(pub() && t.dataset.side !== 'paint')) { W.side = t.dataset.side; W.pop = null; renderAll(); const f = W.el.querySelector('.px-seg [aria-pressed="true"]'); if (f) f.focus(); } return; }
    if (t.dataset.size) return setSize(+t.dataset.size);
    if (t.dataset.color) return pickColor(t.dataset.color);
    if (t.dataset.bg) { W.bg = t.dataset.bg; drawPreview(); return; }
    if (t.dataset.conv) {
      const k = t.dataset.conv, v = t.dataset.v;
      if (k === 'cells') C.cells = +v; else if (k === 'resample') C.resample = v; else C[k] = v === '1';
      W.el.querySelectorAll('[data-conv="' + k + '"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
      scheduleConvert(); return;
    }
    const a = t.dataset.act || '';
    if (a.startsWith('tool:')) return setTool(a.slice(5));
    switch (a) {
      case 'close': return close();
      case 'flip': return flip();
      case 'clear': return clearAll();
      case 'undo': return undo();
      case 'redo': return redo();
      case 'grid': W.grid = !W.grid; drawBoard(); renderUnder(); return;
      case 'shrink': { const n = W.ask; W.ask = n; return setSize(n); }
      case 'noshrink': W.ask = null; return renderUnder();
      case 'rescue': return swapRescue();
      case 'addcolor': W.pop = { hex: W.color && !P.isOffice(W.color) ? W.color : '#8BCA40', focus: true }; return renderColors();
      case 'popclose': W.pop = null; renderColors(); { const b = W.el.querySelector('[data-act="addcolor"]'); if (b) b.focus(); } return;
      case 'popadd': return addMine(W.pop.hex);
      case 'popnear': return pickColor(P.nearestOffice(W.pop.hex).p.hex);
      case 'save': return save();
      case 'toBook': return toBook();
      case 'pick': return pickImage();
      case 'toPaint': return toPaint();
      default:
    }
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'px-name') { W.name = t.value; W.err = ''; keepDraft(); renderName(); return; }
    if (t.dataset && t.dataset.conv === 'colors') { C.colors = +t.value; const o = t.parentNode.querySelector('output'); if (o) o.textContent = t.value; scheduleConvert(); return; }
    if (t.closest && t.closest('.px-pop')) {
      const v = t.classList.contains('pick') ? t.value : t.value;
      const hx = P.normHex(v);
      if (hx) { W.pop.hex = hx; const pop = W.el.querySelector('.px-pop'); const keep = t.classList.contains('hex') ? t.selectionStart : null; renderColors(); const ni = W.el.querySelector('.px-pop ' + (t.classList.contains('hex') ? 'input.hex' : 'input.pick')); if (ni) { ni.focus(); if (keep != null) try { ni.setSelectionRange(keep, keep); } catch (er) {  } } void pop; }
    }
  }
  const typing = (t) => !!t && (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.isContentEditable);
  function onKey(e) {
    if (!W.open || !W.el || W.el.closest('.screen').hidden) return;
    const t = e.target;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (W.pop) { W.pop = null; renderColors(); return; }
      if (W.ask) { W.ask = null; renderUnder(); return; }
      if (typing(t)) { t.blur(); return; }
      return close();
    }
    if (W.side !== 'paint' || typing(t)) {
      if (W.side === 'convert' && t && t.classList && t.classList.contains('px-crop') && /^Arrow/.test(e.key) && C.crop) {
        e.preventDefault(); const st = Math.max(1, Math.round(C.crop.s / 16)) * (e.shiftKey ? 4 : 1);
        const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
        C.crop = { s: C.crop.s, x: Math.max(0, Math.min(C.w - C.crop.s, C.crop.x + d[0])), y: Math.max(0, Math.min(C.h - C.crop.s, C.crop.y + d[1])) };
        drawSource(); const f = W.el.querySelector('.px-crop'); if (f) f.focus(); scheduleConvert();
      }
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (mod || e.altKey && e.key !== 'Alt') return;
    if (e.key === 'Alt') { if (!W.alt && (W.tool === 'pen' || W.tool === 'fill')) { W.alt = true; renderRail(); } return; }
    const k = e.key.toLowerCase();
    const map = { b: 'pen', e: 'eraser', g: 'fill', i: 'picker' };
    if (map[k]) { e.preventDefault(); setTool(map[k]); return; }
    if (k === 'h') { e.preventDefault(); flip(); return; }
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      const list = P.PAL.map((p) => p.hex).concat(mineList());
      const i = list.indexOf(W.color); pickColor(list[(i + (e.key === ']' ? 1 : -1) + list.length) % list.length]); return;
    }
    if (t && t.classList && t.classList.contains('px-board')) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d) { e.preventDefault(); const c = W.cur || { x: W.g.n >> 1, y: W.g.n >> 1 }; W.cur = { x: Math.max(0, Math.min(W.g.n - 1, c.x + d[0])), y: Math.max(0, Math.min(W.g.n - 1, c.y + d[1])) }; W.keyCur = true; drawBoard(); drawRulers(); renderPos(); return; }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); if (!W.cur) W.cur = { x: W.g.n >> 1, y: W.g.n >> 1 };
        const b = snap(); applyAt(W.cur.x, W.cur.y, curTool(), true);
        if (commit(b)) afterChange(); else refresh();
      }
    }
  }
  function onKeyUp(e) { if (e.key === 'Alt' && W.alt) { W.alt = false; if (W.open && W.side === 'paint') renderRail(); } }
  function bind() {
    const el = W.el;
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('px-board')) onDown(e); else if (e.target.closest('[data-crop]')) cropDown(e); });
    el.addEventListener('pointermove', (e) => { if (e.target.classList.contains('px-board') || W.stroke) onMove(e); });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', (e) => { if (e.target.classList && e.target.classList.contains('px-board') && !W.stroke && W.cur && !W.keyCur) { W.cur = null; drawBoard(); drawRulers(); renderPos(); } }, true);
    el.addEventListener('contextmenu', (e) => { if (e.target.classList.contains('px-board')) e.preventDefault(); });
    el.addEventListener('dragover', (e) => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
    el.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
    el.addEventListener('drop', (e) => { if (e.target.closest('[data-drop]')) onDrop(e); else e.preventDefault(); });
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    root.addEventListener('blur', () => { if (W.alt) { W.alt = false; if (W.open && W.side === 'paint') renderRail(); } });
  }

  function paintInto(cv, grid, k) { drawSmall(cv, grid, k, null); }
  root.POPixel = { open, close, onHidden, paintInto, W, save, undo, redo, clearAll, setSize, runConvert, setSource, toPaint, refreshFiles, isJustSaved: (key) => !!(W.justSaved && W.justSaved.has(key)), clearJustSaved: () => { W.justSaved = null; } };
})(window);
