/**
 * active-trip.js — In-progress trip screen controller
 * Reads activeTrip from sessionStorage, populates the driver card and route,
 * runs the ETA countdown / waiting counter, and drives the cancel + SOS sheets.
 *
 * Trip states (body[data-state]): none = driver en route to pickup,
 * `arrived` = driver waiting at pickup (#1559), `started` = on the way to the
 * destination (#1561). `?state=arrived|started` deep-links a state; the demo
 * button steps through them.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, getLanguage, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs, startWaitingCounter } from '../../shared/scripts/utils.js';
import { Drawer } from '../../shared/scripts/drawer.js';

// ── Auth guard ────────────────────────────────────────
auth.requireAuth();

// ── Trip state from the URL (designer deep links) ─────
const STATES = ['arrived', 'started'];
const urlState = new URLSearchParams(location.search).get('state');
if (STATES.includes(urlState)) document.body.dataset.state = urlState;

// ── i18n ──────────────────────────────────────────────
await initI18n();

// ── Language switcher ─────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Load trip data ────────────────────────────────────
function readActiveTrip() {
  try {
    const raw = sessionStorage.getItem('shedrive.activeTrip');
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to the demo trip */
  }
  return {
    driver: {
      name: 'نورا أحمد',
      nameEn: 'Nora Ahmed',
      plate: 'ق أ ب 123',
      rating: 4.9,
      eta: 4,
      vehicle: 'تويوتا كورولا 2023 — أبيض',
      vehicleEn: 'Toyota Corolla 2023 — White',
    },
    trip: {
      pickup: 'موقعي الحالي',
      destination: 'مدينة نصر',
    },
  };
}

const activeTrip = readActiveTrip();
const driver = activeTrip.driver || {};
const trip = activeTrip.trip || {};
const rootStyles = getComputedStyle(document.documentElement);
const routeColor = rootStyles.getPropertyValue('--color-primary-600').trim() || '#6b2bd9';
const driverMarkerColor = rootStyles.getPropertyValue('--color-accent-500').trim() || '#d63ae2';

const isEn = () => getLanguage?.() === 'en' || document.documentElement.lang === 'en';

// ── Populate driver card + route ──────────────────────
function renderDriver() {
  const nameEl = qs('#driver-name');
  const ratingEl = qs('#driver-rating');
  const vehicleEl = qs('#driver-vehicle');

  if (nameEl) nameEl.textContent = (isEn() && driver.nameEn) || driver.name || driver.nameEn || '—';
  const avatar = qs('.trip-driver .driver-avatar');
  if (avatar && nameEl) avatar.textContent = nameEl.textContent.trim().charAt(0) || avatar.textContent;

  if (ratingEl) {
    const star = document.createElement('span');
    star.className = 'driver-rating__star';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    ratingEl.replaceChildren(star, document.createTextNode(String(driver.rating ?? '5.0')));
  }

  if (vehicleEl) {
    const vehicle = (isEn() && driver.vehicleEn) || driver.vehicle || '';
    const parts = [];
    if (vehicle) parts.push(document.createTextNode(vehicle));
    if (driver.plate) {
      // The plate never breaks across lines.
      const plate = document.createElement('span');
      plate.className = 'driver-vehicle__plate';
      plate.dir = 'auto';
      plate.textContent = driver.plate;
      if (parts.length) parts.push(document.createTextNode(' • '));
      parts.push(plate);
    }
    vehicleEl.replaceChildren(...parts);
  }

  const pickupEl = qs('#detail-pickup');
  const destEl = qs('#detail-destination');
  if (pickupEl) pickupEl.textContent = trip.pickup || translate('home.pickup.current') || '—';
  if (destEl) destEl.textContent = trip.destination || '—';
}

renderDriver();

// ── ETA countdown ─────────────────────────────────────
let etaMinutes = Number(driver.eta ?? 4);

function updateEtaDisplay() {
  const unit = translate('trip.minutes');
  const etaEl = qs('#driver-eta');
  if (etaEl) etaEl.textContent = `${etaMinutes} ${unit}`;
  const cancelEta = qs('#cancel-eta');
  if (cancelEta) cancelEta.textContent = `${translate('trip.eta')} ${etaMinutes} ${unit}`;
}

updateEtaDisplay();

const etaInterval = setInterval(() => {
  if (etaMinutes > 1) {
    etaMinutes -= 1;
    updateEtaDisplay();
  } else {
    clearInterval(etaInterval);
    window.location.replace('./trip-complete.html');
  }
}, 60_000);

// Text built in JS does not survive applyTranslations(); rebuild it on a language switch.
document.addEventListener(I18N_EVENT, () => {
  renderDriver();
  updateEtaDisplay();
  syncCancelBody();
});

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
        new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(qs('#driver-name')?.textContent || translate('trip.driver'))
      )
      .addTo(map);
  });
}

// ── Trip state transitions ────────────────────────────
let stopWaitingCounter = null;

function setTripState(state, { announce = false } = {}) {
  if (state) document.body.dataset.state = state;
  else delete document.body.dataset.state;

  // Keep the URL in step so a reload (or a copied link) shows the same state.
  const url = new URL(location.href);
  if (state) url.searchParams.set('state', state);
  else url.searchParams.delete('state');
  history.replaceState(null, '', url);

  // Waiting counter runs only while the driver waits at pickup (#1559 S4).
  stopWaitingCounter?.();
  stopWaitingCounter = null;
  if (state === 'arrived') {
    const waitCounter = qs('#wait-counter');
    if (waitCounter) stopWaitingCounter = startWaitingCounter(waitCounter, Date.now());
    if (announce) showArrivedBanner();
  }
}

function showArrivedBanner() {
  const pushBanner = qs('#arrived-push-banner');
  if (!pushBanner) return;
  pushBanner.hidden = false;
  setTimeout(() => { pushBanner.hidden = true; }, 4000);
}

setTripState(document.body.dataset.state || null, { announce: true });

// ── Sheets (cancel + SOS) ─────────────────────────────
let lastFocus = null;

function openSheet(sheet) {
  if (!sheet) return;
  lastFocus = document.activeElement;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  sheet.querySelector('.trip-dialog__actions .btn')?.focus({ preventScroll: true });
}

function closeSheet(sheet) {
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('is-open');
  sheet.hidden = true;
  lastFocus?.focus?.({ preventScroll: true });
}

document.querySelectorAll('.trip-dialog').forEach((sheet) => {
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-dismiss]')) closeSheet(sheet);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.trip-dialog:not([hidden])').forEach(closeSheet);
});

// ── Cancel trip (#1719/#1852) ──────────────────────────
// Free within the grace period; a fee applies once the driver has arrived, or once she's
// been en route to pickup for 3+ minutes. Not offered once the trip has started (S5).
const CANCEL_GRACE_PERIOD_MS = 3 * 60 * 1000;
const cancelDialog = qs('#trip-cancel-dialog');
const cancelBtn = qs('#trip-cancel-btn');

function feeApplies() {
  if (document.body.dataset.state === 'arrived') return true;
  const matchedAt = Number(sessionStorage.getItem('shedrive.tripMatchedAt') || Date.now());
  return Date.now() - matchedAt >= CANCEL_GRACE_PERIOD_MS;
}

function syncCancelBody() {
  const body = qs('#cancel-body');
  if (!body || !cancelDialog) return;
  const key = cancelDialog.dataset.feeApplies === 'true' ? 'cancel.tripBodyFee' : 'cancel.tripBody';
  body.setAttribute('data-i18n', key);
  body.textContent = translate(key);
}

cancelBtn?.addEventListener('click', () => {
  if (document.body.dataset.state === 'started') return;
  if (cancelDialog) cancelDialog.dataset.feeApplies = String(feeApplies());
  syncCancelBody();
  openSheet(cancelDialog);
});

qs('#cancel-keep')?.addEventListener('click', () => closeSheet(cancelDialog));

qs('#cancel-confirm')?.addEventListener('click', () => {
  clearInterval(etaInterval);
  const fee = cancelDialog?.dataset.feeApplies === 'true';
  // Keep the trip (marked cancelled) so home.html restores pickup/destination — #1719.
  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({
    pickup: trip.pickup,
    destination: trip.destination,
    cancelled: true,
    cancellationFeeApplied: fee,
  }));
  sessionStorage.removeItem('shedrive.activeTrip');
  sessionStorage.removeItem('shedrive.tripMatchedAt');
  window.location.replace('./home.html');
});

// ── Side drawer ───────────────────────────────────────
qs('#menu-btn')?.addEventListener('click', () => Drawer.open());

// ── SOS confirmation (#3968) ──────────────────────────
const sosModal = qs('#sos-modal');

qs('#sos-btn')?.addEventListener('click', () => openSheet(sosModal));
qs('#sos-cancel')?.addEventListener('click', () => closeSheet(sosModal));
qs('#sos-confirm')?.addEventListener('click', () => {
  closeSheet(sosModal);
  window.location.assign('./emergency.html');
});

// ── Demo: en route → arrived → started → trip complete ─
qs('#demo-advance-btn')?.addEventListener('click', () => {
  const state = document.body.dataset.state;
  if (!state) {
    setTripState('arrived', { announce: true });
    return;
  }
  if (state === 'arrived') {
    setTripState('started');
    return;
  }
  clearInterval(etaInterval);
  window.location.replace('./trip-complete.html');
});
