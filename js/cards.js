(function (root) {
  'use strict';
  const D = () => root.PODesktop;
  const TU = () => root.POToolsUI;
  const LN = root.PO_LINES;
  const pub = () => root.PO_PUBLIC === true;
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
      const btn = !D() || s.isTori || s.isOwner || !where ? '' : '<div class="ec-btns">' +
        (where === 'on' ? b('leave', '휴직', 'on', 'leave') + b('fire', '해고', 'on', 'fire') : where === 'leave' ? b('back', '복직', 'leave', 'on') : b('back', '재고용', 'fire', 'on')) + '</div>';
      return '<article class="ec-card' + (leave ? ' off' : '') + (fired ? ' fired' : '') + (s.isOwner ? ' owner' : '') + '" data-key="' + esc(s.key) + '" style="--pc:' + (s.isOwner ? '#262a31' : LN.POINT[s.key] || '#9aa1ab') + '">' +
        '<div class="ec-top"><div class="ec-portrait">' + face(s.key) + '</div><div class="ec-id"><h3>' + esc(s.title || s.name) + awards(s.key) + '</h3>' +
        '<div class="ec-role">' + esc([s.role === s.name ? '' : s.role, s.animal].filter(Boolean).join(' · ')) + '</div>' +
        '<span class="ec-status' + (leave ? ' off' : '') + (fired ? ' fired' : '') + '">' + esc(status) + (s.mark ? ' <b>' + esc(s.mark) + '</b>' : '') + '</span></div>' + btn + '</div>' +
        (a.desc[s.key] ? '<p class="ec-desc">' + esc(a.desc[s.key].replace(/^당니오피스\s*/, '')) + '</p>' : '') +
        (!st.hasRecords ? '' : '<div class="ec-stats"><span><b>' + mine.length + '</b>기록</span><span><b>' + mine.filter((r) => r.statusWord === '완료').length + '</b>완료</span><span>' +
        (mine[0] ? '마지막 ' + esc(md(mine[0].time)) : '기록 없음') + '</span></div>' +
        '<ul class="ec-recent">' + mine.slice(0, 3).map((r) => '<li><i class="st-' + esc(r.statusWord) + '">' + esc(r.statusWord) + '</i>' + esc(r.memo) + '</li>').join('') + '</ul>') +
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
    const note = pub() ? '' : D() ? '휴직(나중에 쓸 직원)·해고(쓸모없어 보이는 직원) 모두 Claude Code가 부르지 않아요. 지우지 않으니 복직·재고용 가능. 새 대화부터 적용.' +
      (root.POTools && root.POTools.desktop() ? '<br>카드 아래 칸진 버튼은 그 직원의 스크립트예요. 직원을 부르지 않고 바로 돌려서 토큰이 들지 않아요.' : '') : '휴직·해고·도구 버튼은 데스크톱 앱에서만 할 수 있어요.';
    el.innerHTML = '<div class="pj-head"><h2>직원 카드</h2>' + (note ? '<p class="ec-note">' + note + '</p>' : '') + '</div>' +
      '<div class="ec-grid">' + (root.PONames ? root.PONames.sub(cards) : cards) + '</div><div class="ec-modal" hidden></div>';
    el.querySelectorAll('.ec-btn').forEach((b) => b.addEventListener('click', () => confirmAct(el, app, b.dataset)));
    if (TU()) { if (root.POTools) root.POTools.init(); TU().bindCardTools(el); }
    el.querySelectorAll('img.ec-photo').forEach((img) => {
      const fb = () => { if (img.dataset.px) { img.src = img.dataset.px; img.className = 'ec-face'; } else img.remove(); };
      img.onerror = fb; if (img.complete && img.naturalWidth === 0) fb();
    });
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

  root.POCards = { render, leaveSet };
})(window);
