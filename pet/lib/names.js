'use strict';
const core = require('./po').load('core');
const E = require('./edition');

const DEFAULTS = {
  dangnee: { boss: '픽셀', pet: '비서', app: E.EDITIONS.public.name, memoTag: '펫 메모' },
  public: { boss: '픽셀', pet: '비서', app: E.EDITIONS.public.name, memoTag: '펫 메모' },
};
const BOSS_MAX = 8;
let cur = null;

function clean(v, max) {
  const s = String(v == null ? '' : v).normalize('NFC').replace(/[*_`[\]()|:]/g, '').replace(/\s+/g, ' ').trim().replace(/님$/, '').trim();
  return s ? Array.from(s).slice(0, max).join('') : '';
}
function bossFromClaude(text) {
  const lines = String(text || '').split(/\r?\n/);
  const i = lines.findIndex((l) => /^##\s+대표\s*$/.test(l));
  if (i < 0) return '';
  for (let k = i + 1; k < lines.length && !/^##\s/.test(lines[k]); k++) {
    const m = /^\s*[-*]\s+(.+)$/.exec(lines[k]);
    if (m) return clean(m[1].split(/[.,(（—–]/)[0], BOSS_MAX);
  }
  return '';
}
function petFromRoster(text) {
  let staff = [];
  try { staff = core.parseRoster(String(text || '')).staff; } catch (e) { staff = []; }
  const s = staff.find((x) => x.animal === '다람쥐' || x.id === 'squirrel');
  return s ? s.name : '';
}
function compute({ pub, claudeText, configBoss } = {}) {
  const d = DEFAULTS[pub ? 'public' : 'dangnee'];
  if (!pub) return Object.assign({ pub: false }, d);
  const boss = clean(configBoss, BOSS_MAX) || bossFromClaude(claudeText) || d.boss;
  return Object.assign({ pub: true }, d, { boss, pet: petFromRoster(claudeText) || d.pet });
}
function set(v) {
  cur = Object.assign({}, v, { bossCall: v.boss + '님' });
  globalThis.PONames = { values: () => ({ boss: cur.boss, bossCall: cur.bossCall }) };
  return cur;
}
function refresh(opts) { return set(compute(opts)); }
function values() { return cur || set(compute({ pub: globalThis.PO_PUBLIC === true })); }
function petIs() { return core.josa(values().pet, '이에요', '예요'); }

module.exports = { DEFAULTS, BOSS_MAX, clean, bossFromClaude, petFromRoster, compute, set, refresh, values, petIs };
