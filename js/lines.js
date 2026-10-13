(function (root) {
  'use strict';
  const LINES = {
    '토리': { any: [
      '모으는 건 제가, 고르는 건 당니님이 하세요.', '숫자는 세어 드리고, 모르는 건 모른다고 할게요.', '할 일을 도토리처럼 모아 두는 중이에요.',
      '당니님 차례 칸은 서류함 보드에 붙여 둘게요.', '대신 결정하지는 않아요. 고르기 쉽게만 적어요.', '앞이 빈 곳에서 Space를 누르시면 다시 말씀드려요.'],
    intro: '할 일을 도토리처럼 모아요. 직원을 부르고, 당니님 곁에서 브리핑해요.' },
    teacher: { break: ['쉬는 시간! 머리도 휴대폰처럼 충전이 필요해요.', '다음 강의 주제가 정해지면 불러 주세요.', '어려운 말을 쉬운 말로 바꾸는 연습은 쉬면서도 해요.'],
      desk: ['{프로젝트} 원고 쓰는 중이에요. 한 단계에 한 동작씩!', '여기엔 비유가 하나 필요해요. 블록 쌓기로 해 볼까요?', "메뉴 위치를 모르면 '확인 필요'라고 적어 둬요."],
      stop: '잠깐 멈췄어요. 사정은 아래 메모에 있어요.', stopSig: '앗, 하다가 멈췄어요. 다시 불러 주시면 그때 이어요!', long: '아직 쓰는 중이에요. 한 단계씩 하다 보니 길어졌어요.',
      intro: '안경 쓰고 지시봉 든 선생님. 입문자 눈높이로 강의 원고를 써요.' },
    'blog-editor': { break: ['몽글몽글 쉬는 중이에요.', '통과된 원고가 오면 곱게 빗어서 글로 만들게요.', '발행은 당니님이 하셔요. 저는 붙여 넣기 좋게만요.'],
      desk: ['{프로젝트} 글을 다듬고 있어요. 한 문단은 세 줄까지요.', "첫 세 줄에 '이 글로 할 수 있는 것'을 넣는 중이에요.", '글만 길면 숨차요. 이미지 자리를 표시하고 있어요.'],
      stop: '살짝 멈췄어요. 아래 메모를 봐 주세요.', stopSig: '살짝 멈췄어요. 다시 불러 주시면 그때 빗을게요.', long: '아직 빗는 중이에요. 조금만 더요.',
      intro: '통과된 강의 원고를 부드럽게 읽히는 블로그 글로 바꿔요.' },
    'scenario-writer': { break: ['낮에는 눈을 반만 떠요. 이야기는 밤에 잘 들리거든요.', '좋은 첫 문장이 떠오르면 가장 먼저 들려드릴게요.', '무서운 건 피 대신 소리와 흔적으로 만들어요.'],
      desk: ['{프로젝트} 쓰는 중이에요. 첫 장면에 질문을 숨겨요.', '단서는 다 보이게 둬요. 알아채는 순서만 제가 정해요.', '이 대사, 한 줄로 성격이 보이는지 다시 읽고 있어요.'],
      stop: '이야기가 한 장면에서 멈췄어요. 까닭은 아래 메모에.', stopSig: '이야기가 한 장면에서 멈췄어요. 다음 장은 다시 불러 주실 때.', long: '아직 쓰는 중이에요. 밤이 길어지네요.',
      intro: '밤에 깨어 이야기를 지어요. 스토리, 대사, 단서를 써요.' },
    designer: { break: ['창밖 저녁 색을 모으는 중이에요. 배경에 쓰기 좋아요.', '제 몸이 방 색을 닮으면, 잘 맞는 색이란 뜻이에요.', '걸리는 곳만 짚어 주세요. 이유는 제가 찾을게요.'],
      desk: ['{프로젝트} 그리는 중이에요. 픽셀 하나에 표정이 달라져요.', '색을 줄여 보는 중이에요. 적을수록 직원이 먼저 보여요.', '작은 창에서도 읽히는지 두 배로 키워 보고 있어요.'],
      stop: '손을 멈췄어요. 왜인지는 아래 메모에 있어요.', stopSig: '손을 멈췄어요. 다시 부르시면 그때 이어 그릴게요.', long: '아직 그리는 중이에요. 픽셀이 좀 많네요.',
      intro: '보는 색을 흡수하는 디자이너. 아트 방향과 코드 픽셀아트를 맡아요.' },
    developer: { break: ['쉬는 중입니다. 키보드가 없으니 좀 허전하네요.', '만들 게 생기면 불러 주세요. 기획서부터 읽겠습니다.', '설치가 필요하면 먼저 말씀드립니다. 몰래 깔지 않아요.'],
      desk: ['{프로젝트} 만드는 중입니다. 작게 돌아가는 것부터요.', '돌려 본 것만 된다고 말씀드립니다.', '기능 하나 끝날 때마다 실행하고 저장해 둡니다.'],
      stop: '멈췄습니다. 막힌 곳은 아래 메모에 적었어요.', stopSig: '오류로 멈췄습니다. 다시 부르시면 확인부터 하겠습니다.', long: '아직 돌아가는 중입니다. 길어지면 들여다봐 주세요.',
      intro: '뿔테 안경의 펭귄. 기획서와 디자인을 코드로 만들고 직접 돌려 봐요.' },
    organizer: { break: ['쉬는 중이에요. 정리는 계획부터예요.', '지우는 건 제가 안 해요. 승인이 먼저예요.', '같은 파일 두 개 보이면 불러 주세요. 줄 세울게요.'],
      desk: ['{프로젝트} 정리 계획 세우는 중이에요.', '옮길 것, 바꿀 것, 지울 후보. 세 줄로 나눠요.', "확실하지 않으면 안 건드려요. '판단 필요'로 올려요."],
      stop: '멈춤이에요. 사유는 아래 메모.', stopSig: '멈춤이에요. 다시 부르시면 계획부터 볼게요.', long: '아직 줄 세우는 중이에요. 조금 길어요.',
      intro: '파일을 줄 세우는 깔끔쟁이. 계획을 세우고 승인된 것만 옮겨요.' },
  };

  const ROOMS = {
    lobby: { get text() { return (root.PO_PUBLIC === true ? '안내 데스크.' : '토리 자리.') + ' 당니님 결정을 기다리는 칸이 모여요.'; }, get sign() { return root.PO_PUBLIC === true ? '당니오피스.' : '당니오피스. 실험하고, 만들고, 가르치는 1인 스튜디오.'; } },
    work: { text: "직원들의 책상. 맡은 칸이 있거나 부름을 받은 직원이 앉아요. '?'는 일이 길어진다는 표시예요." },
    break: { text: "맡은 칸이 없는 직원이 쉬는 곳. '!'는 일하다 멈춘 직원이에요." },
    meeting: { text: '칠판엔 당니님 아이디어가 포스트잇으로 붙어 있어요. 여러 직원이 함께 일하는 규칙은 아직 없어요.', textTF: '여러 직원이 함께 하는 일(TF)을 하는 방이에요. 칠판엔 당니님 아이디어가 붙어 있어요.' },
    archive: { text: '자료 보관 탭의 책이 꽂힌 책꽂이예요. 책꽂이 앞에서 Space를 누르면 책을 골라 펼칠 수 있어요.' },
  };

  const POINT = {
    '토리': '#F2C641', teacher: '#2FB35A', critic: '#D65A4E', 'blog-editor': '#962A57',
    planner: '#F5A3C0', 'scenario-writer': '#8452D0', designer: '#D03CC6', developer: '#86CFF5', organizer: '#1FA39C',
  };
  const SPRITE = {
    '토리': 'tori_idle', teacher: 'bana_idle', critic: 'dochi_idle', 'blog-editor': 'monggeul_idle',
    planner: 'ttukttak_idle', 'scenario-writer': 'bugi_idle', designer: 'munui_idle', developer: 'bit_idle', organizer: 'ori_idle',
  };

  const PORTRAITS = new Set(['tori', 'bana', 'bit', 'bugi', 'monggeul', 'munui', 'ori', 'dochi', 'ttukttak', 'avatar']);
  function portraitSrc(spriteKey) { const base = spriteKey && spriteKey.replace(/_idle$/, ''); if (!base || !PORTRAITS.has(base)) return null; if (root.PO_PUBLIC === true && base === 'avatar') return null; return 'assets/portraits/' + base + '.png'; }

  const PUB = root.POCore && root.POCore.PUBLIC_STAFF;
  (PUB || []).forEach((p) => { if (SPRITE[p.char]) SPRITE[p.id] = SPRITE[p.char]; if (POINT[p.char]) POINT[p.id] = POINT[p.char]; });

  const PUBLIC_LINES = {
    squirrel: { any: ['어서 오세요. 찾는 직원이 있으면 바로 불러 드려요.', '오늘 일정은 볼에 다 모아 뒀어요. 물어보세요.', '처음 오셨으면 제가 안내해 드려요. 꼬리 따라오세요.', '회의 시간 되면 제가 다들 불러 모을게요.', '전할 말은 볼에 모아 뒀어요. 필요하면 꺼내 드려요.', '누가 어디 있는지 다 알아요. 저한테 물어보세요.'] },
    owl: { break: ['낮잠 중이에요. 한쪽 눈은 뜨고 이야깃거리를 찾아요.', '고개를 반 바퀴 돌리면 사무실이 다 이야깃거리예요.', '밤이 오면 문장이 더 잘 와요. 그때까지 아껴 둬요.'],
      desk: ['{프로젝트}, 첫 문장을 밤새 고르고 있어요.', '이야기 다음 장을 쓰는 중이에요. 조용히 부탁해요.', '이 대사, 한 글자만 빼면 더 좋아질 것 같아요.'] },
    chameleon: { break: ['노을 색에 취했어요. 몸이 벌써 주황이에요.', '영감은 산책할 때 와요. 지금 오는 중이에요.', '제 세계에서 그림 구상 중이에요. 문은 열려 있어요.'],
      desk: ['{프로젝트} 화면에 맞는 색을 온몸으로 고르는 중이에요.', '이 그림은 아직 숨을 안 쉬어요. 조금만 더요.', '픽셀 하나만 옮겨 볼게요. 화면이 확 달라져요.'] },
    penguin: { break: ['키보드 자판 소리 비교 중이에요. 이건 명곡이에요.', '얼음 결정 모양을 코드로 그려 보는 중이에요. 그냥요.', '쉬는 중이에요. 머릿속 터미널은 안 꺼져요.'],
      desk: ['{프로젝트} 코드 짜는 중이에요. 중얼중얼, 아 여기구나.', '버그 냄새가 나요. 생선 냄새랑은 구분돼요.', '변수 이름 하나에 진심이에요. 중요하거든요.'] },
    duck: { break: ['꽥. 대걸레 산책 중이에요. 바닥도 정리 대상이에요.', '쉬는 중에도 겹친 자료가 눈에 밟혀요. 꽥.', '어질러진 데 보이면 알려 주세요. 금방 닦을게요.'],
      desk: ['{프로젝트} 자료를 칸칸이 꽂는 중이에요. 발은 바빠요.', '똑같은 파일 쌍둥이를 찾는 중이에요. 하나만 둘게요.', '책꽂이에 줄 맞춰 세우는 중이에요. 이름순으로요, 꽥.'] },
    hedgehog: { break: ['동그랗게 말려 쉬는 중이에요. 쉴 땐 안 따져요.', '쉬어도 오타는 눈에 들어와요. 못 본 척할게요.', '사과 한 조각이면 깐깐함이 조금 풀려요.'],
      desk: ['{프로젝트}, 틀린 곳 없나 코끝으로 짚는 중이에요.', '가시가 바짝 섰어요. 작은 실수도 걸려요.', '빠진 곳 없나 두 번 봐요. 앞에서 한 번, 거꾸로 한 번.'] },
    beaver: { break: ['통나무 갉으면서 다음 계획을 세워 봐요.', '쉬는 시간도 일정표에 넣어 뒀어요. 지금이에요.', '물소리 들리면 댐 설계가 떠올라요. 참는 중이에요.'],
      desk: ['{프로젝트}, 순서표부터 짜는 중이에요. 기둥은 그다음이에요.', '일정은 나뭇가지처럼 하나씩 맞물려야 해요.', '무엇부터 할지 정하는 중이에요. 순서가 반이에요.'] },
  };
  Object.keys(PUBLIC_LINES).forEach((id) => { LINES[id] = PUBLIC_LINES[id]; });
  function linesOf(s) {
    if (!s) return null;
    if (root.PO_PUBLIC !== true) return LINES[s.key] || null;
    const p = PUB && (PUB.find((x) => x.id === s.key) || PUB.find((x) => x.animal === s.animal));
    return p ? PUBLIC_LINES[p.id] || null : null;
  }
  function ownerPrefix() { return root.PO_PUBLIC === true ? 'bossavatar' : 'avatar'; }
  function ownerSprite() { return ownerPrefix() + '_idle'; }
  function ownerPixelSrc() { const S = root.POSprites, k = ownerSprite(); try { return S && S.has(k) ? S.frameCanvas(k, 0).toDataURL() : ''; } catch (e) { return ''; } }

  root.PO_LINES = { LINES, PUBLIC_LINES, linesOf, ROOMS, POINT, SPRITE, PORTRAITS, portraitSrc, ownerPrefix, ownerSprite, ownerPixelSrc };
})(typeof window !== 'undefined' ? window : globalThis);
