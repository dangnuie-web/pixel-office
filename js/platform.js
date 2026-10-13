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
  const eul = (w) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (/[a-z]$/i.test(w) ? (/[aeiouy]$/i.test(w) ? '를' : '을') : c >= 0 && c % 28 ? '을' : '를'); };
  const ga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (/[a-z]$/i.test(w) ? (/[aeiouy]$/i.test(w) ? '가' : '이') : c >= 0 && c % 28 ? '이' : '가'); };
  const pet = {
    available: () => !!(root.PODesktop && root.PODesktop.petLaunch),
    info: () => (pet.available() ? root.PODesktop.petInfo() : Promise.resolve(null)),
    async launch() {
      if (!pet.available()) return { ok: false, text: '데스크톱 앱에서만 펫을 띄울 수 있어요.' };
      let r;
      try { r = await root.PODesktop.petLaunch(); } catch (e) { r = { ok: false, why: 'open', name: '펫' }; }
      if (r.ok) return { ok: true, text: eul(r.name) + ' 바탕화면에 불렀어요. 이미 나와 있었다면 그대로 있어요.' };
      if (r.why === 'missing' && r.releases) { try { await root.PODesktop.petGet(); } catch (e) {  } return { ok: false, missing: true, text: '아직 ' + ga(r.name) + ' 설치돼 있지 않아요. 받는 곳(릴리스 페이지)을 열었어요. 받아서 응용 프로그램 폴더에 넣은 뒤 다시 눌러 주세요.' }; }
      if (r.why === 'missing') return { ok: false, missing: true, text: eul(r.name) + ' 못 찾았어요. 앱을 먼저 설치해 주세요.' };
      return { ok: false, text: eul(r.name) + ' 켜지 못했어요.' };
    },
  };
  root.POPet = pet;
  markHtml();
})(typeof window !== 'undefined' ? window : globalThis);
