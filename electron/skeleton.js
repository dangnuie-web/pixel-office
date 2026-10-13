'use strict';
const fs = require('fs');
const path = require('path');
const OF = require('./office');

const FOLDER = '픽셀 오피스';
const MAX_TRY = 99;
const DEFAULT_OFFICE = '픽셀 오피스';
const DEFAULT_OWNER = '픽셀';
const MAX_STAFF = 20;

const DIRS = [
  '10_프로젝트/01_진행', '10_프로젝트/02_완료', '10_프로젝트/03_보류',
  '40_자산/자료/프롬프트', '40_자산/자료/워크플로우', '40_자산/아이콘', '40_자산/폰트/영문', '40_자산/폰트/한글',
  '40_자산/낙서', '40_자산/레퍼런스', '40_자산/픽셀',
];
const EXAMPLE_DIR = '10_프로젝트/01_진행/첫 프로젝트';

function cleanName(v, def, max) {
  if (v === undefined || v === null) return def;
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').trim();
  if (!s) return def;
  if (s.length > max || /[\u0000-\u001f\u007f|()[\]:]/.test(s)) return null;
  return s;
}
function cleanStaff(x) {
  if (!x || typeof x !== 'object') return null;
  const name = cleanName(x.name, '', 20), role = cleanName(x.role, '', 30), animal = cleanName(x.animal, '', 10);
  const id = typeof x.id === 'string' ? x.id.trim() : '';
  if (!name || !role || !animal || !/^[a-z][a-z-]{0,29}$/.test(id)) return null;
  if (/\.$/.test(role)) return null;
  return { name, id, role, animal };
}

function cleanInput(input) {
  const o = input && typeof input === 'object' ? input : {};
  const officeName = cleanName(o.officeName, DEFAULT_OFFICE, 30);
  if (officeName === null) return { ok: false, error: '오피스 이름에 쓸 수 없는 글자가 있어요.' };
  let ownerName = cleanName(o.ownerName, DEFAULT_OWNER, 20);
  if (ownerName === null) return { ok: false, error: '대표 이름에 쓸 수 없는 글자가 있어요.' };
  ownerName = ownerName.replace(/님$/, '') || DEFAULT_OWNER;
  const raw = o.staff === undefined ? [] : o.staff;
  if (!Array.isArray(raw) || raw.length > MAX_STAFF) return { ok: false, error: '직원 목록이 올바르지 않아요.' };
  const staff = [];
  for (const x of raw) {
    const c = cleanStaff(x);
    if (!c) return { ok: false, error: '직원 줄이 올바르지 않아요.' };
    if (staff.some((s) => s.id === c.id || s.name === c.name)) return { ok: false, error: '같은 직원이 두 번 있어요: ' + c.name };
    staff.push(c);
  }
  return { ok: true, officeName, ownerName, staff };
}

function files({ officeName, ownerName, staff }) {
  const boss = ownerName + '님';
  const claude = '# ' + officeName + '\n\n## 대표\n- ' + boss + '\n\n## 직원 명부\n' +
    '아래 모양으로 한 줄에 한 명씩 적으면 사무실에 자리가 생겨요.\n' +
    '"- 이름 (영문id): 직업(동물)."  영문id는 영어 소문자와 - 만. 직업은 동물마다 정해져 있어요(앱이 동물로 읽어요).\n' +
    staff.map((s) => '- ' + s.name + ' (' + s.id + '): ' + s.role + '(' + s.animal + ').\n').join('');
  const todo = '# 할 일\n\n## Today\n\n## Weekly\n\n## 완료\n';
  const ideas = '# 아이디어 보관함\n떠오른 아이디어를 한 줄씩 모아요. 아이디어 칸은 "짧은 제목 — 설명" 모양이면 칠판 포스트잇 제목이 돼요.\n\n| 날짜 | 아이디어 | 종류 | 상태 | 메모 |\n|---|---|---|---|---|\n';
  const roadmap = '# 첫 프로젝트 로드맵\n\n한 줄 목표: ' + officeName + ' 써 보기\n\n## 1단계 — 시작\n\n' +
    '- [ ] 아이디어 보드에 아이디어 하나 적기 — 담당: ' + boss + '\n' +
    '- [ ] 일정 탭에 일정 하나 적기 — 담당: ' + boss + '\n';
  return [
    { rel: 'CLAUDE.md', text: claude },
    { rel: '10_프로젝트/할일.md', text: todo },
    { rel: '10_프로젝트/아이디어보관함.md', text: ideas },
    { rel: EXAMPLE_DIR + '/로드맵.md', text: roadmap },
  ];
}

function checkParent(dir, opts = {}) {
  const bad = (error) => ({ ok: false, error });
  if (typeof dir !== 'string' || !dir || !path.isAbsolute(dir)) return bad('폴더 경로가 올바르지 않아요.');
  let st, real;
  try { st = fs.statSync(dir); real = fs.realpathSync(dir); } catch (e) { return bad('폴더를 찾지 못했어요.'); }
  if (!st.isDirectory()) return bad('폴더가 아니에요.');
  for (const p of [path.resolve(dir), real]) {
    if (path.parse(p).root === p) return bad('디스크 맨 위 폴더는 쓸 수 없어요.');
    if (opts.home) {
      const h = path.resolve(opts.home);
      let hr = h; try { hr = fs.realpathSync(h); } catch (e) { hr = h; }
      if ((h !== p && h.startsWith(p.endsWith(path.sep) ? p : p + path.sep)) || (hr !== p && hr.startsWith(p.endsWith(path.sep) ? p : p + path.sep))) return bad('홈 폴더보다 위에는 만들 수 없어요.');
    }
    const err = OF.pathProblem(path.join(p, FOLDER), opts);
    if (err) return bad(err);
  }
  return { ok: true, path: real };
}
const folderName = (n) => (n === 1 ? FOLDER : FOLDER + ' ' + n);
function nextName(parent) {
  for (let n = 1; n <= MAX_TRY; n++) {
    const name = folderName(n);
    try { fs.lstatSync(path.join(parent, name)); } catch (e) { if (e.code === 'ENOENT') return name; }
  }
  return null;
}

function make(parent, input, opts = {}) {
  const c = cleanInput(input);
  if (!c.ok) return c;
  const pc = checkParent(parent, opts);
  if (!pc.ok) return pc;
  let target = null, name = null;
  for (let n = 1; n <= MAX_TRY && !target; n++) {
    const t = path.join(pc.path, folderName(n));
    const err = OF.pathProblem(t, opts);
    if (err) return { ok: false, error: err };
    try { fs.mkdirSync(t); target = t; name = folderName(n); } catch (e) { if (e.code !== 'EEXIST') return { ok: false, error: '폴더를 만들지 못했어요: ' + e.code }; }
  }
  if (!target) return { ok: false, error: '"' + FOLDER + '" 이름이 너무 많아요. 다른 곳을 골라 주세요.' };
  try {
    for (const d of DIRS.concat([EXAMPLE_DIR])) fs.mkdirSync(path.join(target, ...d.split('/')), { recursive: true });
    for (const f of files(c)) fs.writeFileSync(path.join(target, ...f.rel.split('/')), f.text, { flag: 'wx' });
  } catch (e) {
    return { ok: false, error: '뼈대를 다 만들지 못했어요(' + (e.code || e.message) + '). 만든 폴더는 그대로 있어요.', path: target };
  }
  return { ok: true, path: target, name, officeName: c.officeName, ownerName: c.ownerName, staff: c.staff };
}

module.exports = { FOLDER, DEFAULT_OFFICE, DEFAULT_OWNER, DIRS, EXAMPLE_DIR, cleanInput, files, checkParent, nextName, make };
