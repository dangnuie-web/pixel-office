'use strict';
const path = require('path');
const fs = require('fs');
const M = require('./memo');
const C = require('./po').load('calCore');

const WRITE_FILES = Object.freeze([M.KINDS.idea.rel, M.KINDS.lecture.rel]);
const APPT_REL = C.PATH;
const REF_REL = '40_자산/레퍼런스';
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const NAME_BAD = /[/\\:\0]|^\.|^$/;

function makeFence(officeRoot, opts) {
  const OFFICE = fs.realpathSync(path.resolve(officeRoot));
  const ALLOW = (opts && opts.lecture === false) ? WRITE_FILES.filter((r) => r !== M.KINDS.lecture.rel) : WRITE_FILES;
  const inside = (full, dir) => full === dir || full.startsWith(dir + path.sep);

  function tableFile(rel) {
    if (ALLOW.indexOf(rel) < 0) throw new Error('쓰기 허용 안 됨: ' + rel);
    const full = path.join(OFFICE, ...rel.split('/'));
    let real;
    try { real = fs.realpathSync(full); } catch (e) { throw new Error('파일 없음: ' + rel); }
    if (real !== full || !fs.lstatSync(full).isFile()) throw new Error('쓰기 허용 안 됨(링크·폴더): ' + rel);
    return full;
  }
  function writeMemo(kind, input, ymd) {
    const K = M.KINDS[kind];
    if (!K) throw new Error('쓰기 허용 안 됨: 종류 ' + kind);
    const full = tableFile(K.rel);
    const old = fs.readFileSync(full, 'utf8');
    const r = M.memoInsert(kind, old, input, ymd);
    if (!r.ok) return { ok: false, why: r.why, shape: r.why !== '빈 메모' };
    if (!M.isOneRowInsert(old, r.text, r.row)) return { ok: false, why: '한 줄 넣기가 아닌 변경이라 멈췄어요', shape: true };
    if (fs.readFileSync(full, 'utf8') !== old) return { ok: false, why: '그 사이 파일이 바뀌었어요. 다시 해 주세요', shape: false };
    fs.writeFileSync(full, r.text);
    return { ok: true, rel: K.rel, line: r.line };
  }

  function apptFile() {
    const dir = path.join(OFFICE, '10_프로젝트');
    let rdir;
    try { rdir = fs.realpathSync(dir); } catch (e) { throw new Error('폴더 없음: 10_프로젝트'); }
    if (rdir !== dir || !fs.statSync(dir).isDirectory()) throw new Error('쓰기 허용 안 됨(링크): 10_프로젝트');
    const full = path.join(OFFICE, ...APPT_REL.split('/'));
    let st = null;
    try { st = fs.lstatSync(full); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (st && (st.isSymbolicLink() || !st.isFile())) throw new Error('쓰기 허용 안 됨(링크·폴더): ' + APPT_REL);
    return { full, exists: !!st };
  }
  function writeAppt(m) {
    let v;
    try { v = C.check(Object.assign({}, m, { project: '' })); } catch (e) { return { ok: false, why: e.message, input: true }; }
    const f = apptFile();
    const old = f.exists ? fs.readFileSync(f.full, 'utf8') : null;
    let r;
    try { r = C.add(old, v); } catch (e) { return { ok: false, why: e.message }; }
    if (!C.onlyTableChanged(old == null ? '' : old, r.text, 'add')) return { ok: false, why: '표 한 줄 더하기가 아닌 변경이라 멈췄어요' };
    if (old == null) {
      if (!r.text.startsWith(C.template())) return { ok: false, why: '새 파일 머리가 달라 멈췄어요' };
      try { fs.writeFileSync(f.full, r.text, { flag: 'wx' }); }
      catch (e) { return { ok: false, why: e.code === 'EEXIST' ? '그 사이 파일이 생겼어요. 다시 해 주세요' : '파일을 못 만들었어요 (' + e.code + ')' }; }
      return { ok: true, rel: APPT_REL, created: true, row: r.after, item: r.item };
    }
    if (fs.readFileSync(f.full, 'utf8') !== old) return { ok: false, why: '그 사이 파일이 바뀌었어요. 다시 해 주세요' };
    fs.writeFileSync(f.full, r.text);
    return { ok: true, rel: APPT_REL, created: false, row: r.after, item: r.item };
  }

  function refBase() {
    const base = path.join(OFFICE, ...REF_REL.split('/'));
    let real;
    try { real = fs.realpathSync(base); } catch (e) { throw new Error('폴더 없음: ' + REF_REL); }
    if (real !== base || !fs.statSync(base).isDirectory()) throw new Error('쓰기 허용 안 됨(링크): ' + REF_REL);
    return base;
  }
  function topicName(s) {
    const t = String(s == null ? '' : s).normalize('NFC').trim();
    if (!t) throw new Error('주제 이름을 적어 주세요');
    if (/[\/\\:*?"<>|\u0000-\u001f\u007f]/.test(t) || t.includes('..') || t.startsWith('.')) throw new Error('쓰기 허용 안 됨: 주제 이름에 / \\ : .. 같은 글자는 못 써요');
    if (Array.from(t).length > 40) throw new Error('주제 이름이 너무 길어요 (40자까지)');
    return t;
  }
  function refTopics() {
    const base = refBase();
    return fs.readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.isSymbolicLink() && !d.name.startsWith('.'))
      .map((d) => d.name.normalize('NFC'))
      .filter((n) => { try { return topicName(n) === n; } catch (e) { return false; } })
      .sort(new Intl.Collator('ko').compare);
  }
  function topicDir(topic, create) {
    const base = refBase();
    const t = topicName(topic);
    const dir = path.join(base, t);
    if (path.dirname(dir) !== base) throw new Error('쓰기 허용 안 됨: 주제 ' + topic);
    let st = null;
    try { st = fs.lstatSync(dir); } catch (e) {}
    if (st) {
      if (st.isSymbolicLink() || !st.isDirectory() || fs.realpathSync(dir) !== dir) throw new Error('쓰기 허용 안 됨(링크·파일): ' + REF_REL + '/' + t);
      return { dir, topic: t, made: false };
    }
    if (!create) throw new Error('주제 폴더가 없어요: ' + t);
    fs.mkdirSync(dir);
    return { dir, topic: t, made: true };
  }
  function refSourceProblem(src) {
    if (typeof src !== 'string' || !path.isAbsolute(src)) return '경로가 이상해요';
    const name = path.basename(src);
    if (NAME_BAD.test(name)) return '숨김 파일은 안 받아요';
    if (!IMG_EXT.test(name)) return '그림 파일(png·jpg·gif·webp·avif·svg)만 받아요';
    let st;
    try { st = fs.lstatSync(src); } catch (e) { return '파일을 못 찾았어요'; }
    if (st.isSymbolicLink()) return '바로가기(링크)는 안 받아요';
    if (!st.isFile()) return '폴더는 안 받아요';
    return null;
  }
  const candidate = (orig, n) => { if (n === 1) return orig; const ext = path.extname(orig); return orig.slice(0, orig.length - ext.length) + '_' + n + ext; };
  function refPlan(src, topic, taken) {
    const base = refBase();
    const t = topicName(topic), dir = path.join(base, t);
    if (path.dirname(dir) !== base) throw new Error('쓰기 허용 안 됨: 주제 ' + topic);
    const orig = path.basename(String(src));
    for (let n = 1; n < 1000; n++) {
      const dname = candidate(orig, n);
      if (!fs.existsSync(path.join(dir, dname)) && !(taken || []).includes(dname)) return { name: dname, topic: t, rel: REF_REL + '/' + t + '/' + dname, renamed: n > 1 };
    }
    return { name: null };
  }
  function moveRef(src, topic, isNew) {
    const bad = refSourceProblem(src);
    if (bad) return { ok: false, why: bad };
    const td = topicDir(topic, !!isNew);
    const real = fs.realpathSync(src);
    if (path.dirname(real) === td.dir) return { ok: false, why: '이미 그 주제 폴더에 있어요', made: td.made };
    const orig = path.basename(src);
    for (let n = 1; n < 1000; n++) {
      const dname = candidate(orig, n);
      const dest = path.join(td.dir, dname);
      if (path.dirname(dest) !== td.dir) return { ok: false, why: '이름이 이상해요' };
      if (fs.existsSync(dest)) continue;
      try { fs.linkSync(real, dest); }
      catch (e) {
        if (e.code === 'EEXIST') continue;
        if (e.code === 'EXDEV') return { ok: false, why: '다른 디스크의 파일이라 옮기지 않았어요', made: td.made };
        return { ok: false, why: '옮기지 못했어요 (' + e.code + ')', made: td.made };
      }
      const out = { ok: true, rel: REF_REL + '/' + td.topic + '/' + dname, name: dname, topic: td.topic, renamed: n > 1, made: td.made };
      try { fs.unlinkSync(real); } catch (e) { out.warn = '원래 자리 파일은 남았어요 (' + e.code + ')'; }
      return out;
    }
    return { ok: false, why: '같은 이름이 너무 많아요' };
  }
  return { OFFICE, WRITE_FILES: ALLOW, REF_REL, APPT_REL, tableFile, writeAppt, writeMemo, refBase, topicName, refTopics, topicDir, refPlan, refSourceProblem, moveRef };
}

module.exports = { makeFence, WRITE_FILES, REF_REL, APPT_REL, IMG_EXT };
