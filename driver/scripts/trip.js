/**
 * trip.js — Driver active trip screen controller
 * Shows live trip info, SOS confirmation modal, emergency overlay, complete trip.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs } from '../../shared/scripts/utils.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')));
});

// ── Map ───────────────────────────────────────────────
MapService.init('map');
MapService.getUserLocation()
  .then((lngLat) => {
    MapService.setUserLocation(lngLat);
    MapService.flyTo(lngLat, 14);
  })
  .catch(() => {});

// ── Load trip data ────────────────────────────────────
const raw = sessionStorage.getItem('shedrive.activeDriverTrip');
const trip = raw ? JSON.parse(raw) : {
  rider:    { name: 'نور', nameEn: 'Nour', rating: 4.8 },
  pickup:   { ar: 'المعادي، القاهرة',    en: 'Maadi, Cairo' },
  dest:     { ar: 'مدينة نصر، القاهرة', en: 'Nasr City, Cairo' },
  fare:     { ar: '65 جنيه',  en: 'EGP 65' },
  startedAt: Date.now(),
};

// Populate
qs('#trip-rider-name').textContent   = trip.rider.name;
qs('#trip-rider-rating').textContent = trip.rider.rating;
qs('#trip-from').textContent = trip.pickup?.ar ?? 'المعادي، القاهرة';
qs('#trip-to').textContent   = trip.dest?.ar   ?? 'مدينة نصر، القاهرة';
qs('#trip-fare').textContent = trip.fare?.ar    ?? '65 جنيه';
qs('#trip-distance').textContent = '8.4 كم';

// ── Trip timer ────────────────────────────────────────
const timerEl = qs('#trip-timer');

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

let elapsed = 0;
setInterval(() => {
  elapsed += 1;
  timerEl.textContent = formatTime(elapsed);
}, 1000);

// ── SOS flow ──────────────────────────────────────────
const sosBackdrop = qs('#sos-backdrop');
const emergencyOverlay = qs('#emergency-overlay');

qs('#sos-btn').addEventListener('click', () => {
  sosBackdrop.hidden = false;
  sosBackdrop.setAttribute('aria-hidden', 'false');
  qs('#sos-cancel').focus();
});

qs('#sos-cancel').addEventListener('click', () => {
  sosBackdrop.hidden = true;
  sosBackdrop.setAttribute('aria-hidden', 'true');
});

qs('#sos-confirm').addEventListener('click', () => {
  sosBackdrop.hidden = true;
  sosBackdrop.setAttribute('aria-hidden', 'true');
  emergencyOverlay.hidden = false;
  emergencyOverlay.setAttribute('aria-hidden', 'false');
  qs('#emergency-return').focus();
});

// Close SOS backdrop on backdrop click
sosBackdrop.addEventListener('click', (e) => {
  if (e.target === sosBackdrop) {
    sosBackdrop.hidden = true;
    sosBackdrop.setAttribute('aria-hidden', 'true');
  }
});

qs('#emergency-return').addEventListener('click', () => {
  emergencyOverlay.hidden = true;
  emergencyOverlay.setAttribute('aria-hidden', 'true');
});

// ── Action buttons ────────────────────────────────────
qs('#call-rider-btn').addEventListener('click', () => {
  showToast(translate('trip.call') + ' — ' + trip.rider.name, 'info');
});

qs('#msg-rider-btn').addEventListener('click', () => {
  showToast(translate('trip.message') + ' — ' + trip.rider.name, 'info');
});

// ── Complete trip ─────────────────────────────────────
qs('#complete-btn').addEventListener('click', () => {
  sessionStorage.removeItem('shedrive.activeDriverTrip');
  showToast(translate('trip.driver.completedToast'), 'success');
  setTimeout(() => window.location.assign('./home.html'), 2000);
});

// ── Toast helper ─────────────────────────────────────
const toastContainer = qs('#toast-container');

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
