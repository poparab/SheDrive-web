/**
 * account-review.js — Rider account blocked pending admin review.
 *
 * Reached when the trip-request call is refused because the rider's account was set
 * to pending_review by a driver's gender-mismatch report (#1687 S4). The screen is
 * terminal for booking: the only ways out are support or signing out.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Review details ────────────────────────────────
// In production these come from the forbidden response the trip-request call returns
// (#1687 S4). Seeded here so the screen is demonstrable from the design story.
const review = (() => {
  try {
    return JSON.parse(sessionStorage.getItem('shedrive.accountReview') || '{}');
  } catch { return {}; }
})();

const reference = review.reference || 'GMR-4103';
const raisedAt  = review.raisedAt ? new Date(review.raisedAt) : new Date();

function renderMeta() {
  const locale = document.documentElement.lang === 'en' ? 'en-GB' : 'ar-EG';
  const refEl = qs('#review-reference');
  const dateEl = qs('#review-raised');
  if (refEl) refEl.textContent = reference;
  if (dateEl) {
    dateEl.textContent = raisedAt.toLocaleDateString(locale, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }
}

renderMeta();
document.addEventListener(I18N_EVENT, renderMeta);

// ── Sign out ──────────────────────────────────────
qs('#review-logout-btn')?.addEventListener('click', () => {
  auth.logout();
  window.location.assign('./index.html');
});
