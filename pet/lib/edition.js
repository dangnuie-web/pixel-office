'use strict';
const BUILT_PUBLIC = true;

const EDITIONS = {
  dangnee: { key: 'dangnee', name: 'Pixel Office Pet', userDataDir: 'Pixel Office Pet', appId: 'com.dangnee.pixeloffice.pet' },
  public: { key: 'public', name: 'Pixel Office Pet', userDataDir: 'Pixel Office Pet', appId: 'com.dangnee.pixeloffice.pet' },
};

function features(pub) { return { lecture: !pub, house: !pub }; }
function isPublic(env) { return BUILT_PUBLIC === true || !!(env && env.TP_PUBLIC === '1'); }
function edition(pub) { return pub ? EDITIONS.public : EDITIONS.dangnee; }
function apply(pub) { globalThis.PO_PUBLIC = pub === true; return globalThis.PO_PUBLIC; }

module.exports = { BUILT_PUBLIC, EDITIONS, features, isPublic, edition, apply };
