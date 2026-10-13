'use strict';
const path = require('path');

const APP_NAME = 'Pixel Office Pet';
const APP_ID = 'com.dangnee.pixeloffice.pet';
const EXE = 'PixelOfficePet';
const COPYRIGHT = 'Copyright (c) 2026 Dangnee';
const NAMES = { mac: 'Pixel-Office-Pet-mac-arm64.dmg', win: 'Pixel-Office-Pet-windows-setup.exe' };

function config({ appDir, out, icons, electronVersion, notices, platform }) {
  const extra = notices ? [{ from: path.join(notices, 'LICENSE'), to: 'LICENSE' }, { from: path.join(notices, 'LICENSES.chromium.html'), to: 'LICENSES.chromium.html' }] : [];
  const c = {
    appId: APP_ID,
    productName: APP_NAME,
    executableName: EXE,
    copyright: COPYRIGHT,
    electronVersion,
    directories: { app: appDir, output: path.join(out, 'dist'), buildResources: icons },
    asar: false,
    npmRebuild: false,
    nodeGypRebuild: false,
    publish: null,
    extraResources: extra,
    mac: {
      target: [{ target: 'dmg', arch: ['arm64'] }],
      icon: path.join(icons, 'icon.icns'),
      category: 'public.app-category.productivity',
      identity: '-',
      hardenedRuntime: false,
      gatekeeperAssess: false,
      notarize: false,
      artifactName: NAMES.mac,
      extendInfo: { LSUIElement: true },
    },
    dmg: { writeUpdateInfo: false, title: APP_NAME },
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: path.join(icons, 'icon.png'),
      artifactName: NAMES.win,
    },
    nsis: { oneClick: true, perMachine: false, differentialPackage: false, artifactName: NAMES.win, shortcutName: APP_NAME, uninstallDisplayName: APP_NAME },
  };
  if (platform === 'mac') { c.productName = EXE; c.mac.extendInfo = { LSUIElement: true, CFBundleDisplayName: APP_NAME }; }
  return c;
}

module.exports = { APP_NAME, APP_ID, EXE, COPYRIGHT, NAMES, config };
