(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const FLAG = 'po.firstRun';
  const D = () => root.PODesktop;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STAFF = () => (root.POCore && root.POCore.PUBLIC_STAFF) || [];
  const spriteOf = (id) => root.PO_LINES && root.PO_LINES.SPRITE && root.PO_LINES.SPRITE[id];
  const BAD_CH = /[|()[\]:\u0000-\u001f\u007f]/g;
  const isGuideP = (p) => !!p && p.char === '토리';
  const portraitOf = (id) => { const k = spriteOf(id); return k && k.replace(/_idle$/, '_portrait'); };
  const photoOf = (id) => (root.PO_LINES && root.PO_LINES.portraitSrc ? root.PO_LINES.portraitSrc(spriteOf(id)) : null);
  const SHOW = { Documents: '문서', Desktop: '데스크탑', Downloads: '다운로드' };
  const baseName = (p) => { const s = String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(p || ''); return SHOW[s] || s; };
  const lastTwo = (p) => String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).slice(-2).map(baseName).join(' / ');
  const josaNum = (n) => ('2459'.includes(String(n).slice(-1)) ? '를' : '을');
  const STEPS_NEW = [['place', '자리'], ['names', '이름'], ['staff', '직원'], ['enter', '입장']];

  let st = null, built = false, raf = 0, SC = 3, enterT0 = 0, hop = {}, last = -1, on = false;
  const ghostCache = {};

  function fresh() {
    const v = root.PONames ? root.PONames.raw() : { officeName: '', bossName: '' };
    return { step: 'welcome', from: 'new', office: v.officeName || '', boss: v.bossName || '', staff: STAFF().map((p) => ({ name: '', on: isGuideP(p) })),
      parent: '', folder: '', placeErr: '', openErr: null, enterErr: '', busy: false, officePath: '' };
  }
  const officeName = () => (st.office.trim() || '픽셀') + ' 오피스';
  const bossName = () => (st.boss.trim() || '픽셀') + '님';
  const shown = (i) => st.staff[i].name.trim() || STAFF()[i].job;
  const hired = () => st.staff.map((s, i) => Object.assign({}, s, { i })).filter((s) => s.on);

  function ss() { try { return root.sessionStorage || null; } catch (e) { return null; } }
  function setAfter(v) { const s = ss(); try { if (s) { if (v) s.setItem(FLAG, v); else s.removeItem(FLAG); } } catch (e) {  } }
  function takeAfter() { const s = ss(); let v = null; try { if (s) { v = s.getItem(FLAG); s.removeItem(FLAG); } } catch (e) { v = null; } return v === 'enter' || v === 'open' ? v : null; }

  function build() {
    if (built) return;
    built = true;
    $('firstrun').innerHTML = `<div class="fr">
      <section class="fr-stage" aria-label="만들고 있는 사무실 미리보기">
        <div class="fr-scene" id="fr-scene">
          <canvas id="fr-cv" width="192" height="240" role="img" aria-label="만들고 있는 사무실"></canvas>
          <div class="fr-sign" id="fr-sign" aria-hidden="true"><span></span></div>
          <div id="fr-tags" aria-hidden="true"></div>
        </div>
      </section>
      <section class="fr-side">
        <div class="fr-inner">
          <ol class="fr-steps" id="fr-steps" aria-label="진행 단계"></ol>
          <div class="fr-card" id="fr-card" aria-live="polite"></div>
        </div>
      </section>
    </div>`;
    $('fr-card').addEventListener('click', onClick);
    $('fr-card').addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);
    root.addEventListener('resize', () => { if (on) fit(); });
  }

  const POS = [[88, 150], [34, 62], [88, 62], [142, 62], [34, 106], [88, 106], [142, 106]];
  const DOOR = { x: 88, y: 204 }, IN_Y = 176;
  const reduce = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  let ctx = null;
  function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function plant(x, y) {
    R(x + 2, y, 8, 1, '#29262F'); R(x + 1, y + 1, 10, 7, '#29262F'); R(x + 2, y + 1, 8, 6, '#6fae5a'); R(x + 3, y + 2, 2, 1, '#9fd37f'); R(x + 6, y + 4, 2, 1, '#4f8f45');
    R(x + 2, y + 8, 8, 7, '#29262F'); R(x + 3, y + 8, 6, 6, '#f4f5f7'); R(x + 3, y + 13, 6, 1, '#c9ccd2');
  }
  function room(dark) {
    R(0, 0, 192, 240, '#26292f');
    R(6, 10, 180, 222, '#29262F'); R(7, 11, 178, 220, '#f4f5f7');
    R(11, 15, 170, 212, '#29262F');
    R(12, 16, 168, 26, '#e9ecf0'); R(12, 16, 168, 2, '#f7f8fa'); R(12, 40, 168, 2, '#c9ced5');
    ctx.save(); ctx.beginPath(); ctx.rect(12, 42, 168, 184); ctx.clip();
    for (let y = 42; y < 226; y += 16) for (let x = 12; x < 180; x += 16) {
      R(x, y, 16, 16, ((x - 12 + y - 42) / 16) % 2 ? '#dcdfe3' : '#e1e4e8'); R(x, y, 16, 1, '#d2d6db'); R(x, y, 1, 16, '#d2d6db');
    }
    ctx.restore();
    [[22, 21], [144, 21]].forEach(([x, y]) => { R(x, y, 26, 14, '#29262F'); R(x + 1, y + 1, 24, 12, '#a9d3ef'); R(x + 12, y + 1, 1, 12, '#29262F'); R(x + 3, y + 3, 4, 1, '#e6f4fd'); R(x + 15, y + 3, 3, 1, '#e6f4fd'); });
    R(62, 19, 68, 18, '#29262F'); R(63, 20, 66, 16, '#323846');
    plant(15, 44); plant(165, 44);
    R(82, 226, 28, 6, '#f4f5f7'); R(82, 226, 1, 6, '#29262F'); R(109, 226, 1, 6, '#29262F');
    R(83, 227, 26, 5, dark ? '#F2C641' : '#b9bec6');
    if (dark) {
      R(6, 10, 180, 222, `rgba(14,16,20,${dark})`);
      R(83, 227, 26, 5, '#F2C641');
      ctx.fillStyle = 'rgba(242,198,65,.16)'; ctx.beginPath(); ctx.moveTo(83, 227); ctx.lineTo(109, 227); ctx.lineTo(124, 186); ctx.lineTo(68, 186); ctx.fill();
    }
  }
  function spr(key, frame, x, y, ghost) {
    const S = root.POSprites;
    const c = S && S.frameCanvas(key, frame);
    if (!c) return;
    if (!ghost) { ctx.drawImage(c, x, y); return; }
    const gk = key + '#' + frame;
    if (!ghostCache[gk]) {
      const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
      const gx = g.getContext('2d'); gx.drawImage(c, 0, 0); gx.globalCompositeOperation = 'source-in'; gx.fillStyle = '#c3c8cf'; gx.fillRect(0, 0, g.width, g.height);
      ghostCache[gk] = g;
    }
    ctx.drawImage(ghostCache[gk], x, y);
  }
  function tag(x, y, html, boss) { return `<div class="fr-tag${boss ? ' boss' : ''}" style="left:${(x + 8) * SC}px;top:${(y - 1) * SC}px">${html}</div>`; }
  const lit = () => ({ welcome: 0.8, open: 0.8, openErr: 0.8, place: 0.42 }[st.step] || 0);
  const named3 = () => st.step === 'names' || st.step === 'staff' || st.step === 'enter';
  function draw(t) {
    const cv = $('fr-cv'); if (!cv) return;
    ctx = cv.getContext('2d');
    const s = st.step;
    room(lit());
    let T = '';
    if (s === 'staff' || s === 'enter') st.staff.forEach((m, i) => {
      const p = STAFF()[i]; if (!p || !POS[i]) return;
      const [x, y] = POS[i], has = !!m.on;
      if (!has && s === 'enter') return;
      const dy = hop[i] && t - hop[i] < 240 ? -2 : 0;
      spr(spriteOf(p.id), 0, x, y + dy, !has);
      if (has) T += tag(x, y + dy, esc(shown(i)) + (m.name.trim() && m.name.trim() !== p.job ? `<small>${esc(p.job)}</small>` : ''));
    });
    const idleF = Math.floor(t / 500) % 2;
    let x = DOOR.x, y = DOOR.y, key = 'bossavatar_idle', f = idleF;
    if (s === 'enter') {
      const dt = Math.max(0, t - enterT0);
      const k = reduce() ? 1 : Math.min(1, dt / 1400);
      y = Math.round(DOOR.y - (DOOR.y - IN_Y) * k);
      if (k < 1) { key = 'bossavatar_walk_up'; f = [0, 1, 2, 1][Math.floor(dt / 150) % 4]; }
    }
    spr(key, f, x, y);
    if (named3()) T += tag(x, y, esc(bossName()), true);
    const tags = $('fr-tags'); if (tags.innerHTML !== T) tags.innerHTML = T;
    const sign = $('fr-sign');
    sign.style.opacity = named3() ? 1 : 0;
    sign.firstChild.textContent = officeName();
  }
  function fit() {
    const stage = document.querySelector('.fr-stage'), cv = $('fr-cv'), sign = $('fr-sign');
    if (!stage || !cv) return;
    const narrow = root.innerWidth <= 820;
    const h = narrow ? 480 : stage.clientHeight - 32, w = (narrow ? root.innerWidth : stage.clientWidth) - 32;
    SC = Math.max(2, Math.min(3, Math.floor(h / 240), Math.floor(w / 192)));
    cv.style.width = 192 * SC + 'px'; cv.style.height = 240 * SC + 'px';
    Object.assign(sign.style, { left: 63 * SC + 'px', top: 20 * SC + 'px', width: 66 * SC + 'px', height: 16 * SC + 'px', fontSize: Math.round(5.4 * SC) + 'px', padding: `0 ${2 * SC}px` });
  }
  function loop(t) {
    if (!on) { raf = 0; return; }
    const b = Math.floor(t / 50); if (b !== last) { last = b; draw(t); }
    raf = root.requestAnimationFrame(loop);
  }

  function foot(left, right) { return `<div class="fr-foot">${left}<span class="sp"></span>${right}</div>`; }
  const errBox = (html) => `<div class="fr-err" role="alert"><div>${html}</div></div>`;
  const VIEWS = {
    welcome: () => `
      <h1>픽셀 오피스에 오신 걸 환영해요</h1>
      <p class="fr-desc">사무실은 내 컴퓨터의 폴더 하나예요.<br>프로젝트, 아이디어, 일정이 그 안에 파일로 쌓여요.</p>
      <div class="fr-choices">
        <button class="fr-choice main" data-go="place"><div><b>새 사무실 만들기</b><span>빈 사무실 폴더를 새로 만들어요</span></div><i>처음이라면</i></button>
        <button class="fr-choice" data-go="open"><div><b>이미 만든 사무실 열기</b><span>전에 만든 사무실 폴더를 골라요</span></div><i>다른 컴퓨터에서 옮겨 왔다면</i></button>
      </div>`,
    place: () => {
      const n = st.folder && st.folder !== '픽셀 오피스' ? st.folder.replace(/^픽셀 오피스 /, '') : '';
      const res = st.folder ? `<p class="fr-result">만들 폴더: ${esc(baseName(st.parent))} / <b>${esc(st.folder)}</b>${n ? `<br>"픽셀 오피스"가 이미 있어서 이름 뒤에 ${esc(n)}${josaNum(n)} 붙였어요.` : ''}<br>폴더는 마지막에 [입장하기]를 누를 때 만들어요.</p>` : '';
      return `
      <h1>사무실을 둘 곳을 골라 주세요</h1>
      <p class="fr-desc">고른 곳 안에 새 폴더를 하나 만들어요. 그 자리에 있던 파일은 건드리지 않아요.</p>
      <div class="fr-path"><div class="fr-path-box" title="${esc(st.parent)}"><small>둘 곳</small><span>${st.parent ? esc(baseName(st.parent)) : '…'}</span></div><button class="fr-btn" data-act="pick">다른 곳 고르기</button></div>
      ${res}${st.placeErr ? errBox(esc(st.placeErr)) : ''}
      ${foot('<button class="fr-btn ghost" data-go="welcome">이전</button>', `<button class="fr-btn pri" data-go="names"${st.folder ? '' : ' disabled'}>다음</button>`)}`;
    },
    names: () => `
      <h1>이름을 정해 주세요</h1>
      <p class="fr-desc">앞 이름만 바꿔요. 비워 두면 "픽셀 오피스", "픽셀님"이 돼요. 설정에서 언제든 바꿀 수 있어요.</p>
      <div class="st-row"><div class="st-lb">오피스 이름<small>최대 10자</small></div>
        <div class="st-fieldline"><label class="st-name sp"><input id="fr-office" maxlength="10" placeholder="픽셀" value="${esc(st.office)}" autocomplete="off" aria-label="오피스 이름"><span class="st-tail">오피스</span></label></div></div>
      <div class="st-row"><div class="st-lb">대표 이름<small>최대 8자</small></div>
        <div class="st-fieldline"><label class="st-name"><input id="fr-boss" maxlength="8" placeholder="픽셀" value="${esc(st.boss)}" autocomplete="off" aria-label="대표 이름"><span class="st-tail">님</span></label></div></div>
      ${foot('<button class="fr-btn ghost" data-go="place">이전</button>', '<span class="fr-key">Enter 다음</span><button class="fr-btn pri" data-go="staff">다음</button>')}`,
    staff: () => `
      <h1>함께 일할 직원을 정해 주세요</h1>
      <p class="fr-desc">동물마다 맡는 일이 정해져 있어요. 고용할 직원을 고르고 이름을 지어 주세요.<br>이름을 비워 두면 직업 이름으로 불러요.</p>
      <div class="fr-staff-head"><span id="fr-staff-n"></span></div>
      <ul class="fr-staff">${STAFF().map((m, i) => { const g = isGuideP(m), id = 'fr-hire-' + i; const ph = photoOf(m.id); return `<li data-i="${i}"${g ? ' class="guide"' : ''}><span class="fr-face" aria-hidden="true"><canvas width="48" height="48"></canvas>${ph ? `<img class="fr-photo" src="${esc(ph)}" alt="">` : ''}</span>
        <div class="fr-job"><b>${esc(m.job)}</b><small>${esc(m.animal)}</small></div>
        <label class="fr-hire" for="${id}"><input type="checkbox" id="${id}" data-k="on"${st.staff[i].on ? ' checked' : ''}${g ? ' disabled' : ''} aria-label="${esc(m.job)} ${esc(m.animal)} 고용"><span>${g ? '늘 함께' : '고용'}</span></label>
        <input class="fr-in nm" data-k="name" maxlength="8" placeholder="${esc(m.job)}" aria-label="${esc(m.job)} 이름" value="${esc(st.staff[i].name)}" autocomplete="off"></li>`; }).join('')}</ul>
      ${foot('<button class="fr-btn ghost" data-go="names">이전</button>', '<button class="fr-btn" data-go="enter" data-act="skip">건너뛰기</button><button class="fr-btn pri" data-go="enter">다음</button>')}`,
    enter: () => {
      const n = hired(), open = st.from === 'open';
      return `
      <h1>${esc(officeName())}에 들어가 볼까요?</h1>
      <p class="fr-desc">방향키로 걷고, 직원 앞에서 Space를 누르면 말을 걸 수 있어요.</p>
      <dl class="fr-sum">
        <dt>폴더</dt><dd>${esc(open ? lastTwo(st.officePath) : baseName(st.parent) + ' / ' + st.folder)}</dd>
        <dt>대표</dt><dd>${esc(bossName())}</dd>
        <dt>직원</dt><dd>${n.length ? n.length + '명 <small>' + n.map((m) => esc(shown(m.i))).join(', ') + '</small>' : '아직 없어요 <small>직원 카드에서 언제든 정해요</small>'}</dd>
      </dl>
      <div class="fr-enter"><button class="game" data-act="enter"${st.busy ? ' disabled' : ''}>${st.busy ? '들어가는 중…' : '입장하기'}</button>
        <span class="fr-key">${open ? '' : '누르면 폴더를 만들고 들어가요'}</span></div>
      ${st.enterErr ? errBox(esc(st.enterErr)) : ''}
      ${foot(`<button class="fr-btn ghost" data-go="${open ? 'open' : 'staff'}">이전</button>`, '')}`;
    },
    open: () => `
      <h1>사무실 폴더를 골라 주세요</h1>
      <p class="fr-desc">전에 픽셀 오피스로 만든 폴더를 골라요. 고른 폴더는 다음부터 자동으로 열려요.</p>
      <button class="fr-btn pri" data-act="pick-open">폴더 고르기</button>
      ${foot('<button class="fr-btn ghost" data-go="welcome">이전</button>', '')}`,
    openErr: () => {
      const e = st.openErr || {};
      const msg = e.noMarker ? `"${esc(e.name || '고른')}" 폴더에는 사무실이 없어요. 안에 <code>CLAUDE.md</code> 파일과 <code>10_프로젝트</code> 폴더가 있는 폴더를 골라 주세요.` : esc(e.error || '폴더를 열지 못했어요.');
      return `
      <h1>사무실 폴더를 골라 주세요</h1>
      <p class="fr-desc">전에 픽셀 오피스로 만든 폴더를 골라요. 고른 폴더는 다음부터 자동으로 열려요.</p>
      <button class="fr-btn pri" data-act="pick-open">다시 고르기</button>
      ${errBox(msg)}
      ${foot('<button class="fr-btn ghost" data-go="welcome">이전</button>', '<button class="fr-link" data-go="place">새 사무실을 만들까요?</button>')}`;
    },
  };
  function autoW(el) {
    const s = el.value || el.placeholder;
    const em = [...s].reduce((a, c) => a + (/[ㄱ-힝]/.test(c) ? 1 : 0.58), 0) + 0.3;
    el.style.width = Math.min(10.5, Math.max(2.6, em)) + 'em';
  }
  function paintStaffList() {
    const card = $('fr-card');
    card.querySelectorAll('.fr-staff li').forEach((li) => {
      const i = +li.dataset.i, cv = li.querySelector('canvas'), c = cv.getContext('2d');
      const S = root.POSprites, pk = portraitOf(STAFF()[i].id);
      const src = S && (S.has(pk) ? S.frameCanvas(pk, 0) : S.frameCanvas(spriteOf(STAFF()[i].id), 0));
      c.clearRect(0, 0, 48, 48); if (src) c.drawImage(src, Math.floor((48 - src.width) / 2), Math.floor((48 - src.height) / 2));
      const ph = li.querySelector('img.fr-photo'), face = li.querySelector('.fr-face');
      if (ph && !ph.dataset.bound) {
        ph.dataset.bound = '1';
        const ok = () => face.classList.add('photo'), bad = () => { face.classList.remove('photo'); ph.remove(); };
        if (ph.complete) { if (ph.naturalWidth > 0) ok(); else bad(); } else { ph.addEventListener('load', ok); ph.addEventListener('error', bad); }
      }
      li.classList.toggle('on', !!st.staff[i].on);
      const cb = li.querySelector('[data-k=on]'); if (cb) cb.checked = !!st.staff[i].on;
    });
    const n = $('fr-staff-n'); if (n) n.textContent = `${hired().length}명 출근 / ${STAFF().length}명`;
  }
  function go(step, focus) {
    if (step === 'welcome') st.from = 'new';
    if (step === 'place') { st.from = 'new'; if (!st.folder) peek(); }
    if (step === 'open') st.from = 'open';
    if (step === 'enter') { enterT0 = root.performance.now(); st.enterErr = ''; }
    st.step = step;
    const idx = STEPS_NEW.findIndex((s) => s[0] === step);
    const stepsEl = $('fr-steps');
    stepsEl.hidden = idx < 0 || st.from === 'open';
    stepsEl.innerHTML = STEPS_NEW.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"${i === idx ? ' aria-current="step"' : ''}>${s[1]}</li>`).join('');
    render(focus);
  }
  function render(focus) {
    const card = $('fr-card');
    card.innerHTML = VIEWS[st.step]();
    if (st.step === 'staff') paintStaffList();
    card.querySelectorAll('.st-name input').forEach(autoW);
    if (focus !== false) { const f = card.querySelector('input, .fr-choice, button.game, .fr-btn.pri:not(:disabled)'); if (f) f.focus({ preventScroll: true }); }
  }

  async function peek() {
    try {
      const r = await D().officePickParent({ peek: true });
      if (r && r.ok) { st.parent = r.parent; st.folder = r.folder; st.placeErr = ''; } else { st.placeErr = (r && r.error) || '둘 곳을 읽지 못했어요. 다른 곳을 골라 주세요.'; }
    } catch (e) { st.placeErr = '둘 곳을 읽지 못했어요: ' + (e && e.message || e); }
    if (st.step === 'place') render(false);
  }
  async function pickParent() {
    let r;
    try { r = await D().officePickParent(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.canceled) return;
    if (r && r.ok) { st.parent = r.parent; st.folder = r.folder; st.placeErr = ''; } else st.placeErr = (r && r.error) || '그 폴더는 쓸 수 없어요.';
    if (st.step === 'place') render();
  }
  async function pickOpen() {
    setAfter('open');
    let r;
    try { r = await D().officePick(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.ok) return;
    setAfter(null);
    if (r && r.canceled) return;
    st.openErr = { noMarker: !!(r && r.noMarker), name: r && r.name, error: r && r.error };
    go('openErr');
  }
  function staffInput() {
    return hired().map((m) => {
      const p = STAFF()[m.i];
      return { name: m.name.replace(BAD_CH, '').trim() || p.job, id: p.id, role: p.job, animal: p.animal };
    });
  }
  async function enterNew() {
    if (st.busy) return;
    st.busy = true; st.enterErr = ''; render(false);
    if (root.PONames) root.PONames.save({ officeName: st.office, bossName: st.boss });
    setAfter('enter');
    let r;
    try { r = await D().makeOffice({ officeName: officeName(), ownerName: st.boss.trim() || '픽셀', staff: staffInput() }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.ok) return;
    setAfter(null);
    st.busy = false; st.enterErr = (r && r.error) || '사무실을 만들지 못했어요.';
    if (r && r.path) st.enterErr += ' (' + r.path + ')';
    render(false);
  }
  async function enterOpened() {
    if (st.busy) return;
    st.busy = true; render(false);
    const N = root.PONames;
    if (N) { const raw = N.raw(); const part = {}; if (!raw.officeName && st.office) part.officeName = st.office; if (!raw.bossName && st.boss) part.bossName = st.boss; if (Object.keys(part).length) N.save(part); }
    finish();
  }
  function finish() {
    on = false;
    const app = $('app'); if (app) app.classList.remove('fr-mode');
    if (root.POApp) root.POApp.onEnter();
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'skip') st.staff.forEach((s, i) => { s.name = ''; s.on = isGuideP(STAFF()[i]); });
    if (act === 'pick') { pickParent(); return; }
    if (act === 'pick-open') { pickOpen(); return; }
    if (act === 'enter') { if (st.from === 'open') enterOpened(); else enterNew(); return; }
    if (b.dataset.go) go(b.dataset.go);
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'fr-office' || t.id === 'fr-boss' || t.classList.contains('fr-in')) {
      const v = t.value.replace(BAD_CH, ''); if (v !== t.value) t.value = v;
    }
    if (t.id === 'fr-office') { st.office = t.value; autoW(t); }
    if (t.id === 'fr-boss') { st.boss = t.value; autoW(t); }
    const li = t.closest('.fr-staff li');
    if (li) {
      const i = +li.dataset.i, was = !!st.staff[i].on, p = STAFF()[i];
      if (t.dataset.k === 'on') st.staff[i].on = isGuideP(p) || !!t.checked;
      else { st.staff[i].name = t.value; if (t.value.trim()) st.staff[i].on = true; }
      if (!was && st.staff[i].on) hop[i] = root.performance.now();
      paintStaffList();
    }
  }
  function onKey(e) {
    if (!on || st.busy || !(root.POApp && root.POApp.screen === 'firstrun')) return;
    const next = { place: 'names', names: 'staff', staff: 'enter' }, back = { place: 'welcome', names: 'place', staff: 'names', open: 'welcome', openErr: 'welcome' };
    if (e.key === 'Enter' && next[st.step] && !(e.target && e.target.tagName === 'BUTTON')) {
      e.preventDefault();
      if (st.step === 'place' && !st.folder) return;
      go(next[st.step]);
    } else if (e.key === 'Escape' && back[st.step]) { e.preventDefault(); go(back[st.step]); }
  }

  async function loadOpened() {
    try { const o = await D().officeGet(); st.officePath = (o && o.path) || ''; } catch (e) { st.officePath = ''; }
    let text = '';
    try { const h = await root.POFS.loadHandle(); text = (await root.POFS.readText(h, 'CLAUDE.md')).text; } catch (e) { text = ''; }
    const raw = root.PONames ? root.PONames.raw() : { officeName: '', bossName: '' };
    const title = (/^# (.+)$/m.exec(text) || [])[1] || '';
    const tm = /^(.{1,10}) 오피스$/.exec(title.trim());
    if (!raw.officeName && tm) st.office = tm[1];
    const bm = /^## 대표\s*\n+- (.+?)$/m.exec(text);
    if (!raw.bossName && bm) { const b = bm[1].trim().replace(/님$/, ''); if (b && b.length <= 8) st.boss = b; }
    if (root.POCore && text) {
      const roster = root.POCore.parseRoster(text).staff;
      STAFF().forEach((p, i) => {
        const m = roster.find((s) => s.id === p.id) || roster.find((s) => s.animal === p.animal);
        if (m) st.staff[i] = { name: m.name === p.job ? '' : m.name, on: true };
      });
    }
  }

  async function start(step, opts) {
    build();
    st = fresh(); hop = {};
    if (opts && opts.from === 'open') { st.from = 'open'; await loadOpened(); }
    const app = $('app'); if (app) app.classList.add('fr-mode');
    on = true;
    fit();
    if (step === 'enter' && st.from === 'open') { st.step = 'enter'; enterT0 = root.performance.now(); $('fr-steps').hidden = true; render(); } else go(step || 'welcome');
    if (!raf) raf = root.requestAnimationFrame(loop);
  }
  function stop() { on = false; const app = $('app'); if (app) app.classList.remove('fr-mode'); }

  root.POFirstRun = { start, stop, takeAfter, setAfter, FLAG, isOn: () => on, state: () => st };
})(window);
