'use strict';
const path = require('path');

const DIR = path.join(__dirname, 'po');
const FILES = { core: 'core.js', calCore: 'cal_core.js', office: 'office.js', fence: 'fence.js', skeleton: 'skeleton.js', skillsPublic: 'skills_public.js', agentTexts: 'agent_texts.js', agentTextsData: 'agent_texts_data.js', guideBook: 'guide_book.js', guideBookData: 'guide_book_data.js' };
function load(name) { return require(path.join(DIR, FILES[name])); }

module.exports = { DIR, FILES, load };
