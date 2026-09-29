/**
 * request.js — Incoming ride request screen controller
 * Countdown timer → auto-expire → home.html / accept → trip.html / decline → home.html
 *
 * Demo states (designer deep links): ?state=expired | conflict | urgency | push
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, getLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
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

// Populate mock data in the active language, and again whenever she switches.
function renderRequest() {
  const lang = getLanguage() === 'en' ? 'en' : 'ar';
  const name = lang === 'ar' ? mockRequest.rider.name : mockRequest.rider.nameEn;
  qs('#rider-name').textContent     = name;
  qs('#rider-avatar').textContent   = name.charAt(0);
  qs('#rider-rating').textContent   = mockRequest.rider.rating;
  qs('#rider-distance').textContent = `${mockRequest.rider.distance} km`;
  qs('#trip-pickup').textContent    = mockRequest.pickup[lang];
  qs('#trip-dest').textContent      = mockRequest.dest[lang];
  qs('#trip-fare').textContent      = mockRequest.fare[lang];
  qs('#trip-duration').textContent  = mockRequest.duration[lang];
}

renderRequest();
document.addEventListener(I18N_EVENT, renderRequest);

// ── Countdown (#1582) ────────────────────────────────
// The acceptance window comes from the super-admin setting (#1759, default 30 s)
// and the timer turns urgent in the last 5 seconds.
const TOTAL = 30;
const URGENT_AT = 5;

const countdownNumber   = qs('#countdown-number');
const countdownProgress = qs('#countdown-progress');
const urgencyLabel      = qs('#urgency-label');
const requestSheet      = qs('#request-sheet');

const demoState = new URLSearchParams(location.search).get('state');
// Skip auto-advance when a designer previews a ?state=
const isPreview = Boolean(demoState);

let remaining = demoState === 'urgency' ? 3 : TOTAL;

function formatClock(seconds) {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function updateRing() {
  countdownNumber.textContent = formatClock(remaining);
  countdownProgress?.style.setProperty('--progress', String(remaining / TOTAL));
  if (remaining <= URGENT_AT) {
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

function showExpired() {
  const expiredEl = qs('#request-expired');
  if (requestSheet) requestSheet.hidden = true;
  if (expiredEl) expiredEl.hidden = false;
}

function autoExpire() {
  showExpired();
  // Auto-dismiss after 2.5s (#1585)
  setTimeout(() => window.location.assign('./home.html'), 2500);
}

// ── Buttons ───────────────────────────────────────────
qs('#decline-btn').addEventListener('click', () => {
  if (timer) clearInterval(timer);
  window.location.assign('./home.html');
});

qs('#accept-btn').addEventListener('click', () => {
  if (timer) clearInterval(timer);
  requestSheet?.classList.add('is-accepting');
  qs('#accept-btn').disabled  = true;
  qs('#decline-btn').disabled = true;
  // Loading state (#1583 Scenario 4)
  const acceptLabel = qs('#accept-label');
  acceptLabel.setAttribute('data-i18n', 'driver.request.accepting');
  acceptLabel.textContent = translate('driver.request.accepting');
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

// ── Demo states ──────────────────────────────────────
if (demoState === 'expired') showExpired();
if (demoState === 'conflict') {
  qs('#request-conflict').hidden = false;
  qs('#conflict-ok-btn')?.focus();
}
if (demoState === 'push') {
  const banner = qs('#push-banner');
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 3500);
}
