(function (root) {
  'use strict';
  const C = root.POSkillsCore, FS = root.POFS;
  const T = () => root.POTools;
  const D = () => root.PODesktop;
  const LN = () => root.PO_LINES || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nfc = C.nfc;
  const pub = () => root.PO_PUBLIC === true && !!D() && typeof D().skillsList === 'function';
  const guideName = () => { const g = SK.roster.find((x) => x.id === 'squirrel' || x.animal === '다람쥐'); return g ? g.name : '비서'; };
  const mainName = () => (root.PO_PUBLIC === true ? guideName() : '토리');

  const SK = {
    handle: null, table: null, err: '', roster: [], agents: null, agentsKnown: false, usage: {}, usageText: {}, works: [],
    loadP: null, tab: '', pick: null, confirm: null, toast: null, last: null, busy: false, copied: '', shelf: null,
  };

  async function readText(path) { try { return (await FS.readText(SK.handle, path)).text; } catch (e) { return null; } }
  async function readRoster() {
    const t = await readText('CLAUDE.md');
    const P = root.POCore;
    SK.roster = t && P && P.parseRoster ? P.parseRoster(t).staff : [];
  }
  async function readAgents() {
    const d = D();
    if (!d || typeof d.list !== 'function') { SK.agents = null; SK.agentsKnown = false; return; }
    const out = {};
    try {
      if ((await d.kind('.claude/agents')) !== 'directory') { SK.agents = out; SK.agentsKnown = true; return; }
      for (const f of await d.list('.claude/agents')) {
        if (f.kind !== 'file' || !/\.md$/.test(f.name)) continue;
        try { out[f.name.replace(/\.md$/, '')] = C.parseAgentHead((await d.read('.claude/agents/' + f.name)).text); } catch (e) {  }
      }
      SK.agents = out; SK.agentsKnown = true;
    } catch (e) { SK.agents = null; SK.agentsKnown = false; }
  }
  const staffOf = (name) => SK.roster.find((s) => s.name === nfc(name)) || null;
  const keyOf = (name) => { const s = staffOf(name); return s ? s.key : null; };
  function applyCards() {
    const TT = T(); if (!TT || !TT.setStaffTools) return;
    if (!SK.table || !SK.roster.length || pub()) { TT.setStaffTools(null); return; }
    TT.setStaffTools(C.staffTools(SK.table.skills, keyOf, TT.DEFS).map, 'table');
  }
  async function readTable() {
    if (pub()) return readPublic();
    const t = await readText(C.TABLE_PATH);
    if (t == null) { SK.table = null; SK.err = '스킬표.json 을 읽지 못했어요 (00_운영/도구/스킬표.json).'; return; }
    const p = C.parseTable(t);
    if (!p.ok) { SK.table = null; SK.err = p.error; return; }
    SK.table = p; SK.err = '';
  }
  async function readPublic() {
    let r = null;
    try { r = await D().skillsList(); } catch (e) { r = { ok: false, error: e.message }; }
    if (!r || !r.ok) { SK.table = null; SK.err = '스킬을 읽지 못했어요' + (r && r.error ? ': ' + r.error : ''); SK.agents = null; SK.agentsKnown = false; return; }
    const agents = {};
    Object.keys(r.agents || {}).forEach((id) => { agents[id] = C.parseAgentHead(r.agents[id]); });
    SK.agents = agents; SK.agentsKnown = true;
    SK.usage = {}; SK.usageText = {};
    const skills = r.skills.map((x) => {
      const t = nfc(x.text).replace(/\r\n?/g, '\n'), body = t.replace(/^---\n[\s\S]*?\n---\n/, '');
      const dm = t.match(/^description:\s*(.+)$/m); let what = dm ? dm[1].trim() : ''; try { if (/^"/.test(what)) what = JSON.parse(what); } catch (e) {  }
      const u = C.parseUsage(body); u.what = what || u.what; u.run = { owner: '', staff: '' };
      SK.usage[x.folder] = u; SK.usageText[x.folder] = body;
      const staff = SK.roster.filter((p) => agents[p.key] && agents[p.key].skills.includes(x.folder)).map((p) => p.name);
      return { id: x.folder, name: u.title || x.folder, folder: x.folder, kind: '스킬', claude: x.folder, btn: '', fence: [], fenceNote: '', staff, block: {}, info: false };
    });
    SK.table = { ok: true, raw: null, skills, warnings: [] }; SK.err = '';
  }
  function load(handle) {
    if (handle && handle !== SK.handle) { SK.handle = handle; SK.loadP = null; }
    if (!SK.handle) return Promise.resolve();
    if (SK.loadP) return SK.loadP;
    SK.loadP = (async () => { await readRoster(); await readTable(); applyCards(); })().finally(() => { SK.loadP = null; });
    return SK.loadP;
  }
  async function scanShelf(handle) {
    await load(handle);
    if (pub()) return { works: [], skill: SK.table ? skillBook() : null };
    await readAgents();
    SK.usage = {}; SK.usageText = {};
    if (SK.table) {
      for (const sk of SK.table.skills) {
        if (!sk.folder || SK.usage[sk.folder]) continue;
        const t = await readText(C.usagePath(sk.folder));
        SK.usageText[sk.folder] = t || '';
        SK.usage[sk.folder] = t ? C.parseUsage(t) : null;
      }
    }
    const names = SK.roster.map((s) => s.name);
    SK.works = [];
    for (const p of C.WORK_FILES) {
      const t = await readText(p);
      if (t == null) continue;
      const w = C.parseWork(t, names);
      SK.works.push({ id: 'w:' + p, type: 'work', kind: '작업지시서', title: w.title || p.split('/').pop(), file: p.split('/').pop(), rel: p, text: nfc(t), work: w, owner: w.owner, col: C.workCol(w.owner && staffOf(w.owner) ? colOf(w.owner) : ''),
        uses: SK.table ? C.workUses(t, p, SK.table.skills, SK.usageText) : [], t: 46, ht: 214 });
    }
    return { works: SK.works, skill: SK.table ? skillBook() : null };
  }
  const byFolder = (a, b) => a.folder.localeCompare(b.folder, 'ko') || a.id.localeCompare(b.id);
  const scriptSkills = () => (SK.table ? SK.table.skills.filter((s) => !s.info).sort(byFolder) : []);
  function skillBook() { return { id: 'skill', type: 'skill', kind: '스킬', title: '스킬책', count: scriptSkills().length, t: 58, ht: 200 }; }
  const people = () => C.orderStaff(SK.roster);
  const withSkills = () => people().filter((p) => scriptSkills().some((s) => s.staff.includes(p.name)));
  const colOf = (name) => { const s = staffOf(name); return (s && (LN().POINT || {})[s.key]) || '#9aa1ab'; };
  const short = (n) => (n === '바나 쌤' ? '바나' : n);
  const isMain = (name) => { const s = staffOf(name); return !!s && !s.id; };
  const agentOf = (name) => { const s = staffOf(name); return s && SK.agents ? SK.agents[s.key] || null : null; };
  const readOnly = () => pub() || !!(SK.shelf && SK.shelf.S.demo) || !(D() && typeof D().write === 'function');
  const roWhy = () => (pub() ? '직원 설명서 skills: 줄로 정해져요' : SK.shelf && SK.shelf.S.demo ? '시연 보기는 읽기만이에요' : '붙이기·떼기는 데스크톱 앱에서만 돼요');

  function spineHtml(b) {
    if (b.type === 'work') return '<i class="cap"></i><span class="pocket"><i class="chk"></i><span class="ti">' + esc(b.title) + '</span></span><i class="hole"></i><span class="ft">읽기만</span>';
    const ws = withSkills();
    const marks = ws.length ? ws.map((p) => '<i style="--p:' + colOf(p.name) + '"></i>').join('') : '<i class="none"></i>';
    return '<span class="tabs"><i></i><i></i></span><span class="stk">' + marks + '</span><span class="sf-lb"><span class="ti">스킬책</span></span><span class="ft">' + b.count + '</span>';
  }
  function spineLabel(b) {
    if (b.type === 'work') return '작업지시서 · ' + b.title + (b.owner ? ' · 담당 ' + b.owner : '') + ' (원본 자리에서 읽기만)';
    return '스킬책, 스킬 ' + b.count + '개, 가진 직원 ' + withSkills().map((p) => p.name).join(' ');
  }
  function hits(b, q) {
    const K = root.POShelfCore;
    if (b.type === 'work') return K.countHits(b.file, q) + K.countHits(b.text, q);
    return scriptSkills().concat(SK.table ? SK.table.skills.filter((s) => s.info) : []).filter((s) => K.hasHit(s.name + '\n' + s.id + '\n' + (SK.usage[s.folder] ? SK.usage[s.folder].what : ''), q)).length;
  }

  function tocPagesData() {
    const groups = people().map((p) => ({ p, items: scriptSkills().filter((s) => s.staff.includes(p.name)) }));
    const none = scriptSkills().filter((s) => !s.staff.length);
    const infos = SK.table ? SK.table.skills.filter((s) => s.info) : [];
    const P = SK.shelf.pageSize(), line = 20, cap0 = Math.floor((P.h - 56 - 110) / line), cap = Math.floor((P.h - 56) / line);
    const blocks = groups.map((g) => ({ g, n: 1.7 + Math.max(1, g.items.length) }));
    if (none.length) blocks.push({ none, n: 1.7 + none.length });
    if (infos.length) blocks.push({ infos, n: 1.7 + infos.length });
    const pages = [[]]; let used = 0, capNow = cap0;
    blocks.forEach((bk) => { if (used + bk.n > capNow && pages[pages.length - 1].length) { pages.push([]); used = 0; capNow = cap; } pages[pages.length - 1].push(bk); used += bk.n; });
    if (pages.length % 2 && SK.shelf.per() === 2) pages.push([]);
    return pages.map((bl, i) => ({ type: 'sktoc', first: i === 0, blocks: bl }));
  }
  function skillPages() {
    if (!SK.table) return [];
    if (SK.tab) return scriptSkills().filter((s) => s.staff.includes(SK.tab)).map((s) => ({ type: 'skill', id: s.id }));
    const toc = tocPagesData();
    return toc.concat(scriptSkills().map((s) => ({ type: 'skill', id: s.id })), SK.table.skills.filter((s) => s.info).map((s) => ({ type: 'skill', id: s.id })));
  }
  const tocCount = () => SK.shelf.S.pages.filter((p) => p.type === 'sktoc').length;
  const pageOfSkill = (id) => SK.shelf.S.pages.findIndex((p) => p.type === 'skill' && p.id === id);
  function workParsed(b) { return { blocks: b.work.sections.map((s) => ({ head: s.head, body: s.body, prompt: false })) }; }

  function pageHtml(p, side, i) {
    const b = SK.shelf.S.bk;
    if (p.type === 'sktoc') return tocHtml(p);
    if (p.type === 'skill') { const sk = SK.table && SK.table.skills.find((s) => s.id === p.id); return sk ? skillHtml(sk, side) : ''; }
    if (p.type === 'workL') return workLeft(b);
    if (p.type === 'workR') return workRight(b);
    return '';
  }
  function tocHtml(p) {
    const ln = (s) => { const n = pageOfSkill(s.id); return '<button class="sk-toc-ln" data-sa="go" data-id="' + esc(s.id) + '"><span>' + esc(s.name) + '</span><span>' + (n >= 0 ? n + 1 : '') + '</span></button>'; };
    const grp = (bk) => {
      if (bk.none) return '<div class="sk-grp"><div class="sk-grp-h"><i class="none"></i>아무에게도 안 붙음 <small>' + bk.none.length + '</small></div>' + bk.none.map(ln).join('') + '</div>';
      if (bk.infos) return '<div class="sk-grp"><div class="sk-grp-h"><i class="none solid"></i>설명 <small>붙이지 않음</small></div>' + bk.infos.map(ln).join('') + '</div>';
      const g = bk.g;
      return '<div class="sk-grp"><div class="sk-grp-h"><i style="--p:' + colOf(g.p.name) + '"></i>' + esc(g.p.name) + ' <small>' + esc(g.p.role) + ' · ' + g.items.length + '</small></div>' +
        (g.items.length ? g.items.map(ln).join('') : '<div class="sk-toc-none">' + (!pub() ? '아직 없음. 스킬 쪽에서 ＋ 붙이기' : g.p.name === guideName() ? 'Claude Code 본체라 모든 스킬을 그냥 써요' : '설명서에 미리 실린 스킬 없음') + '</div>') + '</div>';
    };
    const head = p.first ? '<h3 class="sk-toc-h">스킬책</h3><p class="sk-toc-lead">' + (pub() ? '이 사무실 .claude/skills 의 스킬 <b>' + scriptSkills().length + '개</b>. Claude Code에서 이 폴더를 열고 부르는 말을 붙여 넣으면 써요. 직원 이름 아래 스킬은 그 직원 설명서에 미리 실려 있어요.' : '직원이 쓰는 사내 스크립트 <b>' + scriptSkills().length + '개</b>. 붙이면 그 직원 카드에 버튼이 생기고, 떼면 사라집니다. 본문은 각 폴더 사용법.md에서 읽어요.') + '</p>' : '';
    return '<div class="sk-pg sk-toc">' + head + p.blocks.map(grp).join('') + '</div>';
  }
  const kbdify = (t) => esc(t).replace(/\[([^\]\n]{1,24})\]/g, '<kbd>$1</kbd>');
  function stamps(sk) {
    if (sk.info) return '<div class="sk-stamps"><span class="sk-stamp s-info">설명</span></div>';
    return '<div class="sk-stamps">' + sk.fence.map((f) => '<span class="sk-stamp s-' + C.FENCE[f] + '">' + esc(f) + '</span>').join('') + (sk.fenceNote ? '<span class="sk-stamp-note">' + esc(sk.fenceNote) + '</span>' : '') + '</div>';
  }
  const btnName = (sk) => { const d = sk.btn && T() && T().DEFS[sk.btn]; return d ? d.name : ''; };
  function skillHtml(sk, side) {
    const u = SK.usage[sk.folder];
    const copied = (k) => SK.copied === k;
    const desk = !!(D() && D().toolOpen);
    let h = '<div class="sk-pg"><div class="sk-hd"><div class="sk-nm"><h4>' + esc(sk.name) + '</h4><span class="cid' + (sk.claude ? '' : ' none') + '">' + esc(sk.claude || 'AI 직원용 스킬 없음') + '</span></div>' + stamps(sk) + '</div>';
    if (!u) h += '<p class="sk-sum dim">사용법.md 를 읽지 못했어요 (00_운영/도구/' + esc(sk.folder) + '/사용법.md).</p>';
    else {
      h += '<p class="sk-sum">' + esc(u.what) + '</p>';
      h += '<div class="sk-lab">' + (pub() ? '부르는 말' : '대표 명령') + '<span class="sk-acts">' + (pub() ? '' : '<button class="sk-mini" data-sa="open" data-id="' + esc(sk.id) + '"' + (desk ? '' : ' disabled title="데스크톱 앱에서만"') + '>사용법.md 열기</button>') +
        (u.cmd ? '<button class="sk-mini' + (copied('cmd' + sk.id) ? ' done' : '') + '" data-sa="cmd" data-id="' + esc(sk.id) + '">' + (copied('cmd' + sk.id) ? '복사됨' : '복사') + '</button>' : '') + '</span></div>' +
        (u.cmd ? '<pre class="sk-cmd">' + esc(u.cmd) + '</pre>' : '<p class="sk-sum dim">' + (pub() ? 'SKILL.md' : '사용법.md') + ' 에 코드 블록이 없어요.</p>');
      if (!pub()) h += '<div class="sk-lab">누가 실행' + (btnName(sk) && !sk.info ? '<button class="sk-mini" data-sa="card" data-id="' + esc(sk.id) + '"' + (sk.staff.some((n) => keyOf(n)) ? '' : ' disabled title="붙은 직원이 없어요"') + '>카드로 가기</button>' : '') + '</div>' +
        '<ul class="sk-who">' + (u.run.owner ? (root.PO_NM || String)('<li><b>당니님</b><span>') + kbdify(u.run.owner) + '</span></li>' : '') + (u.run.staff ? '<li><b>직원</b><span>' + kbdify(u.run.staff) + '</span></li>' : '') + '</ul>';
    }
    h += '<hr class="sk-hr">';
    if (sk.info) {
      const TT = T(), chips = TT && TT.AP && TT.AP.loaded ? [...new Set(TT.AP.list.map((id) => TT.AP.st[id].staff))] : [];
      h += '<div class="sk-lab">붙이는 스킬이 아닙니다</div><p class="sk-note">누가 어떤 연결을 쓸지는 직원 카드의 MCP 승인 칩이 정합니다(승인기록/연결표.json).' + (chips.length ? ' 지금 칩이 있는 직원:' : '') + '</p>' +
        (chips.length ? '<div class="sk-chips">' + people().filter((p) => chips.includes(p.name)).map((p) => '<span class="sk-who-chip still" style="--p:' + colOf(p.name) + '"><i></i>' + esc(short(p.name)) + '</span>').join('') + '</div>' : '');
    } else h += attHtml(sk, side);
    return h + '</div>';
  }
  function attHtml(sk, side) {
    const name = btnName(sk);
    let h = '<div class="sk-lab">' + (pub() ? '미리 아는 직원' : '붙은 직원') + '</div><p class="sk-note">' + (pub() ? '직원 설명서 머리 skills: 줄에 이 스킬이 있는 직원이에요. 다른 직원 일이어도 ' + esc(mainName()) + '(Claude Code)에게 말하면 써요.' : name ? '붙은 직원 카드에 <kbd>' + esc(name) + '</kbd> 버튼이 있습니다. 동그라미를 누르면 뗍니다.' : '카드 버튼이 없는 스킬이라(앱 밖 실행) 붙여도 카드는 그대로입니다. 차례와 AI 직원 부탁에만 쓰입니다.') + '</p><div class="sk-atts">';
    if (sk.staff.length) h += sk.staff.map((w) => attRow(sk, w)).join('');
    else h += '<div class="sk-att empty"><span class="sk-who-chip"><i></i>없음</span><div class="sk-ai"><span class="st st-na">아무에게도 안 붙음</span></div></div>';
    if (sk.claude && SK.agentsKnown) people().filter((p) => !sk.staff.includes(p.name) && !isMain(p.name)).forEach((p) => {
      const a = agentOf(p.name); if (!a || !a.skills.includes(sk.claude)) return;
      const k = 'd' + p.name + sk.id;
      h += '<div class="sk-att ghost"><span class="sk-who-chip" style="--p:' + colOf(p.name) + '"><i></i>' + esc(short(p.name)) + '</span><div class="sk-ai"><span class="st st-only">AI 직원 설명서에만 있음</span>' +
        '<button class="sk-mini' + (SK.copied === k ? ' done' : '') + '" data-sa="askd" data-id="' + esc(sk.id) + '" data-who="' + esc(p.name) + '">' + (SK.copied === k ? '복사됨' : '뗄 부탁 문장 복사') + '</button><small>스킬책에 붙이면 맞춰지고, 아니면 토리에게 떼 달라고 부탁하세요.</small></div></div>';
    });
    h += '</div>';
    if (!(SK.confirm && SK.confirm.id === sk.id)) {
      const ro = readOnly(), can = C.canAttach(sk);
      if (can && !pub()) h += '<button class="sk-add" data-sa="pick" data-id="' + esc(sk.id) + '" aria-haspopup="dialog"' + (ro ? ' disabled title="' + esc(roWhy()) + '"' : '') + '>＋ 붙이기</button>';
    }
    return h;
  }
  function attRow(sk, who) {
    const ro = readOnly();
    const ai = C.aiState(sk, { name: who, main: isMain(who), agent: agentOf(who), agentsKnown: SK.agentsKnown });
    if (SK.confirm && SK.confirm.id === sk.id && SK.confirm.who === who) {
      const name = btnName(sk);
      return '<div class="sk-att"><div class="sk-confirm" role="alertdialog" aria-label="떼기 확인"><p><b>' + esc(who) + '</b>에게서 뗄까요?' + (name ? '<br>' + esc(who) + ' 카드의 <b>[' + esc(name) + ']</b> 버튼도 사라집니다.' : '') +
        (ai.st === 'yes' ? '<br>AI 직원 설명서에는 남아 있으니, 뗀 뒤 부탁 문장을 복사해 토리에게 주세요.' : '') + '</p><div class="row"><button class="sk-mini danger" data-sa="detach" data-id="' + esc(sk.id) + '" data-who="' + esc(who) + '">떼기</button><button class="sk-mini" data-sa="cancel">그대로 두기</button></div></div></div>';
    }
    const k = who + sk.id;
    let a = '<span class="st st-' + ai.st + '">' + esc(ai.txt) + '</span>';
    if (ai.st === 'no') a += '<button class="sk-mini' + (SK.copied === k ? ' done' : '') + '" data-sa="ask" data-id="' + esc(sk.id) + '" data-who="' + esc(who) + '">' + (SK.copied === k ? '복사됨' : '부탁 문장 복사') + '</button>';
    if (ai.why) a += '<small>' + esc(ai.why) + '</small>';
    if (sk.claude && !isMain(who) && SK.agentsKnown && agentOf(who) && !C.canRun(agentOf(who))) a += '<small>직접 실행 못 함 → ' + esc(mainName()) + '가 돌림</small>';
    const known = !!staffOf(who);
    return '<div class="sk-att"><button class="sk-who-chip" style="--p:' + colOf(who) + '" data-sa="askdetach" data-id="' + esc(sk.id) + '" data-who="' + esc(who) + '"' + (ro ? ' disabled title="' + esc(roWhy()) + '"' : ' title="누르면 떼기"') + ' aria-label="' + esc(who) + (ro ? '' : ', 누르면 떼기') + '"><i></i>' + esc(short(who)) + (ro ? '' : '<span class="x" aria-hidden="true">×</span>') + '</button><div class="sk-ai">' + (known ? a : '<span class="st st-only">명부에 없는 이름</span>') + '</div></div>';
  }
  function pickHtml(sk, P, n) {
    const name = btnName(sk);
    const rows = people().map((p) => {
      const on = sk.staff.includes(p.name), a = agentOf(p.name);
      let note = on ? '붙어 있음' : '';
      if (!on && sk.block[p.name]) note = '카드만 (AI 직원은 안 붙임)';
      else if (!on && sk.claude && SK.agentsKnown && a && !C.canRun(a)) note = mainName() + '가 대신 돌림';
      return '<li><button style="--p:' + colOf(p.name) + '" data-sa="attach" data-id="' + esc(sk.id) + '" data-who="' + esc(p.name) + '"' + (on ? ' disabled' : '') + '><i></i><span>' + esc(p.name) + '<small>' + esc(p.role) + '</small></span><em>' + esc(note) + '</em></button></li>';
    }).join('');
    const pi = pageOfSkill(sk.id), onLeft = pi % 2 === 0;
    const left = n === 1 ? 12 + (P.w - 316) / 2 : 12 + (onLeft ? P.w : 0) + (P.w - 316) / 2;
    return '<div class="sk-pick" role="dialog" aria-label="' + esc(sk.name) + ' 붙일 직원 고르기" style="left:' + Math.round(left) + 'px;top:' + (n === 1 ? 150 : 60) + 'px"><h5>' + esc(sk.name) + ', 누구에게 붙일까요?</h5><ul>' + rows + '</ul>' +
      '<p class="foot">' + (name ? '누르면 바로 붙고 그 직원 카드에 <b>[' + esc(name) + ']</b> 버튼이 생깁니다. ' : '카드 버튼이 없는 스킬이라 카드는 그대로입니다. ') + '스킬표.json에 저장돼요. AI 직원에게는 따로 부탁 문장으로.</p></div>';
  }
  function workLeft(b) {
    const w = b.work, all = SK.table ? SK.table.skills : [];
    const owners = w.owners.map((n) => '<span class="sk-who-chip still sm" style="--p:' + colOf(n) + '"><i></i>' + esc(short(n)) + '</span>').join('');
    const toc = SK.table ? tocPagesData().length : 0;
    const uses = b.uses.map((id) => { const s = all.find((x) => x.id === id); return s ? '<button data-sa="wuse" data-id="' + esc(id) + '">' + esc(s.name) + ' · 스킬책 ' + (toc + scriptSkills().indexOf(s) + 1) + '쪽</button>' : ''; }).join('');
    const copied = SK.copied === 'p' + b.rel;
    return '<div class="sk-pg"><div class="wo-kicker"><span>작업지시서</span><span class="ro">원본 자리에서 읽기만</span></div><h3 class="wo-h">' + esc(w.title) + '</h3>' +
      (owners ? '<div class="wo-kicker">' + owners + '<span>순서에 적힌 담당</span></div>' : '') +
      (w.lead ? '<p class="wo-lead">' + esc(w.lead) + '</p>' : '') +
      (uses ? '<div class="sk-lab" style="margin-top:20px">쓰는 스킬</div><div class="wo-uses">' + uses + '</div>' : '') +
      '<div class="wo-path">사본을 만들지 않고 이 파일을 그대로 읽습니다. 고치려면 원본을 고치세요.<br><code>' + esc(b.rel) + '</code> <button class="sk-mini' + (copied ? ' done' : '') + '" data-sa="wcopy" data-path="' + esc(b.rel) + '">' + (copied ? '복사됨' : '경로 복사') + '</button></div></div>';
  }
  function workRight(b) {
    const st = b.work.steps;
    return '<div class="sk-pg"><div class="sk-lab" style="margin-top:0">순서 <span class="aside">체크는 원본 파일에서</span></div>' +
      (st.length ? '<ul class="wo-list">' + st.map((s) => '<li><i class="' + (s.done ? 'on' : '') + '" aria-label="' + (s.done ? '끝남' : '안 끝남') + '"></i><span>' + s.no + '. ' + esc(s.text) + '</span>' +
        (s.owner ? '<span class="dm" title="' + esc(s.note) + '"><i style="--p:' + colOf(s.owner) + '"></i>' + esc(short(s.owner)) + '</span>' : '<span></span>') + '</li>').join('') + '</ul>' : '<p class="sk-note">"## 순서" 절에 체크 칸이 없어요.</p>') + '</div>';
  }

  function buildPages(b) {
    if (b.type === 'skill') { SK.pick = null; SK.confirm = null; return skillPages(); }
    b.parsed = workParsed(b);
    const text = SK.shelf.paginate(b, SK.shelf.pageSize());
    return [{ type: 'workL' }, { type: 'workR' }].concat(text.map((pcs) => ({ type: 'text', pcs })));
  }
  function tabsHtml(a, n) {
    const tc = tocCount();
    return '<div class="sf-tabsix sk-tabs" role="group" aria-label="차례와 직원"><button data-sa="tab" data-who="" aria-current="' + (!SK.tab && a < tc) + '">차례</button>' +
      withSkills().map((p) => '<button style="--p:' + colOf(p.name) + '" data-sa="tab" data-who="' + esc(p.name) + '" aria-current="' + (SK.tab === p.name) + '" title="' + esc(p.name) + ' 스킬만">' + esc(short(p.name)) + '</button>').join('') + '</div>';
  }
  function footNum(a, n) {
    const S = SK.shelf.S, total = S.pages.length;
    if (!total) return SK.tab ? SK.tab + ' 스킬이 없어요' : '빈 책';
    const rng = (n === 2 && S.pages[a + 1] ? (a + 1) + '–' + (a + 2) : String(a + 1));
    if (SK.tab) return SK.tab + ' 스킬 ' + total + '개 중 ' + rng;
    if (a < tocCount()) return '차례 · 스킬 ' + scriptSkills().length + '개';
    return rng + ' / ' + total;
  }
  const footKeys = () => (SK.tab ? '<span>옆 탭 "차례"로 거르기 풀기</span>' : '');
  function overlay(P, n) {
    let h = '';
    const sk = SK.pick && SK.table && SK.table.skills.find((s) => s.id === SK.pick);
    if (sk) h += pickHtml(sk, P, n);
    if (SK.toast) h += '<div class="sk-toast' + (SK.toast.err ? ' err' : '') + '" role="status">' + esc(SK.toast.msg) + (SK.toast.undo && !readOnly() ? '<button data-sa="undo">되돌리기</button>' : '') + '</div>';
    return h;
  }
  function bookSub(b) {
    if (b.type === 'work') return '작업지시서 · 읽기만';
    if (pub()) return '.claude/skills · 읽기만';
    return '00_운영/도구 · 스킬표.json' + (readOnly() ? ' · ' + roWhy() : '');
  }

  function rerender(focusSel) {
    SK.shelf.renderBook();
    if (focusSel) { const f = SK.shelf.S.el.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
  }
  function goSkill(id) {
    const S = SK.shelf.S;
    if (SK.tab) { SK.tab = ''; S.pages = skillPages(); }
    const i = pageOfSkill(id); if (i < 0) return;
    S.dir = 1; S.spread = Math.floor(i / SK.shelf.per()); SK.pick = null; SK.confirm = null;
    rerender('.sk-pg [data-sa="cmd"][data-id="' + cssEsc(id) + '"]');
  }
  const cssEsc = (s) => (root.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));
  async function copy(text, key) {
    await SK.shelf.copyText(text);
    SK.copied = key; rerender();
    setTimeout(() => { if (SK.copied === key) { SK.copied = ''; if (SK.shelf.S.view === 'book') rerender(); } }, 1400);
  }
  let toastT = null;
  function toast(msg, opt) {
    SK.toast = Object.assign({ msg }, opt || {});
    clearTimeout(toastT); toastT = setTimeout(() => { SK.toast = null; if (SK.shelf.S.view === 'book' && SK.shelf.S.bk && SK.shelf.S.bk.type === 'skill') rerender(); }, 8000);
  }
  async function change(id, who, on, opt) {
    opt = opt || {};
    if (readOnly() || SK.busy) return false;
    SK.busy = true;
    try {
      const t = await readText(C.TABLE_PATH);
      const p = t == null ? { ok: false, error: '스킬표.json 을 읽지 못했어요.' } : C.parseTable(t);
      if (!p.ok) { toast('저장하지 못했어요: ' + p.error, { err: true }); return false; }
      const r = C.withStaff(p.raw, id, who, on);
      if (r.error) { toast(r.error, { err: true }); return false; }
      const text = C.serialize(r.raw);
      if (r.changed) await FS.writeText(C.TABLE_PATH, text);
      SK.table = C.parseTable(text); SK.err = '';
      applyCards();
      const S = SK.shelf.S, a0 = S.spread;
      S.pages = skillPages(); S.spread = Math.min(a0, Math.max(0, Math.ceil(S.pages.length / SK.shelf.per()) - 1));
      const sk = SK.table.skills.find((s) => s.id === id), name = btnName(sk);
      if (!opt.undo) {
        SK.last = { id, who, on };
        toast(on ? who + (name ? ' 카드에 [' + name + '] 버튼을 달았어요.' : '에게 붙였어요.') : who + (name ? ' 카드에서 [' + name + '] 버튼을 뗐어요.' : '에게서 뗐어요.'), { undo: true });
      } else { SK.last = null; toast('되돌렸어요.'); }
      SK.shelf.refreshSpine();
      return true;
    } catch (e) {
      toast('저장하지 못했어요: ' + (e && e.message || e), { err: true });
      return false;
    } finally { SK.busy = false; }
  }
  async function onClick(t) {
    const a = t.dataset.sa; if (!a) return false;
    const S = SK.shelf.S;
    const sk = t.dataset.id && SK.table ? SK.table.skills.find((s) => s.id === t.dataset.id) : null;
    const who = t.dataset.who;
    if (a === 'go') { goSkill(t.dataset.id); return true; }
    if (a === 'tab') {
      SK.tab = who || ''; SK.pick = null; SK.confirm = null;
      S.pages = skillPages(); S.spread = 0; S.dir = 1;
      rerender('.sk-tabs [data-who="' + cssEsc(SK.tab) + '"]'); return true;
    }
    if (a === 'cmd' && sk) { copy(SK.usage[sk.folder].cmd, 'cmd' + sk.id); return true; }
    if (a === 'open' && sk && D() && D().toolOpen) { const r = await D().toolOpen(C.usagePath(sk.folder)); if (r && !r.ok) { toast(r.error || '열지 못했어요', { err: true }); rerender(); } return true; }
    if (a === 'card' && sk) { goCard(sk); return true; }
    if (a === 'ask' && sk) { copy(C.askAttach(sk, who), who + sk.id); return true; }
    if (a === 'askd' && sk) { copy(C.askDetach(sk, who), 'd' + who + sk.id); return true; }
    if (a === 'pick' && sk) { if (readOnly()) return true; SK.pick = SK.pick === sk.id ? null : sk.id; SK.confirm = null; rerender(SK.pick ? '.sk-pick button:not([disabled])' : '[data-sa="pick"][data-id="' + cssEsc(sk.id) + '"]'); return true; }
    if (a === 'attach' && sk) { SK.pick = null; await change(sk.id, who, true); rerender('.sk-toast button'); return true; }
    if (a === 'askdetach' && sk) { if (readOnly()) return true; SK.confirm = { id: sk.id, who }; SK.pick = null; rerender('.sk-confirm .danger'); return true; }
    if (a === 'cancel') { const c = SK.confirm; SK.confirm = null; rerender(c ? '.sk-who-chip[data-who="' + cssEsc(c.who) + '"][data-id="' + cssEsc(c.id) + '"]' : null); return true; }
    if (a === 'detach' && sk) { SK.confirm = null; await change(sk.id, who, false); rerender('.sk-toast button'); return true; }
    if (a === 'undo' && SK.last) { const l = SK.last; await change(l.id, l.who, !l.on, { undo: true }); rerender(); return true; }
    if (a === 'wuse') { await SK.shelf.openBook('skill', { focus: false }); goSkill(t.dataset.id); return true; }
    if (a === 'wcopy') { copy(t.dataset.path, 'p' + t.dataset.path); return true; }
    return true;
  }
  async function goCard(sk) {
    const k = sk.staff.map(keyOf).find(Boolean); if (!k || !root.POApp) return;
    root.POApp.selectTab('cards');
    for (let i = 0; i < 60; i++) {
      const b = document.querySelector('#cards .ec-chip[data-key="' + cssEsc(sk.btn) + '"][data-staff="' + cssEsc(k) + '"]');
      if (b) { b.scrollIntoView({ block: 'center' }); b.focus({ preventScroll: true }); return; }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  function escape() {
    if (SK.pick || SK.confirm) { const f = SK.pick ? '[data-sa="pick"][data-id="' + cssEsc(SK.pick) + '"]' : null; SK.pick = null; SK.confirm = null; rerender(f); return true; }
    return false;
  }
  function onKey(e) {
    if (!SK.pick) return false;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;
    const bs = [...SK.shelf.S.el.querySelectorAll('.sk-pick button:not([disabled])')]; if (!bs.length) return true;
    const i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
    e.preventDefault();
    return true;
  }
  function closed() { SK.pick = null; SK.confirm = null; SK.toast = null; SK.tab = ''; SK.last = null; }
  function bind(shelfApi) { SK.shelf = shelfApi; }

  root.POSkills = { S: SK, load, scanShelf, bind, spineHtml, spineLabel, hits, buildPages, pageHtml, tabsHtml, footNum, footKeys, overlay, bookSub, onClick, escape, onKey, closed, change, applyCards, readAgents };
})(window);
