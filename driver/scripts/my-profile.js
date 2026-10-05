/**
 * my-profile.js — Driver profile screen controller (#1801, data #1800)
 * Read-only verified details, rating, live language switch (#1731).
 *
 * Demo only: ?state=expiring | error
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { DRIVER_PROFILE as P, profileLang } from './profile-store.js';

auth.requireAuth();
await initI18n();

const state = new URLSearchParams(location.search).get('state');
const expiring = state === 'expiring';
setState(state === 'error' ? 'error' : 'loaded');

// ── Fill the screen from the profile ──────────────
const phone = auth.getSession()?.phone;

function render() {
  const lang = profileLang();
  const name = P.name[lang];
  qs('#dmp-avatar').textContent = name.charAt(0);
  qs('#dmp-name').textContent = name;
  qs('#dmp-rating').textContent = P.rating;
  qs('#dmp-rating-count').textContent = translate('driverProfile.ratingCount', { count: P.ratingCount });

  if (phone) qs('#dmp-phone').textContent = `+20 ${phone}`;
  qs('#dmp-dob').textContent = P.dateOfBirth;
  qs('#dmp-national-id').textContent = `•••• ${P.nationalIdLast4}`;

  qs('#dmp-model').textContent = P.vehicle.model[lang];
  qs('#dmp-year').textContent = P.vehicle.year;
  qs('#dmp-color').textContent = P.vehicle.color[lang];
  qs('#dmp-type').textContent = P.vehicle.type[lang];
  qs('#dmp-plate').textContent = P.vehicle.plate;

  qs('#dmp-licence-expiry').textContent = expiring ? P.licenceExpirySoon : P.licenceExpiry;
  qs('#dmp-registration-expiry').textContent = P.registrationExpiry;
}

render();
document.addEventListener(I18N_EVENT, render);

// ── Language — live switch (#1731) ────────────────
function syncLangButtons() {
  const lang = profileLang();
  qsa('[data-lang-btn]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.getAttribute('data-lang-btn') === lang))
  );
}

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang-btn'));
    syncLangButtons();
  })
);
syncLangButtons();

// ── Load failure + retry (#1801 Scenario 4) ───────
function setState(next) {
  document.body.dataset.state = next;
  document.body.classList.toggle('is-expiring', expiring && next === 'loaded');
}

if (state === 'error') showToast(translate('driverProfile.error.title'), 'danger');

const retryBtn = qs('#dmp-retry');
retryBtn?.addEventListener('click', () => {
  const label = retryBtn.textContent;
  retryBtn.disabled = true;
  retryBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  setTimeout(() => {
    retryBtn.disabled = false;
    retryBtn.textContent = label;
    setState('loaded');
  }, 900);
});

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
