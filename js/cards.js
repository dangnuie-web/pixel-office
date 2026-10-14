(function (root) {
  'use strict';
  const D = () => root.PODesktop;
  const TU = () => root.POToolsUI;
  const LN = root.PO_LINES;
  const pub = () => root.PO_PUBLIC === true;
  const pubStaff = () => pub() && !!D() && typeof D().staffState === 'function';
  let lastMsg = '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AWARDS = { organizer: ["'26.09 우수사원"] };
  const MEDAL = '<svg viewBox="0 0 12 14" width="22" height="26" shape-rendering="crispEdges" aria-hidden="true">' +
    '<rect x="2" y="0" width="3" height="5" fill="#3f6fb5"/><rect x="7" y="0" width="3" height="5" fill="#d8513f"/><rect x="5" y="0" width="2" height="5" fill="#f3f4f6"/>' +
    '<rect x="3" y="5" width="6" height="1" fill="#8a6a1e"/><rect x="2" y="6" width="8" height="7" fill="#8a6a1e"/><rect x="3" y="13" width="6" height="1" fill="#8a6a1e"/>' +
    '<rect x="3" y="6" width="6" height="7" fill="#f2c641"/><rect x="3" y="6" width="6" height="1" fill="#fbe08a"/><rect x="3" y="7" width="1" height="5" fill="#fbe08a"/>' +
    '<rect x="5" y="8" width="2" height="3" fill="#c9971a"/><rect x="4" y="9" width="4" height="1" fill="#c9971a"/></svg>';
  function awards(key) {
    if (pub()) return '';
    return (AWARDS[key] || []).map((t) => '<span class="ec-award" tabindex="0" aria-label="' + esc(t) + '">' + MEDAL + '<span class="ec-tip">' + esc(t) + '</span></span>').join('');
  }
  const PLACE = { desk: '자리에서 일하는 중', meeting: '회의실', break: '휴게실', avatar: '당니님 곁' };

  async function agentFiles() {
    if (!D() || pub()) return { on: new Set(), off: new Set(), fired: new Set(), desc: {} };
    const on = new Set(), off = new Set(), fired = new Set(), desc = {};
    const scan = async (dir, set) => {
      let list = [];
      try { if ((await D().kind(dir)) !== 'directory') return; list = await D().list(dir); } catch (e) { return; }
      for (const f of list) {
        if (f.kind !== 'file' || !/\.md$/.test(f.name)) continue;
        const key = f.name.replace(/\.md$/, '');
        set.add(key);
        try {
          const t = (await D().read(dir + '/' + f.name)).text;
          const m = t.match(/^description:\s*(.+)$/m); if (m) desc[key] = m[1].trim();
        } catch (e) {  }
      }
    };
    await scan('.claude/agents', on); await scan('.claude/보관', off); await scan('.claude/해고', fired);
    return { on, off, fired, desc };
  }
  async function leaveSet() { const a = await agentFiles(); return new Set([...a.off, ...a.fired].filter((k) => !a.on.has(k))); }
  const DIR = { on: '.claude/agents', leave: '.claude/보관', fire: '.claude/해고' };

  const spriteOf = (key) => (key === OWNER_KEY ? (LN.ownerSprite ? LN.ownerSprite() : 'avatar_idle') : LN.SPRITE[key]);
  function pixelSrc(key) { const k = spriteOf(key); return k && root.POSprites.has(k) ? root.POSprites.frameCanvas(k, 0).toDataURL() : ''; }
  function face(key) {
    const src = LN.portraitSrc(spriteOf(key)), px = pixelSrc(key);
    if (src) return '<img class="ec-face ec-photo" alt="" src="' + esc(src) + '" data-px="' + esc(px) + '">';
    return px ? '<img class="ec-face" alt="" src="' + px + '">' : '';
  }
  const OWNER_KEY = 'dangnee';
  const OWNER = { key: OWNER_KEY, name: '당니님', title: '당니', role: '대표', animal: '', place: '', mark: '', latest: null, isOwner: true };
  function md(t) { return t.slice(5, 10).replace('-', '/') + ' ' + t.slice(11); }

  async function render(el, app) {
    el.innerHTML = '<p class="pj-loading">읽는 중…</p>';
    const st = app.result && app.result.state;
    if (!st) { el.innerHTML = '<p class="pj-err">명부를 읽지 못했어요.</p>'; return; }
    const a = await agentFiles();
    let ps = null;
    if (pubStaff()) { try { ps = await D().staffState(); } catch (e) { ps = null; } if (ps && !ps.ok) ps = null; }
    if (root.POSkills && app.handle && !pub()) { try { await root.POSkills.load(app.handle); } catch (e) {  } }
    const recs = (st.records || []).slice().sort((x, y) => y.t - x.t);
    const card = (s) => {
      const mine = recs.filter((r) => r.names.includes(s.name));
      const where = a.on.has(s.key) ? 'on' : a.fired.has(s.key) ? 'fire' : a.off.has(s.key) ? 'leave' : null;
      const leave = where === 'leave', fired = where === 'fire';
      const busy = s.place === 'desk' || s.place === 'meeting';
      const oriNow = !busy ? '자료보관실 청소 중' : /계획/.test((s.latest && s.latest.memo) || '') ? '정리 계획서 쓰는 중' : '책꽂이 정리 중';
      const status = s.isOwner ? '당니오피스 대표' : s.isTori && !pub() ? '메인 (휴직·해고 없음)' : fired ? '해고' : leave ? '휴직 중' : root.POCore.charOf(s) === 'organizer' ? oriNow : (PLACE[s.place] || '');
      const b = (act, label, from, to) => '<button class="ec-btn ' + act + '" data-key="' + esc(s.key) + '" data-name="' + esc(s.name) + '" data-act="' + act + '" data-from="' + from + '" data-to="' + to + '">' + label + '</button>';
      const pb = (act, label) => '<button class="ec-btn p' + act + '" data-key="' + esc(s.key) + '" data-name="' + esc(s.name) + '" data-pact="' + act + '">' + label + '</button>';
      const btn = ps ? (s.isOwner || s.auto ? '' : '<div class="ec-btns">' + pb('rename', '이름 바꾸기') + (s.isTori ? '' : pb('fire', '해고')) + '</div>') :
        !D() || s.isTori || s.isOwner || !where ? '' : '<div class="ec-btns">' +
        (where === 'on' ? b('leave', '휴직', 'on', 'leave') + b('fire', '해고', 'on', 'fire') : where === 'leave' ? b('back', '복직', 'leave', 'on') : b('back', '재고용', 'fire', 'on')) + '</div>';
      return '<article class="ec-card' + (leave ? ' off' : '') + (fired ? ' fired' : '') + (s.isOwner ? ' owner' : '') + '" data-key="' + esc(s.key) + '" style="--pc:' + (s.isOwner ? '#262a31' : LN.POINT[s.key] || '#9aa1ab') + '">' +
        '<div class="ec-top"><div class="ec-portrait">' + face(s.key) + '</div><div class="ec-id"><h3>' + esc(s.title || s.name) + awards(s.key) + '</h3>' +
        '<div class="ec-role">' + esc([s.role === s.name ? '' : s.role, s.animal].filter(Boolean).join(' · ')) + '</div>' +
        '<span class="ec-status' + (leave ? ' off' : '') + (fired ? ' fired' : '') + '">' + esc(status) + (s.mark ? ' <b>' + esc(s.mark) + '</b>' : '') + '</span></div>' + (ps ? '' : btn) + '</div>' +
        (ps && btn ? btn.replace('class="ec-btns"', 'class="ec-btns ec-prow"') : '') +
        (ps && !s.isOwner && !s.isTori && !s.auto && ps.agents.indexOf(s.key) < 0 ? '<p class="ec-desc ec-noagent">직원 설명서(.claude/agents/' + esc(s.key) + '.md)가 없어요. 이 직원 일은 비서가 대신해요.</p>' : '') +
        (a.desc[s.key] ? '<p class="ec-desc">' + esc(a.desc[s.key].replace(/^당니오피스\s*/, '')) + '</p>' : '') +
        (!st.hasRecords ? '' : '<div class="ec-stats"><span><b>' + mine.length + '</b>기록</span><span><b>' + mine.filter((r) => r.statusWord === '완료').length + '</b>완료</span><span>' +
        (mine[0] ? '마지막 ' + esc(md(mine[0].time)) : '기록 없음') + '</span></div>' +
        '<ul class="ec-recent">' + mine.slice(0, 3).map((r) => '<li><i class="st-' + esc(r.statusWord) + '">' + esc(r.statusWord) + '</i>' + esc(r.memo) + '</li>').join('') + '</ul>') +
        waysHtml(s, fired || leave) +
        (TU() && !fired && !leave ? TU().cardTools(s.key) : '') +
        '</article>';
    };
    const inRoster = new Set(st.staff.map((s) => s.key));
    const extra = [...new Set([...a.on, ...a.off, ...a.fired])].filter((k) => !inRoster.has(k) && k !== 'secretary').map((k) => {
      const m = (a.desc[k] || '').match(/당니오피스\s+(.+?)\s+(\S+?)\(([^)]+)\)/);
      return { key: k, name: m ? m[2] : k, role: m ? m[1] : '', animal: m ? m[3] : '', place: '', mark: '', latest: null };
    });
    const all = st.staff.concat(extra);
    const isFired = (s) => a.fired.has(s.key) && !a.on.has(s.key);
    const working = all.filter((s) => !isFired(s)), firedList = all.filter(isFired);
    const cards = [OWNER].concat(working).map(card).join('') + (firedList.length ? '</div><h2 class="pj-h2">해고된 직원 <span class="ec-note">설명서는 .claude/해고에 남아 있어요. 다시 필요하면 재고용</span></h2><div class="ec-grid">' + firedList.map(card).join('') : '');
    const cands = ps ? ps.hireable.filter((h) => !st.staff.some((x) => x.id === h.id || x.animal === h.animal)) : [];
    const hireHtml = !ps ? '' : '</div><h2 class="pj-h2">고용할 수 있는 직원 <span class="ec-note">고용하면 명부(CLAUDE.md)에 줄이 생기고 .claude/agents 에 직원 설명서가 생겨요</span></h2><div class="ec-grid">' +
      (cands.length ? cands.map((h) => { const back = ps.fired.indexOf(h.id) >= 0;
        return '<article class="ec-card ec-cand" data-key="' + esc(h.id) + '" style="--pc:' + (LN.POINT[h.id] || '#9aa1ab') + '"><div class="ec-top"><div class="ec-portrait">' + face(h.id) + '</div><div class="ec-id"><h3>' + esc(h.job) + '</h3><div class="ec-role">' + esc(h.animal) + '</div>' +
          '<span class="ec-status">' + (back ? '해고했던 직원 · 다시 고용하면 설명서가 되살아나요' : '아직 고용 안 함') + '</span></div>' +
          '<div class="ec-btns"><button class="ec-btn phire" data-key="' + esc(h.id) + '" data-name="' + esc(h.job) + '" data-animal="' + esc(h.animal) + '" data-back="' + (back ? 1 : '') + '" data-pact="hire">고용</button></div></div></article>'; }).join('') :
        '<p class="ec-note">일곱 동물이 모두 출근했어요.</p>');
    const note = pub() ? (ps ? '이름 바꾸기·해고·고용은 사무실 폴더의 CLAUDE.md 명부와 .claude 직원 설명서에 바로 적혀요. 해고해도 지우지 않아요(.claude/해고).' + (lastMsg ? '<br><b class="ec-done">' + esc(lastMsg) + '</b>' : '') : '') : D() ? '휴직(나중에 쓸 직원)·해고(쓸모없어 보이는 직원) 모두 Claude Code가 부르지 않아요. 지우지 않으니 복직·재고용 가능. 새 대화부터 적용.' +
      (root.POTools && root.POTools.desktop() ? '<br>카드 아래 칸진 버튼은 그 직원의 스크립트예요. 직원을 부르지 않고 바로 돌려서 토큰이 들지 않아요.' : '') : '휴직·해고·도구 버튼은 데스크톱 앱에서만 할 수 있어요.';
    el.innerHTML = '<div class="pj-head"><h2>직원 카드</h2>' + (note ? '<p class="ec-note">' + note + '</p>' : '') + '</div>' +
      '<div class="ec-grid">' + (root.PONames ? root.PONames.sub(cards) : cards) + hireHtml + '</div><div class="ec-modal" hidden></div>';
    el.querySelectorAll('.ec-btn').forEach((b) => b.addEventListener('click', () => (b.dataset.pact ? pubAct(el, app, b.dataset) : confirmAct(el, app, b.dataset))));
    lastMsg = '';
    bindWays(el, app);
    if (TU()) { if (root.POTools) root.POTools.init(); TU().bindCardTools(el); }
    el.querySelectorAll('img.ec-photo').forEach((img) => {
      const fb = () => { if (img.dataset.px) { img.src = img.dataset.px; img.className = 'ec-face'; } else img.remove(); };
      img.onerror = fb; if (img.complete && img.naturalWidth === 0) fb();
    });
  }

  function waysHtml(s, off) {
    const SW = root.POStaffWays, W = !off && !s.isOwner && SW ? SW.waysOf(s) : null;
    if (!W) return '';
    return '<div class="ec-ways" data-key="' + esc(s.key) + '"><p class="ec-ways-t">일 맡기는 두 길</p><div class="ec-ways-btns">' +
      '<button class="ec-way now" data-way="now" data-key="' + esc(s.key) + '">바로 하기 · ' + esc(W.label) + '</button>' +
      '<button class="ec-way ai" data-way="ai" data-key="' + esc(s.key) + '">AI에게 맡기기</button></div>' +
      '<p class="ec-ex">' + (W.guide ? 'Claude Code에서 이 폴더를 열고 그냥 말하면 돼요. 예: ' : 'Claude Code에서 이 폴더를 열고 이렇게 말해요: ') + '<q>' + esc(SW.example(s, 0)) + '</q></p>' +
      '<p class="ec-way-msg" aria-live="polite" hidden></p></div>';
  }
  function bindWays(el, app) {
    const st = app.result && app.result.state, SW = root.POStaffWays;
    if (!st || !SW) return;
    el.querySelectorAll('.ec-way').forEach((b) => b.addEventListener('click', async () => {
      const s = st.staff.find((x) => x.key === b.dataset.key); if (!s) return;
      if (b.dataset.way === 'now') { SW.doNow(s); return; }
      const r = await SW.askAI(s), msg = b.closest('.ec-ways').querySelector('.ec-way-msg');
      msg.textContent = r.ok ? '복사했어요. ' + SW.PASTE : '복사하지 못했어요. 위 문장을 직접 적어 주세요.';
      msg.classList.toggle('bad', !r.ok); msg.hidden = false;
    }));
  }

  const ACT = {
    leave: { t: '휴직', msg: '지금은 안 쓰고 나중에 쓸 직원이에요. 설명서를 .claude/보관 으로 옮겨요.' },
    fire: { t: '해고', msg: '쓸모없어 보이는 직원이에요. 설명서를 .claude/해고 로 옮겨요. 지우지 않으니 나중에 재고용할 수 있어요.' },
    back: { t: '복귀', msg: '설명서를 .claude/agents 로 되돌려요. 새 대화부터 다시 부를 수 있어요.' },
  };
  function confirmAct(el, app, d) {
    if (pub()) return;
    const m = el.querySelector('.ec-modal');
    const A = ACT[d.act], label = d.from === 'fire' ? '재고용' : d.from === 'leave' ? '복직' : A.t;
    m.innerHTML = '<div class="ec-dialog"><h3>' + esc(d.name) + ' ' + label + '할까요?</h3><p>' + esc(A.msg) + '</p>' +
      '<div class="ec-row"><button class="ec-no">취소</button><button class="ec-yes ' + d.act + '">' + label + '</button></div><p class="ec-err"></p></div>';
    m.hidden = false;
    m.querySelector('.ec-no').onclick = () => { m.hidden = true; };
    m.querySelector('.ec-yes').onclick = async () => {
      try {
        await D().move(DIR[d.from] + '/' + d.key + '.md', DIR[d.to] + '/' + d.key + '.md');
        m.hidden = true;
        app.leave = await leaveSet();
        if (root.POGame.G.entered) { root.POGame.place(); root.POGame.rebuildTags(); }
        render(el, app);
      } catch (e) { m.querySelector('.ec-err').textContent = '못 했어요: ' + e.message; }
    };
  }

  const PACT = {
    hire: (d) => ({ t: d.name + '(' + d.animal + ') 고용할까요?', yes: '고용', input: '', ph: d.name,
      msg: '명부(CLAUDE.md)에 줄이 생기고 .claude/agents/' + d.key + '.md 직원 설명서가 생겨요.' + (d.back ? ' 해고 때 옮겨 둔 설명서를 되살려요.' : '') + ' 이름을 비우면 "' + d.name + '"(으)로 불러요.' }),
    rename: (d) => ({ t: d.name + ' 이름 바꾸기', yes: '바꾸기', input: d.name, ph: '',
      msg: '명부 이름이 바뀌어요. 직원 설명서는 직접 고치지 않았을 때만 새 이름으로 바꾸고, 고친 글은 그대로 둬요.' }),
    fire: (d) => ({ t: d.name + ' 해고할까요?', yes: '해고', input: null,
      msg: '명부에서 빼고, 직원 설명서는 .claude/해고 로 옮겨요. 지우지 않으니 다시 고용하면 되살아나요.' }),
  };
  const AGENT_SAY = { created: '설명서를 새로 만들었어요', restored: '설명서를 되살렸어요', 'restored-renamed': '설명서를 되살려 새 이름으로 바꿨어요', kept: '있던 설명서를 그대로 썼어요',
    moved: '설명서는 .claude/해고 로 옮겼어요', rewritten: '설명서도 새 이름으로 바꿨어요', 'kept-edited': '고친 설명서는 그대로 뒀어요', none: '', same: '' };
  function pubAct(el, app, d) {
    if (!pubStaff()) return;
    const m = el.querySelector('.ec-modal'), A = PACT[d.pact](d);
    m.innerHTML = '<div class="ec-dialog" role="dialog" aria-label="' + esc(A.t) + '"><h3>' + esc(A.t) + '</h3><p>' + esc(A.msg) + '</p>' +
      (A.input !== null ? '<input class="ec-in" maxlength="20" autocomplete="off" spellcheck="false" value="' + esc(A.input) + '" placeholder="' + esc(A.ph) + '" aria-label="이름">' : '') +
      '<div class="ec-row"><button class="ec-no">취소</button><button class="ec-yes ' + (d.pact === 'fire' ? 'fire' : 'back') + '">' + A.yes + '</button></div><p class="ec-err"></p></div>';
    m.hidden = false;
    const inp = m.querySelector('.ec-in'), yes = m.querySelector('.ec-yes');
    const close = () => { m.hidden = true; };
    m.querySelector('.ec-no').onclick = close;
    m.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); yes.click(); } };
    (inp || yes).focus();
    yes.onclick = async () => {
      yes.disabled = true;
      const name = inp ? inp.value.trim() : '';
      let r;
      try { r = await (d.pact === 'hire' ? D().staffHire({ id: d.key, name }) : d.pact === 'rename' ? D().staffRename({ id: d.key, name }) : D().staffFire({ id: d.key })); } catch (e) { r = { ok: false, error: e.message }; }
      if (!r || !r.ok) { yes.disabled = false; m.querySelector('.ec-err').textContent = '못 했어요: ' + ((r && r.error) || '알 수 없는 오류'); return; }
      const who = d.pact === 'fire' ? d.name : (r.staff || []).find((x) => x.id === d.key);
      lastMsg = (d.pact === 'hire' ? (who ? who.name : d.name) + ' 고용했어요' : d.pact === 'rename' ? (who ? who.name : '') + '(으)로 이름을 바꿨어요' : d.name + ' 해고했어요') + (AGENT_SAY[r.agent] ? '. ' + AGENT_SAY[r.agent] : '') + '. Claude Code는 새 대화부터 바뀐 직원을 알아요.';
      close();
      try { await app.compute(); const G = root.POGame && root.POGame.G; if (G && G.entered && app.result && app.result.state) root.POGame.setData(app.result); } catch (e) {  }
      render(el, app);
    };
  }

  root.POCards = { render, leaveSet };
})(window);
