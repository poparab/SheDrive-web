/**
 * history.js — Rider trip history screen controller
 * Auth guard + i18n only for now. API wiring deferred to a future sprint.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// TODO: fetch trip history from API and render dynamically
