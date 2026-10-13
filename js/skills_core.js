(function (root) {
  'use strict';
  const nfc = (s) => String(s == null ? '' : s).normalize('NFC');

  const TABLE_PATH = '00_운영/도구/스킬표.json';
  const usagePath = (folder) => '00_운영/도구/' + nfc(folder) + '/사용법.md';
  const WORK_FILES = [
    '00_운영/정리/작업지시서_이름점검.md',
    '00_운영/정리/작업지시서_컴퓨터정리.md',
    '10_프로젝트/01_진행/강의/작업지시서_블로그제작.md',
    '10_프로젝트/01_진행/강의/작업지시서_원고작성.md',
  ];
  const WORK_NONE = { c: '#C5C7CA', sh: '#AAADB2', hi: '#DADCDD' };
  function shade(hex, a) { const n = parseInt(String(hex).slice(1), 16); const f = (x) => Math.max(0, Math.min(255, Math.round(x + (a < 0 ? x * a : (255 - x) * a)))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((x) => f(x).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  const workCol = (hex) => (hex ? { c: hex.toUpperCase(), sh: shade(hex, -0.18), hi: shade(hex, 0.3) } : WORK_NONE);
  const SKILL_COL = { c: '#E2DFD6', sh: '#CDC8B8', hi: '#F3F2EE' };
  const SKILL_FRAME = { c: '#CDC8B8', sh: '#B9B3A0', hi: '#E2DFD6' };
  const ATTACH_WITHOUT_BUTTON = true;
  const ORDER = ['토리', '오리', '무늬', '비트', '몽글', '바나 쌤', '부기'];
  const BTN_ORDER = ['blog', 'pf', 'proj', 'clean', 'names', 'frame', 'lecture', 'sync', 'pixel', 'combo', 'shop', 'imgconv', 'board', 'test', 'deploy'];
  const FENCE = { '읽기만': 'read', '새 파일만': 'new', '덮어씀': 'over', '휴지통': 'trash', '앱 밖 실행': 'out' };

  function parseTable(text) {
    let raw;
    try { raw = JSON.parse(String(text)); } catch (e) { return { ok: false, error: '스킬표.json 을 JSON 으로 읽지 못했어요: ' + e.message }; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw['스킬'])) return { ok: false, error: '스킬표.json 에 "스킬" 목록이 없어요.' };
    const skills = [], seen = new Set(), warnings = [];
    for (let i = 0; i < raw['스킬'].length; i++) {
      const r = raw['스킬'][i];
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id.trim()) return { ok: false, error: (i + 1) + '번째 줄에 id 가 없어요.' };
      const id = nfc(r.id).trim();
      if (seen.has(id)) return { ok: false, error: 'id 가 겹쳐요: ' + id };
      seen.add(id);
      if (r['직원'] != null && !Array.isArray(r['직원'])) return { ok: false, error: id + ' 의 "직원" 칸이 목록이 아니에요.' };
      const fence = (Array.isArray(r['울타리']) ? r['울타리'] : r['울타리'] ? [r['울타리']] : []).map(nfc);
      fence.filter((f) => !FENCE[f]).forEach((f) => warnings.push(id + ': 모르는 울타리 "' + f + '"'));
      const block = {};
      if (r['AI막음'] && typeof r['AI막음'] === 'object') Object.keys(r['AI막음']).forEach((k) => { block[nfc(k)] = nfc(r['AI막음'][k]); });
      skills.push({
        id, name: nfc(r['이름'] || id), folder: nfc(r['폴더'] || ''), kind: nfc(r['종류'] || '스크립트'), claude: nfc(r['클로드'] || ''), btn: nfc(r['앱버튼'] || ''),
        fence: fence.filter((f) => FENCE[f]), fenceNote: nfc(r['울타리메모'] || ''), staff: [...new Set((r['직원'] || []).map((x) => nfc(x).trim()).filter(Boolean))], block, info: nfc(r['종류']) === '설명',
      });
    }
    return { ok: true, raw, skills, warnings };
  }
  function fmt(v) {
    if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
    if (v && typeof v === 'object') { const ks = Object.keys(v); return ks.length ? '{ ' + ks.map((k) => JSON.stringify(k) + ': ' + fmt(v[k])).join(', ') + ' }' : '{}'; }
    return JSON.stringify(v);
  }
  function serialize(raw) {
    const keys = Object.keys(raw);
    const lines = keys.map((k) => {
      if (k === '스킬') return '  "스킬": [\n' + raw['스킬'].map((s) => '    ' + fmt(s)).join(',\n') + '\n  ]';
      return '  ' + JSON.stringify(k) + ': ' + fmt(raw[k]);
    });
    return '{\n' + lines.join(',\n') + '\n}\n';
  }
  function withStaff(raw, id, name, on) {
    const out = JSON.parse(JSON.stringify(raw));
    const r = out['스킬'].find((x) => nfc(x.id) === nfc(id));
    if (!r) return { raw: out, changed: false, error: '스킬표에 없는 스킬이에요: ' + id };
    const list = (Array.isArray(r['직원']) ? r['직원'] : []).map(nfc);
    const has = list.includes(nfc(name));
    if (on === has) return { raw: out, changed: false };
    r['직원'] = on ? list.concat([nfc(name)]) : list.filter((x) => x !== nfc(name));
    return { raw: out, changed: true };
  }
  const canAttach = (sk) => !!sk && !sk.info && (ATTACH_WITHOUT_BUTTON || !!sk.btn);

  function staffTools(skills, keyOf, defs) {
    const map = {}, unknown = [];
    skills.forEach((sk) => {
      if (sk.info || !sk.btn || !defs[sk.btn]) return;
      sk.staff.forEach((n) => {
        const k = keyOf(n);
        if (!k) { if (!unknown.includes(n)) unknown.push(n); return; }
        (map[k] = map[k] || []);
        if (!map[k].includes(sk.btn)) map[k].push(sk.btn);
      });
    });
    const at = (b) => { const i = BTN_ORDER.indexOf(b); return i < 0 ? 999 : i; };
    Object.keys(map).forEach((k) => map[k].sort((a, b) => at(a) - at(b) || a.localeCompare(b)));
    return { map, unknown };
  }
  function orderStaff(roster) {
    const list = (roster || []).slice();
    const at = (s) => { const i = ORDER.indexOf(s.name); return i < 0 ? 100 + (s.order || 0) : i; };
    return list.sort((a, b) => at(a) - at(b));
  }

  const plain = (s) => nfc(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  const isList = (l) => /^\s*([-*+]\s|\d+[.)]\s)/.test(l);
  function parseUsage(md) {
    const lines = nfc(md).replace(/\r\n?/g, '\n').split('\n');
    const out = { title: '', what: '', cmd: '', run: { owner: '', staff: '' } };
    let i = lines.findIndex((l) => /^#\s+/.test(l));
    if (i >= 0) out.title = lines[i].replace(/^#\s+/, '').replace(/\s*\([^)]*사내 도구[^)]*\)\s*$/, '').trim();
    const what = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!what.length) { if (!l.trim() || /^#/.test(l) || isList(l) || /^\s*```/.test(l) || /^ {4}\S/.test(l)) { if (/^##\s/.test(l)) break; continue; } what.push(l.trim()); continue; }
      if (!l.trim() || /^#/.test(l) || isList(l) || /^\s*```/.test(l) || /^ {4}\S/.test(l)) break;
      what.push(l.trim());
    }
    out.what = plain(what.join(' '));
    for (let j = 0; j < lines.length; j++) {
      const l = lines[j];
      if (/^\s*```/.test(l)) { for (let k = j + 1; k < lines.length && !/^\s*```/.test(lines[k]); k++) { if (lines[k].trim()) { out.cmd = lines[k]; break; } } break; }
      if (/^ {4}\S/.test(l) && !isList(l) && (j === 0 || !lines[j - 1].trim() || /^ {4}\S/.test(lines[j - 1]))) { out.cmd = l; break; }
    }
    if (!out.cmd) { const m = nfc(md).match(/`((?:python3|zsh|bash|node)\s[^`]+)`/); if (m) out.cmd = m[1]; }
    out.cmd = out.cmd.trim().replace(/\s{2,}.*$/, '');
    const h = lines.findIndex((l) => /^##\s*누가 실행하나/.test(l));
    if (h >= 0) {
      for (let j = h + 1; j < lines.length && !/^##\s/.test(lines[j]); j++) {
        const l = lines[j]; if (!/^- /.test(l)) continue;
        const body = l.slice(2), c = body.search(/[:：]\s/);
        const label = c >= 0 ? body.slice(0, c) : '', text = c >= 0 ? body.slice(c + 1).trim() : body.trim();
        if (!out.run.owner && /^당니님/.test(label)) out.run.owner = plain(text);
        else if (!out.run.staff && /^(토리|직원)/.test(label)) out.run.staff = plain(text);
      }
    }
    return out;
  }

  function parseAgentHead(md) {
    const lines = nfc(md).replace(/\r\n?/g, '\n').split('\n');
    const out = { skills: [], tools: [], has: false };
    if (lines[0].trim() !== '---') return out;
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end < 0) return out;
    out.has = true;
    const head = lines.slice(1, end);
    const listOf = (key) => {
      const i = head.findIndex((l) => new RegExp('^' + key + '\\s*:').test(l));
      if (i < 0) return [];
      const v = head[i].replace(new RegExp('^' + key + '\\s*:'), '').trim();
      const clean = (x) => x.trim().replace(/^["']|["']$/g, '').trim();
      if (v) return v.replace(/^\[|\]$/g, '').split(',').map(clean).filter(Boolean);
      const r = [];
      for (let j = i + 1; j < head.length && /^\s+-\s*/.test(head[j]); j++) r.push(clean(head[j].replace(/^\s+-\s*/, '')));
      return r.filter(Boolean);
    };
    out.skills = listOf('skills'); out.tools = listOf('tools');
    return out;
  }

  function aiState(sk, ctx) {
    if (ctx.main) return { st: 'na', txt: '메인 대화라 AI 직원도 늘 앎' };
    if (!sk.claude) return { st: 'na', txt: 'AI 직원용 스킬 없음 (카드 버튼만)' };
    if (sk.block[ctx.name]) return { st: 'block', txt: 'AI 직원에게는 안 붙임', why: sk.block[ctx.name] };
    if (!ctx.agentsKnown) return { st: 'unk', txt: 'AI 직원 상태는 데스크톱 앱에서 보여요' };
    if (!ctx.agent) return { st: 'na', txt: 'AI 직원 설명서 없음' };
    if (ctx.agent.skills.includes(sk.claude)) return { st: 'yes', txt: 'AI 직원도 앎' };
    return { st: 'no', txt: 'AI 직원은 아직 모름' };
  }
  const canRun = (agent) => !agent || agent.tools.includes('Bash');
  const askAttach = (sk, who) => '토리, ' + who + ' 설명서 skills에 ' + sk.claude + ' 붙여줘 (스킬책)';
  const askDetach = (sk, who) => '토리, ' + who + ' 설명서 skills에서 ' + sk.claude + ' 떼줘 (스킬책)';

  function parseWork(md, names) {
    names = (names || []).map(nfc).sort((a, b) => b.length - a.length);
    const lines = nfc(md).replace(/\r\n?/g, '\n').split('\n');
    const out = { title: '', lead: '', owner: '', owners: [], steps: [], sections: [] };
    const t = lines.findIndex((l) => /^#\s+/.test(l));
    if (t >= 0) out.title = lines[t].replace(/^#\s+/, '').replace(/^작업지시서\s*[—–-]\s*/, '').trim();
    for (let j = t + 1; j < lines.length; j++) { const l = lines[j]; if (/^#/.test(l)) break; if (l.trim() && !isList(l)) { out.lead = plain(l); break; } }
    const ownerIn = (s) => { let best = null; names.forEach((n) => { const i = s.indexOf(n); if (i >= 0 && (best == null || i < best.i)) best = { n, i }; }); return best ? best.n : ''; };
    let sec = null, inSteps = false;
    lines.forEach((l, j) => {
      if (j <= t) return;
      const h = l.match(/^##\s+(.+)$/);
      if (h) { inSteps = /^순서/.test(h[1].trim()); sec = inSteps ? null : { head: h[1].trim(), lines: [] }; if (sec) out.sections.push(sec); return; }
      if (inSteps) {
        const m = l.match(/^- \[([ xX])\]\s*(\d+)\.\s*(.+)$/);
        if (m) {
          const d = m[3].split(/\s+[—–]\s+담당:\s*/);
          const owner = d[1] ? ownerIn(d[1]) : '';
          out.steps.push({ no: +m[2], text: plain(d[0]) + (d[1] && !owner ? ' — ' + plain(d[1]) : ''), done: m[1] !== ' ', owner, note: d[1] && owner ? plain(d[1]) : '' });
          if (owner && !out.owners.includes(owner)) out.owners.push(owner);
        }
        return;
      }
      if (sec) sec.lines.push(l);
    });
    for (let j = t + 1; j < lines.length && !/^##\s/.test(lines[j]); j++) { const m = lines[j].match(/^- 담당:\s*(.+)$/); if (m) { out.owner = ownerIn(m[1]); break; } }
    if (!out.owner) out.owner = (out.steps.find((s) => s.owner && s.owner !== '토리') || {}).owner || '';
    out.sections = out.sections.map((s) => ({ head: s.head, body: s.lines.join('\n').replace(/^\n+|\n+$/g, '') })).filter((s) => s.body.trim());
    return out;
  }
  function workUses(workText, workPath, skills, usageByFolder) {
    const text = nfc(workText), base = nfc(workPath).split('/').pop().replace(/\.md$/, '');
    const ids = [];
    const add = (sk) => { if (sk && !sk.info && !ids.includes(sk.id)) ids.push(sk.id); };
    (text.match(/\(스킬\s+([a-z0-9-]+)\)/g) || []).forEach((m) => { const c = m.replace(/^\(스킬\s+|\)$/g, ''); add(skills.find((s) => s.claude === c || s.id === c)); });
    (text.match(/00_운영\/도구\/([^/\s`)]+)\//g) || []).forEach((m) => { const f = m.split('/')[2]; add(skills.find((s) => s.folder === f)); });
    skills.forEach((s) => { const u = usageByFolder && usageByFolder[s.folder]; if (u && nfc(u).indexOf(base) >= 0) add(s); });
    return ids;
  }

  const API = { TABLE_PATH, usagePath, WORK_FILES, WORK_NONE, workCol, shade, SKILL_COL, SKILL_FRAME, ATTACH_WITHOUT_BUTTON, ORDER, BTN_ORDER, FENCE, parseTable, serialize, withStaff, canAttach, staffTools, orderStaff,
    parseUsage, parseAgentHead, aiState, canRun, askAttach, askDetach, parseWork, workUses, nfc };
  root.POSkillsCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
