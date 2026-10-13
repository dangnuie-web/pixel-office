(function (root) {
  'use strict';
  const T = root.POTools;
  const D = () => root.PODesktop;
  const LN = () => root.PO_LINES;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (id) => document.getElementById(id);
  const FM = () => (root.POPlat ? root.POPlat.fileMgr() : 'Finder');
  const still = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const urlCache = {};
  function spriteUrl(key, i) {
    const ck = key + '#' + i;
    if (urlCache[ck] != null) return urlCache[ck];
    const c = root.POSprites && root.POSprites.has(key) ? root.POSprites.frameCanvas(key, i) : null;
    return (urlCache[ck] = c ? c.toDataURL() : '');
  }
  function icon(key, s) {
    const d = T.DEFS[key];
    const src = d.sprite ? spriteUrl(d.sprite, d.icon) : d.icon < 0 ? spriteUrl('tool_icon_combo', 0) : spriteUrl('tool_icons', d.icon);
    return src ? '<img class="tl-px" alt="" src="' + src + '" width="' + 12 * s + '" height="' + 12 * s + '">' : '';
  }
  const ST = { run: 2, ok: 3, fail: 4, on: 5, off: 6 };
  function chip(kind, s) {
    if (!kind) return '';
    const f = kind === 'run' ? (still() ? 2 : runFrame) : ST[kind];
    const src = spriteUrl('tool_state', f);
    const label = { run: '도는 중', ok: '끝남', fail: '실패', on: '켜짐', off: '꺼짐' }[kind];
    return src ? '<img class="tl-px tl-chip' + (kind === 'run' ? ' tl-run' : '') + '" alt="" role="img" aria-label="' + label + '" src="' + src + '" width="' + 9 * s + '" height="' + 9 * s + '">' : '';
  }
  let runFrame = 0;
  setInterval(() => {
    if (still()) return;
    const els = document.querySelectorAll('img.tl-run'); if (!els.length) return;
    runFrame = (runFrame + 1) % 3;
    const src = spriteUrl('tool_state', runFrame);
    els.forEach((e) => { e.src = src; });
  }, 300);
  setInterval(() => {
    document.querySelectorAll('[data-clock]').forEach((e) => { const s = T.S[e.dataset.clock]; if (s && s.status === 'run') e.textContent = T.clock(Date.now() - s.t0) + (e.dataset.tail || ''); });
  }, 1000);

  const st = (key) => T.S[key];
  const kindOf = (key) => { const s = st(key); return s.status === 'run' ? 'run' : s.status === 'ok' ? 'ok' : s.status === 'fail' ? 'fail' : ''; };
  const word = (key) => ({ run: '도는 중', ok: '끝남', fail: '실패' }[kindOf(key)] || '아직 안 돌렸어요');
  const off = () => !T.desktop();
  const OFF_TXT = '데스크톱 앱에서만';

  const UI = { pick: null, pickSel: 0, pickItems: [], openOld: {} };

  function rollHtml(key) {
    const d = T.DEFS[key], s = st(key), r = s.result || {}, k = kindOf(key);
    let body = '';
    if (s.status === 'idle') body = '<p class="tr-empty">' + (off() ? '데스크톱 앱에서만 돌릴 수 있어요.' : T.DEFS[key].server ? '아직 켜거나 끄지 않았어요. 아래 스위치로 켜면 여기에 출력이 나와요.' : '아직 안 돌렸어요.') + '</p>';
    else {
      const where = (s.args || []).filter((a) => !/^--/.test(a) && a !== '-').map((a) => '<code>' + esc(a) + '</code>').join(' ');
      body += '<div class="tr-meta">' + esc(T.hm(s.t0) + ' 시작') + (s.status === 'run' ? '' : ' · ' + esc(T.clock(s.ms != null ? s.ms : (s.t1 - s.t0)))) + (where ? ' · ' + where : '') + (s.status === 'fail' && s.code != null ? ' · 종료 코드 ' + s.code : '') + '</div>';
      body += sumTable(key);
      const lines = s.lines.concat(s.po ? [{ s: 'out', t: s.po }] : [], s.pe ? [{ s: 'err', t: s.pe }] : []);
      const show = key === 'clean' || key === 'names' || (key === 'deploy' && s.status !== 'fail') ? [] : lines.slice(-400);
      if (s.error && s.code == null) body += '<pre class="tr-log"><span class="e">' + esc(s.error) + '</span></pre>';
      else if (show.length) body += '<pre class="tr-log">' + show.map((l) => l.s === 'err' ? '<span class="e">' + esc(l.t) + '</span>' : esc(l.t)).join('\n') + '</pre>';
      else if (key === 'clean' || key === 'names') body += s.status === 'run' ? (root.PO_NM || String)('<pre class="tr-log">당니오피스를 읽는 중…</pre>') : '';
      else if (key === 'deploy') body += s.status === 'run' ? '<pre class="tr-log">' + (s.id === 'predeploy-test' ? '점검하고 시험을 돌리는 중… (시험은 몇 분 걸릴 수 있어요)' : '점검하는 중…') + '</pre>' : '';
      else if (s.status !== 'run') body += '<pre class="tr-log">(출력 없음)</pre>';
    }
    const res = resultFile(key);
    const foot = s.status === 'idle' ? '' : '<div class="tr-foot">' +
      (s.status === 'fail' && T.available(key) && !off() && !T.DEFS[key].server ? '<button class="tb-run" data-act="run" data-key="' + key + '">다시 돌리기</button>' : '') +
      '<button class="tb-run ghost" data-act="copy-out" data-key="' + key + '"' + (s.lines.length ? '' : ' disabled') + '>출력 복사</button>' +
      (res ? '<button class="tb-run ghost" data-act="open" data-rel="' + esc(res.rel) + '">' + esc(res.label) + '</button>' : '') +
      '<small>마지막 실행 결과만 남아요.<br>앱을 끄면 지워져요.</small></div>';
    return '<div class="tr-paper flat">' +
      '<div class="tr-h">' + icon(key, 2) + '<h3>' + esc(d.name) + '</h3><span class="tr-chip">' + chip(k, 2) + (k ? '<b class="' + (k === 'fail' ? 'fail' : '') + '">' + esc(word(key)) + '</b>' : '') +
      (s.status === 'run' ? ' <span data-clock="' + key + '">' + T.clock(Date.now() - s.t0) + '</span>' : '') + '</span></div>' + body + foot + '</div>';
  }
  function resultFile(key) {
    const s = st(key), r = s.result || {};
    if (s.status !== 'ok') return null;
    if (key === 'blog' && r.rel) return { rel: r.rel, label: '다시 열기' };
    if (key === 'frame' && r.html) return { rel: r.html, label: '미리보기 다시 열기' };
    if (key === 'pixel' && r.whole) return { rel: r.whole, label: '_전체.png 열기' };
    if (key === 'board' && r.rel) return { rel: r.rel, label: '비교판 다시 열기' };
    return null;
  }
  function sumTable(key) {
    const s = st(key), r = s.result;
    if (!r) return '';
    const row = (a, b, cls) => '<div><span>' + esc(a) + '</span><i class="' + (cls || '') + '">' + esc(b) + '</i></div>';
    if (key === 'test' && r.rows && r.rows.length) {
      const fin = r.rows.filter((x) => x.state === 'ok' || x.state === 'fail' || x.state === 'run');
      const wait = r.rows.filter((x) => x.state === 'wait');
      const word = (x) => x.state === 'ok' ? '통과 ' + (x.pass != null ? x.pass : '') : x.state === 'fail' ? (x.timeout ? '시간 초과' : '실패 ' + (x.fail != null ? x.fail + ' / 통과 ' + x.pass : '')) : '도는 중';
      const rows = fin.map((x) => row(x.name, word(x), x.state === 'ok' ? 'ok' : x.state === 'fail' ? 'no' : 'go'));
      if (wait.length) rows.push(s.status === 'run' ? row(wait.length === 1 ? wait[0].name : '나머지 ' + wait.length + '개', '기다리는 중', 'go') : row('못 돌린 시험 ' + wait.length + '개', '', 'go'));
      return '<div class="tr-sum">' + rows.join('') + '</div>' + (r.summary && s.status !== 'run' ? '<p class="tr-note">' + esc(r.summary) + '</p>' : '');
    }
    if (key === 'proj' && s.status === 'ok') return '<div class="tr-sum">' + (r.n ? r.diffs.map((x) => '<div><span>' + esc(x) + '</span></div>').join('') + '<p class="tr-note">고치기는 하지 않아요. 목록 맞추기는 토리가 해요.</p>' : row('프로젝트목록.md', '맞음', 'ok')) + '</div>';
    if (key === 'pixel' && s.status === 'ok') return '<div class="tr-sum">' + row('PNG', r.n + '장 완료', 'ok') + (r.fails || []).map((x) => row(x, '', 'no')).join('') + '</div>';
    if (key === 'sync' && s.status === 'ok') return '<div class="tr-sum">' + row('그림', r.n + '개', 'ok') + (r.problems || []).map((x) => row(x, '', 'no')).join('') + '<p class="tr-note">앱 그림 파일(assets)이 바뀌어요. 바뀐 그림은 앱을 다시 열면 보여요.</p></div>';
    if (key === 'blog' && s.status === 'ok' && r.rel) return '<div class="tr-sum">' + row(T.fileName(r.rel), '만듦', 'ok') + (r.info ? '<p class="tr-note">' + esc(r.info) + '</p>' : '') + '</div>';
    if (key === 'frame' && s.status === 'ok' && r.rel) return '<div class="tr-sum">' + row(r.name, '만듦', 'ok') + (r.info ? '<p class="tr-note">' + esc(r.info) + '</p>' : '') + r.checks.map((x) => '<p class="tr-note">' + esc(x) + '</p>').join('') + '</div>';
    if (key === 'imgconv' && (s.status === 'ok' || s.status === 'fail') && r.n != null) {
      return '<div class="tr-sum">' + row('만듦', r.made + '장', r.made ? 'ok' : 'go') + (r.skip ? row('건너뜀', r.skip + '장 (바꿀 게 없음 등)', 'go') : '') + (r.fail ? row('실패', r.fail + '장', 'no') : '') +
        (r.dirs || []).map((d) => row('결과 폴더', d, '')).join('') + '</div>' + (r.notes || []).map((x) => '<p class="tr-note">' + esc(x) + '</p>').join('');
    }
    if (key === 'board' && s.status === 'ok' && r.rel) return '<div class="tr-sum">' + row(r.name, '만듦', 'ok') + row('시안', r.count + '개 (그림 ' + r.images + ' · HTML ' + r.html + ')', '') + '</div><p class="tr-note">그림은 복사하지 않고 같은 폴더 원본을 보여 줘요.</p>';
    if ((key === 'clean' || key === 'names') && s.status === 'ok') {
      const c = r.counts;
      return '<div class="tr-sum">' + (key === 'clean' ? row('중복 묶음', c.dup) + row('큰 파일', c.big) + row('옛 버전', c.old) + row('이름', c.name) + row('개인정보 의심', c.private) + row('빈 폴더·임시', c.junk) : row('폴더명', c.dirs) + row('파일명', c.files) + row('새로 생긴 것', c.new) + row('경로로 쓰는 문서', c.refs)) + '</div>';
    }
    return '';
  }

  function focusId(a) {
    if (a.dataset.act) return '[data-act="' + a.dataset.act + '"]' + (a.dataset.key ? '[data-key="' + a.dataset.key + '"]' : '');
    if (a.dataset.apact) return '[data-apact="' + a.dataset.apact + '"]';
    if (a.dataset.opt) return '[data-opt="' + a.dataset.opt + '"][data-v="' + a.dataset.v + '"]';
    if (a.dataset.imgact) return '[data-imgact="' + a.dataset.imgact + '"]';
    return null;
  }
  function bindActs(el) {
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); act(b.dataset.act, b.dataset, b); }));
  }
  async function act(a, d) {
    const key = d.key;
    if (a === 'run') return runTool(key);
    if (a === 'stop') return T.stop(key);
    if (a === 'pf-on') return T.start('pf', {}, { id: 'portfolio-on' });
    if (a === 'pf-off') return T.start('pf', {}, { id: 'portfolio-off' });
    if (a === 'pf-open') return D().toolOpenPortfolio();
    if (a === 'copy-out') { const s = st(key); return copy(s.lines.map((l) => l.t).join('\n')); }
    if (a === 'open') { const r = await D().toolOpen(d.rel); if (r && !r.ok) toast(r.error || '열지 못했어요'); return; }
    if (a === 'reveal') { const r = await D().toolReveal(d.rel); if (r && !r.ok) toast(r.error || '보여 주지 못했어요'); return; }
    if (a === 'copy-path') { const o = T.office(); return copy(o ? o + '/' + d.rel : d.rel); }
  }
  async function copy(text) {
    try { if (D() && D().toolCopy) await D().toolCopy(text); else await navigator.clipboard.writeText(text); toast('복사했어요'); } catch (e) { toast('복사하지 못했어요'); }
  }
  let toastT = null;
  function toast(t) {
    let n = $('tl-toast');
    if (!n) { n = document.createElement('div'); n.id = 'tl-toast'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
    n.textContent = t; n.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { n.hidden = true; }, 1600);
  }
  async function runTool(key, opt) {
    opt = opt || {};
    if (off()) return;
    const d = T.DEFS[key];
    let params = {};
    if (d.input) {
      const m = opt.rel ? { rel: opt.rel } : T.memo[key];
      if (!m) return { ok: false, error: '먼저 고르기' };
      params = d.input === 'draft' ? { draft: m.rel } : d.input === 'assetdir' ? { dir: m.rel, scale: T.memo.pixelScale || 4 } : d.input === 'devproj' ? { name: m.rel } : d.input === 'boarddir' ? { dir: m.rel } : { src: m.rel };
    }
    if (d.form) { const o = imgOpt(opt.staff || Drawer.staff), src = opt.rel || (UI.imgSrc[opt.staff || Drawer.staff] || {}).rel; if (!src || imgInvalid(o)) return { ok: false, error: '먼저 고르기' }; params = imgParams(src, o); }
    const after = key === 'blog' || key === 'board' ? (s) => { const r = s.result; if (s.status === 'ok' && r && r.rel) D().toolOpen(r.rel); } : null;
    const r = await T.start(key, params, { id: opt.id, after });
    if (!r.ok && !r.missing) toast(r.error);
    if (r.missing) toast('준비 중이에요. 00_운영/도구 안 스크립트가 아직 없어요.');
    return r;
  }

  async function openPicker(key, anchor, opt) {
    opt = opt || {};
    UI.pick = key; UI.pickSel = 0; UI.pickAnchor = anchor || null; UI.pickOpt = opt; UI.openOld = {};
    UI.pickData = null;
    renderPicker();
    UI.pickData = key === 'pixel' ? await T.assetDirs() : key === 'deploy' ? await T.devProjects() : await T.lectureTopics();
    if (UI.pick === key) renderPicker();
  }
  function closePicker(refocus) {
    const k = UI.pick; UI.pick = null;
    document.querySelectorAll('.tb-pick').forEach((p) => p.remove());
    const host = UI.pickOpt && UI.pickOpt.host; UI.pickOpt = null;
    if (host && host.classList.contains('ec-pickhost')) host.remove();
    if (refocus) { const b = document.querySelector('.ec-chip[data-key="' + k + '"]'); if (b) b.focus(); }
  }
  function pickItems(key) {
    const data = UI.pickData;
    if (!data) return null;
    const items = [];
    if (key === 'pixel') {
      data.forEach((a) => items.push({ grp: null, label: a.project, sub: '디자인/에셋', rel: a.rel, memo: { label: a.project, sub: '', rel: a.rel } }));
      return items;
    }
    if (key === 'deploy') {
      data.forEach((a) => items.push({ grp: null, label: a.name, sub: '~/dev', rel: a.name, memo: { label: a.name, sub: '~/dev', rel: a.name } }));
      return items;
    }
    const field = key === 'blog' ? 'blogs' : 'manus';
    const fr = T.S.frame && T.S.frame.status === 'ok' && T.S.frame.result ? T.S.frame.result.rel : null;
    data.forEach((t) => {
      const list = t[field]; if (!list.length) return;
      items.push({ grp: t.topic });
      const f0 = list[0];
      const mk = (f, latest) => ({ label: f.name, sub: (latest ? '최신 · ' : '') + (f.date ? f.date.slice(4, 6) + '/' + f.date.slice(6) : '') + (fr && f.rel === fr ? ' · 방금 만든 틀' : ''), rel: f.rel, memo: { label: f.name.replace(/\.md$/, ''), sub: t.topic, rel: f.rel } });
      items.push(mk(f0, true));
      const old = list.slice(1);
      if (old.length) {
        if (UI.openOld[t.topic]) old.forEach((f) => items.push(Object.assign(mk(f, false), { old: true })));
        else items.push({ more: t.topic, label: '옛 판 ' + old.length + '개 (' + old.map((f) => 'v' + String(f.ver).padStart(2, '0')).reverse().join(', ') + ') 펼치기' });
      }
    });
    const none = data.filter((t) => !t[field].length).map((t) => t.topic);
    if (none.length) items.push({ dim: true, label: (key === 'blog' ? '블로그 초안이' : '원고가') + ' 아직 없는 주제 ' + none.length + '개 (' + none.join('·') + ')' });
    return items;
  }
  function renderPicker() {
    const key = UI.pick; if (!key) return;
    document.querySelectorAll('.tb-pick').forEach((p) => p.remove());
    const host = UI.pickOpt && UI.pickOpt.host;
    if (!host) return;
    const items = pickItems(key);
    UI.pickItems = (items || []).map((it, i) => Object.assign(it, { i })).filter((it) => it.rel || it.more || it.other);
    const noOther = key === 'pixel' || key === 'deploy';
    if (items && !noOther) items.push({ other: true, label: '다른 파일 고르기…', i: -1 });
    if (items && !noOther) UI.pickItems.push(items[items.length - 1]);
    UI.pickSel = Math.min(UI.pickSel, Math.max(0, UI.pickItems.length - 1));
    const title = { blog: '블로그 초안 고르기', frame: '원고 고르기 · 블로그 틀', lecture: '원고 고르기 · 강의목록 갱신', pixel: '에셋 폴더 고르기', deploy: '프로젝트 고르기 · 배포 전 점검' }[key];
    const selItem = UI.pickItems[UI.pickSel];
    const row = (it) => {
      if (it.grp) return '<div class="grp">' + esc(it.grp) + '</div>';
      if (it.dim) return '<div class="old dim">' + esc(it.label) + '</div>';
      const sel = it === selItem ? ' sel' : '';
      if (it.more) return '<div class="old op' + sel + '" data-i="' + UI.pickItems.indexOf(it) + '">' + esc(it.label) + '</div>';
      if (it.other) return '<div class="other op' + sel + '" data-i="' + UI.pickItems.indexOf(it) + (root.PO_NM || String)('">다른 파일 고르기… <small>(당니오피스 안 .md만)</small></div>');
      return '<div class="op' + sel + (it.old ? ' oldv' : '') + '" role="option" aria-selected="' + (sel ? 'true' : 'false') + '" data-i="' + UI.pickItems.indexOf(it) + '"><span>' + esc(it.label) + '</span><small>' + esc(it.sub) + '</small></div>';
    };
    const scale = key === 'pixel' ? '<div class="scale">배율 ' + [2, 3, 4].map((n) => '<button data-scale="' + n + '" class="' + ((T.memo.pixelScale || 4) === n ? 'on' : '') + '">' + n + '배</button>').join('') + '</div>' : '';
    const p = document.createElement('div');
    p.className = 'tb-pick'; p.setAttribute('role', 'listbox'); p.tabIndex = -1; p.setAttribute('aria-label', title);
    p.innerHTML = '<h5><span>' + title + '</span><span>↑↓ 고르기 · Enter ' + (key === 'blog' ? '열기' : '고르기') + ' · Esc 닫기</span></h5>' + scale +
      (items == null ? '<div class="old">읽는 중…</div>' : items.length ? items.map(row).join('') : '<div class="old">' + (key === 'deploy' ? '~/dev 에 깃 프로젝트가 없어요.' : '고를 파일이 없어요.') + '</div>') +
      '<p class="tb-pick-err" hidden></p>';
    host.appendChild(p);
    p.querySelectorAll('.op').forEach((o) => o.addEventListener('click', (e) => { e.stopPropagation(); UI.pickSel = +o.dataset.i; choosePick(); }));
    p.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); T.memo.pixelScale = +b.dataset.scale; renderPicker(); }));
    p.addEventListener('keydown', pickKey);
    p.addEventListener('click', (e) => e.stopPropagation());
    p.focus();
    const s = p.querySelector('.op.sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
  }
  function pickKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const n = UI.pickItems.length; if (!n) return; UI.pickSel = (UI.pickSel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; renderPicker(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); choosePick(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(true); }
  }
  async function choosePick() {
    const key = UI.pick, it = UI.pickItems[UI.pickSel]; if (!it) return;
    if (it.more) { UI.openOld[it.more] = true; renderPicker(); return; }
    let memo = it.memo;
    if (it.other) {
      const r = await D().toolPickMd();
      if (!r || !r.ok) { if (r && r.error) { const er = document.querySelector('.tb-pick .tb-pick-err'); if (er) { er.textContent = r.error; er.hidden = false; } } return; }
      memo = { label: T.fileName(r.rel).replace(/\.md$/, ''), sub: '직접 고름', rel: r.rel };
    }
    T.memo[key] = memo;
    const done = UI.pickOpt && UI.pickOpt.onPick;
    closePicker(false);
    if (done) { done(memo); return; }
    runTool(key);
  }
  document.addEventListener('click', (e) => { if (UI.pick && !e.target.closest('.tb-pick')) closePicker(false); });

  const staffName = (key) => { const w = staffOf(key); return w ? w.name : key; };
  function approvalChips(staffKey) {
    const pairs = T.apOfStaff(staffName(staffKey));
    if (!pairs.length) return '';
    return '<span class="ec-aplabel">MCP 승인 · 그날 끝까지</span>' + pairs.map((pair) => {
      const a = T.apDef(pair), ap = T.apState(pair), busy = !!T.AP.busy[pair];
      const open = Drawer.key === 'ap' && Drawer.pair === pair;
      const dis = !T.AP.available || busy;
      const word = !T.AP.available ? '준비 중' : busy ? '기록하는 중' : ap.approved ? '오늘 승인됨' : '안 됨';
      return '<button class="ec-chip ap' + (ap.approved ? ' yes' : '') + (open ? ' open' : '') + '" data-ap="' + esc(pair) + '" data-staff="' + esc(staffKey) + '" aria-pressed="' + ap.approved + '"' + (dis ? ' disabled' : '') +
        ' title="' + esc((ap.approved ? '누르면 승인 취소 (기록에 취소 줄)' : '누르면 오늘 이 연결을 써도 된다고 승인 (기록에 승인 줄)') + (a.hint ? '\n' + a.hint : '')) + '">' + chip(ap.approved ? 'on' : 'off', 2) + esc(a.label + ' 승인') +
        (a.badge ? '<span class="aph">' + esc(a.badge) + '</span>' : '') + '<span class="aps">' + esc(word) + '</span></button>';
    }).join('');
  }
  function cardTools(staffKey) {
    const list = T.staffTools(staffKey);
    if (off() || (!list.length && !T.apOfStaff(staffName(staffKey)).length)) return '';
    return '<div class="ec-tools">' + list.map((key) => {
      const d = T.DEFS[key];
      if (d.soon) return '<span class="ec-chip soon" title="' + esc(d.soon) + '에서 스크립트가 생기면 달아요">' + esc(d.name) + ' · ' + esc(d.soon) + '</span>';
      if (d.local) { const open = Drawer.key === key && Drawer.staff === staffKey; return '<button class="ec-chip' + (open ? ' open' : '') + '" data-key="' + key + '" data-staff="' + esc(staffKey) + '"><span class="ci">' + icon(key, 2) + '</span>' + esc(d.name) + '</button>'; }
      const s = st(key), k = kindOf(key), r = s.result;
      const n = s.status === 'ok' && r && typeof r.total === 'number' ? '<span class="n">' + r.total + '</span>' : '';
      const stc = d.server ? (k === 'run' ? chip('run', 2) : s.server === true ? chip('on', 2) : k === 'fail' && !s.failSeen ? chip('fail', 2) : '')
        : k === 'run' || k === 'fail' ? chip(k, 2) : s.status === 'ok' && !n ? chip('ok', 2) : '';
      const open = Drawer.key === key && Drawer.staff === staffKey;
      const avail = T.available(key);
      return '<button class="ec-chip' + (open ? ' open' : '') + (avail ? '' : ' soon') + '" data-key="' + key + '" data-staff="' + esc(staffKey) + '"' + (avail ? '' : ' disabled title="00_운영/도구 안 스크립트를 기다려요"') + '><span class="ci">' + icon(key, 2) + '</span>' + esc(d.name) + (avail ? '' : ' · 준비 중') + n + stc + '</button>';
    }).join('') + approvalChips(staffKey) + '</div>';
  }
  function bindCardTools(el) {
    el.querySelectorAll('.ec-chip[data-key]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); onChip(b.dataset.key, b.dataset.staff, b); }));
    el.querySelectorAll('.ec-chip[data-ap]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); onApproval(b.dataset.ap, b.dataset.staff); }));
  }
  async function onApproval(pair, staff) {
    if (off() || T.AP.busy[pair]) return;
    if (UI.pick) closePicker(false);
    Drawer.key = 'ap'; Drawer.pair = pair; Drawer.staff = staff; Drawer.showOut = false;
    renderDrawer(); refreshCards();
    const r = await T.approvalToggle(pair);
    if (!r.ok) toast(r.missing ? '준비 중이에요. 00_운영/도구/승인기록 스크립트가 아직 없어요.' : r.error);
    else toast(r.did === 'approve' ? '오늘 승인했어요' : r.did === 'revoke' ? '승인을 취소했어요' : '이미 그 상태예요');
  }
  function approvalDrawer(h, pc, ps) {
    const pair = Drawer.pair, a = T.apDef(pair), ap = T.apState(pair), s = ap.s || {}, busy = !!T.AP.busy[pair];
    const last = T.AP.last && T.AP.last.pair === pair ? T.AP.last : null;
    const row = (x, y, cls) => '<div><span>' + esc(x) + '</span><i class="' + (cls || '') + '">' + esc(y) + '</i></div>';
    const hhmm = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? '' : T.hm(t); };
    const meta = busy ? '기록하는 중' : ap.approved ? '오늘 ' + hhmm(s.expires) + '까지 승인됨 · ' + hhmm(s.at) + ' 승인' : ap.expired ? '어제 승인은 끝났어요 · 안 됨' : '승인 안 됨';
    const rec = last && last.record ? '<pre class="dr-rowline">' + esc(JSON.stringify(last.record)) + '</pre>' : '';
    const cmd = T.CHECK_CMD(pair);
    const list = '<div class="dr-list roll"><div class="tr-paper flat"><div class="tr-sum">' +
      row('연결', a.label + (a.note ? ' (' + a.note + ')' : ''), '') +
      row('범위', a.scope || '', '') +
      row('지금', busy ? '기록하는 중' : ap.approved ? '오늘 승인됨' : '안 됨', ap.approved ? 'ok' : 'go') +
      row('만료', '그날 끝 (23:59)', '') + '</div>' +
      (a.hint ? '<p class="tr-note ap-hint"><b>' + esc(a.badge || '참고') + '</b> · ' + esc(a.hint) + '</p>' : '') +
      (last && last.error ? '<pre class="tr-log"><span class="e">' + esc(last.error) + '</span></pre>' : '') +
      (last && last.message ? '<p class="tr-note">' + esc(last.message) + '</p>' : '') +
      (rec ? '<p class="tr-note">방금 붙인 줄</p>' + rec : '') +
      '<p class="tr-note">' + esc(a.staff) + '(또는 어떤 에이전트든)가 연결을 쓰기 전에 확인하는 명령 (0 = 승인 있음, 1 = 없음)</p><pre class="dr-rowline">' + esc(cmd) + '</pre>' +
      (T.AP.error ? '<p class="dr-warn">' + esc(T.AP.error) + '</p>' : '') + '</div></div>';
    const dis = busy || !T.AP.available ? ' disabled' : '';
    const footP = '앱은 승인 기록만 붙여요(00_운영/도구/승인기록/기록.json). 연결을 켜거나 끄지 않고, 지우거나 밖으로 보내지 않아요.';
    const footBtns = '<button class="tb-run' + (ap.approved ? ' ghost' : '') + '" data-apact="toggle"' + dis + '>' + (ap.approved ? '승인 취소' : '오늘 승인') + '</button>' +
      '<button class="tb-run ghost" data-apact="copy-cmd">확인 명령 복사</button>' +
      '<button class="tb-run ghost" data-act="reveal" data-rel="00_운영/도구/승인기록/기록.json"' + (T.AP.st[pair] && T.AP.st[pair].last ? '' : ' disabled') + '>기록 ' + FM() + '</button>';
    h.innerHTML = '<aside class="tl-drawer" style="--pc:' + pc + '" role="dialog" aria-label="' + esc(a.label) + ' 승인">' +
      '<div class="dr-band"></div><div class="dr-h"><div class="ec-portrait">' + (ps ? '<img alt="" src="' + esc(ps) + '">' : '') + '</div><div class="dr-id"><h3>' + chip(ap.approved ? 'on' : 'off', 2) + ' ' + esc(a.label + ' 승인') + '</h3><p>' + esc(meta) + '</p></div><button class="dr-x">닫기 Esc</button></div>' +
      list + '<div class="dr-foot"><p>' + esc(footP) + '</p><div class="row">' + footBtns + '</div></div></aside>';
    const el = h.querySelector('.tl-drawer');
    el.querySelector('.dr-x').addEventListener('click', closeDrawer);
    el.querySelectorAll('[data-apact]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.dataset.apact === 'toggle') return onApproval(pair, Drawer.staff);
      if (b.dataset.apact === 'copy-cmd') return copy(cmd);
    }));
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); act(b.dataset.act, b.dataset, b); }));
  }
  async function onChip(key, staff, btn) {
    const d = T.DEFS[key], s = st(key);
    if (!d || (T.pub() && !d.local)) return;
    if (d.workbench) { closeDrawer(); if (root.POPixel) root.POPixel.open({ from: 'cards' }); return; }
    if (d.local || d.server) { if (Drawer.key === key && Drawer.staff === staff) closeDrawer(); else openDrawer(key, staff); return; }
    if (d.form) { if (Drawer.key === key && Drawer.staff === staff) { closeDrawer(); return; } Drawer.form = s.status !== 'run' && s.status !== 'ok' && s.status !== 'fail'; openDrawer(key, staff); return; }
    if (d.input === 'boarddir' && s.status !== 'run' && !(Drawer.key === key && Drawer.staff === staff && s.status !== 'idle')) { pickBoardDir(staff); return; }
    if (d.input && s.status !== 'run' && !(Drawer.key === key && Drawer.staff === staff && s.status !== 'idle')) {
      const host = document.createElement('div'); host.className = 'ec-pickhost';
      btn.parentNode.appendChild(host);
      openPicker(key, btn, { host, onPick: (m) => { host.remove(); openDrawer(key, staff); runTool(key, { rel: m.rel, id: key === 'lecture' ? 'lecture-preview' : undefined }); } });
      return;
    }
    openDrawer(key, staff);
    if (s.status === 'idle') runTool(key);
  }
  const Drawer = { key: null, staff: null, seg: 0, pair: null, form: false };

  UI.imgSrc = {}; UI.imgOpt = {};
  const imgOpt = (staff) => (UI.imgOpt[staff] = UI.imgOpt[staff] || Object.assign({}, T.IMG_DEFAULT[staff] || T.IMG_DEFAULT.designer));
  const imgNothing = (o) => o.format === '그대로' && !o.long && !o.scale && o.space === '그대로';
  const imgInvalid = (o) => imgNothing(o) || (o.space === 'CMYK' && (o.format === 'png' || o.format === 'webp'));
  const imgParams = (src, o) => Object.assign({ src, format: o.format, space: o.space, intent: o.intent, out: o.out }, o.long ? { long: +o.long } : {}, o.scale ? { scale: +o.scale } : {});
  const IMG_ROWS = [
    ['format', '형식', [['그대로', '그대로'], ['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP'], ['tif', 'TIF']]],
    ['long', '크기', [['', '그대로'], ['960', '긴 변 960'], ['1600', '1600'], ['2400', '2400']]],
    ['scale', '픽셀 배율', [['', '없음'], ['2', '2배'], ['3', '3배'], ['4', '4배'], ['8', '8배']]],
    ['space', '색 공간', [['그대로', '그대로'], ['sRGB', 'sRGB'], ['P3', 'P3'], ['CMYK', 'CMYK']]],
    ['intent', '의도', [['perceptual', 'perceptual'], ['relative', 'relative']]],
  ];
  function imgForm(staff) {
    const o = imgOpt(staff), src = UI.imgSrc[staff];
    const rows = IMG_ROWS.filter((r) => r[0] !== 'intent' || o.space !== '그대로').map(([k, label, opts]) => '<div class="dr-opt"><span>' + esc(label) + '</span><div>' +
      opts.map(([v, t]) => '<button data-opt="' + k + '" data-v="' + esc(v) + '" class="' + (String(o[k]) === v ? 'on' : '') + '" aria-pressed="' + (String(o[k]) === v) + '">' + esc(t) + '</button>').join('') + '</div></div>').join('');
    const notes = [];
    if (o.scale) notes.push('픽셀 배율은 보간 없이 칸을 그대로 키워요 (픽셀아트용). 긴 변과 같이는 못 써요.');
    else if (o.long) notes.push('긴 변이 이보다 작은 그림은 키우지 않아요.');
    if (o.space !== '그대로') notes.push(o.intent === 'perceptual' ? 'perceptual: 넓은 색을 전체적으로 조금씩 눌러 매끄럽게.' : 'relative: 범위 안 색은 그대로, 밖 색만 가장 가까운 색으로.');
    if (o.space === 'sRGB' || o.space === 'CMYK') notes.push('형광처럼 넓은 색은 ' + o.space + '에서 조금 탁해져요' + (o.space === 'CMYK' ? ' (CMYK는 더 많이).' : '.') + ' 원본은 그대로예요.');
    if (o.format === 'jpg') notes.push('JPG는 투명을 못 담아서 투명한 곳은 흰색이 돼요.');
    const warn = o.space === 'CMYK' && (o.format === 'png' || o.format === 'webp') ? 'CMYK는 JPG·TIF로만 저장돼요.' : imgNothing(o) ? '바꿀 것을 하나 이상 골라 주세요 (그대로 복사하면 같은 파일이 두 곳에 생겨요).' : '';
    return '<div class="dr-list"><div class="dr-opts">' +
      '<div class="dr-opt"><span>폴더</span><div class="src"><b title="' + esc(src ? src.rel : '') + '">' + esc(src ? src.rel : '아직 안 골랐어요') + '</b><button data-imgact="pick">' + (src ? '다른 폴더' : '폴더 고르기') + '</button></div></div>' +
      rows + '</div>' + notes.map((x) => '<p class="tr-note">' + esc(x) + '</p>').join('') + (warn ? '<p class="dr-warn">' + esc(warn) + '</p>' : '') +
      '<p class="tr-note">결과: 고른 폴더 안 <b>' + esc(o.out) + '/</b> 에 새 파일만 (이름 규칙 날짜_프로젝트_내용_vNN). 원본은 그대로, 바로 안의 그림만.</p></div>';
  }
  async function pickImgDir(staff) {
    const cur = UI.imgSrc[staff];
    const r = await D().toolPickDir(cur ? cur.rel : '10_프로젝트/01_진행');
    if (!r || !r.ok) { if (r && r.error) toast(r.error); return; }
    UI.imgSrc[staff] = { rel: r.rel };
    renderDrawer();
  }
  async function pickBoardDir(staff) {
    const cur = T.memo.board;
    const r = await D().toolPickDir(cur ? cur.rel : '10_프로젝트/01_진행');
    if (!r || !r.ok) { if (r && r.error) toast(r.error); return; }
    T.memo.board = { rel: r.rel, label: T.fileName(r.rel) };
    openDrawer('board', staff); runTool('board', { rel: r.rel });
  }
  function deployBody(r) {
    const j = r.json || {}, ch = j.changes || {}, t = j.tests || {}, env = j.env || {}, sec = j.secrets || {};
    const cls = r.verdict === '통과' ? 'ok' : r.verdict === '막힘' ? 'no' : 'go';
    const row = (a, b, c) => '<div><span>' + esc(a) + '</span><i class="' + (c || '') + '">' + esc(b) + '</i></div>';
    let h = '<div class="tr-sum">' + row(j.project + ' 판정', r.verdict + (r.total ? ' (막힘 ' + r.block + ' · 확인 필요 ' + r.check + ')' : ''), cls) +
      row('.env', (env.tracked && env.tracked.length ? '깃에 올라감 ' + env.tracked.length : '깃에 올라간 것 없음') + (env.gitignore_has_env ? '' : ' · .gitignore 에 없음'), env.tracked && env.tracked.length ? 'no' : env.gitignore_has_env ? 'ok' : 'go') +
      row('비밀값 패턴', '파일 ' + (sec.files_scanned || 0) + '개 · 걸린 줄 ' + ((sec.hits || []).length), (sec.hits || []).length ? 'go' : 'ok') +
      row('시험', t.ran ? (t.ok ? '통과' : '실패') + (t.summary ? ' · ' + t.summary : '') : (t.summary || '안 돌림'), t.ran ? (t.ok ? 'ok' : 'no') : 'go') +
      row('바뀐 파일', '커밋 안 한 것 ' + ((ch.uncommitted || []).length) + ' · ' + (ch.upstream ? ch.upstream + '보다 앞선 커밋 ' + ch.ahead : '올릴 곳 없음'), '') + '</div>';
    const items = j.items || [];
    h += items.length ? '<div class="dr-grp"><span><b>걸린 것 ' + items.length + '</b></span><span>비밀값은 값 없이 파일:줄만</span></div>' +
      items.map((i) => '<div class="dr-row dp"><div class="p"><span>' + esc(i.path) + '</span><em>' + esc(i.what) + '</em></div><b class="sz ' + (i.level === '막힘' ? 'no' : '') + '">' + esc(i.level) + '</b></div>').join('') : '<p class="dr-ok">걸린 것이 없어요.</p>';
    const un = ch.uncommitted || [];
    if (un.length) h += '<div class="dr-grp"><span><b>커밋 안 한 것 ' + un.length + '</b></span><span></span></div>' + un.slice(0, 60).map((x) => '<div class="dr-row dp"><div class="p"><span>' + esc(x.path) + '</span></div><b class="sz">' + esc(x.code) + '</b></div>').join('');
    return h;
  }
  function openDrawer(key, staff) {
    Drawer.key = key; Drawer.staff = staff || Drawer.staff; Drawer.seg = 0;
    T.markSeen(key);
    renderDrawer();
    refreshCards();
    const x = document.querySelector('.tl-drawer .dr-x'); if (x) x.focus();
  }
  function closeDrawer() {
    if (!Drawer.key) return;
    const k = Drawer.key, sk = Drawer.staff, pair = Drawer.pair;
    Drawer.key = null; renderDrawer(); refreshCards();
    const b = k === 'ap' ? document.querySelector('.ec-chip[data-ap="' + pair + '"]') : document.querySelector('.ec-chip[data-key="' + k + '"][data-staff="' + sk + '"]'); if (b) b.focus();
  }
  function drawerHost() {
    let h = $('tl-drawer-host');
    if (!h) { h = document.createElement('div'); h.id = 'tl-drawer-host'; ($('app') || document.body).appendChild(h); }
    return h;
  }
  function staffOf(key) { const app = root.POApp, sl = app && app.result && app.result.state && app.result.state.staff; return sl ? sl.find((x) => x.key === key) : null; }
  function renderDrawer() {
    const h = drawerHost();
    if (!Drawer.key) { h.innerHTML = ''; return; }
    const sk = Drawer.staff;
    const pc = (LN() && LN().POINT[sk]) || '#9aa1ab';
    const own = T.pub() && sk === 'dangnee' && LN() && LN().ownerPixelSrc ? LN().ownerPixelSrc() : '';
    const ps = own || (LN() && LN().portraitSrc && LN().portraitSrc(LN().SPRITE[sk]));
    if (Drawer.key === 'ap') return approvalDrawer(h, pc, ps);
    const key = Drawer.key, d = T.DEFS[key], s = st(key), r = s.result || {};
    const who = staffOf(sk);
    if (key === 'combo' && root.POCombo) {
      const want = key;
      root.POCombo.renderDrawer(h, { pc, ps, px: !!own, icon: icon(key, 2), close: (keepFocus) => { if (keepFocus) { Drawer.key = null; renderDrawer(); refreshCards(); } else closeDrawer(); }, isOpen: () => Drawer.key === want });
      return;
    }
    const pfOn = d.server && s.server === true;
    const meta = d.server ? (s.status === 'run' ? (s.id === 'portfolio-off' ? '끄는 중' : '켜는 중') : pfOn ? '켜짐 · 5180번' + (s.since ? ' · ' + T.hm(s.since) + '부터' : '') : '꺼짐' + (s.status === 'fail' ? ' · ' + T.summary(key) : '')) :
      s.status === 'idle' ? '아직 안 돌렸어요' : s.status === 'run' ? T.hm(s.t0) + ' 시작 · 도는 중' :
      [T.hm(s.t1 || s.t0), T.clock(s.ms || 0).replace(/^0:0?/, '') + '초', key === 'clean' || key === 'names' ? (root.PO_NM || String)('당니오피스 전체') : '', (key === 'clean' || key === 'names') && r.total != null ? '후보 ' + r.total : T.summary(key)].filter(Boolean).join(' · ');
    let seg = '', list = '', footP = '', footBtns = '';
    const sameNext = s.status !== 'run' && T.available(key);
    if (key === 'imgconv' && (Drawer.form || s.status === 'idle')) {
      const o = imgOpt(sk), src = UI.imgSrc[sk];
      list = imgForm(sk);
      footP = '원본은 읽기만 해요. 결과는 새 파일로만 쓰고 덮어쓰거나 지우지 않아요.';
      footBtns = '<button class="tb-run" data-imgact="run"' + (!src || imgInvalid(o) || s.status === 'run' || !T.available(key) ? ' disabled' : '') + '>변환하기</button>' + (s.status === 'ok' || s.status === 'fail' ? '<button class="tb-run ghost" data-imgact="result">지난 결과 보기</button>' : '');
    } else if (key === 'deploy' && s.status === 'ok' && r.json) {
      list = '<div class="dr-list">' + deployBody(r) + '</div>';
      footP = (root.PO_NM || String)('점검만 해요. 푸시·배포는 하지 않아요 (배포는 당니님 승인 뒤). 같은 점검: 00_운영/도구/배포전점검/점검.py ') + (r.json.project || '');
      footBtns = (sameNext && s.id !== 'predeploy-test' ? '<button class="tb-run" data-act="deploy-test">시험까지 돌리기</button>' : '') + (sameNext ? '<button class="tb-run ghost" data-act="run" data-key="deploy">다시 점검</button><button class="tb-run ghost" data-act="repick" data-key="deploy">다른 프로젝트</button>' : '') + '<button class="tb-run ghost" data-act="show-out">출력 보기</button>';
    } else if ((key === 'clean' || key === 'names') && s.status === 'ok') {
      const segs = key === 'clean' ? [['dup', '중복 묶음'], ['big', '큰 파일'], ['old', '옛 버전'], ['name', '이름'], ['private', '개인정보 의심'], ['junk', '빈·임시']] : [['dirs', '폴더명'], ['files', '파일명'], ['new', '새로 생긴 것'], ['refs', '경로로 쓰는 문서']];
      seg = '<div class="dr-seg" role="tablist">' + segs.map((x, i) => '<button role="tab" data-seg="' + i + '" aria-selected="' + (Drawer.seg === i) + '"><b>' + r.counts[x[0]] + '</b>' + x[1] + '</button>').join('') + '</div>';
      list = '<div class="dr-list">' + drawerList(key, segs[Drawer.seg][0], r.json) + '</div>';
      footP = key === 'clean' ? (root.PO_NM || String)('앱은 목록만 보여 줘요. 지우기·옮기기는 오리가 정리 계획서로 올리고 당니님이 승인한 뒤에 해요.') : '앱은 목록만 보여 줘요. 이름 바꾸기는 승인 뒤 오리가 해요.';
      footBtns = '<button class="tb-run" data-act="hand-ori" data-key="' + key + '">오리에게 넘길 글 복사</button>' + (sameNext ? '<button class="tb-run ghost" data-act="run" data-key="' + key + '">다시 점검</button>' : '') + '<button class="tb-run ghost" data-act="show-out">출력 보기</button>';
    } else if (key === 'lecture' && s.status === 'ok') {
      list = '<div class="dr-list">' + lectureBody(r) + '</div>';
      footP = '강의목록.md 고치기는 [강의목록에 넣기]를 눌렀을 때만 해요. 한 줄 넣기만, 지우기는 없어요.';
      footBtns = (!r.write && !r.exists && r.row && sameNext ? '<button class="tb-run" data-act="lecture-write">강의목록에 넣기</button>' : '') + (sameNext ? '<button class="tb-run ghost" data-act="repick" data-key="lecture">다른 원고 고르기</button>' : '') + '<button class="tb-run ghost" data-act="show-out">출력 보기</button>';
    } else if (d.server) {
      const busy = s.status === 'run', dis = off() || busy || !T.available(key) ? ' disabled' : '';
      list = '<div class="dr-list roll"><div class="tr-sum"><div><span>주소 localhost:5180/#/admin</span><i class="' + (pfOn ? 'ok' : 'go') + '">' + (busy ? (s.id === 'portfolio-off' ? '끄는 중' : '켜는 중') : pfOn ? '켜짐' : '꺼짐') + '</i></div></div>' + rollHtml(key) + '</div>';
      footP = '내 컴퓨터 안 서버(5180번)만 켜고 꺼요. 글쓰기 화면은 크롬에서 열려요.';
      footBtns = '<div class="tb-sw" role="switch" aria-checked="' + pfOn + '" aria-label="포폴 관리자 켜기/끄기"><button data-act="pf-off" class="' + (pfOn ? '' : 'on') + '"' + dis + '>끔</button><button data-act="pf-on" class="' + (pfOn ? 'on' : '') + '"' + dis + '>켬</button></div>' +
        (pfOn && !busy ? '<button class="tb-run" data-act="pf-open">화면 열기</button>' : '');
    } else {
      list = '<div class="dr-list roll">' + rollHtml(key) + '</div>';
      const AGAIN = { proj: '다시 점검', test: '다시 돌리기', sync: '다시 동기화', pixel: '다시 PNG 뽑기', board: '다시 만들기' };
      const PICK = { blog: ['다른 초안 고르기', '초안 다시 고르기'], pixel: ['다른 에셋 고르기', '에셋 다시 고르기'], board: ['다른 폴더로', '폴더 다시 고르기'], deploy: ['다른 프로젝트', '프로젝트 다시 고르기'] };
      if (sameNext && s.status === 'ok' && AGAIN[key]) footBtns += '<button class="tb-run ghost" data-act="run" data-key="' + key + '">' + AGAIN[key] + '</button>';
      if (sameNext && (s.status === 'ok' || s.status === 'fail') && PICK[key]) footBtns += '<button class="tb-run ghost" data-act="repick" data-key="' + key + '">' + PICK[key][s.status === 'ok' ? 0 : 1] + '</button>';
      if (key === 'frame' && s.status === 'ok') { footP = '원고는 읽기만 했어요. 말투 다듬기는 몽글이 이 틀 위에서 해요.'; footBtns = r.rel ? '<button class="tb-run ghost" data-act="open" data-rel="' + esc(r.rel) + '">틀 파일 열기</button><button class="tb-run ghost" data-act="reveal" data-rel="' + esc(r.rel) + '">' + FM() + '</button>' + (sameNext ? '<button class="tb-run ghost" data-act="repick" data-key="frame">다른 원고로</button>' : '') : ''; }
      if (key === 'frame' || key === 'lecture') { if (s.status === 'fail' && sameNext) footBtns = '<button class="tb-run ghost" data-act="repick" data-key="' + key + '">원고 다시 고르기</button>'; }
      if (key === 'imgconv' && s.status !== 'run') {
        const dir = (r.dirs || [])[0];
        footP = '원본은 그대로예요. 결과는 새 파일로만 썼어요.';
        footBtns = (dir ? '<button class="tb-run ghost" data-act="reveal" data-rel="' + esc(dir) + '">결과 폴더 ' + FM() + '</button>' : '') + '<button class="tb-run ghost" data-imgact="form">설정 바꿔 다시</button>';
      }
      if (key === 'board' && s.status === 'ok' && r.rel) footBtns += '<button class="tb-run ghost" data-act="reveal" data-rel="' + esc(r.rel) + '">' + FM() + '</button>';
      if (s.status === 'run') footBtns = '<button class="tb-run stop" data-act="stop" data-key="' + key + '">멈추기</button>';
    }
    if (Drawer.showOut) { list = '<div class="dr-list roll">' + rollHtml(key) + '</div>'; }
    h.innerHTML = '<aside class="tl-drawer" style="--pc:' + pc + '" role="dialog" aria-label="' + esc(d.name) + ' 결과">' +
      '<div class="dr-band"></div><div class="dr-h"><div class="ec-portrait">' + (ps ? '<img alt="" src="' + esc(ps) + '">' : '') + '</div><div class="dr-id"><h3>' + icon(key, 2) + esc(d.name) + ' ' + chip(d.server ? (s.status === 'run' ? 'run' : pfOn ? 'on' : 'off') : kindOf(key), 2) + '</h3><p>' + esc(meta) + (who ? '' : '') + '</p></div><button class="dr-x">닫기 Esc</button></div>' +
      seg + list + (footP || footBtns ? '<div class="dr-foot">' + (footP ? '<p>' + esc(footP) + '</p>' : '') + '<div class="row">' + footBtns + '</div></div>' : '') + '</aside>';
    const a = h.querySelector('.tl-drawer');
    a.querySelector('.dr-x').addEventListener('click', closeDrawer);
    a.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const o = imgOpt(sk), k = b.dataset.opt;
      o[k] = b.dataset.v;
      if (k === 'scale' && o.scale) o.long = ''; if (k === 'long' && o.long) o.scale = '';
      renderDrawer(); const n = h.querySelector('[data-opt="' + k + '"][data-v="' + CSS.escape(o[k]) + '"]'); if (n) n.focus();
    }));
    a.querySelectorAll('[data-imgact]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const x = b.dataset.imgact;
      if (x === 'pick') return pickImgDir(sk);
      if (x === 'form') { Drawer.form = true; Drawer.showOut = false; return renderDrawer(); }
      if (x === 'result') { Drawer.form = false; return renderDrawer(); }
      if (x === 'run') { Drawer.form = false; Drawer.showOut = false; return runTool('imgconv', { staff: sk }); }
    }));
    a.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => { Drawer.seg = +b.dataset.seg; renderDrawer(); const n = h.querySelector('[data-seg="' + Drawer.seg + '"]'); if (n) n.focus(); }));
    a.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const x = b.dataset.act;
      if (x === 'hand-ori') return copy(key === 'clean' ? '오리, 정리 점검 스킬로 같은 점검을 다시 돌리고, 유사 이미지·개인정보 의심만 판단해서 정리 계획서로 써 줘.' : '오리, 이름 점검 스킬로 같은 점검을 다시 돌리고, 제안 이름을 골라 승인용 목록으로 써 줘.');
      if (x === 'show-out') { Drawer.showOut = !Drawer.showOut; return renderDrawer(); }
      if (x === 'lecture-write') { const p = st('lecture').params; return T.start('lecture', p, { id: 'lecture-write' }); }
      if (x === 'deploy-test') { const n = (st('deploy').params || {}).name; return n ? runTool('deploy', { rel: n, id: 'predeploy-test' }) : null; }
      if (x === 'run' && key === 'deploy') { const n = (st('deploy').params || {}).name; return n ? runTool('deploy', { rel: n, id: 'predeploy-check' }) : null; }
      if (x === 'run' && key === 'board') { const d0 = (st('board').params || {}).dir; return d0 ? runTool('board', { rel: d0 }) : null; }
      if (x === 'repick' && key === 'board') return pickBoardDir(Drawer.staff);
      if (x === 'repick') { const host = a.querySelector('.dr-foot') || a; const ph = document.createElement('div'); ph.className = 'ec-pickhost dr'; host.appendChild(ph); return openPicker(key, b, { host: ph, onPick: (m) => { ph.remove(); Drawer.showOut = false; runTool(key, { rel: m.rel, id: key === 'lecture' ? 'lecture-preview' : undefined }); } }); }
      if (x === 'run' && (key === 'frame' || key === 'lecture')) return runTool(key, { rel: (st(key).params || {}).src, id: key === 'lecture' ? 'lecture-preview' : undefined });
      act(x, b.dataset, b);
    }));
  }
  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : n >= 1024 ? Math.round(n / 1024) + 'KB' : n + 'B';
  function pathRow(p, extra, cls) {
    const i = p.lastIndexOf('/'), dir = i >= 0 ? p.slice(0, i + 1) : '', f = i >= 0 ? p.slice(i + 1) : p;
    return '<div class="dr-row' + (cls ? ' ' + cls : '') + '"><div class="p"><small title="' + esc(dir) + '">' + esc(dir || (root.PO_NM || String)('당니오피스/')) + '</small><span title="' + esc(f) + '">' + (extra && extra.pre ? extra.pre : '') + esc(f) + '</span>' + (extra && extra.sub ? '<em>' + esc(extra.sub) + '</em>' : '') + '</div>' +
      (extra && extra.right ? '<b class="sz">' + esc(extra.right) + '</b>' : '') +
      '<button class="sm" data-act="copy-path" data-rel="' + esc(p) + '">경로 복사</button><button class="sm" data-act="reveal" data-rel="' + esc(p) + '">' + FM() + '</button></div>';
  }
  function drawerList(key, seg, j) {
    const MAX = 300; const cut = (arr) => arr.length > MAX ? arr.slice(0, MAX) : arr;
    const more = (arr) => arr.length > MAX ? '<p class="dr-more">외 ' + (arr.length - MAX) + '개는 [출력 복사]로 볼 수 있어요.</p>' : '';
    if (key === 'clean') {
      if (seg === 'dup') { const a = j.duplicates || []; return a.length ? cut(a).map((g, i) => '<div class="dr-grp"><span><b>같은 내용 ' + g.files.length + '개</b> · ' + fmtSize(g.size) + '</span><span>' + (i === 0 ? (root.PO_NM || String)('어느 것을 남길지는 오리·당니님 판단') : '') + '</span></div>' + g.files.map((f) => pathRow(f)).join('')).join('') + more(a) : empty('중복 파일이 없어요.'); }
      if (seg === 'big') { const a = (j.large || []).slice().sort((x, y) => y.size - x.size); return a.length ? cut(a).map((x) => pathRow(x.path, { right: fmtSize(x.size) })).join('') + more(a) : empty(j.big_mb + 'MB 넘는 파일이 없어요.'); }
      if (seg === 'old') { const a = j.old_versions || []; return a.length ? cut(a).map((g) => '<div class="dr-grp"><span><b>' + esc(g.key) + '</b>' + (g.needs_judgment ? ' · 판단 필요' : '') + '</span><span>' + esc(g.dir) + '</span></div>' + (g.latest || []).map((p) => pathRow(p, { pre: '' }, 'latest')).join('') + (g.old || []).map((o) => pathRow(o.path, { right: o.version }, 'oldv')).join('')).join('') + more(a) : empty('옛 버전이 없어요.'); }
      if (seg === 'private') {
        const a = j.private || [];
        return a.length ? '<div class="dr-grp"><span><b>이름만 봤어요</b> · 내용은 안 열어요</span><span>맞으면 개인 자료 폴더로 옮겨 주세요</span></div>' + cut(a).map((x) => pathRow(x.path, { pre: x.kind === 'dir' ? '[폴더] ' : '', sub: '낱말: ' + (x.words || []).join(', ') })).join('') + more(a) : empty('개인정보 의심 이름이 없어요.');
      }
      if (seg === 'junk') {
        const k = j.junk || {}, ed = k.empty_dirs || [], zf = k.zero_files || [], ot = k.office_temp || [], ds = k.ds_store || [];
        if (!ed.length && !zf.length && !ot.length && !ds.length) return empty('빈 폴더·임시 파일이 없어요.');
        const sec = (t, arr, f) => arr.length ? '<div class="dr-grp"><span><b>' + t + ' ' + arr.length + '</b></span><span></span></div>' + cut(arr).map(f).join('') + more(arr) : '';
        return '<div class="dr-grp"><span><b>지우기는 앱 밖에서</b> · 오리가 목록 보고</span><span>일부러 비워 둔 폴더일 수 있어요</span></div>' +
          sec('빈 폴더', ed, (p) => pathRow(p, { pre: '[폴더] ' })) + sec('0바이트 파일', zf, (p) => pathRow(p)) + sec('~$ 임시 파일', ot, (x) => pathRow(x.path)) + sec('.DS_Store', ds, (p) => pathRow(p));
      }
      const a = (j.names || []).slice().sort((x, y) => (y.certain - x.certain)); return a.length ? cut(a).map((x) => pathRow(x.path, { sub: (x.certain ? '' : '후보 · ') + (x.problems || []).join(', ') })).join('') + more(a) : empty('이름 규칙 위반 후보가 없어요.');
    }
    const items = j.items || [];
    let a = seg === 'dirs' ? items.filter((x) => x.kind === 'dir') : seg === 'files' ? items.filter((x) => x.kind === 'file') : seg === 'new' ? items.filter((x) => x.new) : items.filter((x) => x.refs && x.refs.length);
    if (!a.length) return empty('없어요.');
    return cut(a).map((x) => pathRow(x.path, { pre: x.new ? '<i class="new">새</i>' : '', sub: seg === 'refs' ? '경로로 쓰는 곳 ' + x.refs.length + ': ' + x.refs.slice(0, 3).join(', ') + (x.refs.length > 3 ? ' …' : '') : (x.suggest ? '제안 ' + x.suggest : (x.problems || []).join(', ')) })).join('') + more(a);
  }
  const empty = (t) => '<p class="dr-empty">' + esc(t) + '</p>';
  function lectureBody(r) {
    return '<div class="dr-grp"><span><b>원고</b></span><span></span></div><p class="dr-ms">' + esc(r.manuscript) + '</p>' +
      (r.write ? (r.written ? '<div class="dr-ok">강의목록에 넣었어요: ' + esc(T.toRel(r.written) || r.written) + '</div>' : '') : '') +
      '<div class="dr-grp"><span><b>' + (r.exists ? '이미 목록에 있어요' : r.write ? '넣은 줄' : '넣을 줄 (미리보기)') + '</b></span><span></span></div>' +
      (r.row ? '<pre class="dr-rowline">' + esc(r.row) + '</pre>' : empty('넣을 줄이 없어요.')) +
      r.warns.map((w) => '<p class="dr-warn">' + esc(w) + '</p>').join('');
  }
  function refreshCards() {
    document.querySelectorAll('#cards .ec-card').forEach((c) => {
      const k = c.dataset.key, old = c.querySelector('.ec-tools');
      if (c.classList.contains('off') || c.classList.contains('fired')) return;
      const tmp = document.createElement('div'); tmp.innerHTML = cardTools(k);
      const n = tmp.firstChild;
      if (!old) { if (n) { c.appendChild(n); bindCardTools(c); } return; }
      if (!n) { old.remove(); return; }
      const ae = document.activeElement && old.contains(document.activeElement) ? document.activeElement : null;
      const f = ae ? (ae.dataset.key ? '[data-key="' + ae.dataset.key + '"]' : ae.dataset.ap ? '[data-ap="' + ae.dataset.ap + '"]' : null) : null;
      old.replaceWith(n); bindCardTools(c);
      if (f) { const b = n.querySelector(f); if (b) b.focus(); }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && Drawer.key && !UI.pick) { if (e.target && e.target.dataset && (e.target.dataset.own || e.target.dataset.filter)) return; e.preventDefault(); closeDrawer(); }
  });

  function deskLine(owner, ui) {
    const key = T.deskTool(owner); if (!key) return '';
    const d = T.DEFS[key], s = st(key), r = s.result || {};
    const ic = '<span class="ic">' + icon(key, 1).replace('class="tl-px"', 'class="tl-px dk"') + '</span>';
    const title = key === 'frame' ? '블로그 틀 만들기' : d.name;
    if (off()) return '<div class="drw"><div class="ln dim">' + ic + '<b>' + esc(title) + '</b><span class="ds">' + OFF_TXT + '</span></div></div>';
    if (!T.available(key)) return '<div class="drw"><div class="ln dim">' + ic + '<b>' + esc(title) + '</b><span class="ds">준비 중</span></div></div>';
    if (ui.picking) {
      return '<div class="drw"><div class="ln focus" data-dl="0">' + ic + '<b>' + esc(title) + '</b><span class="ds">고른 원고로 틀을 만들고 미리보기를 열어요</span><span class="key">Enter</span></div>' +
        '<div class="ln sm"><span class="ds">↑↓ 원고 고르기 · Esc 맡은 칸으로 돌아가기 · 원고는 읽기만 해요</span></div></div>';
    }
    if (s.status === 'run') return '<div class="drw"><div class="ln focus" data-dl="0">' + ic + '<b>' + esc(title) + '</b><span class="ds">' + (key === 'clean' ? (root.PO_NM || String)('당니오피스 전체를 읽는 중 · ') : '만드는 중 · ') + '<span data-clock="' + key + '">' + T.clock(Date.now() - s.t0) + '</span></span>' + chip('run', 1).replace('tl-chip', 'tl-chip dk') + '</div></div>';
    if (s.status === 'ok' || s.status === 'fail') {
      const fail = s.status === 'fail';
      const l1 = '<div class="ln' + (ui.focus === 0 ? ' focus' : '') + '" data-dl="0">' + ic + '<b>' + esc(title) + (fail ? ' 실패' : '') + '</b><span class="ds">' + esc(fail ? T.summary(key) : T.hm(s.t1) + ' 끝남 · ' + T.clock(s.ms || 0).replace(/^0:0?/, '') + '초') + '</span>' + chip(fail ? 'fail' : 'ok', 1).replace('tl-chip', 'tl-chip dk') + '<span class="key">Enter 다시</span></div>';
      let l2;
      if (fail) l2 = '<span class="ds">' + esc((s.lines.find((l) => l.s === 'err' && l.t.trim()) || s.lines.find((l) => l.t.trim()) || { t: s.error || '' }).t) + '</span><span class="lnk">출력 보기</span>';
      else if (key === 'clean') l2 = '<span class="ds">후보 ' + r.total + ' · 중복 ' + r.counts.dup + ' · 큰 파일 ' + r.counts.big + ' · 옛 버전 ' + r.counts.old + ' · 이름 ' + r.counts.name + ' · 개인정보 의심 ' + r.counts.private + ' · 빈·임시 ' + r.counts.junk + '</span><span class="lnk">목록 보기</span>';
      else l2 = '<span class="ds">틀: ' + esc(r.name || '') + '</span><span class="lnk">다시 열기</span>';
      return '<div class="drw">' + l1 + '<div class="ln sm' + (ui.focus === 1 ? ' focus' : '') + '" data-dl="1">' + l2 + '</div></div>';
    }
    return '<div class="drw"><div class="ln focus" data-dl="0">' + ic + '<b>' + esc(title) + '</b><span class="ds">' + esc(key === 'clean' ? '중복·큰 파일·옛 버전·이름' : '원고를 골라 블로그 모양 틀을 만들어요') + '</span><span class="key">Enter</span></div></div>';
  }
  function deskLines(owner) { const s = st(T.DESK_TOOL[owner]); return s && (s.status === 'ok' || s.status === 'fail') ? 2 : 1; }
  function deskEnter(owner, ui) {
    const key = T.deskTool(owner); if (!key || off() || !T.available(key)) return null;
    const s = st(key);
    if (s.status === 'run') return null;
    if (ui.focus === 1 && (s.status === 'ok' || s.status === 'fail')) {
      if (s.status === 'fail' || key === 'clean') return 'cards';
      if (key === 'frame' && s.result && s.result.html) { D().toolOpen(s.result.html); return null; }
      return null;
    }
    if (key === 'frame') return 'pick';
    runTool(key);
    return null;
  }

  T.subscribe(() => {
    if (Drawer.key && Drawer.key !== 'combo') { const keepFocus = document.activeElement && document.activeElement.closest('.tl-drawer') ? focusId(document.activeElement) : null; if (!UI.pick) { renderDrawer(); if (keepFocus) { const f = document.querySelector('.tl-drawer ' + keepFocus); if (f) f.focus(); } } }
    refreshCards();
  });

  root.POToolsUI = { cardTools, bindCardTools, openDrawer, closeDrawer, deskLine, deskLines, deskEnter, runTool, icon, chip, UI, Drawer, rollHtml };
})(window);
