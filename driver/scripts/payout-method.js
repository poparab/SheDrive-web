/**
 * payout-method.js — Driver payout method screen (payouts spec §2, §3)
 *
 * Shows her current method (masked), a warning when her last payout failed,
 * and the shared form to change it. Her own change needs no approval: saving
 * applies at once and her next payout goes to the new method.
 *
 * Demo only: ?state=failed (last payout failed)
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  PAYOUT_TYPES,
  LAST_FAILED_PAYOUT,
  getPayoutMethod,
  hasFailedPayout,
  maskNumber,
  providerKey,
  savePayoutMethod,
} from './payout-store.js';
import { mountPayoutForm, payoutIcon } from './payout-form.js';

auth.requireAuth();
await initI18n();

let showFailed = hasFailedPayout();
const form = mountPayoutForm(qs('#pm-form-host'), { idPrefix: 'pm-payout' });

// ── View ──────────────────────────────────────────
function renderFailed() {
  const box = qs('#pm-failed');
  box.hidden = !showFailed;
  if (!showFailed) return;
  qs('#pm-failed-msg').textContent = translate('driver.payout.failed', {
    amount: LAST_FAILED_PAYOUT.amount.toFixed(2),
    reason: translate(LAST_FAILED_PAYOUT.reasonKey),
  });
}

function renderMethod() {
  const method = getPayoutMethod();
  const has = !!method;

  qs('#pm-method').hidden = !has;
  qs('#pm-current-title').hidden = !has;
  qs('#pm-empty').hidden = has;
  qs('#pm-change').hidden = !has;
  qs('#pm-add').hidden = has;
  if (!has) return;

  qs('#pm-method-icon').innerHTML = payoutIcon(method.type, 22);
  qs('#pm-method-type').textContent = translate(PAYOUT_TYPES[method.type]?.key || '');

  const provider = qs('#pm-method-provider');
  provider.hidden = !method.provider;
  provider.textContent = method.provider ? translate(providerKey(method.provider)) : '';

  const holder = qs('#pm-method-holder');
  holder.hidden = !method.holder;
  holder.textContent = method.holder || '';

  qs('#pm-method-number').textContent = maskNumber(method.last4);
}

function render() {
  renderFailed();
  renderMethod();
}

// ── Edit ──────────────────────────────────────────
function setMode(mode) {
  const editing = mode === 'edit';
  qs('#pm-view').hidden = editing;
  qs('#pm-edit').hidden = !editing;
  document.querySelector('sd-page')?.scrollTo({ top: 0 });
}

function openForm() {
  form.reset();
  form.preset(getPayoutMethod());
  setMode('edit');
  qs('#pm-form-host input[type="radio"]:checked, #pm-form-host input[type="radio"]')?.focus();
}

qs('#pm-change')?.addEventListener('click', openForm);
qs('#pm-add')?.addEventListener('click', openForm);
qs('#pm-cancel')?.addEventListener('click', () => setMode('view'));

const saveBtn = qs('#pm-save');
saveBtn?.addEventListener('click', () => {
  const values = form.validate();
  if (!values) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  setTimeout(() => {
    savePayoutMethod(values.type, values);
    // The failed batch line goes back to Due; the next batch uses the new method.
    showFailed = false;
    saveBtn.disabled = false;
    saveBtn.textContent = translate('driver.payout.save');
    render();
    setMode('view');
    showToast(translate('driver.payout.saved'), 'success');
  }, 700);
});

render();
document.addEventListener(I18N_EVENT, render);

// ── Toast helper ──────────────────────────────────
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
