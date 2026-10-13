(function (root) {
  'use strict';
  const FIELD_RE = /\{\{([^{}\s]+)\}\}/g;
  const CAP = 30;

  function splitItem(s) {
    const i = s.indexOf(' =');
    if (i >= 0 && (i + 2 === s.length || s[i + 2] === ' ')) return { label: s.slice(0, i).trim(), value: s.slice(i + 2).trim() };
    return { label: s.trim(), value: s.trim() };
  }
  function tagsOf(text) {
    const first = String(text || '').normalize('NFC').replace(/\r\n?/g, '\n').split('\n')[0];
    return /^태그:/.test(first) ? first.replace(/^태그:/, '').split(',').map((t) => t.trim()).filter(Boolean) : [];
  }
  function isComboText(text) { return tagsOf(text).includes('조합틀'); }

  function parseCombo(text) {
    const lines = String(text).normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
    const tags = /^태그:/.test(lines[0]) ? lines[0].replace(/^태그:/, '').split(',').map((t) => t.trim()).filter(Boolean) : [];
    const r = { isCombo: tags.includes('조합틀'), tags, template: null, fields: [], saved: [], problems: [] };
    let sec = '', field = null, fence = false, tplLines = null;
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (sec === '틀' && /^```/.test(line)) {
        if (!fence && r.template === null) { fence = true; tplLines = []; continue; }
        if (fence) { fence = false; r.template = tplLines.join('\n'); continue; }
      }
      if (fence) { tplLines.push(raw); continue; }
      const h2 = line.match(/^##\s+(.+)$/); if (h2 && !/^###/.test(line)) { sec = h2[1].trim(); field = null; continue; }
      if (sec === '칸') {
        const h3 = line.match(/^###\s+(\S+)\s*$/);
        if (h3) { field = { name: h3[1], desc: '', def: '', optional: false, values: [] }; r.fields.push(field); continue; }
        if (!field) continue;
        let m;
        if ((m = line.match(/^설명:\s*(.*)$/))) field.desc = m[1];
        else if ((m = line.match(/^기본:\s*(.*)$/))) field.def = m[1].trim();
        else if (/^비워도 됨$/.test(line.trim())) field.optional = true;
        else if ((m = line.match(/^-\s+(.*)$/))) field.values.push(splitItem(m[1]));
      } else if (sec === '저장한 조합') {
        const m = line.match(/^-\s+(.*)$/); if (!m) continue;
        const it = splitItem(m[1]); const pick = {};
        it.value.split(' / ').forEach((p) => { const j = p.indexOf(': '); if (j > 0) pick[p.slice(0, j).trim()] = p.slice(j + 2).trim(); });
        r.saved.push({ name: it.label, pick });
      }
    }
    if (r.template === null) r.problems.push('## 틀 아래에 ``` 로 감싼 틀이 없어요');
    const used = new Set([...(r.template || '').matchAll(FIELD_RE)].map((m) => m[1]));
    for (const f of r.fields) {
      if (!f.values.length) r.problems.push('‘' + f.name + '’ 칸에 값이 없어요');
      if (!f.values.some((v) => v.label === f.def)) f.def = f.values[0] ? f.values[0].label : '';
      f.values.forEach((v) => { if (v.value === '' && !f.optional) r.problems.push('‘' + f.name + '’ 칸의 ‘' + v.label + '’ 값이 비었어요'); });
      f.unused = !used.has(f.name); if (f.unused) r.problems.push('‘' + f.name + '’ 칸을 틀에서 쓰지 않아요');
    }
    r.missing = [];
    for (const n of used) if (!r.fields.some((f) => f.name === n)) { r.missing.push(n); r.problems.push('틀의 {{' + n + '}} 칸이 ## 칸에 없어요'); }
    return r;
  }
  function tidy(s) {
    return s.split('\n').map((l) => l
      .replace(/,(\s*,)+/g, ',')
      .replace(/[ \t]+,/g, ',')
      .replace(/^(\s*),\s*/, '$1')
      .replace(/,\s*$/, '')
      .replace(/,\s*(?=--)/g, ' ')
      .replace(/(\S)[ \t]{2,}/g, '$1 ')
      .replace(/[ \t]+$/, '')).join('\n');
  }
  function fill(tpl, pick) { return tidy(tpl.replace(FIELD_RE, (m, n) => (n in pick ? pick[n] : m))); }
  function combos(r, sel, cap) {
    cap = cap == null ? CAP : cap;
    let list = [{ pick: {}, labels: [] }];
    for (const f of r.fields) {
      let vs = sel[f.name] && sel[f.name].length ? sel[f.name] : f.values.filter((v) => v.label === f.def);
      if (!vs.length && !f.values.length) vs = [{ label: '', value: '' }];
      const next = [];
      for (const c of list) for (const v of vs) next.push({ pick: Object.assign({}, c.pick, { [f.name]: v.value }), labels: vs.length > 1 ? c.labels.concat(v.label) : c.labels });
      list = next;
    }
    return { total: list.length, items: list.slice(0, cap).map((c) => ({ label: c.labels.join(' · '), pick: c.pick, text: fill(r.template || '', c.pick) })) };
  }
  function savedLine(r, sel) {
    const parts = [], names = [];
    for (const f of r.fields) { const v = (sel[f.name] || [])[0]; if (v && v.label !== f.def) { parts.push(f.name + ': ' + v.label); names.push(v.label); } }
    return '- ' + (names.join(' ') || '기본') + ' = ' + parts.join(' / ');
  }
  function findValue(f, label) { const v = f.values.find((x) => x.label === label); return v ? Object.assign({}, v) : { label, value: label, own: true }; }

  const API = { FIELD_RE, CAP, splitItem, tagsOf, isComboText, parseCombo, tidy, fill, combos, savedLine, findValue };
  root.POComboCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
