'use strict';
function windowOptions(platform, preload) {
  const o = {
    width: 1320, height: 880, minWidth: 900, minHeight: 600,
    title: 'Pixel Office', backgroundColor: '#2a2329',
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
  };
  if (platform === 'darwin') o.titleBarStyle = 'hiddenInset';
  else o.autoHideMenuBar = true;
  return o;
}
function afterCreate(win, platform) {
  if (platform !== 'darwin' && win && typeof win.removeMenu === 'function') win.removeMenu();
}
function refreshKey(input, dev) {
  if (!input || input.type !== 'keyDown' || input.alt) return false;
  if (!(input.meta || input.control)) return false;
  if (!(input.code === 'KeyR' || input.key === 'r' || input.key === 'R')) return false;
  if (dev && input.shift) return false;
  return true;
}
module.exports = { windowOptions, afterCreate, refreshKey };
