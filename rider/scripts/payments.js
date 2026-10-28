/**
 * payments.js — Rider payment method + outstanding fees (spec §7.1, #3992/#4004)
 *
 * Payment is cash-only — the method section is a static statement, not a
 * selectable option, so there is no online-payment affordance to wire up.
 * Fees are read from fee-store.js. The outstanding total is the sum of her
 * unsettled fees (a fee is recovered as a cash surcharge on her next trip); the
 * fee history lists every fee she has been charged, newest first, 20 at a time,
 * each with its status and when it was charged (API #5913).
 *
 * Demo switches are documented in fee-store.js (?fees=N, ?zero, ?error,
 * ?state=credit). The credit (#5632) comes from a waived fee she had already
 * paid, and names that fee; it is shown, not spent, in this phase.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, getLanguage, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  FEE_STATUS,
  FEE_TYPES,
  getCredit,
  getFeeHistory,
  getOutstandingTotal,
  shouldFailRequest,
} from './fee-store.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const isAr = () => document.documentElement.lang === 'ar';
const PAGE_SIZE = 20;

let failed = shouldFailRequest;
let shown = PAGE_SIZE;

const locale = () => (getLanguage() === 'ar' ? 'ar-EG' : 'en-US');

/** "Sep 10, 2026" — `chargedAt` is Cairo local time, so it is read and shown as UTC. */
function feeDate(fee) {
  const at = new Date(`${fee.chargedAt}:00Z`);
  return new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(at);
}

/** "Sep 10, 2026 • 6:38 pm" (API #5913 "Charged at"). */
function chargedAt(fee) {
  const at = new Date(`${fee.chargedAt}:00Z`);
  const time = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(at);
  return `${feeDate(fee)} • ${getLanguage() === 'ar' ? time : time.toLowerCase()}`;
}

function showError(on) {
  const box = qs('#payments-error');
  box.hidden = !on;
  box.setAttribute('aria-hidden', String(!on));
  qs('#payments-body').hidden = on;
}

/**
 * Her entire outstanding balance comes off her next ride, every time — never one fee
 * at a time, never a threshold. This notice says so. It is never a block — she can
 * always book.
 */
function renderRecoveryNotice() {
  const notice = qs('#fees-recovery-notice');
  const owed = getOutstandingTotal();
  const hasOwed = owed > 0;
  notice.hidden = !hasOwed;
  notice.setAttribute('aria-hidden', String(!hasOwed));
  const badge = qs('#fees-pending-badge');
  if (badge) badge.hidden = !hasOwed;
  if (!hasOwed) return;
  qs('#fees-recovery-total').textContent = `${owed.toFixed(2)} ${translate('home.fare.egp')}`;
  qs('#fees-recovery-notice-msg').textContent = translate('fees.recoveryNotice', { owed });
}

const PIN_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const CALENDAR_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

function renderFees() {
  const history = getFeeHistory();
  const fees = history.slice(0, shown);
  const list = qs('#fees-list');
  const zero = qs('#fees-zero');
  const owesNothing = getOutstandingTotal() === 0;

  zero.hidden = !owesNothing;
  zero.setAttribute('aria-hidden', String(!owesNothing));
  qs('#fees-history').hidden = history.length === 0;

  const more = qs('#fees-more');
  more.hidden = history.length <= shown;

  list.textContent = '';
  const currency = translate('home.fare.egp');

  fees.forEach((fee) => {
    const row = document.createElement('div');
    row.className = 'fee-row';
    row.setAttribute('role', 'listitem');

    const top = document.createElement('div');
    top.className = 'fee-row__top';

    const label = document.createElement('span');
    label.className = 'fee-row__label';
    label.textContent = translate(FEE_TYPES.cancellation_fee.key);

    const amount = document.createElement('span');
    amount.className = 'fee-row__amount';
    amount.textContent = `${fee.amount} ${currency}`;

    top.append(label, amount);
    row.appendChild(top);

    const route = isAr() ? fee.route?.ar : fee.route?.en;
    if (route) {
      const routeRow = document.createElement('div');
      routeRow.className = 'fee-row__route';
      routeRow.innerHTML = PIN_ICON;
      const link = document.createElement('a');
      link.href = `./trip-detail.html?id=${encodeURIComponent(fee.tripId)}`;
      link.textContent = route;
      routeRow.appendChild(link);
      row.appendChild(routeRow);
    }

    const meta = document.createElement('div');
    meta.className = 'fee-row__meta';
    const date = document.createElement('span');
    date.className = 'fee-row__date';
    date.innerHTML = CALENDAR_ICON;
    const dateText = document.createElement('span');
    dateText.textContent = chargedAt(fee);
    date.appendChild(dateText);

    const status = FEE_STATUS[fee.status] || FEE_STATUS.unsettled;
    const note = document.createElement('span');
    note.className = `badge badge--${status.tone} fee-row__note`;
    note.textContent = translate(status.key);

    meta.append(date, note);
    row.appendChild(meta);
    list.appendChild(row);
  });
}

/** Her credit (#5632) and the waived fee it came from — trip and date. */
function renderCredit() {
  const { amount, fees } = getCredit();
  const section = qs('#credit-section');
  section.hidden = amount <= 0;
  if (amount <= 0) return;
  qs('#credit-amount').textContent = translate('payments.credit', { amount: amount.toFixed(2) });
  const [source] = fees;
  qs('#credit-source').textContent = translate('payments.creditFrom', {
    route: (isAr() ? source.route?.ar : source.route?.en) || '',
    date: feeDate(source),
  });
}

function render() {
  if (failed) return;
  renderCredit();
  renderRecoveryNotice();
  renderFees();
}

qs('#fees-more')?.addEventListener('click', () => {
  shown += PAGE_SIZE;
  renderFees();
});

qs('#payments-retry')?.addEventListener('click', () => {
  failed = false;
  showError(false);
  render();
});

// ── Boot ─────────────────────────────────────────────
if (failed) {
  showError(true);
} else {
  render();
}
document.addEventListener(I18N_EVENT, render);
