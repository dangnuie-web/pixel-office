(function (root) {
  'use strict';
  const D = () => root.PODesktop;
  const desktop = () => !!(D() && typeof D().toolStart === 'function');
  const pub = () => root.PO_PUBLIC === true;

  const DEFS = {
    blog: { ids: ['blog-preview'], icon: 0, name: '블로그 미리보기', what: '블로그 초안을 네이버 화면 모양으로 열어요', btn: '미리보기 열기', input: 'draft' },
    pf: { ids: ['portfolio-on', 'portfolio-off'], icon: 1, name: '포폴 관리자', what: '포트폴리오 글쓰기 화면(관리자)을 켜고 열어요', server: true },
    pixel: { ids: ['pixel-preview'], icon: 2, name: '픽셀 미리보기', what: '에셋 JSON을 PNG로 다시 뽑아요', btn: 'PNG 뽑기', input: 'assetdir' },
    proj: { ids: ['project-check'], icon: 3, name: '프로젝트목록 점검', what: '프로젝트목록.md와 프로젝트 폴더가 맞는지 봐요', btn: '점검하기' },
    test: { ids: ['test-run'], icon: 4, name: '시험 돌리기', what: 'pixel-office 전체 시험을 돌리고 통과·실패를 표로', btn: '시험 돌리기' },
    sync: { ids: ['asset-sync'], icon: 5, name: '그림 동기화', what: '디자인/에셋 그림을 앱 assets로 맞춰요', btn: '동기화' },
    clean: { ids: ['cleanup-scan'], icon: 6, name: '정리 점검', what: '중복·큰 파일·옛 버전·이름·개인정보 의심', btn: '정리 점검', list: true },
    names: { ids: ['name-check'], icon: 7, name: '이름 점검', what: '폴더·파일 이름 규칙 위반 후보', btn: '이름 점검', list: true },
    frame: { ids: ['blog-frame'], icon: 8, name: '블로그 틀', what: '원고를 골라 블로그 모양 틀을 만들어요', btn: '블로그 틀', input: 'manuscript' },
    lecture: { ids: ['lecture-preview', 'lecture-write'], icon: 9, name: '강의목록 갱신', what: '통과한 원고를 강의목록 표에 한 줄 넣어요', btn: '강의목록 갱신', input: 'manuscript' },
    combo: { ids: [], icon: -1, name: '프롬프트 조합', local: true },
    shop: { ids: [], icon: 0, sprite: 'tool_icons_pixelshop', name: '픽셀 공방', local: true, workbench: true },
    testlist: { ids: ['test-list'], icon: 4, name: '시험 목록', hidden: true },
    imgconv: { ids: ['image-convert'], sprite: 'tool_icons_newbtn', icon: 0, name: '이미지 변환', what: '폴더 그림의 형식·크기·픽셀 배율·색 공간을 바꿔 복사본 폴더에', btn: '변환하기', form: true },
    board: { ids: ['design-board'], sprite: 'tool_icons_newbtn', icon: 1, name: '시안 비교판', what: '폴더 시안을 비교판 한 장(html)으로 묶어 열어요', btn: '비교판 만들기', input: 'boarddir' },
    deploy: { ids: ['predeploy-check', 'predeploy-test'], sprite: 'tool_icons_newbtn', icon: 2, name: '배포 전 점검', what: '.env·비밀값·시험·바뀐 파일. 배포는 안 해요', btn: '점검하기', input: 'devproj', list: true },
  };
  Object.keys(DEFS).forEach((k) => { DEFS[k].key = k; });
  const STAFF_TOOLS_CODE = { '토리': ['blog', 'pf', 'proj'], organizer: ['clean', 'names'], 'blog-editor': ['frame', 'imgconv'], teacher: ['lecture'], designer: ['sync', 'pixel', 'combo', 'shop', 'imgconv', 'board'], developer: ['test', 'deploy'] };
  const STAFF_TOOLS = JSON.parse(JSON.stringify(STAFF_TOOLS_CODE));
  const IMG_DEFAULT = { designer: { format: '그대로', long: '', scale: '', space: '그대로', intent: 'perceptual', out: '변환' }, 'blog-editor': { format: 'jpg', long: '', scale: '', space: '그대로', intent: 'perceptual', out: '발행용' } };
  const DESK_TOOL_CODE = { organizer: 'clean', 'blog-editor': 'frame' };
  const DESK_TOOL = Object.assign({}, DESK_TOOL_CODE);
  let staffSource = 'code';
  function setStaffTools(map, source) {
    const m = map || STAFF_TOOLS_CODE;
    Object.keys(STAFF_TOOLS).forEach((k) => { delete STAFF_TOOLS[k]; });
    Object.keys(m).forEach((k) => { const l = m[k].filter((b) => DEFS[b]); if (l.length) STAFF_TOOLS[k] = l.slice(); });
    Object.keys(DESK_TOOL).forEach((k) => { delete DESK_TOOL[k]; });
    Object.keys(DESK_TOOL_CODE).forEach((k) => { if ((STAFF_TOOLS[k] || []).includes(DESK_TOOL_CODE[k])) DESK_TOOL[k] = DESK_TOOL_CODE[k]; });
    staffSource = map ? (source || 'table') : 'code';
    notify(true);
  }
  const OWNER_KEY = 'dangnee';
  const roster = () => { const a = root.POApp, sl = a && a.result && a.result.state && a.result.state.staff; return Array.isArray(sl) ? sl : []; };
  const charOf = (x) => (root.POCore && root.POCore.charOf ? root.POCore.charOf(x) : (x && typeof x === 'object' ? x.key : x));
  function pubHost() { const s = roster().find((x) => charOf(x) === 'designer'); return s ? s.key : OWNER_KEY; }
  function toolKey(k) {
    if (!pub()) return k;
    if (k === pubHost()) return 'designer';
    const c = charOf(roster().find((x) => x.key === k) || k);
    return c === 'designer' ? '' : c;
  }
  const staffTools = (k) => (STAFF_TOOLS[toolKey(k)] || []).filter((b) => !pub() || (DEFS[b] && DEFS[b].local));
  const deskTool = (k) => (pub() ? null : DESK_TOOL[k] || null);
  const keyOfId = (id) => Object.keys(DEFS).find((k) => DEFS[k].ids.includes(id));

  const S = {};
  Object.keys(DEFS).forEach((k) => { S[k] = { status: 'idle', lines: [], out: '', err: '' }; });
  let avail = null;
  let office = '';
  const subs = [];
  let notifyT = null;
  function notify(now) {
    if (now) { clearTimeout(notifyT); notifyT = null; subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); return; }
    if (notifyT) return;
    notifyT = setTimeout(() => notify(true), 120);
  }
  function subscribe(f) { subs.push(f); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; }

  let inited = false;
  async function init() {
    if (inited || !desktop() || pub()) return;
    inited = true;
    D().onTool(onEvent);
    try { office = await D().toolOffice(); } catch (e) { office = ''; }
    await refreshList();
    refreshServer();
    approvalRefresh();
    setInterval(() => { refreshServer(); approvalRefresh(); }, 15000);
  }
  async function refreshList() {
    if (!desktop()) return;
    try { avail = await D().toolList(); } catch (e) { avail = {}; }
    notify();
  }
  function available(key) {
    const d = DEFS[key];
    if (!d || d.soon) return false;
    if (d.local) return true;
    if (pub()) return false;
    if (!avail) return true;
    return d.ids.some((id) => avail[id] && avail[id].available);
  }

  const MAX_LINES = 5000;
  function onEvent(ev) {
    const key = keyOfId(ev.id); if (!key) return;
    const s = S[key];
    if (ev.runId && s.runId && ev.runId !== s.runId) return;
    if (ev.type === 'start') { s.args = ev.args; return; }
    if (ev.type === 'out') {
      const buf = ev.stream === 'err' ? 'err' : 'out';
      s[buf] += ev.text;
      const pk = buf === 'err' ? 'pe' : 'po';
      const parts = ((s[pk] || '') + ev.text).split('\n').map((x, i, a) => (i < a.length - 1 ? x.replace(/\r$/, '') : x));
      s[pk] = parts.pop();
      parts.forEach((t) => s.lines.push({ s: buf, t }));
      if (s.lines.length > MAX_LINES) s.lines.splice(0, s.lines.length - MAX_LINES);
      if (key === 'test') s.result = parseTests(s.out, s.planned, true);
      notify();
      return;
    }
    if (ev.type === 'end') {
      ['po', 'pe'].forEach((pk) => { if (s[pk]) { s.lines.push({ s: pk === 'pe' ? 'err' : 'out', t: s[pk] }); s[pk] = ''; } });
      s.t1 = Date.now(); s.ms = ev.ms; s.code = ev.code; s.stopped = ev.stopped;
      s.error = ev.error;
      let r = null;
      try { r = PARSE[key] ? PARSE[key](s.out, s.err, ev, s) : null; } catch (e) { r = { parseError: String(e.message || e) }; }
      s.result = r;
      const found = key === 'deploy' && ev.code === 1 && r && r.json;
      s.status = (ev.code === 0 || found) && !ev.stopped && !ev.error && !(r && r.parseError) ? 'ok' : 'fail';
      if (s.status === 'fail') s.failSeen = false;
      if (key === 'pf') { s.server = null; refreshServer(); }
      if (s.after) { const f = s.after; s.after = null; try { f(s); } catch (e) {  } }
      notify(true);
    }
  }
  async function start(key, params, opt) {
    opt = opt || {};
    const d = DEFS[key];
    if (!desktop()) return { ok: false, error: '데스크톱 앱에서만 돌릴 수 있어요.' };
    if (!d || d.soon) return { ok: false, error: '준비 중' };
    if (pub()) return { ok: false, error: '공용판에는 없는 도구예요.' };
    const s = S[key];
    if (s.status === 'run') return { ok: false, error: '이미 도는 중이에요.' };
    const id = opt.id || d.ids[0];
    const prev = { status: s.status };
    Object.assign(s, { status: 'run', id, params: params || {}, t0: Date.now(), t1: null, ms: null, code: null, stopped: false, error: null, lines: [], out: '', err: '', po: '', pe: '', result: null, runId: null, after: opt.after || null, failSeen: true });
    notify(true);
    let r;
    try { r = await D().toolStart(id, params || {}); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    if (!r || !r.ok) {
      s.status = 'fail'; s.error = (r && r.error) || '실행하지 못했어요'; s.t1 = Date.now(); s.failSeen = false; s.after = null;
      if (r && r.missing) { s.status = prev.status === 'run' ? 'idle' : prev.status; s.failSeen = true; refreshList(); }
      notify(true);
      return { ok: false, error: s.error, missing: !!(r && r.missing) };
    }
    s.runId = r.runId;
    if (key === 'test') { s.planned = null; start('testlist', {}).catch(() => {}); }
    return { ok: true };
  }
  async function stop(key) {
    const s = S[key]; if (!desktop() || s.status !== 'run') return false;
    return D().toolStop(s.id);
  }
  function markSeen(key) {
    let ch = false;
    (key ? [key] : Object.keys(S)).forEach((k) => { if (S[k].status === 'fail' && !S[k].failSeen) { S[k].failSeen = true; ch = true; } });
    if (ch) notify();
  }
  let serverBusy = false;
  async function refreshServer() {
    if (!desktop() || pub() || serverBusy) return;
    serverBusy = true;
    try { const on = await D().toolServer(); if (S.pf.server !== on) { S.pf.server = on; if (on && S.pf.since == null) S.pf.since = Date.now(); if (!on) S.pf.since = null; notify(); } } catch (e) {  } finally { serverBusy = false; }
  }

  const lastLine = (t) => { const l = String(t || '').trim().split('\n').filter((x) => x.trim()); return l.length ? l[l.length - 1].trim() : ''; };
  function toRel(abs) {
    abs = String(abs || '').trim().normalize('NFC');
    const o = String(office || '').normalize('NFC');
    if (o && abs.startsWith(o + '/')) return abs.slice(o.length + 1);
    return null;
  }
  const fileName = (p) => String(p || '').split('/').pop();
  function parseTests(text, planned, running) {
    const rows = []; let sum = '';
    String(text || '').split('\n').forEach((line) => {
      const m = line.match(/^([OX]) tests\/(test_[A-Za-z0-9_]+)\.js\s+(통과|실패|시간 초과)\s+(?:통과 (\d+) \/ 실패 (\d+)|항목 수 못 읽음)/);
      if (m) { rows.push({ name: m[2], state: m[1] === 'O' ? 'ok' : 'fail', pass: m[4] != null ? +m[4] : null, fail: m[5] != null ? +m[5] : null, timeout: m[3] === '시간 초과' }); return; }
      if (/^요약: /.test(line)) sum = line.slice(4).trim();
    });
    const done = rows.length;
    if (planned && planned.length) {
      const seen = new Set(rows.map((r) => r.name));
      planned.filter((n) => !seen.has(n)).forEach((n, i) => rows.push({ name: n, state: running && i === 0 ? 'run' : 'wait' }));
    }
    return { rows, done, total: planned && planned.length ? Math.max(planned.length, done) : done, pass: rows.filter((r) => r.state === 'ok').length, fail: rows.filter((r) => r.state === 'fail').length, summary: sum };
  }
  const PARSE = {
    clean(out) {
      const j = JSON.parse(out);
      const sm = j.summary || {};
      const counts = { dup: sm.duplicate_groups || 0, big: sm.large_files || 0, old: sm.old_version_files || 0, name: sm.name_issues || 0, private: sm.private_suspects != null ? sm.private_suspects : (j.private || []).length,
        junk: sm.junk_items || 0 };
      return { json: j, counts, total: counts.dup + counts.big + counts.old + counts.name + counts.private + counts.junk };
    },
    names(out) {
      const j = JSON.parse(out);
      const sm = j.summary || {};
      const counts = { dirs: sm.dirs || 0, files: sm.files || 0, new: sm.new || 0, refs: sm.with_refs || 0 };
      return { json: j, counts, total: sm.items || 0 };
    },
    frame(out) {
      const m = String(out).match(/^틀: (.+)$/m);
      const path = m ? m[1].trim() : null;
      const rel = path && toRel(path);
      const info = (String(out).match(/^(소제목.*)$/m) || [])[1] || '';
      const checks = String(out).split('\n').filter((l) => /^\s+확인:/.test(l)).map((l) => l.trim());
      const html = rel ? rel.replace(/\.md$/, '') + '_미리보기.html' : null;
      return { path, rel, name: fileName(path), info, checks, html };
    },
    lecture(out, err, ev, s) {
      const lines = String(out).split('\n');
      const r = { manuscript: '', row: '', exists: false, warns: [], written: null, write: s.id === 'lecture-write' };
      lines.forEach((l, i) => {
        let m;
        if ((m = l.match(/^원고: (.+)$/))) r.manuscript = m[1].trim();
        if (/^넣을 줄/.test(l) && lines[i + 1]) r.row = lines[i + 1].trim();
        if (/^이미 목록에 있어서 넣지 않아요/.test(l)) { r.exists = true; if (lines[i + 1] && lines[i + 1].trim().startsWith('|')) r.row = lines[i + 1].trim(); }
        if (/^\s+(주의|참고):/.test(l)) r.warns.push(l.trim());
        if ((m = l.match(/^썼어요: (.+)$/))) r.written = m[1].trim();
      });
      return r;
    },
    blog(out) {
      const m = String(out).match(/미리보기를 만들었어요:\s*(.+)$/m);
      const path = m ? m[1].trim() : null;
      return { path, rel: path && toRel(path), info: (String(out).match(/^(제목 후보.*)$/m) || [])[1] || '' };
    },
    pixel(out) {
      const m = String(out).match(/(\d+)장 완료 → (.+)$/m);
      const dir = m ? m[2].trim() : null;
      const fails = String(out).split('\n').filter((l) => /^실패/.test(l));
      return { n: m ? +m[1] : 0, dir, whole: dir && toRel(dir + '/_전체.png'), fails };
    },
    proj(out) {
      const diffs = String(out).split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2));
      return { diffs, n: diffs.length };
    },
    test(out, err, ev, s) { return parseTests(out, s.planned, false); },
    testlist(out) {
      const names = String(out).split('\n').map((l) => (l.match(/^tests\/(test_[A-Za-z0-9_]+)\.js/) || [])[1]).filter(Boolean);
      S.test.planned = names;
      if (S.test.status === 'run') S.test.result = parseTests(S.test.out, names, true);
      return { names };
    },
    sync(out) {
      const items = String(out).split('\n').filter((l) => /^[A-Za-z0-9_]+: v\d+ \d+프레임/.test(l));
      const problems = items.filter((l) => /문제:/.test(l));
      return { n: items.length, problems, last: lastLine(out) };
    },
    pf(out) { return { last: lastLine(out) }; },
    imgconv(out) {
      const t = String(out);
      const m = t.match(/요약: 그림 (\d+)개 중 만듦 (\d+) · 건너뜀 (\d+) · 실패 (\d+)/);
      const dirs = t.split('\n').filter((l) => /^결과 폴더: /.test(l)).map((l) => toRel(l.slice(7).trim())).filter(Boolean);
      const notes = t.split('\n').filter((l) => /^(안내|의도): /.test(l));
      const fails = t.split('\n').filter((l) => /^X /.test(l)).map((l) => l.slice(2));
      return { n: m ? +m[1] : 0, made: m ? +m[2] : 0, skip: m ? +m[3] : 0, fail: m ? +m[4] : 0, dirs, notes, fails };
    },
    board(out) {
      const m = String(out).match(/^비교판: (.+)$/m);
      const path = m ? m[1].trim() : null;
      const c = String(out).match(/^시안 (\d+)개 \(그림 (\d+) · HTML (\d+)\)/m);
      return { path, rel: path && toRel(path), name: fileName(path), count: c ? +c[1] : 0, images: c ? +c[2] : 0, html: c ? +c[3] : 0 };
    },
    deploy(out) {
      const j = JSON.parse(out);
      if (j.error) throw new Error(j.error);
      const c = j.counts || {};
      return { json: j, verdict: j.verdict, block: c['막힘'] || 0, check: c['확인 필요'] || 0, total: (c['막힘'] || 0) + (c['확인 필요'] || 0) };
    },
  };
  function summary(key) {
    const s = S[key], r = s.result || {};
    if (s.status === 'fail') return s.stopped ? '멈춤' : s.error && s.code == null ? s.error : key === 'test' && r.fail ? '실패 · ' + r.fail + '개' : key === 'imgconv' && r.fail ? '실패 · ' + r.fail + '장' : r.parseError && key === 'deploy' ? r.parseError : '종료 코드 ' + s.code;
    if (s.status !== 'ok') return '';
    switch (key) {
      case 'clean': return '후보 ' + r.total;
      case 'names': return '후보 ' + r.total;
      case 'frame': return r.name ? '틀 ' + r.name : '틀 만듦';
      case 'lecture': return r.write ? (r.written ? '강의목록에 넣었어요' : r.exists ? '이미 목록에 있어요' : '끝남') : r.exists ? '이미 목록에 있어요' : r.row ? '넣을 줄 1' : '넣을 줄 없음';
      case 'blog': return '크롬에서 열림';
      case 'pixel': return r.n + '장';
      case 'proj': return r.n ? '다른 곳 ' + r.n : '맞음';
      case 'test': return r.fail ? '실패 · ' + r.fail + '개' : r.pass + '개 통과';
      case 'sync': return '그림 ' + (r.n || 0) + '개' + (r.problems && r.problems.length ? ' · 문제 ' + r.problems.length : '');
      case 'pf': return r.last || '';
      case 'imgconv': return r.made + '장 만듦' + (r.skip ? ' · 건너뜀 ' + r.skip : '');
      case 'board': return '시안 ' + r.count + '개';
      case 'deploy': return r.verdict + (r.total ? ' · ' + r.total : '');
      default: return '';
    }
  }
  function clock(ms) { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  const LECTURE = '10_프로젝트/01_진행/강의';
  const verOf = (n) => { const m = n.match(/_v(\d+)(?=[^/]*\.md$)/); return m ? +m[1] : 0; };
  const dateOf = (n) => { const m = n.match(/^(\d{8})_/); return m ? m[1] : ''; };
  async function listMd(dir) {
    try { if ((await D().kind(dir)) !== 'directory') return []; } catch (e) { return []; }
    let l = []; try { l = await D().list(dir); } catch (e) { return []; }
    return l.filter((f) => f.kind === 'file' && /\.md$/i.test(f.name) && !f.name.startsWith('.')).map((f) => ({ name: f.name.normalize('NFC'), rel: dir + '/' + f.name.normalize('NFC'), ver: verOf(f.name), date: dateOf(f.name) }));
  }
  async function lectureTopics() {
    if (!desktop()) return [];
    let dirs = [];
    try { dirs = (await D().list(LECTURE)).filter((f) => f.kind === 'directory' && !f.name.startsWith('.') && !f.name.startsWith('_')); } catch (e) { return []; }
    const out = [];
    for (const d of dirs) {
      const topic = d.name.normalize('NFC'), dir = LECTURE + '/' + topic;
      const sortV = (a, b) => b.ver - a.ver || b.date.localeCompare(a.date) || b.name.localeCompare(a.name);
      const manus = (await listMd(dir + '/원고')).sort(sortV);
      const blogs = (await listMd(dir + '/블로그')).sort(sortV);
      const latest = [manus[0], blogs[0]].filter(Boolean).map((f) => f.date).sort().pop() || '';
      out.push({ topic, dir, manus, blogs, latest });
    }
    return out.sort((a, b) => b.latest.localeCompare(a.latest) || a.topic.localeCompare(b.topic));
  }
  async function assetDirs() {
    if (!desktop()) return [];
    const base = '10_프로젝트/01_진행';
    let dirs = [];
    try { dirs = (await D().list(base)).filter((f) => f.kind === 'directory' && !f.name.startsWith('.')); } catch (e) { return []; }
    const out = [];
    for (const d of dirs) {
      const rel = base + '/' + d.name.normalize('NFC') + '/디자인/에셋';
      try { if ((await D().kind(rel)) === 'directory') out.push({ project: d.name.normalize('NFC'), rel }); } catch (e) {  }
    }
    return out.sort((a, b) => (b.project === 'pixel-office') - (a.project === 'pixel-office') || a.project.localeCompare(b.project));
  }
  const memo = {};
  async function devProjects() {
    if (!desktop() || !D().toolRunJson) return [];
    try { const r = await D().toolRunJson('predeploy-list', {}); return r && r.ok && Array.isArray(r.json.projects) ? r.json.projects.map((x) => ({ name: String(x.name) })) : []; } catch (e) { return []; }
  }

  const AP = { loaded: false, available: true, error: '', list: [], st: {}, busy: {}, last: null };
  const nfc = (x) => String(x == null ? '' : x).normalize('NFC');
  const apId = (staff, conn) => nfc(staff) + ':' + nfc(conn);
  const apDef = (id) => AP.st[id] || null;
  const apOfStaff = (name) => (pub() ? [] : AP.list.filter((id) => AP.st[id].staff === nfc(name)));
  function apState(id) {
    const s = AP.st[id];
    if (!s || !s.approved) return { approved: false, s: s || null };
    if (s.expires && Date.now() > Date.parse(s.expires)) return { approved: false, expired: true, s };
    return { approved: true, s };
  }
  function apTake(j) {
    const st = {}, list = [];
    (j.conns || []).forEach((c) => { const id = apId(c.staff, c.conn); if (!st[id]) list.push(id); st[id] = Object.assign({}, c, { staff: nfc(c.staff), conn: nfc(c.conn) }); });
    AP.st = st; AP.list = list; AP.loaded = true; AP.error = '';
  }
  let apBusyAll = false;
  async function approvalRefresh() {
    if (!desktop() || pub() || !D().toolRunJson || apBusyAll) return;
    apBusyAll = true;
    try {
      const r = await D().toolRunJson('approval-status', {});
      if (r && r.ok) { apTake(r.json); AP.available = true; } else if (r && r.missing) { AP.available = false; } else if (r && !r.canceled) AP.error = (r && r.error) || '상태를 읽지 못했어요';
    } catch (e) { AP.error = String(e.message || e); } finally { apBusyAll = false; }
    notify();
  }
  async function approvalToggle(pair) {
    if (!desktop() || !D().toolRunJson) return { ok: false, error: '데스크톱 앱에서만 돼요.' };
    if (pub()) return { ok: false, error: '공용판에는 없는 기능이에요.' };
    const def = apDef(pair);
    if (!def) return { ok: false, error: '승인 표에 없는 연결이에요.' };
    if (AP.busy[pair]) return { ok: false, error: '기록하는 중이에요.' };
    const want = !apState(pair).approved;
    AP.busy[pair] = true; notify(true);
    let r;
    try { r = await D().toolRunJson(want ? 'approval-grant' : 'approval-revoke', { staff: def.staff, conn: def.conn }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    AP.busy[pair] = false;
    if (r && r.ok) { apTake(r.json); AP.last = { pair, did: r.json.did, record: r.json.record || null, message: r.json.message || '', t: Date.now() }; }
    else { if (r && r.missing) AP.available = false; AP.last = { pair, error: (r && r.error) || '기록하지 못했어요', t: Date.now() }; }
    notify(true);
    return r && r.ok ? { ok: true, did: r.json.did, record: r.json.record } : { ok: false, error: AP.last.error, missing: !!(r && r.missing) };
  }
  const q = (x) => (/^[0-9A-Za-z가-힣_.-]+$/.test(x) ? x : '"' + x + '"');
  const CHECK_CMD = (pair) => { const a = apDef(pair); return a ? 'python3 "00_운영/도구/승인기록/확인.py" ' + q(a.staff) + ' ' + q(a.conn) : ''; };

  const API = { STAFF_TOOLS_CODE, setStaffTools, staffSource: () => staffSource, AP, apId, apOfStaff, apDef, apState, approvalRefresh, approvalToggle, CHECK_CMD, DEFS, STAFF_TOOLS, DESK_TOOL, staffTools, deskTool, pub, pubHost, S, init, start, stop, subscribe, notify, markSeen, available, refreshList, refreshServer, summary, clock, hm, parseTests, PARSE, lectureTopics, assetDirs, devProjects, IMG_DEFAULT, memo, desktop, toRel, fileName, setOffice: (o) => { office = o; }, office: () => office };
  root.POTools = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
