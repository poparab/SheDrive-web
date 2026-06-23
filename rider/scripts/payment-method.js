import { auth } from '../../shared/scripts/auth.js';
import { initI18n, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

const saved  = localStorage.getItem('shedrive.paymentMethod') || 'cash';
const radios = document.querySelectorAll('input[name="payment-method"]');

radios.forEach((r) => {
  r.checked = r.value === saved;
});
updateDefaultBadge(saved);

radios.forEach((r) => {
  r.addEventListener('change', () => updateDefaultBadge(r.value));
});

qs('#save-pm-btn')?.addEventListener('click', () => {
  const selected = Array.from(radios).find((r) => r.checked)?.value || 'cash';
  localStorage.setItem('shedrive.paymentMethod', selected);
  updateDefaultBadge(selected);
  showToast(translate('payment.success'), 'success');
});

function updateDefaultBadge(val) {
  const cashBadge = qs('#cash-default-badge');
  const cardBadge = qs('#card-default-badge');
  if (cashBadge) cashBadge.hidden = val !== 'cash';
  if (cardBadge) cardBadge.hidden = val !== 'card';
}

function showToast(msg, type = 'info') {
  const c = qs('#toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
