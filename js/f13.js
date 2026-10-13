(function (root) {
  'use strict';
  const C = root.POCore;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const locName = { desk: '책상', break: '휴게실', meeting: '회의실', avatar: '아바타 곁' };
  const NM = (t) => (root.PO_NM || String)(t);

  function table(head, rows) {
    return '<table><thead><tr>' + head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + r.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  const KIND = { sofa: '소파', table: '테이블', chat: '수다', coffee: '커피 혼자', alone: '혼자(대기)', fallback: '첫 칸' };
  function breakTable(st) {
    const B = st.breakSeat;
    if (!B) return '';
    const S = root.POSprites, LNS = root.PO_LINES;
    const nameOf = (k) => (st.staff.find((s) => s.key === k) || {}).name || k;
    const notices = B.notices.slice();
    const rows = st.staff.filter((s) => B.seats[s.key]).map((s) => {
      const t = B.seats[s.key];
      const sp = S && LNS && LNS.SPRITE[s.key] ? S.poseSprite(LNS.SPRITE[s.key], t.pose, t.face) : { key: '-', flip: false, miss: null };
      if (sp.miss === 'dir') notices.push('방향 그림 없음 -> 정면: ' + s.name + ' (' + t.pose + ' ' + t.face + ')');
      if (sp.miss === 'pose') notices.push('자세 그림 없음 -> 대기 정면: ' + s.name + ' (' + t.pose + ')');
      return [s.name + (s.mark ? ' ' + s.mark : ''), t.no || '-', t.x + ',' + t.y + (t.px != null ? ' (' + t.px + ',' + t.py + 'px)' : ''), KIND[t.kind] || t.kind, t.pose, t.face,
        sp.key + (sp.flip ? ' (뒤집음)' : ''), t.how];
    });
    let h = '<h3>휴게 자세 (G-3 배정)</h3><p>씨앗 칸 <b>' + esc(st.breakSeed) + '</b> (30분 칸 ' + st.breakSlot + ') · 섞은 줄: ' + esc(B.line.map(nameOf).join(' → ') || '-') + '</p>';
    h += table(['직원', '자리', '칸', '종류', '자세', '방향', '그림', '어떻게'], rows);
    h += '<p' + (B.warnings.length ? ' class="warn"' : '') + '>경고 ' + B.warnings.length + (B.warnings.length ? ': ' + esc(B.warnings.join(' / ')) : '') + '</p>';
    h += '<p>알림 ' + notices.length + (notices.length ? ': ' + esc(notices.join(' / ')) : '') + '</p>';
    return h;
  }

  function roadmapTable(st) {
    const R = st.roadmap;
    if (!R) return '';
    const rows = R.cells.map((c) => [c.project, c.line + '줄', c.short,
      c.owners.join('·') || '-', c.unknown.length ? '모르는 이름: ' + c.unknown.join('·') : '',
      c.owner ? NM('당니님 차례') : c.owners.length ? '책상' : '자리 없음(모르는 이름)']);
    R.skipped.forEach((k) => rows.push([k.project, '-', '', '', '', '건너뜀: ' + k.why]));
    let h = '<h3>로드맵 기본층 (맨 위 미체크 칸)</h3>';
    h += table(['프로젝트', '줄', '칸', '담당', '모르는 이름', '결과'], rows);
    h += NM('<p>당니님 결정 기다리는 칸 <b>') + R.ownerTurn.length + '</b> · 직원 책상: ' + esc(Object.keys(R.byName).map((n) => n + ' ' + R.byName[n].length + '칸').join(', ') || '-') +
      ' · 모르는 이름 ' + R.unknown.length + '</p>';
    return h;
  }

  const SIG_STATE = { working: '일하는 중', idle: '쉬는 중', error: '오류' };
  function signalTable(st) {
    const S = st.signal;
    if (!S) return '';
    let h = '<h3>에이전트 신호층 (개발/직원신호.json)</h3>';
    const ignored = S.rows.filter((r) => r.ignore);
    const ignTxt = ignored.length ? ' · 무시한 줄 ' + ignored.length + ': ' + esc(ignored.map((r) => (r.type || '(빈 종류)') + ' ' + r.ignore).join(' / ')) : '';
    if (S.status !== 'ok' || !S.valid) {
      h += '<p id="f13-signal" data-signal="none"><b>에이전트 신호 없음</b>' + (S.status !== 'ok' ? ' (' + esc(S.why) + ')' : '') + ignTxt + '</p>';
      return h;
    }
    const names = Object.keys(S.byName);
    const rows = st.staff.filter((s) => names.indexOf(s.name) >= 0).map((s) => {
      const g = S.byName[s.name], v = s.sig || {};
      return [s.name, SIG_STATE[g.state] + (g.n > 1 ? ' (신호 ' + g.n + '개)' : ''), C.fmtMin(g.t), (v.age != null ? v.age + '분' : '-'),
        v.use ? locName[s.place] + (s.mark ? ' ' + s.mark : '') : '기본층 그대로 (' + (locName[s.place] || s.place) + ')', v.why || ''];
    });
    h += '<div id="f13-signal" data-signal="ok">' + table(['직원', '합친 상태', '시각', '지난 시간', '결과', '판정'], rows) + '</div>';
    h += '<p>신호 ' + S.rows.length + '줄 · 직원에 맞음 ' + S.valid + ' · 기본층을 덮음: ' + esc(S.applied.join(', ') || '-') + ignTxt + '</p>';
    return h;
  }

  function render(el, settings, result, layoutReport) {
    let h = '';
    h += '<div class="f13-bar">' +
      '<label>기준 시각 <input id="f13-base" type="text" value="' + esc(settings.baseStr) + '" size="16" placeholder="YYYY-MM-DD HH:MM (비우면 지금)"></label>' +
      '<label>읽을 파일 <select id="f13-mode"><option value="real">실제</option><option value="test">' + (root.PO_PUBLIC === true ? '시연 자료' : '시험본') + '</option></select></label>' +
      '<label>인사 경우 <select id="f13-greet"><option value="basic">기본</option><option value="first">첫 방문</option><option value="replay">다시 보기</option></select></label>' +
      '<button id="f13-run">다시 계산</button> <button id="f13-apply">이 설정으로 사무실 열기</button> <button id="f13-close">닫기</button></div>';
    if (!result || !result.input) {
      h += '<p class="warn">읽은 값이 없습니다. ' + esc(result && result.error || '폴더를 먼저 연결해 주세요.') + '</p>';
      el.innerHTML = h; return;
    }
    const st = result.state;
    h += '<p>기준 시각 <b>' + esc(st.baseStr) + '</b> · 업무일 ' + esc(st.baseBD) + ' · 읽을 파일 ' + (settings.mode === 'test' ? (result.demo ? esc(root.PODemo.LABEL) : '시험본(진행현황 시험본 + 부록 A)') : '실제 (직원 위치 원천 ' + (st.source === 'roadmap' ? '로드맵 기본층: 진행 프로젝트 로드맵 맨 위 칸' + (st.signal ? ' + 에이전트 신호층' : '') : st.hasRecords ? '있음' : '없음: 모두 기본 자리') + ')') +
      (result.readFail ? ' · <span class="warn">읽기 실패: ' + esc(result.error) + ' (지난 값 표시)</span>' : '') + '</p>';
    h += '<p class="files">읽은 파일: ' + result.files.map((f) => esc(f.path)).join(', ') + '</p>';

    h += '<h3>직원</h3>' + table(['직원', '키', '가장 최근 기록', '상태·메모', '위치', '표시', '판정', '오늘 완료(종이)'], st.staff.map((s) => [
      s.name, s.key, s.latest ? s.latest.time + ' (' + s.latest.label + ')' : '없음', s.latest ? s.latest.statusWord + (s.latest.statusWord !== s.latest.status ? '→' + s.latest.status : '') + ' · ' + s.latest.project + ' · ' + C.cut(s.latest.memo, 24) : '',
      locName[s.place] + (s.place !== s.loc ? ' (책상 없음)' : ''), s.mark || '-', s.why, s.todayDone.length + ' (' + Math.min(s.todayDone.length, 5) + ')',
    ]));

    h += '<h3>값</h3>' + table(['값', '결과'], [
      ['n (오늘 완료 줄)', st.n],
      ['책상', st.deskNames.join(', ') || '-'], ['"?"', st.qNames.join(', ') || '-'], ['"!"', st.exNames.join(', ') || '-'],
      ['대기 프로젝트 (최신순)', st.waits.map((w) => w.project + ' (' + w.label + ')').join(', ') || '-'],
      ['기록 후보 / 기준 시각 이하로 읽힌 줄', st.counts.candidates + ' / ' + st.counts.readable],
      ['읽지 못한 줄', st.counts.unreadable + '  ' + st.unreadable.map((u) => u.label + ' ' + u.why).join(' · ')],
      ['모르는 이름', st.counts.unknownNames + '  ' + st.unknownNames.map((u) => '"' + u.name + '" ' + u.label).join(' · ')],
      ['미래 시각 줄', st.counts.future + '  ' + st.future.map((r) => r.label + ' ' + r.time).join(' · ')],
      ['명부 해석 경고', st.roster.warnings.length + '  ' + st.roster.warnings.join(' / ')],
      ['책상 없음 경고', st.noDesk.length + '  ' + st.noDesk.join(', ')],
      ['배치 경고 (닿을 수 없음·휴게실 자리 표, 개-4·G-9)', layoutReport.problems.length + '  ' + layoutReport.problems.join(' / ')],
      ['배치 알림 (이름표 겹침, U11b 전까지 알림)', (layoutReport.notices || []).length + '  ' + (layoutReport.notices || []).join(' / ')],
    ]);
    h += signalTable(st);
    h += roadmapTable(st);
    h += breakTable(st);
    const br = result.briefing;
    h += '<h3>브리핑 말풍선 (인사 경우: ' + esc(settings.greet) + ')</h3>';
    h += '<div class="cols"><div><h4>상한 적용 전 (' + br.before.length + ')</h4><ol>' + br.before.map((b) => '<li><code>' + esc(b.id) + '</code> ' + esc(NM(b.text)) + '</li>').join('') + '</ol></div>' +
      '<div><h4>상한 적용 후 (' + br.bubbles.length + ')</h4><ol>' + br.bubbles.map((b) => '<li>' + esc(NM(b)) + '</li>').join('') + '</ol><p class="files">' + br.steps.map(esc).join('<br>') + '</p></div></div>';
    el.innerHTML = h;
    el.querySelector('#f13-mode').value = settings.mode;
    el.querySelector('#f13-greet').value = settings.greet;
  }

  root.POF13 = { render };
})(window);
