'use strict';
(function () {
  const ZN = 11, ZS = 11;
  const shot = document.getElementById('shot'), sctx = shot.getContext('2d');
  const lens = document.getElementById('lens'), zoom = document.getElementById('zoom'), zctx = zoom.getContext('2d');
  const hexEl = document.getElementById('hex'), chip = document.getElementById('chip'), tip = document.getElementById('tip');
  let W = 0, H = 0, rgba = null, ready = false, done = false;
  zoom.width = ZN * ZS; zoom.height = ZN * ZS;
  const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

  window.TP.on('color:init', (d) => {
    W = d.w; H = d.h;
    const src = new Uint8Array(d.bmp);
    rgba = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < rgba.length; i += 4) { rgba[i] = src[i + 2]; rgba[i + 1] = src[i + 1]; rgba[i + 2] = src[i]; rgba[i + 3] = 255; }
    shot.width = W; shot.height = H;
    sctx.putImageData(new ImageData(rgba, W, H), 0, 0);
    ready = true;
    window.TP.send('color:ready');
  });
  const toImg = (x, y) => ({ x: Math.min(W - 1, Math.max(0, Math.floor(x * W / window.innerWidth))), y: Math.min(H - 1, Math.max(0, Math.floor(y * H / window.innerHeight))) });
  function hexOf(p) { const i = (p.y * W + p.x) * 4; return '#' + hex2(rgba[i]) + hex2(rgba[i + 1]) + hex2(rgba[i + 2]); }
  function show(x, y) {
    if (!ready) return;
    const p = toImg(x, y), h = ZN >> 1;
    zctx.imageSmoothingEnabled = false;
    zctx.fillStyle = '#000'; zctx.fillRect(0, 0, zoom.width, zoom.height);
    zctx.drawImage(shot, p.x - h, p.y - h, ZN, ZN, 0, 0, ZN * ZS, ZN * ZS);
    zctx.strokeStyle = '#fff'; zctx.lineWidth = 3; zctx.strokeRect(h * ZS - 1.5, h * ZS - 1.5, ZS + 3, ZS + 3);
    zctx.strokeStyle = '#29262F'; zctx.lineWidth = 1; zctx.strokeRect(h * ZS - 0.5, h * ZS - 0.5, ZS + 1, ZS + 1);
    const hx = hexOf(p); hexEl.textContent = hx; chip.style.background = hx;
    lens.hidden = false;
    const lw = lens.offsetWidth, lh = lens.offsetHeight;
    let lx = x + 20, ly = y + 20;
    if (lx + lw > window.innerWidth - 4) lx = x - 20 - lw;
    if (ly + lh > window.innerHeight - 4) ly = y - 20 - lh;
    lens.style.left = lx + 'px'; lens.style.top = ly + 'px';
  }
  window.addEventListener('mousemove', (e) => { tip.hidden = true; show(e.clientX, e.clientY); });
  document.addEventListener('mouseleave', () => { lens.hidden = true; });
  window.addEventListener('mousedown', (e) => {
    if (done || !ready) return;
    if (e.button === 2) { done = true; window.TP.send('color:cancel'); return; }
    if (e.button !== 0) return;
    done = true;
    window.TP.send('color:pick', { x: e.clientX, y: e.clientY, w: window.innerWidth, h: window.innerHeight });
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { done = true; window.TP.send('color:cancel'); } });
  window.__colorDebug = () => ({ ready, W, H, lens: lens.hidden ? null : { hex: hexEl.textContent, box: lens.getBoundingClientRect().toJSON() }, inner: [window.innerWidth, window.innerHeight] });
  window.__colorHexAt = (x, y) => (ready ? hexOf(toImg(x, y)) : null);
})();
