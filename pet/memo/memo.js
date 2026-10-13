'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const KINDS = {
    idea: { to: '아이디어보관함', ph: '떠오른 걸 한 줄로' },
    lecture: { to: '강의소재.md', ph: '강의에 쓸 소재 한 줄' },
    appt: { to: '오피스 달력', ph: '' },
  };
  let ORDER = ['idea', 'lecture', 'appt'];
  const A = window.TPAppt;
  const input = $('in'), wrap = $('wrap'), tail = $('tail');
  const ap = $('ap'), ad = $('ad'), at = $('at'), ax = $('ax');
  let kind = 'idea', tailX = 140, sent = false, closing = false, tailDrawn = false;
  let today = null, ak = '미팅', tried = false, ready = false;
  const btns = Array.from(document.querySelectorAll('.seg button[data-k]'));
  const kbtns = Array.from(document.querySelectorAll('.seg button[data-ak]'));
  const apptDraft = () => ({ date: ad.value, time: at.value, ak, text: ax.value });
  const draft = () => window.TP.send('memo:draft', { kind, text: input.value, appt: apptDraft() });
  function setKind(k, focusBtn) {
    if (!KINDS[k] || !ORDER.includes(k)) return;
    const was = kind;
    kind = k;
    btns.forEach((b) => { const on = b.dataset.k === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    $('to').textContent = KINDS[k].to; input.placeholder = KINDS[k].ph;
    const isAp = k === 'appt';
    input.hidden = isAp; ap.hidden = !isAp;
    if (isAp && was !== 'appt' && input.value.trim() && !ax.value.trim()) { ax.value = input.value.trim(); input.value = ''; }
    if (isAp) readAppt();
    if (focusBtn) btns.find((b) => b.dataset.k === k).focus();
    if (ready) layout();
    draft();
  }
  const focusMain = () => { if (kind === 'appt') ad.focus(); else input.focus(); };
  btns.forEach((b) => {
    b.addEventListener('click', () => { setKind(b.dataset.k); focusMain(); });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = ORDER.indexOf(kind) + (e.key === 'ArrowRight' ? 1 : -1);
      setKind(ORDER[(i + ORDER.length) % ORDER.length], true);
    });
  });
  function setAk(k, focus) {
    if (!A.KINDS.includes(k)) k = A.KINDS[0];
    ak = k;
    kbtns.forEach((b) => { const on = b.dataset.ak === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    readAppt(); draft();
  }
  kbtns.forEach((b) => {
    b.addEventListener('click', () => setAk(b.dataset.ak));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = A.KINDS.indexOf(ak) + (e.key === 'ArrowRight' ? 1 : -1);
      setAk(A.KINDS[(i + A.KINDS.length) % A.KINDS.length], true);
    });
  });
  let last = null;
  function readAppt() {
    const r = A.read({ date: ad.value, time: at.value, kind: ak, text: ax.value }, today, Date.now());
    const emptyBad = !!(tried && r.bad.dateEmpty);
    $('fd').classList.toggle('bad', !!r.bad.date || emptyBad);
    $('ft').classList.toggle('bad', !!r.bad.time);
    $('fx').classList.toggle('bad', !!r.bad.text || !!(tried && r.bad.textEmpty && !r.err && !r.bad.dateEmpty));
    $('rd').classList.toggle('bad', !!r.err || emptyBad);
    $('rd').classList.toggle('hint', !!r.bad.dateEmpty && !tried);
    $('r1').textContent = r.line1 || ''; $('r2').textContent = r.line2 || '';
    last = r;
    return r;
  }
  [ad, at, ax].forEach((el) => el.addEventListener('input', () => { readAppt(); draft(); }));
  ad.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (!today) return;
    const base = A.parseDate(ad.value, today) || window.POCalCore.addDays(today, e.key === 'ArrowUp' ? -1 : 1);
    const d = window.POCalCore.addDays(base, e.key === 'ArrowUp' ? 1 : -1);
    const [y, m, dd] = d.split('-').map(Number);
    ad.value = y === +today.slice(0, 4) ? m + '/' + dd : d;
    readAppt(); draft();
  });
  function saveAppt() {
    if (sent) return;
    tried = true;
    const r = readAppt();
    if (!r.ok) {
      if (r.bad.date || r.bad.dateEmpty) ad.focus(); else if (r.bad.time) at.focus(); else ax.focus();
      return;
    }
    sent = true; window.TP.send('memo:save', { kind: 'appt', appt: apptDraft() });
  }
  function layout() {
    const box = wrap.querySelector('.tm');
    const hasTail = tailX != null && tailDrawn;
    const tw = hasTail ? tail.width * 3 : 0, th = hasTail ? tail.height * 3 : 0;
    tail.hidden = !hasTail;
    const cx = hasTail ? tailX : window.innerWidth / 2;
    const left = Math.round(Math.max(4, Math.min(cx - box.offsetWidth / 2, window.innerWidth - 4 - box.offsetWidth)));
    wrap.style.left = left + 'px';
    wrap.style.bottom = (hasTail ? th : 3) + 'px';
    if (hasTail) {
      tail.style.left = Math.max(6, Math.min(Math.round(tailX - left - tw / 2), box.offsetWidth - tw - 6)) + 'px';
      tail.style.top = (box.offsetHeight - 3) + 'px';
    }
    window.TP.send('memo:size', { h: box.offsetHeight + (hasTail ? th : 3) });
  }
  window.TP.on('memo:init', (d) => {
    tailX = d.tailX;
    document.body.classList.toggle('noband', d.band === false);
    if (Array.isArray(d.kinds) && d.kinds.length) ORDER = ['idea', 'lecture', 'appt'].filter((k) => d.kinds.includes(k));
    btns.forEach((b) => { b.hidden = !ORDER.includes(b.dataset.k); });
    if (d.tail && !tailDrawn) {
      tailDrawn = true;
      const fr = d.tail.frames[0]; tail.width = fr[0].length; tail.height = fr.length;
      tail.style.width = tail.width * 3 + 'px'; tail.style.height = tail.height * 3 + 'px';
      window.Pix.draw(tail.getContext('2d'), d.tail, 0, 0, 0, false);
    }
    input.value = d.text || ''; sent = false; closing = false; tried = false;
    today = d.today || null;
    const a = d.appt || {};
    ad.value = a.date || ''; at.value = a.time || ''; ax.value = a.text || ''; setAk(a.ak || '미팅');
    setKind(ORDER.includes(d.kind) ? d.kind : 'idea');
    ready = true; layout(); focusMain();
    if (kind !== 'appt') input.setSelectionRange(input.value.length, input.value.length);
  });
  window.TP.on('memo:place', (d) => { if (d.tailX !== tailX) { tailX = d.tailX; layout(); } });
  window.TP.on('memo:bad', (d) => {
    sent = false;
    if (kind === 'appt' && d && d.why) { $('rd').classList.add('bad'); $('rd').classList.remove('hint'); $('r1').textContent = '못 적었어요'; $('r2').textContent = d.why; }
    focusMain();
  });
  input.addEventListener('input', draft);
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sent || !input.value.trim()) return;
      sent = true; window.TP.send('memo:save', { kind, text: input.value });
    }
  });
  ap.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault(); saveAppt();
  });
  const close = () => {
    if (closing) return; closing = true;
    const a = apptDraft();
    if (sent && kind === 'appt') { a.date = ''; a.time = ''; a.text = ''; }
    window.TP.send('memo:draft', { kind, text: sent && kind !== 'appt' ? '' : input.value, appt: a });
    window.TP.send('memo:close');
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) { e.preventDefault(); if (ORDER[+e.key - 1]) setKind(ORDER[+e.key - 1]); focusMain(); }
  });
  window.addEventListener('blur', () => { if (!sent) close(); });
  window.__memoDebug = () => ({ kind, value: input.value, to: $('to').textContent, ph: input.placeholder, tail: !tail.hidden, box: wrap.querySelector('.tm').getBoundingClientRect().toJSON(),
    appt: { date: ad.value, time: at.value, ak, text: ax.value, r1: $('r1').textContent, r2: $('r2').textContent, bad: ['fd', 'ft', 'fx', 'rd'].filter((id) => $(id).classList.contains('bad')), focus: document.activeElement && document.activeElement.id } });
  window.__memoType = (s) => { input.value = s; input.dispatchEvent(new Event('input')); return true; };
  window.__memoAppt = (f) => { if (f.date != null) ad.value = f.date; if (f.time != null) at.value = f.time; if (f.text != null) ax.value = f.text; if (f.ak) setAk(f.ak); readAppt(); draft(); return window.__memoDebug().appt; };
  window.__memoKind = (k) => { setKind(k); focusMain(); return kind; };
})();
