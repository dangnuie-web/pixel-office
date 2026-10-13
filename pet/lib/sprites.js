'use strict';
const path = require('path');
const fs = require('fs');

const HERE = fs.realpathSync(__dirname);
const ROOT = path.resolve(HERE, '..');
const DIRS = [path.join(ROOT, 'assets'), path.join(HERE, 'po', 'assets')];

const WANT = ['tori_idle', 'tori_idle_left', 'tori_sit', 'tori_coffee', 'tori_walk_left', 'tori_wave', 'tori_portrait', 'ui_close', 'ui_tail', 'ui_clock', 'ui_board_clip', 'ui_kraft'];

function pick(name, dirs) {
  const re = new RegExp('^(\\d{8})_[a-z0-9-]+_' + name + '_v(\\d+)\\.json$');
  let best = null;
  (dirs || DIRS).forEach((d, di) => {
    let names = []; try { names = fs.readdirSync(d); } catch (e) { return; }
    names.forEach((n) => {
      const m = re.exec(n); if (!m) return;
      const c = { file: path.join(d, n), ver: +m[2], date: m[1], di };
      if (!best || c.di < best.di || (c.di === best.di && (c.ver > best.ver || (c.ver === best.ver && c.date > best.date)))) best = c;
    });
  });
  return best;
}
function check(a) {
  if (!a || !Array.isArray(a.frames) || !a.frames.length || typeof a.palette !== 'object') return '형식 아님';
  const h = a.frames[0].length, w = (a.frames[0][0] || '').length;
  if (!h || !w) return '빈 그림';
  if (a.frames.some((f) => !Array.isArray(f) || f.length !== h || f.some((row) => typeof row !== 'string' || row.length !== w))) return '장마다 크기 다름';
  return null;
}
function loadAll(dirs) {
  const out = {}; const info = {};
  WANT.forEach((name) => {
    const p = pick(name, dirs);
    if (!p) { info[name] = '없음'; return; }
    try {
      const a = JSON.parse(fs.readFileSync(p.file, 'utf8'));
      const bad = check(a);
      if (bad) { info[name] = path.basename(p.file) + ' (' + bad + ', 안 씀)'; return; }
      out[name] = { palette: a.palette, frames: a.frames };
      info[name] = path.relative(path.resolve(ROOT, '..'), p.file);
    } catch (e) { info[name] = path.basename(p.file) + ' (못 읽음: ' + e.message + ')'; }
  });
  return { sprites: out, info };
}

const PNG_DIR = path.join(ROOT, 'assets', 'png');
const PNG_NEED = ['stand', 'walk', 'wave', 'lift'];
function loadPngManifest(dir) {
  dir = dir || PNG_DIR;
  let man;
  try { man = JSON.parse(fs.readFileSync(path.join(dir, 'sprites.json'), 'utf8')); } catch (e) { return { man: null, why: 'sprites.json 없음' }; }
  for (const k of PNG_NEED) {
    const a = man.actions && man.actions[k];
    if (!a || !Array.isArray(a.frames) || !a.frames.length) return { man: null, why: k + ' 없음' };
    for (const f of a.frames) if (!/^[a-z]+_\d+\.png$/.test(f) || !fs.existsSync(path.join(dir, f))) return { man: null, why: f + ' 없음' };
  }
  return { man, why: null };
}
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function pngLayout(man, standPt) {
  const st = man.actions.stand;
  const k = standPt / median(st.heights);
  const A = man.actions;
  const place = {};
  let W = 0, H = 0;
  for (const name of Object.keys(A)) {
    const a = A[name]; const s = k * (a.norm || 1);
    W = Math.max(W, a.contentW * s);
    if (a.anchor === 'foot') H = Math.max(H, (a.line - a.top) * s);
  }
  W = Math.ceil(W) + 2; H = Math.ceil(H) + 1;
  const headH = (st.line - st.top) * k;
  for (const name of Object.keys(A)) {
    const a = A[name]; const s = k * (a.norm || 1);
    const x = W / 2 - a.cx * s;
    let y;
    if (a.anchor === 'foot') y = H - a.line * s;
    else {
      y = (H - headH) - a.line * s;
      const bottom = y + a.bottom * s;
      if (bottom > H) y -= bottom - H;
    }
    place[name] = { s, x, y, w: a.w * s, h: a.h * s, facing: a.facing, n: a.frames.length };
  }
  return { k, W, H, headH, place };
}
function pngData(man, dir) {
  dir = dir || PNG_DIR;
  const out = {};
  for (const name of Object.keys(man.actions)) out[name] = man.actions[name].frames.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
  return out;
}
function portraitPng() {
  const d = path.join(ROOT, 'assets');
  let best = null;
  try {
    fs.readdirSync(d).forEach((n) => {
      const m = /^(\d{8})_[a-z0-9-]+_초상_tori_v(\d+)\.png$/.exec(n.normalize('NFC'));
      if (m && (!best || +m[2] > best.v)) best = { v: +m[2], file: path.join(d, n) };
    });
  } catch (e) { return null; }
  return best ? 'data:image/png;base64,' + fs.readFileSync(best.file).toString('base64') : null;
}

module.exports = { pick, check, loadAll, DIRS, WANT, loadPngManifest, pngLayout, pngData, portraitPng, PNG_DIR, median };
