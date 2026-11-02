// =============================================================================
// آلارم‌های «خزانه»
//
// هر تراکنش می‌تونه یه آلارم داشته باشه: { date, time, note, status, snoozeUntil }
//   date  = روز آلارم (ISO میلادی)،  time = 'HH:MM'،  note = دلیل زنگ‌خوردن
//   status = 'pending' (منتظر) | 'done' (تأیید شده)
//
// ⚠️ محدودیتِ ذاتی PWA: مرورگر اجازه نمی‌ده یه برنامه‌ی وب وقتی کاملاً بسته‌ست
// خودش بیدار بشه و زنگ بزنه (برای این کار سرور push یا اپ بومی لازمه). پس:
//   ۱) تا وقتی برنامه باز باشه (حتی پشت یه برنامه‌ی دیگه)، سر وقت زنگ می‌زنه:
//      صدا + لرزش + کارت تمام‌صفحه + اعلان سیستم.
//   ۲) اگه برنامه بسته یا خواب بود، به‌محض باز شدن، آلارم‌های جاموندهٔ
//      تأییدنشده با برچسب «از دست رفته» نشون داده می‌شن؛ چیزی گم نمی‌شه.
// =============================================================================

const Alarms = (() => {
  const SNOOZE_MS = 10 * 60 * 1000;   // دکمه‌ی «۱۰ دقیقه دیگه»
  const FRESH_MS = 3 * 60 * 1000;     // تا ۳ دقیقه تأخیر هنوز «زنگ‌خوردن» حساب می‌شه، بعدش «از دست رفته»
  const RING_MAX_MS = 2 * 60 * 1000;  // صدا بعد از ۲ دقیقه خودش قطع می‌شه (کارت می‌مونه تا تأیید بشی)

  const pad2 = Jalali.pad2;
  const fa = Jalali.fa;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let hooks = null;        // { getItems, patchAlarm, describe } — از app.js می‌رسه
  let shownId = null;      // تراکنشی که کارتش الان روی صفحه‌ست
  let overlayEl = null;
  let ctx = null;          // AudioContext
  let ringTimer = null;
  let ringStopTimer = null;
  const notified = new Set();

  // ---------- زمان ----------
  function timestampOf(dateISO, time) {
    const [y, m, d] = dateISO.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  }

  // لحظه‌ای که آلارم باید زنگ بزنه (اگه «۱۰ دقیقه دیگه» زده باشی، همون لحظه‌ی تعویق‌شده)
  function dueOf(alarm) {
    return Math.max(timestampOf(alarm.date, alarm.time), alarm.snoozeUntil || 0);
  }

  // «امروز، ساعت ۰۹:۰۰» / «فردا، ساعت …» / «۲۶ مهر، ساعت …»
  function whenText(ts) {
    const d = new Date(ts);
    const iso = Jalali.isoFromDate(d);
    const now = new Date();
    const today = Jalali.isoFromDate(now);
    now.setDate(now.getDate() + 1);
    const tomorrow = Jalali.isoFromDate(now);
    const day = iso === today ? 'امروز' : iso === tomorrow ? 'فردا' : Jalali.format(iso, { year: false });
    return `${day}، ساعت ${fa(pad2(d.getHours()) + ':' + pad2(d.getMinutes()))}`;
  }

  function agoText(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'همین الان';
    if (min < 60) return `${fa(min)} دقیقه پیش`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${fa(h)} ساعت پیش`;
    return `${fa(Math.floor(h / 24))} روز پیش`;
  }

  // ---------- صدا (Web Audio — بدون فایل صوتی، پس آفلاین هم کار می‌کنه) ----------
  // مرورگرها بدون یک لمسِ قبلی اجازه‌ی پخش صدا نمی‌دن؛ پس اولین لمس صفحه قفل صدا رو باز می‌کنه.
  function getCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function audioReady() { return !!ctx && ctx.state === 'running'; }

  function hideSoundHint() {
    const h = document.getElementById('alarm-sound-hint');
    if (h) h.style.display = 'none';
  }

  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'];
  function removeUnlockListeners() {
    UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlockAudio, true));
  }

  function unlockAudio() {
    const c = getCtx();
    if (!c) return;
    const finish = () => {
      if (c.state === 'running') { hideSoundHint(); removeUnlockListeners(); }
    };
    if (c.state === 'suspended') c.resume().then(finish).catch(() => {});
    try { // آیفون: یه بافر خالی پخش می‌کنیم تا قفل صدا کامل باز بشه
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, 22050);
      s.connect(c.destination);
      s.start(0);
    } catch (e) { /* مهم نیست */ }
    finish();
  }

  function beep(freq, at, dur, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  // چهار بیپِ پشت‌سرهم (سی‌بمل–می، سی‌بمل–می) — واضح و غیرتهاجمی
  function playPattern() {
    // بعد از رفتن به پس‌زمینه بعضی مرورگرها (مخصوصاً سافاری) صدا رو متوقف می‌کنن؛ دوباره راهش بنداز
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!audioReady()) return false;
    const t = ctx.currentTime + 0.03;
    [988, 1319, 988, 1319].forEach((f, i) => beep(f, t + i * 0.24, 0.18, 0.55));
    return true;
  }

  // برای آلارمِ «از دست رفته»: فقط یه زنگ کوتاه و ملایم
  function chime() {
    if (!audioReady()) return;
    const t = ctx.currentTime + 0.03;
    beep(880, t, 0.25, 0.3);
    beep(1175, t + 0.28, 0.35, 0.3);
  }

  // مرورگر تا وقتی صفحه رو لمس نکرده باشی لرزش رو مسدود می‌کنه (و توی کنسول خطا می‌ده)؛
  // پس فقط بعد از اولین لمس صداش می‌زنیم.
  function vibrate(pattern) {
    try {
      const ua = navigator.userActivation;
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(pattern);
    } catch (e) { /* بعضی مرورگرها پشتیبانی نمی‌کنن */ }
  }

  function stopRinging() {
    clearInterval(ringTimer);
    clearTimeout(ringStopTimer);
    ringTimer = null;
    ringStopTimer = null;
    vibrate(0);
  }

  function startRinging() {
    stopRinging();
    const cycle = () => { playPattern(); vibrate([350, 150, 350, 150, 350]); };
    cycle();
    ringTimer = setInterval(cycle, 2200);
    ringStopTimer = setTimeout(stopRinging, RING_MAX_MS);
  }

  function testSound() {
    const c = getCtx();
    if (!c) return false;
    const go = () => { playPattern(); vibrate(200); };
    if (c.state === 'running') go();
    else c.resume().then(() => { hideSoundHint(); go(); }).catch(() => {});
    return true;
  }

  // ---------- اعلان سیستم ----------
  function permission() { return 'Notification' in window ? Notification.permission : 'unsupported'; }

  function ensurePermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    try {
      const r = Notification.requestPermission();
      if (r && typeof r.then === 'function') return r;
      return new Promise((resolve) => Notification.requestPermission(resolve)); // مرورگرهای قدیمی
    } catch (e) {
      return Promise.resolve(Notification.permission);
    }
  }

  async function getRegistration() {
    try {
      return 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    } catch (e) {
      return null;
    }
  }

  async function notify(t, info, missed) {
    if (permission() !== 'granted') return;
    // وقتی صفحه جلوی چشمه و صدا هم قفل نیست، کارت تمام‌صفحه کافیه
    if (!document.hidden && audioReady()) return;
    const a = t.alarm;
    const key = t.id + '@' + dueOf(a);
    if (notified.has(key)) return;
    notified.add(key);
    const reason = a.note || `${info.typeLabel} ${info.categoryLabel}`;
    const title = (missed ? '⏰ آلارم از دست رفته: ' : '⏰ ') + reason;
    const options = {
      body: `${info.typeLabel} ${info.amountText} تومان · ${info.categoryLabel}`,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'alarm-' + t.id,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 600],
      lang: 'fa',
      dir: 'rtl',
      data: { id: t.id },
    };
    try {
      const reg = await getRegistration();
      if (reg && reg.showNotification) await reg.showNotification(title, options);
      else new Notification(title, options);
    } catch (e) {
      console.warn('نمایش اعلان ناموفق بود', e);
    }
  }

  async function closeNotification(id) {
    try {
      const reg = await getRegistration();
      if (!reg || !reg.getNotifications) return;
      const list = await reg.getNotifications({ tag: 'alarm-' + id });
      list.forEach((n) => n.close());
    } catch (e) { /* مهم نیست */ }
  }

  // ---------- کارت تمام‌صفحه ----------
  const BELL_SVG = '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  function cardHtml(t, more, missed, lateMs) {
    const a = t.alarm;
    const info = hooks.describe(t);
    const at = new Date(timestampOf(a.date, a.time));
    const timeTxt = fa(pad2(at.getHours()) + ':' + pad2(at.getMinutes()));
    const dateTxt = Jalali.format(Jalali.isoFromDate(at), { weekday: true });
    const reason = a.note ? esc(a.note) : esc(`یادآوریِ ${info.typeLabel} ${info.categoryLabel}`);
    return `
      <div class="al-card">
        <div class="al-bell-wrap"><div class="al-bell">${BELL_SVG}</div></div>
        <p class="al-kicker">${missed ? 'آلارم از دست رفته' : 'یادآور خزانه'}</p>
        <p class="al-time">${timeTxt}</p>
        <p class="al-date">${dateTxt}${missed ? ` · ${agoText(lateMs)}` : ''}</p>
        <div class="al-reason">
          <p class="al-reason-label">دلیل زنگ‌خوردن</p>
          <p class="al-reason-text">${reason}</p>
        </div>
        <div class="al-tx">
          <span class="al-tx-ico" style="background-color:${info.color}22">${info.iconSvg}</span>
          <div class="al-tx-txt">
            <p class="al-tx-title">${esc(info.typeLabel)} · ${esc(info.categoryLabel)}</p>
            <p class="al-tx-sub">${esc(info.amountText)} تومان · ${esc(info.dateText)}</p>
          </div>
        </div>
        <p class="al-more" style="${more > 0 ? '' : 'display:none'}">${more > 0 ? `+ ${fa(more)} آلارم دیگه هم منتظره` : ''}</p>
        <div class="al-actions">
          <button type="button" class="al-btn primary" data-al="done">متوجه شدم</button>
          <button type="button" class="al-btn" data-al="snooze">${fa(SNOOZE_MS / 60000)} دقیقه دیگه</button>
        </div>
      </div>`;
  }

  function showCard(t, more) {
    const late = Date.now() - dueOf(t.alarm);
    const missed = late > FRESH_MS;
    shownId = t.id;
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.setAttribute('dir', 'rtl');
      overlayEl.setAttribute('role', 'alertdialog');
      overlayEl.setAttribute('aria-modal', 'true');
      overlayEl.setAttribute('aria-label', 'آلارم');
      overlayEl.addEventListener('click', onOverlayClick);
      document.body.appendChild(overlayEl);
    }
    overlayEl.className = 'al-overlay kz-root' + (missed ? ' is-missed' : '');
    overlayEl.innerHTML = cardHtml(t, more, missed, late);
    stopRinging();
    if (missed) chime(); else startRinging();
    notify(t, hooks.describe(t), missed);
    const btn = overlayEl.querySelector('[data-al="done"]');
    if (btn) btn.focus();
  }

  function updateMore(more) {
    const el = overlayEl && overlayEl.querySelector('.al-more');
    if (!el) return;
    el.style.display = more > 0 ? '' : 'none';
    el.textContent = more > 0 ? `+ ${fa(more)} آلارم دیگه هم منتظره` : '';
  }

  function hideOverlay() {
    stopRinging();
    shownId = null;
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function onOverlayClick(e) {
    const b = e.target.closest('[data-al]');
    if (!b || !shownId) return;
    if (b.dataset.al === 'done') acknowledge(shownId);
    else if (b.dataset.al === 'snooze') snooze(shownId);
  }

  function acknowledge(id) {
    hooks.patchAlarm(id, (a) => ({ ...a, status: 'done', doneAt: Date.now(), snoozeUntil: null }));
    closeNotification(id);
    hideOverlay();
    check(); // اگه آلارم دیگه‌ای هم منتظره، همین الان نشونش بده
  }

  function snooze(id) {
    hooks.patchAlarm(id, (a) => ({ ...a, snoozeUntil: Date.now() + SNOOZE_MS }));
    closeNotification(id);
    hideOverlay();
    check();
  }

  // ---------- چک کردن آلارم‌ها ----------
  function dueItems() {
    const now = Date.now();
    return hooks.getItems()
      .filter((t) => t.alarm && t.alarm.status !== 'done' && dueOf(t.alarm) <= now)
      .sort((a, b) => dueOf(a.alarm) - dueOf(b.alarm));
  }

  // هر ثانیه و هر بار که برنامه دوباره دیده می‌شه صدا زده می‌شه؛ تکراری بودنش مشکلی نداره
  function check() {
    if (!hooks) return;
    const due = dueItems();
    if (due.length === 0) {
      if (shownId) hideOverlay();
      return;
    }
    if (due.some((t) => t.id === shownId)) updateMore(due.length - 1);
    else showCard(due[0], due.length - 1);
  }

  // hooks = { getItems(), patchAlarm(id, fn), describe(t) }
  function start(h) {
    hooks = h;
    UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, unlockAudio, true));
    setInterval(check, 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      check();
    });
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    check();
  }

  return {
    start, check, testSound, unlockAudio, audioReady, permission, ensurePermission,
    timestampOf, dueOf, whenText,
  };
})();
