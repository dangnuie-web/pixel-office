'use strict';
const core = require('./po').load('core');

const N = require('./names');

function greeting(date) {
  const h = (date || new Date()).getHours(), v = N.values(), me = N.petIs();
  if (h < 5) return v.bossCall + ', 늦게까지 계시네요. ' + me + '.';
  if (h < 11) return v.bossCall + ', 좋은 아침이에요. ' + me + '.';
  return v.bossCall + ', ' + me + '. 여기 있을게요.';
}

module.exports = { core, greeting };
