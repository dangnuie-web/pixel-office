'use strict';
const path = require('path');
const fs = require('fs');
const C = require('./po').load('calCore');
const A = require('./appt');

const GRACE_MS = 10 * 60 * 1000;
const EVE_MS = 60 * 1000;
const HOUR_MS = 15 * 60 * 1000;
const MAX_LINES = 3;
const HOUSE_FILE_RE = /^(\d{8})_house_생활기록_v(\d+)\.md$/;
const HOUSE_SECTIONS = ['약속', 'Meeting'];

function officeItems(text) {
  if (text == null) return [];
  return C.parse(text).items.map((m) => ({ src: 'office', date: m.date, time: m.time || '', kind: m.kind || '', text: m.text }));
}
function houseItems(text) {
  if (text == null) return [];
  const lines = String(text).split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (m && HOUSE_SECTIONS.includes(m[1])) { start = i + 1; break; }
  }
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start; i < lines.length; i++) if (/^##\s/.test(lines[i])) { end = i; break; }
  const isRow = (l) => /^\s*\|/.test(l), isSep = (l) => /^\s*\|?\s*:?-{3,}/.test(l);
  let i = start;
  while (i < end && !isRow(lines[i])) i++;
  if (i >= end) return [];
  const head = C.cells(lines[i]), kd = head.indexOf('날짜'), kt = head.indexOf('시간'), kx = head.indexOf('내용');
  if (kd < 0 || kx < 0) return [];
  const out = [];
  for (let j = i + 1; j < end && isRow(lines[j]); j++) {
    if (isSep(lines[j])) continue;
    const c = C.cells(lines[j]);
    const date = (c[kd] || '').trim(), t = kt >= 0 ? (c[kt] || '').trim() : '', x = (c[kx] || '').trim();
    if (!C.isDate(date) || !x) continue;
    out.push({ src: 'house', date, time: t, kind: '', text: x });
  }
  return out;
}
function houseFile(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return null; }
  let best = null;
  names.forEach((n) => {
    const m = HOUSE_FILE_RE.exec(n.normalize('NFC')); if (!m) return;
    const c = { file: path.join(dir, n), ver: +m[2], date: m[1] };
    if (!best || c.ver > best.ver || (c.ver === best.ver && c.date > best.date)) best = c;
  });
  return best ? best.file : null;
}

const keyOf = (type, m) => [type, m.src, m.date, m.time, m.text].join('|');
const minOf = (m) => (m.time ? C.timeKey(m.time) : null);
function timesOf(m) { return A.fireTimes(m.date, minOf(m) == null ? '' : m.time); }

function due(items, from, to, sent) {
  const out = { eve: [], hour: [] };
  (items || []).forEach((m) => {
    if (!C.isDate(m.date)) return;
    const ft = timesOf(m);
    [['eve', ft.eve], ['hour', ft.hour]].forEach(([type, at]) => {
      if (at == null || !(at > from && at <= to)) return;
      if (to - at > GRACE_MS) return;
      const key = keyOf(type, m);
      if (sent && sent[key]) return;
      if (out[type].some((x) => x.key === key)) return;
      out[type].push(Object.assign({ key }, m));
    });
  });
  return out;
}
function upcoming(items, now) {
  const out = [];
  (items || []).forEach((m) => {
    if (!C.isDate(m.date)) return;
    const ft = timesOf(m);
    if (ft.eve > now) out.push({ type: 'eve', at: ft.eve, key: keyOf('eve', m) });
    if (ft.hour != null && ft.hour > now) out.push({ type: 'hour', at: ft.hour, key: keyOf('hour', m) });
  });
  return out.sort((a, b) => a.at - b.at);
}

const SRC = { office: '오피스', house: '하우스' };
function sortByTime(list) {
  return list.map((m, i) => ({ m, i, t: minOf(m) })).sort((a, b) => (a.t == null ? 1e9 : a.t) - (b.t == null ? 1e9 : b.t) || a.i - b.i).map((x) => x.m);
}
function timeLabel(m) { const k = minOf(m); return k != null ? A.amPm(k) : m.time ? m.time : '종일'; }
function bubble(type, list) {
  const all = sortByTime(list || []), n = all.length;
  if (!n) return null;
  const shown = all.slice(0, MAX_LINES), rest = all.slice(MAX_LINES);
  const head = type === 'eve' ? (n === 1 ? '내일 약속이 있어요' : '내일 약속 ' + n + '개') : '1시간 뒤 약속이에요!';
  let hint = '';
  if (rest.length) {
    const srcs = Array.from(new Set(rest.map((m) => m.src)));
    hint = '외 ' + rest.length + '개는 ' + (srcs.length === 1 ? SRC[srcs[0]] + ' 달력' : '달력') + '에서';
  }
  if (type === 'hour') hint = hint ? hint + ' · 누르면 닫혀요' : '누르면 닫혀요';
  const lines = shown.map((m) => ({ t: timeLabel(m), text: m.text, src: m.src, tag: SRC[m.src] || '' }));
  const text = head + '\n' + lines.map((l) => l.t + ' ' + l.text + ' [' + l.tag + ']').join('\n') + (hint ? '\n' + hint : '');
  return { head, lines, hint, ms: type === 'eve' ? EVE_MS : HOUR_MS, text };
}

function pruneSent(sent, now) {
  const out = {};
  Object.keys(sent || {}).forEach((k) => { if (now - sent[k] < 3 * 24 * 3600 * 1000) out[k] = sent[k]; });
  return out;
}

module.exports = { GRACE_MS, EVE_MS, HOUR_MS, MAX_LINES, officeItems, houseItems, houseFile, due, upcoming, bubble, pruneSent, keyOf, timeLabel };
