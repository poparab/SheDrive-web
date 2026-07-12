/**
 * active-trip.js — In-progress trip screen controller
 * Reads activeTrip from sessionStorage, populates driver card,
 * manages ETA countdown, SOS modal, and trip details toggle.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs, startWaitingCounter } from '../../shared/scripts/utils.js';
import { Drawer } from '../../shared/scripts/drawer.js';

// ── Auth guard ────────────────────────────────────────
auth.requireAuth();

// ── i18n ──────────────────────────────────────────────
await initI18n();

// ── Language switcher ─────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Load trip data ────────────────────────────────────
const activeTripRaw = sessionStorage.getItem('shedrive.activeTrip');
const activeTrip = activeTripRaw
  ? JSON.parse(activeTripRaw)
  : {
      driver: {
        name: 'نورا أحمد',
        nameEn: 'Nora Ahmed',
        plate: 'ق أ ب 123',
        rating: 4.9,
        eta: 4,
        vehicle: 'تويوتا كورولا 2023 — أبيض',
      },
      trip: {
        pickup: 'موقعي الحالي',
        destination: 'مدينة نصر',
      },
    };

const { driver, trip } = activeTrip;
const rootStyles = getComputedStyle(document.documentElement);
const routeColor = rootStyles.getPropertyValue('--color-primary-600').trim() || '#6b2bd9';
const driverMarkerColor = rootStyles.getPropertyValue('--color-accent-500').trim() || '#d63ae2';

// ── Populate driver card ──────────────────────────────
const driverNameEl = qs('#driver-name');
const driverRatingEl = qs('#driver-rating');
const driverVehicleEl = qs('#driver-vehicle');
const driverEtaEl = qs('#driver-eta');

if (driverNameEl) driverNameEl.textContent = driver.name ?? driver.nameEn ?? 'نورا';
if (driverRatingEl) {
  const stars = '★'.repeat(Math.round(driver.rating ?? 5));
  driverRatingEl.textContent = `${stars} ${driver.rating ?? '5.0'}`;
}
if (driverVehicleEl) driverVehicleEl.textContent = driver.vehicle ?? '';

// ── ETA countdown ─────────────────────────────────────
let etaMinutes = Number(driver.eta ?? 4);

function updateEtaDisplay() {
  if (!driverEtaEl) return;
  const etaLabel = translate('trip.eta');
  const etaUnit = translate('trip.minutes');
  driverEtaEl.textContent = `${etaLabel} ${etaMinutes} ${etaUnit}`;
}

updateEtaDisplay();

const etaInterval = setInterval(() => {
  if (etaMinutes > 1) {
    etaMinutes -= 1;
    updateEtaDisplay();
  } else {
    clearInterval(etaInterval);
    window.location.assign('./trip-complete.html');
  }
}, 60_000);

// ── Populate trip details ─────────────────────────────
const detailPickupEl = qs('#detail-pickup');
const detailDestEl = qs('#detail-destination');

if (detailPickupEl) detailPickupEl.textContent = trip.pickup ?? '—';
if (detailDestEl) detailDestEl.textContent = trip.destination ?? '—';

// ── Map initialization ────────────────────────────────
const map = MapService.init('map', { zoom: 14, center: [31.241, 30.049] });

const RIDER_COORD = [31.2357, 30.0444];
const DRIVER_COORD = [31.2457, 30.0544];

if (map) {
  map.on('load', () => {
    // Route line
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [31.2357, 30.0444],
            [31.238, 30.047],
            [31.242, 30.051],
            [31.2457, 30.0544],
          ],
        },
      },
    });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': routeColor,
        'line-width': 4,
        'line-opacity': 0.8,
      },
    });

    // Rider marker (purple)
    const riderEl = document.createElement('div');
    riderEl.className = 'map-user-dot';
    riderEl.setAttribute('aria-label', translate('aria.yourLocation'));
    new mapboxgl.Marker({ element: riderEl })
      .setLngLat(RIDER_COORD)
      .addTo(map);

    // Driver marker (magenta)
    new mapboxgl.Marker({ color: driverMarkerColor })
      .setLngLat(DRIVER_COORD)
      .setPopup(
        new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(driver.name ?? translate('trip.driver'))
      )
      .addTo(map);
  });
}

// ── Arrived state: waiting counter + push banner ──────
const urlState = new URLSearchParams(location.search).get('state');
if (urlState === 'arrived' || document.body.dataset.state === 'arrived') {
  document.body.dataset.state = 'arrived';
  const waitCounter = qs('#wait-counter');
  if (waitCounter) startWaitingCounter(waitCounter, Date.now());

  const pushBanner = qs('#arrived-push-banner');
  if (pushBanner) {
    pushBanner.hidden = false;
    setTimeout(() => { pushBanner.hidden = true; }, 4000);
  }
}

// ── Cancel trip (#1719/#1852) ──────────────────────────
// Free within the grace period; a fee applies once the driver has arrived, or once she's
// been en route to pickup for 3+ minutes.
const CANCEL_GRACE_PERIOD_MS = 3 * 60 * 1000;
const cancelDialog = qs('#trip-cancel-dialog');
const cancelBtn    = qs('#trip-cancel-btn');

function feeApplies() {
  if (document.body.dataset.state === 'arrived') return true;
  const matchedAt = Number(sessionStorage.getItem('shedrive.tripMatchedAt') || Date.now());
  return Date.now() - matchedAt >= CANCEL_GRACE_PERIOD_MS;
}

cancelBtn?.addEventListener('click', () => {
  if (cancelDialog) {
    const fee = feeApplies();
    cancelDialog.setAttribute('body-key', fee ? 'cancel.tripBodyFee' : 'cancel.tripBody');
    cancelDialog.dataset.feeApplies = String(fee);
  }
  cancelDialog?.open?.();
});

cancelDialog?.addEventListener('sd-confirm', () => {
  clearInterval(etaInterval);
  const fee = cancelDialog?.dataset.feeApplies === 'true';
  // Keep the trip (marked cancelled) so home.html restores pickup/destination — #1719.
  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({
    pickup: trip.pickup,
    destination: trip.destination,
    childPassenger: trip.childPassenger,
    cancelled: true,
    cancellationFeeApplied: fee,
  }));
  sessionStorage.removeItem('shedrive.activeTrip');
  sessionStorage.removeItem('shedrive.tripMatchedAt');
  window.location.assign('./home.html');
});

// ── Side drawer ───────────────────────────────────────
qs('#menu-btn')?.addEventListener('click', () => Drawer.open());

// ── SOS modal ─────────────────────────────────────────
const sosModal = qs('#sos-modal');
const sosBtn = qs('#sos-btn');
const sosCancelBtn = qs('#sos-cancel');
const sosConfirmBtn = qs('#sos-confirm');

if (sosBtn) {
  sosBtn.addEventListener('click', () => {
    sosModal?.classList.add('is-open');
  });
}

if (sosCancelBtn) {
  sosCancelBtn.addEventListener('click', () => {
    sosModal?.classList.remove('is-open');
  });
}

if (sosConfirmBtn) {
  sosConfirmBtn.addEventListener('click', () => {
    sosModal?.classList.remove('is-open');
    window.location.assign('./emergency.html');
  });
}

// Close modal on backdrop click
if (sosModal) {
  sosModal.addEventListener('click', (e) => {
    if (e.target === sosModal) sosModal.classList.remove('is-open');
  });
}

// ── Trip details toggle ───────────────────────────────
const detailsToggle = qs('#trip-details-toggle');
const detailsBody = qs('#trip-details-body');

if (detailsToggle && detailsBody) {
  detailsToggle.addEventListener('click', () => {
    const expanded = detailsToggle.getAttribute('aria-expanded') === 'true';
    detailsToggle.setAttribute('aria-expanded', String(!expanded));
    detailsBody.classList.toggle('is-open', !expanded);
  });
}

// ── Demo end trip ─────────────────────────────────────
qs('#demo-end-btn')?.addEventListener('click', () => {
  clearInterval(etaInterval);
  window.location.assign('./trip-complete.html');
});

