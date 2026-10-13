(function (root) {
  'use strict';
  const C = root.POCalCore || (typeof require !== 'undefined' ? require('./po/cal_core.js') : null);
  const WD = C.WD;
  const pad = (n) => String(n).padStart(2, '0');
  const EVE_HOUR = 21, BEFORE_MIN = 60;

  function parts(date) { const [y, m, d] = date.split('-').map(Number); return { y, m, d, dow: new Date(y, m - 1, d, 12).getDay() }; }
  function mk(y, m, d) { const x = new Date(y, m - 1, d, 12); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d ? C.ymd(y, m - 1, d) : null; }

  function parseDate(s, today) {
    const t = String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!t || !C.isDate(today)) return null;
    const REL = { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 };
    if (t in REL) return C.addDays(today, REL[t]);
    let m = /^(다음\s?주\s?|담주\s?)?([일월화수목금토])(요일)?$/.exec(t);
    if (m) {
      const want = WD.indexOf(m[2]), now = parts(today).dow;
      if (!m[1]) { let n = (want - now + 7) % 7; if (n === 0) n = 7; return C.addDays(today, n); }
      const mon = C.addDays(today, -((now + 6) % 7));
      return C.addDays(mon, 7 + (want + 6) % 7);
    }
    m = /^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/.exec(t);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\s*[/.]\s*(\d{1,2})\.?$/.exec(t) || /^(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/.exec(t);
    if (m) {
      const y = parts(today).y;
      const a = mk(y, +m[1], +m[2]);
      if (!a) return null;
      return a < C.addDays(today, -60) ? mk(y + 1, +m[1], +m[2]) : a;
    }
    return null;
  }
  function amPm(min) { const h = Math.floor(min / 60), mm = min % 60, h12 = h % 12 === 0 ? 12 : h % 12; return h12 + (mm ? ':' + pad(mm) : '') + (h < 12 ? 'am' : 'pm'); }
  function koTime(min) { const h = Math.floor(min / 60), mm = min % 60, h12 = h % 12 === 0 ? 12 : h % 12; return (h < 12 ? '오전 ' : '오후 ') + h12 + ':' + pad(mm); }
  function parseTime(s) {
    const t = String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!t) return { ok: true, time: '', min: null };
    const n = C.normTime(t);
    if (!n && /(am|pm)$/i.test(t)) return { ok: false };
    const min = C.timeKey(n || t);
    if (min == null || min < 0 || min >= 24 * 60) return { ok: false };
    return { ok: true, time: amPm(min), min };
  }
  function fireTimes(date, time) {
    const p = parts(date);
    const eve = new Date(p.y, p.m - 1, p.d - 1, EVE_HOUR, 0, 0, 0).getTime();
    const min = time ? C.timeKey(time) : null;
    const start = min == null ? null : new Date(p.y, p.m - 1, p.d, 0, min, 0, 0).getTime();
    return { eve, hour: start == null ? null : start - BEFORE_MIN * 60000, start };
  }
  function shortDay(date) { const p = parts(date); return p.m + '/' + p.d + ' (' + WD[p.dow] + ')'; }

  function read(f, today, now) {
    f = f || {};
    const out = { ok: false, bad: {}, err: false };
    const kind = C.KINDS.includes(f.kind) ? f.kind : C.KINDS[0];
    const dRaw = String(f.date == null ? '' : f.date).trim();
    const date = parseDate(dRaw, today);
    const tm = parseTime(f.time);
    const text = String(f.text == null ? '' : f.text).replace(/\s+/g, ' ').trim();
    if (!dRaw) { out.line1 = '날짜를 적어 주세요'; out.line2 = '10/12, 내일, 금 처럼 적으면 돼요'; out.bad.dateEmpty = true; }
    else if (!date) { out.bad.date = true; out.err = true; out.line1 = '날짜를 못 읽었어요'; out.line2 = '10/12, 내일, 금 처럼 적어 주세요'; }
    if (!tm.ok) { out.bad.time = true; if (!out.err) { out.err = true; out.line1 = '시간을 못 읽었어요'; out.line2 = '3pm, 14:30, 오후 2시 처럼 적거나 비워 두세요'; } }
    let textErr = null;
    if (text) { try { C.checkText(text); } catch (e) { textErr = e.message; } }
    if (textErr) { out.bad.text = true; if (!out.err) { out.err = true; out.line1 = '내용을 못 적어요'; out.line2 = textErr; } }
    if (!text) out.bad.textEmpty = true;
    if (!date || !tm.ok) return out;
    out.item = { date, time: tm.time, kind, text };
    out.past = date < today;
    const ft = fireTimes(date, tm.time), nowMs = now == null ? Date.now() : now;
    out.remind = { eve: ft.eve > nowMs, hour: ft.hour != null && ft.hour > nowMs };
    if (!out.err) {
      out.line1 = C.dayName(date) + ' ' + (tm.min == null ? '종일' : koTime(tm.min)) + ' · ' + kind;
      if (out.past) out.line2 = '지난 날짜예요. 그래도 적을까요? Enter';
      else if (out.remind.eve && out.remind.hour) out.line2 = '전날 21시와 1시간 전에 알려 드려요';
      else if (out.remind.eve) out.line2 = '전날 21시에 알려 드려요';
      else if (out.remind.hour) out.line2 = '1시간 전에 알려 드려요';
      else out.line2 = '알림 시각은 지났어요. 적어 두기만 할게요';
    }
    out.ok = !out.err && !!text;
    return out;
  }
  function savedLine(r) {
    const it = r.item;
    const when = shortDay(it.date) + (it.time ? ' ' + it.time : '');
    const tail = r.remind && r.remind.eve ? '. 전날 밤에 알려 드릴게요' : r.remind && r.remind.hour ? '. 1시간 전에 알려 드릴게요' : '';
    return '적어 뒀어요!\n' + when + ' ' + it.text + tail;
  }

  const api = { parseDate, parseTime, amPm, koTime, fireTimes, shortDay, read, savedLine, EVE_HOUR, BEFORE_MIN, KINDS: C.KINDS };
  root.TPAppt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
