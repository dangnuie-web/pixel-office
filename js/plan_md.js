(function (root) {
  'use strict';
  const PATH = '10_프로젝트/할일.md';
  const SECTIONS = ['Today', 'Weekly', '완료'];
  const LEGACY = { '진행': 'Weekly' };
  const DONE = '완료';
  const ITEM_RE = /^(\s*)[-*+]\s+\[([ xX]|✅|✔️?|☑️?|✓)\]\s?(.*)$/;
  const COMMENT_RE = /\s*<!--\s*(로드맵|칸)\s*:\s*(.*?)\s*-->\s*$/;
  const H2_RE = /^##(?!#)\s+(.*?)\s*$/;

  function template() {
    return '# 할 일\n\n' +
      '당니님이 pixel-office 프로젝트 관리 탭에서 직접 쓰는 목록. 직원은 브리핑용으로 쓰지 않는다.\n' +
      '줄 모양: "- [ ] 할 일 (프로젝트명)". 끝의 <!-- 로드맵: … --> 는 로드맵 칸 짝 찾기용(지우면 로드맵 같이 체크만 안 됨).\n\n' +
      SECTIONS.map((s) => '## ' + s + '\n').join('\n');
  }
  const cleanTitle = (title) => String(title || '').replace(/\*\*|__/g, '').trim();
  function sectionKey(title) {
    const t = cleanTitle(title);
    return SECTIONS.find((s) => s.toLowerCase() === t.toLowerCase()) || null;
  }
  const legacyKey = (title) => LEGACY[cleanTitle(title)] || null;

  function parseItem(line, projects) {
    const m = ITEM_RE.exec(line);
    if (!m) return null;
    let rest = m[3].trim();
    const it = { indent: m[1], done: m[2] !== ' ', text: '', project: '', key: '', from: '', date: '' };
    for (let g = 0; g < 4; g++) {
      const c = COMMENT_RE.exec(rest); if (!c) break;
      if (c[1] === '로드맵') it.key = c[2]; else it.from = sectionKey(c[2]) || legacyKey(c[2]) || '';
      rest = rest.slice(0, c.index).trim();
    }
    const d = /^(\d{4}-\d{2}-\d{2})\s+/.exec(rest);
    if (d && it.done) { it.date = d[1]; rest = rest.slice(d[0].length); }
    const p = /\s*[(（]([^()（）]+)[)）]$/.exec(rest);
    if (p && (!projects || projects.indexOf(p[1].trim().normalize('NFC')) >= 0)) { it.project = p[1].trim().normalize('NFC'); rest = rest.slice(0, p.index).trim(); }
    it.text = rest;
    return it;
  }
  function formatItem(it) {
    const one = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    return (it.indent || '') + '- [' + (it.done ? 'x' : ' ') + '] ' +
      (it.done && it.date ? it.date + ' ' : '') + one(it.text) +
      (it.project ? ' (' + one(it.project) + ')' : '') +
      (it.key ? ' <!-- 로드맵: ' + one(it.key) + ' -->' : '') +
      (it.done && it.from && it.from !== 'Today' ? ' <!-- 칸: ' + it.from + ' -->' : '');
  }

  function parse(text, projects) {
    const src = String(text == null ? '' : text);
    const doc = { head: [], sections: [], nl: /\r\n/.test(src) ? '\r\n' : '\n', endNl: /\n$/.test(src), nextId: 1 };
    const lines = src.split(/\r?\n/);
    if (doc.endNl) lines.pop();
    let cur = null, fence = null;
    for (const line of lines) {
      const f = line.match(/^\s*(`{3,}|~{3,})/);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; }
      const h = !fence && !f ? H2_RE.exec(line) : null;
      if (h) { const old = legacyKey(h[1]); cur = { title: h[1], key: sectionKey(h[1]) || old, raw: line, entries: [] }; if (old) cur.legacy = true; doc.sections.push(cur); continue; }
      if (!cur) { doc.head.push(line); continue; }
      const it = !fence && !f ? parseItem(line, projects) : null;
      if (it) { it.id = doc.nextId++; it.section = cur.key; it.raw = line; cur.entries.push(it); }
      else cur.entries.push({ raw: line });
    }
    foldLegacy(doc);
    return doc;
  }
  function foldLegacy(doc) {
    const old = doc.sections.filter((s) => s.legacy);
    if (!old.length) return;
    doc.sections = doc.sections.filter((s) => !s.legacy);
    old.forEach((s) => {
      s.entries.filter(isItem).forEach((it) => insert(doc, s.key, it));
      const notes = s.entries.filter((e) => !isItem(e) && String(e.raw).trim() !== '');
      if (!notes.length) return;
      const to = section(doc, s.key, true), its = to.entries.filter(isItem);
      const at = its.length ? to.entries.indexOf(its[its.length - 1]) + 1 : to.entries.length;
      to.entries.splice(at, 0, ...notes);
    });
  }
  function serialize(doc) {
    const out = doc.head.slice();
    doc.sections.forEach((s) => { out.push(s.raw); s.entries.forEach((e) => out.push(e.raw != null ? e.raw : formatItem(e))); });
    return out.join(doc.nl) + (doc.endNl || !out.length ? doc.nl : '');
  }

  const isItem = (e) => e && e.id != null;
  function section(doc, key, create) {
    let s = doc.sections.find((x) => x.key === key);
    if (!s && create) {
      s = { title: key, key, raw: '## ' + key, entries: [{ raw: '' }] };
      const after = SECTIONS.slice(SECTIONS.indexOf(key) + 1);
      const at = doc.sections.findIndex((x) => after.indexOf(x.key) >= 0);
      const prev = at > 0 ? doc.sections[at - 1] : at < 0 ? doc.sections[doc.sections.length - 1] : null;
      if (prev && prev.entries.length && prev.entries[prev.entries.length - 1].raw !== '') prev.entries.push({ raw: '' });
      if (!prev && doc.head.length && doc.head[doc.head.length - 1] !== '') doc.head.push('');
      if (at < 0) doc.sections.push(s); else doc.sections.splice(at, 0, s);
    }
    return s || null;
  }
  function lists(doc) {
    const out = {}; SECTIONS.forEach((k) => { out[k] = []; });
    doc.sections.forEach((s) => { if (s.key) s.entries.forEach((e) => { if (isItem(e)) out[s.key].push(e); }); });
    return out;
  }
  function allItems(doc) { const a = []; doc.sections.forEach((s) => s.entries.forEach((e) => { if (isItem(e)) a.push(e); })); return a; }
  function find(doc, id) { return allItems(doc).find((e) => e.id === id) || null; }
  function where(doc, it) { for (const s of doc.sections) { const i = s.entries.indexOf(it); if (i >= 0) return { s, i }; } return null; }
  function detach(doc, it) {
    const w = where(doc, it);
    if (!w) return null;
    w.s.entries.splice(w.i, 1);
    if (!w.s.entries.some(isItem)) {
      w.s.entries = w.s.entries.filter((e, k, a) => !(e.raw === '' && k > 0 && a[k - 1].raw === ''));
    }
    return w;
  }
  function insert(doc, key, it, index) {
    const s = section(doc, key, true);
    const items = s.entries.filter(isItem);
    if (index == null) index = key === DONE ? 0 : items.length;
    if (items.length === 0) {
      if (!s.entries.length) s.entries.push({ raw: '' });
      const at = s.entries[0].raw === '' ? 1 : 0;
      s.entries.splice(at, 0, it);
      const last = doc.sections[doc.sections.length - 1] === s;
      if (!last && s.entries.length === at + 1) s.entries.push({ raw: '' });
    } else {
      const at = index >= items.length ? s.entries.indexOf(items[items.length - 1]) + 1 : s.entries.indexOf(items[Math.max(0, index)]);
      s.entries.splice(at, 0, it);
    }
    it.section = key;
    return it;
  }
  const touch = (it) => { delete it.raw; return it; };

  function addItem(doc, key, fields, index) {
    if (SECTIONS.indexOf(key) < 0 || key === DONE) throw new Error('할 일은 Today·Weekly 칸에만 추가해요: ' + key);
    const text = String(fields.short != null ? fields.short : fields.text || '').replace(/\s+/g, ' ').trim();
    if (!text) throw new Error('할 일 글이 비어 있어요');
    const it = { id: doc.nextId++, indent: '', done: false, text, project: String(fields.project || '').trim(), key: String(fields.key || '').trim(), from: '', date: '' };
    return insert(doc, key, it, index);
  }
  function setDone(doc, it, done, day) {
    if (!it || !!it.done === !!done && (done ? it.section === DONE : it.section !== DONE)) return it;
    const from = it.section;
    detach(doc, touch(it));
    if (done) {
      it.done = true; it.date = day || it.date || ''; it.from = from && from !== DONE ? from : (it.from || '');
      return insert(doc, DONE, it, 0);
    }
    const back = it.from && it.from !== DONE ? it.from : 'Today';
    it.done = false; it.date = ''; it.from = '';
    return insert(doc, back, it);
  }
  function moveItem(doc, it, key, index, day) {
    if (SECTIONS.indexOf(key) < 0) throw new Error('모르는 칸: ' + key);
    if (key === DONE) return setDone(doc, it, true, day);
    if (it.done || it.section === DONE) { setDone(doc, it, false); it.from = ''; }
    detach(doc, touch(it));
    return insert(doc, key, it, index);
  }
  function editItem(doc, it, patch) {
    if (patch.text != null) { const t = String(patch.text).replace(/\s+/g, ' ').trim(); if (!t) throw new Error('할 일 글이 비어 있어요'); it.text = t; }
    if (patch.project != null) it.project = String(patch.project).trim();
    return touch(it);
  }
  function removeItem(doc, it) { return !!detach(doc, it); }
  function todoKeys(doc) { return allItems(doc).map((e) => ({ project: e.project, key: e.key, text: e.text })); }

  const api = { PATH, SECTIONS, DONE, template, sectionKey, parseItem, formatItem, parse, serialize, section, lists, allItems, find, addItem, setDone, moveItem, editItem, removeItem, todoKeys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.POPlanMd = api;
})(typeof window !== 'undefined' ? window : globalThis);
