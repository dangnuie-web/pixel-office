'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) inline(e, text); return e; };
  function inline(parent, s) {
    String(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach((part) => {
      if (!part) return;
      if (/^\*\*[^*]+\*\*$/.test(part)) parent.appendChild(Object.assign(document.createElement('b'), { textContent: part.slice(2, -2) }));
      else if (/^`[^`]+`$/.test(part)) parent.appendChild(Object.assign(document.createElement('code'), { textContent: part.slice(1, -1) }));
      else parent.appendChild(document.createTextNode(part));
    });
  }
  let drawnIcons = false;
  window.TP.on('viewer:data', (d) => {
    if (!drawnIcons) {
      drawnIcons = true;
      if (d.portraitPng) $('portrait').appendChild(Object.assign(document.createElement('img'), { src: d.portraitPng, alt: '' }));
      else if (d.portrait) $('portrait').appendChild(window.Pix.canvas(d.portrait, 0, 1));
      const x = $('close');
      if (d.close) { const a = window.Pix.canvas(d.close, 0, 3), b = window.Pix.canvas(d.close, 1, 3); a.className = 'off'; b.className = 'on'; x.append(a, b); }
      else { x.textContent = '×'; x.classList.add('text'); }
      if (d.clip) $('clip').appendChild(window.Pix.canvas(d.clip, 0, 3));
      if (d.kraft) $('face').style.backgroundImage = 'url(' + window.Pix.canvas(d.kraft, 0, 1).toDataURL() + ')';
    }
    $('title').textContent = d.title;
    $('sub').textContent = d.sub + ' · ' + d.at.slice(11) + ' 기준';
    document.title = (d.appTitle || '브리핑') + ' - ' + d.title;
    const body = $('body'); body.textContent = '';
    d.blocks.forEach((b) => {
      if (b.t === 'h') { const h = el('div', 'h'); const m = /^(.*\S)\s+(\([^()]*\))$/.exec(b.text);
        if (m) { h.appendChild(el('span', '', m[1])); h.appendChild(el('span', 'aside', m[2])); } else h.appendChild(el('span', '', b.text)); if (b.meta) h.appendChild(el('span', 'meta', b.meta)); body.appendChild(h); }
      else if (b.t === 'item') {
        const row = el('div', 'item');
        row.appendChild(b.n ? el('div', 'n', b.n) : el('div', 'n dot'));
        const it = el('div', 'it');
        if (b.meta) it.appendChild(el('div', 'meta', b.meta));
        it.appendChild(el('div', '', b.text));
        if (b.sub && b.sub.length) { const ul = el('ul'); b.sub.forEach((s) => ul.appendChild(el('li', '', s))); it.appendChild(ul); }
        row.appendChild(it); body.appendChild(row);
      } else body.appendChild(el('div', b.t === 'empty' ? 'empty' : b.t === 'note' ? 'note' : 'p', b.text));
    });
    body.scrollTop = 0;
    const foot = $('foot'); foot.textContent = '';
    d.files.forEach((f) => { const line = el('div'); line.appendChild(el('b', '', '파일 ')); line.appendChild(document.createTextNode(f.full)); line.title = '파일 ' + f.full; foot.appendChild(line); });
    if (!d.files.length) foot.appendChild(el('div', '', '읽은 파일 없음'));
    body.focus();
  });
  const close = () => window.TP.send('viewer:close');
  $('close').addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
