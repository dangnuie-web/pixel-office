'use strict';
const { app, BrowserWindow, ipcMain, screen, Menu, shell, nativeImage, desktopCapturer, systemPreferences, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = fs.realpathSync(__dirname);
const HOME = app.getPath('home');
const E = require('./lib/edition');
const OD = require('./lib/officedir');
const N = require('./lib/names');
const PUB = E.apply(E.isPublic(process.env));
const EDITION = E.edition(PUB);
let OFFICE = null;
const DEV = process.env.TP_DEV === '1';
const HOUSE_DIR = process.env.TP_HOUSE || null;
const PL = require('./lib/platform');
const pixelOfficeApp = () => PL.findPixelOffice({ platform: process.platform, home: HOME, env: process.env, pub: PUB });

const { makeOffice } = require('./lib/office');
const { makeFence } = require('./lib/fence');
const B = require('./lib/brief');
const R = require('./lib/roadmaps');
const M = require('./lib/memo');
const S = require('./lib/sprites');
const A = require('./lib/appt');
const C = require('./lib/po').load('calCore');
const RM = require('./lib/remind');
const CO = require('./lib/color');
const HD = require('./lib/hide');
const FEAT = E.features(PUB);
const MEMO_KINDS = ['idea', 'lecture', 'appt'].filter((k) => k !== 'lecture' || FEAT.lecture);

app.setName(EDITION.name);
if (process.platform === 'win32' && app.setAppUserModelId) app.setAppUserModelId(EDITION.appId);
if (process.env.TP_USERDATA) app.setPath('userData', path.resolve(process.env.TP_USERDATA));
else if (EDITION.userDataDir) app.setPath('userData', path.join(app.getPath('appData'), EDITION.userDataDir));
if (!app.requestSingleInstanceLock()) { app.exit(0); }

const CHOICE = {
  tapOpensMemo: true,
  memoBand: true,
};

const SCALE = 4;
const STAND_PT = 109;
const PIXELATED = process.env.TP_PIXELATED === '1';
const BUBBLE_ROOM = 146;
let WIN_W = 300, WIN_H = 230;
const RANGE = 170;
const SPEED = 38;
const CHECK_MS = DEV ? 3000 : 20000;
const PERIODIC_MS = 30 * 60 * 1000;
const REMIND_MS = DEV ? 5000 : 30000;
const HIDE_MS = DEV && process.env.TP_HIDE_MS ? +process.env.TP_HIDE_MS : 10 * 60 * 1000;

let office = null, officeInfo = null;
let sprites = {}, spriteInfo = {}, png = null;
let TW = 16 * SCALE, TH = 21 * SCALE;
let pet = null, viewer = null, memoWin = null, pickWin = null, colorWins = [];
const st = {
  cx: 0, by: 0,
  home: null,
  mode: 'idle', dir: 'left',
  ignore: true, hidden: false,
  modeTimer: null, walkTimer: null, dragTimer: null, drag: null,
  queue: [], talking: false, talkTimer: null,
  lastFp: null, prevState: null, snap: null, periodicN: 0,
  memo: false, memoDraft: { kind: 'idea', text: '', appt: { date: '', time: '', ak: '미팅', text: '' } }, refTopic: null, hover: null, pick: null,
};

const POS_FILE = () => path.join(app.getPath('userData'), 'pet.json');
function loadPos() { try { const p = JSON.parse(fs.readFileSync(POS_FILE(), 'utf8')); if (Number.isFinite(p.cx) && Number.isFinite(p.by)) return p; } catch (e) {} return null; }
function savePos() { try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(POS_FILE(), JSON.stringify({ cx: Math.round(st.home.cx), by: Math.round(st.home.by), memoKind: st.memoDraft.kind, refTopic: st.refTopic || undefined })); } catch (e) {} }
function loadPrefs() { try { const p = JSON.parse(fs.readFileSync(POS_FILE(), 'utf8')); if (MEMO_KINDS.includes(p.memoKind)) st.memoDraft.kind = p.memoKind; if (typeof p.refTopic === 'string') st.refTopic = p.refTopic; } catch (e) {} }

function displayAt(cx, by) { return screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(by - TH / 2) }); }
function clampPos(cx, by, disp) {
  const wa = (disp || displayAt(cx, by)).workArea;
  return {
    cx: Math.min(Math.max(cx, wa.x + TW / 2), wa.x + wa.width - TW / 2),
    by: Math.min(Math.max(by, wa.y + WIN_H), wa.y + wa.height),
  };
}
function winX() {
  const wa = displayAt(st.cx, st.by).workArea;
  const want = st.cx - WIN_W / 2;
  return Math.round(wa.width >= WIN_W ? Math.min(Math.max(want, wa.x), wa.x + wa.width - WIN_W) : want);
}
function placeWindow() {
  if (!pet) return;
  const x = winX();
  pet.setBounds({ x, y: Math.round(st.by - WIN_H), width: WIN_W, height: WIN_H });
  sendView(x);
}
function sendView(x0) {
  if (!pet) return;
  if (x0 === undefined) x0 = winX();
  const wa = displayAt(st.cx, st.by).workArea;
  send('pet:view', { left: Math.max(0, wa.x - x0), right: Math.min(WIN_W, wa.x + wa.width - x0), toriX: Math.round(st.cx - x0 - TW / 2) });
}
function send(ch, data) { if (pet && !pet.isDestroyed()) pet.webContents.send(ch, data); }

const rand = (a, b) => a + Math.random() * (b - a);
function faceCenter() {
  const wa = displayAt(st.cx, st.by).workArea;
  st.dir = st.cx < wa.x + wa.width / 2 ? 'right' : 'left';
}
function setMode(mode, ms) {
  if (DEV && process.env.TP_LOG_MODE) console.log('mode', mode);
  if (mode !== 'walk') faceCenter();
  clearTimeout(st.modeTimer); clearInterval(st.walkTimer); st.walkTimer = null;
  st.mode = mode;
  send('pet:pose', { mode, dir: st.dir });
  if (ms) st.modeTimer = setTimeout(nextAction, ms);
}
function nextAction() {
  if (st.hidden || st.drag || st.talking || st.memo || st.hover) return;
  const r = Math.random();
  if (png) {
    if (r < 0.55) walk(); else setMode('idle', rand(3000, 8000));
    return;
  }
  if (r < 0.5) walk();
  else if (r < 0.62) setMode('sit', rand(8000, 18000));
  else if (r < 0.72) setMode('coffee', rand(8000, 15000));
  else setMode('idle', rand(2500, 6000));
}
function walk() {
  const home = st.home || { cx: st.cx, by: st.by };
  const disp = displayAt(home.cx, home.by);
  let target = clampPos(home.cx + rand(-RANGE, RANGE), home.by, disp).cx;
  if (Math.abs(target - st.cx) < 30) target = clampPos(st.cx + (st.cx > home.cx ? -60 : 60), home.by, disp).cx;
  st.dir = target < st.cx ? 'left' : 'right';
  setMode('walk');
  let last = Date.now();
  st.walkTimer = setInterval(() => {
    const now = Date.now(); const step = SPEED * (now - last) / 1000; last = now;
    const d = target - st.cx;
    if (Math.abs(d) <= step) { st.cx = target; placeWindow(); setMode('idle', rand(1500, 4000)); return; }
    st.cx += Math.sign(d) * step; placeWindow();
  }, 33);
}

function say(text, opts) {
  if (!text) return;
  opts = opts || {};
  const item = { text, ms: opts.ms, rich: opts.rich || null };
  if (opts.now || opts.front) st.queue.unshift(item); else st.queue.push(item);
  if (st.queue.length > 4) st.queue.length = 4;
  if (opts.now && st.talking) { send('pet:hideBubble'); finishTalk(); return; }
  if (!st.talking) talkNext();
}
function talkNext() {
  if (st.hidden || st.drag || st.memo) return;
  const item = st.queue.shift();
  if (!item) { st.talking = false; nextAction(); return; }
  const text = item.text;
  st.talking = true;
  const ms = item.ms || Math.min(11000, Math.max(4500, 3000 + Array.from(text).length * 110));
  setMode('talk');
  send('pet:say', { text, ms, rich: item.rich });
  clearTimeout(st.talkTimer);
  st.talkTimer = setTimeout(finishTalk, ms + 1500);
}
function finishTalk() {
  clearTimeout(st.talkTimer);
  st.talking = false;
  setTimeout(() => { if (!st.talking) talkNext(); }, 600);
}

function refresh() { updateNames(); st.snap = office ? office.snapshot() : null; return st.snap; }
function updateNames() {
  let claudeText = '';
  if (PUB && office) { try { claudeText = office.read('CLAUDE.md'); } catch (e) { claudeText = ''; } }
  return N.refresh({ pub: PUB, claudeText, configBoss: officeInfo && officeInfo.bossName });
}
function resolveOffice() { return OD.resolve({ pub: PUB, env: process.env, home: HOME, appData: app.getPath('appData'), appRoot: ROOT }); }
function useOffice(info) {
  const was = OFFICE;
  officeInfo = info; OFFICE = info.path;
  if (OFFICE === was && (office || !OFFICE)) return false;
  office = OFFICE ? makeOffice(OFFICE) : null;
  updateNames();
  fenceObj = null; st.lastFp = null; st.snap = null;
  apptCache.office.key = null; apptCache.office.items = [];
  if (was !== null || !OFFICE) {
    closeMemo(); if (pickWin && !pickWin.isDestroyed()) pickWin.close(); if (viewer && !viewer.isDestroyed()) viewer.close();
    st.prevState = null;
  }
  return true;
}
function needOffice() {
  if (office) return true;
  say(OD.NO_OFFICE, { now: true, ms: 6000 });
  return false;
}
function followOffice() {
  if (!PUB) return;
  const info = resolveOffice();
  const had = !!office;
  if (!useOffice(info)) return;
  if (office) { say(had ? '사무실 폴더가 바뀌었어요\n' + homeShort(OFFICE) : '사무실을 찾았어요!\n' + homeShort(OFFICE), { now: true }); checkRoadmaps(true); }
  else say(OD.NO_OFFICE, { now: true, ms: 6000 });
}
const STATE_FILE = () => path.join(app.getPath('userData'), 'roadmaps.json');
function loadState() { try { const j = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')); if (!j || !j.projects) return null; if (j.office ? j.office !== OFFICE : PUB) return null; return j.projects; } catch (e) { return null; } }
function saveState(cur) { try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(STATE_FILE(), JSON.stringify({ saved: new Date().toISOString(), office: OFFICE, projects: cur })); } catch (e) {} }
function checkRoadmaps(force) {
  if (!office) return [];
  const fp = office.fingerprint();
  if (!force && fp === st.lastFp) return;
  st.lastFp = fp;
  const snap = refresh();
  const cur = R.stateOf(snap.col);
  const ch = R.changes(st.prevState, cur, snap.col);
  st.prevState = cur; saveState(cur);
  if (ch.length) say(R.announceChanges(ch));
  return ch;
}
function periodicLine() { const s = refresh(); return s ? R.periodicLine(s.col, st.periodicN++, s.baseYmd) : OD.NO_OFFICE; }

const SENT_FILE = () => path.join(app.getPath('userData'), 'reminders.json');
function loadSent() { try { const j = JSON.parse(fs.readFileSync(SENT_FILE(), 'utf8')); return j && j.sent && typeof j.sent === 'object' ? j.sent : {}; } catch (e) { return {}; } }
function saveSent(sent) { try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(SENT_FILE(), JSON.stringify({ saved: new Date().toISOString(), sent })); } catch (e) {} }
const apptCache = { office: { key: null, items: [] }, house: { key: null, items: [] } };
function readCached(slot, file, parse) {
  const c = apptCache[slot];
  if (!file) { c.key = null; c.items = []; return c.items; }
  let k;
  try { const s = fs.statSync(file); k = file + '|' + s.mtimeMs + '|' + s.size; } catch (e) { c.key = null; c.items = []; return c.items; }
  if (k !== c.key) { try { c.items = parse(fs.readFileSync(file, 'utf8')); c.key = k; } catch (e) { c.items = []; c.key = null; } }
  return c.items;
}
function apptItems() {
  return readCached('office', OFFICE ? path.join(OFFICE, ...C.PATH.split('/')) : null, RM.officeItems)
    .concat(FEAT.house ? readCached('house', RM.houseFile(HOUSE_DIR), RM.houseItems) : []);
}
function remindWindow(from, to, opt) {
  const o = opt || {};
  const sent = loadSent();
  const d = RM.due(apptItems(), from, to, sent);
  const bubbles = ['hour', 'eve'].map((type) => ({ type, b: RM.bubble(type, d[type]) })).filter((x) => x.b);
  bubbles.slice().reverse().forEach((x) => say(x.b.text, { front: true, ms: x.b.ms, rich: x.b }));
  if (bubbles.length && !o.dry) { bubbles.forEach((x) => d[x.type].forEach((m) => { sent[m.key] = to; })); saveSent(RM.pruneSent(sent, to)); }
  return bubbles.map((x) => x.b.text);
}
function remindTick() {
  const now = Date.now(), from = st.remindFrom;
  st.remindFrom = now;
  if (from == null || now <= from) return [];
  return remindWindow(from, now);
}

const dlog = (...a) => { if (DEV) console.log(new Date().toISOString().slice(11, 19), ...a); };
function dragStart() {
  if (st.drag) return;
  dlog('dragStart', JSON.stringify(screen.getCursorScreenPoint()), 'pet', st.cx, st.by);
  const p = screen.getCursorScreenPoint();
  st.drag = { ox: p.x - st.cx, oy: p.y - st.by, sx: p.x, sy: p.y, t: Date.now(), moved: false, still: Date.now(), lx: p.x, ly: p.y };
  clearTimeout(st.modeTimer); clearInterval(st.walkTimer); st.walkTimer = null;
  setIgnore(false);
  st.dragTimer = setInterval(() => {
    const q = screen.getCursorScreenPoint(); const d = st.drag;
    if (Math.abs(q.x - d.sx) + Math.abs(q.y - d.sy) > 4) { if (!d.moved) { d.moved = true; st.mode = 'drag'; send('pet:pose', { mode: 'drag', dir: st.dir }); } }
    if (q.x !== d.lx || q.y !== d.ly) { d.lx = q.x; d.ly = q.y; d.still = Date.now(); }
    else if (d.moved && Date.now() - d.still > 15000) { dragEnd(); return; }
    if (d.moved) { st.cx = q.x - d.ox; st.by = q.y - d.oy; placeWindow(); }
  }, 16);
}
function dragEnd() {
  if (!st.drag) return;
  clearInterval(st.dragTimer);
  const d = st.drag; st.drag = null;
  dlog('dragEnd moved=' + d.moved, st.cx, st.by);
  if (!d.moved) { tap(); return; }
  const p = screen.getCursorScreenPoint();
  const c = clampPos(st.cx, st.by, screen.getDisplayNearestPoint(p));
  st.cx = c.cx; st.by = c.by; st.home = { cx: c.cx, by: c.by };
  placeWindow(); savePos();
  if (st.talking) setMode('talk'); else setMode('idle', rand(1500, 3000));
}
function tap() {
  if (memoWin && !memoWin.isDestroyed()) { closeMemo(); return; }
  if (st.talking) { send('pet:hideBubble'); finishTalk(); return; }
  if (CHOICE.tapOpensMemo) openMemo(); else say(periodicLine());
}
function setIgnore(ig) {
  if (!pet || st.ignore === ig) return;
  st.ignore = ig;
  pet.setIgnoreMouseEvents(ig, { forward: true });
}

function showMenu() {
  const s = refresh();
  const poApp = pixelOfficeApp();
  const pend = pendingCount();
  const on = !!s;
  const menu = Menu.buildFromTemplate([
    ...(on ? [] : [{ label: OD.NO_OFFICE, enabled: false }, { type: 'separator' }]),
    { label: '메모하기', enabled: on, click: () => openMemo() },
    { label: '색 뽑기', click: () => startColor() },
    ...(pend ? [{ label: '맡겨 둔 메모 (' + pend + ')', click: () => shell.openPath(PENDING_FILE()) }] : []),
    { type: 'separator' },
    { label: N.values().bossCall + ' 할 일' + (on ? ' (' + s.col.say.length + ')' : ''), enabled: on, click: () => openViewer('todos') },
    { label: '프로젝트 다음 할 일', enabled: on, click: () => openViewer('next') },
    { type: 'separator' },
    { label: poApp ? '픽셀오피스 열기' : '픽셀오피스 열기 (앱 없음)', enabled: !!poApp, click: () => shell.openPath(poApp) },
    { label: '지금 한마디', click: () => say(periodicLine(), { now: true }) },
    { label: HD.MENU_LABEL, click: hideForAWhile },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
  st.menu = menu;
  menu.popup({ window: pet, callback: () => { st.menu = null; } });
}
function hideForAWhile() {
  st.hidden = true; clearTimeout(st.modeTimer); clearInterval(st.walkTimer); st.walkTimer = null;
  if (viewer && !viewer.isDestroyed()) viewer.close();
  if (pickWin && !pickWin.isDestroyed()) pickWin.close();
  closeMemo(); endColor();
  pet.hide();
  clearTimeout(st.hideTimer);
  st.hideTimer = setTimeout(() => showAgain(), HIDE_MS);
}
function showAgain(line) {
  clearTimeout(st.hideTimer); st.hideTimer = null;
  if (!st.hidden) return false;
  st.hidden = false; pet.showInactive(); setIgnore(true);
  if (line) say(line, { now: true });
  else if (st.queue.length) talkNext(); else nextAction();
  return true;
}
function reopened() {
  if (!pet) return;
  const was = st.hidden;
  if (was) showAgain(HD.reopenLine(true)); else say(HD.reopenLine(false), { now: true });
  return was;
}

const VW = 460, VH = 560;
function homeShort(p) { return p.startsWith(HOME + path.sep) ? '~' + p.slice(HOME.length) : p; }
function viewerPayload(kind) {
  const snap = refresh();
  const data = R.viewerData(kind, snap.col, snap);
  data.appTitle = N.values().pet + ' 브리핑';
  data.files = data.files.map((rel) => ({ rel, full: homeShort(path.join(OFFICE, rel)) }));
  data.portraitPng = png ? S.portraitPng() : null;
  data.portrait = data.portraitPng ? null : (sprites.tori_portrait || null);
  data.close = sprites.ui_close || null;
  data.clip = sprites.ui_board_clip || null;
  data.kraft = sprites.ui_kraft || null;
  if (snap.projectsError) data.blocks.unshift({ t: 'note', text: snap.projectsError });
  return data;
}
function openViewer(kind) {
  if (!needOffice()) return;
  const data = viewerPayload(kind);
  const wa = displayAt(st.cx, st.by).workArea;
  let x = st.cx + TW / 2 + 16; if (x + VW > wa.x + wa.width) x = st.cx - TW / 2 - 16 - VW;
  x = Math.min(Math.max(x, wa.x), wa.x + wa.width - VW);
  const y = Math.min(Math.max(st.by - VH, wa.y), wa.y + wa.height - VH);
  if (viewer && !viewer.isDestroyed()) {
    viewer.webContents.send('viewer:data', data); viewer.show(); viewer.focus(); app.focus({ steal: true }); return;
  }
  viewer = new BrowserWindow({
    x: Math.round(x), y: Math.round(y), width: VW, height: VH, show: false,
    frame: false, transparent: true, hasShadow: false, resizable: false, fullscreenable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, title: N.values().pet + ' 브리핑',
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  viewer.setAlwaysOnTop(true, 'floating');
  viewer.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  lockDown(viewer);
  viewer.loadFile(path.join(ROOT, 'viewer', 'viewer.html'));
  viewer.webContents.once('did-finish-load', () => { viewer.webContents.send('viewer:data', data); viewer.show(); viewer.focus(); app.focus({ steal: true }); });
  viewer.on('closed', () => { viewer = null; });
}

const MEMO_W = 340;
let fenceObj = null;
function fence() { if (!OFFICE) throw new Error(OD.NO_OFFICE); if (!fenceObj) fenceObj = makeFence(OFFICE, { lecture: FEAT.lecture }); return fenceObj; }
function todayYmd() { return B.core.fmtMin(B.core.nowMin()).slice(0, 10); }
function workDay() { return B.core.businessDay(B.core.nowMin()); }
const PENDING_FILE = () => path.join(app.getPath('userData'), '메모_임시보관.md');
function pendingCount() { try { return fs.readFileSync(PENDING_FILE(), 'utf8').split('\n').filter((l) => l.startsWith('- ')).length; } catch (e) { return 0; } }
function keepPending(kind, text, ymd, why) {
  const f = PENDING_FILE();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f)) fs.writeFileSync(f, PUB ? '# 펫 메모 임시 보관\n보관함 표 모양이 달라 못 쓴 메모. 보관함에 옮긴 뒤 이 줄을 지워 주세요.\n\n' : '');
  fs.appendFileSync(f, M.pendingLine(kind, text, ymd, why) + '\n');
}
const headH = () => (png ? png.layout.headH : TH);
function memoBounds(h) {
  const wa = displayAt(st.cx, st.by).workArea;
  const tipY = st.by - headH() + 3;
  if (tipY - (h - 3) < wa.y) {
    let x = st.cx + TW / 2 + 8; if (x + MEMO_W > wa.x + wa.width) x = st.cx - TW / 2 - 8 - MEMO_W;
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - MEMO_W);
    return { x: Math.round(x), y: Math.round(Math.min(Math.max(st.by - h, wa.y), wa.y + wa.height - h)), width: MEMO_W, height: Math.round(h), tailX: null };
  }
  const x = Math.round(Math.min(Math.max(st.cx - MEMO_W / 2, wa.x), wa.x + wa.width - MEMO_W));
  return { x, y: Math.round(tipY - (h - 3)), width: MEMO_W, height: Math.round(h), tailX: Math.round(st.cx - x) };
}
function openMemo() {
  if (st.hidden) return;
  if (!(memoWin && !memoWin.isDestroyed()) && !needOffice()) return;
  if (memoWin && !memoWin.isDestroyed()) { memoWin.show(); memoWin.focus(); app.focus({ steal: true }); return; }
  if (st.talking) { send('pet:hideBubble'); finishTalk(); }
  st.memo = true; clearTimeout(st.modeTimer); clearInterval(st.walkTimer); st.walkTimer = null; setMode('idle');
  const b = memoBounds(130);
  memoWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, show: false,
    frame: false, transparent: true, hasShadow: false, resizable: false, fullscreenable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, title: N.values().pet + ' 메모',
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  memoWin.setAlwaysOnTop(true, 'floating');
  memoWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  lockDown(memoWin);
  memoWin.loadFile(path.join(ROOT, 'memo', 'index.html'));
  memoWin.webContents.once('did-finish-load', () => {
    memoWin.webContents.send('memo:init', { tailX: b.tailX, tail: sprites.ui_tail || null, kind: st.memoDraft.kind, text: st.memoDraft.text, appt: st.memoDraft.appt, today: workDay(), band: CHOICE.memoBand, kinds: MEMO_KINDS });
    memoWin.show(); memoWin.focus(); app.focus({ steal: true });
  });
  memoWin.on('closed', () => { memoWin = null; st.memo = false; savePos(); if (st.queue.length && !st.talking) talkNext(); else if (!st.talking && !st.drag) setMode('idle', rand(1500, 3000)); });
}
function closeMemo() { if (memoWin && !memoWin.isDestroyed()) memoWin.close(); }
const MEMO_TO = { idea: '아이디어보관함', lecture: '강의소재.md' };
function saveMemo(kind, text) {
  if (!M.KINDS[kind] || !MEMO_KINDS.includes(kind) || typeof text !== 'string' || text.length > 2000) return { ok: false, why: '이상한 입력' };
  const ymd = todayYmd();
  let r;
  try { r = fence().writeMemo(kind, text, ymd); } catch (e) { r = { ok: false, why: e.message, shape: false }; }
  if (r.ok) { st.memoDraft.text = ''; closeMemo(); say('적어 뒀어요!\n' + (kind === 'idea' ? '아이디어보관함 맨 위에 한 줄' : '강의소재.md에 한 줄'), { now: true, ms: 2500 }); return r; }
  if (r.why === '빈 메모') return r;
  try { keepPending(kind, text, ymd, r.why); }
  catch (e) { return { ok: false, why: '임시 보관도 못 했어요: ' + e.message, keepOpen: true }; }
  st.memoDraft.text = ''; closeMemo();
  if (r.shape) say((kind === 'idea' ? '보관함' : '강의소재.md') + '에는 못 적었어요\n표 모양이 달라서요. 앱에 맡겨 뒀으니 사라지지 않아요', { now: true });
  else say('못 적었어요\n' + r.why + '. 쓴 글은 앱에 맡겨 뒀어요', { now: true });
  return r;
}

function saveAppt(a) {
  a = a || {};
  const f = { date: String(a.date || '').slice(0, 40), time: String(a.time || '').slice(0, 30), kind: String(a.ak || ''), text: String(a.text || '').slice(0, 200) };
  const r = A.read(f, workDay(), Date.now());
  if (!r.ok) return { ok: false, why: r.line1 + (r.line2 ? ' — ' + r.line2 : ''), keepOpen: true };
  let w;
  try { w = fence().writeAppt(r.item); } catch (e) { w = { ok: false, why: e.message }; }
  if (w.ok) {
    st.memoDraft.appt = { date: '', time: '', ak: r.item.kind, text: '' };
    closeMemo(); say(A.savedLine(r), { now: true, ms: 3500 });
    remindTick();
    return w;
  }
  if (w.input) return { ok: false, why: w.why, keepOpen: true };
  const line = r.item.date + ' ' + (r.item.time || '종일') + ' ' + r.item.kind + ' ' + r.item.text;
  try { keepPending('약속', line, todayYmd(), w.why); }
  catch (e) { return { ok: false, why: '임시 보관도 못 했어요: ' + e.message, keepOpen: true }; }
  st.memoDraft.appt = { date: '', time: '', ak: r.item.kind, text: '' }; closeMemo();
  say('약속 파일에는 못 적었어요\n' + w.why + '. 쓴 글은 앱에 맡겨 뒀어요', { now: true });
  return w;
}

const CUR = require('./lib/cursor');
function watchCursor() {
  setInterval(() => {
    if (!pet) return;
    const r = CUR.step({ ignore: st.ignore, drag: !!st.drag, hidden: st.hidden, hover: !!st.hover, said: st.said === undefined ? null : st.said }, screen.getCursorScreenPoint(), { cx: st.cx, by: st.by, tw: TW, th: TH }, pet.getBounds());
    if (r.clearSaid) st.said = null;
    if (r.ignore !== null) setIgnore(r.ignore);
    if (r.resetHit) send('pet:hitReset');
  }, 120);
}
function dropHover(h) {
  if (h && (h.kind === 'img' || h.kind === 'no')) {
    st.hover = h.kind;
    clearTimeout(st.modeTimer); clearInterval(st.walkTimer); st.walkTimer = null;
    if (st.talking) { clearTimeout(st.talkTimer); st.talking = false; }
    setMode(h.kind === 'img' ? 'talk' : 'idle');
    send('pet:say', { text: !office ? OD.NO_OFFICE : h.kind === 'img' ? '여기 놓아 주세요!\n그림 ' + Math.max(1, h.n | 0) + '장 → 레퍼런스' : '그림만 받을 수 있어요\npng · jpg · gif · webp', ms: 60000 });
  } else if (st.hover) {
    st.hover = null; send('pet:hideBubble');
    if (st.queue.length) talkNext(); else setMode('idle', rand(1500, 3000));
  }
}
const NEW_TOPIC = '\u0000new';
function pickTopics() {
  const names = fence().refTopics();
  const out = [];
  const last = st.refTopic && names.includes(st.refTopic) ? st.refTopic : null;
  if (last) out.push({ name: last, meta: '지난번' });
  names.filter((n) => n !== last).forEach((n, i) => out.push({ name: n, sepBefore: !!last && i === 0 }));
  out.push({ name: '＋ 새 주제', key: NEW_TOPIC, isNew: true, sepBefore: out.length > 0 });
  return out;
}
function onDrop(paths) {
  dropHover(null);
  paths = (Array.isArray(paths) ? paths : []).filter((p) => typeof p === 'string' && p).slice(0, 50);
  let F;
  try { F = fence(); F.refBase(); } catch (e) { say('못 옮겼어요\n' + e.message + '. 원래 파일은 그대로예요', { now: true }); return; }
  const files = paths.filter((p) => !F.refSourceProblem(p));
  if (!files.length) { say('그림만 받을 수 있어요\npng · jpg · gif · webp', { now: true }); return; }
  openPicker(files, paths.length - files.length);
}
function thumbOf(file) {
  try { const im = nativeImage.createFromPath(file); if (im.isEmpty()) return null; const sz = im.getSize(); return im.resize(sz.width > sz.height ? { height: 96 } : { width: 96 }).toDataURL(); } catch (e) { return null; }
}
const PW = 300, PH = 436;
function openPicker(files, skipped) {
  if (pickWin && !pickWin.isDestroyed()) pickWin.close();
  let topics;
  try { topics = pickTopics(); } catch (e) { say('못 옮겼어요\n' + e.message + '. 원래 파일은 그대로예요', { now: true }); return; }
  const first = path.basename(files[0]).normalize('NFC');
  st.pick = { files, skipped, topics: topics.filter((p) => !p.isNew).map((p) => p.name) };
  const data = { projects: topics.map((p) => ({ name: p.name, meta: p.meta, sepBefore: p.sepBefore, isNew: !!p.isNew })), first, count: files.length, thumb: thumbOf(files[0]), close: sprites.ui_close || null, band: CHOICE.memoBand };
  const wa = displayAt(st.cx, st.by).workArea;
  let x = st.cx + TW / 2 + 16; if (x + PW > wa.x + wa.width) x = st.cx - TW / 2 - 16 - PW;
  x = Math.min(Math.max(x, wa.x), wa.x + wa.width - PW);
  const y = Math.min(Math.max(st.by - PH, wa.y), wa.y + wa.height - PH);
  pickWin = new BrowserWindow({
    x: Math.round(x), y: Math.round(y), width: PW, height: PH, show: false,
    frame: false, transparent: true, hasShadow: false, resizable: false, fullscreenable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, title: '어느 주제?',
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  pickWin.setAlwaysOnTop(true, 'floating');
  pickWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  lockDown(pickWin);
  pickWin.loadFile(path.join(ROOT, 'pick', 'index.html'));
  pickWin.webContents.once('did-finish-load', () => { pickWin.webContents.send('pick:init', data); pickWin.show(); pickWin.focus(); app.focus({ steal: true }); });
  pickWin.on('closed', () => { pickWin = null; st.pick = null; });
}
function pickTarget(d) {
  if (!st.pick || !d) return { why: '주제를 골라 주세요' };
  if (d.isNew) {
    try { const t = fence().topicName(String(d.name == null ? '' : d.name).slice(0, 200)); return { topic: t, isNew: !st.pick.topics.includes(t) }; } catch (e) { return { why: e.message }; }
  }
  return typeof d.topic === 'string' && st.pick.topics.includes(d.topic) ? { topic: d.topic, isNew: false } : { why: '주제를 골라 주세요' };
}
function planPick(d) {
  const tg = pickTarget(d);
  if (tg.why) return { ok: false, why: tg.why };
  try {
    const F = fence(), names = [];
    st.pick.files.forEach((f) => names.push(F.refPlan(f, tg.topic, names).name));
    return { ok: true, names, topic: tg.topic, isNew: tg.isNew };
  } catch (e) { return { ok: false, why: e.message }; }
}
function goPick(d) {
  const tg = pickTarget(d);
  if (tg.why) return { ok: false, why: tg.why };
  const F = fence(), files = st.pick.files, skipped = st.pick.skipped;
  const done = [], fail = [];
  files.forEach((f, i) => {
    let r;
    try { r = F.moveRef(f, tg.topic, tg.isNew); } catch (e) { r = { ok: false, why: e.message }; }
    (r.ok ? done : fail).push(r.ok ? r : { file: f, why: r.why });
  });
  if (done.length) { st.refTopic = tg.topic; savePos(); }
  if (pickWin && !pickWin.isDestroyed()) pickWin.close();
  const extra = (fail.length && done.length ? '\n' + fail.length + '장은 못 옮겼어요 (' + fail[0].why + ')' : '') + (skipped ? '\n그림 아닌 파일 ' + skipped + '개는 그대로예요' : '');
  const where = '레퍼런스/' + tg.topic, made = done.some((x) => x.made) ? ' (새 주제)' : '';
  if (!done.length) say('못 옮겼어요\n' + fail[0].why + '. 원래 파일은 그대로예요', { now: true });
  else if (done.length === 1) say('레퍼런스에 넣었어요!\n' + where + '/' + done[0].name + made + extra, { now: true, ms: 3000 });
  else say('그림 ' + done.length + '장을 레퍼런스에 넣었어요!\n' + where + made + ' · 원래 이름 그대로' + extra, { now: true, ms: 3000 });
  return { ok: !!done.length, done: done.map((x) => x.rel), fail };
}

const COLOR_SHOT = DEV ? process.env.TP_COLOR_SHOT || null : null;
const NO_CLIP = DEV && process.env.TP_NO_CLIPBOARD === '1';
function screenStatus() { return process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted'; }
async function shotsOf(displays) {
  if (COLOR_SHOT) {
    const im = nativeImage.createFromPath(COLOR_SHOT);
    return displays.map((d) => { const r = im.resize({ width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor), quality: 'good' }); const sz = r.getSize(); return { d, w: sz.width, h: sz.height, buf: r.toBitmap() }; });
  }
  const out = [];
  for (const d of displays) {
    const size = { width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) };
    const src = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
    const s = src.find((x) => String(x.display_id) === String(d.id)) || (displays.length === 1 && src.length === 1 ? src[0] : null);
    if (!s || s.thumbnail.isEmpty()) continue;
    const sz = s.thumbnail.getSize();
    out.push({ d, w: sz.width, h: sz.height, buf: s.thumbnail.toBitmap() });
  }
  return out;
}
async function startColor() {
  if (st.hidden || st.color) return;
  st.color = { busy: true, shots: [] };
  try {
    if (!COLOR_SHOT) {
      let step = CO.permStep(screenStatus());
      if (step === 'ask') {
        try { await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } }); } catch (e) {}
        step = CO.permStep(screenStatus());
        if (step !== 'capture') { st.color = null; say(CO.say.asked(), { now: true, ms: 10000 }); return; }
      }
      if (step === 'guide') { st.color = null; say(CO.say.guide(), { now: true, ms: 10000 }); return; }
    }
    closeMemo();
    if (st.talking) { send('pet:hideBubble'); finishTalk(); }
    await new Promise((r) => setTimeout(r, 120));
    const shots = await shotsOf(screen.getAllDisplays());
    if (!shots.length) { st.color = null; say(CO.say.fail('화면을 못 찍었어요. ' + CO.permLine()), { now: true, ms: 10000 }); return; }
    st.color = { busy: false, shots };
    shots.forEach((sh, i) => openColorWin(sh, i));
  } catch (e) { endColor(); say(CO.say.fail(e.message), { now: true }); }
}
function openColorWin(sh, i) {
  const b = sh.d.bounds;
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, show: false, backgroundColor: '#000000',
    frame: false, transparent: false, hasShadow: false, roundedCorners: false, resizable: false, movable: false, fullscreenable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, enableLargerThanScreen: true, title: '색 뽑기',
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  lockDown(w);
  w.__shot = i;
  colorWins.push(w);
  w.loadFile(path.join(ROOT, 'color', 'index.html'));
  w.webContents.once('did-finish-load', () => { if (!w.isDestroyed()) w.webContents.send('color:init', { w: sh.w, h: sh.h, bmp: sh.buf }); });
  w.on('closed', () => { colorWins = colorWins.filter((x) => x !== w); if (st.color && !st.color.ending) endColor(); });
}
function endColor() {
  if (!st.color) return;
  st.color.ending = true;
  colorWins.slice().forEach((w) => { if (!w.isDestroyed()) w.close(); });
  colorWins = []; st.color = null;
}
function pickColor(w, d) {
  if (!st.color || !d) return null;
  const sh = st.color.shots[w.__shot];
  if (!sh || !(d.w > 0 && d.h > 0)) return null;
  const p = CO.toImage(+d.x, +d.y, +d.w, +d.h, sh.w, sh.h);
  const hex = CO.hexAt(sh.buf, sh.w, sh.h, p.x, p.y, 'BGRA');
  endColor();
  if (!hex) { say(CO.say.fail('그 자리 색을 못 읽었어요'), { now: true }); return null; }
  st.lastColor = hex;
  if (!NO_CLIP) clipboard.writeText(hex);
  say(CO.say.picked(hex), { now: true, ms: 4000, rich: CO.bubble(hex) });
  return hex;
}


function lockDown(win) {
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

const fromPet = (e) => pet && e.sender === pet.webContents;
ipcMain.on('pet:hit', (e, hit) => { if (fromPet(e) && !st.drag) { st.said = !!hit; setIgnore(!hit); } });
ipcMain.on('pet:dragStart', (e) => { if (fromPet(e)) dragStart(); });
ipcMain.on('pet:dragEnd', (e) => { if (fromPet(e)) dragEnd(); });
ipcMain.on('pet:menu', (e) => { if (fromPet(e)) showMenu(); });
ipcMain.on('pet:bubbleDone', (e) => { if (fromPet(e) && st.talking) finishTalk(); });
ipcMain.on('viewer:close', (e) => { if (viewer && e.sender === viewer.webContents) viewer.close(); });
ipcMain.on('pet:dropHover', (e, h) => { if (fromPet(e)) dropHover(h); });
ipcMain.on('pet:drop', (e, paths) => { if (fromPet(e)) onDrop(paths); });
const fromPick = (e) => pickWin && !pickWin.isDestroyed() && e.sender === pickWin.webContents;
ipcMain.on('pick:close', (e) => { if (fromPick(e)) pickWin.close(); });
ipcMain.on('pick:plan', (e, d) => { if (fromPick(e) && d) pickWin.webContents.send('pick:planned', Object.assign({ seq: d.seq }, planPick(d))); });
ipcMain.on('pick:go', (e, d) => { if (fromPick(e) && d) { const r = goPick(d); if (!r.ok && pickWin && !pickWin.isDestroyed()) pickWin.webContents.send('pick:busy', false); } });
const colorOf = (e) => colorWins.find((w) => !w.isDestroyed() && e.sender === w.webContents) || null;
ipcMain.on('color:ready', (e) => { const w = colorOf(e); if (!w) return; w.show(); if (screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id === st.color?.shots[w.__shot]?.d.id) { w.focus(); app.focus({ steal: true }); } });
ipcMain.on('color:pick', (e, d) => { const w = colorOf(e); if (w) pickColor(w, d); });
ipcMain.on('color:cancel', (e) => { if (colorOf(e)) endColor(); });
const fromMemo = (e) => memoWin && !memoWin.isDestroyed() && e.sender === memoWin.webContents;
ipcMain.on('memo:close', (e) => { if (fromMemo(e)) closeMemo(); });
ipcMain.on('memo:draft', (e, d) => {
  if (!fromMemo(e) || !d || !MEMO_KINDS.includes(d.kind) || typeof d.text !== 'string') return;
  const a = d.appt && typeof d.appt === 'object' ? d.appt : st.memoDraft.appt, str = (v, n) => String(v == null ? '' : v).slice(0, n);
  st.memoDraft = { kind: d.kind, text: d.text.slice(0, 2000), appt: { date: str(a.date, 40), time: str(a.time, 30), ak: A.KINDS.includes(a.ak) ? a.ak : '미팅', text: str(a.text, 200) } };
});
ipcMain.on('memo:size', (e, d) => { if (!fromMemo(e) || !d || !(d.h > 40 && d.h < 400)) return; const b = memoBounds(d.h); memoWin.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); memoWin.webContents.send('memo:place', { tailX: b.tailX }); });
ipcMain.on('memo:save', (e, d) => {
  if (!fromMemo(e) || !d) return;
  const r = d.kind === 'appt' ? saveAppt(d.appt) : saveMemo(String(d.kind), d.text);
  if (!r.ok && (r.why === '빈 메모' || r.keepOpen) && memoWin && !memoWin.isDestroyed()) memoWin.webContents.send('memo:bad', { why: r.why });
});

function createPet() {
  const loaded = S.loadAll(); sprites = loaded.sprites; spriteInfo = loaded.info;
  const pm = process.env.TP_NO_PNG === '1' ? { man: null, why: 'TP_NO_PNG' } : S.loadPngManifest();
  let init;
  if (pm.man) {
    const layout = S.pngLayout(pm.man, STAND_PT);
    png = { man: pm.man, layout };
    TW = layout.W; TH = layout.H;
    spriteInfo.png = Object.keys(pm.man.actions).map((k) => k + ':' + pm.man.actions[k].source).join(', ');
    init = { png: { layout, images: S.pngData(pm.man), pixelated: PIXELATED }, sprites: { ui_tail: sprites.ui_tail, ui_clock: sprites.ui_clock } };
  } else {
    spriteInfo.png = '안 씀 (' + pm.why + ') -> 옛 픽셀 그림';
    const poses = ['tori_idle', 'tori_idle_left', 'tori_sit', 'tori_coffee', 'tori_walk_left', 'tori_wave'].filter((n) => sprites[n]);
    const gw = Math.max(16, ...poses.map((n) => sprites[n].frames[0][0].length));
    const gh = Math.max(20, ...poses.map((n) => sprites[n].frames[0].length)) + 1;
    TW = gw * SCALE; TH = gh * SCALE;
    init = { sprites, scale: SCALE, gw, gh };
  }
  WIN_W = Math.max(300, TW + 40); WIN_H = TH + BUBBLE_ROOM;

  const saved = loadPos(); loadPrefs();
  const prim = screen.getPrimaryDisplay().workArea;
  const start = saved ? clampPos(saved.cx, saved.by) : clampPos(prim.x + prim.width - 220, prim.y + prim.height);
  st.cx = start.cx; st.by = start.by; st.home = { cx: start.cx, by: start.by };

  pet = new BrowserWindow({
    x: Math.round(st.cx - WIN_W / 2), y: Math.round(st.by - WIN_H), width: WIN_W, height: WIN_H,
    frame: false, transparent: true, hasShadow: false, resizable: false, movable: false, fullscreenable: false,
    minimizable: false, maximizable: false, focusable: false, skipTaskbar: true, acceptFirstMouse: true,
    alwaysOnTop: true, show: false, title: EDITION.name, enableLargerThanScreen: true,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  pet.setAlwaysOnTop(true, 'floating');
  pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  pet.setIgnoreMouseEvents(true, { forward: true }); st.ignore = true;
  lockDown(pet);
  pet.loadFile(path.join(ROOT, 'pet', 'index.html'));
  pet.webContents.once('did-finish-load', () => {
    send('pet:init', Object.assign(init, { winW: WIN_W, winH: WIN_H }));
    send('pet:pose', { mode: st.mode, dir: st.dir });
    placeWindow();
    pet.showInactive();
    st.prevState = loadState();
    setTimeout(() => { say(B.greeting()); if (office) { checkRoadmaps(true); say(periodicLine()); } else say(OD.NO_OFFICE, { ms: 6000 }); }, 1200);
  });
  setInterval(() => { followOffice(); if (!st.hidden) checkRoadmaps(); }, CHECK_MS);
  setInterval(() => { if (!st.hidden && office) say(periodicLine()); }, PERIODIC_MS);
  st.remindFrom = Date.now();
  setInterval(remindTick, REMIND_MS);
  screen.on('display-removed', () => { const c = clampPos(st.cx, st.by); st.cx = c.cx; st.by = c.by; st.home = { cx: c.cx, by: c.by }; placeWindow(); });
  screen.on('display-metrics-changed', () => { const c = clampPos(st.cx, st.by); st.cx = c.cx; st.by = c.by; placeWindow(); });
  watchCursor();
  if (DEV) devTools();
}

function devTools() {
  const dir = process.env.TP_DEV_DIR ? path.resolve(process.env.TP_DEV_DIR) : path.join(ROOT, 'preview', 'dev');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.pid'), String(process.pid));
  const capture = () => Promise.all([
    pet && pet.webContents.capturePage().then((img) => fs.writeFileSync(path.join(dir, 'pet.png'), img.toPNG())),
    viewer && !viewer.isDestroyed() && viewer.webContents.capturePage().then((img) => fs.writeFileSync(path.join(dir, 'viewer.png'), img.toPNG())),
    memoWin && !memoWin.isDestroyed() && memoWin.webContents.capturePage().then((img) => fs.writeFileSync(path.join(dir, 'memo.png'), img.toPNG())),
    pickWin && !pickWin.isDestroyed() && pickWin.webContents.capturePage().then((img) => fs.writeFileSync(path.join(dir, 'pick.png'), img.toPNG())),
  ]);
  if (process.platform !== 'win32') process.on('SIGUSR2', capture);
  const cmdFile = path.join(dir, 'cmd.json');
  const out = (v) => fs.writeFileSync(path.join(dir, 'cmd.out'), JSON.stringify(v, null, 1));
  const stateOut = () => ({ cx: st.cx, by: st.by, home: st.home, mode: st.mode, dir: st.dir, ignore: st.ignore, talking: st.talking, queue: st.queue, hidden: st.hidden,
    edition: EDITION.key, office: OFFICE, officeInfo, bounds: pet.getBounds(), displays: screen.getAllDisplays().map((d) => ({ id: d.id, workArea: d.workArea, bounds: d.bounds })), menuOpen: !!st.menu, viewer: viewer && !viewer.isDestroyed() ? viewer.getBounds() : null, sprites: spriteInfo, posFile: POS_FILE() });
  fs.watchFile(cmdFile, { interval: 300 }, async () => {
    let c; try { c = JSON.parse(fs.readFileSync(cmdFile, 'utf8')); } catch (e) { return; }
    try {
      if (c.do === 'state') out(stateOut());
      else if (c.do === 'say') { say(c.text, { now: true }); out('ok'); }
      else if (c.do === 'viewer') { openViewer(c.kind); out('ok'); }
      else if (c.do === 'hide') { hideForAWhile(); out(stateOut()); }
      else if (c.do === 'reopen') { const was = reopened(); setTimeout(() => out({ wasHidden: was, hidden: st.hidden, visible: pet.isVisible(), timer: !!st.hideTimer, queue: st.queue, talking: st.talking }), 300); }
      else if (c.do === 'closeMenu') { if (st.menu) st.menu.closePopup(pet); out('ok'); }
      else if (c.do === 'closeViewer') { if (viewer) viewer.close(); out('ok'); }
      else if (c.do === 'mode') { if (c.mode === 'walk') walk(); else setMode(c.mode); out('ok'); }
      else if (c.do === 'menu') { showMenu(); setTimeout(() => { const open = !!st.menu; if (st.menu) st.menu.closePopup(pet); out({ menuWasOpen: open }); }, c.ms || 1200); }
      else if (c.do === 'mouse') {
        (c.events || []).forEach((ev) => pet.webContents.sendInputEvent(Object.assign({ clickCount: 1 }, ev)));
        setTimeout(() => out(stateOut()), c.wait || 300);
      }
      else if (c.do === 'capture') { await capture(); out('ok'); }
      else if (c.do === 'dropAt') {
        st.drag = { moved: true }; st.cx = c.x; st.by = c.y; clearInterval(st.dragTimer);
        const realCursor = screen.getCursorScreenPoint; screen.getCursorScreenPoint = () => ({ x: c.x, y: c.y });
        try { dragEnd(); } finally { screen.getCursorScreenPoint = realCursor; }
        out(stateOut());
      } else if (c.do === 'js') { const w = c.target === 'viewer' ? viewer : c.target === 'memo' ? memoWin : c.target === 'pick' ? pickWin : pet; out(await w.webContents.executeJavaScript(c.code)); }
      else if (c.do === 'memo') { openMemo(); out('ok'); }
      else if (c.do === 'drop') { onDrop(c.paths); out('ok'); }
      else if (c.do === 'hover') { dropHover(c.kind ? { kind: c.kind, n: c.n || 1 } : null); await pet.webContents.executeJavaScript('__petPad(' + JSON.stringify(c.kind || null) + ')'); out('ok'); }
      else if (c.do === 'tap') { tap(); out('ok'); }
      else if (c.do === 'color') { await startColor(); setTimeout(() => out({ open: colorWins.length, status: screenStatus(), shots: st.color ? st.color.shots.map((s) => ({ id: s.d.id, w: s.w, h: s.h, bounds: s.d.bounds })) : null, queue: st.queue }), c.wait || 800); }
      else if (c.do === 'screenStatus') { out(screenStatus()); }
      else if (c.do === 'colorJs') { const w = colorWins[c.i || 0]; out(w ? await w.webContents.executeJavaScript(c.code) : null); }
      else if (c.do === 'colorMouse') { const w = colorWins[c.i || 0]; (c.events || []).forEach((ev) => w.webContents.sendInputEvent(Object.assign({ clickCount: 1 }, ev))); setTimeout(() => out({ open: colorWins.length, lastColor: st.lastColor || null, queue: st.queue, talking: st.talking }), c.wait || 400); }
      else if (c.do === 'colorCapture') { const w = colorWins[c.i || 0]; const img = await w.webContents.capturePage(); fs.writeFileSync(path.join(dir, 'color.png'), img.toPNG()); out('ok'); }
      else if (c.do === 'memoSave') { out(c.kind === 'appt' ? saveAppt(c.appt) : saveMemo(c.kind, c.text)); }
      else if (c.do === 'colorKey') { const w = colorWins[c.i || 0]; w.webContents.sendInputEvent({ type: 'keyDown', keyCode: c.key }); setTimeout(() => out({ open: colorWins.length, color: !!st.color }), 400); }
      else if (c.do === 'memoKey') { memoWin.webContents.sendInputEvent({ type: 'keyDown', keyCode: c.key }); memoWin.webContents.sendInputEvent({ type: 'keyUp', keyCode: c.key }); setTimeout(() => out({ memoOpen: !!(memoWin && !memoWin.isDestroyed()), state: stateOut() }), 400); }
      else if (c.do === 'memoBounds') { out(memoWin && !memoWin.isDestroyed() ? memoWin.getBounds() : null); }
      else if (c.do === 'check') { const ch = checkRoadmaps(true); out({ changes: ch, said: ch && ch.length ? R.announceChanges(ch) : null }); }
      else if (c.do === 'line') { out(periodicLine()); }
      else if (c.do === 'remindAt') { out(remindWindow(new Date(c.from).getTime(), new Date(c.to).getTime(), { dry: !!c.dry })); }
      else if (c.do === 'appts') { const it = apptItems(); out({ n: it.length, items: it, next: RM.upcoming(it, Date.now()).slice(0, 6).map((x) => Object.assign(x, { atText: new Date(x.at).toString() })), sentFile: SENT_FILE(), houseFile: FEAT.house ? RM.houseFile(HOUSE_DIR) : null }); }
      else out('모르는 명령');
    } catch (e) { out('ERR ' + e.message); }
  });
}

useOffice(resolveOffice());
app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createPet();
});
app.on('second-instance', () => reopened());
app.on('window-all-closed', (e) => {  });
