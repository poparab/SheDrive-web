/**
 * matching.js — "Finding your driver" screen controller
 * Flow: searching → confirmed (2 s) → active-trip.html
 * Also handles: no-driver retry and return-home actions.
 *
 * The searching state shows no driver card — which driver is being offered the
 * trip is never shown (API #1631). The matched card follows the #1631 payload:
 * the photo URL and the ETA can each be null.
 *
 * Demo switches (with ?state=confirmed): ?eta=none — the ETA cannot be computed;
 * ?photo=<url> — the driver has a photo (without it, her initial shows).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
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

// Populate the trip summaries (searching + confirmed states) from the handoff.
// Without one (a deep link) the pickup reads "my current location" in the
// current language and the destination keeps its demo fallback.
function renderTripSummary() {
  const pickup = pendingTrip?.pickup || translate('home.pickup.current');
  const destination = pendingTrip?.destination;
  ['chip-pickup', 'confirmed-chip-pickup'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = pickup;
  });
  if (destination) {
    ['chip-destination', 'confirmed-chip-destination'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = destination;
    });
  }
}
renderTripSummary();

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
const demo = new URLSearchParams(location.search);
const mockDriver = {
  name: 'نورا أحمد',
  nameEn: 'Nora Ahmed',
  plate: 'ق أ ب 123',
  rating: 4.9,
  eta: demo.get('eta') === 'none' ? null : 4,
  vehicle: 'تويوتا كورولا 2023 — أبيض',
  vehicleEn: 'Toyota Corolla 2023 — White',
  photo: demo.get('photo') || null,
};

// ── Populate the matched driver card ──────────────────
function populateDriverCard(nameId, ratingId, vehicleId, etaId) {
  const n  = document.getElementById(nameId);
  const r  = document.getElementById(ratingId);
  const v  = document.getElementById(vehicleId);
  const e  = document.getElementById(etaId);
  const en = document.documentElement.lang === 'en';
  if (n) n.textContent  = en ? mockDriver.nameEn : mockDriver.name;
  // Her photo when there is one; otherwise her initial in the current language.
  n?.closest('sd-driver-card')?.setAvatar?.({
    photo: mockDriver.photo,
    initial: n.textContent.trim().charAt(0),
  });
  if (r) r.textContent  = `${'★'.repeat(Math.round(mockDriver.rating))} ${mockDriver.rating}`;
  if (v) v.textContent  = `${en ? mockDriver.vehicleEn : mockDriver.vehicle} | ${mockDriver.plate}`;
  if (e) {
    e.textContent = mockDriver.eta == null
      ? translate('trip.etaUnknown')
      : `${translate('trip.eta')} ${mockDriver.eta} ${translate('trip.minutes')}`;
  }
}

function populateDriverCards() {
  populateDriverCard('confirmed-driver-name', 'confirmed-driver-rating', 'confirmed-driver-vehicle', 'confirmed-driver-eta');
}
populateDriverCards();

// Names, vehicle and "my current location" follow a language switch.
document.addEventListener(I18N_EVENT, () => {
  populateDriverCards();
  renderTripSummary();
});

// ── Cancel dialog ────────────────────────────────────
const cancelDialog = document.getElementById('cancel-dialog');

function openCancelDialog() {
  cancelDialog?.open?.();
}

function cancelRequest() {
  clearTimers();
  // Cancelling while searching/matched is always free (#1719 scenario 1/2 — matching.html
  // auto-advances to active-trip.html within ~2s, well under the 3-minute grace period).
  // Keep the trip (marked cancelled) so home.html can restore pickup/destination.
  if (pendingTrip) {
    sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({ ...pendingTrip, cancelled: true }));
  } else {
    sessionStorage.removeItem('shedrive.pendingTrip');
  }
  sessionStorage.removeItem('shedrive.activeTrip');
  sessionStorage.removeItem('shedrive.tripMatchedAt');
  window.location.replace('./home.html');
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
  window.location.replace('./home.html');
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
    // Marks when the driver was matched (en_route_pickup begins) — active-trip.js uses this
    // to decide whether a same-driver cancellation is still inside the free grace period (#1719).
    sessionStorage.setItem('shedrive.tripMatchedAt', String(Date.now()));
    document.body.dataset.state = 'confirmed';
    showPushBanner();

    // After 2 more s: navigate to active trip
    confirmTimer = setTimeout(() => {
      window.location.replace('./active-trip.html');
    }, 2000);
  }, 3500);
}

// ── Start the search ──────────────────────────────────
// Show push banner immediately if already in confirmed state (URL param)
if (new URLSearchParams(location.search).get('state') === 'confirmed') {
  showPushBanner();
}
startSearch();
