/**
 * matching.js — "Finding your driver" screen controller
 * Reads pending trip from sessionStorage, animates search, then redirects to active-trip.html.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// ── Language switcher ────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang-btn');
    setLanguage(lang);
  });
});

// ── Read pending trip from sessionStorage ─────────────
const raw = sessionStorage.getItem('shedrive.pendingTrip');
let pendingTrip = null;

try {
  pendingTrip = raw ? JSON.parse(raw) : null;
} catch {
  pendingTrip = null;
}

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

// ── Mock driver redirect after 3500ms ────────────────
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

const driverNameEl = document.getElementById('matching-driver-name');
const driverRatingEl = document.getElementById('matching-driver-rating');
const driverVehicleEl = document.getElementById('matching-driver-vehicle');
const driverEtaEl = document.getElementById('matching-driver-eta');

if (driverNameEl) driverNameEl.textContent = mockDriver.name ?? mockDriver.nameEn ?? '—';
if (driverRatingEl) {
  const stars = '★'.repeat(Math.round(mockDriver.rating ?? 5));
  driverRatingEl.textContent = `${stars} ${mockDriver.rating ?? '5.0'}`;
}
if (driverVehicleEl) driverVehicleEl.textContent = mockDriver.vehicle ?? '';
if (driverEtaEl) {
  driverEtaEl.textContent = `${translate('trip.eta')} ${mockDriver.eta ?? 4} ${translate('trip.minutes')}`;
}

const redirectTimer = setTimeout(() => {
  sessionStorage.setItem('shedrive.activeTrip', JSON.stringify({
    driver: mockDriver,
    trip: JSON.parse(sessionStorage.getItem('shedrive.pendingTrip') || '{}'),
  }));
  window.location.assign('./active-trip.html');
}, 3500);

// ── Cancel handlers ──────────────────────────────────
function cancelRequest() {
  clearTimeout(redirectTimer);
  sessionStorage.removeItem('shedrive.pendingTrip');
  sessionStorage.removeItem('shedrive.activeTrip');
  window.location.assign('./home.html');
}

const cancelBtn = document.getElementById('cancel-btn');
const cancelTopBtn = document.getElementById('cancel-top-btn');

if (cancelBtn) cancelBtn.addEventListener('click', cancelRequest);
if (cancelTopBtn) cancelTopBtn.addEventListener('click', cancelRequest);
