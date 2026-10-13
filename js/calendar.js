(function (root) {
  'use strict';
  const K = root.POCalCore, FS = root.POFS, C = root.POCore;
  const UNDO_MS = 5000, GO = '10_프로젝트/01_진행';
  const KIND_CLS = { 미팅: 'meet', 마감: 'due', 발행: 'pub' };
  const DEMO_PJ = ['pixel-office'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = {
    el: null, handle: null, test: false, loaded: false, text: null, exists: false, items: [], warn: [], err: '', projects: [],
    y: null, m0: null, sel: null,
    form: null, ferr: null,
    undo: null, undoTimer: null, notice: null, busy: false, last: null, pastOpen: false,
  };
  const api = { state: S, fixedNow: null };
  const now = () => (api.fixedNow ? new Date(api.fixedNow) : new Date());
  const today = () => C.businessDay(C.nowMin(now()));
  const writable = () => !S.test && !!(root.PODesktop && typeof root.PODesktop.write === 'function');
  const notFound = (e) => e && (e.name === 'NotFoundError' || /없음|not ?found|ENOENT|no such file/i.test(e.message || ''));
  const kc = (k) => KIND_CLS[k] || 'etc';
  const chip = (m) => String(m.time || '').trim() || String(m.text || '');
  const dayText = (s) => { const p = String(s).split('-').map(Number); return p.length === 3 ? `${p[1]}월 ${p[2]}일` : s; };
  const shortDay = (s) => { const [y, m, d] = s.split('-').map(Number); return `${m}/${d} ${K.WD[new Date(y, m - 1, d, 12).getDay()]}`; };

  function demoText(t) {
    const d = (n) => K.addDays(t, n);
    return K.template() + [
      [d(0), '2pm', '미팅', '출판사 미팅', ''], [d(0), '6pm', '마감', '블로그 원고 마감', '강의'], [d(1), '10am', '발행', '네이버 블로그 발행', '강의'],
      [d(5), '', '마감', '포트폴리오 PDF', '포트폴리오'], [d(5), '4pm', '미팅', '클라이언트 피드백', ''], [d(5), '7pm', '발행', '릴스 업로드', ''],
      [d(12), '1pm', '미팅', '스터디', ''], [d(-3), '', '마감', '포스트잇 시안', 'pixel-office'], [d(-7), '11am', '미팅', '강의 기획 통화', '강의'],
    ].map((c) => K.rowText(c)).join('\n') + '\n';
  }
  function setText(text) { S.text = text; const p = K.parse(text); S.items = p.items; S.warn = p.warn; }
  async function load() {
    S.err = '';
    if (S.test && root.PODemo && root.PODemo.on()) { setText(root.PODemo.calText(K, today())); S.exists = true; S.projects = root.PODemo.CAL_PROJECTS.slice(); S.loaded = true; return; }
    if (S.test) { setText(demoText(today())); S.exists = true; S.projects = DEMO_PJ.slice(); S.loaded = true; return; }
    try { const r = await FS.readText(S.handle, K.PATH); setText(r.text); S.exists = true; }
    catch (e) {
      if (notFound(e)) { setText(null); S.exists = false; }
      else { setText(null); S.err = (e && e.message) || String(e); }
    }
    try { S.projects = (await FS.listDirs(S.handle, GO)).map((n) => n.normalize('NFC')); } catch (e) { S.projects = []; }
    S.loaded = true;
  }

  function view() {
    const t = today(), [ty, tm] = t.split('-').map(Number);
    return { y: S.y == null ? ty : S.y, m0: S.m0 == null ? tm - 1 : S.m0, today: t, isNow: S.y == null || (S.y === ty && S.m0 === tm - 1) };
  }
  function statusHtml() {
    let st;
    if (S.test) st = '<span class="pr-st ro">시연 보기 · 저장 안 함</span>';
    else if (!writable()) st = '<span class="pr-st ro">읽기 전용</span>';
    else if (S.busy) st = '<span class="pr-st">저장 중…</span>';
    else if (S.last && S.last.error) st = '<span class="pr-st bad">저장 안 됨</span>';
    else if (S.last && S.last.at) st = '<span class="pr-st">저장됨 ' + esc(S.last.at) + '</span>';
    else st = '<span class="pr-st">' + (S.exists ? '10_프로젝트/약속.md' : '첫 일정을 적으면 10_프로젝트/약속.md가 생겨요') + '</span>';
    return st + (S.test ? '' : '<button type="button" class="pr-btn ca-reload" data-focus="ca-reload">다시 읽기</button>');
  }
  const kindPill = (k) => `<span class="ca-kind-p ${kc(k)}">${esc(k || '—')}</span>`;
  const pjChip = (p) => (p ? ` <span class="ca-pj">${esc(p)}</span>` : '');
  function roRow(m, t, withDay) {
    return `<li class="cal-it ro ${kc(m.kind)}${K.isPast(m.date, t) ? ' past' : ''}" data-sig="${esc(m.sig)}">` + (withDay ? `<span class="cal-it-day">${esc(shortDay(m.date))}</span>` : '') +
      `<span class="cal-it-time">${esc(m.time || '종일')}</span>${kindPill(m.kind)}<span class="cal-it-text">${esc(m.text)}${pjChip(m.project)}</span></li>`;
  }
  function todayHtml(t, map) {
    const list = map[t] || [];
    return `<h3 class="ca-sec-h">오늘 일정 <small>${esc(shortDay(t))}</small></h3><div class="ca-today">` +
      (list.length ? '<ul class="cal-its">' + list.map((m) => roRow(m, t)).join('') + '</ul>' : '<p class="cal-none">오늘은 적힌 일정이 없어요.</p>') + '</div>';
  }
  function legend() { return '<span class="cal-legend" aria-label="종류">' + K.KINDS.map((k) => `<span><i class="cal-dot ${kc(k)}" aria-hidden="true"></i>${esc(k)}</span>`).join('') + '</span>'; }
  function gridHtml(v, map, sel) {
    const G = K.monthGrid(v.y, v.m0);
    let h = `<div class="cal-head"><h3>${v.y}년 ${v.m0 + 1}월</h3><div class="cal-head-r">${legend()}
      <span class="cal-nav" role="group" aria-label="달 넘기기"><button type="button" class="cal-prev" aria-label="지난달" data-focus="cal-prev">◀</button><button type="button" class="cal-now" ${v.isNow ? 'disabled' : ''} data-focus="cal-now">이번 달</button><button type="button" class="cal-next" aria-label="다음 달" data-focus="cal-next">▶</button></span></div></div>`;
    h += '<div class="cal-row cal-wd" aria-hidden="true">' + K.WD_MON.map((w, i) => `<span class="${i === 5 ? 'sat' : i === 6 ? 'sun' : ''}">${w}</span>`).join('') + '</div><div class="cal-grid" role="grid" aria-readonly="true">';
    G.weeks.forEach((wk) => {
      h += '<div class="cal-row" role="row">' + wk.map((c) => {
        const list = map[c.date] || [], past = K.isPast(c.date, v.today);
        const cls = ['cal-day', c.inMonth ? '' : 'out', c.date === v.today ? 'today' : '', c.date === sel ? 'sel' : '', list.length ? 'has' : '', past ? 'past' : '', c.dow === 5 ? 'sat' : c.dow === 6 ? 'sun' : ''].filter(Boolean).join(' ');
        const label = `${K.dayName(c.date)}${c.date === v.today ? ', 오늘' : ''}${list.length ? `, 일정 ${list.length}개` : ''}`;
        const marks = list.length ? `<span class="cal-marks">${list.slice(0, 2).map((m) => `<span class="cal-mt"><i class="cal-dot ${kc(m.kind)}" aria-hidden="true"></i><small>${esc(chip(m))}</small></span>`).join('')}${list.length > 2 ? `<small class="cal-more">+${list.length - 2}</small>` : ''}</span>` : '';
        return `<button type="button" role="gridcell" class="${cls}" data-date="${c.date}" aria-selected="${c.date === sel}" aria-label="${esc(label)}" tabindex="${c.date === sel ? 0 : -1}" data-focus="cal:${c.date}"><span class="cal-n">${c.d}</span>${marks}</button>`;
      }).join('') + '</div>';
    });
    return h + '</div>';
  }
  function formHtml(f) {
    const v = f.v || {}, e = S.ferr, bad = (k) => (e && e.field === k ? ' bad" aria-invalid="true' : '');
    const pjs = S.projects.slice(); if (v.project && !pjs.includes(v.project)) pjs.unshift(v.project);
    let h = `<form class="ca-form" data-mode="${f.mode}" autocomplete="off"><div class="ca-f-row">`;
    h += `<span class="ca-lb">종류</span><span class="ca-seg${e && e.field === 'kind' ? ' bad' : ''}" role="radiogroup" aria-label="종류">` + K.KINDS.map((k) => `<button type="button" role="radio" class="ca-kind" data-kind="${k}" aria-checked="${v.kind === k}" data-focus="ca-kind:${k}"><i class="cal-dot ${kc(k)}" aria-hidden="true"></i>${k}</button>`).join('') + '</span>';
    if (f.mode === 'edit') h += `<label class="ca-lb">날짜 <input type="date" class="ca-in ca-in-date${bad('date')}" value="${esc(v.date || '')}" data-focus="ca-in-date"></label>`;
    h += `<label class="ca-lb">시간 <input class="ca-in ca-in-time${bad('time')}" maxlength="${K.TIME_MAX}" value="${esc(v.time || '')}" placeholder="종일" data-focus="ca-in-time"></label>`;
    h += `<label class="ca-lb ca-lb-text">내용 <input class="ca-in ca-in-text${bad('text')}" maxlength="${K.TEXT_MAX}" value="${esc(v.text || '')}" placeholder="무슨 일정인가요?" data-focus="ca-in-text"></label>`;
    h += `<label class="ca-lb">프로젝트 <select class="ca-sel-pj${bad('project')}" data-focus="ca-sel-pj"><option value="">없음</option>${pjs.map((p) => `<option value="${esc(p)}"${p === v.project ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></label></div>`;
    h += '<div class="ca-f-foot">' + (e ? `<p class="ca-hint bad" role="alert">${esc(e.text)}</p>` : '<p class="ca-hint">시간은 10am, 7:30pm, 14:00처럼 (비워 두면 종일) · Enter 저장 · Esc 그만두기</p>');
    h += `<button type="submit" class="ca-save"${e ? ' disabled' : ''}>저장</button><button type="button" class="ca-cancel">그만두기</button></div>`;
    return h + '</form>';
  }
  function msgHtml() {
    const u = S.undo, n = S.notice;
    if (u) return `<div class="ca-msg ok" role="status" data-undo="cal"><span>${esc(u.note)}</span><button type="button" class="ca-undo-b" data-act="undo" data-focus="ca-undo">되돌리기</button></div>`;
    if (n) return `<div class="ca-msg${n.ok ? ' ok' : ' warn'}" role="status"><span>${esc(n.text)}</span><button type="button" class="ca-x" data-act="notice-close" aria-label="닫기">✕</button></div>`;
    return '';
  }
  function dayHtml(sel, map, t) {
    const list = map[sel] || [], past = K.isPast(sel, t), w = writable();
    let h = `<div class="cal-list" aria-live="polite" data-date="${sel}"><h4>${esc(K.dayName(sel))}${sel === t ? ' <small>오늘</small>' : ''}</h4>`;
    if (list.length) {
      h += '<ul class="cal-its">' + list.map((m) => {
        const editing = S.form && S.form.mode === 'edit' && S.form.sig === m.sig;
        return `<li class="cal-it ${kc(m.kind)}${past ? ' past' : ''}" data-sig="${esc(m.sig)}"><span class="cal-it-time">${esc(m.time || '종일')}</span>${kindPill(m.kind)}<span class="cal-it-text">${esc(m.text)}${pjChip(m.project)}</span>` +
          (w ? `<span class="ca-ops"><button type="button" class="ca-fix" data-focus="ca-fix:${esc(m.sig)}" aria-label="${esc(m.text)} 고치기">고치기</button><button type="button" class="ca-del" data-focus="ca-del:${esc(m.sig)}" aria-label="${esc(m.text)} 지우기">지우기</button></span>` : '') +
          (editing ? formHtml(S.form) : '') + '</li>';
      }).join('') + '</ul>';
    } else h += `<p class="cal-none">${w ? '이날은 일정이 없어요. 아래에서 적을 수 있어요.' : '이날은 일정이 없어요.'}</p>`;
    if (w) h += S.form && S.form.mode === 'add' && S.form.date === sel ? formHtml(S.form) : '<button type="button" class="ca-add" data-focus="ca-add">+ 일정 적기</button>';
    return h + `<div id="ca-notice">${msgHtml()}</div></div>`;
  }
  function pastHtml(t) {
    const past = S.items.filter((m) => K.isPast(m.date, t)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (K.timeKey(b.time) || 0) - (K.timeKey(a.time) || 0)));
    if (!past.length) return '';
    return `<details class="ca-past"${S.pastOpen ? ' open' : ''}><summary data-focus="ca-past">지난 일정 <small>${past.length}</small></summary><ul class="cal-its">${past.map((m) => roRow(m, t, true)).join('')}</ul></details>`;
  }
  function html() {
    const v = view(), map = K.byDate(S.items), sel = S.sel || v.today;
    let h = `<div class="ca"><div class="pj-head"><h2>일정</h2><div class="pr-tools" id="ca-status">${statusHtml()}</div></div>`;
    if (S.test) h += '<div class="pr-ro">시연 보기예요. 예시 일정만 보이고 저장하지 않아요.</div>';
    else if (!writable()) h += '<div class="pr-ro">브라우저에서는 읽기만 해요. 일정 적기는 데스크톱 앱에서.</div>';
    if (S.err) h += `<p class="pj-err">10_프로젝트/약속.md를 못 읽었어요: ${esc(S.err)}</p>`;
    if (S.warn.length) h += `<p class="ca-warn">약속.md 확인: ${esc(S.warn.join(' · '))}</p>`;
    h += todayHtml(v.today, map);
    h += `<section class="cal" data-month="${v.y}-${String(v.m0 + 1).padStart(2, '0')}" aria-label="일정 달력">${gridHtml(v, map, sel)}${dayHtml(sel, map, v.today)}</section>`;
    return h + pastHtml(v.today) + '</div>';
  }
  function paint(focus) {
    if (!S.el) return;
    S.el.innerHTML = html();
    bind();
    if (focus) { const f = [...S.el.querySelectorAll('[data-focus]')].find((x) => x.dataset.focus === focus); if (f) { f.focus(); if (f.setSelectionRange && f.type !== 'date') try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {  } } }
  }

  function go(date, focus) {
    const [y, m] = date.split('-').map(Number), [ty, tm] = today().split('-').map(Number);
    if (y === ty && m === tm) { S.y = null; S.m0 = null; } else { S.y = y; S.m0 = m - 1; }
    if (S.form && S.form.date !== date) { S.form = null; S.ferr = null; }
    S.sel = date; paint(focus || 'cal:' + date);
  }
  function bind() {
    const el = S.el, q = (s) => el.querySelector(s), v = view();
    q('.cal-prev').addEventListener('click', () => { const n = K.shift(v.y, v.m0, -1); go(K.ymd(n.y, n.m0, 1), 'cal-prev'); });
    q('.cal-next').addEventListener('click', () => { const n = K.shift(v.y, v.m0, 1); go(K.ymd(n.y, n.m0, 1), 'cal-next'); });
    q('.cal-now').addEventListener('click', () => go(v.today));
    const rl = q('.ca-reload'); if (rl) rl.addEventListener('click', reload);
    el.querySelectorAll('.cal-day').forEach((b) => {
      b.addEventListener('click', () => go(b.dataset.date));
      b.addEventListener('keydown', (e) => {
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
        e.preventDefault(); go(K.addDays(b.dataset.date, step));
      });
    });
    const pd = q('.ca-past'); if (pd) pd.addEventListener('toggle', () => { S.pastOpen = pd.open; });
    const list = q('.cal-list'), date = list.dataset.date;
    list.querySelectorAll('.cal-it').forEach((li) => {
      const sig = li.dataset.sig, m = S.items.find((x) => x.sig === sig); if (!m) return;
      const fx = li.querySelector('.ca-fix'), dl = li.querySelector('.ca-del');
      if (fx) fx.addEventListener('click', () => { S.form = { mode: 'edit', date, sig, v: { date: m.date, time: m.time, kind: m.kind, text: m.text, project: m.project || '' } }; S.ferr = null; paint('ca-in-text'); });
      if (dl) dl.addEventListener('click', () => op('remove', { sig, date }));
    });
    const ab = q('.ca-add'); if (ab) ab.addEventListener('click', () => { S.form = { mode: 'add', date, v: { date, time: '', kind: '미팅', text: '', project: '' } }; S.ferr = null; paint('ca-in-text'); });
    const fm = q('.ca-form'); if (fm) bindForm(fm);
    bindMsg();
  }
  function bindMsg() {
    const n = S.el && S.el.querySelector('#ca-notice'); if (!n) return;
    n.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.act === 'undo') op('undo', {}); else { S.notice = null; paintMsg(); } }));
  }
  function paintMsg() { const n = S.el && S.el.querySelector('#ca-notice'); if (n) { n.innerHTML = msgHtml(); bindMsg(); } }
  function paintStatus() { const s = S.el && S.el.querySelector('#ca-status'); if (s) { s.innerHTML = statusHtml(); const rl = s.querySelector('.ca-reload'); if (rl) rl.addEventListener('click', reload); } }
  function clearUndo() { clearTimeout(S.undoTimer); S.undoTimer = null; S.undo = null; }
  function setUndo(u) { clearUndo(); S.undo = u; S.undoTimer = setTimeout(() => { S.undo = null; paintMsg(); }, UNDO_MS); }
  async function reload() { if (S.busy) return; S.form = null; S.ferr = null; S.notice = null; clearUndo(); await load(); paint('ca-reload'); }

  const FIELD = { badDate: 'date', badTime: 'time', badKind: 'kind', badText: 'text', badProject: 'project' };
  const FOCUS_OF = { date: 'ca-in-date', time: 'ca-in-time', kind: 'ca-kind:미팅', text: 'ca-in-text', project: 'ca-sel-pj' };
  function readForm(fm) {
    const g = (s) => fm.querySelector(s), k = fm.querySelector('.ca-kind[aria-checked="true"]');
    return { date: g('.ca-in-date') ? g('.ca-in-date').value : S.form.date, time: g('.ca-in-time').value, kind: k ? k.dataset.kind : '', text: g('.ca-in-text').value, project: g('.ca-sel-pj').value };
  }
  function clearErr(fm) {
    if (!S.ferr) return;
    S.ferr = null;
    const m = fm.querySelector('.ca-hint'); if (m) { m.className = 'ca-hint'; m.removeAttribute('role'); m.textContent = '시간은 10am, 7:30pm, 14:00처럼 (비워 두면 종일) · Enter 저장 · Esc 그만두기'; }
    fm.querySelectorAll('.bad').forEach((x) => { x.classList.remove('bad'); x.removeAttribute('aria-invalid'); });
    const sv = fm.querySelector('.ca-save'); if (sv) sv.disabled = false;
  }
  function bindForm(fm) {
    fm.addEventListener('submit', (e) => { e.preventDefault(); submit(fm); });
    const keep = () => { if (S.form) S.form.v = readForm(fm); clearErr(fm); };
    fm.addEventListener('input', keep); fm.addEventListener('change', keep);
    fm.querySelectorAll('.ca-kind').forEach((b) => b.addEventListener('click', () => { fm.querySelectorAll('.ca-kind').forEach((x) => x.setAttribute('aria-checked', String(x === b))); keep(); }));
    fm.querySelector('.ca-cancel').addEventListener('click', cancel);
    fm.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
      else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(fm); }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.classList.contains('ca-kind')) {
        e.preventDefault();
        const bs = [...fm.querySelectorAll('.ca-kind')], i = bs.indexOf(e.target), n = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length];
        n.click(); n.focus();
      }
    });
  }
  function cancel() { const f = S.form; S.form = null; S.ferr = null; paint(f && f.mode === 'edit' ? 'ca-fix:' + f.sig : 'ca-add'); }
  function submit(fm) {
    const f = S.form; if (!f) return null;
    const v = readForm(fm); f.v = v;
    const cur = f.mode === 'edit' ? S.items.find((x) => x.sig === f.sig) : null;
    try { K.check(v, cur ? { time: cur.time, kind: cur.kind, text: cur.text } : null); }
    catch (e) { const fd = FIELD[e.code] || 'text'; S.ferr = { text: e.message, field: fd }; paint(FOCUS_OF[fd]); return null; }
    if (f.mode === 'add') return op('add', { item: v, date: f.date });
    return op('update', { sig: f.sig, patch: v, date: f.date });
  }

  const stamp = () => { const d = now(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const MOVED = ' (그 사이 밖에서 바뀐 약속.md에 맞춰 이 줄만)';
  async function op(kind, a) {
    if (S.busy || !writable()) return null;
    S.busy = true; paintStatus();
    let res = null, cur = null, opName = kind, moved = false;
    const u = S.undo;
    try {
      try { cur = (await FS.readText(S.handle, K.PATH)).text; } catch (e) { if (!notFound(e)) throw e; cur = null; }
      moved = cur !== S.text;
      if (kind === 'add') res = K.add(cur, a.item);
      else if (kind === 'update') res = K.update(cur, a.sig, a.patch);
      else if (kind === 'remove') res = K.remove(cur, a.sig);
      else if (kind === 'undo') {
        if (!u) { S.busy = false; paintStatus(); return null; }
        if (u.type === 'update') { res = K.update(cur, u.sig, null, { raw: u.raw }); opName = 'update'; }
        else { res = K.add(cur, null, { raw: u.raw, before: u.before }); opName = 'add'; }
      }
      if (res.changed !== false) {
        if (!K.onlyTableChanged(cur, res.text, opName)) throw Object.assign(new Error('약속 표 말고 다른 줄이 바뀔 뻔해서 멈췄어요'), { code: 'guard' });
        await FS.writeText(K.PATH, res.text);
      }
      setText(res.text); S.exists = true;
      S.last = { op: kind, at: stamp(), moved };
      S.notice = moved ? { text: '그 사이 약속.md가 밖에서 바뀌어서, 새 글에 맞춰 이 일정만 고쳤어요.' } : null;
    } catch (e) {
      S.busy = false;
      const msg = String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      S.last = { op: kind, error: msg, code: e && e.code || null };
      if (S.form && FIELD[e && e.code]) { S.ferr = { text: msg, field: FIELD[e.code] }; paint(FOCUS_OF[FIELD[e.code]]); return null; }
      if (e && e.code === 'notFound') { try { await load(); } catch (x) {  } S.form = null; clearUndo(); }
      S.notice = { text: '저장 안 됨: ' + msg }; paint(); return null;
    }
    S.busy = false; S.ferr = null;
    let focus = null;
    if (kind === 'add') { S.form = null; clearUndo(); if (!S.notice) S.notice = { ok: true, text: `${dayText(res.item.date)}에 적었어요: ${res.item.text}` }; focus = 'ca-add'; see(res.item.date); }
    else if (kind === 'update') {
      S.form = null;
      if (res.changed === false) { clearUndo(); S.notice = { ok: true, text: '바뀐 게 없어요.' }; focus = 'ca-fix:' + a.sig; }
      else { see(res.item.date); setUndo({ type: 'update', sig: K.sigOf(res.after), raw: res.before, prevDate: res.prev.date, note: `${res.item.text}을(를) 고쳤어요` + (moved ? MOVED : '') }); focus = 'ca-undo'; }
    } else if (kind === 'remove') { S.form = null; setUndo({ type: 'remove', raw: res.removedText, before: res.before, note: `${res.removed.text}을(를) 지웠어요` + (moved ? MOVED : '') }); focus = 'ca-undo'; }
    else if (kind === 'undo') {
      clearUndo();
      if (u.type === 'update') see(u.prevDate);
      S.notice = { ok: true, text: '되돌렸어요.' }; focus = 'ca-fix:' + K.sigOf(u.raw);
    }
    paint(focus);
    return res;
  }
  function see(date) {
    if (!date) return;
    const [y, m] = date.split('-').map(Number), [ty, tm] = today().split('-').map(Number);
    if (y === ty && m === tm) { S.y = null; S.m0 = null; } else { S.y = y; S.m0 = m - 1; }
    S.sel = date;
  }

  async function render(el, handle, opts) {
    const test = !!(opts && opts.test);
    if (test !== S.test) { S.test = test; S.form = null; S.ferr = null; clearUndo(); S.notice = null; S.last = null; }
    S.el = el; if (handle) S.handle = handle;
    if (!S.loaded) el.innerHTML = '<p class="pj-loading">일정을 여는 중…</p>';
    if (S.form || S.busy) { paint(); return; }
    await load();
    paint();
  }

  Object.assign(api, { render, load, reload, op, paint, go, html, demoText, today, writable,
    snapshot: () => ({ sel: S.sel, y: S.y, m0: S.m0, form: S.form ? { mode: S.form.mode, date: S.form.date, sig: S.form.sig || null } : null, ferr: S.ferr, undo: S.undo ? { type: S.undo.type } : null, last: S.last, notice: S.notice, items: S.items.length, test: S.test }) });
  root.POCalendar = api;
})(window);
