(function (root) {
  'use strict';
  const KEYS = { officeName: 'po.officeName', bossName: 'po.bossName' };
  const MAX = { officeName: 10, bossName: 8 };
  const DEFAULTS = {
    dangnee: { officeName: '당니', bossName: '당니' },
    public: { officeName: '픽셀', bossName: '픽셀' },
  };
  const listeners = [];

  function isPublic() { return root.PO_PUBLIC === true; }
  function defaults() { return Object.assign({}, DEFAULTS[isPublic() ? 'public' : 'dangnee']); }
  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function clean(k, v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX[k]); }

  function raw() {
    const s = ls(), out = { officeName: '', bossName: '' };
    if (!s) return out;
    try {
      out.officeName = clean('officeName', s.getItem(KEYS.officeName));
      out.bossName = clean('bossName', s.getItem(KEYS.bossName));
    } catch (e) {  }
    return out;
  }
  function officeFull(name) { return name + ' 오피스'; }
  function values() {
    const d = defaults(), r = raw();
    const v = {
      officeName: r.officeName || d.officeName,
      bossName: r.bossName || d.bossName,
    };
    v.office = officeFull(v.officeName);
    v.boss = v.bossName;
    v.bossCall = v.bossName + '님';
    return v;
  }
  function isDefault() {
    const d = defaults(), v = values();
    return v.officeName === d.officeName && v.bossName === d.bossName;
  }
  function save(part) {
    const s = ls();
    if (s) {
      try {
        if ('officeName' in part) s.setItem(KEYS.officeName, clean('officeName', part.officeName));
        if ('bossName' in part) s.setItem(KEYS.bossName, clean('bossName', part.bossName));
      } catch (e) {  }
    }
    emit();
    if ('bossName' in part) syncBoss();
  }
  function reset() {
    const s = ls();
    if (s) { try { Object.keys(KEYS).forEach((k) => s.removeItem(KEYS[k])); } catch (e) {  } }
    emit();
    syncBoss();
  }
  let bossTimer = null;
  function syncBoss() {
    const D = root.PODesktop;
    if (!isPublic() || !D || typeof D.bossSave !== 'function') return;
    if (bossTimer) clearTimeout(bossTimer);
    bossTimer = setTimeout(() => { bossTimer = null; try { Promise.resolve(D.bossSave(values().bossName)).catch(() => {}); } catch (e) {  } }, 400);
  }
  function sub(str) {
    if (str == null) return str;
    const v = values();
    return String(str).replace(/당니(오피스|님)?/g, (m, t) => (t === '오피스' ? v.office : t === '님' ? v.bossCall : v.boss));
  }
  function onChange(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; }
  function emit() { listeners.slice().forEach((cb) => { try { cb(values()); } catch (e) {  } }); }

  function titlePrefix() { return isPublic() ? 'Pixel Office · ' : 'pixel-office · '; }

  function applyDoc(doc) {
    if (!doc) return;
    doc.title = titlePrefix() + values().office;
    doc.querySelectorAll('[data-n]').forEach((el) => {
      const attr = el.getAttribute('data-n') || 'text';
      if (attr === 'text') { if (el.dataset.nTpl == null) el.dataset.nTpl = el.textContent; el.textContent = sub(el.dataset.nTpl); }
      else { const k = 'nTpl_' + attr.replace(/[^a-z]/g, ''); if (el.dataset[k] == null) el.dataset[k] = el.getAttribute(attr) || ''; el.setAttribute(attr, sub(el.dataset[k])); }
    });
  }

  const api = { KEYS, MAX, DEFAULTS, isPublic, titlePrefix, defaults, raw, values, isDefault, save, reset, sub, officeFull, onChange, applyDoc };
  root.PONames = api;
  root.PO_NM = sub;
  if (root.document && root.PODesktop) syncBoss();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
