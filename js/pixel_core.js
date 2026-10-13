(function (root) {
  'use strict';

  const GROUPS = [
    ['구조', [['k', '#29262F', '먹'], ['W', '#56585F', '벽 윗면'], ['w', '#F4F3EF', '벽 흰색'], ['v', '#E4E3DE', '벽 그늘'], ['b', '#C4BAAD', '몰딩'], ['T', '#6B6661', '짙은 회갈']]],
    ['바닥', [['f', '#E3E0DA', '바닥 밝음'], ['g', '#D9D6CF', '바닥 중간'], ['h', '#C7C3BB', '바닥 이음새'], ['d', '#B3AFA8', '바닥 그림자']]],
    ['판벽', [['G', '#B7C3B2', '휴게실 판벽'], ['H', '#A0AD9B', '휴게실 그늘'], ['B', '#B2BDC9', '회의실 판벽'], ['C', '#9BA7B5', '회의실 그늘'], ['D', '#C4B6BE', '자료실 판벽'], ['E', '#AE9FA8', '자료실 그늘'], ['J', '#D0C6AF', '입구 판벽'], ['M', '#B9AE96', '입구 그늘'], ['S', '#C3C3BE', '업무실 판벽'], ['V', '#ACACA6', '업무실 그늘']]],
    ['가구', [['o', '#8F99A8', '소파 본색'], ['p', '#B6BEC9', '소파 밝음'], ['q', '#707A8A', '소파 그늘'], ['l', '#86B07E', '잎'], ['L', '#5C8458', '잎 그늘'], ['P', '#A9A6A0', '화분'], ['O', '#8E8B86', '화분 그늘']]],
    ['직원', [['y', '#F5DDB6', '크림 피부'], ['Y', '#D9B892', '크림 그늘'], ['m', '#EFA39A', '볼'], ['n', '#E08A3C', '다람쥐 주황'], ['N', '#B0622B', '다람쥐 그늘'], ['u', '#6E6272', '가시 회갈'], ['U', '#9B8F9E', '가시 밝음'], ['z', '#8CCB3E', '카멜레온 연두'], ['Z', '#5E9A2E', '카멜레온 그늘'], ['i', '#8F5B36', '비버 갈색'], ['I', '#64402A', '비버 그늘'], ['A', '#C8A064', '부엉이 황갈'], ['F', '#7D6247', '부엉이 짙은 갈']]],
    ['소품', [['K', '#45414D', '나비넥타이'], ['R', '#D8313F', '베레모 빨강'], ['Q', '#9E2230', '베레모 그늘'], ['s', '#5AAEE6', '두건 하늘']]],
    ['포인트', [['x', '#F2C641', '토리 노랑'], ['1', '#2FB35A', '바나 초록'], ['r', '#D65A4E', '도치 빨강'], ['2', '#962A57', '몽글 와인'], ['4', '#F5A3C0', '뚝딱 연분홍'], ['5', '#8452D0', '부기 보라'], ['6', '#D03CC6', '무늬 자홍'], ['7', '#86CFF5', '비트 하늘'], ['8', '#1FA39C', '오리 청록']]],
    ['아바타', [['a', '#5A3C30', '아바타 머리'], ['c', '#AFC6F0', '아바타 블라우스'], ['e', '#7F9FD6', '블라우스 그늘']]],
  ];
  const PAL = [];
  const pubName = (g, name) => (root.PO_PUBLIC === true && g === '포인트' ? name.split(' ').slice(1).join(' ') || name : name);
  GROUPS.forEach(([g, cs]) => cs.forEach(([l, hex, name]) => PAL.push({ l, hex, name: pubName(g, name), group: g })));
  const BY_HEX = {}; PAL.forEach((p) => { BY_HEX[p.hex] = p; });
  const BY_L = {}; PAL.forEach((p) => { BY_L[p.l] = p; });
  const OUTLINE = '#29262F';
  const LETTERS = 'abcdefghijlmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const SCALE_HINT = { 16: 4, 24: 3, 32: 2 };
  const SIZES = [16, 24, 32];
  const MAX_MINE = 4;
  const KIND = '픽셀', DIR = '40_자산/픽셀';

  const nfc = (s) => String(s == null ? '' : s).normalize('NFC');
  const normHex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? '#' + m[1].toUpperCase() : null; };

  const MAX_LEN = 40;
  const HANGUL = '가-힣ㄱ-ㅎㅏ-ㅣ';
  const EXT_TAIL = /\.(json|png|jpe?g|webp|gif|md|txt)$/i;
  const REMOVE = [/진짜\s*최종|최종/g, /\(\s*\d+\s*\)/g, /복사본/g, /(?<![A-Za-z])copy(?![A-Za-z])/gi, /(?<![A-Za-z])v\d{1,3}(?![0-9A-Za-z])/gi];
  const HANGUL_GAP = new RegExp('(?<=[' + HANGUL + '])\\s+(?=[' + HANGUL + '])', 'g');
  const NOT_ALLOWED = new RegExp('[^0-9A-Za-z' + HANGUL + '\\-]', 'g');
  const stripDash = (s) => s.replace(/^-+|-+$/g, '');
  function tidyName(raw) {
    let s = nfc(raw).trim();
    s = s.replace(EXT_TAIL, '');
    REMOVE.forEach((r) => { s = s.replace(r, ' '); });
    s = s.trim();
    s = s.replace(HANGUL_GAP, '');
    s = s.replace(/[\s_.·]+/g, '-');
    s = s.replace(NOT_ALLOWED, '');
    s = stripDash(s.replace(/-{2,}/g, '-'));
    s = stripDash(s.replace(/^\d{8}(?=-|$)/, ''));
    s = stripDash(Array.from(s).slice(0, MAX_LEN).join(''));
    return s;
  }
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function matches(files, kind, name, ext) {
    const re = new RegExp('^(\\d{8})_' + reEsc(nfc(kind)) + '_(' + reEsc(nfc(name)) + ')_v(\\d{2,})\\.' + reEsc(ext) + '$', 'i');
    const out = [];
    (files || []).forEach((f) => { const m = re.exec(nfc(f)); if (m) out.push({ v: +m[3], date: m[1], name: m[2] }); });
    return out.sort((a, b) => a.v - b.v || a.date.localeCompare(b.date) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
  function existingName(files, kind, name, ext) { const m = matches(files, kind, name, ext); return m.length ? m[0].name : name; }
  const fileName = (kind, name, v, ext, date) => date + '_' + kind + '_' + name + '_v' + String(v).padStart(2, '0') + '.' + ext;
  function nextPath(files, kind, name, ext, date) {
    const nm = existingName(files, kind, name, ext);
    const m = matches(files, kind, nm, ext);
    const v = m.length ? m[m.length - 1].v + 1 : 1;
    return { file: fileName(kind, nm, v, ext, date), v, name: nm, prev: m.length ? m[m.length - 1] : null, first: m.length ? m[0] : null };
  }
  function today(d) { d = d || new Date(); const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); }
  const FILE_RE = /^(\d{8})_픽셀_(.+)_v(\d{2,})\.json$/;
  function parseFile(f) { const m = FILE_RE.exec(nfc(f)); return m ? { date: m[1], name: m[2], v: +m[3], key: m[2].toLowerCase() } : null; }

  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  function rgbOf(hex) { const h = normHex(hex); return h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : null; }
  function lab(hex) {
    const [r, g, b] = rgbOf(hex).map(lin);
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function nearestOffice(hex) {
    const L = lab(hex);
    let best = null, bd = Infinity;
    PAL.forEach((p) => { const d = dist(L, lab(p.hex)); if (d < bd) { bd = d; best = p; } });
    return { p: best, d: bd, word: bd < 5 ? '차이 아주 작음' : bd < 12 ? '차이 작음' : bd < 25 ? '차이 보통' : '차이 큼' };
  }
  const isOffice = (hex) => !!BY_HEX[normHex(hex)];

  function blank(n) { return { n, c: new Array(n * n).fill(null) }; }
  const clone = (g) => ({ n: g.n, c: g.c.slice() });
  const filled = (g) => g.c.reduce((k, x) => k + (x ? 1 : 0), 0);
  const sameGrid = (a, b) => a.n === b.n && a.c.every((x, i) => x === b.c[i]);
  function resize(g, n2) {
    const out = blank(n2), off = Math.floor((n2 - g.n) / 2);
    for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) {
      const X = x + off, Y = y + off;
      if (X >= 0 && Y >= 0 && X < n2 && Y < n2) out.c[Y * n2 + X] = g.c[y * g.n + x];
    }
    return out;
  }
  function lostOnResize(g, n2) { return n2 >= g.n ? 0 : filled(g) - filled(resize(g, n2)); }
  function flipH(g) { const out = blank(g.n); for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) out.c[y * g.n + x] = g.c[y * g.n + (g.n - 1 - x)]; return out; }
  function fill(g, i, col) {
    const from = g.c[i]; if (from === col) return g;
    const out = clone(g), n = g.n, st = [i];
    out.c[i] = col;
    while (st.length) {
      const k = st.pop(), x = k % n, y = (k - x) / n;
      [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([X, Y]) => { if (X >= 0 && Y >= 0 && X < n && Y < n) { const j = Y * n + X; if (out.c[j] === from) { out.c[j] = col; st.push(j); } } });
    }
    return out;
  }
  function used(g) {
    const m = new Map(); g.c.forEach((x) => { if (x) m.set(x, (m.get(x) || 0) + 1); });
    return [...m.entries()].map(([hex, n]) => ({ hex, n })).sort((a, b) => b.n - a.n || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0));
  }

  function toAsset(g, name, note) {
    const u = used(g);
    const letterOf = new Map(), taken = new Set(['.', 'k']);
    if (u.some((x) => x.hex === OUTLINE)) letterOf.set(OUTLINE, 'k');
    u.forEach(({ hex }) => {
      if (letterOf.has(hex)) return;
      const want = BY_HEX[hex] ? BY_HEX[hex].l : '';
      let ch;
      if (want.length === 1 && !taken.has(want) && 'k. "\\'.indexOf(want) < 0) ch = want;
      else ch = [...LETTERS].find((c) => !taken.has(c));
      letterOf.set(hex, ch); taken.add(ch);
    });
    const cnt = Object.fromEntries(u.map((x) => [x.hex, x.n]));
    const pal = { '.': null }, order = ['.'];
    [...letterOf.entries()].sort((a, b) => ((a[1] !== 'k') - (b[1] !== 'k')) || (cnt[b[0]] - cnt[a[0]]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
      .forEach(([hex, ch]) => { pal[ch] = hex; order.push(ch); });
    Object.defineProperty(pal, '__order', { value: order, enumerable: false });
    const rows = [];
    for (let y = 0; y < g.n; y++) { let r = ''; for (let x = 0; x < g.n; x++) { const v = g.c[y * g.n + x]; r += v ? letterOf.get(v) : '.'; } rows.push(r); }
    const a = { name, scale_hint: SCALE_HINT[g.n] || Math.max(1, Math.round(64 / g.n)) };
    if (note) a.note = note;
    a.palette = pal; a.frames = [rows];
    return a;
  }
  function dumpAsset(a) {
    const head = Object.keys(a).filter((k) => k !== 'palette' && k !== 'frames').map((k) => JSON.stringify(k) + ': ' + JSON.stringify(a[k])).join(', ');
    let s = '{' + head + ',\n';
    const order = a.palette.__order || Object.keys(a.palette);
    s += '"palette":{' + order.map((k) => JSON.stringify(k) + ':' + JSON.stringify(a.palette[k])).join(',') + '},\n';
    s += '"frames":[\n' + a.frames.map((fr) => '[\n' + fr.map((r) => JSON.stringify(r)).join(',\n') + '\n]').join(',\n') + '\n]}\n';
    return s;
  }
  function checkAsset(a) {
    const probs = [];
    if (!a || typeof a !== 'object' || Array.isArray(a)) return ['JSON 객체가 아니에요'];
    ['name', 'scale_hint', 'palette', 'frames'].forEach((k) => { if (!(k in a)) probs.push("'" + k + "' 가 없어요"); });
    if (probs.length) return probs;
    const pal = a.palette, frames = a.frames;
    if (!pal || typeof pal !== 'object' || Array.isArray(pal) || !Object.keys(pal).length) return ['palette 가 비었거나 객체가 아니에요'];
    Object.keys(pal).forEach((ch) => {
      if ([...ch].length !== 1) probs.push("팔레트 글자 '" + ch + "' 는 한 글자여야 해요");
      if (pal[ch] !== null && !(typeof pal[ch] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(pal[ch]))) probs.push("팔레트 '" + ch + "' 색이 #RRGGBB 가 아니에요");
    });
    if (!Array.isArray(frames) || !frames.length) return probs.concat(['frames 가 비었어요']);
    frames.forEach((fr, fi) => {
      if (!Array.isArray(fr) || !fr.length || !fr.every((r) => typeof r === 'string')) { probs.push(fi + '번 그림이 글자 줄 목록이 아니에요'); return; }
      if (new Set(fr.map((r) => r.length)).size !== 1) probs.push(fi + '번 그림 줄 길이가 달라요');
      const bad = [...new Set(fr.join(''))].filter((ch) => !(ch in pal)).sort();
      if (bad.length) probs.push(fi + '번 그림에 팔레트에 없는 글자: ' + bad.join(''));
    });
    if (!Number.isInteger(a.scale_hint) || a.scale_hint < 1) probs.push('scale_hint 는 1 이상 정수여야 해요');
    return probs;
  }
  function fromAsset(a) {
    const probs = checkAsset(a);
    if (probs.length) return { error: probs.join(' / ') };
    const fr = a.frames[0], n = fr.length;
    if (fr[0].length !== n) return { error: '정사각이 아니에요 (' + fr[0].length + '×' + n + ')' };
    if (n < 8 || n > 64) return { error: '칸 수가 8~64 밖이에요' };
    const g = blank(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = a.palette[fr[y][x]]; g.c[y * n + x] = v ? normHex(v) : null; }
    return { grid: g };
  }

  function sketchGroups(files) {
    const m = new Map();
    (files || []).forEach((f) => {
      const p = parseFile(f.file); if (!p) return;
      let asset = null, error = null, grid = null;
      try { asset = JSON.parse(f.text); } catch (e) { error = '칸 파일을 읽지 못했어요'; }
      if (asset) { const r = fromAsset(asset); if (r.error) error = r.error; else grid = r.grid; }
      if (f.text == null) error = '읽지 못했어요';
      const ver = { v: p.v, date: p.date, file: nfc(f.file), raw: f.file, asset: error ? null : asset, grid, error, t: f.lastModified || 0, name: p.name };
      if (!m.has(p.key)) m.set(p.key, { key: p.key, vers: [] });
      m.get(p.key).vers.push(ver);
    });
    const groups = [...m.values()];
    groups.forEach((g) => {
      g.vers.sort((a, b) => a.v - b.v || a.date.localeCompare(b.date));
      g.name = g.vers[0].name; g.first = g.vers[0];
      g.latest = g.vers[g.vers.length - 1];
      g.show = [...g.vers].reverse().find((x) => !x.error) || g.latest;
    });
    return groups.sort((a, b) => a.first.date.localeCompare(b.first.date) || a.first.t - b.first.t || a.name.localeCompare(b.name, 'ko'));
  }
  const PER_PAGE = 16;
  function sketchPages(groups) { const out = []; for (let i = 0; i < groups.length; i += PER_PAGE) out.push({ type: 'pixel', items: groups.slice(i, i + PER_PAGE), from: i }); return out.length ? out : [{ type: 'pixel', items: [], from: 0, empty: true }]; }
  const fitScale = (n, box) => Math.max(1, Math.floor(box / n));

  const RESAMPLE = { 선: '선', 면: '다수', 사진: '평균' };
  function convParams(o) {
    const p = { src: o.src, cells: +o.cells, colors: +o.colors, outline: o.outline ? '켬' : '끔', background: o.bg ? '가장자리' : '투명', resample: RESAMPLE[o.resample] || '선' };
    if (o.crop) p.crop = [o.crop.x, o.crop.y, o.crop.s, o.crop.s].map((v) => Math.max(0, Math.round(v))).join(',');
    return p;
  }
  function bgRemains(g) {
    const n = g.n; let all = 0, on = 0;
    for (let i = 0; i < n; i++) [[i, 0], [i, n - 1], [0, i], [n - 1, i]].forEach(([x, y]) => { all++; if (g.c[y * n + x]) on++; });
    return on * 2 > all;
  }
  function nameFromSource(rel) {
    const base = nfc(String(rel || '').split('/').pop()).replace(/\.[^.]+$/, '');
    return base.replace(new RegExp('[^0-9A-Za-z' + HANGUL + ' \\-]+', 'g'), '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').trim();
  }

  const api = { GROUPS, PAL, BY_HEX, BY_L, OUTLINE, LETTERS, SCALE_HINT, SIZES, MAX_MINE, KIND, DIR, PER_PAGE, nfc, normHex,
    tidyName, matches, existingName, nextPath, fileName, today, parseFile, lab, nearestOffice, isOffice, rgbOf,
    blank, clone, filled, sameGrid, resize, lostOnResize, flipH, fill, used, toAsset, dumpAsset, checkAsset, fromAsset,
    sketchGroups, sketchPages, fitScale, convParams, bgRemains, nameFromSource, MAX_LEN };
  root.POPixelCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
