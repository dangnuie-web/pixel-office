'use strict';
const fs = require('fs');
const path = require('path');
const SK = require('./skeleton');
const SKP = require('./skills_public');
const AT = require('./agent_texts');

const STAFF = [
  { id: 'squirrel', animal: '다람쥐', job: '비서' }, { id: 'owl', animal: '부엉이', job: '작가' },
  { id: 'chameleon', animal: '카멜레온', job: '디자이너' }, { id: 'penguin', animal: '펭귄', job: '개발자' },
  { id: 'duck', animal: '오리', job: '정리 담당' }, { id: 'hedgehog', animal: '고슴도치', job: '검토' },
  { id: 'beaver', animal: '비버', job: '기획' },
];
const GUIDE = SK.GUIDE_ID;
const AGENTS = '.claude/agents', FIRED = '.claude/해고';
const ROSTER_RE = /^- (.+?)(?: \(([a-z-]+)\))?: (.+?)\((.+?)\)\./;
const ID_RE = /^[a-z][a-z-]{0,29}$/;

const err = (error) => ({ ok: false, error });
function inside(office, p) {
  const ro = fs.realpathSync(office);
  const rp = fs.realpathSync(p);
  return rp === ro || rp.startsWith(ro + path.sep);
}
function dirIn(office, rel) {
  const d = path.join(office, ...rel.split('/'));
  fs.mkdirSync(d, { recursive: true });
  if (!inside(office, d)) throw new Error('사무실 밖을 가리키는 폴더예요: ' + rel);
  return d;
}
function claudePath(office) {
  const p = path.join(office, 'CLAUDE.md');
  const st = fs.lstatSync(p);
  if (!st.isFile()) throw new Error('CLAUDE.md 가 파일이 아니에요.');
  return p;
}
const exists = (p) => { try { fs.lstatSync(p); return true; } catch (e) { return false; } };

function readRoster(text) {
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const lines = String(text).split(/\r?\n/);
  const h = lines.findIndex((l) => /^## 직원 명부/.test(l));
  if (h < 0) return { lines, eol, sec: null, staff: [] };
  let e = h + 1;
  while (e < lines.length && !/^## /.test(lines[e])) e++;
  const staff = [];
  for (let i = h + 1; i < e; i++) {
    const m = ROSTER_RE.exec(lines[i]);
    if (m) staff.push({ name: m[1].trim(), id: m[2] || '', role: m[3].trim(), animal: m[4].trim(), line: i });
  }
  return { lines, eol, sec: [h, e], staff };
}
function bossOf(lines) {
  const i = lines.findIndex((l) => /^##\s+대표\s*$/.test(l));
  if (i >= 0) for (let k = i + 1; k < lines.length && !/^##\s/.test(lines[k]); k++) { const m = /^\s*[-*]\s+(.+?)\s*$/.exec(lines[k]); if (m) return m[1]; }
  return SK.DEFAULT_OWNER + '님';
}
const rosterLine = (s) => '- ' + s.name + ' (' + s.id + '): ' + s.role + '(' + s.animal + ').';
const plain = (s) => ({ name: s.name, id: s.id, role: s.role, animal: s.animal });
function staffOf(id, name) {
  const p = STAFF.find((x) => x.id === id);
  return p ? { name: name || p.job, id, role: p.job, animal: p.animal } : null;
}

function newHowTo(lines, eol, oldStaff, newStaff, boss) {
  const h = lines.findIndex((l) => /^## 일하는 법\s*$/.test(l));
  if (h < 0) return null;
  let e = h + 1;
  while (e < lines.length && !/^## /.test(lines[e])) e++;
  const cur = lines.slice(h, e).join('\n') + '\n';
  if (cur !== SK.howTo(oldStaff, boss)) return null;
  const next = SK.howTo(newStaff, boss).replace(/\n\n$/, '').split('\n');
  return { h, e, next: next.concat(['']) };
}
const pristine = (text, s, boss) => String(text).replace(/\r\n/g, '\n') === SK.agentFile(s, boss);
function nameInAgent(text) { const m = /^description:\s*"([^"(]+)\(/m.exec(String(text)); return m ? m[1] : null; }

function writeRoster(office, r, staffAfter, oldStaff, boss, edit) {
  const lines = r.lines.slice();
  edit(lines);
  const how = newHowTo(lines, r.eol, oldStaff, staffAfter, boss);
  if (how) lines.splice(how.h, how.e - how.h, ...how.next);
  fs.writeFileSync(claudePath(office), lines.join(r.eol));
  return !!how;
}

function load(office) {
  if (!office) throw new Error('사무실 폴더를 아직 고르지 않았어요.');
  const text = fs.readFileSync(claudePath(office), 'utf8');
  const r = readRoster(text);
  if (!r.sec) throw new Error('CLAUDE.md 에 "## 직원 명부" 절이 없어요.');
  return r;
}
function state(office) {
  const r = load(office);
  const list = (rel) => { const d = path.join(office, ...rel.split('/')); try { if (!inside(office, d)) return []; return fs.readdirSync(d).filter((f) => /^[a-z][a-z-]{0,29}\.md$/.test(f)).map((f) => f.slice(0, -3)); } catch (e) { return []; } };
  return { ok: true, staff: r.staff.map(plain), agents: list(AGENTS), fired: list(FIRED), hireable: STAFF.filter((p) => p.id !== GUIDE).map((p) => ({ id: p.id, animal: p.animal, job: p.job })) };
}

function hire(office, input) {
  const o = input || {};
  const id = typeof o.id === 'string' ? o.id : '';
  if (!STAFF.some((p) => p.id === id) || id === GUIDE) return err('고용할 수 없는 직원이에요.');
  const name = SK.cleanName(o.name, '', 20);
  if (name === null) return err('이름에 쓸 수 없는 글자가 있어요.');
  const s = staffOf(id, name);
  const r = load(office);
  if (r.staff.some((x) => x.id === id || x.animal === s.animal)) return err('이미 명부에 있는 직원이에요.');
  if (r.staff.some((x) => x.name === s.name)) return err('같은 이름의 직원이 있어요: ' + s.name);
  const boss = bossOf(r.lines);
  const oldStaff = r.staff.map(plain), after = oldStaff.concat([s]);
  ensureSkills(office);
  const ag = dirIn(office, AGENTS), file = path.join(ag, id + '.md');
  let agent = 'kept';
  if (!exists(file)) {
    const fired = path.join(dirIn(office, FIRED), id + '.md');
    if (exists(fired)) {
      fs.renameSync(fired, file); agent = 'restored';
      const t = fs.readFileSync(file, 'utf8'), old = nameInAgent(t);
      if (old && old !== s.name && pristine(t, Object.assign({}, s, { name: old }), boss)) { fs.writeFileSync(file, SK.agentFile(s, boss)); agent = 'restored-renamed'; }
    } else { fs.writeFileSync(file, SK.agentFile(s, boss), { flag: 'wx' }); agent = 'created'; }
  }
  const how = writeRoster(office, r, after, oldStaff, boss, (lines) => {
    const last = r.staff.length ? r.staff[r.staff.length - 1].line : null;
    let at = last !== null ? last + 1 : r.sec[1];
    if (last === null) while (at > r.sec[0] + 1 && lines[at - 1] === '') at--;
    lines.splice(at, 0, rosterLine(s));
  });
  return { ok: true, staff: after, agent, howTo: how };
}

function stamp(d) { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
function fire(office, input, now) {
  const id = input && typeof input.id === 'string' ? input.id : '';
  if (!ID_RE.test(id)) return err('직원 id 가 올바르지 않아요.');
  if (id === GUIDE) return err('비서는 늘 함께해요. 해고할 수 없어요.');
  const r = load(office);
  const hit = r.staff.filter((x) => x.id === id);
  if (!hit.length) return err('명부에 없는 직원이에요.');
  const boss = bossOf(r.lines);
  const oldStaff = r.staff.map(plain), after = r.staff.filter((x) => x.id !== id).map(plain);
  const file = path.join(office, ...AGENTS.split('/'), id + '.md');
  let agent = 'none', moved = null;
  if (exists(file)) {
    if (!inside(office, file)) return err('설명서가 사무실 밖을 가리켜요.');
    const fd = dirIn(office, FIRED);
    let dest = path.join(fd, id + '.md');
    if (exists(dest)) dest = path.join(fd, id + '-' + stamp(now || new Date()) + '.md');
    if (exists(dest)) return err('해고 폴더에 같은 이름이 있어요. 잠시 뒤 다시 해 주세요.');
    fs.renameSync(file, dest); agent = 'moved'; moved = FIRED + '/' + path.basename(dest);
  }
  const lines0 = new Set(hit.map((x) => x.line));
  const how = writeRoster(office, r, after, oldStaff, boss, (lines) => { for (let i = lines.length - 1; i >= 0; i--) if (lines0.has(i)) lines.splice(i, 1); });
  return { ok: true, staff: after, agent, moved, howTo: how };
}

function rename(office, input) {
  const o = input || {};
  const id = typeof o.id === 'string' ? o.id : '';
  if (!ID_RE.test(id)) return err('직원 id 가 올바르지 않아요.');
  const r = load(office);
  const cur = r.staff.find((x) => x.id === id);
  if (!cur) return err('명부에 없는 직원이에요.');
  const name = SK.cleanName(o.name, cur.role, 20);
  if (name === null) return err('이름에 쓸 수 없는 글자가 있어요.');
  if (name === cur.name) return { ok: true, staff: r.staff.map(plain), same: true, agent: 'same' };
  if (r.staff.some((x) => x.id !== id && x.name === name)) return err('같은 이름의 직원이 있어요: ' + name);
  const boss = bossOf(r.lines);
  const oldStaff = r.staff.map(plain), after = r.staff.map((x) => (x.id === id ? Object.assign(plain(x), { name }) : plain(x)));
  const ns = after.find((x) => x.id === id);
  let agent = 'none';
  const file = path.join(office, ...AGENTS.split('/'), id + '.md');
  if (id !== GUIDE && exists(file) && inside(office, file)) {
    const t = fs.readFileSync(file, 'utf8');
    if (pristine(t, plain(cur), boss)) { fs.writeFileSync(file, SK.agentFile(ns, boss)); agent = 'rewritten'; } else agent = 'kept-edited';
  }
  const how = writeRoster(office, r, after, oldStaff, boss, (lines) => { lines[cur.line] = rosterLine(ns); });
  return { ok: true, staff: after, agent, howTo: how };
}

function ensureSkills(office) {
  if (!office) throw new Error('사무실 폴더를 아직 고르지 않았어요.');
  claudePath(office);
  const created = [];
  for (const f of SKP.files().concat([{ rel: AT.FORM_REL, text: AT.form() }])) {
    const parts = f.rel.split('/'), dir = dirIn(office, parts.slice(0, -1).join('/')), p = path.join(dir, parts[parts.length - 1]);
    if (exists(p)) continue;
    fs.writeFileSync(p, f.text, { flag: 'wx' }); created.push(f.rel);
  }
  return { ok: true, created };
}
function skillsList(office) {
  const en = ensureSkills(office);
  const base = path.join(office, '.claude', 'skills'), skills = [];
  let dirs = [];
  try { if (inside(office, base)) dirs = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[a-z0-9][a-z0-9-]{0,40}$/.test(d.name)).map((d) => d.name).sort(); } catch (e) { dirs = []; }
  for (const d of dirs) {
    const p = path.join(base, d, 'SKILL.md');
    try { if (!inside(office, p)) continue; const t = fs.readFileSync(p, 'utf8'); if (t.length > 200000) continue; skills.push({ folder: d, text: t }); } catch (e) {  }
  }
  const r = load(office), agents = {};
  for (const s of r.staff) {
    if (!ID_RE.test(s.id)) continue;
    const p = path.join(office, ...AGENTS.split('/'), s.id + '.md');
    try { if (inside(office, p)) agents[s.id] = fs.readFileSync(p, 'utf8').split(/\r?\n---/)[0].slice(0, 4000) + '\n---\n'; } catch (e) {  }
  }
  return { ok: true, created: en.created, skills, agents, recommend: Object.fromEntries(SKP.SKILLS.map((x) => [x.folder, x.animals])) };
}

const safe = (fn) => (...a) => { try { return fn(...a); } catch (e) { return err(String(e && e.message || e)); } };
module.exports = { STAFF, AGENTS, FIRED, readRoster, bossOf, state: safe(state), hire: safe(hire), fire: safe(fire), rename: safe(rename), ensureSkills: safe(ensureSkills), skillsList: safe(skillsList), pristine, nameInAgent };
