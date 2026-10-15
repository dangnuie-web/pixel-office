(function (root) {
  'use strict';
  const FS = root.POFS, C = root.POCore, P = root.POPlanMd;
  const PJ_ROOT = '10_프로젝트', GO = PJ_ROOT + '/01_진행', LIST = PJ_ROOT + '/프로젝트목록.md', SAVE_MS = 800;
  const ORDER = PJ_ROOT + '/프로젝트순서.md';
  const ARCH = [['02_완료', '완료'], ['03_보류', '보류']];
  const DESC_SRC = { plan: '계획서 목표', roadmap: '로드맵 한 줄 목표', list: '프로젝트목록.md 한 줄 설명', none: '' };

  const S = {
    handle: null, loaded: false, err: '', names: [], staff: [],
    test: false,
    projects: [],
    descs: new Map(),
    order: [],
    archive: { 완료: [], 보류: [] },
    todo: { path: P.PATH, doc: null, lastText: undefined, exists: false, ver: 0, savedVer: 0, saving: false, timer: null, status: { kind: 'idle' }, err: '' },
    notice: null,
  };
  const api = { state: S, fixedNow: null, onChange: null, SAVE_MS };
  const now = () => (api.fixedNow ? new Date(api.fixedNow) : new Date());
  const today = () => C.businessDay(C.nowMin(now()));
  const writable = () => !S.test && !!(root.PODesktop && typeof root.PODesktop.write === 'function');
  const changed = (why) => { if (typeof api.onChange === 'function') { try { api.onChange(why); } catch (e) {  } } };
  const notFound = (e) => e && (e.name === 'NotFoundError' || /없음|not ?found|ENOENT/i.test(e.message || ''));

  async function readProject(raw) {
    const project = raw.normalize('NFC'), dir = GO + '/' + raw;
    const p = { project, raw, dir, roadmapPath: dir + '/로드맵.md', parsed: null, now: null, plan: { path: null, goal: '', why: '로드맵 없음' } };
    let text;
    try { text = (await FS.readText(S.handle, p.roadmapPath)).text; } catch (e) { return p; }
    p.text = text;
    p.parsed = C.parseRoadmapCells(text, S.names);
    p.now = C.roadmapNow(p.parsed);
    let pp = C.planPathOf(p.parsed.planLine, dir);
    if (pp.path && !FS.allowed(pp.path, 'file')) pp = { path: dir + '/계획서.md', why: '' };
    p.plan = { path: pp.path, goal: '', why: pp.why };
    if (pp.path) {
      try { p.plan.goal = C.planGoalOf((await FS.readText(S.handle, pp.path)).text); if (!p.plan.goal) p.plan.why = '목표 줄 없음'; }
      catch (e) { p.plan.why = '계획서 없음'; }
    }
    return p;
  }
  function parseProjectList(text) {
    const out = new Map();
    const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    const lines = String(text || '').split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
      if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) continue;
      const head = cells(lines[i]).map((h) => h.replace(/<[^>]+>/g, '').trim());
      const ni = head.indexOf('프로젝트'), di = head.indexOf('한 줄 설명');
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
        if (ni < 0 || di < 0) continue;
        const c = cells(lines[j]), name = (c[ni] || '').normalize('NFC');
        if (name && !out.has(name)) out.set(name, c[di] || '');
      }
      i = j - 1;
    }
    return out;
  }
  async function readArchive(sub) {
    const path = PJ_ROOT + '/' + sub;
    let dirs = [];
    try { dirs = await FS.listDirs(S.handle, path); } catch (e) { S.err += path + ' 폴더를 못 읽었어요. '; return []; }
    const out = await Promise.all(dirs.map(async (raw) => {
      const a = { project: raw.normalize('NFC'), goal: '', done: 0, total: 0, hasRoadmap: false };
      try {
        const r = C.parseRoadmapCells((await FS.readText(S.handle, path + '/' + raw + '/로드맵.md')).text, S.names);
        Object.assign(a, { goal: r.goal, done: r.done, total: r.total, hasRoadmap: true });
      } catch (e) {  }
      return a;
    }));
    return out.sort((x, y) => x.project.localeCompare(y.project, 'ko'));
  }
  async function loadTodo() {
    const f = S.todo;
    if (f.doc && (f.ver !== f.savedVer || f.saving || f.status.kind === 'conflict' || f.status.kind === 'error')) return;
    f.err = '';
    try { const r = demoOn() ? { text: root.PODemo.TODO } : await FS.readText(S.handle, f.path); f.lastText = r.text; f.exists = true; f.doc = P.parse(r.text, projectNames()); }
    catch (e) {
      if (notFound(e)) { f.lastText = null; f.exists = false; f.doc = P.parse(P.template(), projectNames()); }
      else { f.doc = null; f.err = (e && e.message) || String(e); }
    }
    f.ver = f.savedVer = 0;
  }
  const TEST_ROADMAPS = '10_프로젝트/01_진행/pixel-office/기획/시험자료/20261008_pixel-office_로드맵시험본_v01.md';
  async function readTestProjects() {
    let text = '';
    const demo = demoOn();
    if (demo) text = root.PODemo.ROADMAPS;
    else try { text = (await FS.readText(S.handle, TEST_ROADMAPS)).text; } catch (e) { S.err += '시험자료 로드맵 예시를 못 읽었어요. '; return []; }
    const parts = root.PODemo.splitParts(text);
    return Array.from(parts.로드맵.keys()).sort((a, b) => a.localeCompare(b, 'ko')).map((name) => {
      const parsed = C.parseRoadmapCells(parts.로드맵.get(name).join('\n'), S.names);
      const plan = parts.계획서.get(name);
      const goal = plan ? C.planGoalOf(plan.join('\n')) : '';
      return { project: name, raw: name, dir: (demo ? 'demo' : TEST_ROADMAPS) + '#' + name, roadmapPath: null, parsed, now: C.roadmapNow(parsed), plan: { path: null, goal, why: goal ? '' : plan ? '목표 줄 없음' : '계획서 없음' } };
    });
  }
  function projectNames() { return S.projects.map((p) => p.project); }
  const TEST_TODO = '10_프로젝트/01_진행/pixel-office/기획/시험자료/20261008_pixel-office_할일시험본_v01.md';
  const demoOn = () => !!(S.test && root.PODemo && root.PODemo.on());
  async function load(handle, opts) {
    if (handle) S.handle = handle;
    const test = !!(opts && opts.test);
    if (test !== S.test) { S.test = test; S.todo = { path: test ? TEST_TODO : P.PATH, doc: null, lastText: undefined, exists: false, ver: 0, savedVer: 0, saving: false, timer: null, status: { kind: 'idle' }, err: '' }; }
    S.err = '';
    try { S.staff = C.parseRoster(demoOn() ? root.PODemo.ROSTER : (await FS.readText(S.handle, 'CLAUDE.md')).text).staff.map((x) => ({ name: x.name, key: x.key })); S.names = S.staff.map((x) => x.name); }
    catch (e) { S.staff = []; S.names = []; S.err += '명부(CLAUDE.md)를 못 읽었어요. '; }
    if (S.test) {
      S.projects = await readTestProjects(); S.descs = new Map(); S.archive = { 완료: [], 보류: [] }; S.order = [];
    } else {
      let dirs = [];
      try { dirs = await FS.listDirs(S.handle, GO); } catch (e) { S.err += GO + ' 폴더를 못 읽었어요. '; }
      const [pjs, descs, done, hold, order] = await Promise.all([
        Promise.all(dirs.map(readProject)),
        FS.readText(S.handle, LIST).then((r) => parseProjectList(r.text), () => { if (root.PO_PUBLIC !== true) S.err += '프로젝트목록.md를 못 읽었어요(설명이 빠질 수 있어요). '; return new Map(); }),
        readArchive(ARCH[0][0]), readArchive(ARCH[1][0]),
        FS.readText(S.handle, ORDER).then((r) => parseOrder(r.text), () => []),
      ]);
      S.projects = pjs; S.descs = descs; S.archive = { 완료: done, 보류: hold }; S.order = order;
    }
    await loadTodo();
    if (S.todo.err) S.err += '할일.md를 못 읽었어요: ' + S.todo.err + ' ';
    S.loaded = true;
    changed('load');
    return S;
  }

  const rank = (name) => { const i = S.order.indexOf(name); return i < 0 ? Infinity : i; };
  function projectsView() {
    return S.projects.filter((p) => p.parsed).map((p, i) => [rank(p.project), i, p]).sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0])).map(([, , p]) => {
      const n = p.now;
      return {
        project: p.project,
        state: n.state,
        stageLabel: n.stageLabel,
        progress: n.progress,
        stageProgress: n.stageProgress,
        cell: n.cell ? { line: n.cell.line, text: n.cell.text, short: n.cell.short, key: n.cell.key, label: C.cellLabel(p.parsed, n.cell), full: fullText(p.parsed, n.cell), dangnee: n.cell.dangnee, inTodo: inTodo(p.project, n.cell) } : null,
        segments: segmentsOf(p.parsed, n),
        owners: n.owners, ownerTurn: n.ownerTurn,
        goal: p.plan.goal, goalWhy: p.plan.goal ? '' : p.plan.why,
        ...descOf(p.project, p.plan.goal, p.parsed.goal),
        unread: p.parsed.unread,
      };
    });
  }
  function descOf(project, planGoal, roadmapGoal) {
    const list = S.descs.get(project) || '';
    const src = planGoal ? 'plan' : roadmapGoal ? 'roadmap' : list ? 'list' : 'none';
    return { desc: planGoal || roadmapGoal || list || '', descSrc: src, descTitle: DESC_SRC[src] };
  }
  function noRoadmap() { return S.projects.filter((p) => !p.parsed).map((p) => Object.assign({ project: p.project }, descOf(p.project, '', ''))); }
  function archive() {
    const out = {};
    ARCH.forEach(([, k]) => { out[k] = S.archive[k].map((a) => Object.assign({ project: a.project, done: a.done, total: a.total, hasRoadmap: a.hasRoadmap }, descOf(a.project, '', a.goal))); });
    return out;
  }
  function inTodo(project, cell) {
    if (!S.todo.doc) return false;
    return P.todoKeys(S.todo.doc).some((t) => t.project === project && ((t.key && t.key === cell.key) || (!t.key && (t.text === cell.short || t.text === cell.text))));
  }
  function segmentsOf(parsed, n) {
    const cur = n.cell ? n.cell.section : -2;
    const out = [];
    parsed.sections.forEach((sec, i) => {
      const cs = parsed.cells.filter((c) => c.section === i);
      if (!cs.length) return;
      const now = i === cur;
      const tick = sec.kind === 'stage' ? (now ? sec.stage + '단계' : String(sec.stage)) : sec.kind === 'later' ? '나중' : now ? sec.title : Array.from(sec.title)[0];
      const name = sec.kind === 'stage' ? sec.label : sec.kind === 'later' ? '나중에 할 일' : sec.kind === 'decide' ? '정할 것' : sec.title;
      out.push({ title: sec.title, label: sec.kind === 'decide' ? '정할 것' : sec.label, name, tick, kind: sec.kind, n: cs.length, done: cs.filter((c) => c.done).length, now, later: sec.kind === 'later', cells: cellsOf(parsed, cs, n) });
    });
    const top = parsed.cells.filter((c) => c.section < 0);
    if (top.length) out.unshift({ title: '', label: '', name: '맨 위', tick: '', kind: 'top', n: top.length, done: top.filter((c) => c.done).length, now: cur === -1, later: false, cells: cellsOf(parsed, top, n) });
    return out;
  }
  const cellsOf = (parsed, cs, n) => cs.map((c) => ({ text: fullText(parsed, c), done: c.done, top: !!(n.cell && n.cell.line === c.line), owners: c.owners }));
  function fullText(parsed, cell) {
    const t = C.itemShort(cell.text, Infinity);
    return cell.parent == null ? t : C.itemShort(parsed.cells[cell.parent].text, 14) + ' › ' + t;
  }
  function lists() {
    if (!S.todo.doc) return { Today: [], Weekly: [], 완료: [] };
    const L = P.lists(S.todo.doc), out = {};
    Object.keys(L).forEach((k) => { out[k] = L[k].map((it) => ({ id: it.id, text: it.text, project: it.project, key: it.key, done: it.done, date: it.date, from: it.from, linked: !!it.key })); });
    return out;
  }
  function suggestions(query, limit) {
    const pj = S.projects.filter((p) => p.parsed).map((p) => ({ project: p.project, parsed: p.parsed }));
    const keys = S.todo.doc ? P.todoKeys(S.todo.doc) : [];
    return String(query || '').trim() ? C.suggestSearch(pj, query, keys, limit) : C.suggestInitial(pj, keys);
  }

  function edit(fn) {
    const f = S.todo;
    if (!writable() || !f.doc) return false;
    const r = fn(f.doc);
    f.ver++; f.status = { kind: 'pending' };
    clearTimeout(f.timer); f.timer = setTimeout(() => save(), SAVE_MS);
    changed('edit');
    return r;
  }
  function add(section, what, project) {
    const fields = typeof what === 'string' ? { text: what, project: project || '' } : { text: what.short, project: what.project, key: what.key };
    return edit((doc) => P.addItem(doc, section, fields));
  }
  function item(id) { return S.todo.doc ? P.find(S.todo.doc, id) : null; }
  async function toggle(id, done) {
    const it = item(id);
    if (!it) return { ok: false };
    const was = it.done && it.section === P.DONE;
    if (edit((doc) => P.setDone(doc, it, done, today())) === false) return { ok: false };
    const roadmap = done && !was && it.key ? await checkRoadmap(it) : null;
    return { ok: true, roadmap };
  }
  async function move(id, section, index) {
    const it = item(id);
    if (!it) return { ok: false };
    const was = it.done && it.section === P.DONE;
    if (edit((doc) => P.moveItem(doc, it, section, index, today())) === false) return { ok: false };
    const roadmap = section === P.DONE && !was && it.key ? await checkRoadmap(it) : null;
    return { ok: true, roadmap };
  }
  function update(id, patch) { const it = item(id); return it ? edit((doc) => P.editItem(doc, it, patch)) !== false : false; }
  function remove(id) {
    const it = item(id);
    if (!it || !writable()) return false;
    const L = P.lists(S.todo.doc)[it.section] || [];
    const snap = { section: it.section, index: L.indexOf(it), text: it.text, project: it.project, key: it.key };
    return edit((doc) => P.removeItem(doc, it)) !== false ? snap : false;
  }
  function restore(snap) { return snap ? edit((doc) => P.addItem(doc, snap.section, { text: snap.text, project: snap.project, key: snap.key }, snap.index)) : false; }
  function addTop(project, section) {
    const p = S.projects.find((x) => x.project === project);
    if (!p || !p.now || !p.now.cell || inTodo(project, p.now.cell)) return false;
    return add(section || 'Today', { short: p.now.cell.short, project, key: p.now.cell.key });
  }
  const sameName = (a, b) => String(a).normalize('NFC').toLowerCase().replace(/\s+/g, ' ') === String(b).normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
  function nameTaken(name) {
    if (S.projects.some((p) => sameName(p.project, name))) return '진행 중인 프로젝트에 같은 이름이 있어요.';
    for (const [, k] of ARCH) if ((S.archive[k] || []).some((a) => sameName(a.project, name))) return k + ' 목록에 같은 이름이 있어요.';
    return '';
  }
  async function createProject(input) {
    if (!writable()) return { ok: false, error: S.test ? '시연 보기에서는 만들지 않아요.' : '데스크톱 앱에서만 만들 수 있어요.' };
    const c = C.cleanProjectName(input);
    if (!c.ok) return c;
    const taken = nameTaken(c.name);
    if (taken) return { ok: false, error: taken + ' 다른 이름으로 해 주세요.' };
    const path = GO + '/' + c.name + '/로드맵.md';
    try { await FS.writeNewRoadmap(path, C.roadmapSkeleton(c.name)); }
    catch (e) {
      if (e && e.code === 'EEXIST') return { ok: false, error: '같은 이름의 폴더가 이미 있어요. 다른 이름으로 해 주세요.' };
      return { ok: false, error: '못 만들었어요: ' + ((e && e.message) || e) };
    }
    const p = await readProject(c.name);
    S.projects = S.projects.filter((x) => x.project !== p.project).concat([p]).sort((a, b) => a.raw.localeCompare(b.raw, 'ko'));
    changed('projects');
    return { ok: true, project: p.project };
  }
  function ownerChoices() {
    let boss = '';
    try { boss = root.PONames && root.PONames.values ? root.PONames.values().bossCall : ''; } catch (e) { boss = ''; }
    const out = [];
    S.staff.forEach((x) => { if (x.name && x.name !== boss && !out.some((o) => o.name === x.name)) out.push({ name: x.name, key: x.key, boss: false }); });
    if (boss) out.push({ name: boss, key: null, boss: true });
    return out;
  }
  async function addTask(project, task, owner) {
    if (!writable()) return { ok: false, error: S.test ? '시연 보기에서는 저장하지 않아요.' : '데스크톱 앱에서만 넣을 수 있어요.' };
    const p = S.projects.find((x) => x.project === project);
    if (!p || !p.roadmapPath) return { ok: false, error: '로드맵을 못 찾았어요.' };
    owner = owner == null ? '' : String(owner);
    if (owner && !ownerChoices().some((o) => o.name === owner)) return { ok: false, error: '담당을 골라 주세요.' };
    try {
      const cur = (await FS.readText(S.handle, p.roadmapPath)).text;
      const r = C.roadmapAddLine(cur, task, owner, S.names);
      if (!r.ok) return r;
      await FS.writeRoadmapAdd(S.handle, p.roadmapPath, r.text);
      p.text = r.text; p.parsed = C.parseRoadmapCells(r.text, S.names); p.now = C.roadmapNow(p.parsed);
      changed('projects');
      return { ok: true, where: r.where, label: r.label, line: r.line };
    } catch (e) { return { ok: false, error: '로드맵에 못 넣었어요: ' + ((e && e.message) || e) }; }
  }
  function addWhere(project) {
    const p = S.projects.find((x) => x.project === project);
    if (!p || p.text == null) return null;
    const r = C.roadmapAddLine(p.text, '미리 보기', '', S.names);
    return r.ok ? { where: r.where, label: r.label } : null;
  }
  function sig() {
    return JSON.stringify([S.names, S.projects.map((p) => [p.raw, p.text || null, p.plan && p.plan.goal]), ARCH.map(([, k]) => (S.archive[k] || []).map((a) => [a.project, a.done, a.total, a.goal])), [...S.descs], S.order, S.todo.lastText, S.err]);
  }
  function parseOrder(text) {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((l) => { const m = /^\s*[-*]\s+(.+?)\s*$/.exec(l); if (m) { const n = m[1].normalize('NFC'); if (out.indexOf(n) < 0) out.push(n); } });
    return out;
  }
  const orderText = (names) => '# 프로젝트순서\n\n프로젝트 관리 탭에서 바꾼 진행 프로젝트 순서(위가 먼저). 앱이 통째로 다시 쓴다. 여기 없는 진행 프로젝트는 맨 아래 폴더 이름순.\n\n' + names.map((n) => '- ' + n).join('\n') + '\n';
  async function moveProject(name, to) {
    if (!writable()) return false;
    const names = projectsView().map((v) => v.project), from = names.indexOf(name);
    if (from < 0) return false;
    to = Math.max(0, Math.min(names.length - 1, to));
    if (to === from) return true;
    names.splice(from, 1); names.splice(to, 0, name);
    const prev = S.order;
    S.order = names; changed('order');
    try { await FS.writeText(ORDER, orderText(names)); return true; }
    catch (e) { S.order = prev; S.err += '프로젝트순서.md를 못 썼어요: ' + ((e && e.message) || e) + ' '; changed('order'); return false; }
  }
  function staffKey(name) { const x = S.staff.find((s) => s.name === name); return x ? x.key : null; }

  async function checkRoadmap(it) {
    const p = S.projects.find((x) => x.project === it.project);
    const miss = (text) => { S.notice = { kind: 'roadmap-miss', text: text || C.ROADMAP_MISS, project: it.project }; changed('notice'); return { ok: false, message: S.notice.text }; };
    if (!p || !p.parsed) return miss();
    try {
      const cur = (await FS.readText(S.handle, p.roadmapPath)).text;
      const r = C.checkRoadmapCell(cur, it.key, today());
      if (!r.ok) return miss(r.message);
      await FS.writeRoadmapCheck(S.handle, p.roadmapPath, r.text);
      p.parsed = C.parseRoadmapCells(r.text, S.names); p.now = C.roadmapNow(p.parsed);
      S.notice = { kind: 'roadmap-ok', text: it.project + ' 로드맵 칸도 체크했어요', project: it.project, line: r.line };
      changed('notice');
      return { ok: true, message: S.notice.text, line: r.line };
    } catch (e) { return miss('로드맵을 못 고쳤어요: ' + ((e && e.message) || e) + ' (직접 체크해 주세요)'); }
  }

  async function save(force) {
    const f = S.todo;
    clearTimeout(f.timer); f.timer = null;
    if (f.ver === f.savedVer || !writable()) return f.status;
    if (f.saving) { f.timer = setTimeout(() => save(force), SAVE_MS); return f.status; }
    f.saving = true; f.status = { kind: 'saving' }; changed('status');
    const ver = f.ver;
    try {
      let cur = null;
      try { cur = (await FS.readText(S.handle, f.path)).text; } catch (e) { if (!notFound(e)) throw e; }
      if (cur !== f.lastText && force !== true) { f.status = { kind: 'conflict' }; return f.status; }
      const text = P.serialize(f.doc);
      await FS.writeText(f.path, text);
      f.lastText = text; f.exists = true; f.savedVer = ver;
      const d = now();
      f.status = { kind: 'saved', at: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
    } catch (e) { f.status = { kind: 'error', msg: (e && e.message) || String(e) }; }
    finally {
      f.saving = false;
      if (f.ver !== f.savedVer && f.status.kind === 'saved') { f.status = { kind: 'pending' }; f.timer = setTimeout(() => save(), SAVE_MS); }
      changed('status');
    }
    return f.status;
  }
  async function reloadDiscard() { const f = S.todo; clearTimeout(f.timer); f.ver = f.savedVer; f.status = { kind: 'idle' }; await loadTodo(); changed('load'); }
  function status() { return writable() ? S.todo.status : { kind: 'readonly' }; }
  function flush() { return save(); }

  Object.assign(api, { ORDER, parseOrder, orderText, moveProject, createProject, addTask, addWhere, ownerChoices, nameTaken, sig, TEST_TODO, TEST_ROADMAPS, LIST, parseProjectList, noRoadmap, archive, load, projectsView, lists, suggestions, add, addTop, toggle, move, update, remove, restore, staffKey, save, flush, reloadDiscard, status, writable, today, checkRoadmap });
  root.POPlanData = api;
})(typeof window !== 'undefined' ? window : globalThis);
