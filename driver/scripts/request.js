/**
 * request.js — Incoming ride request screen controller
 * Countdown timer → auto-decline / accept → trip.html / decline → home.html
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
    MapService.flyTo(lngLat, 13);
  })
  .catch(() => {});

// ── Mock request data ─────────────────────────────────
const mockRequest = {
  rider:    { name: 'نور', nameEn: 'Nour', rating: 4.8, distance: '1.2' },
  pickup:   { ar: 'المعادي، القاهرة',    en: 'Maadi, Cairo' },
  dest:     { ar: 'مدينة نصر، القاهرة', en: 'Nasr City, Cairo' },
  fare:     { ar: '65 جنيه',  en: 'EGP 65' },
  duration: { ar: '18 دقيقة', en: '18 min' },
};

// Populate mock data
const lang = document.documentElement.lang || 'ar';
qs('#rider-name').textContent     = lang === 'ar' ? mockRequest.rider.name : mockRequest.rider.nameEn;
qs('#rider-rating').textContent   = mockRequest.rider.rating;
qs('#rider-distance').innerHTML   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg> ${mockRequest.rider.distance} km`;
qs('#trip-pickup').textContent    = mockRequest.pickup.ar;
qs('#trip-dest').textContent      = mockRequest.dest.ar;
qs('#trip-fare').textContent      = mockRequest.fare.ar;
qs('#trip-duration').textContent  = mockRequest.duration.ar;

// ── Countdown ─────────────────────────────────────────
const TOTAL = 15;
const CIRCUMFERENCE = 2 * Math.PI * 26; // ≈ 163.4

const countdownNumber   = qs('#countdown-number');
const countdownProgress = qs('#countdown-progress');

let remaining = TOTAL;
countdownProgress.style.strokeDasharray = CIRCUMFERENCE;

function updateRing() {
  const frac = remaining / TOTAL;
  countdownProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);
  countdownNumber.textContent = remaining;
  if (remaining <= 5) {
    countdownProgress.classList.add('is-urgent');
  }
}

updateRing();

const timer = setInterval(() => {
  remaining -= 1;
  updateRing();
  if (remaining <= 0) {
    clearInterval(timer);
    autoDecline();
  }
}, 1000);

function autoDecline() {
  showToast(translate('request.autoDeclined'), 'info');
  setTimeout(() => window.location.assign('./home.html'), 1500);
}

// ── Buttons ───────────────────────────────────────────
qs('#decline-btn').addEventListener('click', () => {
  clearInterval(timer);
  window.location.assign('./home.html');
});

qs('#accept-btn').addEventListener('click', () => {
  clearInterval(timer);
  // Store mock trip data for the trip screen
  sessionStorage.setItem('shedrive.activeDriverTrip', JSON.stringify({
    rider:    mockRequest.rider,
    pickup:   mockRequest.pickup,
    dest:     mockRequest.dest,
    fare:     mockRequest.fare,
    duration: mockRequest.duration,
    startedAt: Date.now(),
  }));
  window.location.assign('./trip.html?state=en-route');
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
