(function (root) {
  'use strict';

  function grid(L) {
    const g = [];
    for (let y = 0; y < L.h; y++) {
      g.push([]);
      for (let x = 0; x < L.w; x++) {
        const ch = L.rows[y][x];
        g[y].push(ch === '.' || ch === 'd' ? 'floor' : 'wall');
      }
    }
    L.objects.forEach((o) => {
      if (o.blockAt && Array.isArray(o.block)) {
        o.block.forEach((row, dy) => Array.from(row).forEach((c, dx) => { if (c === 'x') g[o.blockAt[1] + dy][o.blockAt[0] + dx] = o.type; }));
        return;
      }
      for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) if (blocks(o, dx, dy)) g[o.y + dy][o.x + dx] = o.type;
    });
    return g;
  }
  function blocks(o, dx, dy) {
    if (o.block === undefined || o.block === true) return true;
    if (o.block === false) return false;
    if (Array.isArray(o.block)) return !!(o.block[dy] && o.block[dy][dx] === 'x');
    return true;
  }
  function roomAt(L, x, y) { return L.rooms.find((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) || null; }
  function doorAt(L, x, y) { return L.doors.find((d) => d.x === x && d.y === y) || null; }

  function allSpots(L) {
    const s = [];
    L.objects.filter((o) => o.type === 'desk').forEach((o) => s.push({ kind: '책상 자리', x: o.chair.x, y: o.chair.y, owner: o.owner }));
    L.breakSpots.forEach((p) => s.push({ kind: '휴게실 자리', x: p.x, y: p.y, seat: p.seat }));
    L.meetingSpots.forEach((p) => s.push({ kind: '회의실 자리', x: p[0], y: p[1] }));
    s.push({ kind: '토리 자리', x: L.toriHome[0], y: L.toriHome[1] });
    return s;
  }

  function reach(L, blockedExtra) {
    const g = grid(L);
    const blocked = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || g[y][x] !== 'floor' || blockedExtra.has(x + ',' + y);
    const seen = new Set([L.spawn.join(',')]);
    const q = [L.spawn.slice()];
    while (q.length) {
      const [x, y] = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!seen.has(k) && !blocked(nx, ny)) { seen.add(k); q.push([nx, ny]); }
      });
    }
    return seen;
  }

  function check(L, names, measure) {
    const problems = [];
    const spots = allSpots(L);
    const occ = new Set(spots.map((s) => s.x + ',' + s.y));
    const seen = reach(L, occ);
    const near = (x, y, w, h) => {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        for (const [ax, ay] of [[x + dx + 1, y + dy], [x + dx - 1, y + dy], [x + dx, y + dy + 1], [x + dx, y + dy - 1]]) if (seen.has(ax + ',' + ay)) return true;
      }
      return false;
    };
    const targets = [];
    L.objects.filter((o) => ['desk', 'toriDesk', 'tray', 'shelf'].indexOf(o.type) >= 0).forEach((o) => targets.push({ what: o.type + (o.owner ? '(' + o.owner + ')' : '') + ' ' + o.x + ',' + o.y, ok: near(o.x, o.y, o.w, o.h) }));
    spots.forEach((s) => targets.push({ what: s.kind + ' ' + s.x + ',' + s.y, ok: near(s.x, s.y, 1, 1) }));
    L.doors.forEach((d) => targets.push({ what: '문 ' + d.x + ',' + d.y, ok: near(d.x, d.y, 1, 1) }));
    L.rooms.forEach((r) => {
      let ok = false;
      for (let y = r.y1; y <= r.y2 && !ok; y++) for (let x = r.x1; x <= r.x2 && !ok; x++) if (seen.has(x + ',' + y)) ok = true;
      targets.push({ what: '방 ' + r.name, ok });
    });
    targets.filter((t) => !t.ok).forEach((t) => problems.push('닿을 수 없음: ' + t.what));

    const notices = [];
    const T = L.tile;
    const widest = Math.max.apply(null, names.map((n) => measure ? measure(n) : n.length * 5 + 5));
    const boxes = spots.map((s) => ({ s, x1: s.x * T + T / 2 - widest / 2, x2: s.x * T + T / 2 + widest / 2, y1: (s.y + 1) * T + 0.5, y2: (s.y + 1) * T + 7.5 }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) notices.push('이름표 겹칠 수 있음: ' + a.s.kind + ' ' + a.s.x + ',' + a.s.y + ' / ' + b.s.kind + ' ' + b.s.x + ',' + b.s.y);
    }
    boxes.forEach((a) => spots.forEach((s) => {
      if (s === a.s) return;
      const x1 = s.x * T, x2 = x1 + T, y1 = s.y * T - 4, y2 = (s.y + 1) * T;
      if (a.x1 < x2 && x1 < a.x2 && a.y1 < y2 && y1 < a.y2) notices.push('이름표가 사람을 덮을 수 있음: ' + a.s.kind + ' ' + a.s.x + ',' + a.s.y + ' → ' + s.kind + ' ' + s.x + ',' + s.y);
    }));
    if (root.POCore && L.breakSpots && L.breakSpots.length && typeof L.breakSpots[0] === 'object' && !Array.isArray(L.breakSpots[0])) checkSpots(L).forEach((f) => problems.push('휴게실 자리: ' + f));
    return { problems, notices, widest, reachable: seen.size, targets: targets.length };
  }


  const SPR = () => root.POSprites, LNS = () => root.PO_LINES;
  function personSprite(p) {
    const S = SPR(), idle = LNS() && LNS().SPRITE[p.key];
    if (!S || !idle) return { key: null, flip: false, miss: 'none' };
    return S.poseSprite(idle, p.pose || 'idle', p.face || 'down');
  }
  function personBox(p, T) {
    T = T || 16;
    const sp = personSprite(p), S = SPR();
    const sz = (sp.key && S && S.size(sp.key)) || { w: 16, h: 20 };
    const x = p.px != null ? p.px : p.x * T + Math.floor((T - sz.w) / 2);
    const y = p.py != null ? p.py : (p.y + 1) * T - sz.h;
    return { x, y, w: sz.w, h: sz.h, top: sp.key && S ? S.topRow(sp.key) : 1, sprite: sp };
  }
  function markSide(L, p) {
    if (p.pose === 'sit') return 0;
    const x = Math.round(p.x), y = Math.round(p.y) - 1;
    const solid = (tx) => L.objects.some((o) => !o.floor && !o.wall && tx >= o.x && tx < o.x + o.w && y >= o.y && y < o.y + o.h);
    if (!solid(x)) return 0;
    return solid(x + 1) ? -1 : 1;
  }
  const MARK_SIDE_DY = 8;
  function markBox(b, side) {
    const cx = side > 0 ? b.x + b.w + 5 : side < 0 ? b.x - 6 : b.x + b.w / 2;
    const bottom = side ? b.y + MARK_SIDE_DY : b.y + b.top - 2;
    return { x1: Math.round(cx - 3), x2: Math.round(cx - 3) + 7, y1: bottom - 9 - 1, y2: bottom };
  }
  const CHAT_DX = 9, CHAT_DY = -7;
  function chatBox(b) { const x = b.x + CHAT_DX, y = b.y + b.top + CHAT_DY; return { x1: x, x2: x + 9, y1: y - 1, y2: y + 9 }; }
  function tagBox(p, w, T) { T = T || 16; const cx = p.x * T + T / 2; return { x1: cx - w / 2, x2: cx + w / 2, y1: (p.y + 1) * T + 0.5, y2: (p.y + 1) * T + 7.5 }; }
  const hit = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

  function clearTiles(L) {
    const s = new Set();
    L.doors.forEach((d) => {
      s.add(d.x + ',' + d.y);
      const ns = L.rows[d.y][d.x - 1] === '#' && L.rows[d.y][d.x + 1] === '#';
      [-1, 1].forEach((k) => [-1, 0, 1].forEach((m) => s.add(ns ? (d.x + m) + ',' + (d.y + k) : (d.x + k) + ',' + (d.y + m))));
    });
    (L.keepClear || []).forEach((p) => s.add(p[0] + ',' + p[1]));
    return s;
  }

  function checkSpots(L) {
    const C = root.POCore;
    const sp = L.breakSpots, fails = [];
    const kinds = sp.map(C.spotKind);
    const n = (k) => kinds.filter((x) => x === k).length;
    const groups = {}; sp.forEach((s, i) => { if (kinds[i] === 'chat') groups[s.group] = (groups[s.group] || 0) + 1; });
    const lone = sp.filter((s, i) => kinds[i] === 'alone' || kinds[i] === 'coffee');
    if (sp.length < 11) fails.push('1. 합계 ' + sp.length + ' < 11');
    if (n('sofa') < 2) fails.push('1. 소파 자리 ' + n('sofa') + ' < 2');
    if (n('table') !== 4) fails.push('1. 테이블 자리 ' + n('table') + ' ≠ 4');
    if (!Object.keys(groups).length) fails.push('1. 수다 무리 0개');
    Object.keys(groups).forEach((g) => { if (groups[g] < 2 || groups[g] > 3) fails.push('1. 무리 ' + g + ' 자리 ' + groups[g] + '개 (2~3 아님)'); });
    if (lone.length < 3) fails.push('1. 혼자 자리 ' + lone.length + ' < 3');
    if (!lone.some((s) => s.y <= 11)) fails.push('1. y ≤ 11 혼자 자리 0개');
    if (!n('alone')) fails.push('1. 혼자(대기) 0개');
    const g = grid(L), seen = reach(L, new Set()), clear = clearTiles(L);
    sp.forEach((s, i) => {
      const nm = (i + 1) + '번 (' + s.x + ',' + s.y + ')';
      if (s.seat === 'floor') {
        if (!g[s.y] || g[s.y][s.x] !== 'floor') fails.push('2. ' + nm + ' 걸을 수 없는 칸');
        else if (!seen.has(s.x + ',' + s.y)) fails.push('2. ' + nm + ' 아바타가 닿지 못함');
      } else if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((s.x + dx) + ',' + (s.y + dy)))) fails.push('2. ' + nm + ' 맞닿은 칸 중 아바타가 닿는 칸 0');
      if (clear.has(s.x + ',' + s.y)) fails.push('3. ' + nm + ' 문·문 앞·길 칸');
      sp.forEach((t, j) => { if (j > i && t.x === s.x && t.y === s.y) fails.push('4. ' + nm + '과 ' + (j + 1) + '번 칸이 같음'); });
      const face = s.face || 'down';
      if (s.pose === 'coffee' && face !== 'down') fails.push('11. ' + nm + ' coffee인데 face=' + face);
      if ((s.seat === 'sofa' || s.seat === 'chair') && s.pose !== 'sit') fails.push('11. ' + nm + ' seat=' + s.seat + '인데 pose=' + s.pose);
      if (s.group === 'T' && s.seat !== 'chair') fails.push('11. ' + nm + ' group=T인데 seat=' + s.seat);
      if (s.seat === 'floor' && s.pose === 'sit') fails.push('11. ' + nm + ' seat=floor인데 pose=sit');
    });
    return fails;
  }

  function checkCase(L, res, marks, measure, names) {
    const fails = [], notices = [];
    const ppl = Object.keys(res.seats).map((k) => Object.assign({ key: k }, res.seats[k]));
    ppl.forEach((p) => { if (p.x == null || p.y == null || isNaN(p.x) || isNaN(p.y)) fails.push('9. 좌표 없음: ' + p.key); });
    const rows = {};
    ppl.forEach((p) => { if (p.seat === 'floor' && (p.pose === 'idle' || p.pose === 'coffee')) (rows[p.y] = rows[p.y] || []).push(p.x); });
    Object.keys(rows).forEach((y) => {
      const xs = rows[y].sort((a, b) => a - b); if (xs.length < 3) return;
      const gaps = xs.slice(1).map((x, i) => x - xs[i]);
      if (gaps.every((d) => d === gaps[0]) && gaps[0] <= 2) fails.push('6. 일자 서기: y=' + y + ' x=' + xs.join(','));
    });
    ppl.forEach((p) => { if (marks[p.key] === '!' && (p.kind === 'chat' || p.kind === 'table')) fails.push('7. "!" 직원이 무리·테이블: ' + p.key); });
    const cnt = {}; ppl.forEach((p) => { if (p.kind === 'chat' || p.kind === 'table') cnt[p.group] = (cnt[p.group] || 0) + 1; });
    Object.keys(cnt).forEach((g) => { if (cnt[g] === 1) fails.push('8. 무리 ' + g + '에 1명만'); });
    const boxes = ppl.map((p) => ({ p, b: personBox(p) }));
    const mk = boxes.filter((o) => marks[o.p.key]).map((o) => ({ who: o.p.key, r: markBox(o.b, markSide(L, o.p)) }));
    const talkers = {}; boxes.forEach((o) => { if ((o.p.kind === 'chat' || o.p.kind === 'table') && !marks[o.p.key]) (talkers[o.p.group] = talkers[o.p.group] || []).push(o); });
    const icons = []; Object.keys(talkers).forEach((g) => { if (talkers[g].length + ppl.filter((p) => p.group === g && marks[p.key]).length >= 2) talkers[g].forEach((o) => icons.push({ who: o.p.key, g, r: chatBox(o.b) })); });
    for (let i = 0; i < mk.length; i++) for (let j = i + 1; j < mk.length; j++) if (hit(mk[i].r, mk[j].r)) fails.push('5. 표시끼리 겹침: ' + mk[i].who + ' / ' + mk[j].who);
    mk.forEach((m) => icons.forEach((c) => { if (hit(m.r, c.r)) fails.push('5. 표시·수다 아이콘 겹침: ' + m.who + ' / ' + c.who); }));
    for (let i = 0; i < icons.length; i++) for (let j = i + 1; j < icons.length; j++) if (icons[i].g !== icons[j].g && hit(icons[i].r, icons[j].r)) fails.push('5. 다른 무리 수다 아이콘끼리 겹침: ' + icons[i].who + ' / ' + icons[j].who);
    const tags = ppl.map((p) => ({ who: p.key, r: tagBox(p, measure((names && names[p.key]) || p.key)) }));
    for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) if (hit(tags[i].r, tags[j].r)) notices.push('5① 이름표끼리 겹침: ' + tags[i].who + ' / ' + tags[j].who);
    tags.forEach((t) => boxes.forEach((o) => { if (o.p.key !== t.who && hit(t.r, { x1: o.b.x, x2: o.b.x + o.b.w, y1: o.b.y + o.b.top, y2: o.b.y + o.b.top + 12 })) notices.push('5② 이름표가 얼굴을 가림: ' + t.who + ' → ' + o.p.key); }));
    tags.forEach((t) => mk.forEach((m) => { if (hit(t.r, m.r)) notices.push('5③ 표시가 이름표에 가림: ' + m.who + ' (' + t.who + ' 이름표)'); }));
    tags.forEach((t) => { if (t.r.x1 < 0 || t.r.y1 < 0 || t.r.x2 > L.w * L.tile || t.r.y2 > L.h * L.tile) notices.push('5④ 이름표가 캔버스 밖: ' + t.who); });
    return { fails, notices: notices.concat(res.notices || []), warnings: res.warnings || [] };
  }

  function checkBreak(L, opts) {
    const C = root.POCore;
    const t0 = Date.now();
    const keys = opts.keys, names = opts.names || {}, measure = opts.measure || ((n) => String(n).length * 5 + 5);
    const out = { spotFails: checkSpots(L), fails: {}, notices: {}, warnings: {}, cases: 0, assigns: 0 };
    const add = (bag, msgs, label) => msgs.forEach((m) => { if (!bag[m]) bag[m] = { n: 0, first: label }; bag[m].n++; });
    const fallback = C.firstFreeTile(L, 'break');
    for (let mask = 1; mask < (1 << keys.length); mask++) {
      const inRoom = keys.filter((k, i) => mask & (1 << i));
      const exSets = [[]];
      inRoom.forEach((a, i) => { exSets.push([a]); inRoom.slice(i + 1).forEach((b) => exSets.push([a, b])); });
      for (const ex of exSets) {
        for (const seed of opts.seeds) {
          const people = inRoom.map((k) => ({ key: k, name: names[k] || k, mark: ex.indexOf(k) >= 0 ? '!' : '' }));
          const res = C.assignBreak(L.breakSpots, people, { seed, fallback, sofaMidPx: L.SOFA_MID_PX });
          out.assigns++;
          const label = '휴게실 [' + inRoom.map((k) => names[k] || k).join(',') + '] "!" [' + ex.map((k) => names[k] || k).join(',') + '] 씨앗 ' + seed;
          [['가', (k) => ex.indexOf(k) >= 0 ? '!' : ''], ['나', (k) => ex.indexOf(k) >= 0 ? '!' : '?']].forEach(([tag, mf]) => {
            const marks = {}; inRoom.forEach((k) => { marks[k] = mf(k); });
            const r = checkCase(L, res, marks, measure, names);
            out.cases++;
            add(out.fails, r.fails, label + ' (' + tag + ')'); add(out.notices, r.notices, label + ' (' + tag + ')'); add(out.warnings, r.warnings, label);
          });
          if (opts.limit && out.assigns >= opts.limit) { out.ms = Date.now() - t0; return out; }
        }
      }
    }
    out.ms = Date.now() - t0;
    return out;
  }

  root.POLayoutCheck = { grid, blocks, roomAt, doorAt, check, allSpots, reach, clearTiles, checkSpots, checkCase, checkBreak, personSprite, personBox, markBox, markSide, MARK_SIDE_DY, chatBox, tagBox, CHAT_DX, CHAT_DY };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.POLayoutCheck;
})(typeof window !== 'undefined' ? window : globalThis);
