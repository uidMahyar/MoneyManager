// ---------------------------------------------------------------------------
// شخصیت‌های کارتونی ساده برای هر دسته‌بندی — هر تابع یه رشته‌ی SVG برمی‌گردونه.
// سبک: بدنه‌ی گرد یک‌رنگ («کاراکتر») + یک المان کوچیک نمادین روی صورتش.
// همه از یک قالب پایه استفاده می‌کنن تا خانواده‌ی بصری یکدست بمونه:
// بدنه = دایره‌ی رنگی دسته، صورت = دو چشم بیضی + خط لبخند، شیء نمادین = روی سر.
// ---------------------------------------------------------------------------

function characterBase({ bodyColor, face, prop }) {
  return `
    <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="34" r="22" fill="${bodyColor}" />
      ${prop || ''}
      ${face}
    </svg>
  `;
}

// صورت پیش‌فرض: دو چشم گرد مشکی-آبی تیره روی خط لبخند
function defaultFace(opts = {}) {
  const eyeY = opts.eyeY ?? 32;
  const mouthCurve = opts.happy === false
    ? `M 25 42 Q 32 39 39 42`   // خنثی/کمی نگران برای هزینه‌های سنگین (قبض)
    : `M 25 40 Q 32 46 39 40`;  // لبخند برای بقیه
  return `
    <circle cx="25" cy="${eyeY}" r="2.6" fill="#14100c" />
    <circle cx="39" cy="${eyeY}" r="2.6" fill="#14100c" />
    <path d="${mouthCurve}" stroke="#14100c" stroke-width="2.2" fill="none" stroke-linecap="round" />
  `;
}

const CATEGORY_CHARACTERS = {
  // ---------- هزینه‌ها ----------
  food: () => characterBase({
    bodyColor: '#c17a52',
    face: defaultFace(),
    // یک کلاه سرآشپز کوچیک روی سر
    prop: `<path d="M18 18 Q18 8 32 8 Q46 8 46 18 L46 22 L18 22 Z" fill="#f0e9dc" opacity="0.92" />
           <rect x="19" y="20" width="26" height="4" rx="2" fill="#f0e9dc" opacity="0.92" />`,
  }),

  transport: () => characterBase({
    bodyColor: '#5478a0',
    face: defaultFace(),
    // یک فرمون کوچیک روی سر
    prop: `<circle cx="32" cy="14" r="8" fill="none" stroke="#f0e9dc" stroke-width="2.4" opacity="0.9" />
           <line x1="32" y1="14" x2="32" y2="8" stroke="#f0e9dc" stroke-width="2.4" opacity="0.9" />`,
  }),

  shopping: () => characterBase({
    bodyColor: '#a8677a',
    face: defaultFace(),
    // دسته‌ی کیف خرید روی سر
    prop: `<path d="M24 16 Q24 6 32 6 Q40 6 40 16" fill="none" stroke="#f0e9dc" stroke-width="2.4" opacity="0.9" />`,
  }),

  bills: () => characterBase({
    bodyColor: '#c19a56',
    face: defaultFace({ happy: false }),
    // یک برگه‌ی رسید تاشده روی سر
    prop: `<rect x="24" y="6" width="16" height="12" rx="1.5" fill="#f0e9dc" opacity="0.9" />
           <line x1="27" y1="10" x2="37" y2="10" stroke="#c19a56" stroke-width="1.4" />
           <line x1="27" y1="13.5" x2="34" y2="13.5" stroke="#c19a56" stroke-width="1.4" />`,
  }),

  fun: () => characterBase({
    bodyColor: '#8a7ca8',
    face: defaultFace(),
    // دسته‌ی دسته‌بازی (گیم‌پد) به‌شکل دو گوش گرد
    prop: `<circle cx="18" cy="16" r="5" fill="#f0e9dc" opacity="0.85" />
           <circle cx="46" cy="16" r="5" fill="#f0e9dc" opacity="0.85" />`,
  }),

  health: () => characterBase({
    bodyColor: '#b25b4a',
    face: defaultFace({ happy: false }),
    // یک بعلاوه‌ی سلامت (پلاس) روی سر
    prop: `<rect x="29" y="4" width="6" height="16" rx="2" fill="#f0e9dc" opacity="0.92" />
           <rect x="24" y="9" width="16" height="6" rx="2" fill="#f0e9dc" opacity="0.92" />`,
  }),

  edu: () => characterBase({
    bodyColor: '#4f8a82',
    face: defaultFace(),
    // کلاه فارغ‌التحصیلی روی سر
    prop: `<path d="M32 6 L48 12 L32 18 L16 12 Z" fill="#f0e9dc" opacity="0.92" />
           <line x1="32" y1="18" x2="32" y2="24" stroke="#f0e9dc" stroke-width="2" opacity="0.92" />`,
  }),

  other_exp: () => characterBase({
    bodyColor: '#8c8272',
    // سه نقطه به‌جای صورت (نماد «سایر»)
    face: `<circle cx="24" cy="34" r="2.4" fill="#14100c" />
           <circle cx="32" cy="34" r="2.4" fill="#14100c" />
           <circle cx="40" cy="34" r="2.4" fill="#14100c" />`,
  }),

  // ---------- درآمدها ----------
  salary: () => characterBase({
    bodyColor: '#5e9070',
    face: defaultFace(),
    // یک کیف‌دستی (کیف اداری) روی سر به‌شکل مستطیل با دسته
    prop: `<rect x="22" y="10" width="20" height="12" rx="2" fill="#f0e9dc" opacity="0.92" />
           <path d="M27 10 Q27 4 32 4 Q37 4 37 10" fill="none" stroke="#f0e9dc" stroke-width="2" opacity="0.92" />`,
  }),

  sales: () => characterBase({
    bodyColor: '#4f8a82',
    face: defaultFace(),
    // یک سایه‌بان مغازه (خط‌خطی) روی سر
    prop: `<path d="M16 18 L20 8 L44 8 L48 18 Z" fill="#f0e9dc" opacity="0.9" />
           <line x1="24" y1="8" x2="21" y2="18" stroke="#4f8a82" stroke-width="1.6" />
           <line x1="32" y1="8" x2="30.5" y2="18" stroke="#4f8a82" stroke-width="1.6" />
           <line x1="40" y1="8" x2="40" y2="18" stroke="#4f8a82" stroke-width="1.6" />`,
  }),

  gift: () => characterBase({
    bodyColor: '#a8677a',
    face: defaultFace(),
    // جعبه‌ی هدیه با روبان روی سر
    prop: `<rect x="23" y="8" width="18" height="12" rx="1.5" fill="#f0e9dc" opacity="0.92" />
           <line x1="32" y1="8" x2="32" y2="20" stroke="#a8677a" stroke-width="2" />
           <line x1="23" y1="13" x2="41" y2="13" stroke="#a8677a" stroke-width="2" />`,
  }),

  invest: () => characterBase({
    bodyColor: '#c19a56',
    face: defaultFace(),
    // فلش صعودی (نمودار رشد) روی سر
    prop: `<polyline points="18,20 25,13 31,17 40,6 46,10" fill="none" stroke="#f0e9dc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />
           <polyline points="40,6 46,10 42,13" fill="none" stroke="#f0e9dc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />`,
  }),

  other_inc: () => characterBase({
    bodyColor: '#8c8272',
    face: `<circle cx="24" cy="34" r="2.4" fill="#14100c" />
           <circle cx="32" cy="34" r="2.4" fill="#14100c" />
           <circle cx="40" cy="34" r="2.4" fill="#14100c" />`,
  }),
};

function getCategoryCharacterSVG(categoryId) {
  const fn = CATEGORY_CHARACTERS[categoryId] || CATEGORY_CHARACTERS.other_exp;
  return fn();
}
