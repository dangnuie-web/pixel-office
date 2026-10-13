'use strict';

const WIN = process.platform === 'win32';
const SHORT_83 = /^[^.~]{1,7}~\d{1,7}(\.[^.]{1,3})?$/;
const WIN_DEVICE = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

function segBad(s, win) {
  if (typeof s !== 'string') return true;
  if (s === '' || s === '.' || s === '..') return false;
  if (/[\\:\u0000-\u001f\u007f]/.test(s)) return true;
  if (/[. ]$/.test(s)) return true;
  if (s.normalize('NFC').toLowerCase() === '_to_delete') return true;
  if (win === undefined ? WIN : win) {
    if (/[<>"|?*]/.test(s) || WIN_DEVICE.test(s) || SHORT_83.test(s)) return true;
  }
  return false;
}
function relBad(rel, win) {
  if (typeof rel !== 'string') return true;
  return rel.split('/').some((s) => segBad(s, win));
}

module.exports = { segBad, relBad, WIN };
