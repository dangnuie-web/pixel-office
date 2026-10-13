'use strict';
function inBody(p, box) { return Math.abs(p.x - box.cx) <= box.tw * 0.3 && p.y >= box.by - box.th * 0.85 && p.y <= box.by - box.th * 0.1; }
function inWin(p, b) { return p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height; }
function step(s, p, box, bounds) {
  const none = { ignore: null, resetHit: false, clearSaid: false };
  if (s.hidden || s.drag) return none;
  const inside = inWin(p, bounds);
  if (s.ignore) {
    if (!inside) return s.said === null ? none : { ignore: null, resetHit: false, clearSaid: true };
    return inBody(p, box) && s.said !== false ? { ignore: false, resetHit: true, clearSaid: false } : none;
  }
  if (s.hover) return none;
  return inside ? none : { ignore: true, resetHit: false, clearSaid: true };
}
module.exports = { step, inBody, inWin };
