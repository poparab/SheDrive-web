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
const fareEl   = qs('#cash-fare-amount');
const netEl    = qs('#cash-net-amount');
const fromEl   = qs('#cash-from');
const toEl     = qs('#cash-to');

const grossRaw = trip.fare?.ar ?? '٦٥';
const grossNum = parseInt(grossRaw.replace(/[^\d]/g, ''), 10) || 65;

if (fareEl) fareEl.textContent = grossRaw.replace(/[^\d٠-٩]/g, '') || grossRaw;
// Net = gross × 0.8 (20% platform commission; commission % never shown)
if (netEl)  netEl.textContent  = String(Math.round(grossNum * 0.8));
if (fromEl) fromEl.textContent = trip.pickup?.ar ?? 'المعادي';
if (toEl)   toEl.textContent   = trip.dest?.ar   ?? 'مدينة نصر';

// ── Collect button ────────────────────────────────────
qs('#collected-btn')?.addEventListener('click', () => {
  sessionStorage.removeItem('shedrive.activeDriverTrip');
  window.location.assign('./home.html');
});
