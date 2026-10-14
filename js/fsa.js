(function (root) {
  'use strict';

  const ALLOW_FILES = [
    /^CLAUDE\.md$/,
    /^10_프로젝트\/아이디어보관함\.md$/,
    /^10_프로젝트\/프로젝트목록\.md$/,
    /^10_프로젝트\/(01_진행|02_완료|03_보류)\/[^/]+\/로드맵\.md$/,
    /^10_프로젝트\/약속\.md$/,
    /^10_프로젝트\/할일\.md$/,
    /^10_프로젝트\/01_진행\/[^/]+\/계획서\.md$/,
    /^10_프로젝트\/01_진행\/pixel-office\/개발\/직원신호\.json$/,
    /^10_프로젝트\/01_진행\/pixel-office\/기획\/시험자료\/20260930_pixel-office_(진행현황시험본_v01|부록A시험줄_v01)\.md$/,
    /^10_프로젝트\/01_진행\/pixel-office\/기획\/시험자료\/20261008_pixel-office_(할일시험본_v01|로드맵시험본_v01)\.md$/,
  ];
  const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
  const FONT_EXT = /\.(otf|ttf|woff2?)$/i;
  ALLOW_FILES.push(
    /^40_자산\/자료\/(프롬프트|워크플로우)\/[^/]+\.md$/,
    /^40_자산\/(폰트|아이콘)\/출처\.md$/,
    /^40_자산\/픽셀\/[^/]+\.json$/,
    /^00_운영\/도구\/스킬표\.json$/,
    /^00_운영\/도구\/[^/]+\/사용법\.md$/,
    /^(00_운영\/정리\/작업지시서_(이름점검|컴퓨터정리)|10_프로젝트\/01_진행\/강의\/작업지시서_(블로그제작|원고작성))\.md$/,
  );
  const ALLOW_ASSET = [
    (p) => /^40_자산\/아이콘\/[^/]+\/[^/]+$/.test(p) && IMG_EXT.test(p),
    (p) => /^40_자산\/낙서\/[^/]+$/.test(p) && IMG_EXT.test(p),
    (p) => /^40_자산\/레퍼런스\/.+$/.test(p) && IMG_EXT.test(p),
    (p) => /^40_자산\/폰트\/(영문|한글)\/[^/]+$/.test(p) && FONT_EXT.test(p),
  ];
  const ALLOW_LIST_DIRS = [
    /^10_프로젝트\/(01_진행|02_완료|03_보류)$/,
    /^40_자산\/자료\/(프롬프트|워크플로우)$/, /^40_자산\/아이콘$/, /^40_자산\/아이콘\/[^/]+$/, /^40_자산\/폰트\/(영문|한글)$/, /^40_자산\/낙서$/, /^40_자산\/레퍼런스(\/.+)?$/,
    /^40_자산\/픽셀$/,
  ];
  const ALLOW_EXIST_DIRS = [/^00_운영$/, /^10_프로젝트$/];
  const ALLOW_WRITE = [/^10_프로젝트\/할일\.md$/,
    /^10_프로젝트\/약속\.md$/,
    /^00_운영\/도구\/스킬표\.json$/,
  ];
  const ALLOW_ROADMAP_CHECK = [/^10_프로젝트\/01_진행\/[^/]+\/로드맵\.md$/];
  const ALLOW_NEW = [/^40_자산\/픽셀\/\d{8}_픽셀_[^/]+_v\d{2,}\.json$/];
  const ALLOW_NEW_ROADMAP = [/^10_프로젝트\/01_진행\/[^/]+\/로드맵\.md$/];

  function segmentsOk(path) {
    const segs = path.split('/');
    if (segs.some((s) => s === '' || s.startsWith('.') || s === '_to_delete')) return false;
    if (segs[0] === '99_받은편지함' && segs.length > 1) return false;
    return true;
  }
  function allowed(path, kind) {
    path = String(path).normalize('NFC');
    if (!segmentsOk(path)) return false;
    if (kind === 'asset') return ALLOW_ASSET.some((f) => f(path));
    if (kind === 'file') return ALLOW_FILES.some((re) => re.test(path));
    if (kind === 'list') return ALLOW_LIST_DIRS.some((re) => re.test(path));
    if (kind === 'write') return ALLOW_WRITE.some((re) => re.test(path));
    if (kind === 'check') return ALLOW_ROADMAP_CHECK.some((re) => re.test(path));
    if (kind === 'new') return ALLOW_NEW.some((re) => re.test(path));
    if (kind === 'newRoadmap') return ALLOW_NEW_ROADMAP.some((re) => re.test(path));
    if (kind === 'exist') return ALLOW_EXIST_DIRS.some((re) => re.test(path)) || ALLOW_FILES.some((re) => re.test(path));
    return false;
  }
  function deny(path, kind) {
    const e = new Error('허용 목록 밖 ' + (kind === 'write' || kind === 'check' || kind === 'new' || kind === 'newRoadmap' ? '쓰기' : '읽기') + ' 차단: ' + kind + ' ' + String(path).normalize('NFC'));
    e.name = 'NotAllowed';
    throw e;
  }

  async function dirAt(handle, parts) {
    let h = handle;
    for (const p of parts) h = await h.getDirectoryHandle(p);
    return h;
  }
  async function readText(handle, path) {
    if (!allowed(path, 'file')) deny(path, 'file');
    const parts = path.split('/');
    const dir = await dirAt(handle, parts.slice(0, -1));
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fh.getFile();
    return { text: await file.text(), lastModified: file.lastModified, name: file.name };
  }
  async function listEntries(handle, path, kind) {
    if (!allowed(path, 'list')) deny(path, 'list');
    const dir = await dirAt(handle, path.split('/'));
    const names = [];
    for await (const [name, h] of dir.entries()) { if (h.kind === kind && !name.startsWith('.') && name !== '_to_delete') names.push(name); }
    return names.sort((a, b) => a.localeCompare(b, 'ko'));
  }
  function listNames(handle, path) { return listEntries(handle, path, 'file'); }
  async function listAll(handle, path) {
    if (!allowed(path, 'list')) deny(path, 'list');
    const dir = await dirAt(handle, path.split('/'));
    const out = [];
    for await (const [name, h] of dir.entries()) { if (!name.startsWith('.') && name !== '_to_delete') out.push({ name, nfc: name.normalize('NFC'), kind: h.kind }); }
    return out.sort((a, b) => a.nfc.localeCompare(b.nfc, 'ko', { numeric: true }));
  }
  const desktopBytes = () => root.PODesktop && typeof root.PODesktop.readBytes === 'function';
  async function readBytes(handle, path, max) {
    if (!allowed(path, 'asset')) deny(path, 'asset');
    if (desktopBytes()) {
      const r = await root.PODesktop.readBytes(path, max || 0);
      const u = r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data);
      return { bytes: u, size: r.size, lastModified: r.lastModified };
    }
    const parts = path.split('/');
    const dir = await dirAt(handle, parts.slice(0, -1));
    const file = await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    const blob = max ? file.slice(0, max) : file;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), size: file.size, lastModified: file.lastModified };
  }
  async function readBlob(handle, path, type) {
    if (!allowed(path, 'asset')) deny(path, 'asset');
    if (desktopBytes()) { const r = await readBytes(handle, path, 0); return new File([r.bytes], path.split('/').pop(), { type: type || '', lastModified: r.lastModified }); }
    const parts = path.split('/');
    const dir = await dirAt(handle, parts.slice(0, -1));
    const f = await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    return type && f.type !== type ? new File([f], f.name, { type, lastModified: f.lastModified }) : f;
  }
  function listDirs(handle, path) { return listEntries(handle, path, 'directory'); }
  async function exists(handle, path, kind) {
    if (!allowed(path, 'exist')) deny(path, 'exist');
    const parts = path.split('/');
    try {
      const dir = await dirAt(handle, parts.slice(0, -1));
      if (kind === 'dir') await dir.getDirectoryHandle(parts[parts.length - 1]);
      else await dir.getFileHandle(parts[parts.length - 1]);
      return true;
    } catch (e) { return false; }
  }
  async function isOfficeFolder(handle) {
    const second = root.PO_PUBLIC === true ? '10_프로젝트' : '00_운영';
    return (await exists(handle, 'CLAUDE.md', 'file')) && (await exists(handle, second, 'dir'));
  }

  function desktopWrite() {
    if (!(root.PODesktop && typeof root.PODesktop.write === 'function')) { const e = new Error('쓰기는 데스크톱 앱에서만 돼요'); e.name = 'NoWrite'; throw e; }
    return root.PODesktop.write;
  }
  async function writeText(path, text) {
    if (!segmentsOk(path) || !allowed(path, 'write')) deny(path, 'write');
    const w = desktopWrite();
    return w(path, String(text));
  }
  async function writeRoadmapCheck(handle, path, newText) {
    if (!segmentsOk(path) || !allowed(path, 'check')) deny(path, 'check');
    const w = desktopWrite();
    const cur = (await readText(handle, path)).text;
    if (!root.POCore.isCheckOnlyChange(cur, newText)) { const e = new Error('로드맵은 칸 끝 표시 한 줄만 바꿀 수 있어요 (그 사이 파일이 바뀌었을 수 있음)'); e.name = 'NotCheckOnly'; throw e; }
    return w(path, String(newText));
  }

  async function writeNew(path, text) {
    path = String(path).normalize('NFC');
    if (!segmentsOk(path) || !allowed(path, 'new')) deny(path, 'new');
    const w = desktopWrite();
    if (root.PODesktop.kind && (await root.PODesktop.kind(path))) { const e = new Error('이미 있어요: ' + path); e.name = 'Exists'; e.code = 'EEXIST'; throw e; }
    try { return await w(path, String(text), { newOnly: true }); } catch (err) {
      if (/EEXIST|exists/i.test(String(err && (err.code || err.message)))) { const e = new Error('이미 있어요: ' + path); e.name = 'Exists'; e.code = 'EEXIST'; throw e; }
      throw err;
    }
  }

  async function writeNewRoadmap(path, text) {
    path = String(path).normalize('NFC');
    if (!segmentsOk(path) || !allowed(path, 'newRoadmap')) deny(path, 'newRoadmap');
    const w = desktopWrite();
    const dir = path.replace(/\/로드맵\.md$/, '');
    if (root.PODesktop.kind && ((await root.PODesktop.kind(dir)) || (await root.PODesktop.kind(path)))) { const e = new Error('이미 있어요: ' + dir); e.name = 'Exists'; e.code = 'EEXIST'; throw e; }
    try { return await w(path, String(text), { newOnly: true }); } catch (err) {
      if (/EEXIST|exists/i.test(String(err && (err.code || err.message)))) { const e = new Error('이미 있어요: ' + dir); e.name = 'Exists'; e.code = 'EEXIST'; throw e; }
      throw err;
    }
  }
  async function writeRoadmapAdd(handle, path, newText) {
    if (!segmentsOk(path) || !allowed(path, 'check')) deny(path, 'check');
    const w = desktopWrite();
    const cur = (await readText(handle, path)).text;
    if (!root.POCore.isAddLineChange(cur, newText)) { const e = new Error('로드맵에는 할 일 한 줄만 넣을 수 있어요 (그 사이 파일이 바뀌었을 수 있음)'); e.name = 'NotAddOnly'; throw e; }
    return w(path, String(newText));
  }

  function idb() {
    return new Promise((res, rej) => {
      const q = indexedDB.open('pixel-office', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  }
  let saveHandle = async function (h) {
    const db = await idb();
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(h, 'dir'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  };
  let loadHandle = async function () {
    try {
      const db = await idb();
      return await new Promise((res) => { const tx = db.transaction('kv', 'readonly'); const r = tx.objectStore('kv').get('dir'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
    } catch (e) { return null; }
  };
  async function permission(h, request) {
    const opts = { mode: 'read' };
    if (!h.queryPermission) return 'granted';
    let p = await h.queryPermission(opts);
    if (p !== 'granted' && request) p = await h.requestPermission(opts);
    return p;
  }
  let pick = async function () {
    return root.showDirectoryPicker({ id: 'dangnee-office', mode: 'read' });
  };

  function desktopDir(prefix, name) {
    const D = root.PODesktop;
    const join = (n) => (prefix ? prefix + '/' + n : n);
    const notFound = () => new DOMException('없음', 'NotFoundError');
    return {
      kind: 'directory', name,
      async getDirectoryHandle(n) { if ((await D.kind(join(n))) !== 'directory') throw notFound(); return desktopDir(join(n), n); },
      async getFileHandle(n) {
        const p = join(n);
        if ((await D.kind(p)) !== 'file') throw notFound();
        return { kind: 'file', name: n, async getFile() { const r = await D.read(p); return new File([r.text], n, { lastModified: r.lastModified }); } };
      },
      async *entries() { for (const e of await D.list(prefix)) yield [e.name, e.kind === 'directory' ? desktopDir(join(e.name), e.name) : { kind: 'file', name: e.name }]; },
    };
  }
  if (root.PODesktop) {
    const h = desktopDir('', '');
    loadHandle = async () => h; pick = async () => h; saveHandle = async () => {};
    document.documentElement.classList.add('desktop');
    if (root.POPlat) root.POPlat.markHtml();
  }

  root.POFS = { allowed, readText, listNames, listDirs, listAll, readBytes, readBlob, IMG_EXT, FONT_EXT, exists, isOfficeFolder, saveHandle, loadHandle, permission, pick, writeText, writeRoadmapCheck, writeNew, writeNewRoadmap, writeRoadmapAdd };
})(typeof window !== 'undefined' ? window : globalThis);
