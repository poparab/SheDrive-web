/**
 * profile.js — Driver menu screen controller (design #1827)
 * Hero links to her profile (my-profile.html, #1801); quick links; logout.
 * Her details are read-only and live on the profile screen, not here.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import { DRIVER_PROFILE as P, profileLang } from './profile-store.js';

auth.requireAuth();
await initI18n();

// ── Hero from the profile ─────────────────────────
function renderHero() {
  const name = P.name[profileLang()];
  qs('#hero-avatar').textContent = name.charAt(0);
  qs('#hero-name').textContent = name;
  qs('#hero-rating').textContent = P.rating;
}
renderHero();
document.addEventListener(I18N_EVENT, renderHero);

// ── Logout ────────────────────────────────────────
qs('#dprofile-logout-btn')?.addEventListener('click', () => {
  auth.logout();
  window.location.replace('./index.html');
});
