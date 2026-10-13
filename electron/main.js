'use strict';
const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DEV = process.env.PO_DEV === '1';

const OF = require('./office');
const PUBLIC = OF.isPublic(process.env, ROOT);
const ED = OF.edition(PUBLIC);
app.setName(ED.name);
if (PUBLIC) app.setPath('userData', OF.userDataPath(true, app.getPath('appData')));
if (process.env.PO_USER_DATA && path.isAbsolute(process.env.PO_USER_DATA)) app.setPath('userData', process.env.PO_USER_DATA);
if (process.platform === 'win32' && app.setAppUserModelId) app.setAppUserModelId(ED.appId);
const HOME = app.getPath('home');
const officeOpts = () => ({ home: HOME, appRoot: ROOT });
const start0 = OF.resolveStart({ env: process.env, pub: PUBLIC, home: HOME, userData: app.getPath('userData'), appRoot: ROOT });
let OFFICE = start0.path;
let OFFICE_FROM = start0.from;

const DOT_OK = PUBLIC ? [] : [['.claude', 'agents'], ['.claude', '보관'], ['.claude', '해고']];
const SECRET = /^\.env|\.(pem|key)$|^id_rsa/i;
const WF = require('./winframe');
const FENCE = require('./fence');
function resolveSafe(rel) {
  if (!OFFICE) throw new Error('사무실 폴더를 아직 고르지 않았어요.');
  if (typeof rel !== 'string') throw new Error('경로 오류');
  if (FENCE.relBad(rel)) throw new Error('허용 안 됨: ' + rel);
  const segs = rel.split('/').filter((s) => s !== '');
  const dotOk = DOT_OK.some((p) => p.every((x, i) => segs[i] === x));
  if (segs.some((s, i) => s === '..' || s === '.git' || SECRET.test(s) || s === '_to_delete' || (s.startsWith('.') && !(dotOk && i === 0)))) throw new Error('허용 안 됨: ' + rel);
  if (segs[0] === '.claude' && !dotOk && segs.length > 1) throw new Error('허용 안 됨: ' + rel);
  const full = path.join(OFFICE, ...segs);
  if (full !== OFFICE && !full.startsWith(OFFICE + path.sep)) throw new Error('허용 안 됨: ' + rel);
  return full;
}
ipcMain.handle('po:kind', (e, rel) => {
  try { const st = fs.statSync(resolveSafe(rel)); return st.isDirectory() ? 'directory' : st.isFile() ? 'file' : null; } catch (err) { return null; }
});
ipcMain.handle('po:read', (e, rel) => {
  const full = resolveSafe(rel);
  return { text: fs.readFileSync(full, 'utf8'), lastModified: fs.statSync(full).mtimeMs };
});
const AS = require('./assets');
const picked = new Set();
ipcMain.handle('po:read-bytes', (e, rel, max) => {
  resolveSafe(rel);
  if (typeof rel === 'string' && picked.has(rel.normalize('NFC')) && !AS.assetAllowed(rel)) return AS.readPicked(OFFICE, rel, max);
  return AS.readAsset(OFFICE, rel, max);
});
ipcMain.handle('po:list', (e, rel) => fs.readdirSync(resolveSafe(rel), { withFileTypes: true })
  .filter((d) => !d.name.startsWith('.') || (!PUBLIC && ((rel === '' && d.name === '.claude') || (rel === '.claude' && ['agents', '보관', '해고'].includes(d.name)))))
  .map((d) => ({ name: d.name, kind: d.isDirectory() ? 'directory' : 'file' })));

const NEW_ONLY = [/^40_자산\/픽셀\//];
ipcMain.handle('po:write', (e, rel, text, opts) => {
  const full = resolveSafe(rel);
  const newOnly = !!(opts && opts.newOnly) || NEW_ONLY.some((re) => re.test(String(rel).normalize('NFC')));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, String(text), newOnly ? { flag: 'wx' } : undefined);
  return true;
});
ipcMain.handle('po:append', (e, rel, text) => {
  if (NEW_ONLY.some((re) => re.test(String(rel).normalize('NFC')))) throw new Error('새 파일만 쓰는 곳이에요: ' + rel);
  const full = resolveSafe(rel);
  fs.appendFileSync(full, String(text));
  return true;
});
ipcMain.handle('po:move', (e, from, to) => {
  const a = resolveSafe(from), b = resolveSafe(to);
  if (!fs.existsSync(a)) throw new Error('없음: ' + from);
  if (fs.existsSync(b)) throw new Error('이미 있음: ' + to);
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.renameSync(a, b);
  return true;
});
ipcMain.handle('po:trash', (e, rel) => {
  const full = resolveSafe(rel);
  const n = new Date(), p2 = (x) => String(x).padStart(2, '0');
  const d = n.getFullYear() + p2(n.getMonth() + 1) + p2(n.getDate()) + '_' + p2(n.getHours()) + p2(n.getMinutes()) + p2(n.getSeconds());
  const dest = path.join(OFFICE, '_to_delete', d, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(full, dest);
  return true;
});

const TL = require('./tools');
let mainWin = null;
const office = () => { if (!OFFICE) throw new Error('사무실 폴더를 아직 고르지 않았어요.'); return OFFICE; };
const runner = TL.createRunner({ office, send: (ev) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('po:tool-event', ev); } });
const fenceErr = (e) => ({ ok: false, error: String(e && e.message || e), missing: !!(e && e.missing) });
const jsonRunner = TL.createJsonRunner({ office });
if (!PUBLIC) {
ipcMain.handle('po:tool-list', () => TL.listTools(office()));
ipcMain.handle('po:tool-start', (e, id, params) => { try { return Object.assign({ ok: true }, runner.start(id, params)); } catch (err) { return fenceErr(err); } });
ipcMain.handle('po:tool-stop', (e, id) => runner.stop(String(id)));
ipcMain.handle('po:tool-server', () => TL.portOpen(5180));
ipcMain.handle('po:tool-office', () => { try { return fs.realpathSync(OFFICE); } catch (e) { return OFFICE; } });
ipcMain.handle('po:tool-open-portfolio', () => shell.openExternal('http://127.0.0.1:5180/#/admin').then(() => true));
ipcMain.handle('po:tool-open', async (e, rel) => {
  try {
    const full = TL.openablePath(OFFICE, rel);
    if (/\.html$/i.test(full)) {
      const c = TL.chromeOpenCommand(full);
      const ok = c && await new Promise((res) => require('child_process').execFile(c.file, c.args, { windowsHide: true }, (err) => res(!err)));
      if (ok) return { ok: true };
    }
    const err = await shell.openPath(full);
    return err ? { ok: false, error: err } : { ok: true };
  } catch (err) { return fenceErr(err); }
});
ipcMain.handle('po:tool-reveal', (e, rel) => { try { const { full } = TL.safeRel(OFFICE, rel); shell.showItemInFolder(full); return { ok: true }; } catch (err) { return fenceErr(err); } });
ipcMain.handle('po:tool-copy', (e, text) => { clipboard.writeText(String(text == null ? '' : text).slice(0, 200000)); return true; });
ipcMain.handle('po:tool-pick-md', async () => {
  const r = await dialog.showOpenDialog(mainWin, { defaultPath: OFFICE, properties: ['openFile'], filters: [{ name: '마크다운', extensions: ['md'] }] });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  const rel = TL.relInOffice(OFFICE, r.filePaths[0]);
  if (!rel || !/\.md$/i.test(rel)) return { ok: false, error: '오피스 폴더 안 파일만 고를 수 있어요.' };
  try { TL.safeRel(OFFICE, rel); } catch (err) { return { ok: false, error: '오피스 폴더 안 파일만 고를 수 있어요.' }; }
  return { ok: true, rel };
});
ipcMain.handle('po:tool-pick-dir', async (e, startRel) => {
  let start = OFFICE;
  try { if (startRel) { const { full } = TL.safeRel(OFFICE, String(startRel)); if (fs.statSync(full).isDirectory()) start = full; } } catch (err) { start = OFFICE; }
  const r = await dialog.showOpenDialog(mainWin, { defaultPath: start, properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  const rel = TL.relInOffice(OFFICE, r.filePaths[0]);
  if (!rel) return { ok: false, error: '오피스 폴더 안 폴더만 고를 수 있어요.' };
  try { TL.safeRel(OFFICE, rel); } catch (err) { return { ok: false, error: '오피스 폴더 안 폴더만 고를 수 있어요.' }; }
  return { ok: true, rel };
});
ipcMain.handle('po:tool-run-json', (e, id, params) => jsonRunner.run(String(id), params));
function acceptImage(abs) {
  const rel = TL.imageRelInOffice(OFFICE, abs);
  if (!rel) return { ok: false, error: '오피스 폴더 안 png·jpg·webp 그림만 받아요.' };
  picked.add(rel.normalize('NFC'));
  return { ok: true, rel };
}
ipcMain.handle('po:pick-image', async () => {
  if (!OFFICE) return { ok: false, error: '사무실 폴더를 아직 고르지 않았어요.' };
  const start = fs.existsSync(path.join(OFFICE, '40_자산')) ? path.join(OFFICE, '40_자산') : OFFICE;
  const r = await dialog.showOpenDialog(mainWin, { defaultPath: start, properties: ['openFile'], filters: [{ name: '그림', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  return acceptImage(r.filePaths[0]);
});
ipcMain.handle('po:accept-image', (e, abs) => acceptImage(String(abs || '')));
}
app.on('before-quit', () => { runner.stopAll(); jsonRunner.stopAll(); });

ipcMain.handle('po:office-get', () => ({ path: OFFICE, from: OFFICE_FROM, public: PUBLIC }));
function switchOffice(dir) {
  const c = OF.checkOfficeDir(dir, officeOpts());
  if (!c.ok) return c;
  if (PUBLIC && !OF.hasMarker(c.path)) return { ok: false, error: '이 폴더에는 사무실이 없어요. 안에 CLAUDE.md 파일과 10_프로젝트 폴더가 있는 폴더를 골라 주세요.', noMarker: true, name: path.basename(c.path) };
  runner.stopAll(); jsonRunner.stopAll(); picked.clear();
  OF.save(app.getPath('userData'), c.path);
  OFFICE = c.path; OFFICE_FROM = 'saved';
  if (mainWin && !mainWin.isDestroyed()) setTimeout(() => { if (!mainWin.isDestroyed()) mainWin.webContents.reload(); }, 50);
  return { ok: true, path: c.path };
}
ipcMain.handle('po:office-pick', async () => {
  const r = await dialog.showOpenDialog(mainWin, { defaultPath: OFFICE || path.join(HOME, 'Desktop'), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  try { return switchOffice(r.filePaths[0]); } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

const SK = require('./skeleton');
let PARENT = null;
const parentNow = () => PARENT || app.getPath('documents');
if (PUBLIC) {
ipcMain.handle('po:office-pick-parent', async (e, opts) => {
  if (!(opts && opts.peek)) {
    const r = await dialog.showOpenDialog(mainWin, { defaultPath: parentNow(), properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    const c = SK.checkParent(r.filePaths[0], officeOpts());
    if (!c.ok) return c;
    PARENT = c.path;
  }
  const c = SK.checkParent(parentNow(), officeOpts());
  if (!c.ok) return c;
  const folder = SK.nextName(c.path);
  return folder ? { ok: true, parent: c.path, folder } : { ok: false, error: '"' + SK.FOLDER + '" 이름이 너무 많아요. 다른 곳을 골라 주세요.' };
});
ipcMain.handle('po:make-office', (e, input) => {
  try {
    const r = SK.make(parentNow(), input, officeOpts());
    if (!r.ok) return r;
    const s = switchOffice(r.path);
    return s.ok ? r : Object.assign({}, s, { path: r.path });
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});
}

function createWindow() {
  const win = new BrowserWindow(WF.windowOptions(process.platform, path.join(__dirname, 'preload.js')));
  WF.afterCreate(win, process.platform);
  mainWin = win;
  win.loadFile(path.join(ROOT, 'index.html'));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (DEV) {
    if (process.platform !== 'win32') process.on('SIGUSR2', () => win.webContents.capturePage().then((img) => {
      fs.mkdirSync(path.join(ROOT, 'preview', 'dev'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'preview', 'dev', 'app.png'), img.toPNG());
    }));
    fs.mkdirSync(path.join(ROOT, 'preview', 'dev'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'preview', 'dev', 'app.pid'), String(process.pid));
    const cmd = path.join(ROOT, 'preview', 'dev', 'cmd.js');
    fs.watchFile(cmd, { interval: 300 }, () => {
      let code = ''; try { code = fs.readFileSync(cmd, 'utf8'); } catch (e) { return; }
      win.webContents.executeJavaScript(code).then((r) => JSON.stringify(r), (e) => 'ERR ' + e.message)
        .then((out) => fs.writeFileSync(path.join(ROOT, 'preview', 'dev', 'cmd.out'), String(out)));
    });
    let t = null;
    ['js', 'css', 'assets', 'index.html'].forEach((p) => {
      try { fs.watch(path.join(ROOT, p), { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => win.webContents.reload(), 150); }); } catch (e) {}
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
