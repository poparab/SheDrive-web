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

// ── Countdown — 10s with 3s urgency (#1582) ──────────
const TOTAL = 10;
const CIRCUMFERENCE = 2 * Math.PI * 26; // ≈ 163.4

const countdownNumber   = qs('#countdown-number');
const countdownProgress = qs('#countdown-progress');
const urgencyLabel      = qs('#urgency-label');
const requestSheet      = qs('#request-sheet');

let remaining = TOTAL;
countdownProgress.style.strokeDasharray = CIRCUMFERENCE;

// Skip auto-advance when designer previews a ?state=
const isPreview = new URLSearchParams(location.search).has('state');

function updateRing() {
  const frac = remaining / TOTAL;
  countdownProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);
  countdownNumber.textContent = remaining;
  if (remaining <= 3) {
    countdownProgress.classList.add('is-urgent');
    requestSheet?.classList.add('is-urgent');
    if (urgencyLabel) urgencyLabel.hidden = false;
  }
}

updateRing();

const timer = isPreview ? null : setInterval(() => {
  remaining -= 1;
  updateRing();
  if (remaining <= 0) {
    clearInterval(timer);
    autoExpire();
  }
}, 1000);

function autoExpire() {
  const expiredEl = qs('#request-expired');
  const sheetEl   = qs('#request-sheet');
  if (sheetEl)   sheetEl.hidden   = true;
  if (expiredEl) expiredEl.hidden = false;
  // Auto-dismiss after 2.5s (#1585)
  setTimeout(() => window.location.assign('./home.html'), 2500);
}

// ── Buttons ───────────────────────────────────────────
qs('#decline-btn').addEventListener('click', () => {
  clearInterval(timer);
  window.location.assign('./home.html');
});

qs('#accept-btn').addEventListener('click', () => {
  if (timer) clearInterval(timer);
  requestSheet?.classList.add('is-accepting');
  qs('#accept-btn').disabled  = true;
  qs('#decline-btn').disabled = true;
  // Store mock trip data for the trip screen
  sessionStorage.setItem('shedrive.activeDriverTrip', JSON.stringify({
    rider:    mockRequest.rider,
    pickup:   mockRequest.pickup,
    dest:     mockRequest.dest,
    fare:     mockRequest.fare,
    duration: mockRequest.duration,
    startedAt: Date.now(),
  }));
  setTimeout(() => window.location.assign('./trip.html?state=en-route'), 800);
});

// Conflict ok button (#1583)
qs('#conflict-ok-btn')?.addEventListener('click', () => {
  window.location.assign('./home.html');
});

// ── Toast helper ─────────────────────────────────────
function showToast(message, type = 'info') {
  const host = document.querySelector('sd-toast-host') || document.querySelector('#toast-container');
  if (host?.showToast) { host.showToast(message, type); return; }
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
