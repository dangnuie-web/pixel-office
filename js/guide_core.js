(function (root) {
  'use strict';
  const TAG = '처음안내';
  const nfc = (s) => String(s == null ? '' : s).normalize('NFC');
  function isGuide(text) { const first = nfc(text).replace(/\r\n?/g, '\n').split('\n')[0]; return /^태그:/.test(first) && first.replace(/^태그:/, '').split(',').map((t) => t.trim()).includes(TAG); }
  function parse(text) {
    const lines = nfc(text).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
    const out = { title: '', chapters: [], pages: [] };
    let ch = null, pg = null, field = null;
    const strip = (s) => s.replace(/\*\*/g, '').trim();
    for (const raw of lines) {
      const l = raw.replace(/\s+$/, '');
      let m;
      if ((m = /^# (.+)$/.exec(l))) { out.title = m[1].trim(); continue; }
      if ((m = /^## (?:(\d+)장\.\s*)?(.+?)(\s*\[[^\]]*\])?$/.exec(l))) {
        if (/^\[?제작 메모|^목차/.test(m[2])) { ch = null; pg = null; continue; }
        ch = { name: m[2].trim(), first: out.pages.length, isNew: /\[새\]/.test(m[3] || '') }; out.chapters.push(ch); pg = null; continue;
      }
      if (!ch) continue;
      if ((m = /^### (.+)$/.exec(l))) { pg = { ch: ch.name, tag: m[1].trim(), gif: '', desc: '', bubble: '', body: '', last: false }; out.pages.push(pg); field = null; continue; }
      if (!pg) continue;
      if ((m = /^- \*\*영상\*\*:\s*(.*)$/.exec(l))) { const g = /`([^`]+\.gif)`/.exec(m[1]); pg.gif = g ? g[1] : ''; field = null; continue; }
      if ((m = /^- \*\*설명\*\*:\s*(.*)$/.exec(l))) { pg.desc = strip(m[1]); field = 'desc'; continue; }
      if ((m = /^- \*\*말풍선\*\*:\s*(.*)$/.exec(l))) { pg.bubble = strip(m[1]).replace(/^["“]|["”]$/g, ''); field = 'bubble'; continue; }
      if (field && /^\s{2,}\S/.test(l)) { pg[field] += ' ' + strip(l); continue; }
      if (!l.trim()) { field = null; if (pg.body) pg.body += '\n'; continue; }
      if (l.trim() === '---') continue;
      field = null; pg.body += l.trim() + '\n';
    }
    out.chapters = out.chapters.filter((c) => out.pages.some((p) => p.ch === c.name));
    out.chapters.forEach((c) => { c.first = out.pages.findIndex((p) => p.ch === c.name); });
    out.pages.forEach((p) => { p.body = p.body.replace(/\n{3,}/g, '\n\n').trim(); });
    if (out.pages.length) out.pages[out.pages.length - 1].last = true;
    return out;
  }
  const gifSrc = (f) => { const m = /^(\d{2})_/.exec(f || ''); return m ? 'assets/guide/guide' + m[1] + '.gif' : ''; };
  function partStart(g) { const i = g.chapters.findIndex((c) => c.isNew); return i; }
  const api = { TAG, isGuide, parse, gifSrc, partStart };
  root.POGuideCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
