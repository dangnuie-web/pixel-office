'use strict';
window.Pix = (function () {
  const OK = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  function color(c) {
    if (c === null || c === undefined || c === 'transparent') return null;
    return OK.test(String(c)) ? c : '#ff00ff';
  }
  function draw(ctx, sprite, f, dx, dy, flip) {
    const fr = sprite.frames[((f % sprite.frames.length) + sprite.frames.length) % sprite.frames.length];
    const w = fr[0].length;
    for (let y = 0; y < fr.length; y++) {
      for (let x = 0; x < w; x++) {
        const ch = fr[y][x];
        const c = ch in sprite.palette ? color(sprite.palette[ch]) : '#ff00ff';
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(dx + (flip ? w - 1 - x : x), dy + y, 1, 1);
      }
    }
  }
  function canvas(sprite, f, scale) {
    const fr = sprite.frames[0];
    const c = document.createElement('canvas');
    c.width = fr[0].length; c.height = fr.length;
    c.style.width = c.width * scale + 'px'; c.style.height = c.height * scale + 'px';
    c.style.imageRendering = 'pixelated';
    draw(c.getContext('2d'), sprite, f || 0, 0, 0, false);
    return c;
  }
  return { color, draw, canvas };
})();
