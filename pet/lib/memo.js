'use strict';
const N = require('./names');

const KINDS = {
  idea: { label: '아이디어', rel: '10_프로젝트/아이디어보관함.md', header: ['날짜', '아이디어', '종류', '상태', '메모'], row: (d, t) => [d, t, '미분류', '대기', N.values().memoTag] },
  lecture: { label: '강의 소재', rel: '10_프로젝트/01_진행/강의/강의소재.md', header: ['날짜', '소재', '메모'], row: (d, t) => [d, t, N.values().memoTag] },
};
const MAX_LEN = 500;

function cellText(s) {
  let t = String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = Array.from(t).slice(0, MAX_LEN).join('');
  return t.replace(/\\?\|/g, '\\|');
}
function rowCells(line) {
  const l = String(line).trim();
  if (!/^\|.*\|$/.test(l)) return null;
  const out = []; let cur = '';
  for (let i = 1; i < l.length - 1; i++) {
    if (l[i] === '\\' && l[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (l[i] === '|') { out.push(cur.trim()); cur = ''; continue; }
    cur += l[i];
  }
  out.push(cur.trim());
  return out;
}
const SEP_RE = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;

function insertTableRow(text, header, cells) {
  const src = String(text == null ? '' : text);
  const nl = /\r\n/.test(src) ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const hits = [];
  lines.forEach((l, i) => { const c = rowCells(l); if (c && c.length === header.length && c.every((x, k) => x === header[k])) hits.push(i); });
  if (!hits.length) return { ok: false, why: '표 머리 줄(' + header.join(' | ') + ')을 못 찾았어요' };
  if (hits.length > 1) return { ok: false, why: '같은 표 머리 줄이 ' + hits.length + '개예요' };
  const h = hits[0];
  const sep = lines[h + 1];
  if (sep == null || !SEP_RE.test(sep) || rowCells(sep).length !== header.length) return { ok: false, why: '표 머리 줄 아래 구분 줄(|---|)이 없어요' };
  if (cells.length !== header.length) return { ok: false, why: '칸 수가 달라요' };
  const row = '| ' + cells.join(' | ') + ' |';
  lines.splice(h + 2, 0, row);
  return { ok: true, text: lines.join(nl), line: h + 3, row };
}
function isOneRowInsert(oldText, newText, row) {
  const a = String(oldText).split(/\r?\n/), b = String(newText).split(/\r?\n/);
  if (b.length !== a.length + 1) return false;
  let k = 0;
  while (k < a.length && a[k] === b[k]) k++;
  if (b[k] !== row) return false;
  for (let i = k; i < a.length; i++) if (a[i] !== b[i + 1]) return false;
  return true;
}
function memoInsert(kind, oldText, input, ymd) {
  const K = KINDS[kind];
  if (!K) return { ok: false, why: '모르는 종류: ' + kind };
  const t = cellText(input);
  if (!t) return { ok: false, why: '빈 메모' };
  return insertTableRow(oldText, K.header, K.row(ymd, t));
}
function pendingLine(kind, input, ymd, why) {
  const K = KINDS[kind] || { label: kind };
  return '- ' + ymd + ' [' + K.label + '] ' + String(input).replace(/[\r\n]+/g, ' ').trim() + '  (못 쓴 까닭: ' + why + ')';
}

module.exports = { KINDS, MAX_LEN, cellText, rowCells, insertTableRow, isOneRowInsert, memoInsert, pendingLine };
