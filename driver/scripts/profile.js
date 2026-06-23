/**
 * profile.js — Driver profile screen controller (#1731)
 * Editable name, read-only phone, live language switcher, logout.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

// ── Populate from session ─────────────────────────
const session = auth.getSession();
const phone = session?.phone || '';
const phoneEl = qs('#dprofile-phone');
if (phoneEl && phone) phoneEl.value = `+20 ${phone}`;

// Set avatar initial from name input
const nameEl = qs('#dprofile-name');
const heroAvatar = qs('#hero-avatar');
const heroName   = qs('#hero-name');

function updateHero() {
  const name = nameEl?.value.trim() || '';
  if (heroAvatar) heroAvatar.textContent = name.charAt(0) || 'س';
  if (heroName)   heroName.textContent   = name || '';
}
updateHero();

// ── Language buttons — live switch (#1731) ────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang-btn');
    setLanguage(lang);
    document.querySelectorAll('[data-lang-btn]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang-btn') === lang));
    });
  });
});

// Set initial pressed state from current lang
const currentLang = document.documentElement.lang || 'ar';
document.querySelectorAll('[data-lang-btn]').forEach((b) => {
  b.setAttribute('aria-pressed', String(b.getAttribute('data-lang-btn') === currentLang));
});

// ── Save button ───────────────────────────────────
const saveBtn  = qs('#dprofile-save-btn');
const nameErr  = qs('#dprofile-name-error');

saveBtn?.addEventListener('click', () => {
  const nameVal = nameEl?.value.trim() || '';

  if (!nameVal) {
    if (nameErr) { nameErr.textContent = translate('driverProfile.name.error.empty'); nameErr.hidden = false; }
    nameEl?.focus();
    return;
  }
  if (!/^[\p{L}\s'-]+$/u.test(nameVal)) {
    if (nameErr) { nameErr.textContent = translate('driverProfile.name.error.format'); nameErr.hidden = false; }
    nameEl?.focus();
    return;
  }
  if (nameErr) nameErr.hidden = true;

  updateHero();

  // Simulate save
  const orig = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = orig;
    showToast(translate('driverProfile.saved') || 'تم حفظ التغييرات', 'success');
  }, 900);
});

// ── Logout ────────────────────────────────────────
qs('#dprofile-logout-btn')?.addEventListener('click', () => {
  auth.logout();
  window.location.assign('./index.html');
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
