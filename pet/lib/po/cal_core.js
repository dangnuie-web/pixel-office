(function (root) {
  'use strict';
  const PATH = '10_프로젝트/약속.md';
  const SECTION = '약속';
  const HEAD = ['날짜', '시간', '종류', '내용', '프로젝트'];
  const PJ_MAX = 40;
  const KINDS = ['미팅', '마감', '발행'];
  const TEXT_MAX = 60, TIME_MAX = 20, OLD_MAX = 200;
  const WD_MON = ['월', '화', '수', '목', '금', '토', '일'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
  const err = (msg, code) => Object.assign(new Error(msg), code ? { code } : {});
  const len = (s) => Array.from(String(s)).length;
  const BAD = /[|｜\\\u0000-\u001f\u007f\u2028\u2029]/;

  function template() {
    const pub = root.PO_PUBLIC === true;
    if (pub) return '# 약속\n\n' +
      '일정 탭이 읽고 쓰는 파일이에요. 미팅·마감·발행 일정을 한 줄씩 모아요.\n' +
      '줄 모양: 날짜 YYYY-MM-DD | 시간 10am·7:30pm(비우면 하루 종일) | 종류 미팅·마감·발행 | 내용 한 줄(60자까지, | 는 못 써요) | 프로젝트(01_진행 안 폴더 이름, 비워도 돼요)\n\n' +
      '## ' + SECTION + '\n' + rowText(HEAD) + '\n' + sepText(HEAD.length) + '\n';
    return '# 약속 (업무 일정)\n\n' +
      'pixel-office 달력 탭이 읽고 쓰는 파일. 업무 일정만 적는다(미팅·마감·발행일).\n' +
      '줄 모양: 날짜 YYYY-MM-DD | 시간 10am·7:30pm(비우면 하루 종일) | 종류 미팅·마감·발행 | 내용 한 줄(60자, | 쓰지 않기) | 프로젝트(01_진행 폴더 이름, 비워도 됨)\n\n' +
      '## ' + SECTION + '\n' + rowText(HEAD) + '\n' + sepText(HEAD.length) + '\n';
  }

  function monthGrid(y, m0) {
    const first = new Date(y, m0, 1, 12), lead = (first.getDay() + 6) % 7, days = new Date(y, m0 + 1, 0, 12).getDate();
    const n = Math.ceil((lead + days) / 7) * 7, weeks = [];
    for (let i = 0; i < n; i++) {
      const x = new Date(y, m0, 1 - lead + i, 12);
      if (i % 7 === 0) weeks.push([]);
      weeks[weeks.length - 1].push({ date: ymd(x.getFullYear(), x.getMonth(), x.getDate()), d: x.getDate(), inMonth: x.getMonth() === m0, dow: i % 7 });
    }
    return { y, m0, weeks };
  }
  function shift(y, m0, n) { const x = new Date(y, m0 + n, 1, 12); return { y: x.getFullYear(), m0: x.getMonth() }; }
  function addDays(date, n) { const [y, m, d] = date.split('-').map(Number), x = new Date(y, m - 1, d + n, 12); return ymd(x.getFullYear(), x.getMonth(), x.getDate()); }
  const PM_GUESS = [1, 7];
  function timeKey(s) {
    const t = String(s || '').trim().toLowerCase();
    let m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(t);
    if (m) { let h = Number(m[1]) % 12; if (m[3] === 'pm') h += 12; return h * 60 + Number(m[2] || 0); }
    m = /^(오전|오후)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시(?:\s*(\d{1,2})\s*분?|\s*반)?)?$/.exec(t);
    if (m) {
      let h = Number(m[2]); if (m[1] === '오후' && h < 12) h += 12; if (m[1] === '오전' && h === 12) h = 0; if (h > 23) return null;
      if (!m[1] && m[2][0] !== '0' && h >= PM_GUESS[0] && h <= PM_GUESS[1]) h += 12;
      const mm = m[3] != null ? Number(m[3]) : m[4] != null ? Number(m[4]) : /반$/.test(t) ? 30 : 0; if (mm > 59) return null;
      return h * 60 + mm;
    }
    return null;
  }
  const isDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim()); if (!m) return false; const x = new Date(+m[1], +m[2] - 1, +m[3], 12); return x.getFullYear() === +m[1] && x.getMonth() === +m[2] - 1 && x.getDate() === +m[3]; };
  function byDate(items) {
    const out = {};
    (items || []).forEach((m, i) => {
      if (!isDate(m.date)) return;
      (out[m.date] = out[m.date] || []).push(Object.assign({ i, t: timeKey(m.time) }, m));
    });
    Object.keys(out).forEach((k) => out[k].sort((a, b) => (a.t == null ? 1e9 : a.t) - (b.t == null ? 1e9 : b.t) || a.i - b.i));
    return out;
  }
  const isPast = (date, today) => date < today;
  function upcoming(items, today, days) {
    const end = addDays(today, days), map = byDate(items);
    return Object.keys(map).filter((d) => d >= today && d < end).sort().reduce((a, d) => a.concat(map[d]), []);
  }
  const dayName = (s) => { const [y, m, d] = s.split('-').map(Number); return `${m}월 ${d}일 (${WD[new Date(y, m - 1, d, 12).getDay()]})`; };

  const TIME_RE = /^0?(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)$/i;
  function normTime(s) {
    const t = String(s).trim(), m = TIME_RE.exec(t);
    if (m) return m[1] + (m[2] != null ? ':' + m[2] : '') + m[3].toLowerCase();
    if (/(am|pm)$/i.test(t)) return null;
    const k = timeKey(t); if (k == null || k < 0 || k >= 24 * 60) return null;
    const H = Math.floor(k / 60), mm = k % 60, h12 = H % 12 === 0 ? 12 : H % 12;
    return h12 + (mm ? ':' + pad(mm) : '') + (H < 12 ? 'am' : 'pm');
  }
  const okOld = (t, max) => !BAD.test(t) && len(t) <= max;
  function checkDate(s) { if (!isDate(s)) throw err('날짜 오류 (YYYY-MM-DD)', 'badDate'); return String(s).trim(); }
  function checkTime(s, keep) {
    if (s != null && typeof s !== 'string') throw err('시간 형식 오류', 'badTime');
    const t = String(s == null ? '' : s).trim();
    if (!t) return '';
    if (keep != null && t === keep && okOld(t, TIME_MAX)) return t;
    const n = normTime(t);
    if (!n) throw err('시간을 못 읽었어요. 3pm, 14:00, 오후 2시처럼 적거나 비워 두세요(종일). 오전/오후 없는 1~7시는 오후로 읽어요.', 'badTime');
    return n;
  }
  function checkKind(s, keep) {
    const t = String(s == null ? '' : s).trim();
    if (KINDS.includes(t)) return t;
    if (keep != null && t === keep && okOld(t, TIME_MAX)) return t;
    throw err('종류는 미팅·마감·발행 중 하나', 'badKind');
  }
  function checkProject(s) {
    const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (BAD.test(t) || len(t) > PJ_MAX) throw err('프로젝트 이름에 쓸 수 없는 글자', 'badProject');
    return t;
  }
  function checkText(s, keep) {
    if (typeof s !== 'string') throw err('내용 형식 오류', 'badText');
    if (BAD.test(s)) throw err('내용에 쓸 수 없는 글자 (| \\ 줄바꿈)', 'badText');
    const t = s.replace(/\s+/g, ' ').trim();
    if (!t) throw err('내용이 비었어요', 'badText');
    if (keep != null && t === keep && okOld(t, OLD_MAX)) return t;
    if (len(t) > TEXT_MAX) throw err('내용이 너무 길어요 (' + TEXT_MAX + '자까지)', 'badText');
    return t;
  }
  function check(m, keep) {
    if (!m || typeof m !== 'object') throw err('일정 형식 오류', 'badText');
    const k = keep || {};
    return { date: checkDate(m.date), time: checkTime(m.time, k.time), kind: checkKind(m.kind, k.kind), text: checkText(m.text, k.text), project: checkProject(m.project) };
  }

  const splitLines = (text) => String(text == null ? '' : text).split(/\r?\n/);
  const nlOf = (text) => (/\r\n/.test(String(text || '')) ? '\r\n' : '\n');
  const isRow = (l) => /^\s*\|/.test(l);
  const isSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
  function cells(l) { let s = String(l).trim(); if (s.startsWith('|')) s = s.slice(1); if (s.endsWith('|')) s = s.slice(0, -1); return s.split('|').map((c) => c.trim()); }
  const rowText = (c) => '| ' + c.join(' | ') + ' |';
  const sepText = (n) => '|' + Array(n).fill('---').join('|') + '|';
  const sigOf = (l) => String(l).trim();
  const H_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
  function sections(lines) {
    const out = [];
    lines.forEach((l, i) => {
      const m = H_RE.exec(l); if (!m) return;
      const lv = m[1].length;
      if (out.length && out[out.length - 1].end == null && lv <= out[out.length - 1].lv) out[out.length - 1].end = i;
      if (lv === 2 && m[2].replace(/\*\*|__/g, '').trim() === SECTION) out.push({ line: i, start: i + 1, end: null, lv });
    });
    out.forEach((s) => { if (s.end == null) s.end = lines.length; });
    return out;
  }
  function tableOf(lines, s) {
    for (let i = s.start; i < s.end - 1; i++) {
      if (!isRow(lines[i]) || !isSep(lines[i + 1])) continue;
      const t = { headLine: i, sepLine: i + 1, cols: cells(lines[i]), rows: [] };
      let j = i + 2;
      for (; j < s.end && isRow(lines[j]); j++) t.rows.push({ line: j, cells: cells(lines[j]) });
      t.endLine = j;
      return t;
    }
    return null;
  }
  function objOf(t, c) { const o = {}; HEAD.forEach((h) => { const k = t.cols.indexOf(h); o[h] = k >= 0 && c[k] != null ? c[k] : ''; }); return { date: o['날짜'], time: o['시간'], kind: o['종류'], text: o['내용'], project: o['프로젝트'] }; }
  function cellsFor(t, m) { const v = { 날짜: m.date, 시간: m.time, 종류: m.kind, 내용: m.text, 프로젝트: m.project || '' }; return t.cols.map((c) => (c in v ? v[c] : '')); }

  function parse(text) {
    const out = { items: [], warn: [], hasTable: false };
    if (text == null) return out;
    const lines = splitLines(text), secs = sections(lines);
    if (!secs.length) { out.warn.push('## 약속 섹션 없음'); return out; }
    if (secs.length > 1) out.warn.push('## 약속 섹션이 둘 (첫째만 읽음)');
    const t = tableOf(lines, secs[0]);
    if (!t) return out;
    out.hasTable = true;
    if (t.cols.indexOf('날짜') < 0 || t.cols.indexOf('내용') < 0) { out.warn.push('표 머리에 날짜·내용 칸이 없음'); return out; }
    t.rows.forEach((r) => {
      const o = objOf(t, r.cells);
      if (!isDate(o.date)) { out.warn.push((r.line + 1) + '번째 줄 날짜를 못 읽음'); return; }
      out.items.push(Object.assign({ line: r.line, sig: sigOf(lines[r.line]) }, o));
    });
    return out;
  }

  function prepare(text) {
    let src = text == null || !String(text).trim() ? template() : String(text);
    let lines = splitLines(src);
    let secs = sections(lines);
    if (secs.length > 1) throw err('## 약속 섹션이 둘이라 멈춤 (파일을 한 번 확인해 주세요)', 'twoSections');
    if (!secs.length) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push('', '## ' + SECTION, rowText(HEAD), sepText(HEAD.length), '');
      secs = sections(lines);
    }
    let t = tableOf(lines, secs[0]);
    if (!t) { lines.splice(secs[0].line + 1, 0, rowText(HEAD), sepText(HEAD.length)); secs = sections(lines); t = tableOf(lines, secs[0]); }
    if (t.cols.indexOf('날짜') < 0 || t.cols.indexOf('내용') < 0) throw err('표 머리에 날짜·내용 칸이 없어 멈춤', 'badHead');
    return { src, lines, t, nl: nlOf(src) };
  }
  function minutes(s) { const k = timeKey(s); return k == null ? 9999 : k; }
  function sortKey(t, c) { const o = objOf(t, c); return isDate(o.date) ? o.date + ' ' + String(minutes(o.time)).padStart(4, '0') : null; }
  function sortedAt(t, c) {
    const k = sortKey(t, c), hit = t.rows.find((r) => { const x = sortKey(t, r.cells); return x != null && x > k; });
    return hit ? hit.line : t.endLine;
  }
  function findRow(lines, t, sig) {
    const s = typeof sig === 'string' ? sigOf(sig) : null;
    const hits = s ? t.rows.filter((r) => sigOf(lines[r.line]) === s) : [];
    if (!hits.length) throw err('그 일정을 파일에서 못 찾았어요 (밖에서 바뀌었을 수 있음)', 'notFound');
    return hits[hits.length - 1];
  }
  const done = (P, extra) => Object.assign({ text: P.lines.join(P.nl), changed: true }, extra);

  function add(text, m, opt) {
    const o = opt || {}, P = prepare(text);
    let row, v;
    if (typeof o.raw === 'string') {
      if (/[\r\n]/.test(o.raw) || !isRow(o.raw)) throw err('되돌릴 줄 형식 오류');
      const p = objOf(P.t, cells(o.raw));
      v = check(p, { time: p.time, kind: p.kind, text: p.text }); row = o.raw;
    } else { v = check(m); row = rowText(cellsFor(P.t, v)); }
    let at = null;
    if (o.before != null) { const b = P.t.rows.find((r) => sigOf(P.lines[r.line]) === sigOf(o.before)); if (b) at = b.line; }
    if (at == null) at = sortedAt(P.t, cells(row));
    P.lines.splice(at, 0, row);
    return done(P, { op: 'add', line: at, item: v, after: row });
  }
  function update(text, sig, patch, opt) {
    const o = opt || {}, P = prepare(text), r = findRow(P.lines, P.t, sig), before = P.lines[r.line], cur = objOf(P.t, r.cells);
    let v, after;
    if (typeof o.raw === 'string') {
      if (/[\r\n]/.test(o.raw) || !isRow(o.raw)) throw err('되돌릴 줄 형식 오류');
      const p = objOf(P.t, cells(o.raw)); v = check(p, { time: p.time, kind: p.kind, text: p.text }); after = o.raw;
    } else {
      const p = patch || {};
      v = check({ date: p.date != null ? p.date : cur.date, time: p.time != null ? p.time : cur.time, kind: p.kind != null ? p.kind : cur.kind, text: p.text != null ? p.text : cur.text, project: p.project != null ? p.project : cur.project },
        { time: cur.time, kind: cur.kind, text: cur.text });
      const c = cellsFor(P.t, v);
      after = c.every((x, i) => x === r.cells[i]) && r.cells.length === c.length ? before : rowText(c);
    }
    if (after === before) return { text: P.lines.join(P.nl), changed: false, op: 'update', item: v, prev: cur };
    P.lines[r.line] = after;
    return done(P, { op: 'update', line: r.line, item: v, prev: cur, before, after });
  }
  function remove(text, sig) {
    const P = prepare(text), r = findRow(P.lines, P.t, sig), i = P.t.rows.indexOf(r), next = P.t.rows[i + 1], removedText = P.lines[r.line];
    const removed = objOf(P.t, r.cells);
    P.lines.splice(r.line, 1);
    return done(P, { op: 'remove', removed, removedText, before: next ? sigOf(P.lines[next.line - 1]) : null });
  }

  function rowOk(t, l) {
    if (!isRow(l) || isSep(l)) return false;
    const c = cells(l); if (c.length !== t.cols.length) return false;
    const o = objOf(t, c);
    return isDate(o.date) && okOld(o.time, TIME_MAX) && okOld(o.kind, TIME_MAX) && !!o.text && okOld(o.text, OLD_MAX) && okOld(o.project, PJ_MAX);
  }
  function stripRows(lines) {
    const s = sections(lines); if (s.length !== 1) return null;
    const t = tableOf(lines, s[0]); if (!t) return null;
    const keep = lines.filter((l, i) => i < t.sepLine + 1 || i >= t.endLine);
    return { t, keep, rows: t.rows.map((r) => lines[r.line]) };
  }
  function onlyTableChanged(oldText, newText, op) {
    try {
      const b = splitLines(newText), B = stripRows(b); if (!B) return false;
      let base;
      try { base = prepare(oldText); } catch (e) { return false; }
      const A = stripRows(base.lines); if (!A) return false;
      if (A.keep.join('\n') !== B.keep.join('\n')) return false;
      const ra = A.rows, rb = B.rows, eq = (x, y) => x.join('\n') === y.join('\n'), minus = (xs, i) => xs.slice(0, i).concat(xs.slice(i + 1));
      if (op === 'add') { if (rb.length !== ra.length + 1) return false; for (let i = 0; i < rb.length; i++) if (eq(minus(rb, i), ra)) return rowOk(B.t, rb[i]); return false; }
      if (op === 'remove') { if (rb.length !== ra.length - 1) return false; for (let i = 0; i < ra.length; i++) if (eq(minus(ra, i), rb)) return true; return false; }
      if (op === 'update') { if (rb.length !== ra.length) return false; const d = ra.map((x, i) => (x === rb[i] ? -1 : i)).filter((i) => i >= 0); return d.length === 1 && rowOk(B.t, rb[d[0]]); }
      return false;
    } catch (e) { return false; }
  }

  const api = { PATH, SECTION, HEAD, KINDS, TEXT_MAX, TIME_MAX, WD, WD_MON, ymd, addDays, template, monthGrid, shift, timeKey, isDate, byDate, isPast, upcoming, dayName,
    normTime, checkDate, checkTime, checkKind, checkProject, checkText, check, PJ_MAX, cells, rowText, sepText, sigOf, sections, tableOf, parse, prepare, add, update, remove, onlyTableChanged };
  root.POCalCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
