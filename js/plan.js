(function (root) {
  'use strict';
  const D = root.POPlanData, LN = root.PO_LINES || {};
  const COLS = [['Today', 'today'], ['Weekly', 'week'], ['완료', 'done']];
  const ADD_COLS = ['Today', 'Weekly'];
  const VIEWS = { 진행: ['Today', 'Weekly'], 완료: ['완료'] };
  const DD_FOLD = 3;
  const DONE_DAYS = 7;
  const OK_MS = 4000, UNDO_MS = 5000, DRAG_PX = 4, CLICK_GUARD_MS = 400;
  const FOCUS_KEY = 'po.plan.focus';
  const EMPTY = {
    Today: '오늘 할 일이 없어요. 위에서 추가하거나 Weekly에서 끌어오세요.',
    Weekly: '이번 주에 할 일을 모아 두세요.',
    완료: '체크한 일이 날짜와 함께 쌓여요.',
  };
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const U = {
    el: null, handle: null, opts: {}, focus: loadFocus(), query: '', ddOpen: false, ddSel: 0, ddRows: [], expanded: new Set(),
    view: '진행', oldDone: false, editing: null, notice: null, noticeTimer: null, drag: null, clickGuard: 0,
    mk: null,
    task: null,
    hl: null,
    scrub: null,
    ordering: false,
    rowDrag: null,
    barMs: false,
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel) => U.el && U.el.querySelector(sel);
  function loadFocus() { try { const v = root.localStorage.getItem(FOCUS_KEY); return ADD_COLS.indexOf(v) >= 0 ? v : 'Today'; } catch (e) { return 'Today'; } }
  function saveFocus() { try { root.localStorage.setItem(FOCUS_KEY, U.focus); } catch (e) {  } }
  const canWrite = () => D.writable();
  const dis = () => (canWrite() ? '' : ' disabled');

  const DAY = 86400000;
  const dnum = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : NaN; };
  const md = (n) => { const d = new Date(n * DAY); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); };
  function colNote(key) {
    const t = dnum(D.today());
    if (key === 'Today') return md(t) + ' ' + WD[new Date(t * DAY).getUTCDay()];
    if (key === 'Weekly') { const wd = (new Date(t * DAY).getUTCDay() + 6) % 7; return md(t - wd) + ' – ' + md(t - wd + 6); }
    if (key === '완료') return '최근 ' + DONE_DAYS + '일';
    return '';
  }

  function who(owners, ownerTurn) {
    if (ownerTurn) return (root.PO_NM || String)('<span class="pl-who me">당니님 차례</span>');
    if (!owners || !owners.length) return '';
    const k = D.staffKey(owners[0]), pc = (k && LN.POINT && LN.POINT[k]) || '#9aa1ab';
    return '<span class="pl-who" style="--pc:' + esc(pc) + '">' + esc(owners[0]) + '</span>' + (owners.length > 1 ? '<span class="pl-whomore">외 ' + (owners.length - 1) + '</span>' : '');
  }

  function statusHtml() {
    const s = D.status();
    if (s.kind === 'readonly') return '<span class="pr-st ro">' + (D.state.test ? '시연 보기 · 저장 안 함' : '읽기 전용') + '</span>';
    if (s.kind === 'pending') return '<span class="pr-st">저장 대기…</span>';
    if (s.kind === 'saving') return '<span class="pr-st">저장 중…</span>';
    if (s.kind === 'saved') return '<span class="pr-st ok">저장됨 ' + esc(s.at) + '</span>';
    if (s.kind === 'error') return '<span class="pr-st bad">저장 실패: ' + esc(s.msg) + '</span><button class="pr-btn" data-act="retry">다시 시도</button>';
    if (s.kind === 'conflict') return '<span class="pr-st bad">저장 안 됨: 그 사이 할일.md가 밖에서 바뀌었어요</span>' +
      '<button class="pr-btn" data-act="reload-discard">파일 다시 읽기 (내 변경 버림)</button><button class="pr-btn" data-act="force">내 것으로 덮어쓰기</button>';
    return '';
  }
  function paintStatus() { const e = $('#pr-status'); if (e) e.innerHTML = statusHtml(); }

  function setNotice(n, ms) {
    clearTimeout(U.noticeTimer); U.notice = n;
    if (n && ms) U.noticeTimer = setTimeout(() => { U.notice = null; paintNotice(); }, ms);
    paintNotice();
  }
  function paintNotice() {
    const e = $('#pl-notice'); if (!e) return;
    const n = U.notice;
    e.innerHTML = !n ? '' : '<div class="pl-toast' + (n.ok ? ' ok' : '') + '" role="status"><span>' + esc(n.text) + '</span>' +
      (n.undo ? '<button class="pr-btn" data-act="undo">되돌리기</button>' : '') + '<button class="pl-x" data-act="notice-close" aria-label="닫기">✕</button></div>';
  }
  function roadmapNotice(r, it) {
    if (!r) return;
    if (r.ok) setNotice({ ok: true, text: '로드맵 칸도 체크했어요 · ' + it.project }, OK_MS);
    else setNotice({ ok: false, text: r.message + ' · ' + it.project + ' "' + Array.from(it.key || it.text).slice(0, 20).join('') + '"' });
  }

  async function render(el, handle, opts) {
    U.el = el; U.handle = handle; U.opts = opts || {};
    D.onChange = onData;
    if (!el.querySelector('.pl-head')) el.innerHTML = '<p class="pj-loading">읽는 중…</p>';
    await D.load(handle, { test: !!U.opts.test });
    drawAll();
  }
  function onData(why) {
    if (!U.el || !U.el.isConnected) return;
    if (why === 'status') { paintStatus(); return; }
    if (why === 'notice') { paintPos(); if (U.ddOpen) paintDD(); return; }
    if (why === 'edit') { paintBoard(); paintPos(); if (U.ddOpen) paintDD(); paintStatus(); return; }
    if (why === 'order') { paintPos(); return; }
    if (why === 'projects') { const n = $('#pl-sum'); if (n) n.textContent = D.state.projects.length; paintPos(); if (U.ddOpen) paintDD(); return; }
  }
  function drawAll() {
    const el = U.el;
    const sum = D.state.projects.length;
    el.innerHTML =
      '<div class="pj-head pl-head"><h2>프로젝트 관리</h2><div class="pr-tools"><span id="pr-status">' + statusHtml() + '</span></div></div>' +
      (D.state.test ? '<p class="pr-ro">시연 보기예요. ' + (root.PO_PUBLIC === true ? '예시 사무실의' : '시험자료의') + ' 예시 할 일만 보이고, 고쳐도 저장하지 않아요.</p>' : canWrite() ? '' : '<p class="pr-ro">브라우저에서는 읽기만 해요. 할 일 추가·체크는 데스크톱 앱(Pixel Office)에서 할 수 있어요.</p>') +
      (D.state.err ? '<p class="pj-err">' + esc(D.state.err) + '</p>' : '') +
      '<div id="pl-notice"></div>' +
      '<div class="pl-add">' +
        '<div class="pr-seg pl-seg" role="radiogroup" aria-label="넣을 칸">' + ADD_COLS.map((c) => '<button role="radio" data-act="focus" data-col="' + c + '" aria-checked="' + (U.focus === c) + '"' + dis() + '>' + c + '</button>').join('') + '</div>' +
        '<input class="pl-in" id="pl-in" type="text" autocomplete="off" placeholder="할 일을 쓰거나, 로드맵 칸에서 고르기" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pl-dd"' + dis() + '>' +
        '<button class="pr-btn primary" data-act="add"' + dis() + '>추가</button>' +
        '<div class="pl-dd" id="pl-dd" role="listbox" hidden></div>' +
      '</div>' +
      '<div class="pl-bh"><div class="pl-view" id="pl-view" role="tablist" aria-label="할 일 보기"></div>' +
        '<p class="pl-hint"><span class="lk"><i class="lk-dot"></i>로드맵 칸에서 고른 일 · 끝내면 그 칸도 같이 체크</span><span>카드를 끌어 칸을 옮기거나, 마우스를 올려 버튼으로</span></p></div>' +
      '<div class="pl-board" id="pl-board" role="tabpanel"></div>' +
      '<div class="pl-sec-h"><h3>진행 중인 프로젝트</h3><small id="pl-sum">' + sum + '</small><span class="turn" id="pl-turn"></span>' +
        (canWrite() ? '<button class="pr-btn" data-act="mk-open" aria-expanded="' + !!U.mk + '" aria-controls="pl-mk">+ 새 프로젝트</button>' : '') +
        (canWrite() ? '<button class="pr-btn" data-act="ord-edit" aria-pressed="' + U.ordering + '">' + (U.ordering ? '순서 편집 끝' : '순서 편집') + '</button>' : '') + '</div>' +
      '<div id="pl-mk"></div>' +
      '<div class="pl-pos" id="pl-pos"></div>' +
      '<div class="pl-fold" id="pl-fold">' + foldHtml() + '</div>';
    paintNotice(); paintBoard(); paintMk(); paintPos();
    bind();
  }

  function paintView(L) {
    const e = $('#pl-view'); if (!e) return;
    const n = { 진행: L.Today.length + L.Weekly.length, 완료: L.완료.length };
    e.innerHTML = Object.keys(VIEWS).map((v) => '<button role="tab" data-act="view" data-view="' + v + '" aria-selected="' + (U.view === v) + '" tabindex="' + (U.view === v ? 0 : -1) + '">' +
      '<i class="sw ' + (v === '완료' ? 'done' : 'go') + '"></i>' + v + '<b>' + n[v] + '</b></button>').join('');
  }
  function setView(v) {
    if (!VIEWS[v] || U.view === v) return;
    U.view = v; U.editing = null; paintBoard();
  }
  function cardHtml(it, col) {
    const done = col === '완료';
    const chips = done ? '' : '<div class="pl-ops">' + ADD_COLS.filter((c) => c !== col).map((c) => '<button data-act="mv" data-col="' + c + '" tabindex="-1">' + c + '</button>').join('') + '<button class="x" data-act="del" tabindex="-1" aria-label="지우기">✕</button></div>';
    const text = U.editing === it.id ? '<input class="pl-edit" value="' + esc(it.text) + '" aria-label="할 일 고치기">' : '<span class="pl-tx" title="' + esc(it.text) + '"' + (done || !canWrite() ? '' : ' data-act="edit"') + '>' + esc(it.text) + '</span>';
    const meta = (done && it.date ? '<span class="pl-date">' + md(dnum(it.date)) + '</span>' : '') +
      (it.project ? '<span class="pl-pj"' + (it.linked ? ' title="끝내면 로드맵 칸도 같이 체크해요"' : '') + '>' + (it.linked ? '<i class="lk-dot"></i>' : '') + esc(it.project) + '</span>' : (it.linked ? '<i class="lk-dot" title="끝내면 로드맵 칸도 같이 체크해요"></i>' : ''));
    return '<div class="pl-card" data-id="' + it.id + '" tabindex="0">' +
      '<div class="pl-row"><button class="pl-chk' + (done ? ' on' : '') + '" role="checkbox" aria-checked="' + done + '" data-act="chk" aria-label="' + (done ? '체크 끄기' : '끝냄') + '"' + dis() + '></button>' + text + '</div>' +
      (meta ? '<div class="pl-meta">' + meta + '</div>' : '') + (canWrite() ? chips : '') + '</div>';
  }
  function paintBoard() {
    const e = $('#pl-board'); if (!e) return;
    const L = D.lists(), t = dnum(D.today());
    paintView(L);
    e.className = 'pl-board ' + (U.view === '완료' ? 'v-done' : 'v-go');
    e.innerHTML = COLS.filter(([key]) => VIEWS[U.view].indexOf(key) >= 0).map(([key, cls]) => {
      let list = L[key], more = '';
      if (key === '완료') {
        const recent = list.filter((it) => !(t - dnum(it.date) >= DONE_DAYS));
        const old = list.length - recent.length;
        if (!U.oldDone && old) { list = recent; more = '<button class="pl-more" data-act="old-done">지난 완료 ' + old + '개 보기</button>'; }
      }
      return '<section class="pl-col ' + cls + '" data-col="' + key + '"><h4>' + key + ' <b>' + L[key].length + '</b><small>' + esc(colNote(key)) + '</small></h4>' +
        '<div class="pl-list">' + (list.length ? list.map((it) => cardHtml(it, key)).join('') : '<p class="pl-empty">' + esc(EMPTY[key]) + '</p>') + '</div>' + more + '</section>';
    }).join('');
    const ed = e.querySelector('.pl-edit'); if (ed) { ed.focus(); ed.select(); }
  }

  function flatCells(v) { const out = []; (v.segments || []).forEach((s, si) => (s.cells || []).forEach((c, k) => out.push({ si, k, s, c }))); return out; }
  const nowIdx = (v) => flatCells(v).findIndex((x) => x.c.top);
  function scrubOf(v) {
    if (!U.scrub || U.scrub.project !== v.project) return null;
    const f = flatCells(v); if (!f.length) return null;
    const idx = Math.max(0, Math.min(f.length - 1, U.scrub.idx));
    return Object.assign({ idx }, f[idx]);
  }
  const pct = (f) => (f * 100).toFixed(2) + '%';
  function bar(v) {
    const segs = v.segments || [];
    const now = segs.find((s) => s.now);
    const label = v.project + ' 전체 ' + v.progress.done + '/' + v.progress.total + (now ? ', 지금 ' + (now.label || now.tick) + ' ' + now.done + '/' + now.n : '');
    const sc = scrubOf(v), total = segs.reduce((a, s) => a + s.n, 0), at = sc ? sc.idx : Math.max(0, nowIdx(v));
    return '<div class="pl-bar' + (sc ? ' scrub' : '') + (U.barMs ? ' ms' : '') + '" role="slider" tabindex="0" data-p="' + esc(v.project) + '" aria-label="' + esc(label + '. 핀을 끌면 칸 내용을 봐요') + '" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="' + (at + 1) + '">' +
      segs.map((s, si) => '<i class="' + [s.now ? 'now' : '', s.later ? 'later' : '', s.done === 0 ? 'f0' : '', s.done === s.n ? 'full' : ''].filter(Boolean).join(' ') + '" style="--n:' + s.n + ';--f:' + Math.round((s.done / s.n) * 100) + '%"' + (sc ? '' : ' title="' + esc((s.label || '맨 위') + ' ' + s.done + '/' + s.n) + '"') + '>' +
        (sc && sc.si === si ? '<s class="pl-sel" style="left:' + pct(sc.k / s.n) + ';width:' + pct(1 / s.n) + '"></s><u class="pl-pin" style="left:' + pct(U.scrub.frac != null ? U.scrub.frac : sc.k / s.n) + '"></u>' : '') + '</i>').join('') + '</div>' +
      '<div class="pl-ticks">' + segs.map((s) => '<span class="' + (s.now ? 'now' : '') + '" style="--n:' + s.n + '">' + esc(s.tick) + '</span>').join('') + '<em>' + v.progress.done + '/' + v.progress.total + '</em></div>';
  }
  function peekHtml(v, sc) {
    const chip = sc.c.top ? '<span class="pl-chip now">지금 할 일</span>' : sc.c.done ? '<span class="pl-chip ok">끝남</span>' : '';
    return '<div class="pl-top peek"><div class="lab">' + esc(sc.s.name || sc.s.label || '맨 위') + ' · ' + (sc.k + 1) + '/' + sc.s.n + '번째 칸</div>' +
      '<p class="tx' + (sc.c.done ? ' done' : '') + '">' + esc(sc.c.text) + '</p><div class="act">' + chip + who(sc.c.owners, false) + '</div></div>';
  }
  const rowOf = (project) => U.el && Array.from(U.el.querySelectorAll('#pl-pos .pl-p')).find((r) => r.dataset.p === project);
  function repaintRow(project) {
    const row = rowOf(project), pv = D.projectsView(), i = pv.findIndex((x) => x.project === project);
    if (!row || i < 0) return;
    const a = document.activeElement, refocus = a && row.contains(a) && a.classList.contains('pl-bar');
    row.outerHTML = posRow(pv[i], i, pv);
    if (refocus) { const b = rowOf(project).querySelector('.pl-bar'); if (b) b.focus(); }
  }
  function setScrub(v, idx, frac) {
    const f = flatCells(v); if (!f.length) return;
    idx = Math.max(0, Math.min(f.length - 1, idx));
    if (U.scrub && U.scrub.project === v.project && U.scrub.idx === idx) return;
    U.scrub = { project: v.project, idx, frac: frac == null ? null : frac };
    repaintRow(v.project);
  }
  function clearScrub(project) { if (U.scrub && U.scrub.project === project) { U.scrub = null; repaintRow(project); } }
  function scrubAt(v, x) {
    const row = rowOf(v.project), b = row && row.querySelector('.pl-bar'); if (!b) return;
    let base = 0, best = null;
    b.querySelectorAll(':scope > i').forEach((el, si) => {
      const r = el.getBoundingClientRect(), n = v.segments[si].n;
      const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const f = Math.max(0, Math.min(1, (x - r.left) / r.width));
      if (!best || d < best.d) best = { d, f, idx: base + Math.min(n - 1, Math.floor(f * n)) };
      base += n;
    });
    if (!best) return;
    const same = U.scrub && U.scrub.project === v.project && U.scrub.idx === best.idx;
    if (same) { U.scrub.frac = best.f; const pin = b.querySelector('.pl-pin'); if (pin) pin.style.left = pct(best.f); return; }
    setScrub(v, best.idx, best.f);
  }
  function startScrub(barEl, e) {
    e.preventDefault(); U.barMs = true;
    const v = D.projectsView().find((x) => x.project === barEl.dataset.p); if (!v) return;
    document.body.classList.add('pl-scrubbing');
    const move = (ev) => scrubAt(v, ev.clientX);
    const up = () => {
      root.removeEventListener('pointermove', move);
      document.body.classList.remove('pl-scrubbing');
      if (U.scrub && U.scrub.project === v.project && U.scrub.frac != null) { U.scrub.frac = null; if (U.scrub.idx !== nowIdx(v)) repaintRow(v.project); }
      if (U.scrub && U.scrub.project === v.project && U.scrub.idx === nowIdx(v)) clearScrub(v.project);
      const r = rowOf(v.project), b = r && r.querySelector('.pl-bar'); if (b) b.focus({ preventScroll: true });
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up, { once: true });
    scrubAt(v, e.clientX);
  }
  function descHtml(v, cls) {
    cls = cls || 'pl-goal';
    return v.desc ? '<p class="' + cls + '" data-src="' + v.descSrc + '" title="' + esc(v.descTitle + ': ' + v.desc) + '">' + esc(v.desc) + '</p>' : '<p class="' + cls + ' none" data-src="none">설명 없음</p>';
  }
  const taskBtn = (v) => (canWrite() ? '<button class="pl-taskb" data-act="task-open" data-p="' + esc(v.project) + '" aria-expanded="' + !!(U.task && U.task.project === v.project) + '">+ 할 일</button>' : '');
  const rowCls = (v) => 'pl-p' + (U.hl === v.project ? ' hl' : '');
  const formOf = (v) => (U.task && U.task.project === v.project ? taskFormHtml(v) : '');
  function nameHtml(v, i, n) {
    if (!canWrite() || i == null) return '<h5>' + esc(v.project) + '</h5>';
    const P = esc(v.project), b = (to, fk, txt, lab) => '<button data-act="ord" data-p="' + P + '" data-to="' + to + '" data-fk="' + fk + ':' + P + '" aria-label="' + esc(v.project) + ' ' + lab + '"' + (to < 0 || to >= n || to === i ? ' disabled' : '') + '>' + txt + '</button>';
    return '<div class="pl-name"><button class="pl-grip" data-p="' + P + '" data-fk="grip:' + P + '" aria-label="' + P + ' 순서 옮기기 (끌거나 ↑↓ 키)" title="끌어서 순서 바꾸기"></button><h5>' + P + '</h5>' +
      (U.ordering ? '<span class="pl-ord">' + b(0, 'top', '맨 위', '맨 위로') + b(i - 1, 'up', '↑', '위로') + b(i + 1, 'down', '↓', '아래로') + '</span>' : '') + '</div>';
  }
  function posRow(v, i, all) {
    const left = '<div>' + nameHtml(v, i, all && all.length) + descHtml(v) + '</div>';
    if (v.state === 'empty' || v.state === 'done') {
      return '<div class="' + rowCls(v) + '" data-p="' + esc(v.project) + '">' + left + '<div class="pl-stage"><b>' + (v.state === 'done' ? '다 끝남' : '칸 없음') + '</b></div><div class="pl-top">' + (canWrite() ? '<div class="act">' + taskBtn(v) + '</div>' : '') + '</div>' + formOf(v) + '</div>';
    }
    const stage = v.state === 'later' ? '단계 끝' : v.stageLabel;
    const back = scrubOf(v) ? '<button class="pl-back" data-act="scrub-off" data-p="' + esc(v.project) + '">지금 할 일로</button>' : '';
    const mid = '<div><div class="pl-stage"><b title="' + esc(stage) + '">' + esc(stage) + '</b>' + (back || (v.state === 'now' ? '<small><span class="w">지금 단계 </span>남은 칸 ' + v.stageProgress.open + '/' + v.stageProgress.total + '</small>' : '')) + '</div>' + bar(v) + '</div>';
    let right;
    const sc = scrubOf(v);
    if (sc) right = peekHtml(v, sc);
    else if (v.state === 'later') right = '<div class="pl-top"><div class="lab">지금 할 일</div><p class="end">나중에 할 일 ' + (v.stageLabel.match(/(\d+)개/) || [0, 0])[1] + '개</p>' + (canWrite() ? '<div class="act">' + taskBtn(v) + '</div>' : '') + '</div>';
    else {
      const add = v.cell.inTodo ? '<span class="pl-inT">Today에 있음</span>' : canWrite() ? '<button data-act="add-top" data-p="' + esc(v.project) + '">+ Today</button>' : '';
      right = '<div class="pl-top"><div class="lab">지금 할 일</div><p class="tx">' + esc(v.cell.full) + '</p><div class="act">' + who(v.owners, v.ownerTurn) + taskBtn(v) + add + '</div></div>';
    }
    return '<div class="' + rowCls(v) + '" data-p="' + esc(v.project) + '">' + left + mid + right + formOf(v) + '</div>';
  }
  function paintPos() {
    const e = $('#pl-pos'); if (!e) return;
    const fx = focusKey();
    e.classList.toggle('ordering', U.ordering && canWrite());
    const pv = D.projectsView(), nm = D.noRoadmap();
    const rows = pv.map((v, i) => posRow(v, i, pv));
    if (nm.length) rows.push('<div class="pl-nomap-h">로드맵 없음 ' + nm.length + '</div>' + nm.map((v) => '<div class="pl-p nomap" data-p="' + esc(v.project) + '"><h5>' + esc(v.project) + '</h5>' + descHtml(v) + '</div>').join(''));
    e.innerHTML = rows.length ? rows.join('') : '<p class="pl-empty dark">' + (canWrite() ? '진행 중인 프로젝트가 아직 없어요. 오른쪽 위 [+ 새 프로젝트]로 만들어 보세요.' : '진행 중인 프로젝트 폴더를 못 읽었어요.') + '</p>';
    restoreFocus(fx);
    const t = $('#pl-turn'); if (t) { const n = pv.filter((v) => v.cell && v.ownerTurn).length; t.innerHTML = n ? (root.PO_NM || String)('<i></i>당니님 차례 ') + n : ''; }
  }
  function foldHtml() {
    const A = D.archive();
    return [['완료', 'fin'], ['보류', 'hold']].map(([k, cls]) => {
      const list = A[k] || [];
      const items = list.length ? '<ul>' + list.map((a) => '<li data-p="' + esc(a.project) + '"><b>' + esc(a.project) + '</b>' + descHtml(a, 'pl-fdesc') +
        (a.hasRoadmap && a.total ? '<span class="mini" title="로드맵 체크 ' + a.done + '/' + a.total + '"><span><i style="width:' + Math.round((a.done / a.total) * 100) + '%"></i></span>' + a.done + '/' + a.total + '</span>' : '') + '</li>').join('') + '</ul>'
        : '<p class="pr-empty">' + (D.state.test ? '시연 보기에서는 비워 둬요.' : '없어요.') + '</p>';
      return '<details class="' + cls + '" data-fold="' + k + '"><summary><b>' + k + '</b><span class="n">' + list.length + '</span><small>' + esc(list.map((a) => a.project).join(', ')) + '</small></summary>' + items + '</details>';
    }).join('');
  }

  function focusKey() { const a = document.activeElement; return a && U.el && U.el.contains(a) && a.dataset && a.dataset.fk ? { k: a.dataset.fk, s: a.selectionStart, e: a.selectionEnd } : null; }
  function restoreFocus(fx) {
    if (!fx) return;
    const t = U.el.querySelector('[data-fk="' + fx.k + '"]'); if (!t) return;
    t.focus({ preventScroll: true });
    if (t.setSelectionRange && fx.s != null) try { t.setSelectionRange(fx.s, fx.e); } catch (e) {  }
  }
  const msgHtml = (f) => (f.err ? '<p class="pl-addmsg" role="alert">' + esc(f.err) + '</p>' : '');
  function paintMk() {
    const e = $('#pl-mk'); if (!e) return;
    const fx = focusKey(), f = U.mk;
    const b = $('[data-act="mk-open"]'); if (b) b.setAttribute('aria-expanded', String(!!f));
    e.innerHTML = !f ? '' : '<div class="pl-add pl-addpj" role="group" aria-label="새 프로젝트 만들기">' +
      '<input class="pl-in" id="pl-mk-in" data-fk="mk-in" type="text" autocomplete="off" maxlength="' + (root.POCore.PROJECT_NAME_MAX + 10) + '" placeholder="새 프로젝트 이름" aria-label="새 프로젝트 이름" value="' + esc(f.value) + '"' + (f.busy ? ' disabled' : '') + (f.err ? ' aria-invalid="true"' : '') + '>' +
      msgHtml(f) + '<button class="pr-btn primary" data-act="mk-ok" data-fk="mk-ok"' + (f.busy ? ' disabled' : '') + '>만들기</button><button class="pr-btn" data-act="mk-cancel" data-fk="mk-cancel">취소</button></div>';
    restoreFocus(fx);
  }
  function openMk() { if (!canWrite()) return; if (!U.mk) U.mk = { value: '', err: '', busy: false }; paintMk(); const i = $('#pl-mk-in'); if (i) i.focus(); }
  function closeMk(focusBtn) { U.mk = null; paintMk(); if (focusBtn) { const b = $('[data-act="mk-open"]'); if (b) b.focus(); } }
  async function submitMk() {
    const f = U.mk; if (!f || f.busy) return;
    const inp = $('#pl-mk-in'); if (inp) f.value = inp.value;
    f.busy = true; f.err = ''; paintMk();
    const r = await D.createProject(f.value);
    f.busy = false;
    if (!r.ok) { f.err = r.error; paintMk(); const i = $('#pl-mk-in'); if (i) { i.focus(); i.select(); } return; }
    U.mk = null; paintMk();
    flash(r.project);
    setNotice({ ok: true, text: '‘' + r.project + '’ 프로젝트를 만들었어요.' }, OK_MS);
    const mb = $('[data-act="mk-open"]'); if (mb) mb.focus({ preventScroll: true });
  }
  const cssq = (v) => (root.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
  function flash(project) {
    U.hl = project; paintPos();
    const row = $('.pl-p[data-p="' + cssq(project) + '"]'); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    clearTimeout(U.hlTimer); U.hlTimer = setTimeout(() => { U.hl = null; const r2 = $('.pl-p.hl'); if (r2) r2.classList.remove('hl'); }, 2400);
  }
  function whoPill(name, key, on) {
    const pc = (key && LN.POINT && LN.POINT[key]) || '#9aa1ab';
    return '<button type="button" class="pl-who" role="radio" data-act="own" data-own="' + esc(name) + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" style="--pc:' + esc(pc) + '">' + esc(name || '없음') + '</button>';
  }
  function taskFormHtml(v) {
    const f = U.task, ch = D.ownerChoices().concat([{ name: '', key: null }]);
    const w = D.addWhere(v.project) || {};
    const where = w.label ? '<b>' + esc(w.label) + '</b> 끝에 넣어요' + (w.where === 'last' && v.state !== 'empty' ? ' (지금 단계가 없어서 마지막 단계에)' : '') : '맨 위 칸들 끝에 넣어요';
    return '<div class="pl-add" role="group" aria-label="' + esc(v.project) + ' 할 일 넣기"><p class="pl-addwhere">' + where + '</p>' +
      '<input class="pl-in" id="pl-task-in" data-fk="task-in" type="text" autocomplete="off" maxlength="' + (root.POCore.TASK_MAX + 10) + '" placeholder="할 일 한 줄" aria-label="할 일" value="' + esc(f.value) + '"' + (f.busy ? ' disabled' : '') + (f.err ? ' aria-invalid="true"' : '') + '>' +
      msgHtml(f) + '<button class="pr-btn primary" data-act="task-ok" data-fk="task-ok"' + (f.busy ? ' disabled' : '') + '>넣기</button><button class="pr-btn" data-act="task-cancel" data-fk="task-cancel">취소</button>' +
      '<div class="pl-whos" role="radiogroup" aria-label="담당"><span>담당</span>' + ch.map((o) => whoPill(o.name, o.key, o.name === f.owner)).join('') + '</div></div>';
  }
  function openTask(project) {
    if (!canWrite()) return;
    if (U.task && U.task.project === project) { closeTask(true); return; }
    const v = D.projectsView().find((x) => x.project === project);
    const ch = D.ownerChoices();
    const cur = v && v.owners && v.owners[0] && ch.some((o) => o.name === v.owners[0]) ? v.owners[0] : '';
    U.task = { project, value: '', owner: cur, err: '', busy: false };
    paintPos();
    const i = $('#pl-task-in'); if (i) i.focus();
  }
  function closeTask(focusBtn) {
    const p = U.task && U.task.project; U.task = null; paintPos();
    if (focusBtn && p) { const b = $('.pl-taskb[data-p="' + cssq(p) + '"]'); if (b) b.focus(); }
  }
  function pickOwner(name, focus) {
    if (!U.task) return;
    U.task.owner = name;
    U.el.querySelectorAll('.pl-whos .pl-who').forEach((x) => { const on = x.dataset.own === name; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; if (on && focus) x.focus(); });
  }
  async function submitTask() {
    const f = U.task; if (!f || f.busy) return;
    const inp = $('#pl-task-in'); if (inp) f.value = inp.value;
    f.busy = true; f.err = ''; paintPos();
    const r = await D.addTask(f.project, f.value, f.owner);
    f.busy = false;
    if (!r.ok) { f.err = r.error; paintPos(); const i = $('#pl-task-in'); if (i) i.focus(); return; }
    U.task = null;
    flash(f.project);
    setNotice({ ok: true, text: '로드맵에 넣었어요 · ' + f.project + (r.label ? ' ' + r.label : '') + ' 끝' + (r.where === 'last' ? ' (지금 단계가 없어서 마지막 단계에)' : '') }, OK_MS);
    const b = $('.pl-taskb[data-p="' + cssq(f.project) + '"]'); if (b) b.focus({ preventScroll: true });
  }
  function hasDraft() {
    const inp = $('#pl-in'), ed = $('.pl-edit'), mk = $('#pl-mk-in'), tk = $('#pl-task-in');
    return !!((inp && inp.value.trim()) || (ed && ed.value.trim() !== ed.defaultValue.trim()) || (mk && mk.value.trim()) || (tk && tk.value.trim()));
  }
  async function autoRefresh() {
    if (!U.el || !U.el.isConnected || !D.state.loaded || U.drag || U.ddOpen || U.editing != null || U.mk || U.task || hasDraft()) return false;
    const st = D.status().kind; if (st === 'pending' || st === 'saving' || st === 'conflict' || st === 'error') return false;
    const before = D.sig();
    await D.load(U.handle, { test: !!U.opts.test });
    if (!U.el.isConnected || D.sig() === before) return false;
    if (U.drag || U.ddOpen || U.editing != null || U.mk || U.task || hasDraft()) { paintPos(); return true; }
    drawAll();
    return true;
  }
  async function refresh() {
    if (!U.el) return;
    await D.flush();
    U.mk = null; U.task = null; U.editing = null; U.ddOpen = false;
    await render(U.el, U.handle, U.opts);
  }

  function hl(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function buildRows() {
    const q = U.query.trim(), rows = [];
    const hasRoadmap = D.state.projects.some((p) => p.parsed);
    if (!hasRoadmap) return [{ t: 'msg', text: '로드맵을 못 읽어서 추천이 없어요. 직접 써 넣을 수 있어요.' }].concat(q ? [{ t: 'raw', text: q }] : []);
    const list = D.suggestions(q);
    const byProject = (arr) => { const m = new Map(); arr.forEach((s) => { if (!m.has(s.project)) m.set(s.project, []); m.get(s.project).push(s); }); return m; };
    if (!q) {
      const dn = list.filter((s) => s.why === 'dangnee'), top = list.filter((s) => s.why === 'top');
      if (!list.length) return [{ t: 'msg', text: '추천할 칸이 없어요. 할 일을 직접 써 넣으세요.' }];
      if (dn.length) {
        rows.push({ t: 'h', html: (root.PO_NM || String)('당니님 차례 <small>지금 단계까지</small>') });
        byProject(dn).forEach((arr, pj) => {
          rows.push({ t: 'grp', project: pj, stage: arr[0].stageLabel, n: arr.length });
          const open = U.expanded.has(pj), shown = open ? arr : arr.slice(0, DD_FOLD);
          shown.forEach((s) => rows.push({ t: 'opt', s, who: false }));
          if (arr.length > DD_FOLD) rows.push({ t: 'more', project: pj, n: arr.length - DD_FOLD, open });
        });
      }
      if (top.length) {
        rows.push({ t: 'h', html: '프로젝트 맨 위 칸' });
        top.forEach((s) => { rows.push({ t: 'grp', project: s.project, stage: s.stageLabel }); rows.push({ t: 'opt', s, who: true }); });
      }
      return rows;
    }
    rows.push({ t: 'h', html: '찾은 칸 ' + list.length + '개 <small>나중에 할 일까지</small>' });
    byProject(list).forEach((arr, pj) => { rows.push({ t: 'grp', project: pj, stage: '' }); arr.forEach((s) => rows.push({ t: 'opt', s, who: true, q })); });
    if (!list.length) rows.push({ t: 'msg', text: '맞는 로드맵 칸이 없어요.' });
    rows.push({ t: 'raw', text: q });
    return rows;
  }
  const selectable = (r) => r.t === 'opt' || r.t === 'more' || r.t === 'raw';
  function paintDD() {
    const dd = $('#pl-dd'), inp = $('#pl-in'); if (!dd) return;
    if (!U.ddOpen) { dd.hidden = true; if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); } return; }
    U.ddRows = buildRows();
    const sel = U.ddRows.filter(selectable);
    if (U.ddSel >= sel.length) U.ddSel = Math.max(0, sel.length - 1);
    let k = -1;
    const html = U.ddRows.map((r, i) => {
      if (r.t === 'h') return '<h5>' + r.html + '</h5>';
      if (r.t === 'msg') return '<p class="pl-dd-msg">' + esc(r.text) + '</p>';
      if (r.t === 'grp') return '<div class="grp"><b>' + esc(r.project) + '</b>' + (r.stage ? '<span>' + esc(r.stage) + '</span>' : '') + '</div>';
      k++;
      const on = k === U.ddSel ? ' sel' : '', id = 'pl-o' + k;
      if (r.t === 'more') return '<div class="pl-opt pl-ddmore' + on + '" id="' + id + '" role="option" aria-selected="' + !!on + '" data-row="' + i + '"><span class="tx">' + (r.open ? '접기' : r.n + '개 더') + '</span></div>';
      if (r.t === 'raw') return '<div class="pl-opt raw' + on + '" id="' + id + '" role="option" aria-selected="' + !!on + '" data-row="' + i + '"><span class="tx">\'' + esc(r.text) + '\' 그대로 넣기 <small>· 로드맵과 잇지 않음</small></span></div>';
      return '<div class="pl-opt' + on + '" id="' + id + '" role="option" aria-selected="' + !!on + '" data-row="' + i + '" title="' + esc(r.s.text) + '"><span class="tx">' + hl(r.s.label, r.q) + '</span>' + (r.who ? who(r.s.owners, !r.s.owners.length) : '') + '</div>';
    }).join('');
    dd.innerHTML = '<div class="pl-dd-list">' + html + '</div><div class="pl-dd-foot"><span>↑↓ 고르기 · Enter ' + esc(U.focus) + '에 넣기 · Esc 닫기</span></div>';
    dd.hidden = false;
    if (inp) { const add = $('.pl-add [data-act="add"]'); dd.style.left = inp.offsetLeft + 'px'; if (add) dd.style.right = (add.offsetParent.clientWidth - add.offsetLeft + 8) + 'px'; }
    if (inp) { inp.setAttribute('aria-expanded', 'true'); if (sel.length) inp.setAttribute('aria-activedescendant', 'pl-o' + U.ddSel); else inp.removeAttribute('aria-activedescendant'); }
    const cur = dd.querySelector('.pl-opt.sel'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function openDD() { if (!canWrite()) return; U.ddOpen = true; paintDD(); }
  function closeDD() { U.ddOpen = false; paintDD(); }
  function pickRow(r) {
    if (!r) return;
    if (r.t === 'more') { if (U.expanded.has(r.project)) U.expanded.delete(r.project); else U.expanded.add(r.project); paintDD(); return; }
    if (r.t === 'raw') { addRaw(r.text); return; }
    if (r.t === 'opt') { D.add(U.focus, r.s); afterAdd(); }
  }
  function addRaw(text) { const t = String(text || '').trim(); if (!t) return; D.add(U.focus, t); afterAdd(); }
  function afterAdd() {
    if (U.view !== '진행') setView('진행'); const inp = $('#pl-in'); U.query = ''; if (inp) { inp.value = ''; inp.focus(); } U.ddSel = 0; closeDD(); }

  async function doToggle(id, done) {
    const it = D.lists(); const all = [].concat(it.Today, it.Weekly, it.완료); const x = all.find((y) => y.id === id);
    const r = await D.toggle(id, done);
    if (x) roadmapNotice(r.roadmap, x);
  }
  async function doMove(id, col, index) {
    const L = D.lists(); const all = [].concat(L.Today, L.Weekly, L.완료); const x = all.find((y) => y.id === id);
    const r = await D.move(id, col, index);
    if (x) roadmapNotice(r.roadmap, x);
    focusCard(id);
  }
  function focusCard(id) { const c = $('.pl-card[data-id="' + id + '"]'); if (c) c.focus(); }
  function colOf(id) { const L = D.lists(); for (const [k] of COLS) { const i = L[k].findIndex((x) => x.id === id); if (i >= 0) return { col: k, index: i, len: L[k].length }; } return null; }
  function commitEdit(input, keep) {
    const id = U.editing; U.editing = null;
    const v = input.value.trim();
    if (keep && v) D.update(id, { text: v }); else paintBoard();
    focusCard(id);
  }

  function bind() {
    const el = U.el;
    el.onclick = (e) => {
      if (Date.now() < U.clickGuard) { e.preventDefault(); return; }
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      const act = b.dataset.act, card = b.closest('.pl-card'), id = card ? +card.dataset.id : null;
      if (act === 'retry') D.save();
      else if (act === 'force') D.save(true);
      else if (act === 'reload-discard') D.reloadDiscard().then(drawAll);
      else if (act === 'mk-open') { if (U.mk) closeMk(true); else openMk(); }
      else if (act === 'mk-ok') submitMk();
      else if (act === 'mk-cancel') closeMk(true);
      else if (act === 'task-open') openTask(b.dataset.p);
      else if (act === 'own') pickOwner(b.dataset.own, true);
      else if (act === 'task-ok') submitTask();
      else if (act === 'task-cancel') closeTask(true);
      else if (act === 'focus') { U.focus = b.dataset.col; saveFocus(); el.querySelectorAll('.pl-seg button').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.col === U.focus))); if (U.ddOpen) paintDD(); }
      else if (act === 'add') addRaw($('#pl-in').value);
      else if (act === 'chk') doToggle(id, b.getAttribute('aria-checked') !== 'true');
      else if (act === 'mv') doMove(id, b.dataset.col);
      else if (act === 'del') { const snap = D.remove(id); if (snap) setNotice({ ok: true, text: '지웠어요', undo: snap }, UNDO_MS); }
      else if (act === 'undo') { if (U.notice && U.notice.undo) D.restore(U.notice.undo); setNotice(null); }
      else if (act === 'notice-close') setNotice(null);
      else if (act === 'edit') { U.editing = id; paintBoard(); }
      else if (act === 'old-done') { U.oldDone = true; paintBoard(); }
      else if (act === 'add-top') { if (U.view !== '진행') U.view = '진행'; D.addTop(b.dataset.p, 'Today'); }
      else if (act === 'scrub-off') clearScrub(b.dataset.p);
      else if (act === 'ord-edit') { U.ordering = !U.ordering; b.setAttribute('aria-pressed', String(U.ordering)); b.textContent = U.ordering ? '순서 편집 끝' : '순서 편집'; paintPos(); }
      else if (act === 'ord') moveTo(b.dataset.p, +b.dataset.to);
      else if (act === 'view') { setView(b.dataset.view); const t = $('#pl-view [aria-selected="true"]'); if (t) t.focus(); }
    };
    const inp = $('#pl-in'), dd = $('#pl-dd');
    if (inp) {
      inp.onfocus = () => openDD();
      inp.oninput = () => { U.query = inp.value; U.ddSel = 0; openDD(); };
      inp.onblur = () => setTimeout(() => { if (document.activeElement !== inp) closeDD(); }, 120);
      inp.onkeydown = (e) => {
        const n = U.ddRows.filter(selectable).length;
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!U.ddOpen) openDD(); else { U.ddSel = Math.min(n - 1, U.ddSel + 1); paintDD(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (U.ddOpen) { U.ddSel = Math.max(0, U.ddSel - 1); paintDD(); } }
        else if (e.key === 'Enter') {
          e.preventDefault();
          if (U.ddOpen && n) pickRow(U.ddRows.filter(selectable)[U.ddSel]);
          else addRaw(inp.value);
        }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDD(); }
        else if (e.key === 'Tab') closeDD();
      };
    }
    if (dd) {
      dd.onmousedown = (e) => { e.preventDefault(); };
      dd.onclick = (e) => { const o = e.target.closest('[data-row]'); if (o) pickRow(U.ddRows[+o.dataset.row]); };
    }
    el.oninput = (e) => {
      const f = e.target.id === 'pl-mk-in' ? U.mk : e.target.id === 'pl-task-in' ? U.task : null;
      if (!f) return;
      f.value = e.target.value;
      if (f.err) { f.err = ''; const m = e.target.parentNode.querySelector('.pl-addmsg'); if (m) m.remove(); e.target.removeAttribute('aria-invalid'); }
    };
    el.onkeydown = (e) => {
      const fm = e.target.closest && (e.target.closest('.pl-addpj') || e.target.closest('.pl-p .pl-add'));
      if (fm && !e.isComposing) {
        const mk = fm.classList.contains('pl-addpj');
        const pill = e.target.closest('.pl-whos .pl-who');
        if (pill && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0) {
          e.preventDefault();
          const all = [...fm.querySelectorAll('.pl-whos .pl-who')], i = all.indexOf(pill), d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          pickOwner(all[(i + d + all.length) % all.length].dataset.own, true);
        }
        else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (mk) submitMk(); else submitTask(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (mk) closeMk(true); else closeTask(true); }
        return;
      }
      const ed = e.target.closest && e.target.closest('.pl-edit');
      if (ed) { if (e.key === 'Enter') { e.preventDefault(); commitEdit(ed, true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commitEdit(ed, false); } return; }
      const tab = e.target.closest && e.target.closest('#pl-view [role="tab"]');
      if (tab && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); setView(U.view === '진행' ? '완료' : '진행'); const t = $('#pl-view [aria-selected="true"]'); if (t) t.focus(); return; }
      if (e.target.classList && e.target.classList.contains('pl-grip') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const i = D.projectsView().findIndex((x) => x.project === e.target.dataset.p);
        if (i >= 0) moveTo(e.target.dataset.p, i + (e.key === 'ArrowUp' ? -1 : 1));
        return;
      }
      if (e.key === 'Escape' && U.rowDrag) { endRowDrag(false); return; }
      if (e.target.classList && e.target.classList.contains('pl-bar')) {
        const v = D.projectsView().find((x) => x.project === e.target.dataset.p); if (!v) return;
        const cur = U.scrub && U.scrub.project === v.project ? U.scrub.idx : Math.max(0, nowIdx(v)), last = flatCells(v).length - 1;
        const to = { ArrowLeft: cur - 1, ArrowDown: cur - 1, ArrowRight: cur + 1, ArrowUp: cur + 1, Home: 0, End: last }[e.key];
        if (to != null) { e.preventDefault(); U.barMs = false; e.target.classList.remove('ms'); setScrub(v, to); }
        else if (e.key === 'Escape' && U.scrub) { e.preventDefault(); clearScrub(v.project); }
        return;
      }
      const card = e.target.classList && e.target.classList.contains('pl-card') ? e.target : null;
      if (e.key === 'Escape' && U.drag) { cancelDrag(); return; }
      if (!card || !e.altKey || !canWrite()) return;
      const id = +card.dataset.id, w = colOf(id); if (!w) return;
      const ci = ADD_COLS.indexOf(w.col);
      if (e.key === 'ArrowLeft' && ci > 0) { e.preventDefault(); doMove(id, ADD_COLS[ci - 1]); }
      else if (e.key === 'ArrowRight' && ci >= 0 && ci < ADD_COLS.length - 1) { e.preventDefault(); doMove(id, ADD_COLS[ci + 1]); }
      else if (e.key === 'ArrowUp' && w.index > 0 && w.col !== '완료') { e.preventDefault(); doMove(id, w.col, w.index - 1); }
      else if (e.key === 'ArrowDown' && w.index < w.len - 1 && w.col !== '완료') { e.preventDefault(); doMove(id, w.col, w.index + 1); }
    };
    el.addEventListener('focusout', (e) => { const ed = e.target.closest && e.target.closest('.pl-edit'); if (ed && U.editing != null) commitEdit(ed, true); });
    el.onpointerdown = onDown;
  }

  async function moveTo(project, to) {
    const ok = await D.moveProject(project, to);
    if (!ok) drawAll();
  }
  const posRows = () => Array.from(U.el.querySelectorAll('#pl-pos > .pl-p:not(.nomap)'));
  function startRowDrag(grip, e) {
    e.preventDefault();
    const row = grip.closest('.pl-p');
    U.rowDrag = { project: grip.dataset.p, row, y0: e.clientY, on: false, ins: null, to: null };
    root.addEventListener('pointermove', onRowMove);
    root.addEventListener('pointerup', onRowUp, { once: true });
  }
  function onRowMove(e) {
    const d = U.rowDrag; if (!d) return;
    if (!d.on) {
      if (Math.abs(e.clientY - d.y0) < DRAG_PX) return;
      d.on = true; d.row.classList.add('ghost'); document.body.classList.add('pl-dragging');
      d.ins = document.createElement('div'); d.ins.className = 'pl-ins pl-row-ins';
    }
    if (e.clientY < 60 || e.clientY > root.innerHeight - 60) {
      let sc = d.row.parentElement; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      const dy = e.clientY < 60 ? -14 : 14;
      if (sc && sc !== document.body) sc.scrollBy(0, dy); else root.scrollBy(0, dy);
    }
    const others = posRows().filter((r) => r !== d.row);
    let to = others.findIndex((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (to < 0) to = others.length;
    d.to = to;
    if (to < others.length) others[to].before(d.ins); else others[others.length - 1].after(d.ins);
  }
  function endRowDrag(commit) {
    const d = U.rowDrag; U.rowDrag = null;
    root.removeEventListener('pointermove', onRowMove);
    root.removeEventListener('pointerup', onRowUp);
    document.body.classList.remove('pl-dragging');
    if (!d) return;
    if (d.ins) d.ins.remove();
    d.row.classList.remove('ghost');
    if (d.on) U.clickGuard = Date.now() + 250;
    if (commit && d.on && d.to != null) moveTo(d.project, d.to);
  }
  function onRowUp() { endRowDrag(true); }

  function onDown(e) {
    const sb = e.button === 0 && e.target.closest('#pl-pos .pl-bar');
    if (sb) { startScrub(sb, e); return; }
    const gr = e.button === 0 && canWrite() && e.target.closest('#pl-pos .pl-grip');
    if (gr) { startRowDrag(gr, e); return; }
    if (e.button !== 0 || !canWrite()) return;
    const card = e.target.closest('.pl-card');
    if (!card || e.target.closest('button, input') || card.closest('.pl-col.done')) return;
    U.drag = { id: +card.dataset.id, card, x0: e.clientX, y0: e.clientY, on: false, lift: null, ins: null, col: null, index: null };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp, { once: true });
    root.addEventListener('keydown', escDrag, true);
  }
  function escDrag(e) { if (e.key === 'Escape' && U.drag) { e.preventDefault(); e.stopPropagation(); cancelDrag(); } }
  function onMove(e) {
    const d = U.drag; if (!d) return;
    if (!d.on) {
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < DRAG_PX) return;
      d.on = true;
      const r = d.card.getBoundingClientRect();
      d.dx = d.x0 - r.left; d.dy = d.y0 - r.top;
      d.lift = d.card.cloneNode(true); d.lift.classList.add('lift'); d.lift.style.width = r.width + 'px';
      document.body.appendChild(d.lift);
      d.card.classList.add('ghost'); document.body.classList.add('pl-dragging');
      try { root.getSelection().removeAllRanges(); } catch (err) {  }
      d.ins = document.createElement('div'); d.ins.className = 'pl-ins';
    }
    d.lift.style.left = (e.clientX - d.dx) + 'px'; d.lift.style.top = (e.clientY - d.dy) + 'px';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const col = under && under.closest && under.closest('.pl-col');
    U.el.querySelectorAll('.pl-col.drop').forEach((c) => { if (c !== col) c.classList.remove('drop'); });
    if (!col) { d.col = null; if (d.ins.parentNode) d.ins.remove(); return; }
    col.classList.add('drop');
    d.col = col.dataset.col;
    const list = col.querySelector('.pl-list');
    const cards = Array.from(list.querySelectorAll('.pl-card')).filter((c) => c !== d.card);
    let idx = cards.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (idx < 0) idx = cards.length;
    d.index = idx;
    if (d.col === '완료') { if (d.ins.parentNode) d.ins.remove(); return; }
    if (idx < cards.length) list.insertBefore(d.ins, cards[idx]); else list.appendChild(d.ins);
  }
  function endDrag() {
    const d = U.drag; U.drag = null;
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('keydown', escDrag, true);
    if (!d) return null;
    if (d.lift) d.lift.remove();
    if (d.ins && d.ins.parentNode) d.ins.remove();
    if (d.card) d.card.classList.remove('ghost');
    document.body.classList.remove('pl-dragging');
    if (U.el) U.el.querySelectorAll('.pl-col.drop').forEach((c) => c.classList.remove('drop'));
    return d;
  }
  function cancelDrag() { root.removeEventListener('pointerup', onUp); const d = endDrag(); if (d && d.on) U.clickGuard = Date.now() + CLICK_GUARD_MS; }
  function onUp() {
    const d = endDrag();
    if (!d || !d.on) return;
    U.clickGuard = Date.now() + CLICK_GUARD_MS;
    if (!d.col) return;
    doMove(d.id, d.col, d.col === '완료' ? null : d.index);
  }

  const api = { render, refresh, autoRefresh, hasDraft, state: U, DD_FOLD };
  root.POPlan = api;
})(window);
