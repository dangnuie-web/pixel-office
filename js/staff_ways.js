(function (root) {
  'use strict';
  const PASTE = 'Claude Code에서 이 사무실 폴더를 열고 붙여 넣으세요.';
  const WAYS = {
    squirrel: { label: '일정 열기', go: 'calendar', ex: ['오늘 할 일 정리해줘', '이번 주 일정 보고 무엇부터 할지 알려줘', '첫 프로젝트 로드맵에서 다음 칸을 맞는 직원에게 맡겨줘'], guide: true },
    owl: { label: '아이디어 보드 열기', go: 'ideas', ex: ['{n}첫 프로젝트 소개 글을 세 줄로 써줘', '{n}아이디어 보드 첫 줄로 짧은 이야기 줄거리 짜줘'] },
    chameleon: { label: '픽셀 공방 열기', go: 'pixel', ex: ['{n}첫 프로젝트 스타일 가이드(색·글꼴) 만들어줘', '{n}앱 아이콘 시안 세 개를 html로 나란히 보여줘'] },
    penguin: { label: '로드맵 보기', go: 'projects', ex: ['{n}첫 프로젝트 로드맵 보고 첫 화면을 html로 만들어줘', '{n}만든 코드 실행해 보고 오류 고쳐줘'] },
    duck: { label: '자료 보관 열기', go: 'shelf', ex: ['{n}사무실 폴더에서 중복·옛 버전 찾아서 정리 계획서 써줘', '{n}이름 규칙에 안 맞는 파일 목록 뽑아줘'] },
    hedgehog: { label: '끝낸 칸 보기', go: 'projects', ex: ['{n}첫 프로젝트 결과물 검토해서 틀린 곳·빠진 곳 적어줘', '{n}로드맵 한 줄 목표와 결과물이 맞는지 봐줘'] },
    beaver: { label: '새 프로젝트 만들기', go: 'newProject', ex: ['{n}새 프로젝트 계획이랑 로드맵 짜줘', '{n}첫 프로젝트 무엇부터 할지 순서 정해줘'] },
  };
  const ANIMAL = { 다람쥐: 'squirrel', 부엉이: 'owl', 카멜레온: 'chameleon', 펭귄: 'penguin', 오리: 'duck', 고슴도치: 'hedgehog', 비버: 'beaver' };
  const pub = () => root.PO_PUBLIC === true;
  function idOf(s) {
    if (!s) return null;
    if (WAYS[s.id]) return s.id;
    if (WAYS[s.key]) return s.key;
    return ANIMAL[s.animal] || null;
  }
  function waysOf(s) { if (!pub()) return null; const id = idOf(s); return id ? Object.assign({ id }, WAYS[id]) : null; }
  const batchim = (w) => { const c = String(w).charCodeAt(String(w).length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0; };
  function call(name) { return name + (batchim(name) ? '아' : '야') + ', '; }
  function example(s, i) { const w = waysOf(s); if (!w) return ''; const t = w.ex[(i || 0) % w.ex.length]; return t.replace('{n}', call(s.name || '')); }
  function examples(s) { const w = waysOf(s); return w ? w.ex.map((_, i) => example(s, i)) : []; }

  async function doNow(s) {
    const w = waysOf(s), App = root.POApp;
    if (!w || !App) return false;
    if (root.POGame) { try { root.POGame.closeDialog(); root.POGame.closeWin(); } catch (e) {  } }
    if (w.go === 'pixel') { if (!root.POPixel) return false; root.POPixel.open({ side: 'paint', from: 'staff' }); return true; }
    App.selectTab(w.go === 'newProject' ? 'projects' : w.go);
    if (w.go === 'newProject') {
      for (let i = 0; i < 40; i++) {
        const b = root.document.querySelector('#projects [data-act="mk-open"]');
        if (b) { if (b.getAttribute('aria-expanded') !== 'true') b.click(); return true; }
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    return true;
  }
  async function askAI(s, i) {
    const text = example(s, i);
    if (!text) return { ok: false, text: '' };
    const C = root.POClip;
    const ok = C ? await C.write(text) : false;
    return { ok, text };
  }
  root.POStaffWays = { WAYS, PASTE, waysOf, example, examples, doNow, askAI, call };
})(window);
