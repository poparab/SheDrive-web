/**
 * decision.js — Application decision screen controller
 * Approved → home.html | Rejected → contact support toast
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Approved CTA ──────────────────────────────────────
qs('#start-btn')?.addEventListener('click', () => {
  window.location.assign('./home.html');
});

// ── Rejected CTA (stub) ───────────────────────────────
qs('#contact-btn')?.addEventListener('click', () => {
  showToast(translate('menu.comingSoon'), 'info');
});

// ── Toast helper ──────────────────────────────────────
function showToast(message, type = 'info') {
  const container = qs('#toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
