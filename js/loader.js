(function (root) {
  'use strict';
  const FS = root.POFS;
  const TEST_SUB_MAIN = '기획/시험자료/20260930_pixel-office_진행현황시험본_v01.md', TEST_SUB_APP = '기획/시험자료/20260930_pixel-office_부록A시험줄_v01.md';
  const TEST_MAIN = FS.poRels(TEST_SUB_MAIN)[0];
  const TEST_APP = FS.poRels(TEST_SUB_APP)[0];

  const store = {
    key(mode, k) { return 'po.' + mode + '.' + k; },
    get(mode, k) { try { return JSON.parse(localStorage.getItem(this.key(mode, k))); } catch (e) { return null; } },
    set(mode, k, v) { try { localStorage.setItem(this.key(mode, k), JSON.stringify(v)); } catch (e) {  } },
  };

  const PJ_GO = '10_프로젝트/01_진행';
  async function readRecordSources(handle, files) {
    const dirs = await FS.listProjectDirs(handle, PJ_GO);
    const got = await Promise.all(dirs.map(async (raw) => {
      const path = PJ_GO + '/' + raw + '/로드맵.md';
      try { const r = await FS.readText(handle, path); return { project: FS.projectName(raw), text: r.text, path: path.normalize('NFC'), lastModified: r.lastModified }; }
      catch (e) { return { project: FS.projectName(raw), text: null }; }
    }));
    got.forEach((g) => { if (g.path) files.push({ path: g.path, lastModified: g.lastModified }); });
    return got.map((g) => ({ project: g.project, text: g.text }));
  }

  const SIGNAL_SUB = '개발/직원신호.json', SIGNAL = FS.poRels(SIGNAL_SUB)[0];
  async function readSignal(handle, files) {
    if (root.PO_PUBLIC === true) return null;
    try { const r = await FS.readTextFirst(handle, FS.poRels(SIGNAL_SUB)); files.push({ path: r.path, lastModified: r.lastModified }); return r.text; }
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
        const a = await FS.readTextFirst(handle, FS.poRels(TEST_SUB_MAIN)); const b = await FS.readTextFirst(handle, FS.poRels(TEST_SUB_APP));
        files.push({ path: a.path, lastModified: a.lastModified }, { path: b.path, lastModified: b.lastModified });
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
