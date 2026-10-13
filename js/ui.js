(function (root) {
  'use strict';
  const S = () => root.POSprites;
  const KEYS = ['ui_close', 'ui_arrow', 'ui_clip', 'ui_stamp', 'ui_pin', 'ui_cork', 'ui_rings', 'ui_screw', 'ui_lanyard', 'ui_tail'];
  const urlCache = {};

  function scaled(src, u) {
    const c = document.createElement('canvas');
    c.width = src.width * u; c.height = src.height * u;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function uiCanvas(key, frame, u) {
    const src = S().frameCanvas(key, frame || 0);
    return src ? scaled(src, u) : null;
  }
  function markCanvas(sym, u) {
    const R = root.PORender;
    const m = R.MARK[sym]; if (!m) return null;
    const c = document.createElement('canvas'); c.width = 7; c.height = 9;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 9; y++) for (let x = 0; x < 7; x++) { const ch = m[y][x]; if (ch !== '.') { ctx.fillStyle = R.COL[ch]; ctx.fillRect(x, y, 1, 1); } }
    return scaled(c, u);
  }
  function url(key, frame, u) {
    const ck = key + '#' + frame + '#' + u;
    if (!(ck in urlCache)) {
      const c = key === 'mark?' ? markCanvas('?', u) : key === 'mark!' ? markCanvas('!', u) : uiCanvas(key, frame, u);
      urlCache[ck] = c ? c.toDataURL('image/png') : '';
    }
    return urlCache[ck];
  }
  function applyVars(el, u) {
    el.style.setProperty('--u', u + 'px');
    const set = (name, key, f) => { const d = url(key, f, u); el.style.setProperty(name, d ? 'url("' + d + '")' : 'none'); };
    KEYS.forEach((k) => {
      const n = S().frameCount(k) || 1;
      for (let f = 0; f < n; f++) set('--' + k.replace('_', '-') + '-' + f, k, f);
    });
    set('--mark-q', 'mark?', 0);
    set('--mark-ex', 'mark!', 0);
  }

  root.POUi = { uiCanvas, markCanvas, applyVars, url };
})(window);
