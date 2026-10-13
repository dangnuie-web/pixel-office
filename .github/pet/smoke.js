#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, execFileSync } = require('child_process');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--shot');
const exe = pos[0], appDir = pos[1] || null;
const shotAt = args.indexOf('--shot');
const shot = shotAt >= 0 ? path.resolve(args[shotAt + 1]) : null;
const REAL = args.includes('--real-capture');
if (!exe || !fs.existsSync(exe)) { console.error('실행 파일이 없어요: ' + exe); process.exit(2); }
if (REAL && process.platform === 'darwin') { console.error('맥에서는 --real-capture 를 쓰지 않아요 (화면 녹음 권한 창)'); process.exit(2); }

let pass = 0, fail = 0;
const check = (label, cond, extra) => { if (cond) { pass++; console.log('  통과 ' + label); } else { fail++; console.log('  X ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 500) : '')); } };

function solidPng(file, w, h, rgb) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function moveCursor(x, y) {
  if (process.platform !== 'win32') return false;
  const ps = 'Add-Type -Name U -Namespace W -MemberDefinition \'[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);\'; [W.U]::SetCursorPos(' + Math.round(x) + ',' + Math.round(y) + ') | Out-Null';
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
  return true;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TP_TMP || os.tmpdir(), 'pet-smoke-'));
  const office = path.join(tmp, 'office'), devDir = path.join(tmp, 'dev');
  fs.mkdirSync(path.join(office, '10_프로젝트', '01_진행'), { recursive: true });
  fs.writeFileSync(path.join(office, 'CLAUDE.md'), '# 시험 사무실\n\n## 대표\n- 픽셀\n');
  fs.mkdirSync(devDir, { recursive: true });
  const fake = path.join(tmp, 'screen.png');
  solidPng(fake, 64, 40, [0xF2, 0xC6, 0x41]);
  const env = Object.assign({}, process.env, { TP_PUBLIC: '1', TP_DEV: '1', TP_DEV_DIR: devDir, TP_USERDATA: path.join(tmp, 'userData'), TP_OFFICE: office, TP_NO_CLIPBOARD: '1' });
  if (!REAL) env.TP_COLOR_SHOT = fake;
  delete env.ELECTRON_RUN_AS_NODE;
  const argv = (appDir ? [path.resolve(appDir)] : []).concat(['--use-mock-keychain', '--password-store=basic']);
  const proc = spawn(exe, argv, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', exited = null;
  proc.stdout.on('data', (b) => { log += b; }); proc.stderr.on('data', (b) => { log += b; });
  proc.on('exit', (c) => { exited = c; });
  const killer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {  } }, 150000);

  const cmdFile = path.join(devDir, 'cmd.json'), outFile = path.join(devDir, 'cmd.out');
  let seq = 0;
  async function cmd(c, wait) {
    try { fs.unlinkSync(outFile); } catch (e) {  }
    fs.writeFileSync(cmdFile, JSON.stringify(Object.assign({ n: ++seq }, c)));
    for (let i = 0; i < (wait || 60); i++) {
      await sleep(250);
      if (exited !== null) return null;
      try { const t = fs.readFileSync(outFile, 'utf8'); if (t) return JSON.parse(t); } catch (e) {  }
    }
    return null;
  }
  for (let i = 0; i < 120 && exited === null && !fs.existsSync(path.join(devDir, 'app.pid')); i++) await sleep(500);
  check('앱이 켜짐 (개발 명령 준비)', fs.existsSync(path.join(devDir, 'app.pid')), { exited, log: log.slice(-800) });
  if (exited === null && fs.existsSync(path.join(devDir, 'app.pid'))) {
    await sleep(2500);
    let s = await cmd({ do: 'state' });
    check('공용판으로 켜짐', s && s.edition === 'public', s);
    check('사무실 = 시험 폴더', s && s.office && path.resolve(s.office) === path.resolve(office), s && s.office);
    check('펫 창이 화면 안에 있음', s && s.bounds && s.displays.some((d) => s.bounds.x + s.bounds.width > d.bounds.x && s.bounds.x < d.bounds.x + d.bounds.width && s.bounds.y + s.bounds.height > d.bounds.y && s.bounds.y < d.bounds.y + d.bounds.height), s && { b: s.bounds, d: s.displays });
    check('처음엔 클릭 통과 (투명 창 뒤를 누를 수 있음)', s && s.ignore === true, s && s.ignore);
    await cmd({ do: 'mode', mode: 'talk' });
    s = await cmd({ do: 'state' });
    if (s && moveCursor(s.cx, s.by - 40)) {
      await sleep(900);
      const on = await cmd({ do: 'state' });
      check('커서가 펫 위에 오면 클릭 받기로 바뀜 (커서 감시)', on && on.ignore === false, on && { ignore: on.ignore, cx: on.cx, by: on.by });
      moveCursor(Math.max(0, s.cx - 600), Math.max(0, s.by - 500));
      await sleep(1200);
      const off = await cmd({ do: 'state' });
      check('커서가 떠나면 다시 클릭 통과', off && off.ignore === true, off && off.ignore);
    } else console.log('  (커서 옮기기 건너뜀: ' + process.platform + ' — 윈도우 서버에서만)');
    const c = await cmd({ do: 'color', wait: 2500 }, 80);
    check('색 뽑기 덮개 창이 화면마다 열림', c && c.open >= 1 && c.shots && c.shots.length === c.open, c);
    if (c && c.open >= 1) {
      const b = c.shots[0].bounds;
      const k = await cmd({ do: 'colorMouse', i: 0, events: [{ type: 'mouseMove', x: Math.round(b.width / 2), y: Math.round(b.height / 2) }, { type: 'mouseDown', x: Math.round(b.width / 2), y: Math.round(b.height / 2), button: 'left' }, { type: 'mouseUp', x: Math.round(b.width / 2), y: Math.round(b.height / 2), button: 'left' }], wait: 800 });
      check('누른 점의 색이 HEX 로 나옴', k && /^#[0-9A-F]{6}$/.test(k.lastColor || ''), k);
      if (!REAL) check('가짜 화면 색과 같음 (#F2C641)', k && k.lastColor === '#F2C641', k && k.lastColor);
      check('색을 고르면 덮개 창이 닫힘', k && k.open === 0, k);
    }
    if (shot) {
      await cmd({ do: 'capture' });
      const p = path.join(devDir, 'pet.png');
      if (fs.existsSync(p)) { fs.mkdirSync(path.dirname(shot), { recursive: true }); fs.copyFileSync(p, shot); console.log('펫 창 그림: ' + shot); }
    }
  }
  try { proc.kill(); } catch (e) {  }
  for (let i = 0; i < 20 && exited === null; i++) await sleep(250);
  if (exited === null) try { proc.kill('SIGKILL'); } catch (e) {  }
  clearTimeout(killer);
  console.log('\n' + pass + '개 통과, ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('연기 시험 오류: ' + (e && e.stack || e)); process.exit(1); });
