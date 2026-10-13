(function (root) {
  'use strict';
  const nfc = (s) => String(s == null ? '' : s).normalize('NFC');

  function fnv(s) { s = nfc(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

  const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
  const FONT_EXT = /\.(otf|ttf|woff2?)$/i;
  const isImg = (n) => IMG_EXT.test(n);
  const isFont = (n) => FONT_EXT.test(n);
  const KINDS = ['프롬프트', '워크플로우', '아이콘', '픽셀', '폰트', '낙서', '레퍼런스', '작업지시서', '스킬'];
  const DATA_KINDS = ['프롬프트', '워크플로우'];

  function parseName(file) {
    const base = nfc(file).replace(/\.md$/i, '');
    const m = base.match(/^(\d{8})_([^_]+)_(.+?)_(v\d+)$/i);
    if (m) return { date: m[1], tool: m[2], title: m[3], ver: m[4] };
    const d = base.match(/^(\d{8})_(.+)$/);
    return { date: d ? d[1] : '', tool: '', title: d ? d[2] : base, ver: '' };
  }
  const TOOL_COL = {
    미드저니: { c: '#A9BBD3', sh: '#87A0C2', hi: '#C4D0E1' },
    챗지피티: { c: '#AFC6A4', sh: '#93B285', hi: '#C5D6BD' },
    제미나이: { c: '#BDB3D6', sh: '#A092C4', hi: '#D4CEE4' },
    힉스필드: { c: '#E0B79A', sh: '#D49B73', hi: '#EACDB9' },
    클로드: { c: '#A6CCC8', sh: '#86B9B4', hi: '#C0DBD8' },
    블로그: { c: '#D9AFB3', sh: '#C98C92', hi: '#E6CBCD' },
    n8n: { c: '#A68CD8', sh: '#8966CB', hi: '#BEAAE2' },
    노코드: { c: '#F2B3C7', sh: '#EB87A7', hi: '#F8D6E1' },
  };
  const TOOL_NONE = { c: '#C5C7CA', sh: '#AAADB2', hi: '#DADCDD' };
  const NOT_TOOL = ['프롬프트', '워크플로우', '공부'];
  const NO_TOOL = '(없음)';
  const toolOf = (b) => (b && b.tool && !NOT_TOOL.includes(b.tool) ? b.tool : '');
  const toolKey = (b) => toolOf(b) || NO_TOOL;
  const toolCol = (b) => TOOL_COL[toolOf(b)] || TOOL_NONE;
  const TOOL_ORDER = Object.keys(TOOL_COL);
  function toolCmp(a, b) {
    const ta = toolOf(a), tb = toolOf(b);
    if (ta === tb) return 0;
    if (!ta) return 1; if (!tb) return -1;
    const ia = TOOL_ORDER.indexOf(ta), ib = TOOL_ORDER.indexOf(tb);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1; if (ib >= 0) return 1;
    return ta.localeCompare(tb, 'ko');
  }
  const TIER_OF_KIND = { 프롬프트: 'make', 아이콘: 'make', 픽셀: 'make', 폰트: 'make', 낙서: 'make', 레퍼런스: 'make', 워크플로우: 'work', 작업지시서: 'work', 스킬: 'work' };
  const TIER_ORDER = ['make', 'work'];
  const TIER_NAME = { make: '자료·자산', work: '업무 효율화' };
  const tierOf = (b) => TIER_OF_KIND[b && b.kind] || 'make';
  const BINDER = { c: '#9EA3AA', sh: '#858A92', hi: '#B4B8BE' };
  const isBinder = (b) => !!b && b.type === 'data' && b.kind === '워크플로우';
  const thickBinder = (bytes) => Math.max(46, thickData(bytes) + 10);
  const BINDER_HT = 214;
  const thickData = (bytes) => 26 + 6 * Math.max(0, Math.min(6, Math.round(Math.log2(Math.max(1, bytes) / 1000))));
  const thickAsset = (n) => Math.min(80, 34 + 6 * Math.round(Math.log2(n + 1)));

  const DIV = /^[═─━=\-_~]{5,}\s*$/;
  const HEAD = /^(\[[^\]]+\]|【[^】]+】|\d+[).]\s|#{1,3}\s)/;
  const FENCE = /^\s*```/;
  function isPrompt(txt) {
    const letters = txt.replace(/[^A-Za-z가-힣]/g, '');
    const latin = txt.replace(/[^A-Za-z]/g, '').length;
    return letters.length >= 40 && latin / letters.length >= 0.6;
  }
  const headText = (h) => h.replace(/^#{1,3}\s+/, '');
  function parseData(text) {
    const lines = nfc(text).replace(/\r\n?/g, '\n').split('\n');
    const tagLine = lines.length && lines[0].startsWith('태그:') ? lines.shift() : '';
    const lead = lines.length ? lines.shift() : '';
    const raw = []; let para = [], code = null;
    const flush = () => { if (para.length) raw.push(para); para = []; };
    lines.forEach((ln) => {
      if (code) { if (FENCE.test(ln)) { raw.push({ code }); code = null; } else code.push(ln); return; }
      if (FENCE.test(ln)) { flush(); code = []; return; }
      if (DIV.test(ln.trim())) { flush(); raw.push('DIV'); return; }
      if (!ln.trim()) { flush(); return; }
      para.push(ln);
    });
    if (code) raw.push({ code });
    flush();
    const out = []; let pendingHead = null;
    raw.forEach((p) => {
      if (p === 'DIV') { if (out.length && out[out.length - 1] !== 'DIV') out.push('DIV'); return; }
      if (p.code) {
        const body = p.code.join('\n');
        out.push({ head: pendingHead ? headText(pendingHead) : null, body, prompt: isPrompt(body), code: true });
        pendingHead = null; return;
      }
      let head = null, body = p;
      if (HEAD.test(p[0].trim())) { head = p[0].trim(); body = p.slice(1); }
      if (head && !body.length) { pendingHead = head; return; }
      if (!head && pendingHead) head = pendingHead;
      pendingHead = null;
      const txt = body.join('\n');
      out.push({ head: head ? headText(head) : null, body: txt, prompt: isPrompt(txt) });
    });
    if (pendingHead) out.push({ head: headText(pendingHead), body: '', prompt: false });
    while (out[0] === 'DIV') out.shift();
    while (out.length && out[out.length - 1] === 'DIV') out.pop();
    return { tags: tagLine.replace(/^태그:/, '').split(',').map((s) => s.trim()).filter(Boolean), tagLine, lead, blocks: out };
  }

  const fold = (s) => nfc(s).toLowerCase();
  function countHits(hay, q) {
    const Q = fold(q).trim(); if (!Q) return 0;
    const H = fold(hay); let n = 0, i = 0;
    while ((i = H.indexOf(Q, i)) >= 0) { n++; i += Q.length; }
    return n;
  }
  const hasHit = (hay, q) => countHits(hay, q) > 0;

  const useKey = (base) => nfc(base).replace(/\.[a-z0-9]+$/i, '').replace(/_\d+$/, '');
  function iconEntries(styles) {
    const out = {};
    styles.forEach((s) => {
      const seen = {};
      s.files.filter((f) => isImg(f.nfc)).forEach((f) => { const base = f.nfc.replace(/\.[a-z0-9]+$/i, ''); (seen[base] = seen[base] || []).push(f); });
      out[s.style] = Object.keys(seen).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })).map((base) => {
        const files = seen[base];
        const still = files.find((f) => !/\.gif$/i.test(f.nfc)) || files[0];
        const gif = files.find((f) => /\.gif$/i.test(f.nfc) && f !== still);
        return { style: s.style, styleRaw: s.raw, base, key: useKey(base), file: still.nfc, fileRaw: still.name, gif: gif ? gif.nfc : null, gifRaw: gif ? gif.name : null };
      });
    });
    return out;
  }
  const PER_ICON = 20;
  function iconPages(styleNames, entries, per) {
    per = per || PER_ICON;
    const pages = [];
    styleNames.forEach((s) => { const es = entries[s] || []; for (let i = 0; i < es.length; i += per) pages.push({ type: 'icon', style: s, items: es.slice(i, i + per), part: Math.floor(i / per) + 1, parts: Math.ceil(es.length / per) }); });
    return pages;
  }
  function matesOf(styleNames, entries, sel) {
    return styleNames.map((s) => ({ style: s, items: (entries[s] || []).filter((e) => e.key === sel.key) }));
  }

  const shapeOf = (w, h) => { const r = w / h; return r >= 1.2 ? '가로' : r <= 0.83 ? '세로' : '정사각'; };
  function refPages(refs) {
    const groups = {};
    refs.forEach((r) => {
      const parts = nfc(r.p).split('/'); const name = parts.pop();
      const ch = parts.length ? parts[0] : '낱장'; const sec = parts.slice(1).join(' / ');
      const g = (groups[ch] = groups[ch] || {}); (g[sec] = g[sec] || []).push(Object.assign({}, r, { name }));
    });
    const chs = Object.keys(groups).sort((a, b) => (a === '낱장' ? -1 : b === '낱장' ? 1 : a.localeCompare(b, 'ko')));
    const pages = [];
    chs.forEach((ch) => {
      Object.keys(groups[ch]).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'ko'))).forEach((sec) => {
        const q = groups[ch][sec].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })).map((r) => Object.assign({}, r, { shape: shapeOf(r.w || 1, r.h || 1) }));
        const rows = [];
        while (q.length) {
          const a = q.shift();
          if (a.shape === '가로') { rows.push([a]); continue; }
          const j = q.slice(0, 2).findIndex((r) => r.shape !== '가로');
          rows.push(j >= 0 ? [a, q.splice(j, 1)[0]] : [a]);
        }
        for (let i = 0; i < rows.length; i += 2) pages.push({ type: 'ref', ch, sec, label: i === 0 ? (sec || ch) : '', rows: rows.slice(i, i + 2) });
      });
    });
    return pages;
  }
  function photoParams(name) {
    const h = fnv(name);
    let deg = (h % 801) / 100 - 4; if (Math.abs(deg) < 0.8) deg = deg < 0 ? -0.8 : 0.8;
    return {
      hash: h, deg, tapeDeg: ((h >>> 11) % 13) - 6, tapeX: ((h >>> 17) % 31) - 15, tapeCol: ['B', 'G', 'D'][(h >>> 24) % 3],
      twoTape: ((h >>> 28) % 4) === 0, dx: ((h >>> 4) % 13) - 6, dy: ((h >>> 8) % 9) - 4, scale: 0.9 + ((h >>> 13) % 11) / 100,
      singleShift: ((h >>> 3) % 2) ? 46 : -46,
    };
  }
  function refLayout(page, W0, H0) {
    const top0 = 56 * H0 / 540, bottom0 = 30 * H0 / 540, padX = 18 * W0 / 400;
    const rowH = (H0 - top0 - bottom0) / page.rows.length;
    const out = [];
    page.rows.forEach((row, ri) => {
      const y = top0 + ri * rowH;
      if (row.length === 2) row.forEach((r, ci) => out.push(photoGeom(r, { x: padX + ci * ((W0 - 2 * padX) / 2), y, w: (W0 - 2 * padX) / 2, h: rowH })));
      else { const r = row[0]; out.push(photoGeom(r, { x: padX, y, w: W0 - 2 * padX, h: rowH, shift: r.shape === '가로' ? 0 : photoParams(r.name).singleShift })); }
    });
    return out;
  }
  function photoGeom(r, box) {
    const P = photoParams(r.name);
    const maxW = (box.w - 28) * P.scale, maxH = (box.h - 34) * P.scale; const ar = (r.w || 1) / (r.h || 1);
    let w = maxW, hh = w / ar; if (hh > maxH) { hh = maxH; w = hh * ar; }
    const iw = w, ih = hh;
    w += 14; hh += 14;
    return { r, P, left: box.x + (box.w - w) / 2 + P.dx + (box.shift || 0), top: box.y + (box.h - hh) / 2 + P.dy + 4, w, h: hh, iw, ih };
  }

  function imageSize(u8) {
    const b = u8, n = b.length;
    const be16 = (i) => (b[i] << 8) | b[i + 1], be32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const le16 = (i) => b[i] | (b[i + 1] << 8), le24 = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
    const asc = (i, l) => String.fromCharCode.apply(null, Array.from(b.subarray(i, i + l)));
    const ok = (w, h) => (w > 0 && h > 0 ? { w, h } : null);
    if (n >= 24 && b[0] === 0x89 && asc(1, 3) === 'PNG') return ok(be32(16), be32(20));
    if (n >= 10 && asc(0, 4) === 'GIF8') return ok(le16(6), le16(8));
    if (n >= 4 && b[0] === 0xFF && b[1] === 0xD8) {
      let i = 2;
      while (i + 9 < n) {
        if (b[i] !== 0xFF) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xFF) { i++; continue; }
        if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
        if (m === 0xD9 || m === 0xDA) break;
        const len = be16(i + 2);
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return ok(be16(i + 7), be16(i + 5));
        i += 2 + len;
      }
      return null;
    }
    if (n >= 30 && asc(0, 4) === 'RIFF' && asc(8, 4) === 'WEBP') {
      const c = asc(12, 4);
      if (c === 'VP8 ') return ok(le16(26) & 0x3fff, le16(28) & 0x3fff);
      if (c === 'VP8L') { const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24]; return ok(1 + (((b1 & 0x3F) << 8) | b0), 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))); }
      if (c === 'VP8X') return ok(1 + le24(24), 1 + le24(27));
      return null;
    }
    if (n >= 12 && asc(4, 4) === 'ftyp') {
      let best = null;
      for (let i = 4; i + 16 <= n; i++) {
        if (b[i] === 0x69 && b[i + 1] === 0x73 && b[i + 2] === 0x70 && b[i + 3] === 0x65) { const w = be32(i + 8), h = be32(i + 12); if (w > 0 && h > 0 && (!best || w * h > best.w * best.h)) best = { w, h }; }
      }
      return best;
    }
    const head = asc(0, Math.min(n, 4096));
    const sm = head.match(/<svg\b[^>]*>/i);
    if (sm) {
      const at = (k) => { const m = sm[0].match(new RegExp('\\s' + k + '\\s*=\\s*["\']\\s*([\\d.]+)(px)?\\s*["\']', 'i')); return m ? parseFloat(m[1]) : 0; };
      let w = at('width'), h = at('height');
      if (!(w && h)) { const vb = sm[0].match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i); if (vb) { w = parseFloat(vb[1]); h = parseFloat(vb[2]); } }
      return ok(w, h);
    }
    return null;
  }

  function parseLicenses(md) {
    const rows = [];
    String(md || '').normalize('NFC').split('\n').forEach((l) => {
      if (!/^\s*\|/.test(l)) return;
      const cells = l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.length < 2 || /^:?-{2,}/.test(cells[0]) || cells[0] === '폰트') return;
      rows.push({ name: cells[0], lic: cells[1].replace(/파일 정보:\s*/g, '') });
    });
    return rows;
  }
  function licenseFor(rows, file) {
    if (!rows) return null;
    const f = nfc(file), base = f.replace(FONT_EXT, '');
    const ex = rows.find((r) => r.name === f || r.name === base);
    if (ex) return ex.lic;
    const pre = rows.find((r) => { const w = r.name.split(/\s+/)[0].replace(FONT_EXT, ''); return w && base.startsWith(w); });
    return pre ? pre.lic : null;
  }

  const spreadOf = (page, per) => Math.floor(page / per);
  const store = {
    get(k, d) { try { const v = root.localStorage && root.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {  } },
    del(k) { try { if (root.localStorage) root.localStorage.removeItem(k); } catch (e) {  } },
  };

  const API = { TIER_OF_KIND, TIER_ORDER, TIER_NAME, tierOf, BINDER, isBinder, thickBinder, BINDER_HT, TOOL_COL, TOOL_NONE, NO_TOOL, toolOf, toolKey, toolCol, toolCmp, nfc, fnv, IMG_EXT, FONT_EXT, isImg, isFont, KINDS, DATA_KINDS, parseName, thickData, thickAsset, isPrompt, parseData, fold, countHits, hasHit,
    useKey, iconEntries, PER_ICON, iconPages, matesOf, shapeOf, refPages, photoParams, refLayout, photoGeom, imageSize, parseLicenses, licenseFor, spreadOf, store };
  root.POShelfCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
