(function (root) {
  'use strict';
  function os() {
    const D = root.PODesktop;
    const p = D && D.platform;
    if (p) return p === 'darwin' ? 'mac' : p === 'win32' ? 'win' : 'other';
    const nav = root.navigator;
    const n = (nav && ((nav.userAgentData && nav.userAgentData.platform) || nav.platform)) || '';
    return /mac|iphone|ipad/i.test(n) ? 'mac' : /win/i.test(n) ? 'win' : 'other';
  }
  const isMac = () => os() === 'mac';
  const fileMgr = () => ({ mac: 'Finder', win: '탐색기' }[os()] || '파일 관리자');
  const key = (k, shift) => (isMac() ? (shift ? '⇧⌘' : '⌘') + k : 'Ctrl+' + (shift ? 'Shift+' : '') + k);
  function markHtml() {
    const el = root.document && root.document.documentElement;
    if (el && el.classList) el.classList.toggle('mac', isMac());
  }
  root.POPlat = { os, isMac, fileMgr, key, markHtml };
  markHtml();
})(typeof window !== 'undefined' ? window : globalThis);
