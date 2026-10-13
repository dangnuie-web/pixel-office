'use strict';
const MENU_LABEL = '잠깐 숨기기 (10분 · 앱 다시 열면 바로 나와요)';
function reopenLine(hidden) { return hidden ? '다녀왔어요!' : '저 여기 있어요.'; }
module.exports = { MENU_LABEL, reopenLine };
