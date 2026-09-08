/**
 * cash-collection.js — Post-trip cash fare collection screen
 *
 * Reads trip data from sessionStorage, displays the amount to collect, then posts
 * the trip's ledger entries (custody 'driver' — spec §1) and returns home.
 *
 * When this trip also recovers a rider's outstanding cancellation fee (spec §3), the
 * amount to collect is fare + fee, itemised, and the ledger gets a separate
 * `rider_fee_recovery` entry alongside the trip's own `trip_commission` — commission
 * is never taken from the fee. Demo: ?riderfee=N (see finance-store.js).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import { getDemoRiderFee, postTripCompletion } from './finance-store.js';

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
    id: 't-demo',
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
const breakdown = qs('#cash-breakdown');

const grossRaw = trip.fare?.ar ?? '٦٥';
const grossNum = parseInt(grossRaw.replace(/[^\d]/g, ''), 10) || 65;
const commissionNum = Math.round(grossNum * 0.2 * 100) / 100;

// Rider fee recovered on this trip — trip data first, then the demo switch.
const riderFee = Number(trip.riderFeeRecovered) > 0 ? Number(trip.riderFeeRecovered) : getDemoRiderFee();
const totalToCollect = grossNum + riderFee;

if (fareEl) fareEl.textContent = String(totalToCollect);
// Net = gross × 0.8 (20% platform commission; commission % never shown). The
// recovered fee is never hers, so it never enters the net figure.
if (netEl)  netEl.textContent  = String(Math.round(grossNum * 0.8));
if (fromEl) fromEl.textContent = trip.pickup?.ar ?? 'المعادي';
if (toEl)   toEl.textContent   = trip.dest?.ar   ?? 'مدينة نصر';

if (riderFee > 0 && breakdown) {
  breakdown.hidden = false;
  breakdown.setAttribute('aria-hidden', 'false');
  const currency = translate('driver.currency');
  qs('#cash-breakdown-fare').textContent = `${grossNum} ${currency}`;
  qs('#cash-breakdown-fee').textContent = `${riderFee} ${currency}`;
  qs('#cash-breakdown-total').textContent = `${totalToCollect} ${currency}`;
}

// ── Collect button ────────────────────────────────────
qs('#collected-btn')?.addEventListener('click', () => {
  // §1 — Phase 1 cash trips always post custody 'driver'. Adding online payment
  // later means passing custody: 'platform' here — nothing else on this screen changes.
  postTripCompletion({
    tripId: trip.id || `t-${Date.now()}`,
    fare: grossNum,
    commission: commissionNum,
    custody: 'driver',
    riderFeeRecovered: riderFee,
    route: { ar: `${trip.pickup?.ar ?? ''} ← ${trip.dest?.ar ?? ''}`, en: `${trip.pickup?.en ?? ''} → ${trip.dest?.en ?? ''}` },
  });
  sessionStorage.removeItem('shedrive.activeDriverTrip');
  window.location.assign('./home.html');
});
