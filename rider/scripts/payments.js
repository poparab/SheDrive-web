/**
 * payments.js — Rider payment method + outstanding fees (spec §7.1, #3992/#4004)
 *
 * Payment is cash-only — the method section is a static statement, not a
 * selectable option, so there is no online-payment affordance to wire up.
 * Outstanding fees are read from fee-store.js — a fee is recovered as a
 * cash surcharge on her next trip, so this screen only ever shows what is still
 * unpaid, oldest first.
 *
 * Demo switches are documented in fee-store.js (?fees=N, ?zero, ?error).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  FEE_TYPES,
  getOutstandingFees,
  getOutstandingTotal,
  shouldFailRequest,
} from './fee-store.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const isAr = () => document.documentElement.lang === 'ar';

let failed = shouldFailRequest;

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
  const fees = getOutstandingFees();
  const list = qs('#fees-list');
  const zero = qs('#fees-zero');
  const isEmpty = fees.length === 0;

  zero.hidden = !isEmpty;
  zero.setAttribute('aria-hidden', String(!isEmpty));

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
    dateText.textContent = (fee.date || '').replace(/-/g, '/');
    date.appendChild(dateText);

    const note = document.createElement('span');
    note.className = 'badge badge--brand fee-row__note';
    note.textContent = translate('fees.recoveryNote');

    meta.append(date, note);
    row.appendChild(meta);
    list.appendChild(row);
  });
}

function render() {
  if (failed) return;
  renderRecoveryNotice();
  renderFees();
}

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
