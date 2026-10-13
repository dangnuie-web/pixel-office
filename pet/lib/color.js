'use strict';

const N = require('./names');
const eul = (w) => (/[a-z]$/i.test(w) ? (/[aeiouy]$/i.test(w) ? w + '를' : w + '을') : require('./po').load('core').josa(w, '을', '를'));
const PERM_MENU = '화면 및 시스템 오디오 녹음(예전 이름 화면 기록)';
const permLine = () => '시스템 설정 > 개인정보 보호 및 보안 > ' + PERM_MENU + '에서 ' + eul(N.values().app) + ' 켜 주세요';
const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

function hexAt(buf, w, h, x, y, order) {
  x = Math.floor(x); y = Math.floor(y);
  if (!buf || !(x >= 0 && y >= 0 && x < w && y < h)) return null;
  const i = (y * w + x) * 4;
  if (i + 3 >= buf.length) return null;
  const bgra = (order || 'BGRA') === 'BGRA';
  const r = buf[bgra ? i + 2 : i], g = buf[i + 1], b = buf[bgra ? i : i + 2];
  return '#' + hex2(r) + hex2(g) + hex2(b);
}
function toImage(x, y, bw, bh, iw, ih) {
  const ix = Math.min(iw - 1, Math.max(0, Math.floor(x * iw / bw)));
  const iy = Math.min(ih - 1, Math.max(0, Math.floor(y * ih / bh)));
  return { x: ix, y: iy };
}
function permStep(status, asked) {
  if (status === 'granted') return 'capture';
  if (!asked) return 'ask';
  return 'guide';
}
const say = {
  guide: () => '화면 녹음 권한이 필요해요\n' + permLine() + '. 켠 뒤에는 ' + eul(N.values().pet) + ' 껐다 켜 주세요',
  asked: () => '화면 녹음 권한이 필요해요\nmacOS가 묻는 창에서 허용해 주세요. 창이 안 보이면 ' + permLine(),
  fail: (why) => '색을 못 뽑았어요\n' + why,
  picked: (hex) => '색을 복사했어요!\n' + hex,
};
function bubble(hex) { return { kind: 'color', head: '색을 복사했어요!', hex }; }

module.exports = { PERM_MENU, permLine, hexAt, toImage, permStep, say, bubble };
