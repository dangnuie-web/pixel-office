(function (root) {
  'use strict';
  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const out = []; let cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (c === '|') { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  const cellOut = (v) => String(v == null ? '' : v).trim().replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
  const BR = /<br\s*\/?>/gi;
  const fmtRow = (cells) => '| ' + cells.map(cellOut).join(' | ') + ' |';
  const isSep = (l) => /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(l);
  const isRow = (l) => /^\s*\|/.test(l);


  function parseBody(lines) {
    const parts = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (isRow(l) && i + 1 < lines.length && isSep(lines[i + 1])) {
        const t = { type: 'table', head: l, sep: lines[i + 1], cols: splitRow(l), rows: [] };
        i += 2;
        while (i < lines.length && isRow(lines[i])) { t.rows.push({ cells: splitRow(lines[i]), raw: lines[i] }); i++; }
        i--; parts.push(t); continue;
      }
      parts.push({ type: 'other', raw: l });
    }
    return parts;
  }
  function parse(text) {
    const eol = /\r\n/.test(text) ? '\r\n' : '\n';
    const lines = String(text).split(/\r?\n/);
    const endNl = lines.length > 1 && lines[lines.length - 1] === '';
    if (endNl) lines.pop();
    return { eol, endNl, blocks: [{ parts: parseBody(lines) }] };
  }
  function serialize(doc, stamp) {
    const out = [];
    doc.blocks.forEach((b) => b.parts.forEach((p) => {
      if (p.type === 'other') out.push(stamp != null && /^갱신:/.test(p.raw) ? '갱신: ' + stamp : p.raw);
      else { out.push(p.head, p.sep); p.rows.forEach((r) => out.push(r.raw != null ? r.raw : fmtRow(r.cells))); }
    }));
    return out.join(doc.eol) + (doc.endNl ? doc.eol : '');
  }
  function touch(o) { delete o.raw; return o; }
  function firstTable(doc) { for (const b of doc.blocks) { const t = b.parts.find((x) => x.type === 'table'); if (t) return t; } return null; }
  function records(t) {
    if (!t) return [];
    return t.rows.map((r) => { const o = { _row: r }; t.cols.forEach((c, i) => { o[c] = r.cells[i] != null ? String(r.cells[i]).replace(BR, '\n') : ''; }); return o; });
  }
  function setRecord(t, row, obj) {
    t.cols.forEach((c, i) => { if (c in obj) { while (row.cells.length <= i) row.cells.push(''); row.cells[i] = String(obj[c] == null ? '' : obj[c]).trim().replace(/\r?\n/g, '<br>'); } });
    touch(row);
  }
  function addRecord(t, obj, at) {
    const row = { cells: t.cols.map((c) => String(obj[c] == null ? '' : obj[c]).trim().replace(/\r?\n/g, '<br>')) };
    if (at == null || at >= t.rows.length) t.rows.push(row); else t.rows.splice(Math.max(0, at), 0, row);
    return row;
  }
  function removeRecord(t, row) { const i = t.rows.indexOf(row); if (i >= 0) t.rows.splice(i, 1); }

  function localDate(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function localStamp(d) { d = d || new Date(); return localDate(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  const api = { parse, serialize, splitRow, fmtRow, firstTable, records, setRecord, addRecord, removeRecord, localDate, localStamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.POTableMd = api;
})(typeof window !== 'undefined' ? window : globalThis);
