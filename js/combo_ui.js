(function (root) {
  'use strict';
  const CC = root.POComboCore, K = root.POShelfCore, store = K.store;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OWN = '__직접';
  const MANY = 16;

  const Clip = root.POClip = root.POClip || {
    last: null,
    async write(t) {
      Clip.last = String(t);
      const D = root.PODesktop;
      for (const f of [D && D.copy, D && D.toolCopy, (t) => navigator.clipboard.writeText(t)]) {
        if (typeof f !== 'function') continue;
        try { await f(Clip.last); return true; } catch (e) {  }
      }
      return false;
    },
  };

  const MK = [0xE000, 0xE001, 0xE002, 0xE003, 0xE004].map((c) => String.fromCharCode(c));
  const MK_FV = new RegExp(MK[0] + '([^' + MK[1] + ']+)' + MK[1] + '([^' + MK[2] + ']*)' + MK[2], 'g');
  const MK_MISS = new RegExp(MK[3] + '([^' + MK[4] + ']*)' + MK[4], 'g');

  const CTRL = {};
  function ctrlFor(b) {
    let c = CTRL[b.id];
    if (!c || c.text !== b.text) c = CTRL[b.id] = new Ctrl(b);
    return c;
  }
  function Ctrl(b) {
    this.id = b.id; this.b = b; this.text = b.text; this.r = b.cr || CC.parseCombo(b.text);
    this.ownOpen = null; this.hover = null; this.copied = new Set(); this.flash = null; this.filter = {}; this.boxes = new Set();
    this.load();
  }
  Ctrl.prototype.reset = function () { this.sel = {}; this.multi = {}; this.own = {}; this.r.fields.forEach((f) => { this.sel[f.name] = f.values.length ? [f.def] : []; }); };
  Ctrl.prototype.load = function () {
    this.reset();
    const s = store.get('po.combo.' + this.id, null); if (!s || typeof s !== 'object') return;
    this.r.fields.forEach((f) => {
      const own = s.own && typeof s.own[f.name] === 'string' ? s.own[f.name] : '';
      if (own) this.own[f.name] = own;
      const multi = !!(s.multi && s.multi[f.name]);
      if (multi) this.multi[f.name] = true;
      const labels = s.sel && Array.isArray(s.sel[f.name]) ? s.sel[f.name] : null;
      if (!labels) return;
      const ok = labels.filter((l) => (l === OWN ? !!own : f.values.some((v) => v.label === l)));
      if (ok.length) this.sel[f.name] = multi ? ok : [ok[0]];
    });
  };
  Ctrl.prototype.save = function () { store.set('po.combo.' + this.id, { sel: this.sel, multi: this.multi, own: this.own }); };
  Ctrl.prototype.valOf = function (f, l) { return l === OWN ? { label: this.own[f.name] || '', value: this.own[f.name] || '', own: true } : f.values.find((v) => v.label === l); };
  Ctrl.prototype.selObj = function () { const o = {}; this.r.fields.forEach((f) => { o[f.name] = (this.sel[f.name] || []).map((l) => this.valOf(f, l)).filter(Boolean); }); return o; };
  Ctrl.prototype.list = function () { return CC.combos(this.r, this.selObj()); };
  Ctrl.prototype.applySaved = function (sv) {
    this.reset();
    for (const k of Object.keys(sv.pick)) {
      const lab = sv.pick[k], f = this.r.fields.find((x) => x.name === k); if (!f) continue;
      if (f.values.some((v) => v.label === lab)) this.sel[k] = [lab]; else { this.own[k] = lab; this.sel[k] = [OWN]; }
    }
  };
  Ctrl.prototype.changed = function () { this.copied.clear(); this.save(); this.paintAll(); };

  Ctrl.prototype.markedHtml = function (pick) {
    const t = CC.tidy((this.r.template || '').replace(CC.FIELD_RE, (m, n) => (n in pick ? (pick[n] === '' ? '' : MK[0] + n + MK[1] + pick[n] + MK[2]) : MK[3] + m + MK[4])));
    return esc(t)
      .replace(MK_FV, (m, n, v) => '<span class="fv' + (this.hover === n ? ' hot' : '') + '" data-fvf="' + n + '">' + v + '</span>')
      .replace(MK_MISS, '<span class="miss">$1</span>')
      .replace(/(^|\s)(--[a-z]+)/g, '$1<span class="opt">$2</span>');
  };
  Ctrl.prototype.savedHtml = function () {
    if (!this.r.saved.length) return '';
    return '<div class="cb-saved"><span class="lab">저장한 조합</span>' + this.r.saved.map((s, i) => '<button data-saved="' + i + '" data-fk="saved:' + i + '" title="' + esc(Object.keys(s.pick).map((k) => k + ': ' + s.pick[k]).join(' / ')) + '">' + esc(s.name) + '</button>').join('') + '</div>';
  };
  Ctrl.prototype.fieldsHtml = function (withDesc) {
    return this.r.fields.map((f) => {
      const multi = !!this.multi[f.name], sel = this.sel[f.name] || [];
      const box = multi ? '<i class="box"></i>' : '';
      const own = this.own[f.name];
      let vals = f.values, filt = '';
      if (f.values.length > MANY) {
        const q = this.filter[f.name] || '';
        vals = f.values.filter((v) => sel.includes(v.label) || !q || K.hasHit(v.label, q)).slice(0, MANY + sel.length);
        filt = '<input class="cb-filter" data-filter="' + esc(f.name) + '" data-fk="flt:' + esc(f.name) + '" placeholder="값 이름 찾기" value="' + esc(q) + '" aria-label="' + esc(f.name) + ' 값 이름 찾기">';
      }
      const chips = vals.map((v) => {
        const bad = v.value === '' && !f.optional;
        return '<button class="cb-vc' + (v.value === '' ? ' empty' : '') + '" aria-pressed="' + sel.includes(v.label) + '" data-f="' + esc(f.name) + '" data-v="' + esc(v.label) + '" data-fk="v:' + esc(f.name) + ':' + esc(v.label) + '"' + (bad ? ' disabled title="빈 값인데 비워도 됨이 없어요"' : ' title="' + esc(v.value || '(빈 값)') + '"') + '>' + box + esc(v.label) + '</button>';
      }).join('') +
        '<button class="cb-vc own" aria-pressed="' + sel.includes(OWN) + '" data-f="' + esc(f.name) + '" data-v="' + OWN + '" data-fk="own:' + esc(f.name) + '">' + box + (own ? '직접: ' + esc(own.length > 12 ? own.slice(0, 11) + '…' : own) : '+ 직접') + '</button>';
      const ownIn = this.ownOpen === f.name ? '<div class="cb-own-in"><input value="' + esc(own || '') + '" placeholder="프롬프트에 그대로 들어갈 말" data-own="' + esc(f.name) + '" data-fk="in:' + esc(f.name) + '" aria-label="' + esc(f.name) + ' 직접 쓰기"><small>Enter 끝</small></div>' : '';
      const ds = (withDesc && f.desc ? '<p class="ds">' + esc(f.desc) + '</p>' : '') + (f.unused ? '<p class="ds bad">틀에서 쓰지 않는 칸이에요</p>' : '');
      return '<div class="cb-fd' + (this.hover === f.name ? ' hot' : '') + (f.unused ? ' bad' : '') + '" data-fd="' + esc(f.name) + '">' +
        '<div class="nm"><b>' + esc(f.name) + '</b><button class="multi" aria-pressed="' + multi + '" data-m="' + esc(f.name) + '" data-fk="m:' + esc(f.name) + '"><i></i>여러 장</button></div>' +
        '<div class="rt">' + ds + filt + '<div class="chips">' + chips + '</div>' + ownIn + '</div></div>';
    }).join('');
  };
  Ctrl.prototype.hintHtml = function () {
    const f = this.r.fields.find((x) => x.name === this.hover);
    return '<div class="cb-hint">' + (f ? '<b>' + esc(f.name) + '</b> ' + esc(f.unused ? '틀에서 쓰지 않는 칸이에요' : f.desc) : '칸을 가리키면 설명이 나오고, 완성 프롬프트에서 그 칸의 말이 노랗게 보여요.') + '</div>';
  };
  const btn = (c, key, label, cls, extra) => '<button class="cb-btn' + (cls ? ' ' + cls : '') + (c.flash === key ? ' done' : '') + '" data-cbcopy="' + key + '" data-fk="copy:' + key + '"' + (extra || '') + '>' + (c.flash === key ? '복사됨' : label) + '</button>';
  Ctrl.prototype.outHtml = function (mode) {
    const c = this.list();
    const counts = this.r.fields.filter((f) => (this.sel[f.name] || []).length > 1).map((f) => f.name + ' ' + this.sel[f.name].length);
    const miss = (this.r.missing || []).map((n) => '<p class="cb-cap">틀의 {{' + esc(n) + '}} 칸이 ## 칸에 없어요</p>').join('');
    if (c.total === 1) {
      const it = c.items[0];
      return '<div class="cb-phead"><h4>완성 프롬프트<small>' + it.text.length + '자</small></h4><span class="aside">굵은 글 = 칸에서 온 말</span></div>' +
        '<div class="cb-out">' + this.markedHtml(it.pick) + '</div>' + miss +
        '<div class="cb-acts">' + btn(this, 'one', '복사', 'main') + btn(this, 'line', '조합 줄 복사') + '</div>' +
        (mode === 'page' ? '<p class="cb-note">고른 칸은 이 기기에 기억해 두고, 다음에 이 책을 펼치면 그대로 나와요. 파일에는 쓰지 않아요. 오래 둘 조합은 [조합 줄 복사] 뒤 틀 파일 <code>## 저장한 조합</code> 아래에 붙여 넣으면 왼쪽 “저장한 조합”에 생겨요.</p>' : '');
    }
    const next = c.items.findIndex((_, i) => !this.copied.has(i));
    return '<div class="cb-phead"><h4>' + c.total + '장 조합<small>' + esc(counts.join(' × ')) + '</small></h4><span class="aside">' + this.copied.size + '장 복사함</span></div>' + miss +
      '<div class="cb-acts" style="margin-top:0"><button class="cb-btn main" data-cbcopy="next" data-fk="copy:next"' + (next < 0 ? ' disabled' : '') + '>' + (next < 0 ? '다 복사했어요' : '차례로 복사 ' + (next + 1) + '/' + c.items.length) + '</button>' +
      btn(this, 'all', '모두 복사') + '<button class="cb-btn" data-cbcopy="reset" data-fk="copy:reset">처음부터</button></div>' +
      (c.total > c.items.length ? '<p class="cb-cap">' + c.total + '장 중 앞 ' + c.items.length + '장만 만들었어요. 칸 값을 줄이면 다 보여요.</p>' : '') +
      '<div class="cb-list">' + c.items.map((it, i) => '<div class="li' + (this.copied.has(i) ? ' got' : '') + (i === next ? ' now' : '') + '"><span class="no">' + (this.copied.has(i) ? '✓' : i + 1) + '</span>' +
        '<div class="tx"><b>' + esc(it.label) + '</b><span>' + esc(it.text) + '</span></div><button class="cp" data-cbcopy="i' + i + '" data-fk="copy:i' + i + '">' + (this.copied.has(i) ? '다시' : '복사') + '</button></div>').join('') + '</div>';
  };
  Ctrl.prototype.part = function (name) {
    const head = '<div class="cb-phead"><h4>칸 고르기</h4><button class="cb-linkish" data-cbreset="1" data-fk="reset">처음 값으로</button></div>';
    if (name === 'L') return head + this.savedHtml() + '<div class="cb-fields">' + this.fieldsHtml(false) + '</div>' + this.hintHtml();
    if (name === 'SL') {
      const c = this.list();
      return head + this.savedHtml() + '<div class="cb-fields">' + this.fieldsHtml(false) + '</div>' +
        '<div class="cb-acts slim">' + (c.total === 1 ? btn(this, 'one', '복사', 'main') : '<button class="cb-btn main" data-cbcopy="next" data-fk="copy:next">차례로 복사</button>') + '<button class="cb-linkish" data-cbnext="1">완성 보기 ›</button></div>';
    }
    if (name === 'R' || name === 'SR') return this.outHtml('page');
    if (name === 'body') return this.savedHtml() + '<div class="cb-fields">' + this.fieldsHtml(true) + '</div>';
    if (name === 'foot') return this.outHtml('drawer') + '<p class="cb-note" style="margin-top:8px">고른 칸은 이 기기에만 기억해요. 파일에는 쓰지 않아요.</p>';
    return '';
  };
  Ctrl.prototype.paint = function (box) {
    const a = document.activeElement;
    const fk = a && box.contains(a) && a.dataset ? a.dataset.fk : null;
    const caret = fk && a.tagName === 'INPUT' ? a.selectionStart : null;
    const scrolls = [...box.querySelectorAll('.cb-fields, .cb-list')].map((x) => x.scrollTop);
    box.querySelectorAll('[data-cb]').forEach((el) => { el.innerHTML = this.part(el.dataset.cb); });
    box.querySelectorAll('.cb-fields, .cb-list').forEach((x, i) => { if (scrolls[i] != null) x.scrollTop = scrolls[i]; });
    if (fk) { const n = box.querySelector('[data-fk="' + (root.CSS && CSS.escape ? CSS.escape(fk) : fk) + '"]'); if (n) { n.focus({ preventScroll: true }); if (caret != null && n.setSelectionRange) n.setSelectionRange(caret, caret); } }
    const fl = box.closest && box.closest('.tl-drawer'); if (fl) fl.classList.toggle('multi', this.list().total > 1);
  };
  Ctrl.prototype.paintAll = function () { [...this.boxes].forEach((b) => { if (b.isConnected && b.__cbId === this.id) this.paint(b); else this.boxes.delete(b); }); };
  Ctrl.prototype.doFlash = function (k) { this.flash = k; this.paintAll(); setTimeout(() => { if (this.flash === k) { this.flash = null; this.paintAll(); } }, 1200); };
  Ctrl.prototype.copy = function (c) {
    const list = this.list();
    if (c === 'one') { Clip.write(list.items[0].text); this.doFlash('one'); }
    else if (c === 'line') { Clip.write(CC.savedLine(this.r, this.selObj())); this.doFlash('line'); }
    else if (c === 'all') { Clip.write(list.items.map((x) => x.text).join('\n\n')); this.doFlash('all'); }
    else if (c === 'reset') { this.copied.clear(); this.paintAll(); }
    else if (c === 'next') { const i = list.items.findIndex((_, j) => !this.copied.has(j)); if (i >= 0) { Clip.write(list.items[i].text); this.copied.add(i); this.paintAll(); } }
    else if (c[0] === 'i') { const i = +c.slice(1); if (list.items[i]) { Clip.write(list.items[i].text); this.copied.add(i); this.paintAll(); } }
  };
  Ctrl.prototype.primary = function () { this.copy(this.list().total === 1 ? 'one' : 'next'); };

  function bind(box, getCtrl) {
    if (box.dataset.cbBound) return;
    box.dataset.cbBound = '1';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !b.closest('[data-cb]')) return;
      const c = getCtrl(); if (!c) return;
      e.stopPropagation();
      if (b.dataset.m) { const n = b.dataset.m; c.multi[n] = !c.multi[n]; if (!c.multi[n]) { c.sel[n] = c.sel[n].slice(0, 1); delete c.multi[n]; } return c.changed(); }
      if (b.dataset.f) {
        const n = b.dataset.f, v = b.dataset.v;
        if (v === OWN && c.ownOpen !== n) {
          c.ownOpen = n; if (c.own[n] && !c.sel[n].includes(OWN)) c.sel[n] = c.multi[n] ? c.sel[n].concat(OWN) : [OWN];
          c.changed(); const i = box.querySelector('[data-own]'); if (i) i.focus(); return;
        }
        if (v === OWN && !c.own[n]) { c.ownOpen = null; return c.changed(); }
        if (c.multi[n]) { const s = c.sel[n]; c.sel[n] = s.includes(v) ? (s.length > 1 ? s.filter((x) => x !== v) : s) : s.concat(v); }
        else c.sel[n] = [v];
        if (v !== OWN) c.ownOpen = null;
        return c.changed();
      }
      if (b.dataset.saved !== undefined) { c.applySaved(c.r.saved[+b.dataset.saved]); c.ownOpen = null; return c.changed(); }
      if (b.dataset.cbreset) { c.reset(); c.ownOpen = null; return c.changed(); }
      if (b.dataset.cbnext) { if (root.POShelf) root.POShelf.turn(root.POShelf.S.spread + 1); return; }
      if (b.dataset.cbcopy) return c.copy(b.dataset.cbcopy);
    });
    box.addEventListener('input', (e) => {
      const c = getCtrl(); if (!c) return;
      const n = e.target.dataset.own, fl = e.target.dataset.filter;
      if (fl) { c.filter[fl] = e.target.value; c.paintAll(); return; }
      if (!n) return;
      c.own[n] = e.target.value;
      if (e.target.value && !c.sel[n].includes(OWN)) c.sel[n] = c.multi[n] ? c.sel[n].concat(OWN) : [OWN];
      if (!e.target.value && c.sel[n].includes(OWN)) { c.sel[n] = c.sel[n].filter((x) => x !== OWN); if (!c.sel[n].length) { const f = c.r.fields.find((x) => x.name === n); c.sel[n] = f.values.length ? [f.def] : []; } }
      c.changed();
    });
    box.addEventListener('keydown', (e) => {
      const c = getCtrl(); if (!c) return;
      const n = e.target.dataset && e.target.dataset.own;
      if (n && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); c.ownOpen = null; c.paintAll(); const o = box.querySelector('[data-fk="own:' + (root.CSS && CSS.escape ? CSS.escape(n) : n) + '"]'); if (o) o.focus(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); c.primary(); }
    });
    box.addEventListener('mouseover', (e) => {
      const c = getCtrl(); if (!c) return;
      if (document.activeElement && document.activeElement.dataset && (document.activeElement.dataset.own || document.activeElement.dataset.filter)) return;
      const el = e.target.closest('[data-fd], .fv'); const n = el ? (el.dataset.fd || el.dataset.fvf) : null;
      if (n !== c.hover) { c.hover = n; c.paintAll(); }
    });
    box.addEventListener('focusin', (e) => {
      const c = getCtrl(); if (!c) return;
      const fd = e.target.closest && e.target.closest('[data-fd]'); const n = fd ? fd.dataset.fd : null;
      if (n && n !== c.hover) { c.hover = n; c.paintAll(); }
    });
  }

  let bookCtrl = null;
  function mountBook(v, b) {
    bookCtrl = ctrlFor(b);
    bookCtrl.hover = null;
    v.__cbId = b.id; bookCtrl.boxes.add(v);
    bind(v, () => (root.POShelf && root.POShelf.S.bk && root.POShelf.S.bk.combo ? ctrlFor(root.POShelf.S.bk) : null));
    bookCtrl.paint(v);
  }
  function primaryCopy(id) { const b = root.POShelf && root.POShelf.S.books.find((x) => x.id === id); if (b) ctrlFor(b).primary(); }

  const D = { id: null };
  async function renderDrawer(h, o) {
    const app = root.POApp, S = root.POShelf;
    const head = (sub) => '<div class="dr-band"></div><div class="dr-h"><div class="ec-portrait">' + (o.ps ? '<img alt=""' + (o.px ? ' class="px"' : '') + ' src="' + esc(o.ps) + '">' : '') + '</div><div class="dr-id"><h3>' + (o.icon || '') + '프롬프트 조합</h3><p>' + esc(sub) + '</p></div><button class="dr-x">닫기 Esc</button></div>';
    const shell = (inner, sub) => { h.innerHTML = '<aside class="tl-drawer cb-drawer" style="--pc:' + o.pc + '" role="dialog" aria-label="프롬프트 조합">' + head(sub) + inner + '</aside>'; h.querySelector('.dr-x').addEventListener('click', o.close); return h.querySelector('.tl-drawer'); };
    if (!app || !app.handle || !S) { shell((root.PO_NM || String)('<div class="dr-list"><p class="dr-empty">당니오피스 폴더를 연결하면 조합 틀을 읽어요.</p></div>'), '40_자산/자료/프롬프트'); return; }
    if (!S.S.loaded) shell('<div class="dr-list"><p class="dr-empty">조합 틀을 읽는 중…</p></div>', '40_자산/자료/프롬프트');
    try { await S.ensureLoaded(app.handle); } catch (e) { shell('<div class="dr-list"><p class="dr-empty">자료를 읽지 못했어요: ' + esc(e.message || e) + '</p></div>', '40_자산/자료/프롬프트'); return; }
    if (!o.isOpen()) return;
    const list = S.comboBooks();
    if (!list.length) {
      const how = root.PO_PUBLIC === true
        ? '첫 줄이 ‘태그: 조합틀’인 md를 사무실 폴더의 40_자산/자료/프롬프트/ 에 두면 여기 나와요. 쓰는 법: ## 틀 아래 ``` 로 감싼 프롬프트에 {{칸 이름}}을 넣고, ## 칸 아래 ### 칸 이름마다 - 값 줄을 적어요.'
        : '태그 줄에 ‘조합틀’을 넣은 md를 40_자산/자료/프롬프트/ 에 두면 여기 나옵니다. 쓰는 법: pixel-office/디자인/20261008_pixel-office_프롬프트조합_v01.md 1장';
      shell('<div class="dr-list"><p class="cb-empty"><b>조합 틀이 아직 없어요.</b><br>' + esc(how) + '</p></div>', '조합 틀 0개 · 40_자산/자료/프롬프트');
      return;
    }
    const lastId = store.get('po.combo.last', null);
    if (!D.id || !list.some((b) => b.id === D.id)) D.id = list.some((b) => b.id === lastId) ? lastId : list[0].id;
    const b = list.find((x) => x.id === D.id);
    const opts = list.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === D.id ? ' selected' : '') + '>' + esc(x.title + ' · ' + [x.tool, x.ver].filter(Boolean).join(' ')) + '</option>').join('');
    b.cr = b.cr || CC.parseCombo(b.text);
    const body = b.cr.template === null
      ? '<div class="dr-list"><p class="dr-warn">조합 틀을 읽지 못함 · ## 틀 아래에 ``` 로 감싼 틀이 없어요</p></div>'
      : '<div class="cb-dbody" data-cb="body"></div><div class="dr-foot cb-dfoot" data-cb="foot"></div>';
    const a = shell('<div class="cb-dtpl"><select aria-label="조합 틀 고르기">' + opts + '</select><button class="cb-btn" data-open-book="1">책에서 열기</button></div>' + body, '조합 틀 ' + list.length + '개 · 40_자산/자료/프롬프트');
    a.querySelector('select').addEventListener('change', (e) => { D.id = e.target.value; store.set('po.combo.last', D.id); renderDrawer(h, o); });
    a.querySelector('[data-open-book]').addEventListener('click', async () => {
      store.set('po.combo.last', D.id);
      o.close(true);
      app.selectTab('shelf');
      await S.openBook(D.id, { page: 0 });
    });
    if (b.cr.template === null) return;
    const c = ctrlFor(b);
    c.hover = null;
    a.__cbId = b.id; c.boxes.add(a);
    bind(a, () => ctrlFor(b));
    c.paint(a);
  }

  root.POCombo = { ctrlFor, mountBook, primaryCopy, renderDrawer, Clip, OWN, D, CTRL };
})(window);
