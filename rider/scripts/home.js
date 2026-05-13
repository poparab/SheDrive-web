/**
 * home.js — Rider home page controller
 * Auth guard, map initialization, user location, ride request sheet.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs } from '../../shared/scripts/utils.js';
import { Drawer } from '../../shared/scripts/drawer.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// ── Language switcher ────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang-btn'));
  });
});

// ── Map initialization ───────────────────────────────
const locationStatus = qs('#location-status');

MapService.init('map');

// Try to get user's real location; fall back to Cairo center
MapService.getUserLocation()
  .then((lngLat) => {
    MapService.setUserLocation(lngLat);
    MapService.flyTo(lngLat, 15);
  })
  .catch(() => {
    // Silent fallback — map already centered on Cairo from init
  })
  .finally(() => {
    locationStatus.classList.add('is-hidden');
  });

// ── Request ride button ──────────────────────────────
const requestRideBtn = qs('#request-ride-btn');

requestRideBtn.addEventListener('click', () => {
  const destination = qs('#destination-input').value.trim();
  if (!destination) {
    qs('#destination-input').focus();
    return;
  }
  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({
    pickup: 'موقعي الحالي',
    destination,
  }));
  window.location.assign('./matching.html');
});

// ── Side drawer ──────────────────────────────────────
qs('#menu-btn').addEventListener('click', () => Drawer.open());
qs('#profile-btn').addEventListener('click', () => Drawer.open());
