/**
 * withdraw.js — Driver requests a withdrawal (#TBD-D / API #TBD-C)
 *
 * A request reserves against the available balance; it does not pay. The ledger is
 * debited only when Finance marks the request paid (#TBD-E), so nothing here posts
 * a `withdrawal` entry.
 *
 * The form is never shown when it cannot be used — a disabled platform switch, no
 * available balance, or an active cooling-off period each replace it with the reason.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  POLICY,
  cancelWithdrawal,
  getCooldownUntil,
  getMaxRequestable,
  getRequestable,
  getWithdrawalBlockReason,
  getWithdrawals,
  requestWithdrawal,
  shouldFailRequest,
  validateAmount,
} from './finance-store.js';

let failed = shouldFailRequest;

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

const form = qs('#withdraw-form');
const amountInput = qs('#withdraw-amount');
const errorEl = qs('#withdraw-error');

const STATUS_KEYS = {
  pending: 'driver.withdraw.status.pending',
  approved: 'driver.withdraw.status.approved',
  paid: 'driver.withdraw.status.paid',
  rejected: 'driver.withdraw.status.rejected',
  cancelled: 'driver.withdraw.status.cancelled',
};

// ── Toast ────────────────────────────────────────────
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

// ── Inline validation error ──────────────────────────
function setError(result) {
  const show = Boolean(result);
  errorEl.hidden = !show;
  errorEl.setAttribute('aria-hidden', String(!show));
  amountInput.setAttribute('aria-invalid', String(show));
  errorEl.textContent = show ? translate(result.key, result.vars || {}) : '';
}

// ── Form availability ────────────────────────────────
function renderForm() {
  const reason = getWithdrawalBlockReason();
  const blocked = qs('#withdraw-blocked');

  qs('#available-amount').textContent = String(getRequestable());

  form.hidden = Boolean(reason);
  blocked.hidden = !reason;
  blocked.setAttribute('aria-hidden', String(!reason));

  if (reason) {
    const until = getCooldownUntil();
    qs('#withdraw-blocked-msg').textContent =
      reason === 'disabled' ? translate('driver.withdraw.disabled')
      : reason === 'cooldown' ? translate('driver.withdraw.cooldown', {
          date: until ? until.toISOString().slice(0, 10).replace(/-/g, '/') : '',
        })
      : reason === 'below-minimum' ? translate('driver.withdraw.belowMinimum', {
          available: getRequestable(),
          min: POLICY.minWithdrawal,
        })
      : translate('driver.withdraw.noBalance');
    return;
  }

  qs('#withdraw-limits').textContent = translate('driver.withdraw.limits', {
    min: POLICY.minWithdrawal,
    max: getMaxRequestable(),
  });
  amountInput.min = String(POLICY.minWithdrawal);
  amountInput.max = String(getMaxRequestable());
}

// ── History ──────────────────────────────────────────
function renderHistory() {
  const list = qs('#withdraw-list');
  const requests = getWithdrawals();
  const empty = qs('#withdraw-empty');

  list.textContent = '';
  const isEmpty = requests.length === 0;
  empty.hidden = !isEmpty;
  empty.setAttribute('aria-hidden', String(!isEmpty));

  const currency = translate('driver.currency');

  requests.forEach((request) => {
    const row = document.createElement('article');
    row.className = `withdraw-row withdraw-row--${request.status}`;

    const top = document.createElement('div');
    top.className = 'withdraw-row__top';

    const amount = document.createElement('span');
    amount.className = 'withdraw-row__amount';
    amount.textContent = `${request.amount} ${currency}`;

    const status = document.createElement('span');
    status.className = `badge withdraw-row__status withdraw-row__status--${request.status}`;
    status.textContent = translate(STATUS_KEYS[request.status]);

    top.append(amount, status);

    const date = document.createElement('span');
    date.className = 'withdraw-row__date';
    date.textContent = request.requestedAt.replace(/-/g, '/');

    row.append(top, date);

    // A rejection always carries the admin's reason back to the driver.
    if (request.status === 'rejected' && request.reason) {
      const reason = document.createElement('p');
      reason.className = 'withdraw-row__reason';
      reason.textContent = `${translate('driver.withdraw.reason')}: ${request.reason}`;
      row.appendChild(reason);
    }

    // Only a pending request can be withdrawn by the driver herself.
    if (request.status === 'pending') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn btn--ghost btn--sm withdraw-row__cancel';
      cancel.textContent = translate('driver.withdraw.cancel');
      cancel.addEventListener('click', () => {
        if (!window.confirm(translate('driver.withdraw.cancelConfirm'))) return;
        if (cancelWithdrawal(request.id).ok) {
          showToast(translate('driver.withdraw.cancelled'), 'success');
          render();
        }
      });
      row.appendChild(cancel);
    }

    list.appendChild(row);
  });
}

function render() {
  if (failed) return;
  renderForm();
  renderHistory();
}

// ── Error state ──────────────────────────────────────
function showError(on) {
  const box = qs('#withdraw-error-state');
  box.hidden = !on;
  box.setAttribute('aria-hidden', String(!on));
  qs('#withdraw-content').hidden = on;
}

qs('#withdraw-retry')?.addEventListener('click', () => {
  failed = false;
  showError(false);
  render();
});

// ── Events ───────────────────────────────────────────
amountInput.addEventListener('input', () => {
  if (!errorEl.hidden) setError(null);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const check = validateAmount(amountInput.value);
  if (!check.ok) { setError(check); amountInput.focus(); return; }

  const result = requestWithdrawal(amountInput.value);
  if (!result.ok) { setError(result); return; }

  setError(null);
  amountInput.value = '';
  showToast(translate('driver.withdraw.success'), 'success');
  render();
});

if (failed) {
  showError(true);
} else {
  render();
}
document.addEventListener(I18N_EVENT, render);
