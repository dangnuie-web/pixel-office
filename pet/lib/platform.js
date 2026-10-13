'use strict';
const path = require('path');
const fs = require('fs');

const APP = 'Pixel Office';
function candidates({ platform, home, env, pub }) {
  env = env || {};
  if (env.TP_PIXEL_OFFICE_APP) return [env.TP_PIXEL_OFFICE_APP];
  if (platform === 'darwin') {
    const user = path.join(home, 'Applications', APP + '.app'), sys = path.join('/Applications', APP + '.app');
    return pub ? [sys, user] : [user, sys];
  }
  if (platform === 'win32') {
    const w = path.win32, out = [];
    if (env.LOCALAPPDATA) out.push(w.join(env.LOCALAPPDATA, 'Programs', APP, APP + '.exe'));
    if (env.ProgramFiles) out.push(w.join(env.ProgramFiles, APP, APP + '.exe'));
    if (env['ProgramFiles(x86)']) out.push(w.join(env['ProgramFiles(x86)'], APP, APP + '.exe'));
    return out;
  }
  return [];
}
function findPixelOffice(opts) {
  const exists = (opts && opts.exists) || fs.existsSync;
  return candidates(opts).find((p) => { try { return exists(p); } catch (e) { return false; } }) || null;
}

module.exports = { APP, candidates, findPixelOffice };
