// =============================================================================
// خزانه — نسخه‌ی Vanilla JS (بدون React، بدون CDN)
// این فایل عمداً بدون هیچ کتابخونه‌ی بیرونی نوشته شده تا PWA بتونه کاملاً
// آفلاین کار کنه: بعد از اولین بار نصب، حتی بدون اینترنت هم باز می‌شه.
// =============================================================================

// ---------- دسته‌بندی‌ها (بدون آیکون lucide؛ به‌جاش شخصیت‌های SVG از characters.js) ----------
const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'خوراک و رستوران', color: '#c17a52' },
  { id: 'transport', label: 'حمل و نقل', color: '#5478a0' },
  { id: 'shopping', label: 'خرید', color: '#a8677a' },
  { id: 'bills', label: 'قبض و اجاره', color: '#c19a56' },
  { id: 'fun', label: 'سرگرمی', color: '#8a7ca8' },
  { id: 'health', label: 'سلامت', color: '#b25b4a' },
  { id: 'edu', label: 'آموزش', color: '#4f8a82' },
  { id: 'other_exp', label: 'سایر', color: '#8c8272' },
];

const INCOME_CATEGORIES = [
  { id: 'salary', label: 'حقوق', color: '#5e9070' },
  { id: 'sales', label: 'فروش', color: '#4f8a82' },
  { id: 'gift', label: 'هدیه', color: '#a8677a' },
  { id: 'invest', label: 'سرمایه‌گذاری', color: '#c19a56' },
  { id: 'other_inc', label: 'سایر', color: '#8c8272' },
];

const BRASS = '#c19a56';
const INKBLUE = '#5478a0';
const JADE = '#5e9070';
const RUST = '#b25b4a';

function getCategoryInfo(type, id) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.id === id) || list[list.length - 1];
}

function formatMoney(amount) {
  return Math.round(amount).toLocaleString('en-US');
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr) {
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(
    parseLocalDate(dateStr)
  );
}

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- ذخیره‌سازی: localStorage با fallback به حافظه‌ی موقت ----------
const memoryFallback = {};
const storage = {
  get(key) {
    try {
      const raw = localStorage.getItem('khazaneh:' + key);
      if (raw !== null) return raw;
      return key in memoryFallback ? memoryFallback[key] : null;
    } catch (e) {
      return key in memoryFallback ? memoryFallback[key] : null;
    }
  },
  set(key, value) {
    memoryFallback[key] = value;
    try {
      localStorage.setItem('khazaneh:' + key, value);
    } catch (e) {
      console.warn('localStorage در دسترس نبود، فقط توی حافظه‌ی موقت ذخیره شد', e);
    }
  },
};

// ---------- state ----------
const state = {
  transactions: [],
  showModal: false,
  editingId: null,
  filterType: 'all',
  filterMethod: 'all',
  deleteTargetId: null,
  formType: 'expense',
  formAmount: '',
  formMethod: 'cash',
  formCategory: EXPENSE_CATEGORIES[0].id,
  formNote: '',
  formDate: todayISO(),
};

function loadTransactions() {
  try {
    const raw = storage.get('transactions');
    if (raw) state.transactions = JSON.parse(raw);
  } catch (e) {
    // اولین اجراست، هنوز داده‌ای نیست
  }
}

function saveTransactions() {
  try {
    storage.set('transactions', JSON.stringify(state.transactions));
  } catch (e) {
    console.error('save failed', e);
  }
}

// ---------- محاسبات مشتق‌شده ----------
function computeTotals() {
  let cash = 0, bank = 0, monthIncome = 0, monthExpense = 0;
  const now = new Date();
  state.transactions.forEach((t) => {
    const sign = t.type === 'income' ? 1 : -1;
    if (t.method === 'cash') cash += sign * t.amount;
    else bank += sign * t.amount;
    const d = parseLocalDate(t.date);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      if (t.type === 'income') monthIncome += t.amount;
      else monthExpense += t.amount;
    }
  });
  return { cash, bank, total: cash + bank, monthIncome, monthExpense };
}

function computeDialData(totals) {
  const cashPos = Math.max(0, totals.cash);
  const bankPos = Math.max(0, totals.bank);
  if (cashPos + bankPos === 0) return [{ name: 'خالی', value: 1, color: '#2a251e' }];
  return [
    { name: 'نقدی', value: cashPos, color: BRASS },
    { name: 'بانکی', value: bankPos, color: INKBLUE },
  ].filter((d) => d.value > 0);
}

function computeCategoryBreakdown() {
  const now = new Date();
  const map = {};
  state.transactions
    .filter((t) => t.type === 'expense')
    .filter((t) => {
      const d = parseLocalDate(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
  return Object.entries(map)
    .map(([id, value]) => {
      const info = getCategoryInfo('expense', id);
      return { name: info.label, value, color: info.color };
    })
    .sort((a, b) => b.value - a.value);
}

function computeFilteredTransactions() {
  return state.transactions
    .filter((t) => state.filterType === 'all' || t.type === state.filterType)
    .filter((t) => state.filterMethod === 'all' || t.method === state.filterMethod)
    .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date) || b.createdAt - a.createdAt);
}

// ---------- اکشن‌ها ----------
function openAddModal(type) {
  state.editingId = null;
  state.formType = type;
  state.formAmount = '';
  state.formMethod = 'cash';
  state.formCategory = type === 'income' ? INCOME_CATEGORIES[0].id : EXPENSE_CATEGORIES[0].id;
  state.formNote = '';
  state.formDate = todayISO();
  state.showModal = true;
  render();
}

function openEditModal(t) {
  state.editingId = t.id;
  state.formType = t.type;
  state.formAmount = String(t.amount);
  state.formMethod = t.method;
  state.formCategory = t.category;
  state.formNote = t.note || '';
  state.formDate = t.date;
  state.showModal = true;
  render();
}

function closeModal() {
  state.showModal = false;
  render();
}

function handleSubmit() {
  const amount = parseFloat(state.formAmount);
  if (!amount || amount <= 0) return;
  if (state.editingId) {
    state.transactions = state.transactions.map((t) =>
      t.id === state.editingId
        ? { ...t, type: state.formType, amount, method: state.formMethod, category: state.formCategory, note: state.formNote.trim(), date: state.formDate }
        : t
    );
  } else {
    state.transactions = [
      { id: makeId(), createdAt: Date.now(), type: state.formType, amount, method: state.formMethod, category: state.formCategory, note: state.formNote.trim(), date: state.formDate },
      ...state.transactions,
    ];
  }
  saveTransactions();
  state.showModal = false;
  render();
}

function handleDelete(id) {
  state.deleteTargetId = id;
  render();
}

function confirmDelete() {
  state.transactions = state.transactions.filter((t) => t.id !== state.deleteTargetId);
  saveTransactions();
  state.deleteTargetId = null;
  render();
}

function cancelDelete() {
  state.deleteTargetId = null;
  render();
}

// خروجی CSV — جایگزین کتابخونه‌ی xlsx (که از CDN میومد و PWA آفلاین رو خراب می‌کرد).
// فایل CSV با Excel، Google Sheets، و هر برنامه‌ی صفحه‌گسترده‌ای باز می‌شه.
function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportToCSV() {
  const rows = state.transactions
    .slice()
    .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
    .map((t) => ({
      'تاریخ': formatDate(t.date),
      'نوع': t.type === 'income' ? 'درآمد' : 'هزینه',
      'مبلغ (تومان)': t.amount,
      'روش': t.method === 'cash' ? 'نقدی' : 'بانکی',
      'دسته‌بندی': getCategoryInfo(t.type, t.category).label,
      'توضیحات': t.note || '',
    }));
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ];
  // BOM در ابتدای فایل تا Excel فارسی رو درست (نه به‌صورت رمز شکسته) نمایش بده
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'khazaneh-export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ringChartSVG(data, { innerRadiusPct = 0.6, outerRadiusPct = 0.95, paddingAngleDeg = 0, size = 100 } = {}) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;
  const outerR = outerRadiusPct * maxR;
  const innerR = innerRadiusPct * maxR;
  const ringR = (outerR + innerR) / 2;
  const strokeWidth = outerR - innerR;
  const circumference = 2 * Math.PI * ringR;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const gapLen = data.length > 1 ? (paddingAngleDeg / 360) * circumference : 0;
  let offsetAcc = 0;
  const circles = data.map((d) => {
    const rawLen = (d.value / total) * circumference;
    const segLen = Math.max(0, rawLen - gapLen);
    const dashOffset = -offsetAcc;
    offsetAcc += rawLen;
    return `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${d.color}" stroke-width="${strokeWidth}" stroke-dasharray="${segLen} ${circumference - segLen}" stroke-dashoffset="${dashOffset}" />`;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%"><g transform="rotate(-90 ${cx} ${cy})">${circles}</g></svg>`;
}


// =============================================================================
// رندر — چون بدون React هستیم، هر بار state عوض بشه کل UI رو با innerHTML
// می‌سازیم دوباره. برای این حجم داده (چند صد تراکنش شخصی) این روش کاملاً
// سریع و کافیه؛ نیازی به diff/reconciliation نیست.
// =============================================================================

const CATEGORY_ICON_SIZE = 17; // برای هماهنگی با اندازه‌ی قبلی آیکون‌های lucide

function categoryCharacterHtml(categoryId, sizePx) {
  const svg = getCategoryCharacterSVG(categoryId);
  return `<span style="display:inline-block;width:${sizePx}px;height:${sizePx}px;">${svg}</span>`;
}

function renderHeader() {
  return `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center kz-bg-brass">
            ${walletIconSVG()}
          </span>
          خزانه
        </h1>
        <p class="kz-muted text-xs mt-1" style="margin-right:2.5rem">دفتر دخل و خرج شخصی</p>
      </div>
      <button
        id="btn-export"
        ${state.transactions.length === 0 ? 'disabled' : ''}
        class="w-9 h-9 rounded-lg border kz-hairline flex items-center justify-center kz-muted active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shrink-0"
      >
        ${downloadIconSVG()}
      </button>
    </div>
  `;
}

function renderBalanceDial(totals, dialData) {
  return `
    <div class="rounded-2xl border kz-hairline kz-surface p-6 mb-4">
      <div class="relative mx-auto w-52 h-52">
        ${ringChartSVG(dialData, { innerRadiusPct: 0.72, outerRadiusPct: 0.94, paddingAngleDeg: dialData.length > 1 ? 3 : 0, size: 208 })}
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
          <p class="kz-muted text-xs mb-1">موجودی کل</p>
          <p class="kz-mono text-3xl font-bold text-center ${totals.total < 0 ? 'kz-text-rust' : ''}">
            ${formatMoney(totals.total)}
          </p>
          <p class="kz-muted text-xs mt-1">تومان</p>
        </div>
      </div>
      <div class="flex justify-center gap-6 mt-5">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full kz-bg-brass"></span>
          <span class="text-xs kz-muted">نقدی</span>
          <span class="kz-mono text-sm font-semibold">${formatMoney(totals.cash)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color:${INKBLUE}"></span>
          <span class="text-xs kz-muted">بانکی</span>
          <span class="kz-mono text-sm font-semibold">${formatMoney(totals.bank)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderMonthSummary(totals) {
  return `
    <div class="rounded-2xl border kz-hairline kz-surface p-4 mb-4 flex items-stretch">
      <div class="flex-1 text-center">
        <p class="text-xs kz-muted mb-1">درآمد این ماه</p>
        <p class="kz-mono text-lg font-bold kz-text-jade">${formatMoney(totals.monthIncome)}</p>
      </div>
      <div class="w-px" style="background-color:rgba(240,233,220,0.1)"></div>
      <div class="flex-1 text-center">
        <p class="text-xs kz-muted mb-1">هزینه این ماه</p>
        <p class="kz-mono text-lg font-bold kz-text-rust">${formatMoney(totals.monthExpense)}</p>
      </div>
    </div>
  `;
}

function renderCategoryBreakdown(breakdown) {
  if (breakdown.length === 0) return '';
  const rows = breakdown.slice(0, 4).map((c) => `
    <div class="flex items-center justify-between gap-2 text-xs">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="w-2 h-2 rounded-full shrink-0" style="background-color:${c.color}"></span>
        <span class="kz-muted truncate">${escapeHtml(c.name)}</span>
      </div>
      <span class="kz-mono shrink-0">${formatMoney(c.value)}</span>
    </div>
  `).join('');
  return `
    <div class="rounded-2xl border kz-hairline kz-surface p-4 mb-4">
      <p class="text-sm font-semibold mb-3 flex items-center gap-1.5">
        ${sparklesIconSVG()}
        پراکندگی هزینه‌ها این ماه
      </p>
      <div class="flex items-center gap-4">
        <div class="w-20 h-20 shrink-0">
          ${ringChartSVG(breakdown, { innerRadiusPct: 0.6, outerRadiusPct: 0.95, paddingAngleDeg: 2, size: 80 })}
        </div>
        <div class="flex-1 space-y-1.5 min-w-0">${rows}</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  const typeFilters = [{ k: 'all', l: 'همه' }, { k: 'income', l: 'درآمد' }, { k: 'expense', l: 'هزینه' }];
  const methodFilters = [{ k: 'all', l: 'همه روش‌ها' }, { k: 'cash', l: 'نقدی' }, { k: 'bank', l: 'بانکی' }];
  const btn = (f, active, dataAttr) => `
    <button
      data-${dataAttr}="${f.k}"
      class="filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition"
      style="${active ? 'background-color:var(--ink);color:var(--bg);border-color:var(--ink)' : 'color:var(--ink-muted);border-color:rgba(240,233,220,0.1)'}"
    >${f.l}</button>
  `;
  return `
    <div class="flex gap-2 mb-4 overflow-x-auto kz-noscroll">
      ${typeFilters.map((f) => btn(f, state.filterType === f.k, 'filter-type')).join('')}
      <span class="w-px my-1" style="background-color:rgba(240,233,220,0.1)"></span>
      ${methodFilters.map((f) => btn(f, state.filterMethod === f.k, 'filter-method')).join('')}
    </div>
  `;
}

function renderTransactionList(filtered) {
  if (filtered.length === 0) {
    return `
      <div class="text-center py-12">
        <div class="w-14 h-14 rounded-2xl kz-surface flex items-center justify-center mx-auto mb-3">
          ${piggyBankIconSVG()}
        </div>
        <p class="kz-muted text-sm">هنوز تراکنشی ثبت نشده</p>
        <p class="text-xs mt-1" style="color:rgba(140,130,114,0.7)">با دکمه‌های پایین صفحه اولین تراکنش‌تو اضافه کن</p>
      </div>
    `;
  }
  const rows = filtered.map((t) => {
    const info = getCategoryInfo(t.type, t.category);
    return `
      <div class="tx-row flex items-center gap-3 p-3 active:brightness-110 transition" data-tx-id="${t.id}">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background-color:${info.color}22">
          ${categoryCharacterHtml(t.category, 28)}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${escapeHtml(info.label)}</p>
          <div class="flex items-center gap-1.5 text-xs kz-muted mt-0.5">
            <span>${formatDate(t.date)}</span>
            <span>·</span>
            <span style="color:${t.method === 'cash' ? BRASS : INKBLUE}">${t.method === 'cash' ? 'نقدی' : 'بانکی'}</span>
            ${t.note ? `<span>·</span><span class="truncate">${escapeHtml(t.note)}</span>` : ''}
          </div>
        </div>
        <p class="kz-mono text-sm font-bold shrink-0 ${t.type === 'income' ? 'kz-text-jade' : 'kz-text-rust'}">
          ${t.type === 'income' ? '+' : '−'}${formatMoney(t.amount)}
        </p>
        <button data-delete-id="${t.id}" class="btn-delete-tx shrink-0 w-8 h-8 rounded-lg flex items-center justify-center kz-muted transition">
          ${trashIconSVG()}
        </button>
      </div>
    `;
  }).join('');
  return `<div class="rounded-2xl border kz-hairline kz-surface kz-divide overflow-hidden">${rows}</div>`;
}

function renderBottomBar() {
  return `
    <div class="fixed bottom-0 left-0 right-0 pb-6 pt-3 px-4" style="background:linear-gradient(to top, var(--bg) 55%, transparent)">
      <div class="max-w-lg mx-auto flex gap-3">
        <button id="btn-add-expense" class="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition" style="background-color:${RUST};color:#f0e9dc">
          ${trendDownIconSVG()} هزینه
        </button>
        <button id="btn-add-income" class="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition" style="background-color:${JADE};color:#f0e9dc">
          ${trendUpIconSVG()} درآمد
        </button>
      </div>
    </div>
  `;
}

function renderAddEditModal() {
  if (!state.showModal) return '';
  const cats = state.formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catButtons = cats.map((cat) => {
    const active = state.formCategory === cat.id;
    const style = active
      ? `border-color:${cat.color}66;background-color:${cat.color}18`
      : `border-color:rgba(240,233,220,0.08)`;
    return `
      <button data-set-category="${cat.id}" class="cat-btn flex flex-col items-center gap-1 py-2.5 rounded-xl border transition" style="${style}">
        <span style="display:inline-block;width:22px;height:22px;">${getCategoryCharacterSVG(cat.id)}</span>
        <span class="text-xs leading-tight text-center" style="color:${active ? 'var(--ink)' : 'var(--ink-muted)'}">${escapeHtml(cat.label)}</span>
      </button>
    `;
  }).join('');

  const submitDisabled = !state.formAmount || parseFloat(state.formAmount) <= 0;
  const title = state.editingId
    ? 'ویرایش تراکنش'
    : (state.formType === 'income' ? 'ثبت درآمد جدید' : 'ثبت هزینه جدید');

  return `
    <div class="fixed inset-0 z-50 flex items-end justify-center" id="modal-overlay-wrap">
      <div class="absolute inset-0" style="background-color:rgba(0,0,0,0.6)" id="modal-backdrop"></div>
      <div class="kz-root kz-animate-slideup relative w-full max-w-lg rounded-t-3xl border-t p-5 pb-8 max-h-screen overflow-y-auto" style="background-color:#1b160f;border-color:rgba(240,233,220,0.1)">
        <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background-color:rgba(240,233,220,0.15)"></div>
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-bold flex items-center gap-2">
            ${state.editingId ? pencilIconSVG() : ''}
            ${title}
          </h2>
          <button id="btn-close-modal" class="w-8 h-8 rounded-full kz-surface flex items-center justify-center">${xIconSVG()}</button>
        </div>

        <div class="flex gap-2 mb-5 p-1 rounded-2xl kz-surface">
          <button id="btn-type-expense" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition ${state.formType === 'expense' ? 'kz-tint-rust kz-text-rust' : 'kz-muted'}">هزینه</button>
          <button id="btn-type-income" class="flex-1 py-2.5 rounded-xl text-sm font-bold transition ${state.formType === 'income' ? 'kz-tint-jade kz-text-jade' : 'kz-muted'}">درآمد</button>
        </div>

        <div class="mb-4">
          <label class="text-xs kz-muted mb-2 block">مبلغ (تومان)</label>
          <input id="input-amount" type="number" inputmode="numeric" value="${escapeHtml(state.formAmount)}" placeholder="0" dir="ltr"
            class="kz-mono w-full kz-surface border kz-hairline rounded-2xl px-4 py-3.5 text-2xl font-bold outline-none transition" style="color:var(--ink)" />
        </div>

        <div class="mb-4">
          <label class="text-xs kz-muted mb-2 block">روش پرداخت</label>
          <div class="flex gap-2">
            <button id="btn-method-cash" class="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 border transition ${state.formMethod === 'cash' ? 'kz-tint-brass kz-border-brass kz-text-brass' : 'kz-muted kz-hairline'}">نقدی</button>
            <button id="btn-method-bank" class="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 border transition ${state.formMethod === 'bank' ? 'kz-tint-inkblue kz-border-inkblue kz-text-inkblue' : 'kz-muted kz-hairline'}">بانکی</button>
          </div>
        </div>

        <div class="mb-4">
          <label class="text-xs kz-muted mb-2 block">دسته‌بندی</label>
          <div class="grid grid-cols-4 gap-2">${catButtons}</div>
        </div>

        <div class="mb-4">
          <label class="text-xs kz-muted mb-2 block">توضیحات (اختیاری)</label>
          <input id="input-note" type="text" value="${escapeHtml(state.formNote)}" placeholder="مثلاً: ناهار با دوستان"
            class="w-full kz-surface border kz-hairline rounded-2xl px-4 py-3 text-sm outline-none transition" style="color:var(--ink)" />
        </div>

        <div class="mb-6">
          <label class="text-xs kz-muted mb-2 block">تاریخ</label>
          <input id="input-date" type="date" value="${state.formDate}" style="color-scheme:dark;color:var(--ink)"
            class="w-full kz-surface border kz-hairline rounded-2xl px-4 py-3 text-sm outline-none transition" />
        </div>

        <button id="btn-submit" ${submitDisabled ? 'disabled' : ''}
          class="w-full py-4 rounded-2xl font-bold text-sm transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          style="background-color:${state.formType === 'income' ? JADE : RUST};color:#f0e9dc">
          ${state.editingId ? 'ذخیره تغییرات' : `ثبت ${state.formType === 'income' ? 'درآمد' : 'هزینه'}`}
        </button>
      </div>
    </div>
  `;
}

function renderDeleteConfirm() {
  if (!state.deleteTargetId) return '';
  const target = state.transactions.find((t) => t.id === state.deleteTargetId);
  if (!target) return '';
  const info = getCategoryInfo(target.type, target.category);
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0" style="background-color:rgba(0,0,0,0.6)" id="delete-backdrop"></div>
      <div class="kz-root kz-animate-slideup relative w-full max-w-sm rounded-2xl border p-5" style="background-color:#1b160f;border-color:rgba(240,233,220,0.1)">
        <p class="text-sm font-bold mb-1">این تراکنش حذف بشه؟</p>
        <p class="text-xs kz-muted mb-5">
          ${escapeHtml(info.label)} · ${target.type === 'income' ? '+' : '−'}${formatMoney(target.amount)} تومان
          ${target.note ? ` · ${escapeHtml(target.note)}` : ''}
        </p>
        <div class="flex gap-2">
          <button id="btn-cancel-delete" class="flex-1 py-3 rounded-xl text-sm font-semibold kz-surface kz-muted active:scale-95 transition">انصراف</button>
          <button id="btn-confirm-delete" class="flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition" style="background-color:${RUST};color:#f0e9dc">حذف کن</button>
        </div>
      </div>
    </div>
  `;
}

// ---------- آیکون‌های SVG ساده (جایگزین lucide-react که از CDN میومد) ----------
function walletIconSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14100c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`;
}
function downloadIconSVG() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
}
function sparklesIconSVG() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kz-muted"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0Z"/></svg>`;
}
function piggyBankIconSVG() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kz-muted"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5Z"/><path d="M2 9v1"/><path d="M17 8v.01"/></svg>`;
}
function trashIconSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
}
function trendDownIconSVG() {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
}
function trendUpIconSVG() {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
}
function pencilIconSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="kz-muted"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
}
function xIconSVG() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

// =============================================================================
// render اصلی
// =============================================================================
function render() {
  const totals = computeTotals();
  const dialData = computeDialData(totals);
  const breakdown = computeCategoryBreakdown();
  const filtered = computeFilteredTransactions();

  const root = document.getElementById('root');
  root.innerHTML = `
    <div dir="rtl" class="kz-root kz-ledger-lines min-h-screen relative">
      <div class="max-w-lg mx-auto px-4 pt-6 pb-28">
        ${renderHeader()}
        ${renderBalanceDial(totals, dialData)}
        ${renderMonthSummary(totals)}
        ${renderCategoryBreakdown(breakdown)}
        ${renderFilters()}
        ${renderTransactionList(filtered)}
      </div>
      ${renderBottomBar()}
      ${renderAddEditModal()}
      ${renderDeleteConfirm()}
    </div>
  `;

  attachEventListeners(filtered);
}

// ---------- اتصال event listenerها (event delegation، چون هر بار DOM از نو ساخته می‌شه) ----------
function attachEventListeners(filtered) {
  const byId = (id) => document.getElementById(id);

  byId('btn-export')?.addEventListener('click', exportToCSV);
  byId('btn-add-expense')?.addEventListener('click', () => openAddModal('expense'));
  byId('btn-add-income')?.addEventListener('click', () => openAddModal('income'));

  document.querySelectorAll('.filter-btn[data-filter-type]').forEach((btn) => {
    btn.addEventListener('click', () => { state.filterType = btn.dataset.filterType; render(); });
  });
  document.querySelectorAll('.filter-btn[data-filter-method]').forEach((btn) => {
    btn.addEventListener('click', () => { state.filterMethod = btn.dataset.filterMethod; render(); });
  });

  document.querySelectorAll('.tx-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      // اگه کلیک روی خودِ دکمه‌ی حذف بود، این هندلر نباید مودال ویرایش رو باز کنه
      if (e.target.closest('.btn-delete-tx')) return;
      const id = row.dataset.txId;
      const t = state.transactions.find((x) => x.id === id);
      if (t) openEditModal(t);
    });
  });
  document.querySelectorAll('.btn-delete-tx').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(btn.dataset.deleteId);
    });
  });

  // مودال افزودن/ویرایش
  byId('modal-backdrop')?.addEventListener('click', closeModal);
  byId('btn-close-modal')?.addEventListener('click', closeModal);
  byId('btn-type-expense')?.addEventListener('click', () => {
    state.formType = 'expense';
    state.formCategory = EXPENSE_CATEGORIES[0].id;
    render();
  });
  byId('btn-type-income')?.addEventListener('click', () => {
    state.formType = 'income';
    state.formCategory = INCOME_CATEGORIES[0].id;
    render();
  });
  byId('btn-method-cash')?.addEventListener('click', () => { state.formMethod = 'cash'; render(); });
  byId('btn-method-bank')?.addEventListener('click', () => { state.formMethod = 'bank'; render(); });
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => { state.formCategory = btn.dataset.setCategory; render(); });
  });

  // فیلدهای ورودی: باید بعد از هر تایپ، state رو آپدیت کنیم بدون render کامل
  // (وگرنه فوکوس از روی input بعد از هر حرف می‌پره). فقط دکمه‌ی submit رو
  // مستقیم فعال/غیرفعال می‌کنیم بدون رندر مجدد کل مودال.
  const amountInput = byId('input-amount');
  if (amountInput) {
    amountInput.addEventListener('input', (e) => {
      state.formAmount = e.target.value;
      const submitBtn = byId('btn-submit');
      const valid = state.formAmount && parseFloat(state.formAmount) > 0;
      if (submitBtn) submitBtn.disabled = !valid;
    });
  }
  byId('input-note')?.addEventListener('input', (e) => { state.formNote = e.target.value; });
  byId('input-date')?.addEventListener('input', (e) => { state.formDate = e.target.value; });

  byId('btn-submit')?.addEventListener('click', handleSubmit);

  // دیالوگ حذف
  byId('delete-backdrop')?.addEventListener('click', cancelDelete);
  byId('btn-cancel-delete')?.addEventListener('click', cancelDelete);
  byId('btn-confirm-delete')?.addEventListener('click', confirmDelete);
}

// ---------- شروع برنامه ----------
loadTransactions();
render();

// ---------- ثبت Service Worker برای پشتیبانی آفلاین (PWA) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('ثبت service worker ناموفق بود:', err);
    });
  });
}
