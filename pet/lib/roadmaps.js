'use strict';
const { core } = require('./brief');
const N = require('./names');
const BOSS = () => N.values().bossCall;

const DO_KINDS = ['group', 'owner', 'tail'];
const SAY_WITHIN = 0.5;

function deadlineOf(text, baseYmd) {
  const src = String(text || '').replace(/\*\*|__/g, '');
  const m = /기한\s*[:：]\s*/.exec(src);
  if (!m) return { raw: '', kind: 'none', date: null, stage: null };
  let raw = src.slice(m.index + m[0].length);
  const stop = /\s*(?:\s\/|\/\s|[—–)）]|\.\s|,\s|;|$)/.exec(raw);
  raw = raw.slice(0, stop ? stop.index : raw.length).trim();
  if (/^\(/.test(raw) && !/\)/.test(raw)) raw = raw.replace(/^\(/, '');
  const out = { raw, kind: 'none', date: null, stage: null };
  const year = +(baseYmd || '2026').slice(0, 4);
  const pad = (n) => String(n).padStart(2, '0');
  let d = /(\d{4})[-.](\d{1,2})[-.](\d{1,2})/.exec(raw);
  if (d) { out.kind = 'date'; out.date = d[1] + '-' + pad(d[2]) + '-' + pad(d[3]); return out; }
  d = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(raw) || /(?:^|\s)(\d{1,2})\/(\d{1,2})(?:$|\s)/.exec(raw);
  if (d) {
    let y = year; const md = pad(d[1]) + '-' + pad(d[2]);
    if (baseYmd && (y + '-' + md) < shiftMonths(baseYmd, -6)) y++;
    out.kind = 'date'; out.date = y + '-' + md; return out;
  }
  const s = /(\d+)\s*단계\s*(.*)$/.exec(raw);
  if (s) {
    const n = +s[1], rest = s[2];
    let v = n;
    if (/끝나기\s*전/.test(rest)) v = n + 0.4;
    else if (/끝/.test(rest)) v = n + 0.5;
    else if (/시작\s*(?:시|때)/.test(rest)) v = n - 0.5;
    else if (/전/.test(rest)) v = n - 0.6;
    out.kind = 'stage'; out.stage = v; return out;
  }
  return out;
}
function shiftMonths(ymd, k) {
  const y = +ymd.slice(0, 4), mo = +ymd.slice(5, 7) - 1 + k;
  const yy = y + Math.floor(mo / 12), mm = ((mo % 12) + 12) % 12 + 1;
  return yy + '-' + String(mm).padStart(2, '0') + ymd.slice(7);
}

function whatOf(text, n) {
  let s = String(text || '').replace(/\*\*|__|`/g, '').trim();
  s = s.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
  const cut = /\s+[—–]\s+|\s*(?:용도|기한|담당)\s*[:：]/.exec(s);
  if (cut && cut.index > 0) s = s.slice(0, cut.index);
  return core.cut(s.replace(/[\s—–\-·.,(（]+$/, '').trim(), n || 30);
}
function purposeOf(text) {
  const m = /용도\s*[:：]\s*([^/—–]*)/.exec(String(text || '').replace(/\*\*|__/g, ''));
  return m ? m[1].trim().replace(/[,.]\s*$/, '') : '';
}

function stageNoOf(parsed, sectionIdx) {
  for (let k = sectionIdx; k >= 0; k--) { const s = parsed.sections[k]; if (s && s.kind === 'stage') return s.stage; }
  return 0;
}

function collect(roadmaps, names, baseYmd) {
  const res = { projects: [], todos: [], say: [], decide: [] };
  (roadmaps || []).forEach((r) => {
    if (r.text == null) { res.projects.push({ project: r.project, rel: r.rel, parsed: null, now: null, error: r.error || '로드맵 없음' }); return; }
    const parsed = core.parseRoadmapCells(r.text, names || []);
    const now = core.roadmapNow(parsed);
    const curStage = now.state === 'now' ? stageNoOf(parsed, now.cell.section) : Infinity;
    res.projects.push({ project: r.project, rel: r.rel, parsed, now, curStage, error: null });
    parsed.cells.forEach((c) => {
      if (c.done || !c.dangnee || c.sectionKind === 'later') return;
      const sec = c.section >= 0 ? parsed.sections[c.section] : null;
      const cellStage = stageNoOf(parsed, c.section);
      const deadline = deadlineOf(c.text, baseYmd);
      const item = {
        project: r.project, rel: r.rel, line: c.line, text: c.text, what: whatOf(c.text), purpose: purposeOf(c.text), deadline, kind: c.dangnee,
        stageLabel: sec ? (sec.kind === 'decide' ? '정할 것' : sec.label) : '', cellStage, approve: /\[승인\]/.test(c.text),
      };
      if (c.dangnee === 'decide') { res.decide.push(item); return; }
      if (DO_KINDS.indexOf(c.dangnee) < 0) return;
      const st = deadline.kind === 'stage' ? deadline.stage : cellStage;
      item.due = deadline.kind === 'date' ? { tier: 0, v: deadline.date } : { tier: 1, v: curStage === Infinity ? -1 : st - curStage };
      item.soon = deadline.kind === 'date' || curStage === Infinity || cellStage <= curStage || st - curStage <= SAY_WITHIN;
      res.todos.push(item);
    });
  });
  res.todos.sort(compareDue);
  res.say = res.todos.filter((t) => t.soon);
  return res;
}
function compareDue(a, b) {
  if (a.due.tier !== b.due.tier) return a.due.tier - b.due.tier;
  if (a.due.v !== b.due.v) return a.due.v < b.due.v ? -1 : 1;
  if (a.project !== b.project) return a.project < b.project ? -1 : 1;
  return a.line - b.line;
}

function dueWords(item, baseYmd) {
  const d = item.deadline;
  if (d.kind !== 'date') return d.raw ? '기한: ' + d.raw : '';
  const days = Math.round((Date.parse(d.date) - Date.parse(baseYmd)) / 86400000);
  const md = (+d.date.slice(5, 7)) + '월 ' + (+d.date.slice(8, 10)) + '일';
  if (days < 0) return md + ' 지났어요';
  if (days === 0) return '오늘까지';
  if (days === 1) return '내일까지';
  return md + '까지';
}

function periodicLine(col, n, baseYmd) {
  const L = col.say;
  if (!L.length) return col.todos.length ? '지금 단계 ' + BOSS() + ' 할 일은 없어요. 나중 단계 ' + col.todos.length + '개는 보기창에 있어요.' : BOSS() + ' 할 일은 지금 없어요.';
  const k = ((n % L.length) + L.length) % L.length, it = L[k];
  const due = dueWords(it, baseYmd);
  return BOSS() + ' 할 일 ' + (k + 1) + '/' + L.length + (it.approve ? ' · 승인' : '') + '\n' + it.project + ': ' + it.what + (due ? '\n(' + due + ')' : '');
}

function stateOf(col) {
  const st = {};
  col.projects.forEach((p) => {
    if (!p.parsed) return;
    const s = { open: [], done: [], stages: {} };
    p.parsed.cells.forEach((c) => (c.done ? s.done : s.open).push(c.key));
    p.parsed.sections.forEach((sec, i) => {
      if (sec.kind !== 'stage') return;
      const cells = p.parsed.cells.filter((c) => c.section === i);
      if (cells.length) s.stages[sec.label] = cells.every((c) => c.done);
    });
    st[p.project] = s;
  });
  return st;
}
function changes(prev, cur, col) {
  if (!prev) return [];
  const out = [];
  col.projects.forEach((p) => {
    const a = prev[p.project], b = cur[p.project];
    if (!a || !b || !p.parsed) return;
    const wasOpen = new Set(a.open), nowDone = new Set(b.done), nowOpen = new Set(b.open);
    const doneStages = Object.keys(b.stages).filter((k) => b.stages[k] && a.stages[k] === false);
    doneStages.forEach((label) => out.push({ project: p.project, type: 'stage', label }));
    const stageOfKey = {};
    p.parsed.cells.forEach((c) => { const s = p.parsed.sections[c.section]; stageOfKey[c.key] = s ? s.label : ''; });
    p.parsed.cells.forEach((c) => {
      if (!c.done || !wasOpen.has(c.key) || nowOpen.has(c.key) || !nowDone.has(c.key)) return;
      if (doneStages.indexOf(stageOfKey[c.key]) >= 0) return;
      if (out.some((x) => x.project === p.project && x.type === 'item' && x.key === c.key)) return;
      out.push({ project: p.project, type: 'item', label: whatOf(c.text, 24), key: c.key });
    });
  });
  return out;
}
function announceChanges(list) {
  if (!list.length) return null;
  const st = list.filter((x) => x.type === 'stage');
  const first = st[0] || list[0];
  const head = first.project + '\n' + (first.type === 'stage' ? first.label : '「' + first.label + '」') + ' 끝났어요!';
  const more = list.length - 1;
  return more ? head + '\n(끝난 것 ' + more + '개 더)' : head;
}

function viewerData(kind, col, ctx) {
  const blocks = []; let title = '', sub = '';
  const baseYmd = ctx.baseYmd;
  const todoItem = (t) => {
    const due = dueWords(t, baseYmd);
    return { t: 'item', meta: t.project + (t.stageLabel ? ' · ' + t.stageLabel : '') + (due ? ' · ' + due : '') + (t.approve ? ' · 승인' : ''), text: t.what, sub: t.purpose ? ['용도: ' + t.purpose] : [] };
  };
  if (kind === 'todos') {
    title = BOSS() + ' 할 일';
    const later = col.todos.filter((t) => !t.soon);
    sub = '지금 ' + col.say.length + '개 · 나중 단계 ' + later.length + '개 · 정할 것 ' + col.decide.length + '개';
    blocks.push({ t: 'h', text: '지금 단계까지 (기한 가까운 순, 말주머니에 나와요)' });
    if (!col.say.length) blocks.push({ t: 'empty', text: '지금 단계 ' + BOSS() + ' 할 일은 없어요.' });
    col.say.forEach((t, i) => blocks.push(Object.assign(todoItem(t), { n: String(i + 1) })));
    if (col.decide.length) {
      blocks.push({ t: 'h', text: '정할 것 (말주머니에는 안 나와요)' });
      col.decide.forEach((t) => blocks.push(todoItem(t)));
    }
    if (later.length) {
      blocks.push({ t: 'h', text: '나중 단계' });
      later.forEach((t) => blocks.push(todoItem(t)));
    }
  } else if (kind === 'next') {
    title = '프로젝트 다음 할 일';
    const ok = col.projects.filter((p) => p.parsed);
    sub = '진행 로드맵 ' + ok.length + '개';
    col.projects.forEach((p) => {
      if (!p.parsed) { blocks.push({ t: 'h', text: p.project, meta: p.error }); return; }
      const n = p.now;
      blocks.push({ t: 'h', text: p.project, meta: n.progress.done + '/' + n.progress.total });
      if (n.state === 'now') {
        const names = n.cell.owners.length ? n.cell.owners : n.cell.ownerUnknown;
        const who = n.ownerTurn ? BOSS() + ' 차례' : '담당: ' + names.join('·');
        blocks.push({ t: 'item', meta: (n.stageLabel || '맨 위') + ' · ' + who, text: core.cellLabel(p.parsed, n.cell, 60), sub: [] });
      } else if (n.state === 'later') blocks.push({ t: 'p', text: n.stageLabel });
      else blocks.push({ t: 'p', text: n.state === 'done' ? '다 끝났어요.' : '체크 칸이 없어요.' });
    });
  }
  const files = col.projects.length ? ['10_프로젝트/01_진행/*/로드맵.md (' + col.projects.filter((p) => p.parsed).length + '개)'] : [];
  return { kind, title, sub, blocks, files, at: ctx.at };
}

module.exports = { DO_KINDS, deadlineOf, whatOf, purposeOf, collect, compareDue, dueWords, periodicLine, stateOf, changes, announceChanges, viewerData };
