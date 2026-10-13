(function (root) {
  'use strict';
  const FS = root.POFS, MD = root.POTableMd;
  const IDEAS = '10_프로젝트/아이디어보관함.md', SAVE_MS = 800;
  const IDEA_COLS = ['대기', '검토 중', '보류'];
  const IDEAS_SKELETON = '# 아이디어 보관함\n떠오른 아이디어를 한 줄씩 모아요. 아이디어 칸은 "짧은 제목 — 설명" 모양이면 칠판 포스트잇 제목이 돼요.\n\n| 날짜 | 아이디어 | 종류 | 상태 | 메모 |\n|---|---|---|---|---|\n';

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function parseIdeas(text) {
    return MD.records(MD.firstTable(MD.parse(text))).map((r) => ({ date: r['날짜'] || '', idea: r['아이디어'] || '', kind: r['종류'] || '', status: r['상태'] || '', memo: r['메모'] || '', _row: r._row }));
  }

  const S = { el: null, handle: null, err: '', modal: null, files: {} };
  const writable = () => !!(root.PODesktop && typeof root.PODesktop.write === 'function');
  const now = () => (api.fixedNow ? new Date(api.fixedNow) : new Date());
  function F(path) { return S.files[path] || (S.files[path] = { path, doc: null, lastText: undefined, ver: 0, savedVer: 0, saving: false, timer: null, status: { kind: 'idle' }, err: '' }); }
  const fdirty = (f) => f.ver !== f.savedVer;
  async function loadFile(path) {
    const f = F(path);
    if (f.doc && (fdirty(f) || f.saving || f.status.kind === 'conflict' || f.status.kind === 'error')) return;
    f.err = '';
    try { const r = await FS.readText(S.handle, path); f.lastText = r.text; f.doc = MD.parse(r.text); }
    catch (e) {
      if (path === IDEAS && e && e.name === 'NotFoundError') { f.lastText = null; f.doc = MD.parse(IDEAS_SKELETON); }
      else { f.doc = null; f.err = (e && e.message) || String(e); }
    }
    f.ver = f.savedVer = 0;
  }
  function edit(path, fn) {
    const f = F(path);
    if (!writable() || !f.doc) return;
    fn(f.doc);
    f.ver++; f.status = { kind: 'pending' };
    draw();
    clearTimeout(f.timer); f.timer = setTimeout(() => save(path), SAVE_MS);
  }
  async function save(path, force) {
    const f = F(path);
    clearTimeout(f.timer); f.timer = null;
    if (!fdirty(f) || !writable()) return;
    if (f.saving) { f.timer = setTimeout(() => save(path), SAVE_MS); return; }
    f.saving = true; f.status = { kind: 'saving' }; paintStatus();
    const ver = f.ver;
    try {
      let cur = null;
      try { cur = (await FS.readText(S.handle, path)).text; } catch (e) { if (!(e && e.name === 'NotFoundError')) throw e; }
      if (cur !== f.lastText && force !== true) { f.status = { kind: 'conflict' }; return; }
      const text = MD.serialize(f.doc, MD.localStamp(now()) + ' pixel-office 아이디어 보드');
      if (f.lastText === null) await root.PODesktop.write(path, text, { newOnly: true });
      else await root.PODesktop.write(path, text);
      f.lastText = text; f.savedVer = ver;
      f.status = { kind: 'saved', at: MD.localStamp(now()).slice(11) };
    } catch (e) { f.status = { kind: 'error', msg: (e && e.message) || String(e) }; }
    finally {
      f.saving = false; paintStatus();
      if (fdirty(f) && f.status.kind === 'saved') { f.status = { kind: 'pending' }; paintStatus(); f.timer = setTimeout(() => save(path), SAVE_MS); }
    }
  }
  function statusHtml() {
    if (!writable()) return '<span class="pr-st ro">읽기 전용</span>';
    const s = F(IDEAS).status, n = '아이디어', pa = ' data-path="' + esc(IDEAS) + '"';
    if (s.kind === 'pending') return '<span class="pr-st">' + n + ' 저장 대기…</span>';
    if (s.kind === 'saving') return '<span class="pr-st">' + n + ' 저장 중…</span>';
    if (s.kind === 'saved') return '<span class="pr-st ok">' + n + ' 저장됨 ' + esc(s.at) + '</span>';
    if (s.kind === 'error') return '<span class="pr-st bad">' + n + ' 저장 실패: ' + esc(s.msg) + '</span><button class="pr-btn" data-act="retry"' + pa + '>다시 시도</button>';
    if (s.kind === 'conflict') return '<span class="pr-st bad">' + n + ' 저장 안 됨: 그 사이 파일이 밖에서 바뀌었어요</span>' +
      '<button class="pr-btn" data-act="reload-discard"' + pa + '>파일 다시 읽기 (내 변경 버림)</button><button class="pr-btn" data-act="force"' + pa + '>내 것으로 덮어쓰기</button>';
    return '';
  }
  function paintStatus() { const e = S.el && S.el.querySelector('#pj-status'); if (e) e.innerHTML = statusHtml(); }

  function splitIdea(s) { const m = String(s).match(/^(.+?)\s+[—–]\s+(.+)$/); return m ? { title: m[1], desc: m[2] } : { title: String(s), desc: '' }; }
  function viewHtml(ideas) {
    const it = ideas[S.modal.i]; if (!it) return '';
    const p = splitIdea(it.idea), br = (t) => esc(t).replace(/&lt;br&gt;|\n/g, '<br>');
    return '<div class="pr-modal" role="dialog" aria-modal="true"><div class="pr-mbox id-view c-' + Math.max(0, IDEA_COLS.indexOf(it.status)) + '">' +
      '<h3>' + esc(p.title) + ' <small>' + esc(it.date) + '</small></h3>' +
      '<div class="id-vmeta">' + (it.kind ? '<span class="id-kind">' + esc(it.kind) + '</span>' : '') + '<span class="id-vst">' + esc(it.status) + '</span></div>' +
      (p.desc ? '<p class="id-vdesc">' + br(p.desc) + '</p>' : '') +
      (it.memo ? '<div class="id-vmemo"><span>메모</span><p>' + br(it.memo) + '</p></div>' : '') +
      '<div class="pr-mbtns"><span></span><button type="button" class="pr-btn" data-act="m-cancel">닫기</button>' +
      (writable() ? '<button type="button" class="pr-btn primary" data-act="idea-edit" data-i="' + S.modal.i + '">편집</button>' : '') + '</div></div></div>';
  }

  function ideaBoard(ideas) {
    return '<div class="id-board">' + IDEA_COLS.map((col) => {
      const list = ideas.map((i, k) => Object.assign(i, { _k: k })).filter((i) => i.status === col);
      return '<section class="id-col c-' + IDEA_COLS.indexOf(col) + '"><h4>' + col + ' <b>' + list.length + '</b></h4><div class="id-list">' +
        list.map((i) => '<button class="id-card" data-act="idea-view" data-i="' + i._k + '" title="' + esc(i.idea) + '"><span class="id-kind">' + esc(i.kind) + '</span><p>' + esc(splitIdea(i.idea).title) + '</p></button>').join('') +
        '</div></section>';
    }).join('') + '</div>';
  }

  function modalHtml(ideas) {
    const m = S.modal, v = m.vals || {};
    const f = (k, label, val, extra) => '<label><span>' + label + '</span><input name="' + k + '" data-k="m:' + k + '" value="' + esc(val) + '"' + (extra || '') + '></label>';
    const ta = (k, label, val) => '<label><span>' + label + '</span><textarea name="' + k + '" data-k="m:' + k + '" rows="3">' + esc(val) + '</textarea></label>';
    const sel = (k, label, opts, val) => '<label><span>' + label + '</span><select name="' + k + '" data-k="m:' + k + '">' + opts.concat(opts.includes(val) || !val ? [] : [val]).map((o) => '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></label>';
    const it = m.kind === 'idea' ? ideas[m.i] : { date: MD.localDate(now()), idea: '', kind: '', status: '대기', memo: '' };
    const val = Object.assign({ '아이디어': it.idea, '종류': it.kind, '상태': it.status, '메모': it.memo }, v);
    const kinds = Array.from(new Set(ideas.map((x) => x.kind).filter(Boolean)));
    const body = '<h3>' + (m.kind === 'idea' ? '아이디어 편집' : '아이디어 추가') + ' <small>' + esc(it.date) + '</small></h3>' +
      f('아이디어', '아이디어', val['아이디어'], ' required') +
      f('종류', '종류', val['종류'], ' list="pj-kinds"') + '<datalist id="pj-kinds">' + kinds.map((k) => '<option value="' + esc(k) + '">').join('') + '</datalist>' +
      sel('상태', '상태', IDEA_COLS, val['상태']) + ta('메모', '메모', val['메모']);
    const btns = m.kind === 'idea' ? '<button type="button" class="pr-btn danger" data-act="idea-delete">' + (m.sure ? '한 번 더 누르면 지움' : '삭제') + '</button>' : '';
    return '<div class="pr-modal" role="dialog" aria-modal="true"><form class="pr-mbox" data-l="pj-modal">' + body +
      (m.err ? '<p class="pr-merr">' + esc(m.err) + '</p>' : '') +
      '<div class="pr-mbtns">' + btns + '<span></span><button type="button" class="pr-btn" data-act="m-cancel">취소</button><button class="pr-btn primary">저장</button></div></form></div>';
  }
  function submitModal(form) {
    const m = S.modal, v = (k) => (form.elements[k] ? String(form.elements[k].value).trim() : '');
    const obj = { '아이디어': v('아이디어'), '종류': v('종류'), '상태': v('상태'), '메모': v('메모') };
    if (!obj['아이디어']) { m.err = '아이디어를 적어 주세요.'; m.vals = obj; draw(); return; }
    const ideas = currentIdeas();
    S.modal = null;
    edit(IDEAS, (doc) => {
      const t = MD.firstTable(doc);
      if (m.kind === 'idea') MD.setRecord(t, ideas[m.i]._row, obj);
      else MD.addRecord(t, Object.assign({ '날짜': MD.localDate(now()) }, obj), 0);
    });
  }

  function currentIdeas() { const f = F(IDEAS); return f.doc ? MD.records(MD.firstTable(f.doc)).map((r) => ({ date: r['날짜'] || '', idea: r['아이디어'] || '', kind: r['종류'] || '', status: r['상태'] || '', memo: r['메모'] || '', _row: r._row })) : []; }

  async function render(el, handle) {
    S.el = el; S.handle = handle;
    if (!el.firstChild) el.innerHTML = '<p class="pj-loading">읽는 중…</p>';
    S.err = '';
    await loadFile(IDEAS);
    if (F(IDEAS).err) S.err += '아이디어보관함을 못 읽었어요. ';
    draw();
    const pd = api.pending; api.pending = null;
    if (pd) {
      const ideas = currentIdeas();
      const i = pd.board ? -1 : ideas.findIndex((x) => x.date === pd.date && x.idea === pd.idea);
      if (i >= 0) { S.modal = { kind: 'view', i }; draw(); }
      if (i >= 0 && !writable()) { const c = el.querySelector('.id-card[data-i="' + i + '"]'); if (c) { c.classList.add('id-hl'); if (c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); } }
    }
  }
  function draw() {
    const el = S.el; if (!el) return;
    const ideas = currentIdeas();
    const wait = ideas.filter((i) => i.status === '대기').length;
    el.innerHTML =
      '<div class="pj-head pl-head"><h2>아이디어 보드<span class="id-sub">대기 <b>' + wait + '</b></span></h2><div class="pr-tools"><span id="pj-status">' + statusHtml() + '</span>' +
        (writable() && F(IDEAS).doc ? '<button class="pr-btn" data-act="idea-new">+ 아이디어</button>' : '') + '</div></div>' +
      (writable() ? '' : '<p class="pr-ro">브라우저에서는 읽기만 해요. 아이디어 수정은 데스크톱 앱(Pixel Office)에서 할 수 있어요.</p>') +
      (S.err ? '<p class="pj-err">' + esc(S.err) + '</p>' : '') +
      ideaBoard(ideas) +
      (S.modal ? (S.modal.kind === 'view' ? viewHtml(ideas) : modalHtml(ideas)) : '');
    bind();
    const first = el.querySelector('.pr-modal [data-k^="m:"]') || el.querySelector('.id-view [data-act=idea-edit]'); if (first) first.focus();
  }

  function bind() {
    const el = S.el;
    el.onclick = (e) => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      const act = b.dataset.act, path = b.dataset.path;
      if (act === 'retry') { save(path); return; }
      if (act === 'force') { save(path, true); return; }
      if (act === 'reload-discard') { const f = F(path); f.ver = f.savedVer; f.status = { kind: 'idle' }; render(el, S.handle); return; }
      if (act === 'm-cancel') { S.modal = null; draw(); return; }
      if (act === 'idea-new') { S.modal = { kind: 'idea-new' }; draw(); return; }
      if (act === 'idea-view') { S.modal = { kind: 'view', i: +b.dataset.i }; draw(); return; }
      if (act === 'idea-edit') { if (!writable()) return; S.modal = { kind: 'idea', i: +b.dataset.i }; draw(); return; }
      if (act === 'idea-delete') {
        if (!S.modal.sure) { S.modal.sure = true; draw(); return; }
        const it = currentIdeas()[S.modal.i]; S.modal = null;
        edit(IDEAS, (doc) => MD.removeRecord(MD.firstTable(doc), it._row));
      }
    };
    el.onsubmit = (e) => { e.preventDefault(); if (e.target.dataset.l === 'pj-modal') submitModal(e.target); };
    el.onkeydown = (e) => { if (e.key === 'Escape' && S.modal) { S.modal = null; draw(); } };
  }

  const api = { render, parseIdeas, state: S, fixedNow: null, pending: null, IDEAS };
  root.POProjects = api;
})(window);
