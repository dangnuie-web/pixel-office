(function (root) {
  'use strict';

  const ALIASES = { '실장': '토리', '바나': '바나 쌤' };
  const OWNER = '당니님';
  const STATUS = { '시작': '시작', '완료': '완료', '대기': '대기', '멈춤': '멈춤', '진행중': '시작', '보류': '멈춤' };
  const DAY_START_MIN = 5 * 60;
  const WORK_WINDOW_MIN = 120;
  const MEMO_MAX = 16;
  const TF_ENABLED = false;

  const REC_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) \| /;
  const ROSTER_RE = /^- (.+?)(?: \(([a-z-]+)\))?: (.+?)\((.+?)\)\./;
  const BRIEF_NAME_RE = /^(\d{8})_DailyBrief\.md$/;

  function toMin(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi) / 60000; }
  function nowMin(date) {
    const t = date || new Date();
    return toMin(t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes());
  }
  function parseMinStr(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(s).trim());
    return m ? toMin(+m[1], +m[2], +m[3], +m[4], +m[5]) : null;
  }
  function fmtMin(t) {
    const d = new Date(t * 60000).toISOString();
    return d.slice(0, 10) + ' ' + d.slice(11, 16);
  }
  function businessDay(t) {
    return new Date((t - DAY_START_MIN) * 60000).toISOString().slice(0, 10);
  }
  function isDawn(t) { const h = new Date(t * 60000).getUTCHours(); return h < 5; }
  function ymdToMD(ymd) {
    if (!ymd) return '없음';
    return (+ymd.slice(4, 6)) + '월 ' + (+ymd.slice(6, 8)) + '일';
  }

  function hasBatchim(word) {
    const s = String(word).trim();
    const c = s.charCodeAt(s.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0;
    return false;
  }
  function josa(word, withB, withoutB) { return word + (hasBatchim(word) ? withB : withoutB); }
  function cut(s, n) { const a = Array.from(String(s)); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); }
  function joinNames(names) {
    if (names.length <= 3) return names.join(', ');
    return names.slice(0, 3).join(', ') + ' 외 ' + (names.length - 3) + '명';
  }

  const PUBLIC_STAFF = [
    { id: 'squirrel', animal: '다람쥐', char: '토리', job: '비서' }, { id: 'owl', animal: '부엉이', char: 'scenario-writer', job: '작가' },
    { id: 'chameleon', animal: '카멜레온', char: 'designer', job: '디자이너' }, { id: 'penguin', animal: '펭귄', char: 'developer', job: '개발자' },
    { id: 'duck', animal: '오리', char: 'organizer', job: '정리 담당' }, { id: 'hedgehog', animal: '고슴도치', char: 'critic', job: '검토' },
    { id: 'beaver', animal: '비버', char: 'planner', job: '기획' },
  ];
  const PUBLIC_DROPPED = [{ id: 'monkey', animal: '원숭이' }, { id: 'sheep', animal: '양' }];
  const PUBLIC_GUIDE = PUBLIC_STAFF[0];
  const isPublic = () => root.PO_PUBLIC === true;
  function charOf(s) {
    const key = s && typeof s === 'object' ? s.key : s;
    if (!isPublic()) return key;
    const p = PUBLIC_STAFF.find((x) => x.id === key) || (s && typeof s === 'object' && PUBLIC_STAFF.find((x) => x.animal === s.animal));
    return p ? p.char : key;
  }
  function isGuide(s) { return isPublic() ? charOf(s) === '토리' : s.name === '토리'; }
  function assignDesks(layout, staff) {
    const desks = ((layout && layout.objects) || []).filter((o) => o.type === 'desk');
    desks.forEach((d) => { if (!Object.prototype.hasOwnProperty.call(d, 'fixedOwner')) d.fixedOwner = d.owner; });
    if (!isPublic()) { desks.forEach((d) => { d.owner = d.fixedOwner; }); return; }
    const who = (staff || []).filter((s) => !isGuide(s));
    desks.forEach((d, i) => { d.owner = who[i] ? who[i].key : null; });
  }

  function parseRoster(text) { const r = readRoster(text); return isPublic() ? publicRoster(r) : r; }
  function publicRoster(r) {
    const seen = {}, dropped = [];
    const staff = r.staff.filter((s) => {
      const gone = PUBLIC_DROPPED.find((x) => x.id === s.id || x.animal === s.animal);
      const p = !gone && (PUBLIC_STAFF.find((x) => x.id === s.id) || PUBLIC_STAFF.find((x) => x.animal === s.animal));
      if (gone || (p && seen[p.id])) { dropped.push(s.name); return false; }
      if (p) seen[p.id] = true;
      return true;
    }).map((s) => {
      const p = PUBLIC_STAFF.find((x) => x.id === s.id) || PUBLIC_STAFF.find((x) => x.animal === s.animal);
      return p ? Object.assign({}, s, { role: p.job }) : s;
    });
    if (!seen[PUBLIC_GUIDE.id]) {
      const g = PUBLIC_GUIDE;
      staff.unshift({ name: g.job, id: g.id, role: g.job, animal: g.animal, key: g.id, order: 0, auto: true });
    }
    staff.forEach((s, i) => { s.order = i; });
    return Object.assign({}, r, { staff, dropped });
  }
  function readRoster(text) {
    const lines = String(text).split(/\r?\n/);
    const staff = []; const warnings = [];
    let i = lines.findIndex((l) => /^## 직원 명부/.test(l));
    if (i < 0) return { staff, warnings: ['"## 직원 명부" 절을 찾지 못함'] };
    for (i = i + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^## /.test(l)) break;
      if (!/^- /.test(l)) continue;
      const m = ROSTER_RE.exec(l);
      if (!m) { warnings.push(l); continue; }
      const id = m[2] || '';
      staff.push({ name: m[1].trim(), id, role: m[3].trim(), animal: m[4].trim(), key: id || m[1].trim(), order: staff.length });
    }
    return { staff, warnings };
  }

  function parseProgress(sources) {
    const records = []; const unreadable = []; let seq = 0; let headerFound = false;
    sources.forEach((src) => {
      const lines = String(src.text).split(/\r?\n/);
      let start = 0;
      if (src.tag === 'main') {
        const h = lines.findIndex((l) => /^## 기록/.test(l));
        if (h < 0) return;
        headerFound = true;
        start = h + 1;
      }
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const label = src.tag === 'main' ? (i + 1) + '줄' : '부록 ' + (i + 1);
        if (raw.trim() === '') continue;
        const m = REC_RE.exec(raw);
        if (i < start && !m) continue;
        if (!m) { unreadable.push({ label, raw, why: '기록 줄 형식 아님' }); continue; }
        const cells = raw.split(' | ');
        if (cells.length <= 4) { unreadable.push({ label, raw, why: '칸 ' + cells.length + '개' }); continue; }
        let memo, file;
        if (cells.length === 5) { memo = cells[4]; file = ''; }
        else { memo = cells.slice(4, cells.length - 1).join(' | '); file = cells[cells.length - 1]; }
        const statusWord = cells[3].trim();
        const status = STATUS[statusWord];
        if (!status) { unreadable.push({ label, raw, why: '모르는 상태 "' + statusWord + '"' }); continue; }
        const names = cells[2].trim().split('·').map((p) => {
          const piece = p.trim();
          const k = piece.indexOf('(');
          const nm = (k >= 0 ? piece.slice(0, k) : piece).trim();
          return ALIASES[nm] || nm;
        }).filter((x) => x);
        const t = toMin(+m[1], +m[2], +m[3], +m[4], +m[5]);
        records.push({
          seq: seq++, label, src: src.tag, raw, t, time: fmtMin(t), bday: businessDay(t),
          project: cells[1].trim(), who: cells[2].trim(), names, status, statusWord,
          memo: memo.trim(), file: file.trim(),
        });
      }
    });
    return { records, unreadable, headerFound };
  }

  function sortRecent(records) {
    return records.slice().sort((a, b) => (b.t - a.t) || (a.seq - b.seq));
  }

  function findLatestBrief(names) {
    let best = null;
    names.forEach((n) => { const m = BRIEF_NAME_RE.exec(n); if (m && (!best || m[1] > best.date)) best = { name: n, date: m[1] }; });
    return best;
  }

  const CHECK_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX]|✅|✔️?|☑️?|✓)\]\s?(.*)$/;
  const OWNER_FIXED = ['당니님', '당니'];
  function ownerWords(names) {
    const out = root.PO_PUBLIC === true ? [] : OWNER_FIXED.slice();
    try {
      const N = root.PONames;
      if (N && N.values) { const v = N.values(); [v.bossCall, v.boss].forEach((w) => { if (w && out.indexOf(w) < 0) out.push(w); }); }
    } catch (e) {  }
    if (out.indexOf('대표') < 0) out.push('대표');
    const nm = names || [];
    return out.filter((w) => nm.indexOf(w) < 0).sort((a, b) => b.length - a.length);
  }
  const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ITEM_SHORT = 28;
  function topOpenItem(text) {
    const lines = String(text || '').split(/\r?\n/);
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      const f = lines[i].match(/^\s*(`{3,}|~{3,})/);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
      if (fence) continue;
      const m = CHECK_RE.exec(lines[i]);
      if (m && m[1] === ' ') return { line: i + 1, text: m[2].trim() };
    }
    return null;
  }
  function ownerMatch(src) {
    const re = /담당\s*[:：]\s*/g; let m;
    while ((m = re.exec(src))) { if (!/["“”'‘’`「『]/.test(src.charAt(m.index - 1))) return m; }
    return null;
  }
  function parseOwners(itemText, names) {
    const src = String(itemText || '').replace(/\*\*|__/g, '');
    const m = ownerMatch(src);
    if (!m) return null;
    let rest = src.slice(m.index + m[0].length);
    const OW = ownerWords(names);
    const known = names.concat(Object.keys(ALIASES), OW).sort((a, b) => b.length - a.length);
    const out = { names: [], owner: false, unknown: [] };
    for (let guard = 0; guard < 10 && rest; guard++) {
      rest = rest.replace(/^\s+/, '');
      const hit = known.find((n) => rest.startsWith(n) && !/^[\p{L}\p{N}_-]/u.test(rest.slice(n.length)));
      let word;
      if (hit) word = hit;
      else { const w = /^[^\s()（）·,，/;:：—–.]+/.exec(rest); if (!w) break; word = w[0]; }
      rest = rest.slice(word.length).replace(/^\s*[(（][^)）]*[)）]/, '');
      const nm = ALIASES[word] || word;
      if (OW.indexOf(nm) >= 0) out.owner = true;
      else if (names.indexOf(nm) >= 0) { if (out.names.indexOf(nm) < 0) out.names.push(nm); }
      else out.unknown.push(word);
      const sep = /^\s*[·,，/]\s*/.exec(rest);
      if (!sep) break;
      rest = rest.slice(sep[0].length);
    }
    return out;
  }
  function itemShort(itemText, n) {
    const all = String(itemText || '').replace(/\*\*|__|`/g, '').trim();
    let s = all;
    const om = ownerMatch(s);
    if (om && om.index > 0) s = s.slice(0, om.index);
    s = s.replace(/[\s—–\-·.,(（]+$/, '').trim() || all;
    return cut(s, n || ITEM_SHORT);
  }
  function roadmapSeats(roadmaps, names) {
    const res = { cells: [], byName: {}, ownerTurn: [], unknown: [], skipped: [] };
    (roadmaps || []).forEach((r) => {
      if (r.text == null) { res.skipped.push({ project: r.project, why: '로드맵 없음' }); return; }
      const top = topOpenItem(r.text);
      if (!top) { res.skipped.push({ project: r.project, why: '미체크 칸 없음' }); return; }
      const o = parseOwners(top.text, names);
      const cell = { project: r.project, item: top.text, short: itemShort(top.text), line: top.line, owners: o ? o.names : [], owner: !o || o.owner, unknown: o ? o.unknown : [] };
      cell.owners.forEach((n) => { (res.byName[n] = res.byName[n] || []).push(cell); });
      if (cell.owner) res.ownerTurn.push(cell);
      cell.unknown.forEach((n) => res.unknown.push({ name: n, project: r.project }));
      res.cells.push(cell);
    });
    return res;
  }

  const PLAN_KEY_LEN = 40;
  const STAGE_RE = /^##\s*(\d+)\s*단계\s*[—–-]\s*(.+)$/;
  const FENCE_RE = /^\s*(`{3,}|~{3,})/;
  const LOOSE_BOX_RE = /^\s*(?:[-*+]|\d+[.)])\s*\[[^\]]{0,3}\]/;
  const DATE_TAIL_RE = /\s*\(\d{4}-\d{2}-\d{2} 당니님\)\s*$/;
  const DATE_TAIL_PUB_RE = /\s*\(\d{4}-\d{2}-\d{2}\)\s*$/;
  const dateTailRe = () => (isPublic() ? DATE_TAIL_PUB_RE : DATE_TAIL_RE);
  const dateTail = (day) => ' (' + day + (isPublic() ? '' : ' 당니님') + ')';

  function cellOf(line) {
    const m = CHECK_RE.exec(String(line));
    if (!m) return null;
    const lead = /^[ \t]*/.exec(line)[0];
    return { indent: lead.replace(/\t/g, '    ').length, mark: m[1], done: m[1] !== ' ', text: m[2].trim() };
  }
  function isPlaceholder(text) {
    const s = String(text || '').replace(/\*\*|__/g, '').trim();
    return s === '' || /^[(（][^()（）]*[)）]$/.test(s);
  }
  function parseStageTitle(line) {
    const m = STAGE_RE.exec(String(line).trim());
    if (!m) return null;
    let name = m[2], now = false;
    if (/←\s*지금/.test(name)) { now = true; name = name.replace(/\s*←\s*지금.*$/, ''); }
    for (let g = 0; g < 5 && /\s*[(（][^()（）]*[)）]\s*$/.test(name); g++) name = name.replace(/\s*[(（][^()（）]*[)）]\s*$/, '');
    name = name.replace(/\*\*|__/g, '').trim() || m[2].trim();
    return { n: +m[1], name, label: m[1] + '단계 · ' + name, now };
  }
  function sectionKind(title) {
    const t = String(title || '').replace(/\*\*|__/g, '').trim();
    if (/^정할\s*것/.test(t)) return 'decide';
    if (/^나중에\s*할\s*일/.test(t)) return 'later';
    return 'other';
  }
  function planKey(text) {
    const s = String(text || '').replace(dateTailRe(), '').replace(/\s+/g, ' ').trim();
    return Array.from(s).slice(0, PLAN_KEY_LEN).join('').replace(/--/g, '- -').trim();
  }
  function dangneeKind(cell, owners) {
    const ow = ownerWords().map(reEsc).join('|');
    if (cell.group && new RegExp('^(?:' + ow + ')(?:이|가)\\s*할\\s*일').test(cell.group)) return 'group';
    if (cell.sectionKind === 'decide' || (cell.group && /^정할\s*것/.test(cell.group))) return 'decide';
    if (owners && owners.first === '당니님') return 'owner';
    if (!owners && new RegExp('[—–]\\s*(?:' + ow + ')(\\s*결정)?\\s*$').test(String(cell.text).replace(/\*\*|__/g, '').trim())) return 'tail';
    return null;
  }
  function firstOwnerWord(itemText) {
    const src = String(itemText || '').replace(/\*\*|__/g, '');
    const m = ownerMatch(src);
    if (!m) return null;
    const rest = src.slice(m.index + m[0].length).replace(/^\s+/, '');
    const w = ownerWords().find((n) => rest.startsWith(n) && !/^[\p{L}\p{N}_]/u.test(rest.slice(n.length)));
    return w ? '당니님' : 'other';
  }

  function parseRoadmapCells(text, names) {
    names = names || [];
    const lines = String(text || '').split(/\r?\n/);
    const out = { goal: '', planLine: null, sections: [], cells: [], placeholders: [], unread: [], done: 0, total: 0 };
    let fence = null, sec = -1, group = null, goalNext = false;
    const stack = [];
    const secKind = () => (sec < 0 ? 'top' : out.sections[sec].kind);
    for (let k = 0; k < lines.length; k++) {
      const line = lines[k], no = k + 1;
      const f = line.match(FENCE_RE);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
      if (fence) continue;
      const t = line.trim();
      const hm = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(t);
      if (hm) {
        group = null; stack.length = 0;
        if (hm[1] === '##') {
          const st = parseStageTitle(t);
          const title = hm[2].replace(/\*\*|__/g, '').trim();
          if (!st && /^\d+\s*단계/.test(title)) out.unread.push({ line: no, text: t, why: '단계 제목 모양이 아님 (## N단계 — 이름)' });
          out.sections.push(st ? { title, kind: 'stage', stage: st.n, label: st.label, now: st.now, line: no } : { title, kind: sectionKind(title), stage: null, label: title, now: false, line: no });
          sec = out.sections.length - 1;
        }
        if (!out.goal && /^(\*\*)?한\s*줄\s*목표(\*\*)?\s*[:：]?$/.test(hm[2])) goalNext = true;
        continue;
      }
      if (goalNext && t && !out.goal) { out.goal = t.replace(/^(?:[-*+>]\s+)?/, '').replace(/^(\*\*|__)\s*/, '').replace(/\s*(\*\*|__)$/, '').trim(); goalNext = false; continue; }
      if (sec < 0) {
        const plain = t.replace(/^(?:[-*+>]\s+)?/, '');
        const g = plain.match(/^(?:\*\*|__)?\s*한\s*줄\s*목표\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/);
        if (g && g[1].trim() && !out.goal) out.goal = g[1].replace(/\s*(\*\*|__)$/, '').trim();
        const p = plain.match(/^(?:\*\*|__)?\s*계획서\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*)$/);
        if (p && out.planLine == null) out.planLine = p[1].trim();
      }
      if (/^(\*\*|__)/.test(t)) {
        const g = /^(?:\*\*|__)(.+?)(?:\*\*|__)/.exec(t);
        group = g ? g[1].replace(/[:：]\s*$/, '').trim() : null;
        stack.length = 0;
        if (!CHECK_RE.test(line)) continue;
      }
      if (/^여기까지\s*하면\s*[:：]/.test(t)) { group = null; continue; }
      const c = cellOf(line);
      if (!c) { if (LOOSE_BOX_RE.test(line)) out.unread.push({ line: no, text: t, why: '칸 모양이 아님 (- [ ] 글)' }); continue; }
      if (isPlaceholder(c.text)) { out.placeholders.push({ line: no, text: c.text }); continue; }
      out.total++; if (c.done) out.done++;
      while (stack.length && stack[stack.length - 1].indent >= c.indent) stack.pop();
      const parent = c.indent >= 2 && stack.length ? stack[stack.length - 1].i : null;
      const o = parseOwners(c.text, names);
      const sObj = sec >= 0 ? out.sections[sec] : null;
      const cell = {
        i: out.cells.length, line: no, indent: c.indent, mark: c.mark, done: c.done, text: c.text, short: itemShort(c.text), key: planKey(c.text),
        section: sec, sectionKind: secKind(), label: sObj ? sObj.label : '', group,
        parent, owners: o ? o.names : [], ownerUnknown: o ? o.unknown : [], hasOwner: !!o, dangnee: null,
      };
      cell.dangnee = dangneeKind(cell, o ? { first: firstOwnerWord(c.text) } : null);
      out.cells.push(cell);
      stack.push({ indent: c.indent, i: cell.i });
    }
    return out;
  }
  function cellLabel(parsed, cell, n) {
    if (cell.parent == null) return cell.short;
    const p = parsed.cells[cell.parent];
    return itemShort(p.text, 14) + ' › ' + itemShort(cell.text, n || ITEM_SHORT);
  }

  function roadmapNow(parsed) {
    const open = parsed.cells.filter((c) => !c.done);
    const laterOpen = open.filter((c) => c.sectionKind === 'later').length;
    const res = { state: 'done', cell: null, stageLabel: '', owners: [], ownerTurn: false, progress: { done: parsed.done, total: parsed.total }, stageProgress: { open: 0, total: 0 }, laterOpen };
    if (!parsed.total) { res.state = 'empty'; return res; }
    const cur = open.find((c) => c.sectionKind !== 'later');
    if (!cur) {
      if (laterOpen) { res.state = 'later'; res.stageLabel = '단계 끝 · 나중에 할 일 ' + laterOpen + '개'; }
      return res;
    }
    res.state = 'now'; res.cell = cur;
    res.stageLabel = cur.section < 0 ? '' : cur.sectionKind === 'decide' ? '정할 것' : cur.label;
    const inSec = parsed.cells.filter((c) => c.section === cur.section);
    res.stageProgress = { open: inSec.filter((c) => !c.done).length, total: inSec.length };
    res.owners = cur.owners;
    res.ownerTurn = !cur.hasOwner || firstOwnerWord(cur.text) === '당니님';
    return res;
  }

  function planPathOf(planLine, projectDir) {
    if (planLine == null) return { path: projectDir + '/계획서.md', why: '' };
    const first = String(planLine).trim().split(/[\s(（]/)[0].replace(/[,;]+$/, '');
    if (!first || /^없음/.test(first) || !/\.md$/i.test(first)) return { path: null, why: '계획서 없음' };
    if (/^10_프로젝트\//.test(first)) return { path: first, why: '' };
    const rel = first.replace(/^\.\//, '');
    if (rel.split('/').some((s) => s === '..' || s === '')) return { path: null, why: '계획서 없음' };
    return { path: projectDir + '/' + rel, why: '' };
  }
  function planGoalOf(text) {
    const lines = String(text || '').split(/\r?\n/);
    let inGoal = false, comment = false, fence = null;
    for (const raw of lines) {
      const t = raw.trim();
      const f = raw.match(FENCE_RE);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
      if (fence) continue;
      if (/^#/.test(t)) { if (inGoal) return ''; inGoal = /^##(?!#)\s*(\*\*)?목표(\*\*)?\s*([(（:：].*)?$/.test(t); continue; }
      if (!inGoal) continue;
      if (comment) { if (t.includes('-->')) comment = false; continue; }
      if (t.startsWith('<!--')) { if (!t.includes('-->')) comment = true; continue; }
      let s = t.replace(/<!--.*?-->/g, '').trim();
      if (!s) continue;
      s = s.replace(/^(?:[-*+]|\d+[.)])\s+/, '').trim();
      if (!s || /^[(（]/.test(s)) continue;
      return s.replace(/^(\*\*|__)(.*)(\*\*|__)$/, '$2').trim();
    }
    return '';
  }

  function suggestionOf(p, c, why) {
    const sec = c.section >= 0 ? p.parsed.sections[c.section] : null;
    return {
      project: p.project, line: c.line, text: c.text, short: c.short, label: cellLabel(p.parsed, c), key: c.key, dangnee: c.dangnee,
      stageLabel: sec ? (sec.kind === 'decide' ? '정할 것' : sec.label) : '', owners: c.owners, why,
      todoLine: planTodoLine(c.short, p.project, c.key),
    };
  }
  function inTodo(todoKeys, project, c) {
    return (todoKeys || []).some((t) => t.project === project && ((t.key && t.key === c.key) || (!t.key && t.text && (t.text === c.short || t.text === c.text))));
  }
  function suggestInitial(projects, todoKeys) {
    const dn = [], top = [];
    (projects || []).forEach((p) => {
      if (!p.parsed) return;
      const now = roadmapNow(p.parsed);
      if (now.state !== 'now') return;
      const upto = now.cell.section;
      const seen = new Set();
      p.parsed.cells.forEach((c) => {
        if (c.done || !c.dangnee || c.sectionKind === 'later' || c.section > upto) return;
        if (inTodo(todoKeys, p.project, c)) return;
        dn.push(suggestionOf(p, c, 'dangnee')); seen.add(c.i);
      });
      if (!seen.has(now.cell.i) && !inTodo(todoKeys, p.project, now.cell)) top.push(suggestionOf(p, now.cell, 'top'));
    });
    return dn.concat(top);
  }
  function normFind(s) { return String(s || '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function suggestSearch(projects, query, todoKeys, limit) {
    const q = normFind(query);
    if (!q) return suggestInitial(projects, todoKeys);
    const dn = [], rest = [];
    (projects || []).forEach((p) => {
      if (!p.parsed) return;
      p.parsed.cells.forEach((c) => {
        if (c.done || normFind(c.text).indexOf(q) < 0 || inTodo(todoKeys, p.project, c)) return;
        (c.dangnee ? dn : rest).push(suggestionOf(p, c, 'search'));
      });
    });
    const all = dn.concat(rest);
    return limit ? all.slice(0, limit) : all;
  }
  function planTodoLine(short, project, key) {
    return '- [ ] ' + String(short).replace(/\s+/g, ' ').trim() + (project ? ' (' + project + ')' : '') + (key ? ' <!-- 로드맵: ' + key + ' -->' : '');
  }

  const ROADMAP_MISS = '로드맵 칸을 못 찾았어요(직접 체크해 주세요)';
  function roadmapMark(text) {
    let ok = 0, x = 0, fence = null;
    String(text || '').split(/\r?\n/).forEach((l) => {
      const f = l.match(FENCE_RE);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; return; }
      if (fence) return;
      const c = cellOf(l); if (!c) return;
      if (c.mark === '✅') ok++; else if (c.mark === 'x' || c.mark === 'X') x++;
    });
    return ok > x ? '✅' : 'x';
  }
  function checkRoadmapCell(text, key, day) {
    const src = String(text || '');
    const nl = /\r\n/.test(src) ? '\r\n' : '\n';
    const lines = src.split(/\r?\n/);
    const hits = [];
    let fence = null;
    for (let k = 0; k < lines.length; k++) {
      const f = lines[k].match(FENCE_RE);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
      if (fence) continue;
      const c = cellOf(lines[k]);
      if (c && key && planKey(c.text) === key) hits.push({ k, c });
    }
    if (hits.length !== 1) return { ok: false, why: hits.length ? 'many' : 'notFound', count: hits.length, message: ROADMAP_MISS };
    const { k, c } = hits[0];
    if (c.done) return { ok: false, why: 'done', count: 1, message: '로드맵 칸이 이미 끝나 있어요' };
    const mark = roadmapMark(src);
    const m = /^(\s*(?:[-*+]|\d+[.)])\s+\[) (\].*?)(\s*)$/.exec(lines[k]);
    lines[k] = m[1] + mark + m[2] + dateTail(day);
    return { ok: true, text: lines.join(nl), line: k + 1, mark };
  }
  function isCheckOnlyChange(oldText, newText) {
    const a = String(oldText == null ? '' : oldText).split(/\r?\n/), b = String(newText == null ? '' : newText).split(/\r?\n/);
    if (a.length !== b.length) return false;
    let diff = -1;
    for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) { if (diff >= 0) return false; diff = k; }
    if (diff < 0) return false;
    const m = /^(\s*(?:[-*+]|\d+[.)])\s+\[) (\].*?)\s*$/.exec(a[diff]);
    if (!m) return false;
    return ['x', '✅'].some((mk) => {
      const base = m[1] + mk + m[2];
      return b[diff] === base || (b[diff].startsWith(base) && (isPublic() ? /^ \(\d{4}-\d{2}-\d{2}\)$/ : /^ \(\d{4}-\d{2}-\d{2} 당니님\)$/).test(b[diff].slice(base.length)));
    });
  }

  const POSTIT_TITLE_MAX = 32;
  function textWidth(s) { let w = 0; for (const ch of String(s)) { const c = ch.codePointAt(0); w += c >= 0x20 && c <= 0x7e ? 1 : 2; } return w; }
  const nonSpaceLen = (s) => Array.from(String(s).replace(/\s+/g, '')).length;
  function postitTitle(idea, max) {
    max = max || POSTIT_TITLE_MAX;
    let s = String(idea == null ? '' : idea).replace(/\\\|/g, '|').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
    if (!s) return '(빈 아이디어)';
    const MARKS = [/[(\[]/g, /:(?=\s)/g, /[—–]| - /g, /,/g, / \+ /g];
    for (let guard = 0; guard < 5; guard++) {
      const hits = [];
      MARKS.forEach((re, mi) => { re.lastIndex = 0; let m; while ((m = re.exec(s))) hits.push({ i: m.index, len: m[0].length, colon: mi === 1 }); });
      hits.sort((a, b) => a.i - b.i);
      let cut = null, again = false;
      for (const h of hits) {
        const head = s.slice(0, h.i);
        if (h.colon && nonSpaceLen(head) <= 3) { s = s.slice(h.i + h.len).trim(); again = true; break; }
        if (nonSpaceLen(head) < 2) continue;
        cut = head; break;
      }
      if (again) { if (!s) return '(빈 아이디어)'; continue; }
      if (cut != null) s = cut.replace(/[\s.·-]+$/, '');
      break;
    }
    if (textWidth(s) <= max) return s;
    const chars = Array.from(s);
    let keep = [], w = 0;
    for (const ch of chars) { const cw = textWidth(ch); if (w + cw > max - 2) break; keep.push(ch); w += cw; }
    const kept = keep.join('');
    const sp = kept.lastIndexOf(' ');
    let out = kept;
    if (sp > 0 && textWidth(kept.slice(0, sp)) >= max / 2) out = kept.slice(0, sp);
    return out.replace(/[\s.,·:;\-—–+]+$/, '') + '…';
  }

  function compute(input) {
    const base = input.base;
    const baseBD = businessDay(base);
    const roster = parseRoster(input.rosterText);
    const hasRecords = Array.isArray(input.progressSources) && input.progressSources.length > 0;
    const hasRoadmaps = !hasRecords && Array.isArray(input.roadmaps);
    const source = hasRecords ? 'records' : hasRoadmaps ? 'roadmap' : 'none';
    const rm = hasRoadmaps ? roadmapSeats(input.roadmaps, roster.staff.map((s) => s.name)) : null;
    const prog = parseProgress(input.progressSources || []);
    const all = sortRecent(prog.records);
    const future = all.filter((r) => r.t > base);
    const recs = all.filter((r) => r.t <= base);

    const byName = {}; roster.staff.forEach((s) => { byName[s.name] = s; });
    const unknownNames = [];
    recs.forEach((r) => r.names.forEach((n) => { if (n !== OWNER && !byName[n]) unknownNames.push({ name: n, label: r.label }); }));
    if (rm) rm.unknown.forEach((u) => unknownNames.push({ name: u.name, label: u.project + ' 로드맵' }));

    assignDesks(input.layout, roster.staff);
    const deskOwners = {};
    ((input.layout && input.layout.objects) || []).forEach((o) => { if (o.type === 'desk' && o.owner) deskOwners[o.owner] = o; });

    const staff = roster.staff.map((s) => {
      const mine = recs.filter((r) => r.names.indexOf(s.name) >= 0);
      const latest = mine[0] || null;
      const todayDone = mine.filter((r) => r.status === '완료' && r.bday === baseBD);
      const isTori = isGuide(s);
      const cells = rm ? (rm.byName[s.name] || []) : [];
      let loc = 'break', mark = '', why = hasRecords ? '기록 없음' : rm ? '맡은 칸 없음' : '위치 원천 없음';
      if (isTori) { loc = 'avatar'; why = '계산 안 함(아바타 곁)'; }
      else if (rm) { if (cells.length) { loc = 'desk'; why = '로드맵 맨 위 칸 ' + cells.length + '개'; } }
      else if (latest) {
        const today = latest.bday === baseBD;
        const age = base - latest.t;
        if (latest.status === '완료' || latest.status === '대기') { loc = 'break'; why = latest.status; }
        else if (latest.status === '멈춤') { loc = 'break'; mark = today ? '!' : ''; why = today ? '멈춤, 오늘' : '멈춤, 오늘 이전'; }
        else if (latest.status === '시작') {
          if (TF_ENABLED && /^\[TF\]/.test(latest.memo) && age <= WORK_WINDOW_MIN) { loc = 'meeting'; why = '시작 [TF], 2시간 이내'; }
          else if (age <= WORK_WINDOW_MIN) { loc = 'desk'; why = '시작, 2시간 이내'; }
          else if (today) { loc = 'desk'; mark = '?'; why = '시작, 2시간 넘음, 오늘'; }
          else { loc = 'break'; mark = '?'; why = '시작, 오늘 이전'; }
        }
      }
      const hasDesk = !!deskOwners[s.key];
      let place = loc;
      if (!isTori && (loc === 'desk') && !hasDesk) place = 'break';
      const lastStart = mine.find((r) => r.status === '시작') || null;
      return Object.assign({}, s, { isTori, latest, lastStart, todayDone, loc, place, mark, why, hasDesk, cells });
    });
    const noDesk = staff.filter((s) => !s.isTori && !s.hasDesk).map((s) => s.name);

    const n = recs.filter((r) => r.status === '완료' && r.bday === baseBD && !(r.names.length > 0 && r.names.every((x) => x === OWNER))).length;

    const seenProj = {}; const waits = [];
    recs.forEach((r) => { if (seenProj[r.project]) return; seenProj[r.project] = true; if (r.status === '대기') waits.push(r); });

    const list = (f) => staff.filter((s) => !s.isTori && f(s)).map((s) => s.name);
    const breakPeople = staff.filter((s) => !s.isTori && s.place === 'break').map((s) => ({ key: s.key, name: s.name, mark: s.mark }));
    const breakSeat = assignBreakFor(input.layout, breakPeople, base);
    return {
      breakSeat, breakSlot: breakSlot(base), breakSeed: breakSeed(base),
      base, baseStr: fmtMin(base), baseBD,
      roster, staff, n, hasRecords, source,
      waits,
      roadmap: rm, ownerTurn: rm ? rm.ownerTurn : [],
      deskNames: list((s) => s.place === 'desk' && s.mark !== '?'),
      qNames: list((s) => s.mark === '?'),
      exNames: list((s) => s.mark === '!'),
      breakNames: list((s) => s.place === 'break'),
      meetingNames: list((s) => s.place === 'meeting'),
      counts: {
        candidates: prog.records.length + prog.unreadable.length,
        readable: recs.length, unreadable: prog.unreadable.length, future: future.length,
        unknownNames: unknownNames.length, rosterWarnings: roster.warnings.length, noDesk: noDesk.length,
      },
      unreadable: prog.unreadable, future, unknownNames, noDesk, headerFound: prog.headerFound,
      records: recs,
    };
  }

  const SIGNAL_DESK_MIN = 30;
  const SIGNAL_MAX_MIN = 120;
  const SIGNAL_STATES = ['working', 'idle', 'error'];
  function isoToMin(s) {
    const str = String(s == null ? '' : s).trim();
    if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) return null;
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(str)) { const d = new Date(str); return isNaN(d) ? null : nowMin(d); }
    return parseMinStr(str.slice(0, 16));
  }
  function parseSignals(text, staff) {
    const res = { status: 'none', why: '파일 없음', rows: [], byName: {}, valid: 0 };
    if (text == null) return res;
    let data;
    try { data = JSON.parse(text); } catch (e) { res.status = 'bad'; res.why = 'JSON 못 읽음'; return res; }
    if (!data || !data.agents || typeof data.agents !== 'object' || Array.isArray(data.agents)) { res.status = 'bad'; res.why = 'agents 없음'; return res; }
    res.status = 'ok'; res.why = '';
    const byId = {}; (staff || []).forEach((s) => { if (s.id) byId[s.id] = s; });
    const rank = (x) => ({ working: 3, error: 2, idle: 1 }[x]);
    Object.keys(data.agents).forEach((id) => {
      const a = data.agents[id] || {};
      const type = String(a.type || ''), state = String(a.state || ''), t = isoToMin(a.since);
      const row = { id, type, state, since: String(a.since || ''), t, name: '', ignore: '' };
      const s = Object.prototype.hasOwnProperty.call(byId, type) ? byId[type] : null;
      if (!type) row.ignore = '종류 없음';
      else if (!s) row.ignore = '명부에 없음';
      else if (s.name === '토리') row.ignore = '토리는 아바타 곁';
      else if (SIGNAL_STATES.indexOf(state) < 0) row.ignore = '모르는 상태';
      else if (t == null) row.ignore = '시각 못 읽음';
      if (s) row.name = s.name;
      res.rows.push(row);
      if (row.ignore) return;
      res.valid++;
      const cur = res.byName[s.name];
      if (!cur || rank(state) > rank(cur.state) || (state === cur.state && t > cur.t)) res.byName[s.name] = { state, t, n: (cur ? cur.n : 0) + 1 };
      else cur.n++;
    });
    return res;
  }
  function signalVerdict(sig, base) {
    if (!sig) return { use: false, why: '' };
    const age = Math.max(0, base - sig.t);
    if (sig.state === 'working') {
      if (age <= SIGNAL_DESK_MIN) return { use: true, loc: 'desk', mark: '', age, why: '신호: 일하는 중 ' + age + '분 (30분 이내)' };
      if (age <= SIGNAL_MAX_MIN) return { use: true, loc: 'desk', mark: '?', age, why: '신호: 일하는 중 ' + age + '분 (30분~2시간)' };
      return { use: false, age, why: '신호: 일하는 중 2시간 넘음 -> 기본층' };
    }
    if (sig.state === 'error') {
      if (businessDay(sig.t) === businessDay(base)) return { use: true, loc: 'break', mark: '!', age, why: '신호: 오류, 오늘' };
      return { use: false, age, why: '신호: 오류, 오늘 아님 -> 기본층' };
    }
    return { use: false, age, why: '신호: 쉬는 중 -> 기본층' };
  }
  function applySignals(st, signalText, layout) {
    if (!st) return st;
    const sg = parseSignals(signalText, st.roster.staff);
    sg.applied = [];
    const staff = st.staff.map((s) => {
      if (s.isTori) return s;
      const v = signalVerdict(sg.byName[s.name], st.base);
      if (!v.use) return v.why ? Object.assign({}, s, { sig: v, baseWhy: s.why, why: s.why + ' (' + v.why + ')' }) : s;
      sg.applied.push(s.name);
      const place = v.loc === 'desk' && !s.hasDesk ? 'break' : v.loc;
      return Object.assign({}, s, { loc: v.loc, place, mark: v.mark, sig: v, baseWhy: s.why, why: v.why });
    });
    const list = (f) => staff.filter((s) => !s.isTori && f(s)).map((s) => s.name);
    const breakPeople = staff.filter((s) => !s.isTori && s.place === 'break').map((s) => ({ key: s.key, name: s.name, mark: s.mark }));
    return Object.assign({}, st, {
      staff, signal: sg,
      breakSeat: assignBreakFor(layout, breakPeople, st.base),
      deskNames: list((s) => s.place === 'desk' && s.mark !== '?'),
      qNames: list((s) => s.mark === '?'),
      exNames: list((s) => s.mark === '!'),
      breakNames: list((s) => s.place === 'break'),
      meetingNames: list((s) => s.place === 'meeting'),
    });
  }

  function spotKind(s) {
    if (s.seat === 'sofa') return 'sofa';
    if (s.group === 'T') return 'table';
    if (s.seat === 'floor' && s.group) return 'chat';
    if (s.seat === 'floor') return s.pose === 'coffee' ? 'coffee' : 'alone';
    return 'other';
  }
  const BREAK_SLOT_MIN = 30;
  function breakSlot(base) { return Math.floor((((base % 1440) + 1440) % 1440) / BREAK_SLOT_MIN); }
  function breakSeed(base) { return businessDay(base) + '#' + breakSlot(base); }
  function hashStr(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seededShuffle(arr, seedStr) { const r = rng(hashStr(seedStr)); const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function firstFreeTile(layout, roomId) {
    const r = (layout.rooms || []).find((x) => x.id === roomId); if (!r) return null;
    const blocked = new Set();
    (layout.objects || []).forEach((o) => {
      if (o.floor || o.wall || o.block === false) return;
      if (o.blockAt && Array.isArray(o.block)) { o.block.forEach((row, dy) => Array.from(row).forEach((c, dx) => { if (c === 'x') blocked.add((o.blockAt[0] + dx) + ',' + (o.blockAt[1] + dy)); })); return; }
      for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) if (!Array.isArray(o.block) || (o.block[dy] && o.block[dy][dx] === 'x')) blocked.add((o.x + dx) + ',' + (o.y + dy));
    });
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) if (layout.rows[y][x] === '.' && !blocked.has(x + ',' + y)) return [x, y];
    return null;
  }

  function assignBreak(spots, people, opts) {
    opts = opts || {};
    const kinds = spots.map(spotKind);
    const groups = []; spots.forEach((s, i) => { if (kinds[i] === 'chat' && groups.indexOf(s.group) < 0) groups.push(s.group); });
    const occ = spots.map(() => null);
    const at = {};
    const warnings = [], notices = [];
    const idx = (f) => spots.map((s, i) => i).filter((i) => f(i));
    const byY = (a) => a.slice().sort((i, j) => spots[i].y - spots[j].y || i - j);
    const avoids = (i, key) => (spots[i].avoid || []).indexOf(key) >= 0;
    const free = (c) => c.filter((i) => occ[i] === null);
    const pickFrom = (c, key) => { const f = free(c); if (!f.length) return -1; const ok = f.find((i) => !avoids(i, key)); return ok !== undefined ? ok : f[0]; };
    const put = (i, p, how) => { occ[i] = p.key; at[p.key] = { i, how }; };
    const sofa = idx((i) => kinds[i] === 'sofa'), table = idx((i) => kinds[i] === 'table');
    const coffee = idx((i) => kinds[i] === 'coffee'), alone = idx((i) => kinds[i] === 'alone');
    const grp = (n) => groups[n] ? idx((i) => kinds[i] === 'chat' && spots[i].group === groups[n]) : [];
    const g1 = grp(0), g2 = grp(1);
    const isEx = {}; people.forEach((p) => { if (p.mark === '!') isEx[p.key] = true; });
    const overflow = [];
    const exList = byY(alone).concat(byY(coffee), byY(sofa));
    people.filter((p) => isEx[p.key]).forEach((p) => { const i = pickFrom(exList, p.key); if (i < 0) overflow.push(p); else put(i, p, '"!"'); });
    const line = seededShuffle(people.filter((p) => !isEx[p.key]), opts.seed || '');
    const q = line.slice();
    const fill = (c, n) => { for (let k = 0; k < n && q.length; k++) { const i = pickFrom(c, q[0].key); if (i < 0) return; put(i, q.shift(), '차례'); } };
    const cnt = (c) => c.length - free(c).length;
    fill(sofa, 1);
    if (q.length >= 2 && free(table.slice(0, 2)).length >= 2) fill(table.slice(0, 2), 2);
    fill(sofa, Infinity);
    if (q.length >= 2 && free(g1.slice(0, 2)).length >= 2) fill(g1.slice(0, 2), 2);
    fill(coffee, 1);
    if (table.length > 2 && cnt(table) === 2) fill([table[2]], 1);
    if (g1.length === 3 && cnt(g1) === 2) fill([g1[2]], 1);
    if (table.length > 3 && cnt(table) === 3) fill([table[3]], 1);
    if (q.length >= 2 && free(g2.slice(0, 2)).length >= 2) fill(g2.slice(0, 2), 2);
    if (g2.length === 3 && cnt(g2) === 2) fill([g2[2]], 1);
    fill(coffee, Infinity);
    fill(alone, Infinity);
    q.forEach((p) => overflow.push(p));
    const swapKind = (i) => kinds[i] === 'coffee' ? 'alone' : kinds[i] === 'chat' ? 'chat:' + spots[i].group : kinds[i];
    const prefOk = (i, key) => !spots[i].prefer || spots[i].prefer.indexOf(key) >= 0 ? 1 : 0;
    spots.forEach((s, i) => {
      const a = occ[i]; if (a === null || isEx[a]) return;
      const partners = line.map((p) => p.key).filter((k) => k !== a && at[k] && at[k].i !== i && swapKind(at[k].i) === swapKind(i));
      const noAvoid = (k) => { const j = at[k].i; return !avoids(j, a) && !avoids(i, k); };
      let k;
      if (avoids(i, a)) k = partners.find(noAvoid);
      else k = partners.find((k2) => { const j = at[k2].i; return noAvoid(k2) && prefOk(i, k2) + prefOk(j, a) > prefOk(i, a) + prefOk(j, k2); });
      if (!k) return;
      const j = at[k].i;
      occ[i] = k; occ[j] = a; at[a] = { i: j, how: '맞바꿈' }; at[k] = { i, how: '맞바꿈' };
    });
    const seats = {};
    const seatOf = (i, how) => { const s = spots[i]; return { spot: i, no: i + 1, kind: kinds[i], x: s.x, y: s.y, px: s.px, py: s.py, pose: s.pose, face: s.face || 'down', group: s.group || '', seat: s.seat, how }; };
    Object.keys(at).forEach((k) => { seats[k] = seatOf(at[k].i, at[k].how); });
    const onSofa = sofa.filter((i) => occ[i] !== null);
    if (onSofa.length === 1 && opts.sofaMidPx != null) seats[occ[onSofa[0]]].px = opts.sofaMidPx;
    if (overflow.length) {
      warnings.push('휴게실 자리 부족: ' + overflow.length + '명 (' + overflow.map((p) => p.name || p.key).join(', ') + ')');
      const reuse = idx((i) => kinds[i] === 'alone' || kinds[i] === 'coffee');
      overflow.forEach((p, n) => {
        if (reuse.length) seats[p.key] = seatOf(reuse[n % reuse.length], '넘침(겹침)');
        else { const f = opts.fallback || [0, 0]; seats[p.key] = { spot: -1, no: 0, kind: 'fallback', x: f[0], y: f[1], pose: 'idle', face: 'down', group: '', seat: 'floor', how: '넘침(첫 칸)' }; }
      });
    }
    Object.keys(seats).forEach((k) => {
      const t = seats[k]; if (t.spot < 0) return;
      const nm = (people.find((p) => p.key === k) || {}).name || k;
      if (avoids(t.spot, k)) notices.push('avoid 위반: ' + nm + ' -> ' + t.no + '번 (' + t.x + ',' + t.y + ')');
      if (!prefOk(t.spot, k) && !(onSofa.length === 1 && kinds[t.spot] === 'sofa')) notices.push('prefer 못 맞춤: ' + nm + ' -> ' + t.no + '번 (' + t.x + ',' + t.y + ')');
    });
    return { seats, line: line.map((p) => p.key), seed: opts.seed || '', warnings, notices, kinds };
  }
  function breakPeopleOf(st) { return st.staff.filter((s) => !s.isTori && s.place === 'break').map((s) => ({ key: s.key, name: s.name, mark: s.mark })); }
  function assignBreakFor(layout, people, base) {
    if (!layout || !layout.breakSpots) return null;
    return assignBreak(layout.breakSpots, people, { seed: breakSeed(base), fallback: firstFreeTile(layout, 'break'), sofaMidPx: layout.SOFA_MID_PX });
  }

  const NO_ROADMAP = {
    brief: '로드맵을 못 읽었어요. 누가 어떤 칸을 맡았는지 지금은 몰라요.', brief2: '10_프로젝트/01_진행 폴더를 한번 봐 주세요.',
    desk: '로드맵을 못 읽어서 맡은 칸을 몰라요.', cork: '로드맵을 못 읽어서 비어 있어요.',
    lobby: '로드맵을 못 읽어서 기다리는 칸을 몰라요.',
  };
  const NO_SOURCE_LINE = NO_ROADMAP.brief;
  function exLine(names) {
    return (names.length >= 3 ? '직원 ' + names.length + '명이' : josa(joinNames(names), '이', '가')) + ' 일하다 멈춰서 휴게실에 있어요.';
  }
  function qLine(names) {
    return (names.length >= 3 ? '직원 ' + names.length + '명은' : josa(joinNames(names), '은', '는')) + ' 일이 길어지고 있어요.';
  }
  function greetingOnly(kind, st) {
    let first = '당니님, 처음 오셨네요. 토리예요.';
    if (isPublic()) { const g = st && st.staff && st.staff.find((s) => s.isTori); first = '당니님, 처음 오셨네요. ' + josa(g ? g.name : PUBLIC_GUIDE.job, '이에요.', '예요.'); }
    return { first, replay: '다시 말씀드릴게요.', dawn: '당니님, 늦게까지 계시네요.', basic: '당니님, 오셨어요.' }[kind];
  }
  function doneSentence(n, kind) {
    if (kind === 'dawn') return n === 0 ? '끝난 일은 아직 없어요.' : '끝난 일은 ' + n + '건이에요.';
    return n === 0 ? '오늘 끝난 일은 아직 없어요.' : '오늘 끝난 일은 ' + n + '건이에요.';
  }
  function compareValues(st) {
    const v = { n: st.n, desk: st.deskNames, q: st.qNames, ex: st.exNames, waits: st.waits.map((w) => w.project) };
    if (st.source === 'roadmap') v.turn = st.ownerTurn.map((c) => c.project + ' ' + c.line);
    return v;
  }
  function sameValues(a, b) { return !!a && !!b && JSON.stringify(a) === JSON.stringify(b); }

  function buildBriefing(st, opts) {
    opts = opts || {};
    const res = { steps: [], before: [], bubbles: [], kind: '', noNews: false };
    if (opts.readFail && (!opts.hasLast || !st || st.hasRecords === false)) {
      res.kind = 'failNoLast';
      res.bubbles = ['기록을 못 읽었어요. 폴더 연결을 확인해 주세요.'];
      res.before = [{ id: '1+2', text: res.bubbles[0] }];
      return res;
    }
    let kind = opts.kind || (isDawn(st.base) ? 'dawn' : 'basic');
    if (opts.readFail) kind = 'fail';
    res.kind = kind;
    const isFirst = kind === 'first';

    if (!isFirst && kind !== 'replay' && kind !== 'fail' && sameValues(compareValues(st), opts.lastSaved)) {
      res.noNews = true;
      res.before = [{ id: 'noNews', text: '새 소식은 없어요.' }];
      res.bubbles = ['새 소식은 없어요.'];
      return res;
    }

    if (kind !== 'fail' && st.source === 'roadmap') {
      const L = [{ id: 'g', text: greetingOnly(isFirst ? 'first' : kind, st) }];
      if (st.exNames.length) L.push({ id: 'ex', text: exLine(st.exNames) });
      if (st.deskNames.length) L.push({ id: '3', text: '지금 ' + josa(joinNames(st.deskNames), '이', '가') + ' 자리에 있어요.' });
      else if (!st.qNames.length) L.push({ id: '3', text: '지금 일하는 직원은 없어요.' });
      if (st.qNames.length) L.push({ id: 'q', text: qLine(st.qNames) });
      const k = st.ownerTurn.length;
      L.push({ id: 'turn', text: k ? '당니님 결정 기다리는 칸이 ' + k + '개예요.' : '당니님 결정 기다리는 칸은 없어요.' });
      if (k && !isFirst) L.push({ id: '9', text: '목록은 입구 서류함 보드에 붙여 뒀어요.' });
      if (isFirst) { L.push({ id: '8', text: '방향키로 걷고, Space로 말을 걸어요.' }); L.push({ id: '8', text: '직원을 누르면 그 직원과 이야기해요.' }); }
      res.before = L.slice(); res.bubbles = L.map((x) => x.text);
      return res;
    }
    const noSource = kind !== 'fail' && st.hasRecords === false;
    const quiet = kind !== 'fail' && st.n === 0 && st.deskNames.length === 0 && st.qNames.length === 0 && st.exNames.length === 0 && st.waits.length === 0;
    if (noSource || quiet) {
      const L = [{ id: 'g', text: greetingOnly(isFirst ? 'first' : kind, st) }];
      if (noSource) {
        if (st.exNames.length) L.push({ id: 'ex', text: exLine(st.exNames) });
        L.push({ id: 'noSource', text: NO_ROADMAP.brief }, { id: 'noSource+', text: NO_ROADMAP.brief2 });
      } else L.push({ id: 'quiet', text: '오늘은 사무실이 조용해요.' });
      if (isFirst) { L.push({ id: '8', text: '방향키로 걷고, Space로 말을 걸어요.' }); L.push({ id: '8', text: '직원을 누르면 그 직원과 이야기해요.' }); }
      res.before = L.slice(); res.bubbles = L.map((x) => x.text);
      return res;
    }

    const L = [];
    let g12;
    if (kind === 'fail') g12 = st.n === 0 ? '기록을 못 읽었어요. 지난 기록엔 끝난 일이 없어요.' : '기록을 못 읽었어요. 지난 기록엔 끝난 일 ' + st.n + '건이에요.';
    else if (isFirst) g12 = greetingOnly('basic', st) + ' ' + doneSentence(st.n, 'basic');
    else g12 = greetingOnly(kind, st) + ' ' + doneSentence(st.n, kind);
    L.push({ id: '1+2', text: g12 });
    L.push({ id: '3', text: st.deskNames.length ? '지금 ' + josa(joinNames(st.deskNames), '이', '가') + ' 자리에 있어요.' : '지금 일하는 직원은 없어요.' });
    if (st.qNames.length) L.push({ id: '4', text: joinNames(st.qNames) + ' 확인이 필요해요.' });
    if (st.exNames.length) {
      L.push({ id: '5', text: josa(joinNames(st.exNames), '은', '는') + ' 오늘 일이 멈춰 있어요.' });
      if (st.exNames.length === 1) {
        const s = st.staff.find((x) => x.name === st.exNames[0]);
        L.push({ id: '5+', text: s.latest.project + ' — ' + cut(s.latest.memo, MEMO_MAX) });
      } else L.push({ id: '5+', text: "휴게실에서 '!' 붙은 직원을 눌러 보세요." });
    }
    st.waits.slice(0, 3).forEach((w) => L.push({ id: '7', text: '당니님을 기다리는 일: ' + w.project }));
    if (st.waits.length > 3) L.push({ id: '7+', text: '그 밖에 ' + (st.waits.length - 3) + '건 더 있어요.' });
    const decide = st.waits.length >= 1;
    L.push({ id: '9', text: decide ? '결정하실 것부터 보시면 돼요.' : '필요하시면 앞이 빈 곳에서 Space예요.' });

    res.before = L.map((x) => ({ id: x.id, text: x.text }));
    let cur = L.slice();
    const LIMIT = 6;
    const step = (name, fn) => { if (cur.length > LIMIT) { cur = fn(cur); res.steps.push(name + ' → ' + cur.length); } };
    step('1단계 마무리 빼기', (a) => a.filter((x) => x.id !== '9'));
    step('2단계 5+ 빼기', (a) => a.filter((x) => x.id !== '5+'));
    step('3단계 7·7+ 합치기', (a) => {
      if (st.waits.length <= 1) return a;
      const i = a.findIndex((x) => x.id === '7');
      const merged = { id: '7', text: '당니님을 기다리는 일: ' + st.waits[0].project + ' 외 ' + (st.waits.length - 1) + '건' };
      const rest = a.filter((x) => x.id !== '7' && x.id !== '7+');
      rest.splice(i, 0, merged);
      return rest;
    });
    if (isFirst) {
      cur = cur.filter((x) => x.id !== '9');
      const g = cur.shift();
      cur.unshift({ id: '2', text: doneSentence(st.n, 'basic') });
      cur.unshift({ id: '1', text: greetingOnly('first', st) });
      cur.push({ id: '8', text: '방향키로 걷고, Space로 말을 걸어요.' });
      cur.push({ id: '8', text: '직원을 누르면 그 직원과 이야기해요.' });
      res.steps.push('첫 방문: 마무리 빼기, 인사 나누기, 안내 2줄 → ' + cur.length);
      void g;
    }
    res.bubbles = cur.map((x) => x.text);
    res.after = cur;
    return res;
  }

  const api = {
    ownerWords, PUBLIC_STAFF, PUBLIC_DROPPED, publicRoster, charOf, isGuide, assignDesks,
    ALIASES, STATUS, DAY_START_MIN, WORK_WINDOW_MIN, TF_ENABLED, BRIEF_NAME_RE, NO_SOURCE_LINE, NO_ROADMAP,
    toMin, nowMin, parseMinStr, fmtMin, businessDay, isDawn, ymdToMD, hasBatchim, josa, joinNames, cut,
    spotKind, breakSlot, breakSeed, seededShuffle, hashStr, firstFreeTile, assignBreak, assignBreakFor, breakPeopleOf,
    parseRoster, readRoster, parseProgress, sortRecent, findLatestBrief, compute, buildBriefing, compareValues, sameValues,
    topOpenItem, parseOwners, itemShort, roadmapSeats,
    PLAN_KEY_LEN, ROADMAP_MISS, cellOf, isPlaceholder, parseStageTitle, planKey, parseRoadmapCells, cellLabel, roadmapNow,
    POSTIT_TITLE_MAX, textWidth, postitTitle,
    planPathOf, planGoalOf, suggestInitial, suggestSearch, planTodoLine, roadmapMark, checkRoadmapCell, isCheckOnlyChange,
    SIGNAL_DESK_MIN, SIGNAL_MAX_MIN, isoToMin, parseSignals, signalVerdict, applySignals,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.POCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
