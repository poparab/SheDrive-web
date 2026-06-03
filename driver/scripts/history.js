/**
 * history.js — Driver trip history screen controller
 * Auth guard + i18n + card navigation to trip detail.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Trip card navigation ──────────────────────────────
document.querySelectorAll('.dhistory-card').forEach((card) => {
  card.addEventListener('click', () => {
    window.location.assign('./trip-detail.html');
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.assign('./trip-detail.html');
    }
  });
});
