'use strict';
const path = require('path');
const fs = require('fs');
const B = require('./brief');
const R = require('./roadmaps');

const PROJECTS_REL = '10_프로젝트/01_진행';
const ROSTER_REL = 'CLAUDE.md';
const SECRET = /^\.env|\.(pem|key)$|^id_rsa/i;

function makeOffice(officeRoot) {
  const OFFICE = path.resolve(officeRoot);
  function resolveSafe(rel) {
    if (typeof rel !== 'string') throw new Error('경로 오류');
    const segs = rel.split('/').filter((s) => s !== '');
    if (segs.some((s) => s === '..' || s === '.git' || SECRET.test(s) || s === '_to_delete' || s.startsWith('.'))) throw new Error('허용 안 됨: ' + rel);
    const full = path.join(OFFICE, ...segs);
    if (full !== OFFICE && !full.startsWith(OFFICE + path.sep)) throw new Error('허용 안 됨: ' + rel);
    return full;
  }
  function read(rel) { return fs.readFileSync(resolveSafe(rel), 'utf8'); }
  function mtime(rel) { try { return fs.statSync(resolveSafe(rel)).mtimeMs; } catch (e) { return null; } }
  function list(rel) { return fs.readdirSync(resolveSafe(rel)).filter((n) => !n.startsWith('.')); }

  function projectNames() {
    try {
      return list(PROJECTS_REL).filter((n) => { try { return fs.statSync(resolveSafe(PROJECTS_REL + '/' + n)).isDirectory(); } catch (e) { return false; } }).sort();
    } catch (e) { return []; }
  }
  function roadmapRels() { return projectNames().map((p) => ({ project: p, rel: PROJECTS_REL + '/' + p + '/로드맵.md' })).filter((r) => mtime(r.rel) != null); }
  function fingerprint() { return roadmapRels().map((r) => r.rel + '@' + mtime(r.rel)).join('|'); }
  let namesCache = null, namesKey = null;
  function names() {
    const k = String(mtime(ROSTER_REL));
    if (namesCache && k === namesKey) return namesCache;
    namesKey = k;
    try { namesCache = B.core.parseRoster(read(ROSTER_REL)).staff.map((s) => s.name); } catch (e) { namesCache = []; }
    return namesCache;
  }

  function snapshot(now) {
    const base = B.core.nowMin(now);
    const baseYmd = B.core.fmtMin(base).slice(0, 10);
    const maps = roadmapRels().map((r) => { try { return Object.assign(r, { text: read(r.rel) }); } catch (e) { return Object.assign(r, { text: null, error: e.message }); } });
    const col = R.collect(maps, names(), baseYmd);
    return { office: OFFICE, base, baseYmd, at: B.core.fmtMin(base), col, projectsError: maps.length ? null : '진행 로드맵을 못 찾았어요 (' + PROJECTS_REL + ')' };
  }
  return { OFFICE, resolveSafe, read, mtime, list, projectNames, roadmapRels, fingerprint, names, snapshot };
}

module.exports = { makeOffice, PROJECTS_REL };
