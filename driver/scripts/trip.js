/**
 * trip.js — Driver active trip controller
 * States: en-route → arrived (waiting counter + verify-rider) → in-ride → cash-collection
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs, startWaitingCounter } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Map ───────────────────────────────────────────
MapService.init('map');
MapService.getUserLocation()
  .then((lngLat) => {
    MapService.setUserLocation(lngLat);
    MapService.flyTo(lngLat, 13);
  })
  .catch(() => {});

// ── Load active trip data ─────────────────────────
const tripData = (() => {
  try {
    return JSON.parse(sessionStorage.getItem('shedrive.activeDriverTrip') || '{}');
  } catch { return {}; }
})();

const rider  = tripData.rider  || { name: 'نور', nameEn: 'Nour', rating: 4.8 };
const pickup = tripData.pickup || { ar: 'المعادي، القاهرة', en: 'Maadi, Cairo' };
const dest   = tripData.dest   || { ar: 'مدينة نصر، القاهرة', en: 'Nasr City, Cairo' };
const fare   = tripData.fare   || { ar: '65 جنيه', en: 'EGP 65' };

// ── Populate rider info across states ─────────────
const riderName = document.documentElement.lang === 'ar'
  ? rider.name
  : (rider.nameEn || rider.name);

['enroute-rider-name', 'arrived-rider-name', 'trip-rider-name'].forEach((id) => {
  const el = qs(`#${id}`);
  if (el) el.textContent = riderName;
});
['enroute-avatar', 'arrived-avatar'].forEach((id) => {
  const el = qs(`#${id}`);
  if (el) el.textContent = riderName.charAt(0);
});

const ratingEl = qs('#trip-rider-rating');
if (ratingEl) ratingEl.textContent = rider.rating;

const fromEl  = qs('#trip-from');   if (fromEl)  fromEl.textContent  = pickup.ar;
const toEl    = qs('#trip-to');     if (toEl)    toEl.textContent    = dest.ar;
const fareEl  = qs('#trip-fare');   if (fareEl)  fareEl.textContent  = fare.ar;
const pickupEl = qs('#enroute-pickup'); if (pickupEl) pickupEl.textContent = pickup.ar;

const verifyNameEl = qs('#verify-rider-name strong');
if (verifyNameEl) verifyNameEl.textContent = rider.name + (rider.lastName ? ` ${rider.lastName}` : ' أحمد');

// ── State machine ─────────────────────────────────
function getState() { return document.body.dataset.state || 'in-ride'; }
function setState(s) {
  document.body.dataset.state = s;
  updateBadge(s);
}

function updateBadge(s) {
  const badge = qs('#trip-status-badge');
  if (!badge) return;
  const labels = {
    'en-route':    translate('driver.trip.enRoute.status') || 'في الطريق إلى الراكبة',
    'arrived':     translate('driver.trip.arrived.status') || 'انتظار الراكبة',
    'verify-rider': translate('driver.trip.arrived.status') || 'التحقق من الراكبة',
    'in-ride':     translate('trip.driver.status')         || 'الرحلة جارية',
  };
  badge.textContent = labels[s] || labels['in-ride'];
}

// ── Trip timer (in-ride) ──────────────────────────
const timerEl = qs('#trip-timer');
let timerInterval = null;
let tripStartTs = tripData.startedAt || Date.now();
let arrivalTs = null;

function startTripTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - tripStartTs) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;
  }, 1000);
}

if (getState() === 'in-ride') startTripTimer();

// ── Waiting counter (arrived) #1767 ──────────────
let waitCounterStop = null;

function startWaiting() {
  const el = qs('#wait-counter');
  if (!el) return;
  if (waitCounterStop) waitCounterStop();
  waitCounterStop = startWaitingCounter(el, Date.now());
}

if (getState() === 'arrived' || getState() === 'verify-rider') startWaiting();

// ── Arrived button → branch verify / start ────────
qs('#arrived-btn')?.addEventListener('click', () => {
  const verifySection = qs('#verify-section');
  const startBtn = qs('#start-trip-btn');
  const isFirstTrip = !tripData.isReturningRider;
  if (isFirstTrip) {
    if (verifySection) verifySection.hidden = false;
    if (startBtn) startBtn.hidden = true;
  } else {
    if (verifySection) verifySection.hidden = true;
    if (startBtn) startBtn.hidden = false;
  }
  arrivalTs = Date.now();
  setState('arrived');
  startWaiting();
});

// ── Start trip (returning rider) ──────────────────
qs('#start-trip-btn')?.addEventListener('click', () => {
  if (waitCounterStop) waitCounterStop();
  tripStartTs = Date.now();
  setState('in-ride');
  startTripTimer();
});

// ── Verify-rider OK (#1588) ───────────────────────
const verifyOkDialog  = qs('#verify-ok-dialog');
const verifyFailDialog = qs('#verify-fail-dialog');

qs('#verify-ok-btn')?.addEventListener('click', () => {
  if (verifyOkDialog?.open) { verifyOkDialog.open(); }
  else { verifyOkDialog?.removeAttribute('hidden'); }
});

verifyOkDialog?.addEventListener('sd-confirm', () => {
  if (waitCounterStop) waitCounterStop();
  tripStartTs = Date.now();
  setState('in-ride');
  startTripTimer();
});

// ── Verify-rider FAIL (#1588) ─────────────────────
qs('#verify-fail-btn')?.addEventListener('click', () => {
  if (verifyFailDialog?.open) { verifyFailDialog.open(); }
  else { verifyFailDialog?.removeAttribute('hidden'); }
});

verifyFailDialog?.addEventListener('sd-confirm', () => {
  showToast(translate('verifyRider.cancelledToast') || 'تم إلغاء الرحلة وإرسال تقرير أمان', 'danger');
  setTimeout(() => window.location.assign('./home.html'), 1800);
});

// ── Cancel trip with reason + fee (#1722) ─────────
const CANCEL_FEE = { ar: '20 جنيه', en: 'EGP 20' };
const DRIVER_GRACE_MS = 120000; // no fee within grace from acceptance
const NOSHOW_WAIT_MS  = 180000; // fee-free rider no-show wait from arrival

const cancelBackdrop = qs('#cancel-backdrop');
const cancelFeeText  = qs('#cancel-fee-text');
const cancelConfirm  = qs('#cancel-confirm');
const noShowRadio    = document.querySelector('#cancel-reasons input[value="no_show"]');
let cancelTicker = null;

function feeAmount() {
  return document.documentElement.lang === 'ar' ? CANCEL_FEE.ar : CANCEL_FEE.en;
}
function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function selectedReason() {
  return document.querySelector('#cancel-reasons input[name="cancel-reason"]:checked')?.value || null;
}

function refreshCancelState() {
  const reason = selectedReason();
  const st = getState();
  const now = Date.now();
  const withinGrace = (now - tripStartTs) < DRIVER_GRACE_MS;
  const arrived = st === 'arrived' || st === 'verify-rider';
  const noShowElapsed = arrivalTs ? now - arrivalTs : 0;
  const noShowReady = arrived && arrivalTs && noShowElapsed >= NOSHOW_WAIT_MS;

  if (noShowRadio) noShowRadio.disabled = !noShowReady;

  let key = 'driver.cancel.fee.none';
  let vars = {};
  if (!((reason === 'no_show' && noShowReady) || withinGrace)) {
    key = 'driver.cancel.fee.willApply';
    vars = { amount: feeAmount() };
  }
  let text = translate(key, vars) || '';
  if (arrived && arrivalTs && !noShowReady) {
    text += ' ' + translate('driver.cancel.fee.noShowWait', { time: mmss(NOSHOW_WAIT_MS - noShowElapsed) });
  }
  if (cancelFeeText) cancelFeeText.textContent = text;
  if (cancelConfirm) cancelConfirm.disabled = !reason || (reason === 'no_show' && !noShowReady);
}

function openCancel() {
  if (!cancelBackdrop) return;
  const st = getState();
  if (!arrivalTs && (st === 'arrived' || st === 'verify-rider')) arrivalTs = Date.now();
  document.querySelectorAll('#cancel-reasons input[name="cancel-reason"]').forEach((r) => { r.checked = false; });
  cancelBackdrop.hidden = false;
  cancelBackdrop.removeAttribute('aria-hidden');
  refreshCancelState();
  if (cancelTicker) clearInterval(cancelTicker);
  cancelTicker = setInterval(refreshCancelState, 1000);
}
function closeCancel() {
  if (!cancelBackdrop) return;
  cancelBackdrop.hidden = true;
  cancelBackdrop.setAttribute('aria-hidden', 'true');
  if (cancelTicker) { clearInterval(cancelTicker); cancelTicker = null; }
}

[qs('#cancel-trip-enroute-btn'), qs('#cancel-trip-arrived-btn')].forEach((btn) =>
  btn?.addEventListener('click', openCancel)
);
qs('#cancel-goback')?.addEventListener('click', closeCancel);
cancelBackdrop?.addEventListener('click', (e) => { if (e.target === cancelBackdrop) closeCancel(); });
document.querySelectorAll('#cancel-reasons input[name="cancel-reason"]').forEach((r) =>
  r.addEventListener('change', refreshCancelState)
);

qs('#cancel-confirm')?.addEventListener('click', () => {
  const reason = selectedReason();
  if (!reason) return;
  const now = Date.now();
  const withinGrace = (now - tripStartTs) < DRIVER_GRACE_MS;
  const noShowReady = arrivalTs && (now - arrivalTs) >= NOSHOW_WAIT_MS;
  const noFee = (reason === 'no_show' && noShowReady) || withinGrace;
  closeCancel();
  const msg = noFee
    ? translate('driver.cancel.cancelledNoFee')
    : translate('driver.cancel.cancelledFee', { amount: feeAmount() });
  showToast(msg || 'تم إلغاء الرحلة', noFee ? 'success' : 'danger');
  setTimeout(() => window.location.assign('./home.html'), 1800);
});

// ── Navigation deep-link (#1586 / #1590) ──────────
document.querySelectorAll('.trip-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lat = btn.dataset.navLat;
    const lng = btn.dataset.navLng;
    const app = btn.dataset.navApp || 'google';
    const url = app === 'waze'
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
  });
});

// ── Call / message ────────────────────────────────
qs('#call-rider-btn')?.addEventListener('click', () =>
  showToast(translate('trip.driver.callToast') || 'جارٍ الاتصال…', 'info')
);
qs('#msg-rider-btn')?.addEventListener('click', () =>
  showToast(translate('trip.driver.msgToast') || 'الرسائل غير متاحة حالياً', 'info')
);

// ── Complete trip (#1591) → cash-collection ───────
qs('#complete-btn')?.addEventListener('click', () => {
  if (timerInterval) clearInterval(timerInterval);
  window.location.assign('./cash-collection.html');
});

// ── SOS ───────────────────────────────────────────
const sosBackdrop = qs('#sos-backdrop');

qs('#sos-btn')?.addEventListener('click', () => {
  if (sosBackdrop) { sosBackdrop.hidden = false; sosBackdrop.removeAttribute('aria-hidden'); }
});

qs('#sos-cancel')?.addEventListener('click', () => {
  if (sosBackdrop) { sosBackdrop.hidden = true; sosBackdrop.setAttribute('aria-hidden', 'true'); }
});

qs('#sos-confirm')?.addEventListener('click', () => {
  if (sosBackdrop) { sosBackdrop.hidden = true; sosBackdrop.setAttribute('aria-hidden', 'true'); }
  const overlay = qs('#emergency-overlay');
  if (overlay) { overlay.hidden = false; overlay.removeAttribute('aria-hidden'); }
});

qs('#emergency-return')?.addEventListener('click', () => {
  const overlay = qs('#emergency-overlay');
  if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
});

// ── Toast helper ──────────────────────────────────
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
