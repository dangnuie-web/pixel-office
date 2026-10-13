'use strict';
const { spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const FENCE = require('./fence');

const nfc = (s) => String(s).normalize('NFC');
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

const TOOLS = {
  'blog-preview': { script: '블로그미리보기/만들기.py', params: { draft: 'md' }, args: (p) => [p.draft] },
  'portfolio-on': { script: '포폴관리자/열기.sh', args: () => [] },
  'portfolio-off': { script: '포폴관리자/열기.sh', args: () => ['끄기'] },
  'pixel-preview': { script: '픽셀미리보기/render.py', params: { dir: 'assetdir', scale: 'scale' }, args: (p) => [p.dir, path.join(path.dirname(p.dir), '미리보기', 'png'), String(p.scale)] },
  'project-check': { script: '프로젝트목록점검/점검.py', args: () => [] },
  'test-run': { script: '시험돌리기/돌리기.py', args: () => [] },
  'test-list': { script: '시험돌리기/돌리기.py', args: () => ['--목록'] },
  'asset-sync': { script: '그림동기화/동기화.py', args: () => [] },
  'cleanup-scan': { script: '정리점검/점검.py', args: () => ['--json', '-'] },
  'name-check': { script: '이름점검/점검.py', args: () => ['--json', '-'] },
  'blog-frame': { script: '블로그틀/만들기.py', params: { src: 'md' }, args: (p) => [p.src, '--open'] },
  'lecture-preview': { script: '강의목록갱신/갱신.py', params: { src: 'lecture' }, args: (p) => [p.src] },
  'lecture-write': { script: '강의목록갱신/갱신.py', params: { src: 'lecture' }, args: (p) => [p.src, '--write'] },
  'pixel-convert': { script: '픽셀변환/변환.py', json: true,
    params: { src: 'image', cells: 'cells', colors: 'colors', outline: 'onoff', background: 'bg', resample: 'resample', crop: 'crop?' },
    args: (p) => [p.src, '--칸', String(p.cells), '--색', String(p.colors), '--외곽선', p.outline, '--배경', p.background, '--줄이기', p.resample]
      .concat(p.crop ? ['--자르기', p.crop] : []).concat(['--미리보기', '끔', '--json', '-']) },
  'approval-status': { script: '승인기록/승인.py', json: true, args: () => ['상태', '--json', '-'] },
  'approval-grant': { script: '승인기록/승인.py', json: true, params: { staff: 'apstaff', conn: 'apconn' }, check: approvalPair, args: (p) => ['승인', p.staff, p.conn, '--어디서', '앱', '--json', '-'] },
  'approval-revoke': { script: '승인기록/승인.py', json: true, params: { staff: 'apstaff', conn: 'apconn' }, check: approvalPair, args: (p) => ['취소', p.staff, p.conn, '--어디서', '앱', '--json', '-'] },
  'image-convert': { script: '이미지변환/변환.py',
    params: { src: 'imgsrc', format: 'imgfmt', long: 'longside?', scale: 'imgscale?', space: 'imgspace', intent: 'intent', out: 'outdir' },
    check: (office, p) => { if (p.long && p.scale) reject('배율과 긴 변은 같이 못 써요'); },
    args: (p) => [p.src, '--형식', p.format, '--색공간', p.space, '--의도', p.intent, '--폴더이름', p.out]
      .concat(p.long ? ['--긴변', String(p.long)] : []).concat(p.scale ? ['--배율', String(p.scale)] : []) },
  'design-board': { script: '시안비교판/만들기.py', params: { dir: 'designdir' }, args: (p) => [p.dir] },
  'predeploy-list': { script: '배포전점검/점검.py', json: true, args: () => ['--목록', '--json', '-'] },
  'predeploy-check': { script: '배포전점검/점검.py', params: { name: 'devname' }, args: (p) => [p.name, '--json', '-'] },
  'predeploy-test': { script: '배포전점검/점검.py', params: { name: 'devname' }, args: (p) => [p.name, '--시험', '--json', '-'] },
};
const APPROVAL_TABLE = '00_운영/도구/승인기록/연결표.json';
const AP_STAFF = /^[^\s:\-][^:\u0000-\u001f]{0,19}$/, AP_CONN = /^[a-z0-9][a-z0-9-]{0,39}$/;
function approvalTable(office) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(office, ...APPROVAL_TABLE.split('/')), 'utf8')); } catch (e) { reject('연결표.json을 읽지 못했어요'); }
  return (Array.isArray(j && j.connections) ? j.connections : []).map((c) => ({ staff: nfc(c.staff || '').trim(), conn: nfc(c.conn || '').trim() }));
}
function approvalPair(office, p) {
  if (!approvalTable(office).some((c) => c.staff === p.staff && c.conn === p.conn)) reject('승인 표에 없는 연결이에요: ' + p.staff + ' ' + p.conn);
}
const TOOL_IDS = Object.keys(TOOLS);

const PLAT = () => process.platform;
function firstExisting(list) { return list.find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || null; }
function envPath(env) {
  const k = Object.keys(env || {}).find((x) => x.toUpperCase() === 'PATH');
  return k ? String(env[k] || '') : '';
}
function pyDirs(base) {
  try {
    return fs.readdirSync(base).filter((x) => /^Python3\d*/i.test(x)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((x) => path.win32.join(base, x, 'python.exe'));
  } catch (e) { return []; }
}
function pythonCandidates(plat, env) {
  plat = plat || PLAT(); env = env || process.env;
  if (plat !== 'win32') return ['/usr/local/bin/python3', '/opt/homebrew/bin/python3', '/Library/Frameworks/Python.framework/Versions/Current/bin/python3', '/usr/bin/python3'];
  const W = path.win32;
  const fromPath = envPath(env).split(';').filter((d) => d && !/windowsapps/i.test(d)).map((d) => W.join(d.replace(/^"|"$/g, ''), 'python.exe'));
  const local = env.LOCALAPPDATA ? W.join(env.LOCALAPPDATA, 'Programs', 'Python') : null;
  const out = fromPath
    .concat(local ? pyDirs(local) : [])
    .concat(env.ProgramFiles ? pyDirs(env.ProgramFiles) : [])
    .concat(local ? [W.join(local, 'Launcher', 'py.exe')] : [])
    .concat([W.join(env.SystemRoot || env.windir || 'C:\\Windows', 'py.exe')]);
  return out.filter((x, i, a) => a.indexOf(x) === i);
}
function pythonPath(plat, env) { return firstExisting(pythonCandidates(plat, env)); }
function nodeBinDir() {
  const base = path.join(os.homedir(), '.nvm', 'versions', 'node');
  try {
    const v = fs.readdirSync(base).filter((x) => /^v\d+/.test(x)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return v.length ? path.join(base, v[0], 'bin') : null;
  } catch (e) { return null; }
}
function childEnv(plat, base) {
  plat = plat || PLAT();
  const win = plat === 'win32';
  const env0 = base || process.env;
  const py = pythonPath(plat, env0);
  const dirOf = win ? path.win32.dirname : path.dirname;
  const extra = (win ? [py && dirOf(py)] : [py && dirOf(py), nodeBinDir(), '/usr/local/bin', '/opt/homebrew/bin']).filter(Boolean);
  const env = Object.assign({}, env0, { PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' });
  if (win) env.PYTHONUTF8 = '1';
  else env.LANG = env0.LANG || 'ko_KR.UTF-8';
  const sep = win ? ';' : ':';
  const key = Object.keys(env).find((x) => x.toUpperCase() === 'PATH') || 'PATH';
  const cur = envPath(env) || (win ? '' : '/usr/bin:/bin:/usr/sbin:/sbin');
  Object.keys(env).forEach((x) => { if (x.toUpperCase() === 'PATH' && x !== key) delete env[x]; });
  env[key] = extra.concat(cur.split(sep)).filter((x, i, a) => x && a.indexOf(x) === i).join(sep);
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}
function interpreterFor(script, plat) {
  plat = plat || PLAT();
  if (/\.py$/.test(script)) return pythonPath(plat);
  if (/\.sh$/.test(script)) return plat === 'win32' ? null : '/bin/zsh';
  return null;
}
function killTree(child, sig, plat, execImpl) {
  plat = plat || PLAT();
  if (plat === 'win32') {
    const tk = path.win32.join(process.env.SystemRoot || process.env.windir || 'C:\\Windows', 'System32', 'taskkill.exe');
    try { (execImpl || require('child_process').execFile)(tk, ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {}); } catch (e) { try { child.kill(); } catch (e2) {  } }
    return;
  }
  try { process.kill(-child.pid, sig); } catch (e) { try { child.kill(sig); } catch (e2) {  } }
}
function chromeOpenCommand(full, plat, env) {
  plat = plat || PLAT(); env = env || process.env;
  if (plat === 'darwin') return { file: '/usr/bin/open', args: ['-a', 'Google Chrome', full] };
  if (plat === 'win32') {
    const W = path.win32;
    const exe = firstExisting([env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean).map((b) => W.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe')));
    return exe ? { file: exe, args: [full] } : null;
  }
  return null;
}

function reject(msg) { const e = new Error(msg); e.fence = true; throw e; }

function safeRel(office, rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 1000) reject('경로가 아니에요');
  if (rel.indexOf('\0') >= 0) reject('경로가 아니에요');
  const r = nfc(rel).replace(/\/+$/, '');
  if (path.isAbsolute(r) || r.startsWith('~')) reject('오피스 폴더 안 경로만 돼요: ' + rel);
  const segs = r.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..')) reject('오피스 폴더 밖 경로는 안 돼요: ' + rel);
  if (segs.some((s) => s.startsWith('.') || s.startsWith('-') || s === '_to_delete') || FENCE.relBad(r)) reject('허용 안 되는 이름이에요: ' + rel);
  const root = fs.realpathSync(office);
  const full = path.join(root, ...segs);
  let real;
  try { real = fs.realpathSync(full); } catch (e) { reject('없는 파일이에요: ' + rel); }
  if (nfc(real) !== nfc(root) && !nfc(real).startsWith(nfc(root) + path.sep)) reject('오피스 폴더 밖 경로는 안 돼요: ' + rel);
  return { full: real, rel: segs.join('/') };
}
const CHOICE = { onoff: ['켬', '끔'], bg: ['가장자리', '투명'], resample: ['선', '다수', '평균'],
  imgfmt: ['그대로', 'png', 'jpg', 'webp', 'tif'], imgspace: ['그대로', 'sRGB', 'P3', 'CMYK'], intent: ['perceptual', 'relative'], outdir: ['변환', '발행용'] };
const CONVERT_EXT = /\.(png|jpe?g|webp|tiff?)$/i;
const DEV_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;
function checkParam(office, kind, v) {
  if (kind === 'scale') {
    const n = Number(v);
    if (![2, 3, 4].includes(n) || String(v) !== String(n)) reject('배율은 2·3·4만 돼요');
    return n;
  }
  if (kind === 'cells' || kind === 'colors') {
    const n = Number(v);
    const ok = kind === 'cells' ? [16, 24, 32].includes(n) : Number.isInteger(n) && n >= 2 && n <= 16;
    if (!ok || String(v) !== String(n)) reject(kind === 'cells' ? '칸 수는 16·24·32만 돼요' : '색 수는 2~16만 돼요');
    return n;
  }
  if (CHOICE[kind]) {
    if (typeof v !== 'string' || !CHOICE[kind].includes(v)) reject('정해진 값이 아니에요: ' + String(v).slice(0, 20));
    return v;
  }
  if (kind === 'imgscale' || kind === 'longside') {
    const n = Number(v);
    const ok = kind === 'imgscale' ? [2, 3, 4, 5, 6, 8].includes(n) : Number.isInteger(n) && n >= 16 && n <= 20000;
    if (!ok || String(v) !== String(n)) reject(kind === 'imgscale' ? '배율은 2·3·4·5·6·8만 돼요' : '긴 변은 16~20000 px 정수만 돼요');
    return n;
  }
  if (kind === 'devname') {
    if (typeof v !== 'string' || !DEV_NAME.test(v)) reject('프로젝트 이름은 영어 소문자·숫자·하이픈만 돼요');
    return v;
  }
  if (kind === 'apstaff' || kind === 'apconn') {
    const t = typeof v === 'string' ? nfc(v).trim() : '';
    if (!(kind === 'apstaff' ? AP_STAFF : AP_CONN).test(t)) reject('승인 표에 없는 연결이에요: ' + String(v).slice(0, 40));
    return t;
  }
  if (kind === 'crop') {
    if (typeof v !== 'string' || !/^\d{1,6},\d{1,6},[1-9]\d{0,5},[1-9]\d{0,5}$/.test(v)) reject('자르기는 x,y,너비,높이 정수 넷이에요');
    return v;
  }
  const { full, rel } = safeRel(office, v);
  const st = fs.statSync(full);
  if (kind === 'md') {
    if (!st.isFile() || !/\.md$/i.test(full)) reject('.md 파일만 고를 수 있어요: ' + v);
    return full;
  }
  if (kind === 'lecture') {
    if (!rel.startsWith('10_프로젝트/01_진행/강의/') || rel.split('/').length < 4) reject('강의 주제 폴더나 원고만 돼요: ' + v);
    if (!(st.isDirectory() || (st.isFile() && /\.md$/i.test(full)))) reject('강의 주제 폴더나 원고만 돼요: ' + v);
    return full;
  }
  if (kind === 'image') {
    if (!st.isFile() || !IMAGE_EXT.test(full)) reject('png·jpg·webp 그림만 돼요: ' + v);
    return full;
  }
  if (kind === 'imgsrc') {
    if (!(st.isDirectory() || (st.isFile() && CONVERT_EXT.test(full)))) reject('그림 폴더나 png·jpg·webp·tif 그림만 돼요: ' + v);
    return full;
  }
  if (kind === 'designdir') {
    if (!st.isDirectory()) reject('시안 폴더만 돼요: ' + v);
    return full;
  }
  if (kind === 'assetdir') {
    const segs = rel.split('/');
    if (!st.isDirectory() || segs[segs.length - 1] !== '에셋' || segs[segs.length - 2] !== '디자인') reject('디자인/에셋 폴더만 돼요: ' + v);
    return full;
  }
  reject('모르는 인자 종류');
}

function scriptPath(office, def) {
  const p = path.join(office, '00_운영', '도구', ...def.script.split('/'));
  try { if (fs.statSync(p).isFile()) return p; } catch (e) {  }
  return null;
}

function buildCommand(office, id, params) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(TOOLS, id)) reject('목록에 없는 도구예요: ' + id);
  const def = TOOLS[id];
  params = params == null ? {} : params;
  if (typeof params !== 'object' || Array.isArray(params)) reject('인자 모양이 달라요');
  const allowed = def.params || {};
  Object.keys(params).forEach((k) => { if (!Object.prototype.hasOwnProperty.call(allowed, k)) reject('정해지지 않은 인자예요: ' + k); });
  const p = {};
  Object.keys(allowed).forEach((k) => {
    const opt = allowed[k].endsWith('?'), kind = allowed[k].replace(/\?$/, '');
    if (params[k] == null || params[k] === '') { if (opt) return; reject('인자가 빠졌어요: ' + k); }
    p[k] = checkParam(office, kind, params[k]);
  });
  if (def.check) def.check(office, p);
  const script = scriptPath(office, def);
  if (!script) { const e = new Error('준비 중: 00_운영/도구 안 스크립트가 아직 없어요'); e.fence = true; e.missing = true; throw e; }
  const file = interpreterFor(script);
  if (!file) reject(/\.sh$/.test(script) && PLAT() === 'win32' ? '윈도우에서는 돌릴 수 없는 도구예요 (.sh)' : '실행기를 찾지 못했어요 (파이썬 3 이 설치돼 있는지 확인해 주세요)');
  return { file, args: [script].concat(def.args(p)), cwd: office };
}

function listTools(office) {
  const out = {};
  TOOL_IDS.forEach((id) => { const s = scriptPath(office, TOOLS[id]); out[id] = { available: !!s, script: s ? path.relative(office, s) : null }; });
  return out;
}

const officeOf = (office) => (typeof office === 'function' ? office() : office);
function createRunner({ office: office0, send, spawnImpl }) {
  const running = new Map();
  let seq = 0;
  const sp = spawnImpl || spawn;
  function start(id, params) {
    if (typeof id === 'string' && TOOLS[id] && TOOLS[id].json) reject('결과만 받는 도구예요 (runJson)');
    if (running.has(id)) reject('이미 도는 중이에요');
    const sib = { 'lecture-preview': 'lecture-write', 'lecture-write': 'lecture-preview', 'portfolio-on': 'portfolio-off', 'portfolio-off': 'portfolio-on' }[id];
    if (sib && running.has(sib)) reject('이미 도는 중이에요');
    const office = officeOf(office0);
    const cmd = buildCommand(office, id, params);
    const runId = id + ':' + (++seq) + ':' + Date.now();
    const child = sp(cmd.file, cmd.args, { cwd: cmd.cwd, env: childEnv(), shell: false, detached: PLAT() !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const rec = { child, runId, stopped: false, t0: Date.now() };
    running.set(id, rec);
    const realOffice = fs.realpathSync(office);
    send({ type: 'start', id, runId, t: rec.t0, args: cmd.args.slice(1).map((a) => (a.startsWith(realOffice + path.sep) ? path.relative(realOffice, a) : a)) });
    const pipe = (stream, name) => {
      if (!stream) return;
      const dec = new StringDecoder('utf8');
      stream.on('data', (b) => { const t = dec.write(b); if (t) send({ type: 'out', id, runId, stream: name, text: t }); });
      stream.on('end', () => { const t = dec.end(); if (t) send({ type: 'out', id, runId, stream: name, text: t }); });
    };
    pipe(child.stdout, 'out'); pipe(child.stderr, 'err');
    let done = false;
    const finish = (code, signal, err) => {
      if (done) return; done = true;
      if (running.get(id) === rec) running.delete(id);
      clearTimeout(rec.killTimer);
      send({ type: 'end', id, runId, code: code == null ? null : code, signal: signal || null, stopped: rec.stopped, error: err ? String(err.message || err) : null, ms: Date.now() - rec.t0 });
    };
    child.on('error', (e) => finish(null, null, e));
    child.on('close', (code, signal) => finish(code, signal));
    return { runId };
  }
  function stop(id) {
    const rec = running.get(id);
    if (!rec) return false;
    rec.stopped = true;
    killTree(rec.child, 'SIGTERM');
    if (PLAT() !== 'win32') rec.killTimer = setTimeout(() => killTree(rec.child, 'SIGKILL'), 3000);
    return true;
  }
  function stopAll() { Array.from(running.keys()).forEach(stop); }
  function isRunning(id) { return running.has(id); }
  return { start, stop, stopAll, isRunning };
}

function createJsonRunner({ office: office0, execImpl, timeoutMs, maxBytes }) {
  const { execFile } = require('child_process');
  const ex = execImpl || execFile;
  const live = new Map();
  function run(id, params) {
    return new Promise((resolve) => {
      let cmd;
      try {
        if (typeof id !== 'string' || !TOOLS[id] || !TOOLS[id].json) reject('목록에 없는 도구예요: ' + id);
        cmd = buildCommand(officeOf(office0), id, params);
      } catch (e) { resolve({ ok: false, error: String(e.message || e), missing: !!e.missing }); return; }
      const prev = live.get(id);
      if (prev) { prev.__canceled = true; try { prev.kill('SIGTERM'); } catch (e) {  } }
      const child = ex(cmd.file, cmd.args, { cwd: cmd.cwd, env: childEnv(), shell: false, windowsHide: true, timeout: timeoutMs || 60000, maxBuffer: maxBytes || 16 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
        if (live.get(id) === child) live.delete(id);
        if (child.__canceled) { resolve({ ok: false, canceled: true }); return; }
        let j = null; try { j = JSON.parse(String(stdout || '').trim().split('\n').pop()); } catch (e) { j = null; }
        if (j && !j.error) { resolve({ ok: true, json: j }); return; }
        resolve({ ok: false, error: j && j.error ? j.error : (err && err.killed ? '시간이 너무 걸려 멈췄어요' : String(stderr || (err && err.message) || '결과를 읽지 못했어요').trim().slice(-400)) });
      });
      live.set(id, child);
    });
  }
  function stopAll() { live.forEach((c) => { c.__canceled = true; try { c.kill('SIGTERM'); } catch (e) {  } }); live.clear(); }
  return { run, stopAll };
}

function imageRelInOffice(office, abs) {
  const rel = relInOffice(office, abs);
  if (!rel || !IMAGE_EXT.test(rel)) return null;
  try { safeRel(office, rel); } catch (e) { return null; }
  return rel;
}

function portOpen(port, host) {
  return new Promise((res) => {
    const s = net.connect({ port, host: host || '127.0.0.1' });
    const done = (v) => { s.destroy(); res(v); };
    s.setTimeout(800, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

const OPEN_EXT = /\.(html|png|md)$/i;
function openablePath(office, rel) {
  const { full } = safeRel(office, rel);
  if (!fs.statSync(full).isFile() || !OPEN_EXT.test(full)) reject('열 수 없는 파일이에요');
  return full;
}
function relInOffice(office, abs) {
  if (typeof abs !== 'string') return null;
  let root, real;
  try { root = fs.realpathSync(office); real = fs.realpathSync(abs); } catch (e) { return null; }
  if (!nfc(real).startsWith(nfc(root) + path.sep)) return null;
  return nfc(path.relative(root, real)).split(path.sep).join('/');
}

module.exports = { TOOLS, TOOL_IDS, APPROVAL_TABLE, approvalTable, buildCommand, listTools, createRunner, createJsonRunner, portOpen, safeRel, openablePath, relInOffice, imageRelInOffice, pythonPath, pythonCandidates, childEnv, interpreterFor, killTree, chromeOpenCommand, IMAGE_EXT };
