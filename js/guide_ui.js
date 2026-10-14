(function (root) {
  'use strict';
  const GC = () => root.POGuideCore;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'po.guide.seen';
  const nn = (i) => String(i + 1).padStart(2, '0');

  function seenSet() { try { const a = JSON.parse(root.localStorage.getItem(KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); } }
  function markSeen(name) { const s = seenSet(); if (s.has(name)) return; s.add(name); try { root.localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {  } }
  function firstUnseen(g) { const s = seenSet(); const i = g.chapters.findIndex((c) => !s.has(c.name)); return i < 0 ? 0 : i; }

  const URLS = {};
  function art(key, frame) {
    const k = key + '#' + frame; if (k in URLS) return URLS[k];
    const S = root.POSprites; let u = '';
    try {
      if (S && S.has(key)) { const c = S.frameCanvas(key, frame), d = document.createElement('canvas'); d.width = c.width * 2; d.height = c.height * 2; const x = d.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, d.width, d.height); u = 'url(' + d.toDataURL() + ')'; }
    } catch (e) { u = ''; }
    URLS[k] = u; return u;
  }
  function vars() { return '--g-mark-0:' + art('guide_mark', 0) + ';--g-mark-1:' + art('guide_mark', 1) + ';--g-state-0:' + art('guide_state', 0) + ';--g-state-1:' + art('guide_state', 1); }

  function spine(b, o) {
    const g = b.gd || (b.gd = GC().parse(b.text)), s = seenSet(), n = g.chapters.length;
    const seen = g.chapters.filter((c) => s.has(c.name)).length, done = n > 0 && seen === n, part = GC().partStart(g);
    const lab = '처음 안내 · ' + n + '장 중 ' + seen + '장 봄';
    return '<button class="sf-bk k-guide' + (done ? ' done' : '') + '" style="--t:48px;--ht:262px;--c:#EEEDE8;--sh:#C7C3BB;--hi:#FFFFFF;' + vars() + '" data-id="' + esc(b.id) + '" tabindex="-1" aria-label="' + esc(lab) + '" title="' + esc(lab) + '">' +
      '<i class="gmark" aria-hidden="true"></i><span class="gti"><b>처음 안내</b></span><span class="glad" aria-hidden="true">' +
      g.chapters.map((c, i) => '<i class="' + (s.has(c.name) ? 'on' : '') + (i === part && i > 0 ? ' part' : '') + '"></i>').join('') + '</span>' +
      '<span class="ft">' + seen + '/' + n + '</span>' + (o && o.flag ? '<span class="flag">' + o.flag + '</span>' : '') + '</button>';
  }

  const links = (h) => h.replace(/\[([^\]\n]+)\]\((https:\/\/[^)\s"<>]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  function mdLite(t) {
    const out = []; let tbl = null;
    const bold = (x) => links(esc(x)).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const flush = () => { if (tbl) { out.push('<table class="gd-tb">' + tbl.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + bold(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>'); tbl = null; } };
    String(t || '').split('\n').forEach((l) => {
      if (/^\|/.test(l)) { if (/^\|[\s:|-]+\|$/.test(l)) return; (tbl = tbl || []).push(l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); return; }
      flush(); if (l.trim()) out.push('<p>' + bold(l) + '</p>');
    });
    flush();
    return out.join('');
  }
  const bq = (x) => links(esc(x)).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]\n]{1,30})\]/g, '<kbd>$1</kbd>');
  function tocHtml(g, cur, canDrop) {
    const s = seenSet(), part = GC().partStart(g);
    return '<div class="gd-toc"><h1>처음 안내</h1><p class="lead">보고 싶은 장을 누르면 오른쪽에 열려요. 1~' + (part > 0 ? part : g.chapters.length) + '장은 AI 없이 앱만으로 돼요.</p><ol class="gd-list">' +
      g.chapters.map((c, i) => { const pages = g.pages.filter((p) => p.ch === c.name).length;
        return '<li class="' + (i === cur ? 'now' : s.has(c.name) ? 'seen' : '') + (i === part && i > 0 ? ' part' : '') + '" data-gd-ch="' + i + '" role="button" tabindex="0" aria-current="' + (i === cur) + '"><span class="n">' + nn(i) + '</span><span class="t">' + esc(c.name) + '</span><span class="d">' + (pages > 1 ? pages + '쪽' : '') + '</span><i class="s" aria-hidden="true"></i></li>'; }).join('') +
      '</ol><div class="gd-throw"><span>다 봤으면 책을 버려도 돼요. 설정에서 다시 꽂을 수 있어요.</span>' + (canDrop ? '<button data-guide-drop="1">버리기</button>' : '') + '</div><span class="gd-msg" aria-live="polite"></span></div>';
  }
  function chapterHtml(g, cur, canDrop) {
    const c = g.chapters[cur]; if (!c) return '';
    const pages = g.pages.filter((p) => p.ch === c.name), many = pages.length > 1;
    const steps = coachSteps(pages);
    return '<div class="gd-ch"><span class="no">' + nn(cur) + ' / ' + String(g.chapters.length).padStart(2, '0') + '</span><h2>' + esc(c.name) + '</h2><div class="gd-chbody">' +
      pages.map((p) => '<section class="gd-pg">' + (many ? '<h3>' + esc(p.tag) + '</h3>' : '') +
        (p.gif ? '<div class="gd-video"><img src="' + esc(GC().gifSrc(p.gif)) + '" alt="' + esc(p.tag) + ' 영상" data-gd-gif="' + esc(p.gif) + '"><span class="none"><i class="pl"></i>' + esc(p.gif.replace(/\.gif$/, '')) + '</span></div>' : '') +
        (p.desc ? '<p class="gd-desc">' + bq(p.desc) + '</p>' : '') +
        (p.bubble ? '<p class="gd-say"><b>따라 하기</b> ' + bq(p.bubble) + '</p>' : '') +
        (p.body ? '<div class="gd-body">' + mdLite(p.body) + '</div>' : '') +
        (p.last && canDrop ? '<div class="gd-throw"><span>버린 책은 사무실 폴더 _to_delete 에 옮겨져요.</span><button data-guide-drop="1">버리기</button></div>' : '') + '</section>').join('') +
      '</div><div class="gd-acts">' + (steps.length ? '<button class="gd-go po-notch2" data-gd-coach="' + cur + '">앱에서 따라 하기</button>' : '') + '<button class="gd-done" data-gd-done="' + cur + '">다 봤어요</button></div></div>';
  }
  function tagsHtml(g, cur) {
    const s = seenSet(), part = GC().partStart(g);
    return '<div class="gd-tags">' + g.chapters.map((c, i) => '<button class="gd-tag' + (i === cur ? ' now' : s.has(c.name) ? ' seen' : '') + (i === part && i > 0 ? ' part' : '') + '" data-gd-ch="' + i + '" title="' + nn(i) + ' ' + esc(c.name) + '" aria-label="' + nn(i) + ' ' + esc(c.name) + '"' + (i === cur ? ' aria-current="true"' : '') + '>' + nn(i) + '</button>').join('') + '</div>';
  }
  function leave(b, from, to) { if (from !== to && b.gd && b.gd.chapters[from]) markSeen(b.gd.chapters[from].name); }

  const TARGET = {
    '새 사무실 만들기': { tab: 'settings', sel: '#st-folder-go' }, '사무실 둘러보기': { sel: '#tabs [data-tab="office"]' },
    '할 일 적기': { sel: '#tabs [data-tab="projects"]' }, '로드맵에서 할 일 고르기': { sel: '#tabs [data-tab="projects"]' }, '할 일 끝내기': { sel: '#tabs [data-tab="projects"]' },
    '프로젝트 로드맵 만들기': { tab: 'projects', sel: '#projects [data-act="mk-open"]' }, '직원에게 일 맡기기': { sel: '#tabs [data-tab="projects"]' },
    '바로 하기와 AI에게 맡기기': { sel: '#tabs [data-tab="office"]' }, '아이디어 붙이기': { sel: '#tabs [data-tab="ideas"]' }, '일정 적기': { sel: '#tabs [data-tab="calendar"]' },
    '책꽂이 둘러보기': { sel: '#tabs [data-tab="shelf"]' }, '새 책 만들기': { tab: 'settings', sel: '#st-folder-go' }, '그림·폰트 넣기': { tab: 'settings', sel: '#st-folder-go' },
    '픽셀 그림 그리기': { sel: '#tabs [data-tab="shelf"]' }, '클로드 코드로 사무실 열기': { tab: 'settings', sel: '#st-folder-go' },
    '직원 부르기': { tab: 'cards', sel: '#cards .ec-way.ai' }, '스킬 쓰기': { sel: '#tabs [data-tab="shelf"]' },
    '직원 고용하기': { tab: 'cards', sel: '#cards .ec-cand .phire' }, '직원 해고하기': { tab: 'cards', sel: '#cards .ec-btn.pfire' }, '새 직원 만들기': { sel: '#tabs [data-tab="cards"]' },
  };
  function coachSteps(pages) { return pages.filter((p) => p.bubble && TARGET[p.tag]).map((p) => ({ title: p.tag, text: p.bubble, t: TARGET[p.tag] })); }
  const C = { steps: [], i: 0, el: null, ring: null, onEnd: null, target: null };
  function coachStart(steps, onEnd) {
    coachStop(false);
    if (!steps.length) return false;
    C.steps = steps; C.i = 0; C.onEnd = onEnd || null;
    C.ring = document.createElement('div'); C.ring.className = 'coach-ring';
    C.el = document.createElement('div'); C.el.className = 'coach'; C.el.setAttribute('role', 'dialog'); C.el.setAttribute('aria-live', 'polite');
    document.body.appendChild(C.ring); document.body.appendChild(C.el);
    document.addEventListener('keydown', onKey, true); root.addEventListener('resize', place);
    show();
    return true;
  }
  function coachStop(finished) {
    document.removeEventListener('keydown', onKey, true); root.removeEventListener('resize', place);
    if (C.target) C.target.removeEventListener('click', onTargetClick);
    if (C.el) C.el.remove(); if (C.ring) C.ring.remove();
    C.el = C.ring = C.target = null;
    const cb = C.onEnd; C.onEnd = null; C.steps = [];
    if (cb) cb(!!finished);
  }
  function onKey(e) {
    if (!C.el) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); coachStop(false); }
    else if (e.key === 'Enter' && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { e.preventDefault(); e.stopPropagation(); next(); }
  }
  function onTargetClick() { setTimeout(next, 200); }
  function next() { if (!C.el) return; if (C.i >= C.steps.length - 1) return coachStop(true); C.i++; show(); }
  async function show() {
    const st = C.steps[C.i], App = root.POApp;
    if (C.target) C.target.removeEventListener('click', onTargetClick);
    if (st.t.tab && App && App.tab !== st.t.tab) { App.selectTab(st.t.tab); await new Promise((r) => setTimeout(r, 350)); }
    if (!C.el) return;
    let tg = document.querySelector(st.t.sel);
    if (!tg || !tg.getClientRects().length) tg = document.querySelector('#tabs [data-tab="' + (st.t.tab || 'office') + '"]');
    C.target = tg; if (tg) tg.addEventListener('click', onTargetClick);
    const n = C.steps.length, last = C.i === n - 1;
    C.el.innerHTML = '<div class="coach-box po-notch2"><div class="coach-band"></div><div class="coach-in"><div class="coach-pips">' + C.steps.map((x, j) => '<i class="' + (j < C.i ? 'on' : j === C.i ? 'now' : '') + '"></i>').join('') + '<small>' + (C.i + 1) + ' / ' + n + '</small></div>' +
      '<h4>' + esc(st.title) + '</h4><p>' + bq(st.text) + '</p><div class="coach-foot"><button class="coach-skip" data-coach="skip">건너뛰기</button><button class="coach-next po-notch2" data-coach="next">' + (last ? '끝내기' : '다음') + '<kbd>Enter</kbd></button></div></div></div><i class="coach-tail"></i>';
    C.el.querySelector('[data-coach="skip"]').onclick = () => coachStop(false);
    C.el.querySelector('[data-coach="next"]').onclick = () => next();
    place();
    C.el.querySelector('[data-coach="next"]').focus({ preventScroll: true });
  }
  function place() {
    if (!C.el || !C.target) return;
    const r = C.target.getBoundingClientRect(), W = root.innerWidth, H = root.innerHeight;
    const rad = parseFloat(getComputedStyle(C.target).borderRadius) || 0;
    Object.assign(C.ring.style, { left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px', borderRadius: (rad + 2) + 'px' });
    const bw = 296, bh = C.el.offsetHeight || 170, gap = 14 + 8, tail = C.el.querySelector('.coach-tail');
    let side = r.right < 300 ? 'r' : (r.top + r.height / 2 < H / 2 ? 'b' : 't');
    if (side === 'r' && r.right + 4 + gap + bw > W) side = r.top < H / 2 ? 'b' : 't';
    if (side === 'b' && r.bottom + 4 + gap + bh > H) side = 't';
    if (side === 't' && r.top - 4 - gap - bh < 0) side = 'b';
    let x, y;
    if (side === 'r') { x = r.right + 4 + gap; y = Math.max(8, Math.min(H - bh - 8, r.top + r.height / 2 - 35)); }
    else { x = Math.max(8, Math.min(W - bw - 8, r.left + r.width / 2 - 37)); y = side === 'b' ? r.bottom + 4 + gap : r.top - 4 - gap - bh; }
    C.el.style.left = Math.round(x) + 'px'; C.el.style.top = Math.round(y) + 'px';
    tail.className = 'coach-tail ' + (side === 'r' ? 'l' : side === 'b' ? 'u' : 'd');
    tail.style.cssText = '--t-l:' + art('coach_tail_h', 0) + ';--t-u:' + art('coach_tail_v', 2) + ';--t-d:' + art('coach_tail_v', 0) +
      (side === 'r' ? ';top:' + Math.max(10, Math.min(bh - 28, r.top + r.height / 2 - y - 9)) + 'px' : ';left:' + Math.max(10, Math.min(bw - 28, r.left + r.width / 2 - x - 9)) + 'px');
  }

  root.POGuideUI = { spine, tocHtml, chapterHtml, tagsHtml, leave, markSeen, seenSet, firstUnseen, coachSteps, coachStart, coachStop, coachState: () => ({ on: !!C.el, i: C.i, n: C.steps.length }), vars, KEY };
})(window);
