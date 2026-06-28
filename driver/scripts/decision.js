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

// ── Rejected: show admin-provided rejection reason ────
// Source priority: ?reason= URL param → stored decision → i18n placeholder.
function getRejectionReason() {
  const fromUrl = new URLSearchParams(location.search).get('reason');
  if (fromUrl) return fromUrl.trim();
  try {
    const stored = JSON.parse(sessionStorage.getItem('shedrive.driverDecision') || '{}');
    if (stored && typeof stored.reason === 'string' && stored.reason.trim()) {
      return stored.reason.trim();
    }
  } catch { /* ignore malformed storage */ }
  return '';
}

const reasonEl = qs('#decision-rejection-text');
const reason = getRejectionReason();
if (reasonEl && reason) {
  // Custom reason overrides the translated placeholder; drop the i18n key
  // so applyTranslations() won't overwrite it on language switch.
  reasonEl.removeAttribute('data-i18n');
  reasonEl.textContent = reason;
}

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
