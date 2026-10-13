(function (root) {
  "use strict";
  const ELECTRON_VERSION = "44.5.1";
  const ELECTRON_LICENSE = "Copyright (c) Electron contributors\nCopyright (c) 2013-2020 GitHub Inc.\n\nPermission is hereby granted, free of charge, to any person obtaining\na copy of this software and associated documentation files (the\n\"Software\"), to deal in the Software without restriction, including\nwithout limitation the rights to use, copy, modify, merge, publish,\ndistribute, sublicense, and/or sell copies of the Software, and to\npermit persons to whom the Software is furnished to do so, subject to\nthe following conditions:\n\nThe above copyright notice and this permission notice shall be\nincluded in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\nNONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\nLIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\nOF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\nWITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.";
  const LICENSE = { code: "MIT License", art: "CC BY-NC-ND 4.0", artUrl: "https://creativecommons.org/licenses/by-nc-nd/4.0/" };
  function items() {
    return [
      { k: "만든 사람", v: "당니 (Dangnee) · 당니오피스", owner: true },
      { k: "코드 라이선스", v: "MIT License (LICENSE 파일). Copyright (c) 2026 Dangnee", owner: true },
      { k: "그림·캐릭터·대사", v: "CC BY-NC-ND 4.0 (LICENSE-ART.md 파일) — 출처 표시, 비영리, 변경 금지. " + LICENSE.artUrl },
      { k: "그림", v: "당니오피스 (픽셀아트 직접 제작)", owner: true },
      { k: "초상 그림", v: "직원 초상 그림은 AI(ChatGPT 이미지 생성)로 만든 뒤 다듬었어요." },
      { k: "글꼴", v: "시스템 기본 글꼴을 써요 (앱에 글꼴 파일을 넣지 않아요)." },
      { k: "소리", v: "없음." },
    ];
  }
  const OPEN_SOURCE = [
    { name: "Electron", ver: ELECTRON_VERSION, license: "MIT License", note: "Electron 에 들어 있는 Chromium·Node.js 등의 라이선스는 앱과 함께 있는 LICENSES.chromium.html 파일에 있어요." },
  ];
  root.POCredits = { ELECTRON_VERSION, ELECTRON_LICENSE, OPEN_SOURCE, LICENSE, items };
})(typeof window !== "undefined" ? window : globalThis);
