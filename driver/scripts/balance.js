/**
 * balance.js — Driver cash balance owed to the platform (#1788 / API #1781)
 * Read-only. Cash trips: driver keeps fare, owes platform its commission.
 * Demo: ?zero shows zero-balance state; ?error shows the network-error toast.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const params = new URLSearchParams(location.search);

// ── Mock balance data ──────────────────────────────
const BALANCE = {
  owed: params.has('zero') ? 0 : 120,
  lastSettlement: { amount: 300, date: '2026/06/15' },
  trips: [
    { date: '2026/06/22', route: { ar: 'المعادي ← مدينة نصر', en: 'Maadi → Nasr City' }, commission: 13 },
    { date: '2026/06/21', route: { ar: 'الزمالك ← التجمع الخامس', en: 'Zamalek → New Cairo' }, commission: 17 },
    { date: '2026/06/20', route: { ar: 'المهندسين ← مصر الجديدة', en: 'Mohandessin → Heliopolis' }, commission: 10 },
  ],
};

const isAr = () => document.documentElement.lang === 'ar';

function render() {
  const amountEl = qs('#balance-amount');
  if (amountEl) amountEl.textContent = String(BALANCE.owed);

  // Zero-balance state
  const zero = qs('#balance-zero');
  const card = qs('#balance-card');
  const isZero = BALANCE.owed <= 0;
  if (zero) { zero.hidden = !isZero; zero.setAttribute('aria-hidden', String(!isZero)); }
  if (card) card.hidden = isZero;

  // Last settlement
  const sAmt = qs('#settlement-amount'); if (sAmt) sAmt.textContent = String(BALANCE.lastSettlement.amount);
  const sDate = qs('#settlement-date'); if (sDate) sDate.textContent = BALANCE.lastSettlement.date;

  // Contributing trips
  const list = qs('#balance-trips-list');
  if (!list) return;
  list.textContent = '';
  const currency = translate('driver.currency') || 'جنيه';
  const commissionLabel = translate('driver.balance.commission') || 'العمولة';
  BALANCE.trips.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'balance-trip';

    const info = document.createElement('div');
    info.className = 'balance-trip__info';
    const route = document.createElement('span');
    route.className = 'balance-trip__route';
    route.textContent = isAr() ? t.route.ar : t.route.en;
    const date = document.createElement('span');
    date.className = 'balance-trip__date';
    date.textContent = t.date;
    info.append(route, date);

    const amount = document.createElement('span');
    amount.className = 'balance-trip__commission';
    amount.textContent = `${t.commission} ${currency}`;
    const lbl = document.createElement('span');
    lbl.className = 'balance-trip__commission-label';
    lbl.textContent = commissionLabel;
    amount.appendChild(lbl);

    row.append(info, amount);
    list.appendChild(row);
  });
}

// ── Toast helper ───────────────────────────────────
function showToast(message, type = 'info') {
  const host = document.querySelector('sd-toast-host');
  if (host?.showToast) { host.showToast(message, type); return; }
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Network-error path (#1788 S6)
if (params.has('error')) {
  showToast(translate('driver.balance.error') || 'تعذّر تحميل الرصيد. تحقّقي من اتصالك.', 'danger');
} else {
  render();
  document.addEventListener(I18N_EVENT, render);
}
