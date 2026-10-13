'use strict';
const fs = require('fs');
const path = require('path');
const FENCE = require('./fence');

const IMG = '(png|jpe?g|gif|webp|avif|svg)';
const ASSET_READ = [
  new RegExp('^40_자산/아이콘/[^/]+/[^/]+\\.' + IMG + '$', 'i'),
  new RegExp('^40_자산/낙서/[^/]+\\.' + IMG + '$', 'i'),
  new RegExp('^40_자산/레퍼런스/.+\\.' + IMG + '$', 'i'),
  /^40_자산\/폰트\/(영문|한글)\/[^/]+\.(otf|ttf|woff2?)$/i,
];
const MAX = 200 * 1024 * 1024;

function assetAllowed(rel) {
  if (typeof rel !== 'string') return false;
  const n = rel.normalize('NFC');
  const segs = n.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..' || s.startsWith('.') || s === '_to_delete') || FENCE.relBad(n)) return false;
  return ASSET_READ.some((re) => re.test(n));
}
function readAsset(office, rel, max) {
  if (!assetAllowed(rel)) throw new Error('허용 안 됨: ' + String(rel).normalize('NFC'));
  const root = fs.realpathSync(office);
  const full = path.join(office, ...rel.split('/'));
  const real = fs.realpathSync(full);
  if (!real.startsWith(root + path.sep)) throw new Error('허용 안 됨: ' + rel.normalize('NFC'));
  const st = fs.statSync(real);
  if (!st.isFile() || st.size > MAX) throw new Error('읽지 않음: ' + rel.normalize('NFC'));
  const n = max > 0 ? Math.min(max, st.size) : st.size;
  const buf = Buffer.alloc(n);
  const fd = fs.openSync(real, 'r');
  try { let off = 0; while (off < n) { const k = fs.readSync(fd, buf, off, n - off, off); if (!k) break; off += k; } } finally { fs.closeSync(fd); }
  return { data: new Uint8Array(buf.buffer, buf.byteOffset, n), size: st.size, lastModified: st.mtimeMs };
}

const PICK_EXT = /\.(png|jpe?g|webp)$/i;
function readPicked(office, rel, max) {
  const n = String(rel).normalize('NFC');
  const segs = n.split('/');
  if (!PICK_EXT.test(n) || segs.some((s) => s === '' || s === '.' || s === '..' || s.startsWith('.') || s === '_to_delete') || FENCE.relBad(n)) throw new Error('허용 안 됨: ' + n);
  const root = fs.realpathSync(office);
  const real = fs.realpathSync(path.join(office, ...rel.split('/')));
  if (!real.startsWith(root + path.sep)) throw new Error('허용 안 됨: ' + n);
  const st = fs.statSync(real);
  if (!st.isFile() || st.size > MAX) throw new Error('읽지 않음: ' + n);
  const k = max > 0 ? Math.min(max, st.size) : st.size;
  const buf = Buffer.alloc(k);
  const fd = fs.openSync(real, 'r');
  try { let off = 0; while (off < k) { const r = fs.readSync(fd, buf, off, k - off, off); if (!r) break; off += r; } } finally { fs.closeSync(fd); }
  return { data: new Uint8Array(buf.buffer, buf.byteOffset, k), size: st.size, lastModified: st.mtimeMs };
}

module.exports = { assetAllowed, readAsset, readPicked, ASSET_READ, MAX };
