/**
 * cash-collection.js — Post-trip cash fare collection screen
 * Reads trip data from sessionStorage, displays fare, then clears and returns home.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Read trip data ────────────────────────────────────
let trip = null;
try {
  const raw = sessionStorage.getItem('shedrive.activeDriverTrip');
  trip = raw ? JSON.parse(raw) : null;
} catch { trip = null; }

// Fallback demo data
if (!trip) {
  trip = {
    fare:   { ar: '٦٥', en: '65' },
    pickup: { ar: 'المعادي، القاهرة', en: 'Maadi, Cairo' },
    dest:   { ar: 'مدينة نصر، القاهرة', en: 'Nasr City, Cairo' },
  };
}

// ── Populate UI ───────────────────────────────────────
const fareEl = qs('#cash-fare-amount');
const fromEl = qs('#cash-from');
const toEl   = qs('#cash-to');

if (fareEl) {
  // Show just the numeric part (strip "جنيه"/"EGP" if present)
  const raw = trip.fare?.ar ?? '٦٥';
  fareEl.textContent = raw.replace(/[^\d٠-٩]/g, '') || raw;
}
if (fromEl) fromEl.textContent = trip.pickup?.ar ?? 'المعادي';
if (toEl)   toEl.textContent   = trip.dest?.ar   ?? 'مدينة نصر';

// ── Collect button ────────────────────────────────────
qs('#collected-btn')?.addEventListener('click', () => {
  sessionStorage.removeItem('shedrive.activeDriverTrip');
  window.location.assign('./home.html');
});
