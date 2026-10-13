(function (root) {
  'use strict';
  const C = root.POCore, FS = root.POFS, LD = root.POLoader;
  const $ = (id) => document.getElementById(id);

  const App = {
    handle: null, result: null, tab: 'office', screen: 'connect', entered: false,
    settings: { mode: 'real', baseStr: '', greet: 'basic' },
  };

  function show(screen) {
    App.screen = screen;
    if (screen !== 'pixel' && root.POPixel) root.POPixel.onHidden();
    ['connect', 'firstrun', 'start', 'office', 'soon', 'projects', 'calendar', 'ideas', 'cards', 'shelf', 'settings', 'pixel', 'f13'].forEach((s) => { $('screen-' + s).hidden = s !== screen; });
    if (screen === 'office' && root.POGame.G.entered) root.POGame.resize();
  }
  function modeBadge() {
    const s = App.settings;
    $('mode-badge').textContent = s.mode === 'test' ? (root.PO_PUBLIC === true ? '시연 보기' : '시험본 모드') + '\n기준 ' + (s.baseStr || '지금') : '';
  }

  async function compute() {
    const s = App.settings;
    const r = await LD.readAll(App.handle, { mode: s.mode });
    const base = s.baseStr ? C.parseMinStr(s.baseStr) : C.nowMin();
    if (r.input) r.state = C.compute(Object.assign({}, r.input, { base, layout: root.PO_LAYOUT }));
    if (r.state && 'signalText' in r.input) r.state = C.applySignals(r.state, r.input.signalText, root.PO_LAYOUT);
    try { App.leave = await root.POCards.leaveSet(); } catch (e) { App.leave = new Set(); }
    App.result = r;
    return r;
  }

  async function useHandle(h) {
    if (!(await FS.isOfficeFolder(h))) {
      $('connect-msg').textContent = root.PO_PUBLIC === true ? (h && h.name ? '"' + h.name + '" 폴더' : '고른 폴더') + '에는 사무실이 없어요. 안에 CLAUDE.md 파일과 10_프로젝트 폴더가 있는 폴더를 골라 주세요.'
        : root.PONames.sub('당니오피스') + ' 폴더가 아니에요. CLAUDE.md와 00_운영이 있는 폴더를 골라 주세요.';
      show('connect'); return false;
    }
    App.handle = h;
    try { await FS.saveHandle(h); } catch (e) {  }
    $('connect-msg').textContent = '';
    show('start');
    return true;
  }
  async function onConnect() {
    let h;
    try { h = await FS.pick(); } catch (e) { if (e.name !== 'AbortError') $('connect-msg').textContent = '폴더를 열지 못했어요: ' + e.message; return; }
    await useHandle(h);
  }
  async function onEnter() {
    if (!App.handle) { show('connect'); return; }
    let p;
    try { p = await FS.permission(App.handle, true); } catch (e) { p = 'error'; }
    if (p !== 'granted') { $('start-msg').textContent = '폴더 읽기 권한이 필요해요. 다시 눌러 허용해 주세요.'; return; }
    $('start-msg').textContent = '';
    await compute();
    if (root.POSkills && root.PO_PUBLIC !== true) root.POSkills.load(App.handle).catch(() => {});
    lastSig = placeSig(App.result);
    App.entered = true;
    show('office');
    root.POGame.enter(App);
  }

  const REFRESH_MS = 15000;
  let lastSig = '', refreshing = false;
  function placeSig(r) {
    const st = r && r.state; if (!st) return '';
    return JSON.stringify([st.staff.map((s) => s.name + ':' + s.place + ':' + s.mark), (st.ownerTurn || []).map((c) => c.project + ' ' + c.line), (st.roadmap && st.roadmap.cells || []).map((c) => c.project + ' ' + c.line + ' ' + c.owners.join('·')), !!r.readFail]);
  }
  async function autoRefresh() {
    const s = App.settings, G = root.POGame && root.POGame.G;
    if (refreshing || !App.entered || App.screen !== 'office' || s.mode !== 'real' || s.baseStr || document.hidden) return false;
    if (!G || G.bubble || G.win) return false;
    refreshing = true;
    try {
      const r = await compute();
      const sig = placeSig(r);
      if (r.state && sig !== lastSig) { root.POGame.setData(r); lastSig = sig; return true; }
      if (r.state) { const G2 = root.POGame.G; if (G2.st && 'approvals' in G2.st) r.state.approvals = G2.st.approvals; G2.result = r; G2.st = r.state; }
      return false;
    } catch (e) { return false;  } finally { refreshing = false; }
  }

  async function openF13() {
    if (!App.handle) { show('connect'); $('connect-msg').textContent = '데이터 확인 화면은 폴더를 연결한 뒤에 열 수 있어요.'; return; }
    const p = await FS.permission(App.handle, true).catch(() => 'error');
    if (p !== 'granted') { show('start'); $('start-msg').textContent = '폴더 읽기 권한이 필요해요.'; return; }
    show('f13');
    await runF13();
  }
  async function runF13() {
    const r = await compute();
    const s = App.settings;
    if (r.state) {
      const kind = s.greet === 'basic' ? null : s.greet;
      r.briefing = C.buildBriefing(r.state, { kind, readFail: r.readFail, hasLast: r.hasLast });
    }
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
    const names = r.state ? r.state.staff.map((x) => x.name) : ['바나 쌤'];
    const rep = root.POLayoutCheck.check(root.PO_LAYOUT, names, (n) => (ctx.measureText(n).width + 10) / 2);
    root.POF13.render($('f13'), s, r, rep);
    $('f13-run').onclick = () => { readF13Form(); runF13(); };
    $('f13-apply').onclick = async () => {
      readF13Form(); modeBadge();
      await compute();
      if (App.entered) { root.POGame.setData(App.result); lastSig = placeSig(App.result); }
      selectTab('office');
      if (App.entered) show('office'); else show('start');
    };
    $('f13-close').onclick = () => { selectTab('office'); show(App.entered ? 'office' : (App.handle ? 'start' : 'connect')); };
  }
  function readF13Form() {
    const s = App.settings;
    s.baseStr = $('f13-base').value.trim();
    s.mode = $('f13-mode').value; s.greet = $('f13-greet').value;
    if (s.mode === 'test' && !s.baseStr && root.PO_PUBLIC !== true) s.baseStr = '2026-09-30 13:40';
  }

  async function openCardsBeforeEnter() {
    const p = await FS.permission(App.handle, true).catch(() => 'error');
    if (p !== 'granted') { show('start'); $('start-msg').textContent = '폴더 읽기 권한이 필요해요.'; return; }
    await compute();
    if (App.tab !== 'cards') return;
    if (App.result && App.result.state) { show('cards'); root.POCards.render($('cards'), App); } else show('soon');
  }

  function selectTab(tab) {
    if (App.tab === 'projects' && tab !== 'projects' && root.POPlanData) root.POPlanData.flush();
    if (tab !== 'cards' && root.POToolsUI) root.POToolsUI.closeDrawer();
    App.tab = tab;
    document.querySelectorAll('#tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'cards' && App.result && App.result.state) { show('cards'); root.POCards.render($('cards'), App); return; }
    if (tab === 'cards' && App.handle) { openCardsBeforeEnter(); return; }
    if (tab === 'projects' && App.handle) { show('projects'); root.POPlan.render($('projects'), App.handle, { test: App.settings.mode === 'test' }); return; }
    if (tab === 'calendar' && App.handle) { show('calendar'); root.POCalendar.render($('calendar'), App.handle, { test: App.settings.mode === 'test' }); return; }
    if (tab === 'ideas' && App.handle) { show('ideas'); root.POProjects.render($('ideas'), App.handle); return; }
    if (tab === 'shelf') {
      if (!App.handle) { show('connect'); $('connect-msg').textContent = '자료 보관은 폴더를 연결한 뒤에 열 수 있어요.'; return; }
      show('shelf'); root.POShelf.render($('shelf'), App.handle, { demo: App.settings.mode === 'test' }); return;
    }
    if (tab === 'settings') { show('settings'); root.POSettingsUI.render($('settings')); return; }
    if (tab !== 'office') { show('soon'); return; }
    show(App.entered ? 'office' : (App.handle ? 'start' : 'connect'));
    if (App.entered) root.POGame.G.els.stage.focus();
  }

  async function firstRun() {
    const FR = root.POFirstRun, D = root.PODesktop;
    if (root.PO_PUBLIC !== true || !FR || !D || typeof D.officeGet !== 'function') return false;
    const after = FR.takeAfter();
    let o = null;
    try { o = await D.officeGet(); } catch (e) { o = null; }
    if (!o || !o.path) { show('firstrun'); await FR.start('welcome'); return true; }
    if (after === 'enter') { await onEnter(); return true; }
    if (after === 'open') { show('firstrun'); await FR.start('enter', { from: 'open' }); return true; }
    return false;
  }

  async function init() {
    $('btn-connect').addEventListener('click', onConnect);
    $('btn-reconnect').addEventListener('click', onConnect);
    $('btn-enter').addEventListener('click', onEnter);
    const scene = root.POSprites.frameCanvas('cover_street', 0);
    if (scene) $('cover-cv').getContext('2d').drawImage(scene, 0, 0);
    $('cover-cv').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 384, y = (e.clientY - r.top) / r.height * 256;
      if (x >= 140 && x <= 243 && y >= 100 && y <= 214) onEnter();
    });
    $('cover-cv').addEventListener('mousemove', (e) => {
      const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 384, y = (e.clientY - r.top) / r.height * 256;
      e.currentTarget.style.cursor = x >= 140 && x <= 243 && y >= 100 && y <= 214 ? 'pointer' : '';
    });
    const fitCover = () => {
      const m = $('main'), fit = Math.min(m.clientWidth / 384, m.clientHeight / 256);
      $('cover').style.setProperty('--s', Math.max(1, fit >= 2 && fit - Math.floor(fit) < 0.15 ? Math.floor(fit) : Math.floor(fit * 20) / 20));
    };
    fitCover(); root.addEventListener('resize', fitCover);
    document.querySelectorAll('#tabs [role=tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
    $('tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const tabs = Array.from(document.querySelectorAll('#tabs [role=tab]'));
      const i = tabs.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); selectTab(n.dataset.tab); n.focus();
    });
    document.addEventListener('keydown', (e) => {
      if (e.target && (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable)) return;
      if (App.screen === 'firstrun') return;
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); openF13(); return; }
      if (App.screen === 'start' && (e.key === ' ' || e.key === 'Enter') && document.activeElement !== $('btn-enter') && document.activeElement !== $('btn-reconnect')) { e.preventDefault(); onEnter(); }
    });
    setInterval(autoRefresh, REFRESH_MS);
    if (root.POTools) root.POTools.init();
    App.handle = await FS.loadHandle();
    if (await firstRun()) return;
    show(App.handle ? 'start' : 'connect');
    if (App.screen === 'start') $('btn-enter').focus();
    if (location.hash === '#f13') openF13();
  }

  App.show = show; App.useHandle = useHandle; App.onEnter = onEnter; App.openF13 = openF13; App.compute = compute; App.selectTab = selectTab; App.modeBadge = modeBadge; App.autoRefresh = autoRefresh;
  root.POApp = App;
  init();
})(window);
