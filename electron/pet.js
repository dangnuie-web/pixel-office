'use strict';
const path = require('path');
const fs = require('fs');

const RELEASES = 'https://github.com/dangnuie-web/pixel-office/releases/latest';
const NAMES = {
  public: { app: 'Pixel Office Pet', exe: 'PixelOfficePet.exe' },
  dangnee: { app: 'Pixel Office Pet', exe: 'PixelOfficePet.exe' },
};

function candidates({ platform, home, env, pub }) {
  env = env || {};
  if (env.PO_PET_APP) return [env.PO_PET_APP];
  const N = pub ? NAMES.public : NAMES.dangnee;
  if (platform === 'darwin') {
    const sys = path.join('/Applications', N.app + '.app'), user = path.join(home, 'Applications', N.app + '.app');
    return pub ? [sys, user] : [user, sys];
  }
  if (platform === 'win32') {
    const w = path.win32, out = [];
    if (env.LOCALAPPDATA) out.push(w.join(env.LOCALAPPDATA, 'Programs', N.app, N.exe));
    if (env.ProgramFiles) out.push(w.join(env.ProgramFiles, N.app, N.exe));
    if (env['ProgramFiles(x86)']) out.push(w.join(env['ProgramFiles(x86)'], N.app, N.exe));
    return out;
  }
  return [];
}
function find(opts) {
  const exists = (opts && opts.exists) || fs.existsSync;
  return candidates(opts).find((p) => { try { return exists(p); } catch (e) { return false; } }) || null;
}
function info(opts) { const N = opts.pub ? NAMES.public : NAMES.dangnee; return { found: !!find(opts), name: N.app, releases: opts.pub ? RELEASES : null }; }
async function launch(opts, openPath) {
  const p = find(opts);
  const N = opts.pub ? NAMES.public : NAMES.dangnee;
  if (!p) return { ok: false, why: 'missing', name: N.app, releases: opts.pub ? RELEASES : null };
  if (!candidates(opts).includes(p)) return { ok: false, why: 'fence', name: N.app };
  const err = await openPath(p);
  return err ? { ok: false, why: 'open', error: String(err), name: N.app } : { ok: true, name: N.app };
}

module.exports = { RELEASES, NAMES, candidates, find, info, launch };
