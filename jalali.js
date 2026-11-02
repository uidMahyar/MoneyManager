// =============================================================================
// تقویم شمسی (جلالی) + انتخابگرهای تاریخ و ساعتِ اختصاصیِ «خزانه»
//
// - بدون هیچ کتابخونه‌ی بیرونی (مثل بقیه‌ی اپ، کاملاً آفلاین کار می‌کنه).
// - تبدیل میلادی ⇄ شمسی با الگوریتم jalaali نوشته شده (همون الگوریتمی که
//   کتابخونه‌های معروف تقویم شمسی استفاده می‌کنن)، نه با Intl مرورگر؛ پس
//   روی هر مرورگر/وب‌ویویی یکسان کار می‌کنه.
// - تاریخ‌ها توی اپ همچنان به‌صورت میلادیِ ISO ('YYYY-MM-DD') ذخیره می‌شن تا
//   داده‌های قبلی خراب نشن؛ فقط نمایش و انتخابشون شمسیه.
// =============================================================================

const Jalali = (() => {
  // ---------- نام‌ها و ارقام ----------
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  // هفته از شنبه شروع می‌شه (اندیس ۰ = شنبه، ۶ = جمعه)
  const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه\u200cشنبه', 'چهارشنبه', 'پنج\u200cشنبه', 'جمعه'];
  const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  const fa = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[d]);
  const pad2 = (n) => String(n).padStart(2, '0');

  // ---------- تبدیل میلادی ⇄ شمسی ----------
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const div = (a, b) => Math.trunc(a / b);
  const mod = (a, b) => a - Math.trunc(a / b) * b;

  // اطلاعات سال شمسی: کبیسه بودنش + روزی از مارس که اول فروردینه
  function jalCal(jy, withoutLeap) {
    const bl = BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = BREAKS[0];
    let jm, jump, leap, n;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی نامعتبر: ' + jy);
    for (let i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (withoutLeap) return { gy, march };
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  // شماره‌ی روز ژولیانی (JDN) ⇄ تاریخ میلادی
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  // شماره‌ی روز ژولیانی ⇄ تاریخ شمسی
  function j2d(jy, jm, jd) {
    const r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy, false);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        // شش ماه اول (۳۱ روزه)
        return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      }
      k -= 186;
    } else {
      // سالِ شمسیِ قبل
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }

  function toJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function isLeap(jy) { return jalCal(jy, false).leap === 0; }
  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeap(jy) ? 30 : 29;
  }

  // ---------- کمکی‌های ISO ('YYYY-MM-DD' میلادی، به وقت محلی) ----------
  const isoParts = (iso) => iso.split('-').map(Number);
  const partsIso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const isoFromDate = (d) => partsIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  function isoToJalali(iso) { const [y, m, d] = isoParts(iso); return toJalali(y, m, d); }
  function jalaliToIso(jy, jm, jd) { const g = toGregorian(jy, jm, jd); return partsIso(g.gy, g.gm, g.gd); }
  // ۰ = شنبه … ۶ = جمعه (با UTC حساب می‌کنیم تا ساعت تابستانی/زمستانی قاطی نشه)
  function weekdayIndex(gy, gm, gd) { return (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7; }
  function todayJalali() { return isoToJalali(isoFromDate(new Date())); }

  // «پنج‌شنبه ۲۶ مهر ۱۴۰۵» (وزن و سال اختیاری)
  function format(iso, { weekday = false, year = true } = {}) {
    const [gy, gm, gd] = isoParts(iso);
    const j = toJalali(gy, gm, gd);
    let s = `${fa(j.jd)} ${MONTHS[j.jm - 1]}`;
    if (year) s += ` ${fa(j.jy)}`;
    if (weekday) s = `${WEEKDAYS[weekdayIndex(gy, gm, gd)]} ${s}`;
    return s;
  }

  // ===========================================================================
  // رابط کاربری: صفحه‌ی پایین‌کشویی (bottom sheet) مثل مودال خودِ اپ
  // ===========================================================================
  const svg = (inner, s = 18) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 16),
    // توی راست‌به‌چین، «قبلی» سمت راسته و فلشش به راست اشاره می‌کنه
    right: svg('<path d="m9 18 6-6-6-6"/>', 20),
    left: svg('<path d="m15 18-6-6 6-6"/>', 20),
    down: svg('<path d="m6 9 6 6 6-6"/>', 14),
    up: svg('<path d="m18 15-6-6-6 6"/>', 14),
  };

  let activeLayer = null; // هم‌زمان فقط یک انتخابگر باز می‌شه

  function closeLayer() {
    if (!activeLayer) return;
    document.removeEventListener('keydown', activeLayer.onKey, true);
    activeLayer.el.remove();
    activeLayer = null;
  }

  function mountSheet() {
    closeLayer();
    const el = document.createElement('div');
    el.className = 'jp-overlay';
    el.setAttribute('dir', 'rtl');
    el.innerHTML = `
      <div class="jp-backdrop" data-act="close"></div>
      <div class="jp-sheet kz-root kz-animate-slideup" role="dialog" aria-modal="true">
        <div class="jp-grab"></div>
        <div class="jp-body"></div>
      </div>`;
    document.body.appendChild(el);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeLayer(); }
    };
    document.addEventListener('keydown', onKey, true);
    activeLayer = { el, onKey };
    return { el, body: el.querySelector('.jp-body') };
  }

  const topRow = (title) => `
    <div class="jp-top">
      <h3 class="jp-title">${title}</h3>
      <button type="button" class="jp-x" data-act="close" aria-label="بستن">${ICON.x}</button>
    </div>`;

  // ---------- انتخابگر تاریخ شمسی ----------
  // value: تاریخ انتخاب‌شده‌ی فعلی (ISO میلادی) — min: کمترین روز قابل انتخاب (ISO)
  // onSelect(iso): با زدن روی یه روز صدا زده می‌شه و انتخابگر بسته می‌شه
  function openDatePicker({ value = null, title = 'انتخاب تاریخ', min = null, onSelect } = {}) {
    const todayIso = isoFromDate(new Date());
    const today = isoToJalali(todayIso);
    const sel = value ? isoToJalali(value) : null;
    const start = sel || today;
    let mode = 'days'; // 'days' | 'months'
    let vy = start.jy;
    let vm = start.jm;
    const { el, body } = mountSheet();

    const footer = `
      <div class="jp-foot">
        <button type="button" class="jp-btn" data-act="today">امروز</button>
        <button type="button" class="jp-btn" data-act="close">انصراف</button>
      </div>`;

    function daysHtml() {
      const g = toGregorian(vy, vm, 1);
      const offset = weekdayIndex(g.gy, g.gm, g.gd);
      const len = monthLength(vy, vm);
      const heads = WEEKDAYS_SHORT
        .map((w, i) => `<div class="jp-wd${i === 6 ? ' is-fri' : ''}">${w}</div>`).join('');
      let cells = '';
      for (let i = 0; i < offset; i += 1) cells += '<span></span>';
      for (let d = 1; d <= len; d += 1) {
        const iso = jalaliToIso(vy, vm, d);
        const cls = ['jp-day'];
        if ((offset + d - 1) % 7 === 6) cls.push('is-fri');
        if (iso === todayIso) cls.push('is-today');
        if (value && iso === value) cls.push('is-sel');
        const off = min && iso < min ? 'disabled' : '';
        cells += `<button type="button" class="${cls.join(' ')}" data-act="day" data-d="${d}" ${off} aria-label="${fa(d)} ${MONTHS[vm - 1]} ${fa(vy)}">${fa(d)}</button>`;
      }
      return `
        ${topRow(title)}
        <div class="jp-nav">
          <button type="button" class="jp-nav-btn" data-act="prev" aria-label="ماه قبل">${ICON.right}</button>
          <button type="button" class="jp-nav-title" data-act="toggle">${MONTHS[vm - 1]} ${fa(vy)} ${ICON.down}</button>
          <button type="button" class="jp-nav-btn" data-act="next" aria-label="ماه بعد">${ICON.left}</button>
        </div>
        <div class="jp-grid">${heads}${cells}</div>
        ${footer}`;
    }

    function monthsHtml() {
      const cells = MONTHS.map((name, i) => {
        const m = i + 1;
        const cls = ['jp-month'];
        if (vy === today.jy && m === today.jm) cls.push('is-cur');
        if (sel && sel.jy === vy && sel.jm === m) cls.push('is-sel');
        return `<button type="button" class="${cls.join(' ')}" data-act="month" data-m="${m}">${name}</button>`;
      }).join('');
      return `
        ${topRow(title)}
        <div class="jp-nav">
          <button type="button" class="jp-nav-btn" data-act="yprev" aria-label="سال قبل">${ICON.right}</button>
          <button type="button" class="jp-nav-title" data-act="toggle">${fa(vy)} ${ICON.up}</button>
          <button type="button" class="jp-nav-btn" data-act="ynext" aria-label="سال بعد">${ICON.left}</button>
        </div>
        <div class="jp-months">${cells}</div>
        ${footer}`;
    }

    function paint() { body.innerHTML = mode === 'days' ? daysHtml() : monthsHtml(); }

    function pick(iso) {
      closeLayer();
      if (onSelect) onSelect(iso);
    }

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') return closeLayer();
      if (act === 'prev') {
        if (vy <= 1300 && vm === 1) return;
        vm -= 1; if (vm < 1) { vm = 12; vy -= 1; }
        return paint();
      }
      if (act === 'next') {
        if (vy >= 1600 && vm === 12) return;
        vm += 1; if (vm > 12) { vm = 1; vy += 1; }
        return paint();
      }
      if (act === 'yprev') { vy = Math.max(1300, vy - 1); return paint(); }
      if (act === 'ynext') { vy = Math.min(1600, vy + 1); return paint(); }
      if (act === 'toggle') { mode = mode === 'days' ? 'months' : 'days'; return paint(); }
      if (act === 'month') { vm = Number(b.dataset.m); mode = 'days'; return paint(); }
      if (act === 'day') return pick(jalaliToIso(vy, vm, Number(b.dataset.d)));
      if (act === 'today') {
        if (min && todayIso < min) return;
        return pick(todayIso);
      }
    });

    paint();
  }

  // ---------- انتخابگر ساعت (دو چرخ: ساعت و دقیقه) ----------
  // value: 'HH:MM' — onSelect('HH:MM')
  function openTimePicker({ value = '09:00', title = 'انتخاب ساعت', onSelect } = {}) {
    const ITEM = 44; // ارتفاع هر ردیف چرخ (px)؛ باید با .jp-wi توی CSS یکی باشه
    const parts = String(value).split(':').map(Number);
    const vals = { h: Math.min(23, Math.max(0, parts[0] || 0)), m: Math.min(59, Math.max(0, parts[1] || 0)) };
    const { el, body } = mountSheet();

    const items = (n) => Array.from({ length: n }, (_, i) => `<div class="jp-wi" data-i="${i}">${fa(pad2(i))}</div>`).join('');
    const chips = ['09:00', '12:00', '18:00', '21:00']
      .map((t) => `<button type="button" class="jp-chip" data-act="chip" data-t="${t}">${fa(t)}</button>`).join('');

    body.innerHTML = `
      ${topRow(title)}
      <div class="jp-wheels">
        <div class="jp-band"></div>
        <div class="jp-wheel" data-w="h" tabindex="0" aria-label="ساعت"><div class="jp-pad"></div>${items(24)}<div class="jp-pad"></div></div>
        <div class="jp-colon">:</div>
        <div class="jp-wheel" data-w="m" tabindex="0" aria-label="دقیقه"><div class="jp-pad"></div>${items(60)}<div class="jp-pad"></div></div>
      </div>
      <div class="jp-chips">${chips}</div>
      <button type="button" class="jp-btn primary jp-ok" data-act="ok"></button>`;

    const wheels = { h: body.querySelector('[data-w="h"]'), m: body.querySelector('[data-w="m"]') };
    const okBtn = body.querySelector('[data-act="ok"]');
    const smoothOk = 'scrollBehavior' in document.documentElement.style;

    function label() { return `تأیید ساعت ${fa(pad2(vals.h))}:${fa(pad2(vals.m))}`; }

    // چرخ w رو به ردیف idx می‌بره
    function goTo(w, idx, smooth) {
      const top = idx * ITEM;
      if (smooth && smoothOk) wheels[w].scrollTo({ top, behavior: 'smooth' });
      else wheels[w].scrollTop = top;
    }

    // ردیفِ وسطِ چرخ رو پیدا کن و هایلایت کن
    function mark(w) {
      const max = w === 'h' ? 23 : 59;
      const idx = Math.max(0, Math.min(max, Math.round(wheels[w].scrollTop / ITEM)));
      vals[w] = idx;
      const prev = wheels[w].querySelector('.jp-wi.on');
      if (prev) prev.classList.remove('on');
      const now = wheels[w].querySelector(`.jp-wi[data-i="${idx}"]`);
      if (now) now.classList.add('on');
      okBtn.textContent = label();
    }

    ['h', 'm'].forEach((w) => {
      let raf = 0;
      wheels[w].addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => mark(w));
      }, { passive: true });
      wheels[w].addEventListener('click', (e) => {
        const it = e.target.closest('.jp-wi');
        if (it) goTo(w, Number(it.dataset.i), true);
      });
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'close') return closeLayer();
      if (act === 'chip') {
        const [h, m] = b.dataset.t.split(':').map(Number);
        goTo('h', h, true); goTo('m', m, true);
        vals.h = h; vals.m = m; okBtn.textContent = label();
        return;
      }
      if (act === 'ok') {
        const out = `${pad2(vals.h)}:${pad2(vals.m)}`;
        closeLayer();
        if (onSelect) onSelect(out);
      }
    });

    goTo('h', vals.h, false); goTo('m', vals.m, false);
    mark('h'); mark('m');
  }

  return {
    MONTHS, WEEKDAYS, WEEKDAYS_SHORT, fa, pad2,
    toJalali, toGregorian, isLeap, monthLength,
    isoFromDate, isoToJalali, jalaliToIso, weekdayIndex, today: todayJalali, format,
    openDatePicker, openTimePicker, close: closeLayer,
  };
})();
