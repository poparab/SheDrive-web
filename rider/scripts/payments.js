/**
 * payments.js — Rider payment method + outstanding fees (spec §7.1, #3992/#4004)
 *
 * Payment is cash-only — the method section is a static statement, not a
 * selectable option, so there is no online-payment affordance to wire up.
 * Outstanding fees are read from fee-store.js — a fee is recovered as a
 * cash surcharge on her next trip, so this screen only ever shows what is still
 * unpaid, oldest first.
 *
 * Demo switches are documented in fee-store.js (?fees=N, ?blocked, ?zero, ?error).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  FEE_TYPES,
  POLICY,
  getRecoveryState,
  getRecoveryAmount,
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
 * Above the recovery threshold her whole balance comes off the next ride at once, not
 * one fee at a time. This notice says so. It is never a block — she can always book.
 */
function renderFullRecoveryNotice() {
  const notice = qs('#fees-full-recovery-notice');
  const full = getRecoveryState() === 'full';
  notice.hidden = !full;
  notice.setAttribute('aria-hidden', String(!full));
  if (!full) return;
  qs('#fees-full-recovery-notice-msg').textContent = translate('fees.fullRecoveryNotice', {
    owed: getOutstandingTotal(),
    threshold: POLICY.recoveryThreshold,
  });
}

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

    const top = document.createElement('div');
    top.className = 'fee-row__top';

    const label = document.createElement('span');
    label.className = 'fee-row__label';
    label.textContent = translate(FEE_TYPES.cancellation_fee.key);

    const amount = document.createElement('span');
    amount.className = 'fee-row__amount';
    amount.textContent = `${fee.amount} ${currency}`;

    top.append(label, amount);

    const meta = document.createElement('div');
    meta.className = 'fee-row__meta';
    const route = isAr() ? fee.route?.ar : fee.route?.en;
    const dateText = (fee.date || '').replace(/-/g, '/');
    const metaText = document.createElement('span');
    metaText.textContent = dateText;
    meta.appendChild(metaText);

    if (route) {
      const link = document.createElement('a');
      link.href = `./trip-detail.html?id=${encodeURIComponent(fee.tripId)}`;
      link.textContent = route;
      meta.append(document.createTextNode(' · '), link);
    }

    const note = document.createElement('div');
    note.className = 'fee-row__note';
    note.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    const noteText = document.createElement('span');
    noteText.textContent = translate('fees.recoveryNote');
    note.appendChild(noteText);

    row.append(top, meta, note);
    list.appendChild(row);
  });
}

function render() {
  if (failed) return;
  renderFullRecoveryNotice();
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
