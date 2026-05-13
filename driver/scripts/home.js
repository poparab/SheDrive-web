/**
 * home.js — Driver home page controller
 * Auth guard, map init, online/offline toggle, earnings chip, working zones.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs } from '../../shared/scripts/utils.js';
import { storage } from '../../shared/scripts/storage.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// ── Language switcher ────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')));
});

// ── Map initialization ───────────────────────────────
const locationStatus = qs('#location-status');

MapService.init('map');

MapService.getUserLocation()
  .then((lngLat) => {
    MapService.setUserLocation(lngLat);
    MapService.flyTo(lngLat, 14);
  })
  .catch(() => { /* silent — already on Cairo */ })
  .finally(() => {
    locationStatus.classList.add('is-hidden');
  });

// ── Online / Offline toggle ──────────────────────────
const ONLINE_KEY = 'shedrive.driver.online';
const onlineToggle = qs('#online-toggle');
const onlineLabel = qs('#online-label');
const driverStatus = qs('#driver-status');

let isOnline = storage.get(ONLINE_KEY) === true;
renderOnlineState();

onlineToggle.addEventListener('click', () => {
  isOnline = !isOnline;
  storage.set(ONLINE_KEY, isOnline);
  renderOnlineState();
  showToast(
    isOnline ? translate('driver.goOnline') : translate('driver.goOffline'),
    isOnline ? 'success' : 'info',
  );
});

function renderOnlineState() {
  onlineToggle.classList.toggle('toggle-pill--online', isOnline);
  onlineToggle.setAttribute('aria-pressed', String(isOnline));

  onlineLabel.setAttribute('data-i18n', isOnline ? 'driver.online' : 'driver.offline');
  onlineLabel.textContent = translate(isOnline ? 'driver.online' : 'driver.offline');

  driverStatus.innerHTML = `<span data-i18n="${isOnline ? 'driver.status.waiting' : 'driver.status.offline'}">${
    translate(isOnline ? 'driver.status.waiting' : 'driver.status.offline')
  }</span>`;
  driverStatus.classList.toggle('driver-statusbar__status--online', isOnline);

  onlineToggle.setAttribute(
    'aria-label',
    translate(isOnline ? 'driver.goOffline' : 'driver.goOnline'),
  );
}

// ── Working Zones button ──────────────────────────────
qs('#working-zones-btn').addEventListener('click', () => {
  showToast(translate('driver.workingZones') + ' — coming soon!', 'info');
});

// ── Profile button ────────────────────────────────────
qs('#profile-btn').addEventListener('click', () => {
  showToast(translate('nav.profile') + ' — coming soon!', 'info');
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
