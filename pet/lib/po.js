'use strict';
const path = require('path');

const DIR = path.join(__dirname, 'po');
const FILES = { core: 'core.js', calCore: 'cal_core.js', office: 'office.js', fence: 'fence.js', skeleton: 'skeleton.js' };
function load(name) { return require(path.join(DIR, FILES[name])); }

module.exports = { DIR, FILES, load };
