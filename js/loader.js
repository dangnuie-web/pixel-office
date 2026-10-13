(function (root) {
  'use strict';
  const FS = root.POFS;
  const TEST_DIR = '10_프로젝트/01_진행/pixel-office/기획/시험자료/';
  const TEST_MAIN = TEST_DIR + '20260930_pixel-office_진행현황시험본_v01.md';
  const TEST_APP = TEST_DIR + '20260930_pixel-office_부록A시험줄_v01.md';

  const store = {
    key(mode, k) { return 'po.' + mode + '.' + k; },
    get(mode, k) { try { return JSON.parse(localStorage.getItem(this.key(mode, k))); } catch (e) { return null; } },
    set(mode, k, v) { try { localStorage.setItem(this.key(mode, k), JSON.stringify(v)); } catch (e) {  } },
  };

  const PJ_GO = '10_프로젝트/01_진행';
  async function readRecordSources(handle, files) {
    const dirs = await FS.listDirs(handle, PJ_GO);
    const got = await Promise.all(dirs.map(async (raw) => {
      const path = PJ_GO + '/' + raw + '/로드맵.md';
      try { const r = await FS.readText(handle, path); return { project: raw.normalize('NFC'), text: r.text, path: path.normalize('NFC'), lastModified: r.lastModified }; }
      catch (e) { return { project: raw.normalize('NFC'), text: null }; }
    }));
    got.forEach((g) => { if (g.path) files.push({ path: g.path, lastModified: g.lastModified }); });
    return got.map((g) => ({ project: g.project, text: g.text }));
  }

  const SIGNAL = '10_프로젝트/01_진행/pixel-office/개발/직원신호.json';
  async function readSignal(handle, files) {
    if (root.PO_PUBLIC === true) return null;
    try { const r = await FS.readText(handle, SIGNAL); files.push({ path: SIGNAL, lastModified: r.lastModified }); return r.text; }
    catch (e) { return null; }
  }

  async function readAll(handle, opts) {
    const mode = opts.mode || 'real';
    const files = [];
    const out = { mode, readFail: false, error: '', files };
    if (mode === 'test' && root.PODemo && root.PODemo.on()) {
      files.push({ path: root.PODemo.LABEL, lastModified: 0 });
      out.input = root.PODemo.officeInput(); out.hasLast = true; out.demo = true;
      return out;
    }
    try {
      const roster = await FS.readText(handle, 'CLAUDE.md'); files.push({ path: 'CLAUDE.md', lastModified: roster.lastModified });
      let sources;
      if (mode === 'test') {
        const a = await FS.readText(handle, TEST_MAIN); const b = await FS.readText(handle, TEST_APP);
        files.push({ path: TEST_MAIN, lastModified: a.lastModified }, { path: TEST_APP, lastModified: b.lastModified });
        sources = [{ text: a.text, tag: 'main' }, { text: b.text, tag: 'appendix' }];
      } else {
        sources = null;
      }
      if (sources) out.input = { rosterText: roster.text, progressSources: sources };
      else out.input = { rosterText: roster.text, roadmaps: await readRecordSources(handle, files) };
      if (mode === 'real') store.set(mode, 'lastRead', out.input);
      if (out.input.roadmaps) out.input = Object.assign({}, out.input, { signalText: await readSignal(handle, files) });
      out.hasLast = true;
    } catch (e) {
      out.readFail = true;
      out.error = e.message;
      out.input = mode === 'real' ? store.get(mode, 'lastRead') : null;
      if (out.input) out.input = Array.isArray(out.input.roadmaps) ? { rosterText: out.input.rosterText, roadmaps: out.input.roadmaps } : { rosterText: out.input.rosterText };
      out.hasLast = !!out.input;
      if (!out.input) {
        try {
          const roster = await FS.readText(handle, 'CLAUDE.md');
          out.input = { rosterText: roster.text };
        } catch (e2) { out.input = null; }
      }
    }
    return out;
  }

  root.POLoader = { readAll, store, TEST_MAIN, TEST_APP, SIGNAL };
})(window);
