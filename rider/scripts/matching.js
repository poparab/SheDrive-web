/**
 * matching.js — "Finding your driver" screen controller
 * Flow: searching → confirmed (2 s) → active-trip.html
 * Also handles: no-driver retry and return-home actions.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// ── Language switcher ────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Read pending trip from sessionStorage ─────────────
let pendingTrip = null;
try {
  const raw = sessionStorage.getItem('shedrive.pendingTrip');
  pendingTrip = raw ? JSON.parse(raw) : null;
} catch { pendingTrip = null; }

// Populate trip chip labels
const chipPickup = document.getElementById('chip-pickup');
const chipDestination = document.getElementById('chip-destination');

if (pendingTrip) {
  if (chipPickup) chipPickup.textContent = pendingTrip.pickup || '—';
  if (chipDestination) chipDestination.textContent = pendingTrip.destination || '—';
}

// ── Map initialization ───────────────────────────────
const map = MapService.init('map');

if (map) {
  const el = document.createElement('div');
  el.className = 'map-pulse-dot';

  map.on('load', () => {
    new mapboxgl.Marker({ element: el })
      .setLngLat([31.2357, 30.0444])
      .addTo(map);
  });
}

// ── Mock driver data ──────────────────────────────────
const mockDriver = {
  name: 'نورا أحمد',
  nameEn: 'Nora Ahmed',
  plate: 'ق أ ب 123',
  rating: 4.9,
  eta: 4,
  vehicle: 'تويوتا كورولا 2023 — أبيض',
  vehicleEn: 'Toyota Corolla 2023 — White',
  photo: null,
};

// ── Populate searching-state preview card ─────────────
const driverNameEl  = document.getElementById('matching-driver-name');
const driverRatingEl = document.getElementById('matching-driver-rating');
const driverVehicleEl = document.getElementById('matching-driver-vehicle');
const driverEtaEl   = document.getElementById('matching-driver-eta');

function populateDriverCard(nameId, ratingId, vehicleId, etaId) {
  const n  = document.getElementById(nameId);
  const r  = document.getElementById(ratingId);
  const v  = document.getElementById(vehicleId);
  const e  = document.getElementById(etaId);
  if (n) n.textContent  = mockDriver.name;
  if (r) r.textContent  = `${'★'.repeat(Math.round(mockDriver.rating))} ${mockDriver.rating}`;
  if (v) v.textContent  = mockDriver.vehicle;
  if (e) e.textContent  = `${translate('trip.eta')} ${mockDriver.eta} ${translate('trip.minutes')}`;
}

populateDriverCard('matching-driver-name', 'matching-driver-rating', 'matching-driver-vehicle', 'matching-driver-eta');
populateDriverCard('confirmed-driver-name', 'confirmed-driver-rating', 'confirmed-driver-vehicle', 'confirmed-driver-eta');

// ── Cancel dialog ────────────────────────────────────
const cancelDialog = document.getElementById('cancel-dialog');

function openCancelDialog() {
  cancelDialog?.open?.();
}

function cancelRequest() {
  clearTimers();
  sessionStorage.removeItem('shedrive.pendingTrip');
  sessionStorage.removeItem('shedrive.activeTrip');
  window.location.assign('./home.html');
}

cancelDialog?.addEventListener('sd-confirm', cancelRequest);
cancelDialog?.addEventListener('sd-cancel', () => {});

document.getElementById('cancel-btn')?.addEventListener('click', openCancelDialog);
document.getElementById('cancel-top-btn')?.addEventListener('click', openCancelDialog);

// ── No-driver actions ─────────────────────────────────
document.getElementById('retry-btn')?.addEventListener('click', () => {
  delete document.body.dataset.state;
  startSearch();
});

document.getElementById('home-btn')?.addEventListener('click', () => {
  clearTimers();
  window.location.assign('./home.html');
});

// ── Timer management ──────────────────────────────────
let searchTimer = null;
let confirmTimer = null;

function clearTimers() {
  clearTimeout(searchTimer);
  clearTimeout(confirmTimer);
}

// ── Push banner helper ────────────────────────────────
function showPushBanner() {
  const banner = document.getElementById('push-banner');
  if (!banner) return;
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 4000);
}

function startSearch() {
  clearTimers();

  // Skip auto-advance when a ?state= param is present (designer preview)
  if (new URLSearchParams(location.search).get('state')) return;

  // After 3.5 s: show confirmed state and store activeTrip
  searchTimer = setTimeout(() => {
    sessionStorage.setItem('shedrive.activeTrip', JSON.stringify({
      driver: mockDriver,
      trip: pendingTrip || {},
    }));
    document.body.dataset.state = 'confirmed';
    showPushBanner();

    // After 2 more s: navigate to active trip
    confirmTimer = setTimeout(() => {
      window.location.assign('./active-trip.html');
    }, 2000);
  }, 3500);
}

// ── Start the search ──────────────────────────────────
// Show push banner immediately if already in confirmed state (URL param)
if (new URLSearchParams(location.search).get('state') === 'confirmed') {
  showPushBanner();
}
startSearch();
