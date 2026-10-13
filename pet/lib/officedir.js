'use strict';
const path = require('path');
const fs = require('fs');
const P = require('./po');

const NO_OFFICE = 'Pixel Office에서 먼저 사무실을 만들어 주세요';

function poOffice() { return P.load('office'); }
function configPath(appData, env) {
  if (env && env.TP_PO_CONFIG) return path.resolve(env.TP_PO_CONFIG);
  const OF = poOffice();
  return path.join(appData, OF.EDITIONS.public.userDataDir, OF.STORE);
}
function readConfig(file) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  if (!j || typeof j !== 'object') return null;
  return { office: typeof j.office === 'string' ? j.office : null, bossName: typeof j.bossName === 'string' ? j.bossName : null };
}
function resolve({ pub, env, home, appData, appRoot }) {
  env = env || {};
  if (env.TP_OFFICE) return { path: path.resolve(env.TP_OFFICE), from: 'env', why: null, config: null, bossName: null };
  if (!pub) return { path: null, from: 'default', why: null, config: null, bossName: null };
  const OF = poOffice();
  const config = configPath(appData, env);
  const c = readConfig(config);
  const out = { path: null, from: null, why: 'no-config', config, bossName: c && c.bossName ? c.bossName : null };
  if (!c || !c.office) return out;
  const chk = OF.checkOfficeDir(c.office, { home, appRoot, win: process.platform === 'win32' });
  if (!chk.ok) return Object.assign(out, { why: 'bad-path', error: chk.error });
  if (!OF.hasMarker(chk.path)) return Object.assign(out, { why: 'no-marker' });
  return Object.assign(out, { path: chk.path, from: 'office.json', why: null });
}

module.exports = { NO_OFFICE, configPath, readConfig, resolve };
