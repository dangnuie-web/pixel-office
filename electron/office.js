'use strict';
const fs = require('fs');
const path = require('path');
const FENCE = require('./fence');

const EDITIONS = {
  dangnee: { name: 'Pixel Office', appId: 'com.dangnee.pixeloffice', userDataDir: null },
  public: { name: 'Pixel Office', appId: 'com.dangnee.pixeloffice.public', userDataDir: 'Pixel Office Public' },
};
const STORE = 'office.json';

function isPublic(env, root) {
  if (env && env.PO_PUBLIC === '1') return true;
  try {
    const first = fs.readFileSync(path.join(root, 'js', 'edition.js'), 'utf8').split('\n')[0];
    return /^\s*window\.PO_PUBLIC\s*=\s*true\s*;?\s*$/.test(first);
  } catch (e) { return false; }
}
function edition(pub) { return pub ? EDITIONS.public : EDITIONS.dangnee; }
function userDataPath(pub, appData) {
  const d = edition(pub).userDataDir;
  return d ? path.join(appData, d) : null;
}
function defaultOffice(pub, home) { return pub ? null : null; }

function checkOfficeDir(dir, { home, appRoot, win } = {}) {
  const bad = (error) => ({ ok: false, error });
  if (typeof dir !== 'string' || !dir || !path.isAbsolute(dir)) return bad('폴더 경로가 올바르지 않아요.');
  const abs = path.resolve(dir);
  let st, real;
  try { st = fs.statSync(abs); real = fs.realpathSync(abs); } catch (e) { return bad('폴더를 찾지 못했어요.'); }
  if (!st.isDirectory()) return bad('폴더가 아니에요.');
  for (const p of [abs, real]) {
    const err = pathProblem(p, { home, appRoot, win });
    if (err) return bad(err);
  }
  return { ok: true, path: abs };
}
const under = (a, b) => a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
const realOr = (p) => { try { return fs.realpathSync(p); } catch (e) { return p; } };
function pathProblem(p, { home, appRoot, win } = {}) {
  if (path.parse(p).root === p) return '디스크 맨 위 폴더는 쓸 수 없어요.';
  const segs = p.slice(path.parse(p).root.length).split(path.sep).filter(Boolean);
  if (segs.some((s) => s.startsWith('.') || FENCE.segBad(s, win))) return '숨김 폴더나 쓸 수 없는 이름이 든 경로예요.';
  if (home) {
    const h = path.resolve(home), hr = realOr(h);
    if (under(h, p) || under(hr, p)) return '홈 폴더 전체는 쓸 수 없어요. 그 안에 사무실 폴더를 만들어 골라 주세요.';
  }
  if (appRoot) {
    const a = path.resolve(appRoot), ar = realOr(a);
    if (under(p, a) || under(p, ar) || under(a, p) || under(ar, p)) return '앱 폴더 안이나 그 위는 쓸 수 없어요.';
  }
  return null;
}
function hasMarker(dir) {
  try { return fs.statSync(path.join(dir, 'CLAUDE.md')).isFile() && fs.statSync(path.join(dir, '10_프로젝트')).isDirectory(); } catch (e) { return false; }
}

function loadSaved(userData, opts) {
  if (!userData) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(userData, STORE), 'utf8')); } catch (e) { return null; }
  if (!j || typeof j.office !== 'string') return null;
  const c = checkOfficeDir(j.office, opts);
  return c.ok ? c.path : null;
}
function save(userData, dir) {
  fs.mkdirSync(userData, { recursive: true });
  const f = path.join(userData, STORE), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ office: dir, savedAt: new Date().toISOString() }, null, 2) + '\n');
  fs.renameSync(tmp, f);
  return f;
}

function resolveStart({ env, pub, home, userData, appRoot }) {
  if (env && env.PO_OFFICE) return { path: env.PO_OFFICE, from: 'env' };
  const saved = loadSaved(userData, { home, appRoot });
  if (saved) return { path: saved, from: 'saved' };
  const d = defaultOffice(pub, home);
  return d ? { path: d, from: 'default' } : { path: null, from: null };
}

module.exports = { EDITIONS, STORE, isPublic, edition, userDataPath, defaultOffice, checkOfficeDir, pathProblem, hasMarker, loadSaved, save, resolveStart };
