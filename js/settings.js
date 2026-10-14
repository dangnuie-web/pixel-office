(function (root) {
  'use strict';
  const N = root.PONames;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let fitCtx = null;
  function fit(el) {
    const t = el.value || el.placeholder || '';
    const cs = getComputedStyle(el), px = parseFloat(cs.fontSize) || 15;
    let w = 0;
    try {
      fitCtx = fitCtx || document.createElement('canvas').getContext('2d');
      fitCtx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      w = fitCtx.measureText(t).width;
    } catch (e) { w = 0; }
    if (!w && t) w = [...t].reduce((a, c) => a + (/[ᄀ-ￜ]/.test(c) ? 1 : 0.65), 0) * px;
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    el.style.width = Math.ceil(Math.max(2.6 * px, w + pad + 2)) + 'px';
  }
  root.POFitName = fit;

  function creditsHtml() {
    const C = root.POCredits;
    if (!C) return '';
    return '<div class="st-panel st-credits" id="st-credits">' +
      '<h3>출처</h3>' +
      '<p class="st-desc">픽셀 오피스 (Pixel Office)를 만든 사람과 쓴 오픈소스' + (N.isPublic() ? '예요.' : '입니다.') + '</p>' +
      C.items().map((it) => '<div class="st-row"' + (it.owner ? ' data-credit-owner' : '') + '><span class="st-lb">' + esc(it.k) + '</span><span class="st-cr-v">' + esc(it.v) + '</span></div>').join('') +
      C.OPEN_SOURCE.map((o) => '<div class="st-row"><span class="st-lb">오픈소스</span><span class="st-cr-v"><b>' + esc(o.name) + ' ' + esc(o.ver) + '</b> · ' + esc(o.license) + '<br><small>' + esc(o.note) + '</small></span></div>').join('') +
      '<details class="st-cr-lic"><summary>Electron 라이선스 전문 (MIT)</summary><pre id="st-cr-electron">' + esc(C.ELECTRON_LICENSE) + '</pre></details>' +
    '</div>';
  }

  function guideName() {
    if (!N.isPublic()) return '토리';
    const st = root.POApp && root.POApp.result && root.POApp.result.state;
    const g = st && st.staff && st.staff.find((s) => s.isTori);
    return (g && g.name) || '비서';
  }

  function render(box) {
    const r = N.raw(), d = N.defaults();
    const pub = N.isPublic();
    box.innerHTML =
      '<div class="pj-head"><h2>설정</h2><span class="st-saved" id="st-saved"></span></div>' +
      '<div class="st-panel">' +
        '<h3>이름</h3>' +
        (pub ? '<p class="st-desc">사이드바, 창 제목, 직원이 부르는 말에 쓰여요. 앞 이름만 바꾸고 "오피스"와 "님"은 그대로 둬요.</p>' : '<p class="st-desc">사이드바, 창 제목, 직원이 부르는 말에 쓰입니다. 괄호 자리만 바꾸고 "오피스"와 "님"은 그대로 둡니다.</p>') +
        '<div class="st-row">' +
          '<label class="st-lb" for="st-office">오피스 이름<small>최대 ' + N.MAX.officeName + '자</small></label>' +
          '<div class="st-fieldline">' +
            '<span class="st-name sp" id="st-box-office"><input id="st-office" maxlength="' + N.MAX.officeName + '" autocomplete="off" spellcheck="false" value="' + esc(r.officeName) + '" placeholder="' + esc(d.officeName) + '"><span class="st-tail">오피스</span></span>' +
          '</div>' +
          '<p class="st-hint" id="st-hint-office" hidden></p>' +
        '</div>' +
        '<div class="st-row">' +
          '<label class="st-lb" for="st-boss">대표 이름<small>최대 ' + N.MAX.bossName + '자</small></label>' +
          '<div class="st-fieldline">' +
            '<span class="st-name" id="st-box-boss"><input id="st-boss" maxlength="' + N.MAX.bossName + '" autocomplete="off" spellcheck="false" value="' + esc(r.bossName) + '" placeholder="' + esc(d.bossName) + '"><span class="st-tail">님</span></span>' +
          '</div>' +
          '<p class="st-hint" id="st-hint-boss" hidden></p>' +
        '</div>' +
        '<div class="st-pv" aria-live="polite">' +
          '<p class="st-pv-t">' + (pub ? '이렇게 보여요' : '이렇게 보입니다') + '</p>' +
          '<div class="st-pv-row">' +
            '<div class="st-pv-brand"><b id="st-pv-brand"></b><span>사이드바 맨 위</span></div>' +
            '<div class="st-pv-lines">' +
              '<div><span class="k">창 제목</span>' + esc(N.titlePrefix()) + '<b id="st-pv-title"></b></div>' +
              '<div><span class="k">직원 말</span><span id="st-pv-who">' + esc(guideName()) + '</span>: <b id="st-pv-call"></b>, 오늘 할 일 정리해 뒀어요.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="st-foot"><button class="pr-btn" id="st-reset">기본값으로</button></div>' +
      '</div>' + folderHtml() + petHtml() + creditsHtml();
    const $ = (id) => box.querySelector('#' + id);
    const inO = $('st-office'), inB = $('st-boss');
    function paint() {
      const v = N.values(), dd = N.defaults();
      $('st-hint-office').hidden = !!inO.value.trim();
      $('st-hint-office').textContent = '비어 있으면 "' + N.officeFull(dd.officeName) + (pub ? '"로 보여요.' : '"로 보입니다.');
      $('st-hint-boss').hidden = !!inB.value.trim();
      $('st-hint-boss').textContent = '비어 있으면 "' + dd.bossName + (pub ? '님"으로 불러요.' : '님"으로 부릅니다.');
      fit(inO); fit(inB);
      $('st-pv-brand').textContent = v.office;
      $('st-pv-title').textContent = v.office;
      $('st-pv-call').textContent = v.bossCall;
      $('st-reset').disabled = N.isDefault();
    }
    function saved() { $('st-saved').textContent = '저장됨'; }
    inO.addEventListener('input', () => { N.save({ officeName: inO.value }); saved(); paint(); });
    inB.addEventListener('input', () => { N.save({ bossName: inB.value }); saved(); paint(); });
    [inO, inB].forEach((el) => {
      const tidy = () => { el.value = el.value.replace(/\s+/g, ' ').trim(); paint(); };
      el.addEventListener('blur', tidy);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { tidy(); el.blur(); } });
    });
    box.querySelectorAll('.st-name').forEach((nm) => nm.addEventListener('mousedown', (e) => { if (e.target.tagName !== 'INPUT') { e.preventDefault(); nm.querySelector('input').focus(); } }));
    $('st-reset').addEventListener('click', () => { N.reset(); render(box); box.querySelector('#st-saved').textContent = '기본값으로 바꿨어요'; });
    paint();
    bindPet(box); bindFolder(box);
  }
  function folderHtml() {
    const D = root.PODesktop;
    if (!D || typeof D.officeOpen !== 'function') return '';
    const fm = root.POPlat ? root.POPlat.fileMgr() : 'Finder', pub = N.isPublic();
    return '<div class="st-panel st-folder" id="st-folder">' +
      '<p class="st-pv-t">사무실 폴더</p>' +
      '<p class="st-desc">' + (pub ? '사무실은 내 컴퓨터의 폴더 하나예요. ' + fm + '에서 열어 파일을 직접 볼 수 있어요.' : '지금 연 사무실 폴더를 ' + fm + '에서 엽니다.') + '</p>' +
      '<div class="st-foot">' + (typeof D.guideReplant === 'function' ? '<button class="pr-btn" id="st-guide-go">처음 안내 책 다시 꽂기</button>' : '') + '<button class="pr-btn" id="st-folder-go">사무실 폴더 열기 (' + esc(fm) + ')</button></div>' +
      '<p class="st-hint" id="st-folder-msg" aria-live="polite" hidden></p>' +
    '</div>';
  }
  function bindFolder(box) {
    const gb = box.querySelector('#st-guide-go');
    if (gb) gb.addEventListener('click', async () => {
      const m = box.querySelector('#st-folder-msg'); let r;
      try { r = await root.PODesktop.guideReplant(); } catch (e) { r = { ok: false, error: e.message }; }
      m.textContent = r && r.ok ? (r.existed ? '처음 안내 책은 이미 자료 보관에 꽂혀 있어요.' : '자료 보관 워크플로우 칸에 처음 안내 책을 다시 꽂았어요.') : '꽂지 못했어요: ' + ((r && r.error) || '알 수 없는 오류');
      m.hidden = false;
      if (r && r.ok && root.POShelf && root.POShelf.S.loaded) root.POShelf.reload().catch(() => {});
    });
    const btn = box.querySelector('#st-folder-go'), msg = box.querySelector('#st-folder-msg');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      let r;
      try { r = await root.PODesktop.officeOpen(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      msg.textContent = r && r.ok ? '' : '열지 못했어요: ' + ((r && r.error) || '알 수 없는 오류');
      msg.hidden = !!(r && r.ok);
      btn.disabled = false;
    });
  }
  function petHtml() {
    const P = root.POPet;
    if (!P || !P.available()) return '';
    const pub = N.isPublic();
    return '<div class="st-panel st-pet" id="st-pet">' +
      '<p class="st-pv-t">바탕화면 펫</p>' +
      '<p class="st-desc">' + (pub ? '세트 앱 Pixel Office Pet을 켜요. 바탕화면을 돌아다니며 할 일과 약속을 알려 주는 비서 펫이에요. 설치돼 있지 않으면 받는 곳을 열어요.' : '') + '</p>' +
      '<div class="st-foot"><button class="pr-btn" id="st-pet-go">바탕화면에 펫 띄우기</button></div>' +
      '<p class="st-hint" id="st-pet-msg" aria-live="polite" hidden></p>' +
    '</div>';
  }
  function bindPet(box) {
    const btn = box.querySelector('#st-pet-go'), msg = box.querySelector('#st-pet-msg');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const r = await root.POPet.launch();
      msg.textContent = r.text; msg.hidden = false;
      btn.disabled = false;
    });
  }

  N.onChange(() => N.applyDoc(root.document));
  if (root.document) N.applyDoc(root.document);

  root.POSettingsUI = { render };
})(window);
