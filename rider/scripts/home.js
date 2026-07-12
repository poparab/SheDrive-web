/**
 * home.js — Rider home page controller
 * Auth guard, map, search overlay, fare estimate, ride request.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
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

// ── DOM refs ─────────────────────────────────────────
const destinationInput = qs('#destination-input');
const pickupInput      = qs('#pickup-input');
const searchInput      = qs('#search-input');
const searchBackBtn    = qs('#search-back-btn');
const searchClearBtn   = qs('#search-clear-btn');
const useCurrentLocBtn = qs('#use-current-loc-btn');
const pinDropBtn       = qs('#pin-drop-btn');
const requestRideBtn   = qs('#request-ride-btn');
const confirmRideBtn   = qs('#confirm-ride-btn');
const fareChangeLink   = qs('.fare-change-link');
const fareDestLabel    = qs('.fare-route__label--dest');
const farePickupLabel  = qs('#fare-route-pickup');
const sameLocError     = qs('#same-location-error');
const fareErrorRow     = qs('#fare-error-row');
const fareRetryBtn     = qs('#fare-retry-btn');
const gpsBanner        = qs('#gps-banner');
const pinOverlay       = qs('#map-pin-overlay');
const pinConfirmBtn    = qs('#pin-confirm-btn');
const pinCancelBtn     = qs('#pin-cancel-btn');
const recentBlock      = qs('#search-recent-block');
const suggestionsList  = qs('#search-suggestions-list');
const noResultsEl      = qs('#search-no-results');
const childToggleInput = qs('#child-toggle-input');
const locationStatus   = qs('#location-status');

// ── Restore pickup/destination after a cancelled trip (#1719/#1852) ──
// matching.js / active-trip.js set `cancelled: true` on the stored trip instead of
// deleting it, so the rider returns home with her fields still populated. Runs
// synchronously before the (async) GPS lookup below, so the GPS handlers know not
// to overwrite an already-restored pickup value once they eventually settle.
let _pickupRestored = false;

(function restoreCancelledTrip() {
  const pending = JSON.parse(sessionStorage.getItem('shedrive.pendingTrip') || 'null');
  if (!pending?.cancelled) return;

  if (pending.pickup) {
    if (pickupInput) pickupInput.value = pending.pickup;
    if (farePickupLabel) farePickupLabel.textContent = pending.pickup;
    _pickupRestored = true;
  }
  if (pending.destination) {
    if (destinationInput) destinationInput.value = pending.destination;
    if (fareDestLabel) fareDestLabel.textContent = pending.destination;
  }
  if (childToggleInput) childToggleInput.checked = !!pending.childPassenger;

  if (pending.pickup && pending.destination && !checkSameLocation()) {
    setState('fare');
  }

  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({ ...pending, cancelled: false }));
})();

// ── Map initialization ───────────────────────────────
MapService.init('map');

MapService.getUserLocation()
  .then((lngLat) => {
    MapService.setUserLocation(lngLat);
    MapService.flyTo(lngLat, 15);
    if (!_pickupRestored) setPickupFromGps();
  })
  .catch((err) => {
    if (err?.code === 1 /* PERMISSION_DENIED */ && !_pickupRestored) {
      gpsBanner?.removeAttribute('hidden');
      if (pickupInput) {
        pickupInput.value = '';
        pickupInput.setAttribute('placeholder', translate('home.pickup.required'));
      }
    }
  })
  .finally(() => locationStatus?.classList.add('is-hidden'));

// Mock reverse-geocode — a real integration would call a geocoding API with the coordinates.
function setPickupFromGps() {
  const label = translate('home.pickup.current');
  if (pickupInput) pickupInput.value = label;
  if (farePickupLabel) farePickupLabel.textContent = label;
}

// ── State helper ─────────────────────────────────────
function setState(state) {
  if (state) {
    document.body.dataset.state = state;
  } else {
    delete document.body.dataset.state;
  }
}

function hasFareContext() {
  return !!(pickupInput?.value?.trim() && destinationInput?.value?.trim());
}

// ── Autocomplete (mock — a real integration would call #1626) ───
const AUTOCOMPLETE_RESULTS = [
  { name: 'مول العرب', sub: 'طريق مصر - الإسكندرية الصحراوي، الجيزة · 14 كم' },
  { name: 'مطار القاهرة الدولي', sub: 'المطار، القاهرة · 22 كم' },
  { name: 'برج القاهرة', sub: 'الزمالك، القاهرة · 5 كم' },
  { name: 'سيتي ستارز — النزهة', sub: 'مدينة نصر، القاهرة · 8 كم' },
  { name: 'الجامعة الأمريكية — التحرير', sub: 'وسط القاهرة · 6 كم' },
  { name: 'مستشفى دار الفؤاد', sub: '6 أكتوبر، الجيزة · 30 كم' },
  { name: 'كورنيش المعادي', sub: 'المعادي، القاهرة · 12 كم' },
];

function renderSuggestionRow(item) {
  const li = document.createElement('li');
  li.className = 'search-row';
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', 'false');
  li.tabIndex = 0;
  li.innerHTML = `
    <span class="search-row__icon search-row__icon--pin" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
    </span>
    <span class="search-row__text">
      <span class="search-row__name">${item.name}</span>
      <span class="search-row__sub">${item.sub}</span>
    </span>
  `;
  const activate = () => selectResult(item.name);
  li.addEventListener('click', activate);
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
  });
  return li;
}

// 2-character threshold, up to 5 suggestions — #1549
function runAutocomplete(query) {
  const q = query.trim();

  if (q.length < 2) {
    recentBlock?.removeAttribute('hidden');
    suggestionsList?.setAttribute('hidden', '');
    noResultsEl?.setAttribute('hidden', '');
    if (suggestionsList) suggestionsList.innerHTML = '';
    return;
  }

  recentBlock?.setAttribute('hidden', '');
  const matches = AUTOCOMPLETE_RESULTS.filter((r) => r.name.includes(q)).slice(0, 5);

  if (suggestionsList) {
    suggestionsList.innerHTML = '';
    matches.forEach((m) => suggestionsList.appendChild(renderSuggestionRow(m)));
  }

  suggestionsList?.toggleAttribute('hidden', matches.length === 0);
  noResultsEl?.toggleAttribute('hidden', matches.length > 0);
}

searchInput?.addEventListener('input', () => runAutocomplete(searchInput.value || ''));

// ── Search overlay mode: "use current location" is pickup-only (#1550 vs #1551) ──
let _searchMode = 'destination';

function openSearch(mode) {
  _searchMode = mode;
  useCurrentLocBtn?.toggleAttribute('hidden', mode !== 'pickup');
  if (searchInput) searchInput.value = '';
  runAutocomplete('');
  setState('search');
  // setTimeout, not requestAnimationFrame — rAF doesn't fire in background/inactive tabs.
  setTimeout(() => searchInput?.focus(), 0);
}

pickupInput?.addEventListener('click', () => openSearch('pickup'));
pickupInput?.addEventListener('focus', () => openSearch('pickup'));
destinationInput?.addEventListener('focus', () => openSearch('destination'));

// ── Close search (back button) ───────────────────────
searchBackBtn?.addEventListener('click', () => {
  setState(hasFareContext() ? 'fare' : '');
  destinationInput?.blur();
});

// ── Clear search input ───────────────────────────────
searchClearBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  runAutocomplete('');
  searchInput?.focus();
});

// ── Use current location (pickup only) ───────────────
useCurrentLocBtn?.addEventListener('click', () => {
  if (_searchMode !== 'pickup') return;
  selectResult(translate('home.pickup.current'));
});

// ── Map-pin overlay trigger (available for pickup and destination) ──
pinDropBtn?.addEventListener('click', () => {
  openPinOverlay(_searchMode === 'pickup' ? 'pickup' : 'dest');
});

// ── Recent-search rows ────────────────────────────────
qsa('#search-recent-list .search-row').forEach((row) => {
  const activate = () => selectResult(row.dataset.name || row.querySelector('.search-row__name')?.textContent?.trim());
  row.addEventListener('click', activate);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
  });
});

// ── Apply a selected result (recent row, suggestion row, current-location, or map pin) ──
function selectResult(name) {
  if (!name) return;

  if (_searchMode === 'pickup') {
    if (pickupInput) pickupInput.value = name;
    if (farePickupLabel) farePickupLabel.textContent = name;
    pickupInput?.removeAttribute('placeholder');
  } else {
    if (destinationInput) destinationInput.value = name;
    if (fareDestLabel) fareDestLabel.textContent = name;
  }

  if (checkSameLocation()) {
    setState('');
    return;
  }

  if (hasFareContext()) {
    storePendingTrip(destinationInput?.value?.trim());
    setState('fare');
  } else {
    setState('');
  }
}

// ── Confirm fare → navigate to matching (only active path to request a ride) ──
confirmRideBtn?.addEventListener('click', () => {
  if (confirmRideBtn.hasAttribute('disabled')) return;
  if (!hasFareContext()) return;
  if (checkSameLocation()) return;
  storePendingTrip(destinationInput?.value?.trim());
  window.location.assign('./matching.html');
});

// The default-panel "Request Ride" button (#request-ride-btn) stays disabled — #1548/#1552
// require it inactive until a fare has been fetched, and fare only exists in the fare panel,
// whose own CTA (#confirm-ride-btn) is the only way to actually request a ride.

// ── Change destination → back to search ──────────────
fareChangeLink?.addEventListener('click', () => openSearch('destination'));

// ── GPS banner dismiss / open settings ───────────────
qs('#gps-settings-btn')?.addEventListener('click', () => {
  gpsBanner?.setAttribute('hidden', '');
});

// ── Map-pin overlay ──────────────────────────────────
let _pinMode = null; // 'pickup' | 'dest'

function openPinOverlay(mode) {
  _pinMode = mode;
  pinOverlay?.removeAttribute('hidden');
}

pinConfirmBtn?.addEventListener('click', () => {
  const label = translate('home.pin.confirmed');
  _searchMode = _pinMode === 'pickup' ? 'pickup' : 'destination';
  pinOverlay?.setAttribute('hidden', '');
  _pinMode = null;
  selectResult(label);
});

pinCancelBtn?.addEventListener('click', () => {
  pinOverlay?.setAttribute('hidden', '');
  _pinMode = null;
});

// ── Same-location inline error helper (#1551) ────────
function checkSameLocation() {
  const pickup = pickupInput?.value?.trim() || '';
  const dest   = destinationInput?.value?.trim() || '';
  if (pickup && dest && pickup === dest) {
    sameLocError?.removeAttribute('hidden');
    return true;
  }
  sameLocError?.setAttribute('hidden', '');
  return false;
}

// ── Fare retry ───────────────────────────────────────
fareRetryBtn?.addEventListener('click', () => {
  fareErrorRow?.setAttribute('hidden', '');
  confirmRideBtn?.removeAttribute('disabled');
  const badge = qs('.fare-estimate-badge');
  if (badge) {
    badge.style.opacity = '0.4';
    setTimeout(() => { badge.style.opacity = ''; }, 800);
  }
});

// ── Child-passenger declaration (#1790) — persisted with the pending trip ──
childToggleInput?.addEventListener('change', () => {
  const pending = JSON.parse(sessionStorage.getItem('shedrive.pendingTrip') || 'null');
  if (pending) {
    pending.childPassenger = !!childToggleInput.checked;
    sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify(pending));
  }
});

// ── Operating hours (#1791) — Phase 1 is daytime-only ────
const OPERATING_HOURS = { start: 6, end: 23 }; // 06:00–23:00 local time

function checkOperatingHours() {
  const hour = new Date().getHours();
  const isOpen = hour >= OPERATING_HOURS.start && hour < OPERATING_HOURS.end;
  if (!isOpen) {
    qs('#hours-banner')?.removeAttribute('hidden');
    [requestRideBtn, confirmRideBtn].forEach((btn) => btn?.setAttribute('disabled', ''));
  }
  return isOpen;
}
checkOperatingHours();

// ── Side drawer ──────────────────────────────────────
qs('#menu-btn')?.addEventListener('click', () => Drawer.open());
qs('#profile-btn')?.addEventListener('click', () => Drawer.open());

// ── Helpers ──────────────────────────────────────────
function storePendingTrip(destination) {
  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({
    pickup: pickupInput?.value || '',
    destination,
    childPassenger: !!childToggleInput?.checked,
  }));
}
