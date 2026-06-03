/**
 * home.js — Rider home page controller
 * Auth guard, map, search overlay, fare estimate, ride request.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { Drawer } from '../../shared/scripts/drawer.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// ── Language switcher ────────────────────────────────
qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Map initialization ───────────────────────────────
const locationStatus = qs('#location-status');

MapService.init('map');

MapService.getUserLocation()
  .then((lngLat) => {
    MapService.setUserLocation(lngLat);
    MapService.flyTo(lngLat, 15);
  })
  .catch(() => { /* silent fallback — map already centred on Cairo */ })
  .finally(() => locationStatus?.classList.add('is-hidden'));

// ── State helper ─────────────────────────────────────
function setState(state) {
  if (state) {
    document.body.dataset.state = state;
  } else {
    delete document.body.dataset.state;
  }
}

// ── DOM refs ─────────────────────────────────────────
const destinationInput = qs('#destination-input');
const pickupInput      = qs('#pickup-input');
const searchInput      = qs('#search-input');
const searchBackBtn    = qs('#search-back-btn');
const searchClearBtn   = qs('#search-clear-btn');
const useCurrentLocBtn = qs('#use-current-loc-btn');
const confirmRideBtn   = qs('#confirm-ride-btn');
const fareChangeLink   = qs('.fare-change-link');
const fareDestLabel    = qs('.fare-route__label--dest');

// ── Open search overlay when destination is focused ──
destinationInput?.addEventListener('focus', () => {
  setState('search');
  // Small delay so the overlay has time to display before we move focus
  requestAnimationFrame(() => searchInput?.focus());
});

// ── Close search (back button) ───────────────────────
searchBackBtn?.addEventListener('click', () => {
  setState('');
  destinationInput?.blur();
});

// ── Clear search input ───────────────────────────────
searchClearBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  searchInput?.focus();
});

// ── Use current location ─────────────────────────────
useCurrentLocBtn?.addEventListener('click', () => {
  const label = pickupInput?.value || 'موقعي الحالي';
  if (destinationInput) destinationInput.value = label;
  storePendingTrip(label);
  setState('fare');
  if (fareDestLabel) fareDestLabel.textContent = label;
});

// ── Search result / suggestion row selection ─────────
qsa('#search-overlay .search-row').forEach((row) => {
  const activate = () => {
    const nameEl = row.querySelector('.search-row__name');
    const destination = nameEl?.textContent?.trim() || '';
    if (!destination) return;

    if (destinationInput) destinationInput.value = destination;
    if (fareDestLabel) fareDestLabel.textContent = destination;
    storePendingTrip(destination);
    setState('fare');
  };

  row.addEventListener('click', activate);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
  });
});

// ── Confirm fare → navigate to matching ──────────────
confirmRideBtn?.addEventListener('click', () => {
  const destination = destinationInput?.value?.trim();
  if (!destination) { setState('search'); searchInput?.focus(); return; }
  storePendingTrip(destination);
  window.location.assign('./matching.html');
});

// ── Change destination → back to search ──────────────
fareChangeLink?.addEventListener('click', () => {
  setState('search');
  requestAnimationFrame(() => searchInput?.focus());
});

// ── Fast-path: "Request Ride" with typed destination ─
// (keeps working if rider types directly without using search overlay)
const requestRideBtn = qs('#request-ride-btn');
requestRideBtn?.addEventListener('click', () => {
  const destination = destinationInput?.value?.trim();
  if (!destination) { destinationInput?.focus(); return; }
  storePendingTrip(destination);
  window.location.assign('./matching.html');
});

// ── Side drawer ──────────────────────────────────────
qs('#menu-btn')?.addEventListener('click', () => Drawer.open());
qs('#profile-btn')?.addEventListener('click', () => Drawer.open());

// ── Helpers ──────────────────────────────────────────
function storePendingTrip(destination) {
  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({
    pickup: pickupInput?.value || 'موقعي الحالي',
    destination,
  }));
}
