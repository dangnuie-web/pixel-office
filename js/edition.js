window.PO_PUBLIC = true;
(function (root) {
  'use strict';
  if (root.PO_PUBLIC === true) return;
  let q = false;
  try { q = /(^|[?&])public(=1)?(&|$)/.test(String(root.location && root.location.search || '').replace(/^\?/, '')); } catch (e) { q = false; }
  const desk = !!(root.PODesktop && root.PODesktop.publicEdition === true);
  if (q || desk) root.PO_PUBLIC = true;
})(window);
