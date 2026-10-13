'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const list = $('list'), words = $('words');
  let D = null, sel = 0, busy = false, planSeq = 0;
  function draw() {
    list.textContent = '';
    D.projects.forEach((p, i) => {
      const row = el('div', 'pi' + (i === sel ? ' on' : '') + (p.sepBefore ? ' sep' : ''));
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(i === sel));
      row.appendChild(el('span', 'n' + (i < 9 ? '' : ' blank'), i < 9 ? String(i + 1) : '')); row.appendChild(el('span', 'nm', p.isNew && words.value.trim() ? '＋ ' + words.value.trim() : p.name));
      if (p.meta) row.appendChild(el('span', 'meta', p.meta));
      row.addEventListener('click', () => pick(i, true));
      list.appendChild(row);
    });
  }
  function pick(i, keepFocus) {
    if (!D.projects.length) return;
    sel = Math.max(0, Math.min(i, D.projects.length - 1));
    draw();
    const row = list.children[sel]; if (row) row.scrollIntoView({ block: 'nearest' });
    if (D.projects[sel].isNew) words.focus(); else if (!keepFocus) list.focus();
    plan();
  }
  const choice = () => { const p = D.projects[sel]; return !p ? null : p.isNew ? { isNew: true, name: words.value } : { topic: p.name }; };
  function plan() { planSeq++; window.TP.send('pick:plan', Object.assign({ seq: planSeq }, choice())); }
  window.TP.on('pick:planned', (d) => {
    if (d.seq !== planSeq) return;
    const out = $('out'); out.textContent = '';
    if (!d.ok) { out.appendChild(el('span', 'bad', d.why)); $('go').disabled = true; return; }
    $('go').disabled = false;
    out.appendChild(document.createTextNode('→ 레퍼런스/' + d.topic + '/'));
    out.appendChild(el('b', '', d.names.length > 1 ? d.names[0] + ' 외 ' + (d.names.length - 1) + '개' : d.names[0]));
    if (d.isNew) out.appendChild(document.createTextNode(' (새 주제)'));
    out.appendChild(el('br'));
    out.appendChild(document.createTextNode('원래 이름 그대로 옮겨요 (복사 아님)'));
  });
  window.TP.on('pick:init', (d) => {
    D = d; sel = 0; busy = false;
    document.body.classList.toggle('noband', d.band === false);
    $('sub').textContent = d.first + ' · 그림 ' + d.count + '장';
    const th = $('thumb'); th.querySelectorAll('img').forEach((x) => x.remove());
    if (d.thumb) th.insertBefore(Object.assign(document.createElement('img'), { src: d.thumb, alt: '' }), th.firstChild);
    $('more').hidden = d.count < 2; $('more').textContent = '+' + (d.count - 1);
    const x = $('close');
    if (!x.childNodes.length) {
      if (d.close) { const a = window.Pix.canvas(d.close, 0, 3), b = window.Pix.canvas(d.close, 1, 3); a.className = 'off'; b.className = 'on'; x.append(a, b); }
      else { x.textContent = '✕'; x.classList.add('text'); }
    }
    words.value = '';
    draw(); if (D.projects.length === 1 && D.projects[0].isNew) pick(0); else { list.focus(); plan(); }
  });
  window.TP.on('pick:busy', (b) => { busy = !!b; $('go').disabled = busy; });
  const go = () => { if (busy || $('go').disabled || !D || !D.projects[sel]) return; busy = true; $('go').disabled = true; window.TP.send('pick:go', choice()); };
  const cancel = () => window.TP.send('pick:close');
  $('go').addEventListener('click', go);
  $('close').addEventListener('click', cancel);
  words.addEventListener('input', () => { const n = D.projects.findIndex((p) => p.isNew); if (n >= 0 && sel !== n) { sel = n; } draw(); plan(); });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); pick(sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pick(sel - 1); }
    else if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (+e.key <= D.projects.length) pick(+e.key - 1); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(); }
  });
  window.__pickDebug = () => ({ sel, project: D && D.projects[sel] && D.projects[sel].name, isNew: !!(D && D.projects[sel] && D.projects[sel].isNew), words: words.value, out: $('out').textContent, go: !$('go').disabled, n: D && D.projects.length });
  window.__pickKey = (k) => { const t = document.activeElement || list; t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); return window.__pickDebug(); };
})();
