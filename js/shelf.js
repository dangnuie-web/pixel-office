(function (root) {
  'use strict';
  const K = root.POShelfCore, CC = root.POComboCore, FS = root.POFS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const A = '40_자산';
  const store = K.store;
  const SAMPLE0 = { en: 'The quick brown fox jumps over the lazy dog 0123456789', ko: '다람쥐 헌 쳇바퀴에 타고파 0123456789' };
  const PUBLIC_FONT_NOTE = '폴더에 폰트를 담아보세요. 이 책에서 모아 볼 수 있어요.';
  const pub = () => root.PO_PUBLIC === true;
  const noFontFiles = () => !!(SH.demo || root.PO_PUBLIC === true);
  const COL = {
    아이콘: { c: '#3f9e9a', sh: '#2f7d7a', hi: '#5bb3af' },
    폰트: { c: '#29262F', sh: '#14121a', hi: '#3d3944' },
    낙서: { c: '#D0C6AF', sh: '#B9AE96', hi: '#ddd5c2' },
    레퍼런스: { c: '#C4B6BE', sh: '#AE9FA8', hi: '#d3c8ce' },
  };
  const TAPE = { B: '#B2BDC9', G: '#B7C3B2', D: '#C4B6BE' };
  const SKU = () => root.POSkills;
  const SC = () => root.POSkillsCore;
  const colOf = (b) => (b.type === 'data' ? K.toolCol(b) : b.type === 'work' ? b.col : b.type === 'skill' ? SC().SKILL_COL : COL[b.kind]);
  const frameCol = (b) => (b.type === 'skill' ? SC().SKILL_FRAME : colOf(b));
  const PAPER = { 아이콘: 'grid', 폰트: 'ruled', 레퍼런스: 'kraft', 픽셀: 'sketch' };
  const PX = () => root.POPixelCore;
  COL.픽셀 = { c: '#8BBE4B', sh: '#5F9038', hi: '#A8D174' };

  const SH = {
    el: null, handle: null, books: [], loaded: false, loadP: null, loadErr: null,
    kind: store.get('po.shelf.kind', ''), tool: store.get('po.shelf.tool', ''), q: '', view: 'shelf',
    bk: null, pages: [], chapters: [], spread: 0, sel: null, zoom: null, dir: 1, opening: false,
    icons: { styles: [], entries: {} }, fonts: [], licRows: null, doodles: [], refs: [],
    fontState: {}, aaFamily: null, sample: { en: store.get('po.shelf.sample.en', SAMPLE0.en), ko: store.get('po.shelf.sample.ko', SAMPLE0.ko) },
    focusSpine: null, decodeLog: [], pixel: { groups: [], latest: null },
  };

  const notFound = (e) => e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');
  async function list(path) { try { return await FS.listAll(SH.handle, path); } catch (e) { if (notFound(e)) return []; throw e; } }
  async function scan() {
    const books = [];
    for (const kind of K.DATA_KINDS) {
      const dir = A + '/자료/' + kind;
      for (const f of (await list(dir)).filter((x) => x.kind === 'file' && /\.md$/i.test(x.nfc))) {
        let t = null; try { t = await FS.readText(SH.handle, dir + '/' + f.name); } catch (e) { t = null; }
        const meta = K.parseName(f.nfc);
        const text = t ? K.nfc(t.text) : '';
        const bytes = t ? new TextEncoder().encode(t.text).length : 0;
        const tags = CC.tagsOf(text);
        const isCombo = tags.includes('조합틀');
        books.push(Object.assign({ id: 'd:자료/' + kind + '/' + f.nfc, type: 'data', kind, file: f.nfc, path: dir + '/' + f.name, rel: dir + '/' + f.nfc, bytes, text, tags,
          tagLine: text.split(/\r?\n/)[0].startsWith('태그:') ? text.split(/\r?\n/)[0] : '', combo: isCombo, readFail: !t, t: kind === '워크플로우' ? K.thickBinder(bytes) : K.thickData(bytes) }, meta, kind === '워크플로우' ? { ht: K.BINDER_HT } : {}));
      }
    }
    books.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ko') || a.file.localeCompare(b.file, 'ko'));
    const styles = [];
    for (const d of (await list(A + '/아이콘')).filter((x) => x.kind === 'directory')) {
      const files = (await list(A + '/아이콘/' + d.name)).filter((x) => x.kind === 'file' && K.isImg(x.nfc));
      styles.push({ style: d.nfc, raw: d.name, files });
    }
    SH.icons = { styles: styles.map((s) => s.style), raw: Object.fromEntries(styles.map((s) => [s.style, s.raw])), entries: K.iconEntries(styles) };
    const iconCount = SH.icons.styles.reduce((n, s) => n + SH.icons.entries[s].length, 0);
    SH.fonts = [];
    for (const lang of ['영문', '한글']) {
      (await list(A + '/폰트/' + lang)).filter((x) => x.kind === 'file' && K.isFont(x.nfc)).forEach((f) => {
        SH.fonts.push({ lang, file: f.nfc, name: f.nfc.replace(K.FONT_EXT, ''), path: A + '/폰트/' + lang + '/' + f.name, fam: 'POF' + SH.fonts.length });
      });
    }
    try { SH.licRows = K.parseLicenses((await FS.readText(SH.handle, A + '/폰트/출처.md')).text); } catch (e) { SH.licRows = null; }
    SH.doodles = (await list(A + '/낙서')).filter((x) => x.kind === 'file' && K.isImg(x.nfc)).map((f) => ({ name: f.nfc, path: A + '/낙서/' + f.name }));
    SH.refs = [];
    async function walk(raw, rel, depth) {
      for (const e of await list(raw)) {
        if (e.kind === 'directory' && depth < 8) await walk(raw + '/' + e.name, rel ? rel + '/' + e.nfc : e.nfc, depth + 1);
        else if (e.kind === 'file' && K.isImg(e.nfc)) SH.refs.push({ p: rel ? rel + '/' + e.nfc : e.nfc, path: raw + '/' + e.name, name: e.nfc });
      }
    }
    await walk(A + '/레퍼런스', '', 0);
    books.push({ id: 'icon', type: 'icon', kind: '아이콘', title: '아이콘책', count: iconCount, t: K.thickAsset(iconCount), ht: 236 });
    await scanPixel();
    books.push(pixelBook());
    books.push({ id: 'font', type: 'font', kind: '폰트', title: '폰트책', count: SH.fonts.length, t: K.thickAsset(SH.fonts.length), ht: 228 });
    books.push({ id: 'ref', type: 'ref', kind: '레퍼런스', title: '레퍼런스북', count: SH.refs.length, t: K.thickAsset(SH.refs.length), ht: 244 });
    books.push({ id: 'doodle', type: 'doodle', kind: '낙서', title: '낙서장', count: SH.doodles.length, t: K.thickAsset(SH.doodles.length), ht: 210 });
    SH.skillErr = '';
    if (SKU() && !pub()) {
      try { const r = await SKU().scanShelf(SH.handle); r.works.forEach((w) => books.push(w)); if (r.skill) books.push(r.skill); else SH.skillErr = SKU().S.err; } catch (e) { SH.skillErr = String(e && e.message || e); }
    }
    SH.books = books;
    SH.loaded = true;
    loadAa();
  }
  async function scanPixel() {
    const dir = A + '/픽셀', files = [];
    for (const f of (await list(dir)).filter((x) => x.kind === 'file' && PX() && PX().parseFile(x.nfc))) {
      let t = null; try { t = await FS.readText(SH.handle, dir + '/' + f.name); } catch (e) { t = null; }
      files.push({ file: f.name, text: t ? t.text : null, lastModified: t ? t.lastModified : 0 });
    }
    const groups = PX() ? PX().sketchGroups(files) : [];
    let latest = null;
    groups.forEach((g) => g.vers.forEach((v) => { if (!v.error && (!latest || v.date > latest.date || (v.date === latest.date && v.t >= latest.t))) latest = v; }));
    SH.pixel = { groups, latest };
  }
  function pixelBook() { const n = SH.pixel.groups.length; return { id: 'pixel', type: 'pixel', kind: '픽셀', title: '픽셀 공방', count: n, t: K.thickAsset(n), ht: 226 }; }
  function markPixelDirty() { SH.pixelDirty = true; }
  async function refreshPixel() {
    if (!SH.loaded || !SH.handle) return;
    await scanPixel(); SH.pixelDirty = false;
    const i = SH.books.findIndex((b) => b.id === 'pixel'); if (i >= 0) SH.books[i] = pixelBook();
    if (SH.view === 'book' && SH.bk && SH.bk.id === 'pixel') { SH.bk = SH.books[i]; await buildPages(SH.bk); renderBook(); } else if (SH.el && SH.view === 'shelf') drawCase();
  }
  async function openPixel(key) {
    await ensureLoaded(SH.handle);
    await refreshPixel();
    if (!SH.el.querySelector('.sf-book')) renderShelf();
    const gi = SH.pixel.groups.findIndex((g) => g.key === key);
    const ok = await openBook('pixel', { page: gi >= 0 ? Math.floor(gi / PX().PER_PAGE) : 0 });
    SH.pxSel = key; SH.pz = null; renderBook();
    const f = SH.el.querySelector('.sk-slot[data-sk="' + cssEsc(key) + '"]'); if (f) f.focus({ preventScroll: true });
    return ok;
  }
  function ensureLoaded(handle) {
    if (handle && handle !== SH.handle) { SH.handle = handle; SH.loaded = false; SH.loadP = null; }
    if (SH.loaded) return Promise.resolve();
    if (!SH.loadP) SH.loadP = scan().catch((e) => { SH.loadErr = e; SH.loadP = null; throw e; });
    return SH.loadP;
  }
  async function reload() { SH.loaded = false; SH.loadP = null; releaseAll(); await ensureLoaded(SH.handle); }

  async function loadFont(f) {
    if (noFontFiles()) return;
    const st = SH.fontState[f.path];
    if (st) return st.p;
    const s = SH.fontState[f.path] = { ok: null };
    s.p = (async () => {
      try {
        const blob = await FS.readBlob(SH.handle, f.path);
        const face = new FontFace(f.fam, await blob.arrayBuffer());
        await face.load(); document.fonts.add(face); s.ok = true;
      } catch (e) { s.ok = false; s.err = String(e && e.message || e); }
    })();
    return s.p;
  }
  async function loadAa() {
    const f = SH.fonts.find((x) => x.name === 'Coolvetica Rg');
    if (!f || SH.aaFamily || noFontFiles()) return;
    await loadFont(f);
    if (SH.fontState[f.path].ok) { SH.aaFamily = f.fam; const a = document.querySelectorAll('#shelf .sf-aa, .sh-mini .sf-aa'); a.forEach((x) => { x.style.fontFamily = '"' + f.fam + '", var(--font)'; }); }
  }

  const isData = (b) => b.type === 'data';
  function hitsOf(b, q) {
    if (!q) return 0;
    if (isData(b)) return K.countHits(b.file, q) + (b.bytes > 1048576 ? K.countHits(b.tagLine, q) : K.countHits(b.text, q));
    if (b.type === 'icon') return SH.icons.styles.reduce((n, s) => n + SH.icons.entries[s].filter((e) => K.hasHit(e.base, q)).length, 0);
    if (b.type === 'font') return SH.fonts.filter((f) => K.hasHit(f.name, q)).length;
    if (b.type === 'ref') return SH.refs.filter((r) => K.hasHit(r.p, q)).length;
    if (b.type === 'doodle') return SH.doodles.filter((d) => K.hasHit(d.name, q)).length;
    if (b.type === 'pixel') return SH.pixel.groups.filter((g) => K.hasHit(g.name, q)).length;
    if ((b.type === 'work' || b.type === 'skill') && SKU()) return SKU().hits(b, q);
    return 0;
  }
  const PX_COMBO = () => (root.POToolsUI && root.POToolsUI.icon ? root.POToolsUI.icon('combo', 2) : '');
  function spine(b, o) {
    const col = colOf(b), binder = K.isBinder(b);
    const body = binder ? K.BINDER : col;
    const st = '--t:' + b.t + 'px;--ht:' + (b.ht || 224) + 'px;--c:' + body.c + ';--sh:' + body.sh + ';--hi:' + body.hi + (binder ? ';--tc:' + col.c + ';--tsh:' + col.sh : '');
    let inner;
    if (b.type === 'work' || b.type === 'skill') {
      const wst = '--t:' + b.t + 'px;--ht:' + b.ht + 'px;' + (b.type === 'work' ? '--c:' + K.BINDER.c + ';--sh:' + K.BINDER.sh + ';--hi:' + K.BINDER.hi + ';--tc:' + col.c + ';--tsh:' + col.sh : '--c:' + col.c + ';--sh:' + col.sh + ';--hi:' + col.hi);
      const lab = SKU().spineLabel(b) + (o.flag ? ', 찾은 곳 ' + o.flag : '');
      return '<button class="sf-bk ' + (b.type === 'work' ? 'k-binder k-work' : 'k-skill') + '" style="' + wst + '" data-id="' + esc(b.id) + '" tabindex="-1" aria-label="' + esc(lab) + '" title="' + esc(b.type === 'work' ? lab : b.title) + '">' + SKU().spineHtml(b) +
        (o.flag ? '<span class="flag">' + o.flag + '</span>' : '') + (o.ribbon ? '<span class="ribbon" aria-hidden="true"></span>' : '') + '</button>';
    }
    if (binder) inner = '<i class="cap"></i><span class="pocket"><span class="ti">' + esc(b.tool || b.title) + '</span>' + (b.tool ? '<span class="tl">' + esc(b.title) + '</span>' : '') + '</span><i class="hole"></i><span class="ft">' + esc(b.ver) + '</span>';
    else if (isData(b)) inner = '<i class="band t"></i><i class="band b"></i>' + (b.combo ? '<span class="sf-cbic">' + PX_COMBO() + '</span>' : '') + '<span class="sf-lb' + (b.combo ? ' cb' : '') + '"><span class="ti">' + esc(b.title) + '</span><span class="tl">' + esc(b.tool) + '</span></span><span class="ft">' + esc(b.ver) + '</span>';
    else if (b.type === 'font') inner = '<i class="band t"></i><i class="band b"></i><span class="sf-aa"' + (SH.aaFamily && !noFontFiles() ? ' style="font-family:&quot;' + SH.aaFamily + '&quot;,var(--font)"' : '') + '>Aa</span><span class="sf-lb"><span class="ti">' + b.title + '</span></span><span class="ft">' + b.count + '</span>';
    else if (b.type === 'icon') inner = '<i class="band t" style="top:10px"></i><i class="band b"></i><span class="emb">' + '<i></i>'.repeat(9) + '</span><span class="sf-lb"><span class="ti">' + b.title + '</span></span><span class="ft">' + b.count + '</span>';
    else if (b.type === 'pixel') {
      const L = SH.pixel.latest, win = b.t >= 52 ? 36 : 26;
      inner = '<i class="px-band"></i>' + (L && L.grid ? '<span class="px-win" style="width:' + win + 'px;height:' + win + 'px;margin-left:' + (-(win / 2) - 7) + 'px"><canvas data-skc="' + esc(L.file) + '" data-k="' + Math.max(1, Math.floor((win - 4) / L.grid.n)) + '"></canvas></span>' : '') +
        '<span class="sf-lb"><span class="ti">' + b.title + '</span>' + (b.count ? '' : '<span class="tl">비어 있음</span>') + '</span><span class="ft">' + b.count + '</span>';
    }
    else if (b.type === 'ref') inner = '<i class="tape a"></i><i class="tape b"></i><span class="sf-lb"><span class="ti">' + b.title + '</span></span><span class="ft">' + b.count + '</span>';
    else inner = '<i class="coil"></i><span class="sf-lb"><span class="ti">' + b.title + '</span>' + (b.count ? '' : '<span class="tl">비어 있음</span>') + '</span><span class="ft">' + b.count + '</span>';
    const label = b.title + (b.tool ? ', ' + b.tool + ' ' + b.ver : '') + (b.combo ? ', 조합틀' : '') + (b.count !== undefined ? ', ' + b.count + '개' : '') + (o.flag ? ', 찾은 곳 ' + o.flag : '');
    return '<button class="sf-bk k-' + (binder ? 'binder' : isData(b) ? 'data' : b.type) + (b.count === 0 ? ' dim' : '') + (b.type === 'pixel' && !(SH.pixel.latest && SH.pixel.latest.grid) ? ' empty' : '') + '" style="' + st + '" data-id="' + esc(b.id) + '" tabindex="-1" aria-label="' + esc(label) + '" title="' + esc(b.file || b.title) + '">' + inner +
      (o.flag ? '<span class="flag">' + o.flag + '</span>' : '') + (o.ribbon ? '<span class="ribbon" aria-hidden="true"></span>' : '') + '</button>';
  }
  function shelfHtml() {
    const kinds = K.KINDS.filter((k) => !pub() || (k !== '작업지시서' && k !== '스킬')).map((k) => '<option value="' + k + '"' + (SH.kind === k ? ' selected' : '') + '>' + k + ' ' + SH.books.filter((b) => b.kind === k).length + '권</option>').join('');
    return '<div class="sf-head"><h2>자료 보관<small id="sf-count">' + SH.books.length + '권</small></h2>' +
      '<div class="sf-find" role="search"><select id="sf-kind" aria-label="종류"><option value=""' + (SH.kind ? '' : ' selected') + '>전체 ' + SH.books.length + '권</option>' + kinds + '</select>' +
      '<input id="sf-q" type="search" placeholder="이름, 태그, 본문에서 찾기" aria-label="찾기" value="' + esc(SH.q) + '"><kbd>/</kbd></div></div>' +
      '<div class="sf-sub"><p class="sf-hint" id="sf-hint"></p><div class="sf-tools" id="sf-tools" role="group" aria-label="도구"></div></div><div class="sf-case" id="sf-case"></div>';
  }
  function renderShelf(keepFocus) {
    const el = SH.el; if (!el) return;
    SH.view = 'shelf';
    if (!el.querySelector('#sf-case')) {
      el.innerHTML = '<section class="sf-shelf">' + shelfHtml() + '</section><section class="sf-book" hidden></section>';
      $('sf-kind').addEventListener('change', () => { SH.kind = $('sf-kind').value; store.set('po.shelf.kind', SH.kind); drawCase(); });
      $('sf-q').addEventListener('input', () => { SH.q = K.nfc($('sf-q').value); drawCase(); });
      $('sf-tools').addEventListener('click', (e) => {
        const t = e.target.closest('[data-tool]'); if (!t) return;
        SH.tool = t.dataset.tool && t.dataset.tool !== SH.tool ? t.dataset.tool : '';
        store.set('po.shelf.tool', SH.tool); drawCase();
        const on = $('sf-tools').querySelector('[data-tool="' + cssEsc(SH.tool) + '"]') || $('sf-tools').querySelector('.sf-tool'); if (on) on.focus();
      });
    }
    el.querySelector('.sf-shelf').hidden = false; el.querySelector('.sf-book').hidden = true;
    el.classList.remove('open');
    drawCase();
    if (keepFocus) { const s = el.querySelector('.sf-bk[data-id="' + cssEsc(keepFocus) + '"]'); if (s) s.focus(); }
  }
  const cssEsc = (s) => (root.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));
  function drawCase() {
    const cs = $('sf-case'); if (!cs) return;
    const q = SH.q.trim();
    $('sf-hint').innerHTML = q ? '깃발 숫자는 찾은 곳의 수예요. 책을 펼치면 처음 찾은 쪽이 열려요.' : '40_자산 폴더의 파일을 그대로 읽어요. 책을 눌러 펼치고 <b>←</b> <b>→</b>로 넘겨요.';
    const dataAll = SH.books.filter(isData).slice().sort(K.toolCmp);
    const tools = [];
    dataAll.forEach((b) => { const k = K.toolKey(b); const t = tools.find((x) => x.k === k); if (t) t.n++; else tools.push({ k, n: 1, col: K.toolCol(b) }); });
    if (SH.tool && !tools.some((t) => t.k === SH.tool)) { SH.tool = ''; store.set('po.shelf.tool', ''); }
    const tb = $('sf-tools');
    if (tb) tb.innerHTML = tools.map((t) => '<button class="sf-tool" aria-pressed="' + (SH.tool === t.k) + '" data-tool="' + esc(t.k) + '" style="--c:' + t.col.c + ';--sh:' + t.col.sh + '"><i></i>' + esc(t.k === K.NO_TOOL ? '도구 없음' : t.k) + '<small>' + t.n + '</small></button>').join('') +
      (SH.tool ? '<button class="clear" data-tool="">전체 보기</button>' : '');
    let lst = SH.books.filter((b) => (!SH.kind || b.kind === SH.kind) && (!SH.tool || (isData(b) && K.toolKey(b) === SH.tool)));
    const cnt = $('sf-count'); if (cnt) cnt.textContent = (SH.tool ? lst.length : SH.books.length) + '권';
    const flags = {};
    if (q) { lst = lst.filter((b) => (flags[b.id] = hitsOf(b, q)) > 0); }
    if (!lst.length) {
      cs.innerHTML = q
        ? '<div class="sf-empty"><p>‘' + esc(q) + '’가 들어간 책이 없어요.</p><p class="sub">이름, 태그, 본문, 아이콘·폰트·레퍼런스 파일 이름에서 찾았어요.</p></div>'
        : '<div class="sf-empty"><p>' + esc(SH.kind) + ' 책이 아직 없어요.</p><p class="sub">' + esc(emptyWhere(SH.kind)) + '</p></div>';
      return;
    }
    const width = Math.max(200, cs.clientWidth - 52 - 16);
    cs.innerHTML = caseHtml(lst, flags, width, !!(SH.kind || SH.tool || q));
    finishCase(cs, (id) => openBook(id, { q: SH.q.trim() }));
  }
  function caseHtml(lst, flags, width, filtering) {
    const last = store.get('po.shelf.last', null);
    let html = '';
    K.TIER_ORDER.forEach((tier) => {
      const inTier = lst.filter((b) => K.tierOf(b) === tier);
      const tierAll = SH.books.filter((b) => K.tierOf(b) === tier).length;
      if (!inTier.length && filtering) return;
      const items = [];
      const dataB = inTier.filter(isData).sort(K.toolCmp), restB = inTier.filter((b) => !isData(b));
      dataB.forEach((b, i) => {
        if (i && K.toolKey(b) !== K.toolKey(dataB[i - 1])) items.push({ w: 9, html: '<span class="sf-gap" aria-hidden="true"></span>' });
        items.push({ w: b.t + 3, html: spine(b, { flag: flags[b.id], ribbon: b.id === last }) });
      });
      if (tier === 'work') {
        const workB = restB.filter((b) => b.type === 'work'), skillB = restB.filter((b) => b.type !== 'work');
        if (!dataB.length && !workB.length && !filtering) items.push({ w: 213, html: '<div class="sf-ghost wide"><div><span>업무 효율화 책이 아직 없어요.</span><br><small>40_자산/자료/워크플로우/ 에 md 파일을 넣으면 바인더로 꽂혀요.</small></div></div>' });
        if (dataB.length && workB.length) items.push({ w: 9, html: '<span class="sf-gap" aria-hidden="true"></span>' });
        workB.forEach((b) => items.push({ w: b.t + 3, html: spine(b, { flag: flags[b.id], ribbon: b.id === last }) }));
        if (!filtering) items.push({ w: 57, html: '<span class="sf-bookend" aria-hidden="true"></span>' });
        skillB.forEach((b) => items.push({ w: b.t + 3, html: spine(b, { flag: flags[b.id], ribbon: b.id === last }) }));
        if (!filtering && !skillB.length && !pub()) items.push({ w: 49, html: '<div class="sf-ghost" title="' + esc(SH.skillErr || '스킬표.json 을 읽지 못했어요') + '"><span>스킬책 자리</span><small>스킬표 없음</small></div>' });
      } else {
        if (dataB.length && restB.length) items.push({ w: 57, html: '<span class="sf-bookend" aria-hidden="true"></span>' });
        restB.forEach((b) => items.push({ w: b.t + 3, html: spine(b, { flag: flags[b.id], ribbon: b.id === last }) }));
      }
      const rows = [[]]; let x = 0;
      items.forEach((it) => { if (x + it.w > width && rows[rows.length - 1].length) { rows.push([]); x = 0; } rows[rows.length - 1].push(it.html); x += it.w; });
      const plate = '<span class="sf-plate">' + K.TIER_NAME[tier] + '<small>' + (filtering ? inTier.length + ' / ' + tierAll : tierAll) + '권</small></span>';
      html += '<div class="sf-tier ' + tier + '" role="group" aria-label="' + K.TIER_NAME[tier] + '">' +
        rows.map((r, i) => '<div class="sf-row">' + r.join('') + (i === rows.length - 1 ? plate : '') + '</div>').join('') + '</div>';
    });
    return html;
  }
  function finishCase(cs, onOpen) {
    const last = store.get('po.shelf.last', null);
    cs.querySelectorAll('.sf-bk.k-data').forEach((s) => {
      const b = SH.books.find((x) => x.id === s.dataset.id); if (!b) return;
      if (!b.htMeasured) {
        const ti = s.querySelector('.ti'), tl = s.querySelector('.tl');
        const need = 9 + ti.scrollHeight + 8 + (tl && tl.textContent ? tl.scrollHeight : 0) + 9;
        b.ht = Math.max(224, Math.ceil(26 + (b.combo ? 18 : 0) + need + 34)) + (K.fnv(b.file) % 3) * 6;
        b.htMeasured = true;
      }
      s.style.setProperty('--ht', b.ht + 'px');
    });
    paintPixels(cs);
    const spines = [...cs.querySelectorAll('.sf-bk')];
    const f = spines.find((s) => s.dataset.id === SH.focusSpine) || spines.find((s) => s.dataset.id === last) || spines[0];
    if (f) f.tabIndex = 0;
    spines.forEach((s) => {
      s.addEventListener('click', () => onOpen(s.dataset.id));
      s.addEventListener('focus', () => { spines.forEach((o) => { o.tabIndex = o === s ? 0 : -1; }); SH.focusSpine = s.dataset.id; });
    });
  }
  function emptyWhere(kind) {
    return { 프롬프트: '40_자산/자료/프롬프트/ 에 md 파일을 넣으면 여기 꽂혀요.', 워크플로우: '40_자산/자료/워크플로우/ 에 md 파일을 넣으면 여기 꽂혀요.',
      아이콘: '40_자산/아이콘/(스타일)/ 에 그림을 넣으면 여기 꽂혀요.', 폰트: '40_자산/폰트/영문/ · 한글/ 에 폰트를 넣으면 여기 꽂혀요.',
      낙서: '40_자산/낙서/ 에 그림을 넣으면 여기 꽂혀요.', 레퍼런스: '40_자산/레퍼런스/ 에 그림을 넣으면 여기 꽂혀요.', 픽셀: (pub() ? '직원 카드 탭의 [픽셀 공방]' : '무늬 카드 [픽셀 공방]') + '에서 그리고 저장하면 꽂혀요.',
      작업지시서: '00_운영/정리·10_프로젝트/01_진행/강의 의 작업지시서 4개를 원본 자리에서 읽어요.', 스킬: '00_운영/도구/스킬표.json 을 읽으면 스킬책이 꽂혀요.' }[kind] || '';
  }

  const pageSize = () => (root.innerHeight < 720 ? { w: 360, h: 486 } : { w: 400, h: 540 });
  const per = () => (($('main') || document.body).clientWidth < 1000 ? 1 : 2);
  const navBtn = (d, dis) => '<button class="sf-nav ' + (d < 0 ? 'prev' : 'next') + '" aria-label="' + (d < 0 ? '이전 쪽' : '다음 쪽') + '"' +
    ' aria-keyshortcuts="' + (d < 0 ? 'ArrowLeft' : 'ArrowRight') + '" title="' + (d < 0 ? '이전 쪽 (←)' : '다음 쪽 (→)') + '"' + (dis ? ' disabled' : '') + '>' + (d < 0 ? '‹' : '›') + '</button>';
  function flashNav(d, ms) {
    const b = SH.el && SH.el.querySelector('.sf-nav.' + (d > 0 ? 'next' : 'prev')); if (!b) return;
    b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), ms);
  }
  function layoutKey() { const p = pageSize(); return per() + ':' + p.w; }

  async function openBook(id, opt) {
    opt = opt || {};
    const b = SH.books.find((x) => x.id === id); if (!b) return false;
    releaseAll();
    SH.bk = b; SH.sel = null; SH.zoom = null; SH.dir = 1; SH.q0 = K.nfc(opt.q || '').trim();
    SH.view = 'book'; SH.opening = true; SH.focusSpine = id;
    store.set('po.shelf.last', id);
    showBookShell('펼치는 중…');
    const myOpen = SH.openSeq = (SH.openSeq || 0) + 1;
    await buildPages(b);
    if (myOpen !== SH.openSeq) return false;
    SH.opening = false;
    let page = null;
    if (opt.page != null) page = opt.page;
    else if (SH.q0) page = hitPage(SH.q0);
    if (page == null) { const s = store.get('po.shelf.page.' + id, null); if (typeof s === 'number' && s < SH.pages.length) page = s; }
    SH.spread = K.spreadOf(Math.max(0, page || 0), per());
    if (opt.ch) { const c = SH.chapters.find((x) => x.name === opt.ch); if (c) SH.spread = K.spreadOf(c.page, per()); }
    if (opt.sel) SH.sel = opt.sel;
    renderBook();
    const nav = SH.el.querySelector('.sf-book .sf-close'); if (nav && opt.focus !== false) nav.focus({ preventScroll: true });
    return true;
  }
  function showBookShell(msg) {
    const el = SH.el; if (!el.querySelector('.sf-book')) renderShelf();
    el.querySelector('.sf-shelf').hidden = true;
    const v = el.querySelector('.sf-book'); v.hidden = false; el.classList.add('open');
    v.innerHTML = '<p class="sf-wait">' + esc(msg) + '</p>';
  }
  async function buildPages(b) {
    SH.layout = layoutKey();
    const P = pageSize();
    SH.chapters = []; SH.pages = [];
    if (isData(b)) {
      b.parsed = b.parsed || K.parseData(b.text);
      const pre = [];
      if (b.combo) {
        b.cr = CC.parseCombo(b.text);
        if (b.cr.template !== null) { pre.push({ type: 'combo', side: 'L' }, { type: 'combo', side: 'R' }); }
      }
      const text = paginate(b, P);
      SH.pages = pre.concat([{ type: 'title' }], text.map((pcs) => ({ type: 'text', pcs })));
      SH.rawStart = pre.length;
      if (pre.length) SH.chapters = [{ name: '조합', page: 0 }, { name: '원문', page: pre.length }];
    } else if (b.type === 'icon') {
      SH.pages = K.iconPages(SH.icons.styles, SH.icons.entries);
      SH.icons.styles.forEach((s) => { const i = SH.pages.findIndex((p) => p.style === s); if (i >= 0) SH.chapters.push({ name: s, page: i }); });
    } else if (b.type === 'font') {
      const rowsPer = Math.max(1, Math.floor((P.h - 56 - 30) / 62));
      ['영문', '한글'].forEach((lang) => {
        const fs = SH.fonts.filter((f) => f.lang === lang);
        const first = SH.pages.length;
        if (!fs.length) SH.pages.push({ type: 'font', lang, fonts: [], part: 1 });
        for (let i = 0; i < fs.length; i += rowsPer) SH.pages.push({ type: 'font', lang, fonts: fs.slice(i, i + rowsPer), part: i / rowsPer + 1 });
        SH.chapters.push({ name: lang, page: first });
      });
      await Promise.all(SH.fonts.map(loadFont));
    } else if (b.type === 'doodle') {
      SH.pages = SH.doodles.map((d) => ({ type: 'doodle', d }));
    } else if (b.type === 'pixel') {
      if (SH.pixelDirty) { await scanPixel(); SH.pixelDirty = false; }
      SH.pages = SH.pixel.groups.length ? PX().sketchPages(SH.pixel.groups) : [];
    } else if ((b.type === 'work' || b.type === 'skill') && SKU()) {
      SH.pages = SKU().buildPages(b);
    } else if (b.type === 'ref') {
      await refDims();
      SH.pages = K.refPages(SH.refs);
      const seen = {}; SH.pages.forEach((p, i) => { if (!(p.ch in seen)) { seen[p.ch] = 1; SH.chapters.push({ name: p.ch, page: i }); } });
    }
  }
  const DIMS = new Map();
  async function dimsOf(path) {
    let r = await FS.readBytes(SH.handle, path, 65536);
    const key = path + '|' + r.size + '|' + r.lastModified;
    if (DIMS.has(key)) return DIMS.get(key);
    let d = K.imageSize(r.bytes);
    if (!d && /\.jpe?g$/i.test(path) && r.size > 65536) { r = await FS.readBytes(SH.handle, path, 1048576); d = K.imageSize(r.bytes); }
    DIMS.set(key, d);
    return d;
  }
  async function refDims() {
    await Promise.all(SH.refs.map(async (r) => {
      if (r.w) return;
      let d = null; try { d = await dimsOf(r.path); } catch (e) { d = null; }
      r.w = d ? d.w : 1; r.h = d ? d.h : 1; r.dimFail = !d;
    }));
  }

  function paginate(b, P) {
    const blocks = b.parsed.blocks, q = SH.q0;
    const probe = document.createElement('div');
    probe.className = 'sf-page paper-text'; probe.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;width:' + P.w + 'px;height:' + P.h + 'px';
    probe.innerHTML = '<div class="sf-pin sf-flow"></div>';
    (SH.el || document.body).appendChild(probe);
    const pin = probe.firstChild;
    const fits = () => pin.scrollHeight <= pin.clientHeight + 0.5;
    const pages = []; let cur = [];
    const endPage = () => { while (cur.length && blocks[cur[cur.length - 1].k] === 'DIV') cur.pop(); if (cur.length) pages.push(cur); cur = []; pin.innerHTML = ''; };
    blocks.forEach((blk, k) => {
      if (blk === 'DIV') { if (!cur.length) return; pin.insertAdjacentHTML('beforeend', '<div class="sf-div"></div>'); if (fits()) cur.push({ k }); else endPage(); return; }
      const piece = { k };
      pin.insertAdjacentHTML('beforeend', blockHtml(b, piece, q));
      if (fits()) { cur.push(piece); return; }
      if (cur.length) { endPage(); pin.innerHTML = blockHtml(b, piece, q); if (fits()) { cur.push(piece); return; } }
      const lines = blk.body.split('\n');
      let from = 0, cont = false;
      while (from < lines.length) {
        let lo = from + 1, hi = lines.length, best = from + 1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; pin.innerHTML = blockHtml(b, { k, from, to: mid, cont }, q); if (fits()) { best = mid; lo = mid + 1; } else hi = mid - 1; }
        const pc = { k, from, to: best, cont };
        if (best >= lines.length) { pin.innerHTML = blockHtml(b, pc, q); cur = [pc]; break; }
        pages.push([pc]); from = best; cont = true;
      }
    });
    endPage();
    probe.remove();
    return pages;
  }
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function markHtml(text, q) {
    if (!q) return esc(text);
    const re = new RegExp(reEsc(q), 'gi');
    let out = '', i = 0, m;
    while ((m = re.exec(text))) { out += esc(text.slice(i, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; i = m.index + m[0].length; if (!m[0].length) re.lastIndex++; }
    return out + esc(text.slice(i));
  }
  function blockHtml(b, pc, q) {
    const blk = b.parsed.blocks[pc.k];
    if (blk === 'DIV') return '<div class="sf-div"></div>';
    const body = pc.from == null ? blk.body : blk.body.split('\n').slice(pc.from, pc.to).join('\n');
    let bodyH = markHtml(body, q);
    if (b.combo && (blk.prompt || blk.code)) bodyH = bodyH.replace(/\{\{([^{}\s<]+)\}\}/g, '<b class="sf-slot">{{$1}}</b>');
    const cp = blk.body.trim() ? '<button class="sf-cp" data-copy="' + pc.k + '">복사</button>' : '';
    const cls = 'sf-blk ' + (blk.prompt ? 'prompt' : 'note');
    if (blk.head) return '<div class="' + cls + '"><div class="sf-blk-h"><b>' + markHtml(blk.head + (pc.cont ? ' (이어서)' : ''), q) + '</b>' + cp + '</div>' + (body ? '<div class="sf-blk-b">' + bodyH + '</div>' : '') + '</div>';
    return '<div class="' + cls + ' nohead">' + cp + '<div class="sf-blk-b">' + bodyH + '</div></div>';
  }
  function hitPage(q) {
    const b = SH.bk;
    if (isData(b)) {
      const blocks = b.parsed.blocks;
      const i = SH.pages.findIndex((pg) => pg.type === 'text' && pg.pcs.some((pc) => { const k = blocks[pc.k]; if (k === 'DIV') return false; const body = pc.from == null ? k.body : k.body.split('\n').slice(pc.from, pc.to).join('\n'); return K.hasHit((k.head || '') + '\n' + body, q); }));
      return i >= 0 ? i : SH.pages.findIndex((p) => p.type === 'title');
    }
    if (b.type === 'icon') {
      const i = SH.pages.findIndex((p) => p.items.some((e) => K.hasHit(e.base, q)));
      if (i >= 0) SH.sel = SH.pages[i].items.find((e) => K.hasHit(e.base, q));
      return i >= 0 ? i : null;
    }
    if (b.type === 'font') { const i = SH.pages.findIndex((p) => p.fonts.some((f) => K.hasHit(f.name, q))); return i >= 0 ? i : null; }
    if (b.type === 'ref') { const i = SH.pages.findIndex((p) => p.rows.some((row) => row.some((r) => K.hasHit(r.p, q)))); return i >= 0 ? i : null; }
    if (b.type === 'doodle') { const i = SH.pages.findIndex((p) => K.hasHit(p.d.name, q)); return i >= 0 ? i : null; }
    if (b.type === 'pixel') { const i = SH.pages.findIndex((p) => p.items.some((g) => K.hasHit(g.name, q))); if (i >= 0) SH.pxSel = SH.pages[i].items.find((g) => K.hasHit(g.name, q)).key; return i >= 0 ? i : null; }
    if (b.type === 'work') { const i = SH.pages.findIndex((pg) => pg.type === 'text' && pg.pcs.some((pc) => { const k = b.parsed.blocks[pc.k]; return k !== 'DIV' && K.hasHit((k.head || '') + '\n' + k.body, q); })); return i >= 0 ? i : (K.hasHit(b.text, q) ? 0 : null); }
    if (b.type === 'skill') { const S = SKU().S; const i = SH.pages.findIndex((p) => { if (p.type !== 'skill') return false; const s = S.table.skills.find((x) => x.id === p.id), u = s && S.usage[s.folder]; return !!s && K.hasHit(s.name + '\n' + s.id + '\n' + (u ? u.what : ''), q); }); return i >= 0 ? i : null; }
    return null;
  }

  function pno(i) {
    const b = SH.bk;
    if (isData(b) && SH.rawStart) return i < SH.rawStart ? '조합' : String(i - SH.rawStart + 1);
    return String(i + 1);
  }
  function pageHtml(i, side) {
    const p = SH.pages[i], b = SH.bk, P = pageSize();
    const paper = 'paper-' + (PAPER[b.kind] || 'text');
    const st = ' style="width:' + P.w + 'px;height:' + P.h + 'px"';
    if (!p) {
      if (b.type === 'pixel') return '<div class="sf-page ' + side + ' ' + paper + '"' + st + '>' + sketchHtml(null, side, i) + (SH.pages.length ? '<span class="sf-pno">' + (i + 1) + '</span>' : '') + '</div>';
      if (b.type === 'doodle' && !SH.pages.length && side === 'L') return '<div class="sf-page L ' + paper + '"' + st + '><div class="sf-dd-empty"><p>낙서장이 비어 있어요</p><span class="sub">이미지를 <code>40_자산/낙서/</code> 에 넣으면<br>한 쪽에 한 장씩 꽂혀요.<br>png, jpg, webp, gif</span></div></div>';
      return '<div class="sf-page ' + side + ' ' + paper + '"' + st + '></div>';
    }
    const num = '<span class="sf-pno">' + pno(i) + '</span>';
    let inner = '';
    if (p.type === 'title') {
      const d = b.parsed;
      inner = '<div class="sf-title"><div class="tool">' + esc(b.tool) + '</div><h1>' + esc(b.title) + '</h1><div class="ver">' + esc(b.ver) + '</div>' +
        (d.lead ? '<p class="lead">' + markHtml(d.lead, SH.q0) + '</p>' : '') + '<div class="sf-tags">' + d.tags.map((t) => '<span>' + markHtml(t, SH.q0) + '</span>').join('') + '</div>' +
        '<div class="meta">' + (b.date ? b.date.slice(0, 4) + '-' + b.date.slice(4, 6) + '-' + b.date.slice(6) + '<br>' : '') + esc(b.rel) + '</div></div>';
      return '<div class="sf-page ' + side + ' ' + paper + '"' + st + '>' + inner + '</div>';
    }
    if (p.type === 'text') inner = '<div class="sf-pin sf-flow">' + p.pcs.map((pc) => blockHtml(b, pc, SH.q0)).join('') + '</div>';
    if (p.type === 'combo') inner = '<div class="sf-pin cb-pin" data-cb="' + (per() === 1 ? 'S' + p.side : p.side) + '"></div>';
    if (p.type === 'icon') {
      inner = '<div class="sf-pin"><div class="sf-phead"><h4>' + esc(p.style) + '<small>' + SH.icons.entries[p.style].length + '개' + (p.parts > 1 ? ' (' + p.part + '/' + p.parts + ')' : '') + '</small></h4>' + (side === 'L' ? '<span class="aside">누르면 다른 스타일 짝</span>' : '') + '</div><div class="sf-ig">' +
        p.items.map((e) => {
          const isSel = SH.sel && SH.sel.style === e.style && SH.sel.base === e.base;
          const isMate = SH.sel && !isSel && SH.sel.key === e.key;
          return '<button class="sf-ic' + (isSel ? ' sel' : '') + (isMate ? ' mate' : '') + '" data-ic="' + esc(e.style + '/' + e.base) + '" aria-pressed="' + isSel + '" title="' + esc(e.style + '/' + e.file) + '">' + canvasHtml(iconNeed(e)) + '<span>' + markHtml(e.base, SH.q0) + '</span>' + (e.gif ? '<i class="gif">GIF</i>' : '') + '</button>';
        }).join('') + '</div></div>';
    }
    if (p.type === 'font') {
      const key = p.lang === '영문' ? 'en' : 'ko';
      const txt = SH.sample[key], changed = txt !== SAMPLE0[key];
      const n = SH.fonts.filter((f) => f.lang === p.lang).length;
      inner = '<div class="sf-pin"><div class="sf-phead"><h4>' + p.lang + '<small>' + n + '개' + '</small></h4><span class="sf-reset-slot" data-lang="' + key + '">' + resetHtml(key, changed) + '</span></div><div class="sf-frows">' +
        p.fonts.map((f) => {
          const s = SH.fontState[f.path] || {};
          const lic = s.ok === false && !noFontFiles() ? '글꼴 파일을 읽지 못함' : (K.licenseFor(SH.licRows, f.file) || '출처.md에 없음');
          return '<div class="sf-fr' + (p.lang === '한글' ? ' ko' : '') + '"><div class="spec" contenteditable="plaintext-only" spellcheck="false" role="textbox" aria-label="' + esc(f.name) + ' 시험 문구" data-lang="' + key + '" style="font-family:' + (s.ok && !noFontFiles() ? '\'' + f.fam + '\',' : '') + 'var(--font)">' + esc(txt) + '</div><div class="meta"><b>' + markHtml(f.name, SH.q0) + '</b><span>' + esc(lic) + '</span></div></div>';
        }).join('') + '</div>' + (noFontFiles() ? '<div class="sf-fnote pub">' + PUBLIC_FONT_NOTE + '</div>' : p.lang === '한글' && n < 3 ? '<div class="sf-fnote">한글 폰트를 40_자산/폰트/한글/ 에 넣으면 이 장에 줄이 붙어요.<br>라이선스는 폰트/출처.md 표에서 읽어요.</div>' : '') + '</div>';
    }
    if (p.type === 'pixel') inner = sketchHtml(p, side, i);
    if (/^(sktoc|skill|workL|workR)$/.test(p.type)) inner = SKU().pageHtml(p, side, i);
    if (p.type === 'doodle') inner = '<figure class="sf-dd">' + canvasHtml(doodleNeed(p.d)) + '<figcaption>' + markHtml(p.d.name, SH.q0) + '</figcaption></figure>';
    if (p.type === 'ref') {
      inner = p.label ? '<span class="sf-sectape">' + esc(p.label) + '</span>' : '';
      K.refLayout(p, P.w, P.h).forEach((g) => { inner += photoHtml(g); });
    }
    return '<div class="sf-page ' + side + ' ' + paper + '"' + st + '>' + inner + num + '</div>';
  }
  const resetHtml = (key, changed) => (changed ? '<button class="sf-linkish" data-reset="' + key + '">처음 문구로</button>' : '<span class="aside">문구를 눌러 바꿀 수 있어요</span>');
  function photoHtml(g) {
    const P = g.P, col = TAPE[P.tapeCol];
    const tapes = P.twoTape
      ? '<i class="tp" style="background:' + col + ';left:-14px;top:2px;transform:rotate(-38deg)"></i><i class="tp" style="background:' + col + ';left:auto;right:-14px;top:2px;transform:rotate(38deg)"></i>'
      : '<i class="tp" style="background:' + col + ';transform:translateX(' + P.tapeX + '%) rotate(' + P.tapeDeg + 'deg)"></i>';
    return '<button class="sf-ph" style="left:' + g.left.toFixed(1) + 'px;top:' + g.top.toFixed(1) + 'px;width:' + g.w.toFixed(1) + 'px;height:' + g.h.toFixed(1) + 'px;transform:rotate(' + P.deg.toFixed(2) + 'deg)" data-zoom="' + esc(g.r.p) + '" title="' + esc(g.r.name) + '" aria-label="' + esc(g.r.name) + ' 크게 보기">' +
      canvasHtml({ id: g.r.path + '|' + Math.round(g.iw) + 'x' + Math.round(g.ih) + '|cover', path: g.r.path, w: g.iw, h: g.ih, fit: 'cover' }) + tapes + '</button>';
  }
  const iconNeed = (e) => ({ id: iconPath(e) + '|40x40|contain', path: iconPath(e), w: 40, h: 40, fit: 'contain' });
  const iconPath = (e, gif) => A + '/아이콘/' + e.styleRaw + '/' + (gif ? e.gifRaw : e.fileRaw);
  function doodleNeed(d) { const P = pageSize(); const w = P.w - 48, h = P.h - 22 - 40 - 24; return { id: d.path + '|' + w + 'x' + h + '|contain', path: d.path, w, h, fit: 'contain' }; }
  function canvasHtml(nd) { return '<canvas class="sf-img" data-img="' + esc(nd.id) + '" style="width:' + nd.w.toFixed(1) + 'px;height:' + nd.h.toFixed(1) + 'px" aria-hidden="true"></canvas>'; }

  const vv = (v) => 'v' + String(v).padStart(2, '0');
  function sketchHtml(p, side, i) {
    const total = SH.pixel.groups.length, single = per() === 1;
    const headL = '<div class="sf-phead"><h4>그린 것<small>' + total + '개</small></h4><span class="aside">' + (total ? '누르면 크게' : '') + (single ? ' · 16·24·32칸' : '') + '</span></div>';
    const headR = '<div class="sf-phead"><h4></h4><span class="aside">16·24·32칸</span></div>';
    const head = side === 'L' || single ? headL : headR;
    if (!total && side === 'L') {
      const desk = !!(root.PODesktop && root.PODesktop.write);
      return '<div class="sf-pin">' + headL + '<div class="sk-empty"><b>픽셀 공방이 비어 있어요</b><p>' + (pub() ? '아래 [그림판 열기]를 눌러 그리고' : '무늬 카드의 [픽셀 공방]에서 그리고') + ' 이름을 붙여 저장하면 여기에 한 칸씩 붙어요.' + (pub() ? '' : ' 그림을 픽셀로 바꿔 시작해도 돼요.') + '</p>' +
        '<div class="acts"><button class="px-main" data-skpaint="1">그림판 열기</button>' + (pub() ? '' : '<button class="px-btn" data-skconv="1"' + (root.PODesktop && root.PODesktop.toolRunJson ? '' : ' disabled title="데스크톱 앱에서만"') + '>그림 → 픽셀</button>') + '</div>' +
        '<small>파일은 40_자산/픽셀/ 에 새로 생겨요.' + (desk ? '' : ' 저장은 데스크톱 앱에서만 돼요.') + '</small></div></div>';
    }
    const items = p ? p.items : [];
    let cells = items.map((g) => {
      const v = g.show, sel = SH.pxSel === g.key || (SH.pz && SH.pz.key === g.key);
      const fresh = root.POPixel && root.POPixel.isJustSaved && root.POPixel.isJustSaved(g.key);
      const pic = v.grid ? '<span class="sz">' + v.grid.n + '</span><canvas data-skc="' + esc(v.file) + '" data-k="' + PX().fitScale(v.grid.n, 72) + '"></canvas>' : '<span class="bad">읽을 수<br>없음</span>';
      return '<button class="sk-slot' + (sel ? ' sel' : '') + '" data-sk="' + esc(g.key) + '" title="' + esc(g.name + ' ' + vv(g.latest.v) + ' · ' + A + '/픽셀/' + g.latest.file) + '" aria-label="' + esc(g.name + ' ' + vv(g.latest.v) + (v.error ? ', 읽을 수 없음' : '') + ', 크게 보기') + '" aria-pressed="' + !!sel + '">' +
        '<span class="win">' + pic + (fresh ? '<span class="fresh">방금</span>' : '') + '</span><span class="nm">' + markHtml(g.name, SH.q0) + '<small>' + vv(g.latest.v) + '</small></span></button>';
    }).join('');
    const isLast = !p || p.from + PX().PER_PAGE >= total;
    if (isLast) cells += '<span class="sk-slot empty" aria-hidden="true"><span class="win"></span></span>'.repeat(PX().PER_PAGE - items.length);
    return '<div class="sf-pin">' + head + '<div class="sk-grid">' + cells + '</div></div>';
  }
  function zoomHtml() {
    const z = SH.pz, g = z && SH.pixel.groups.find((x) => x.key === z.key); if (!g) return '';
    const v = g.vers[z.vi] || g.latest, n = per(), P = pageSize();
    const gi = SH.pixel.groups.indexOf(g), pi = Math.floor(gi / PX().PER_PAGE), onLeft = pi % 2 === 0;
    const left = n === 1 ? 0 : onLeft ? P.w : 0;
    const next = vv(g.latest.v + 1);
    let body;
    if (v.grid) {
      const u = PX().used(v.grid), d = v.date;
      body = '<div class="stage"><canvas data-skc="' + esc(v.file) + '" data-k="' + PX().fitScale(v.grid.n, 272) + '"></canvas></div>' +
        '<div class="meta">' + v.grid.n + ' × ' + v.grid.n + '칸 · ' + u.length + '색 · ' + d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6) + '</div>' +
        '<div class="usedc">' + u.map((x) => '<i style="background:' + x.hex + '" title="' + esc((PX().BY_HEX[x.hex] ? PX().BY_HEX[x.hex].name : '내 색') + ' ' + x.hex) + '"></i>').join('') + '</div>';
    } else body = '<div class="bad">이 판은 읽을 수 없어요.<br>' + esc(v.error || '') + '</div>';
    const vers = g.vers.length > 1 ? '<div class="vers" role="group" aria-label="판">' + g.vers.map((x, i) => '<button data-skv="' + i + '" aria-pressed="' + (x === v) + '">' + (x.grid ? '<canvas data-skc="' + esc(x.file) + '" data-k="' + Math.max(1, Math.floor(32 / x.grid.n)) + '"></canvas>' : '<span>?</span>') + vv(x.v) + '</button>').join('') + '</div>' : '';
    const note = v.asset && v.asset.note ? '<p class="note" title="' + esc(v.asset.note) + '">' + esc(v.asset.note) + '</p>' : '';
    return '<div class="sk-zoom" style="top:12px;left:' + (12 + left) + 'px" role="dialog" aria-label="' + esc(g.name) + ' 크게 보기"><div class="zh"><b title="' + esc(g.name) + '">' + esc(g.name) + '</b><span class="vtag">' + vv(v.v) + '</span><button class="x" data-skclose="1">닫기<kbd>Esc</kbd></button></div>' +
      body + vers + note + '<div class="za"><button class="px-main" data-skopen="1"' + (v.grid ? '' : ' disabled') + '>그림판에서 열기</button><button class="px-btn" data-skcopy="' + esc(A + '/픽셀/' + v.file) + '">경로 복사</button><small>고치면 ' + next + '로<br>새로 저장돼요</small></div></div>';
  }
  function paintPixels(scope) {
    if (!SH.pixel) return;
    const byFile = new Map(); SH.pixel.groups.forEach((g) => g.vers.forEach((v) => { if (v.grid) byFile.set(v.file, v.grid); }));
    scope.querySelectorAll('canvas[data-skc]').forEach((cv) => {
      const g = byFile.get(cv.dataset.skc); if (!g) return;
      const k = +cv.dataset.k || 1, d = root.devicePixelRatio || 1, S = g.n * k;
      cv.style.width = S + 'px'; cv.style.height = S + 'px'; cv.width = Math.round(S * d); cv.height = Math.round(S * d);
      const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.imageSmoothingEnabled = false; x.clearRect(0, 0, S, S);
      for (let i = 0; i < g.n * g.n; i++) { const c = g.c[i]; if (c) { x.fillStyle = c; x.fillRect((i % g.n) * k, Math.floor(i / g.n) * k, k, k); } }
    });
  }
  function chOn(c, a, n) { const i = SH.chapters.indexOf(c); const end = i + 1 < SH.chapters.length ? SH.chapters[i + 1].page - 1 : SH.pages.length - 1; return c.page <= a + n - 1 && end >= a; }
  function bookSub(b) {
    if (isData(b)) {
      const s = [b.tool, b.ver].filter(Boolean).join(' ') + (b.combo ? ' · 조합틀' : '');
      if (b.combo && b.cr && b.cr.template === null) return s + ' · 조합 틀을 읽지 못함 · ## 틀 아래에 ``` 로 감싼 틀이 없어요';
      return s;
    }
    if (b.type === 'icon') return SH.icons.styles.length + '가지 스타일, ' + b.count + '개';
    if (b.type === 'font') return '영문 ' + SH.fonts.filter((f) => f.lang === '영문').length + ', 한글 ' + SH.fonts.filter((f) => f.lang === '한글').length;
    if (b.type === 'ref') return SH.chapters.length + '장, ' + SH.refs.length + '장의 그림';
    if (b.type === 'pixel') return b.count + '개 · 저장한 순';
    if ((b.type === 'work' || b.type === 'skill') && SKU()) return SKU().bookSub(b);
    return SH.pages.length + '장';
  }
  function renderBook() {
    const b = SH.bk; if (!b || SH.opening) return;
    const v = SH.el.querySelector('.sf-book'); if (!v) return;
    if (SH.layout !== layoutKey()) { const a0 = SH.spread * SH.perUsed; SH.opening = true; buildPages(b).then(() => { SH.opening = false; releaseAll(); SH.spread = K.spreadOf(a0 || 0, per()); renderBook(); }); return; }
    const col = frameCol(b), n = per(), P = pageSize();
    SH.perUsed = n;
    const total = SH.pages.length, spreads = Math.max(1, Math.ceil(total / n));
    SH.spread = Math.max(0, Math.min(SH.spread, spreads - 1));
    const a = SH.spread * n;
    if (total) store.set('po.shelf.page.' + b.id, a);
    const spreadW = n === 2 ? P.w * 2 + 24 : P.w + 24;
    v.className = 'sf-book k-' + (isData(b) ? 'data' : b.type) + '-book';
    v.style.cssText = '--c:' + col.c + ';--sh:' + col.sh + ';--hi:' + col.hi + ';--spread-w:' + (spreadW + 120) + 'px';
    let num;
    if (!total) num = '빈 책';
    else if (isData(b) && SH.rawStart && a < SH.rawStart) num = '조합 쪽' + (n === 1 ? ' ' + (a + 1) + '/' + SH.rawStart : '') + ' · 다음 펼침부터 원문 ' + (total - SH.rawStart) + '쪽';
    else if (isData(b) && SH.rawStart) { const o = SH.rawStart; num = (n === 2 && SH.pages[a + 1] ? (a - o + 1) + '–' + (a - o + 2) : (a - o + 1)) + ' / ' + (total - o); }
    else num = (n === 2 && SH.pages[a + 1] ? (a + 1) + '–' + (a + 2) : (a + 1)) + ' / ' + total;
    const isSkill = b.type === 'skill' && SKU();
    if (isSkill) num = SKU().footNum(a, n);
    let slip = '';
    if (b.type === 'icon') slip = '<div class="sf-slip-zone">' + slipHtml(a, n) + '</div>';
    const zoom = b.type === 'pixel' ? zoomHtml() : SH.zoom ? '<div class="sf-zoom" data-unzoom="1" role="dialog" aria-label="크게 보기"><img alt="' + esc(SH.zoom.name) + '"' + (SH.zoomUrl ? ' src="' + SH.zoomUrl + '"' : '') + '><p>' + esc(SH.zoom.name) + '</p><p class="h">누르거나 Esc를 누르면 쪽으로 돌아가요</p></div>' : '';
    v.innerHTML = '<div class="sf-top"><div class="sf-btitle"><span class="sf-chip"></span><h3 title="' + esc(b.file || b.title) + '">' + esc(b.title) + '</h3><span>' + esc(bookSub(b)) + '</span></div>' +
      '<button class="sf-btn sf-close" data-close="1">닫기<kbd>Esc</kbd></button></div>' +
      '<div class="sf-stage">' + navBtn(-1, SH.spread === 0) +
      '<div class="sf-cover"><div class="sf-spread' + (n === 1 ? ' single' : '') + '">' + (n === 2 ? pageHtml(a, 'L') + pageHtml(a + 1, 'R') : pageHtml(a, 'L')) + '</div>' + zoom +
      (isSkill ? SKU().overlay(P, n) + SKU().tabsHtml(a, n) : '') +
      (SH.chapters.length > 1 ? '<div class="sf-tabsix">' + SH.chapters.map((c) => '<button data-page="' + c.page + '" aria-current="' + chOn(c, a, n) + '" title="' + esc(c.name) + '">' + esc(c.name) + '</button>').join('') + '</div>' : '') + '</div>' +
      navBtn(1, SH.spread >= spreads - 1) + '</div>' +
      slip + '<div class="sf-foot"><span class="num">' + num + '</span><span class="keys"><span>← → 넘기기</span><span>Esc 닫기</span>' + (isSkill ? SKU().footKeys() : '') + '</span></div>';
    if (isData(b) && SH.rawStart && root.POCombo) root.POCombo.mountBook(v, b);
    if (b.type === 'pixel') paintPixels(v);
    paint();
    loadVisible();
    if (b.type === 'icon') loadSlip();
  }

  function slipHtml(a, n) {
    if (!SH.sel) return '<div class="sf-slip-hint">아이콘을 누르면 같은 용도의 다른 스타일이 여기 나와요</div>';
    const pi = SH.pages.findIndex((p) => p.type === 'icon' && p.items.some((e) => e.style === SH.sel.style && e.base === SH.sel.base));
    const leftSide = n === 1 || pi % 2 === 0;
    const groups = K.matesOf(SH.icons.styles, SH.icons.entries, SH.sel);
    const cells = groups.map((g) => {
      if (!g.items.length) return '<span class="sf-mt none"><span class="bx">없음</span><small>' + esc(g.style) + '</small></span>';
      return g.items.map((e) => '<button class="sf-mt' + (e.style === SH.sel.style && e.base === SH.sel.base ? ' cur' : '') + '" data-ic="' + esc(e.style + '/' + e.base) + '" title="' + esc(e.style + '/' + e.file) + '"><span class="bx"><img alt="" data-slip="' + esc(e.gif ? iconPath(e, true) : iconPath(e)) + '"></span><small>' + esc(g.style) + (e.base !== e.key ? ' ' + esc(e.base.slice(e.key.length + 1)) : '') + '</small></button>').join('');
    }).join('');
    const mates = groups.reduce((k, g) => k + g.items.filter((e) => !(e.style === SH.sel.style && e.base === SH.sel.base)).length, 0);
    return '<div class="sf-slip" style="' + (leftSide ? 'left:72px' : 'right:72px') + '"><div class="nm"><b>' + esc(SH.sel.key) + '</b><small>' + (mates ? '짝 ' + mates + '개' : '짝 없음') + '</small></div><div class="mates">' + cells + '</div>' +
      '<button class="sf-btn sm" data-copypath="' + esc(A + '/아이콘/' + SH.sel.style + '/' + SH.sel.file) + '">경로 복사</button></div>';
  }
  const SLIP = new Map();
  let slipFor = null;
  async function loadSlip() {
    const key = SH.sel ? SH.sel.key : null;
    if (key !== slipFor) { SLIP.forEach((u) => URL.revokeObjectURL(u)); SLIP.clear(); slipFor = key; }
    const imgs = [...SH.el.querySelectorAll('.sf-slip img[data-slip]')];
    for (const img of imgs) {
      const p = img.dataset.slip;
      if (!SLIP.has(p)) { try { const bl = await FS.readBlob(SH.handle, p); if (slipFor !== key) return; SLIP.set(p, URL.createObjectURL(bl)); SH.decodeLog.push('slip:' + p); } catch (e) { SLIP.set(p, ''); } }
      if (SLIP.get(p)) img.src = SLIP.get(p);
    }
  }

  const IMG = { key: '', spreads: new Map() };
  function spreadNeeds(si) {
    const n = SH.perUsed || per(), out = [];
    for (let i = si * n; i < si * n + n; i++) {
      const p = SH.pages[i]; if (!p) continue;
      if (p.type === 'icon') p.items.forEach((e) => out.push(iconNeed(e)));
      if (p.type === 'doodle') out.push(doodleNeed(p.d));
      if (p.type === 'ref') { const P = pageSize(); K.refLayout(p, P.w, P.h).forEach((g) => out.push({ id: g.r.path + '|' + Math.round(g.iw) + 'x' + Math.round(g.ih) + '|cover', path: g.r.path, w: g.iw, h: g.ih, fit: 'cover' })); }
    }
    return out;
  }
  const hasImages = () => SH.bk && (SH.bk.type === 'icon' || SH.bk.type === 'doodle' || SH.bk.type === 'ref');
  function loadVisible() {
    if (!hasImages()) return;
    const key = SH.bk.id + '|' + layoutKey() + '|' + (root.devicePixelRatio || 1);
    if (IMG.key !== key) { releaseAll(); IMG.key = key; }
    const cur = SH.spread;
    const ent = loadSpread(cur);
    evict(cur);
    ent.p.then(() => {
      if (SH.spread !== cur || IMG.key !== key) return;
      const nx = cur + SH.dir, spreads = Math.ceil(SH.pages.length / (SH.perUsed || per()));
      if (nx < 0 || nx >= spreads) return;
      const idle = root.requestIdleCallback || ((f) => setTimeout(f, 30));
      idle(() => { if (SH.spread === cur && IMG.key === key) { loadSpread(nx); evict(cur); } });
    });
  }
  function loadSpread(si) {
    if (IMG.spreads.has(si)) return IMG.spreads.get(si);
    const ent = { items: new Map(), dead: false, p: null };
    IMG.spreads.set(si, ent);
    ent.p = (async () => {
      for (const nd of spreadNeeds(si)) {
        if (ent.dead) return;
        if (ent.items.has(nd.id)) continue;
        try {
          const bmp = await decode(nd);
          if (ent.dead) { bmp.close(); return; }
          ent.items.set(nd.id, { bmp });
        } catch (e) { ent.items.set(nd.id, { err: true }); }
        if (SH.spread === si) paint();
      }
    })();
    return ent;
  }
  function evict(cur) {
    IMG.spreads.forEach((ent, si) => { if (Math.abs(si - cur) > 1) { ent.dead = true; ent.items.forEach((x) => { if (x.bmp) x.bmp.close(); }); IMG.spreads.delete(si); } });
  }
  function releaseAll() {
    IMG.spreads.forEach((ent) => { ent.dead = true; ent.items.forEach((x) => { if (x.bmp) x.bmp.close(); }); });
    IMG.spreads.clear(); IMG.key = '';
    SLIP.forEach((u) => URL.revokeObjectURL(u)); SLIP.clear(); slipFor = null;
    unzoomUrl();
  }
  async function decode(nd) {
    const dpr = root.devicePixelRatio || 1;
    let d = null; try { d = await dimsOf(nd.path); } catch (e) { d = null; }
    const svg = /\.svg$/i.test(nd.path);
    const blob = await FS.readBlob(SH.handle, nd.path, svg ? 'image/svg+xml' : '');
    SH.decodeLog.push(nd.path);
    let opts;
    if (d) {
      const s = nd.fit === 'cover' ? Math.max(nd.w / d.w, nd.h / d.h) : Math.min(nd.w / d.w, nd.h / d.h);
      const k = Math.min(s * dpr, 1);
      opts = { resizeWidth: Math.max(1, Math.round(d.w * k)), resizeHeight: Math.max(1, Math.round(d.h * k)), resizeQuality: 'high' };
    }
    if (svg) {
      const url = URL.createObjectURL(blob);
      try { const im = new Image(); im.src = url; await im.decode(); return await createImageBitmap(im, opts || { resizeWidth: Math.round(nd.w * dpr), resizeQuality: 'high' }); } finally { URL.revokeObjectURL(url); }
    }
    return opts ? createImageBitmap(blob, opts) : createImageBitmap(blob);
  }
  function findBmp(id) {
    const cur = IMG.spreads.get(SH.spread);
    if (cur && cur.items.has(id)) return cur.items.get(id);
    for (const ent of IMG.spreads.values()) if (ent.items.has(id)) return ent.items.get(id);
    return null;
  }
  function paint() {
    if (!SH.el) return;
    const dpr = root.devicePixelRatio || 1;
    SH.el.querySelectorAll('.sf-book canvas.sf-img').forEach((c) => {
      const x = findBmp(c.dataset.img);
      if (!x) return;
      if (x.err) { if (!c.parentNode.querySelector('.sf-bad')) c.insertAdjacentHTML('afterend', '<span class="sf-bad">열 수 없는 그림</span>'); c.classList.add('bad'); return; }
      if (c.dataset.drawn === '1') return;
      const w = parseFloat(c.style.width), h = parseFloat(c.style.height);
      c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
      const g = c.getContext('2d'), bw = x.bmp.width, bh = x.bmp.height;
      const cover = /\|cover$/.test(c.dataset.img);
      const s = cover ? Math.max(c.width / bw, c.height / bh) : Math.min(c.width / bw, c.height / bh);
      const dw = bw * s, dh = bh * s;
      g.imageSmoothingQuality = 'high';
      g.drawImage(x.bmp, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      c.dataset.drawn = '1'; c.classList.add('ok');
    });
  }

  function unzoomUrl() { if (SH.zoomUrl) { URL.revokeObjectURL(SH.zoomUrl); SH.zoomUrl = null; } }
  async function zoomTo(p) {
    const r = SH.refs.find((x) => x.p === p); if (!r) return;
    unzoomUrl(); SH.zoom = r; renderBook();
    try { const bl = await FS.readBlob(SH.handle, r.path); if (SH.zoom !== r) return; SH.zoomUrl = URL.createObjectURL(bl); const img = SH.el.querySelector('.sf-zoom img'); if (img) img.src = SH.zoomUrl; } catch (e) {  }
    const z = SH.el.querySelector('.sf-zoom'); if (z) { z.tabIndex = -1; z.focus(); }
  }
  function unzoomPixel() { const k = SH.pz && SH.pz.key; SH.pz = null; renderBook(); if (k) { const b = SH.el.querySelector('.sk-slot[data-sk="' + cssEsc(k) + '"]'); if (b) b.focus(); } }
  function unzoom() { const p = SH.zoom && SH.zoom.p; unzoomUrl(); SH.zoom = null; renderBook(); if (p) { const b = SH.el.querySelector('.sf-ph[data-zoom="' + cssEsc(p) + '"]'); if (b) b.focus(); } }
  function zoomStep(d) {
    const ps = [...SH.el.querySelectorAll('.sf-ph[data-zoom]')].map((x) => x.dataset.zoom);
    const i = ps.indexOf(SH.zoom.p); const j = i + d;
    if (j >= 0 && j < ps.length) zoomTo(ps[j]);
  }

  function turn(to) {
    const spreads = Math.max(1, Math.ceil(SH.pages.length / per()));
    const t = Math.max(0, Math.min(spreads - 1, to));
    if (t === SH.spread) return false;
    SH.dir = t > SH.spread ? 1 : -1; SH.spread = t; SH.pz = null;
    if (SKU()) { SKU().S.pick = null; SKU().S.confirm = null; }
    renderBook();
    return true;
  }
  function closeBook() {
    const id = SH.bk && SH.bk.id;
    if (id === 'pixel' && root.POPixel) root.POPixel.clearJustSaved();
    if (SKU()) SKU().closed();
    releaseAll(); SH.bk = null; SH.zoom = null; SH.pz = null; SH.pxSel = null;
    renderShelf(id);
  }
  async function copyText(t) {
    const C = root.POClip; if (C) return C.write(t);
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; }
  }
  function onClick(e) {
    if (SKU() && SKU().S.pick && !e.target.closest('.sk-pick, [data-sa="pick"]')) { SKU().escape(); if (!e.target.closest('button')) return; }
    const t = e.target.closest('button, .sf-zoom'); if (!t || !SH.el.contains(t)) return;
    if (t.dataset.sa && SKU()) { SKU().onClick(t); return; }
    if (t.closest('.cb-pin')) return;
    if (t.dataset.close) return closeBook();
    if (t.dataset.sk) {
      const g = SH.pixel.groups.find((x) => x.key === t.dataset.sk); if (!g) return;
      SH.pz = { key: g.key, vi: g.vers.indexOf(g.show) }; SH.pxSel = g.key; renderBook();
      const x = SH.el.querySelector('.sk-zoom [data-skopen]:not([disabled])') || SH.el.querySelector('.sk-zoom .x'); if (x) x.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.skv) { SH.pz.vi = +t.dataset.skv; renderBook(); const f = SH.el.querySelector('.sk-zoom [data-skv="' + t.dataset.skv + '"]'); if (f) f.focus(); return; }
    if (t.dataset.skclose) return unzoomPixel();
    if (t.dataset.skcopy) { copyText(t.dataset.skcopy); t.textContent = '복사됨'; setTimeout(() => { t.textContent = '경로 복사'; }, 1200); return; }
    if (t.dataset.skopen) {
      const g = SH.pixel.groups.find((x) => x.key === SH.pz.key), v = g && g.vers[SH.pz.vi];
      if (v && v.asset && root.POPixel) root.POPixel.open({ side: 'paint', from: 'shelf', load: { asset: v.asset, name: g.name, note: v.asset.note || '' } });
      return;
    }
    if (t.dataset.skpaint && root.POPixel) return root.POPixel.open({ side: 'paint', from: 'shelf' });
    if (t.dataset.skconv && root.POPixel && !pub()) return root.POPixel.open({ side: 'convert', from: 'shelf' });
    if (t.classList.contains('prev')) return turn(SH.spread - 1);
    if (t.classList.contains('next')) return turn(SH.spread + 1);
    if (t.dataset.page) { const p = +t.dataset.page; SH.dir = 1; SH.spread = K.spreadOf(p, per()); renderBook(); const n = SH.el.querySelector('.sf-tabsix [data-page="' + p + '"]'); if (n) n.focus(); return; }
    if (t.dataset.ic) {
      const i = t.dataset.ic.indexOf('/'); const style = t.dataset.ic.slice(0, i), base = t.dataset.ic.slice(i + 1);
      const en = (SH.icons.entries[style] || []).find((x) => x.base === base); if (!en) return;
      SH.sel = en;
      const pi = SH.pages.findIndex((p) => p.type === 'icon' && p.items.includes(en));
      const ns = K.spreadOf(pi, per()); if (ns !== SH.spread) { SH.dir = ns > SH.spread ? 1 : -1; SH.spread = ns; }
      renderBook();
      const f = SH.el.querySelector('.sf-ic[data-ic="' + cssEsc(t.dataset.ic) + '"]'); if (f) f.focus();
      return;
    }
    if (t.dataset.copy) {
      const blk = SH.bk.parsed.blocks[+t.dataset.copy];
      copyText(blk.body); t.textContent = '복사됨'; t.classList.add('done');
      setTimeout(() => { t.textContent = '복사'; t.classList.remove('done'); }, 1200);
      return;
    }
    if (t.dataset.copypath) { copyText(t.dataset.copypath); t.textContent = '복사됨'; setTimeout(() => { t.textContent = '경로 복사'; }, 1200); return; }
    if (t.dataset.zoom) return zoomTo(t.dataset.zoom);
    if (t.dataset.unzoom) return unzoom();
    if (t.dataset.reset) { const k = t.dataset.reset; SH.sample[k] = SAMPLE0[k]; store.del('po.shelf.sample.' + k); renderBook(); }
  }
  function onInput(e) {
    const el = e.target; if (!el.classList || !el.classList.contains('spec')) return;
    const k = el.dataset.lang;
    SH.sample[k] = el.textContent || ' ';
    store.set('po.shelf.sample.' + k, SH.sample[k]);
    SH.el.querySelectorAll('.spec[data-lang="' + k + '"]').forEach((o) => { if (o !== el) o.textContent = el.textContent; });
    SH.el.querySelectorAll('.sf-reset-slot[data-lang="' + k + '"]').forEach((s) => { s.innerHTML = resetHtml(k, SH.sample[k] !== SAMPLE0[k]); });
  }
  const typingIn = (t) => !!t && (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || t.isContentEditable);
  function onKey(e) {
    if (!SH.el || !SH.el.closest('.screen') || SH.el.closest('.screen').hidden) return;
    if (root.POApp && root.POApp.tab !== 'shelf') return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#tabs')) return;
    const t = e.target, typing = typingIn(t);
    if (SH.view === 'book') {
      if (e.key === 'Escape') {
        if (t && t.dataset && t.dataset.own) return;
        e.preventDefault();
        if (typing) { t.blur(); return; }
        if (SH.zoom) return unzoom();
        if (SH.pz) return unzoomPixel();
        if (SKU() && SKU().escape()) return;
        return closeBook();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && root.POCombo && SH.el.querySelector('.cb-pin')) { e.preventDefault(); root.POCombo.primaryCopy(SH.bk.id); return; }
      if (typing || SH.opening) return;
      if (SKU() && SKU().onKey(e)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const d = e.key === 'ArrowRight' ? 1 : -1; if (SH.zoom) return zoomStep(d); flashNav(d, turn(SH.spread + d) ? 140 : 300); return; }
      if (e.key === 'Home') { e.preventDefault(); return turn(0); }
      if (e.key === 'End') { e.preventDefault(); return turn(1e9); }
      return;
    }
    if (e.key === '/' && !typing) { e.preventDefault(); $('sf-q').focus(); return; }
    if (e.key === 'Escape' && t && t.id === 'sf-q') { e.preventDefault(); t.value = ''; SH.q = ''; drawCase(); t.blur(); const s = SH.el.querySelector('.sf-bk[tabindex="0"]'); if (s) s.focus(); return; }
    if (!typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && t && t.classList && t.classList.contains('sf-bk')) {
      e.preventDefault();
      const bs = [...SH.el.querySelectorAll('.sf-bk')]; const i = bs.indexOf(t);
      const j = Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))); bs[j].focus();
    }
  }
  let resizeT = null;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (!SH.el || SH.el.closest('.screen').hidden) return; if (SH.view === 'book') renderBook(); else drawCase(); }, 150);
  }

  async function render(el, handle, opts) {
    if (SKU()) SKU().bind(SKAPI);
    const demo = !!(opts && opts.demo);
    if (demo !== !!SH.demo) { SH.demo = demo; if (!demo) loadAa(); }
    if (SH.el !== el) {
      SH.el = el;
      el.addEventListener('click', onClick);
      el.addEventListener('input', onInput);
      document.addEventListener('keydown', onKey);
      root.addEventListener('resize', onResize);
    }
    if (handle && handle !== SH.handle) { SH.view = 'shelf'; SH.bk = null; releaseAll(); el.innerHTML = ''; }
    if (!SH.loaded) el.innerHTML = '<p class="sf-wait">책꽂이를 읽는 중…</p>';
    try { await ensureLoaded(handle); } catch (e) {
      el.innerHTML = '<div class="sf-empty"><p>자료를 읽지 못했어요.</p><p class="sub">' + esc(e && e.message || e) + '</p></div>';
      return;
    }
    if (SH.pixelDirty) await refreshPixel();
    if (SH.view === 'book' && SH.bk) { if (!el.querySelector('.sf-book')) { renderShelf(); } if (SH.bk.type === 'font' && !noFontFiles()) await Promise.all(SH.fonts.map(loadFont)); SH.el.querySelector('.sf-shelf').hidden = true; SH.el.querySelector('.sf-book').hidden = false; el.classList.add('open'); renderBook(); return; }
    renderShelf();
  }
  async function openFromOutside(id, opt) {
    await ensureLoaded(SH.handle);
    if (!SH.el.querySelector('.sf-book')) renderShelf();
    return openBook(id, opt);
  }
  const MINI_W = 960;
  function isEmptyShelf() { return !SH.books.length; }
  async function miniLoad(handle) {
    if (SKU()) SKU().bind(SKAPI);
    await ensureLoaded(handle || SH.handle);
    if (SH.pixelDirty) await refreshPixel();
    return { books: SH.books.length, empty: isEmptyShelf() };
  }
  function miniCase(el, onOpen) {
    if (!SH.loaded || isEmptyShelf()) return null;
    el.innerHTML = '<div class="sh-mini-in" style="width:' + MINI_W + 'px"><div class="sf-case">' + caseHtml(SH.books, {}, MINI_W - 52 - 16, false) + '</div></div>';
    const inner = el.firstChild;
    finishCase(inner, onOpen);
    const s = Math.min(1, (el.clientWidth || MINI_W) / MINI_W);
    inner.style.transform = 'scale(' + s + ')';
    el.style.height = Math.ceil(inner.offsetHeight * s) + 'px';
    return { scale: s, books: SH.books.length };
  }
  function comboBooks() { return SH.books.filter((b) => isData(b) && b.combo).slice().sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ko')); }

  const SKAPI = { S: SH, renderBook, paginate, pageSize, per, copyText, openBook: openFromOutside, refreshSpine: () => {} };
  root.POShelf = { render, ensureLoaded, miniLoad, miniCase, isEmptyShelf, reload, openBook: openFromOutside, closeBook, comboBooks, copyText, S: SH, IMG, turn, paginate, refreshPixel, markPixelDirty, openPixel,
    debug: () => ({ spreads: [...IMG.spreads.keys()].sort((a, b) => a - b), bitmaps: [...IMG.spreads.values()].reduce((n, e) => n + [...e.items.values()].filter((x) => x.bmp).length, 0), slip: SLIP.size, zoom: !!SH.zoomUrl, decoded: SH.decodeLog.slice() }) };
})(window);
