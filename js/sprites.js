(function (root) {
  'use strict';
  const cache = {};

  function hexToRgba(h) {
    if (h == null || h === '' || h === 'transparent') return [0, 0, 0, 0];
    let v = String(h).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.split('').map((c) => c + c).join('');
    if (/^[0-9a-f]{6}$/i.test(v)) v += 'ff';
    if (!/^[0-9a-f]{8}$/i.test(v)) return null;
    return [0, 2, 4, 6].map((i) => parseInt(v.slice(i, i + 2), 16));
  }
  const BAD = [255, 0, 255, 255];

  function frameCanvas(key, frameIndex, flip) {
    const ck = key + '#' + frameIndex + (flip ? '#f' : '');
    if (cache[ck]) return cache[ck];
    const a = root.PO_ASSETS && root.PO_ASSETS[key];
    if (!a) return null;
    const fr = a.frames[frameIndex % a.frames.length];
    const h = fr.length, w = fr[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const pal = {};
    const ov = (root.POLook && root.PORender && root.PORender.look !== false && root.POLook.palFor(key)) || {};
    Object.keys(a.palette).forEach((k) => { pal[k] = hexToRgba(ov[k] || a.palette[k]) || BAD; });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = pal[fr[y][x]] || BAD;
        const i = (y * w + (flip ? w - 1 - x : x)) * 4;
        img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = p[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    cache[ck] = c;
    return c;
  }

  function has(key) { return !!(key && root.PO_ASSETS && root.PO_ASSETS[key]); }
  function frameCount(key) { return has(key) ? root.PO_ASSETS[key].frames.length : 0; }
  function size(key) { if (!has(key)) return null; const f = root.PO_ASSETS[key].frames[0]; return { w: f[0].length, h: f.length }; }
  function topRow(key) {
    if (!has(key)) return 0;
    const fr = root.PO_ASSETS[key].frames[0];
    for (let y = 0; y < fr.length; y++) if (fr[y].indexOf('k') >= 0) return y;
    return 0;
  }
  function poseSprite(idleKey, pose, face) {
    face = face || 'down';
    const front = String(idleKey).replace(/_idle$/, '') + '_' + (pose || 'idle');
    if (face !== 'down') {
      if (has(front + '_' + face)) return { key: front + '_' + face, flip: false, miss: null };
      if (face === 'right' && has(front + '_left')) return { key: front + '_left', flip: true, miss: null };
      if (face === 'left' && has(front + '_right')) return { key: front + '_right', flip: true, miss: null };
    }
    if (has(front)) return { key: front, flip: false, miss: face !== 'down' ? 'dir' : null };
    return { key: idleKey, flip: false, miss: has(idleKey) ? 'pose' : 'none' };
  }
  function clearCache() { Object.keys(cache).forEach((k) => delete cache[k]); }

  root.POSprites = { frameCanvas, has, frameCount, size, hexToRgba, clearCache, topRow, poseSprite };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.POSprites;
})(typeof window !== 'undefined' ? window : globalThis);
