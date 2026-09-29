/**
 * home.js — Rider home page controller
 * Auth guard, map, search overlay, fare estimate, ride request.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { Drawer } from '../../shared/scripts/drawer.js';
import { storage } from '../../shared/scripts/storage.js';
import { getOutstandingTotal, getRecoveryAmount } from './fee-store.js';
import { unreadCount } from '../../shared/scripts/notifications.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// Unread badge on the bell — the inbox marks items read as she opens them.
qs('#notif-bell')?.setAttribute('count', String(unreadCount('rider')));

// ── Greeting — uses her first name once her profile has one ──
function renderGreeting() {
  const el = qs('#home-greeting-text');
  const name = String(storage.get('shedrive.profile')?.name || '').trim().split(/\s+/)[0];
  if (!el || !name) return;
  el.removeAttribute('data-i18n');
  // First-strong isolates keep an Arabic name from reordering English punctuation.
  el.textContent = translate('home.greetingNamed', { name: `\u2068${name}\u2069` });
}
renderGreeting();
document.addEventListener(I18N_EVENT, renderGreeting);

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
const locationStatus   = qs('#location-status');
const searchTitle      = qs('#search-title');
const savedBlock       = qs('#search-saved-block');
const savedList        = qs('#search-saved-list');
const searchErrorEl    = qs('#search-error');
const searchRetryBtn   = qs('#search-retry-btn');
const searchLocMsg     = qs('#search-loc-msg');
const swapBtn          = qs('#swap-btn');

const demo = new URLSearchParams(location.search);

// Where "Use my current location" stands: 'ok' | 'denied' | 'unavailable' (#1550 S4/S5).
// ?loc=denied|unavailable previews the two failures without touching browser permissions.
let _locState = demo.get('loc') || 'ok';

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
    if (!demo.get('loc')) _locState = err?.code === 1 ? 'denied' : 'unavailable';
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

// ── Saved places strip (#1549) — read-only; she manages them in her profile (#1724) ──
// Same store and seed as saved-places.js, so the strip matches that screen.
// ?saved=none previews a rider who has saved nothing: the strip is left out.
const SAVED_SEED = [
  { id: 'p1', label: 'home', name: '', address: 'شارع الشيخ زايد، الشيخ زايد، الجيزة' },
  { id: 'p2', label: 'work', name: '', address: 'الرحاب، القاهرة الجديدة، القاهرة' },
  { id: 'p3', label: 'custom', name: 'النادي', address: 'نادي الجزيرة، الزمالك، القاهرة' },
];
const SAVED_ORDER = { home: 0, work: 1, custom: 2 };
const SAVED_ICONS = {
  home: '<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path><path d="M10 20v-5h4v5"></path>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 13h18"></path>',
  custom: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"></path><circle cx="12" cy="10" r="3"></circle>',
};

function savedPlaces() {
  if (demo.get('saved') === 'none') return [];
  const list = storage.get('shedrive.savedPlaces') ?? SAVED_SEED;
  return list.slice().sort((a, b) => SAVED_ORDER[a.label] - SAVED_ORDER[b.label]);
}

function savedName(p) {
  if (p.label === 'home') return translate('savedPlaces.home');
  if (p.label === 'work') return translate('savedPlaces.work');
  return p.name || translate('savedPlaces.custom');
}

function renderSavedStrip() {
  const places = savedPlaces();
  savedBlock?.toggleAttribute('hidden', places.length === 0);
  if (!savedList) return;
  savedList.innerHTML = '';
  places.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'saved-chip';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = 0;
    li.innerHTML = `
      <span class="saved-chip__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SAVED_ICONS[p.label] || SAVED_ICONS.custom}</svg>
      </span>
      <span class="saved-chip__text">
        <span class="saved-chip__name"></span>
        <span class="saved-chip__sub"></span>
      </span>`;
    li.querySelector('.saved-chip__name').textContent = savedName(p);
    li.querySelector('.saved-chip__sub').textContent = p.address;
    // Picking a saved place behaves exactly like picking that address from search.
    const activate = () => selectResult(p.address);
    li.addEventListener('click', activate);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
    savedList.appendChild(li);
  });
}
document.addEventListener(I18N_EVENT, renderSavedStrip);

// ?state=search-error previews a failed search; Retry clears it and searches again.
let _searchFails = demo.get('state') === 'search-error';

// 2-character threshold, up to 5 suggestions — #1549
function runAutocomplete(query) {
  const q = query.trim();
  searchErrorEl?.setAttribute('hidden', '');

  if (q.length < 2) {
    renderSavedStrip();
    recentBlock?.removeAttribute('hidden');
    suggestionsList?.setAttribute('hidden', '');
    noResultsEl?.setAttribute('hidden', '');
    if (suggestionsList) suggestionsList.innerHTML = '';
    return;
  }

  savedBlock?.setAttribute('hidden', '');
  recentBlock?.setAttribute('hidden', '');

  if (_searchFails) {
    suggestionsList?.setAttribute('hidden', '');
    noResultsEl?.setAttribute('hidden', '');
    searchErrorEl?.removeAttribute('hidden');
    return;
  }

  const matches = AUTOCOMPLETE_RESULTS.filter((r) => r.name.includes(q)).slice(0, 5);

  if (suggestionsList) {
    suggestionsList.innerHTML = '';
    matches.forEach((m) => suggestionsList.appendChild(renderSuggestionRow(m)));
  }

  suggestionsList?.toggleAttribute('hidden', matches.length === 0);
  noResultsEl?.toggleAttribute('hidden', matches.length > 0);
}

searchInput?.addEventListener('input', () => runAutocomplete(searchInput.value || ''));

searchRetryBtn?.addEventListener('click', () => {
  _searchFails = false;
  runAutocomplete(searchInput?.value || '');
});

// ── Search overlay mode: "use current location" is pickup-only (#1550 vs #1551) ──
let _searchMode = 'destination';
const searchOverlay = qs('#search-overlay');

function openSearch(mode) {
  _searchMode = mode;
  // The overlay's field card takes the pickup or destination look (Figma "Select
  // Pickup" / "Select Destination"), and its placeholder names the field.
  if (searchOverlay) searchOverlay.dataset.mode = mode;
  // The title names the field being chosen (#1549 S1).
  const titleKey = mode === 'pickup' ? 'home.search.titlePickup' : 'home.search.title';
  searchTitle?.setAttribute('data-i18n', titleKey);
  if (searchTitle) searchTitle.textContent = translate(titleKey);
  searchLocMsg?.setAttribute('hidden', '');
  const placeholderKey = mode === 'pickup' ? 'home.pickup.required' : 'home.search.placeholder';
  searchInput?.setAttribute('data-i18n-placeholder', placeholderKey);
  searchInput?.setAttribute('placeholder', translate(placeholderKey));
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
// Refused permission or an unknown position keeps her on the search screen with a
// message, and her pickup is unchanged (#1550 S4/S5).
useCurrentLocBtn?.addEventListener('click', () => {
  if (_searchMode !== 'pickup') return;
  if (_locState !== 'ok') {
    const key = _locState === 'denied' ? 'home.search.locDenied' : 'home.search.locUnavailable';
    searchLocMsg?.setAttribute('data-i18n', key);
    if (searchLocMsg) {
      searchLocMsg.textContent = translate(key);
      searchLocMsg.hidden = false;
    }
    return;
  }
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

// ── Swap pickup and destination (#1551 S5) ──────────
swapBtn?.addEventListener('click', () => {
  if (!pickupInput || !destinationInput) return;
  const pickup = pickupInput.value;
  pickupInput.value = destinationInput.value;
  destinationInput.value = pickup;
  if (farePickupLabel) farePickupLabel.textContent = pickupInput.value;
  if (fareDestLabel) fareDestLabel.textContent = destinationInput.value;
  if (checkSameLocation()) { setState(''); return; }
  if (hasFareContext()) {
    storePendingTrip(destinationInput.value.trim());
    setState('fare');
  } else {
    setState('');
  }
});

// ── Account under review blocks the request (#1687 S4) ──
// The server refuses the trip request while the rider is pending_review after a
// driver's gender-mismatch report. `?account=review` previews the branch for the
// design story without having to flag a session; it is a separate param from
// `?state=` because that one already selects the home panel.
const accountUnderReview =
  new URLSearchParams(location.search).get('account') === 'review' ||
  storage.get('shedrive.accountStatus') === 'pending_review';

// ── Confirm fare → navigate to matching (only active path to request a ride) ──
confirmRideBtn?.addEventListener('click', () => {
  if (confirmRideBtn.hasAttribute('disabled')) return;
  if (!hasFareContext()) return;
  if (checkSameLocation()) return;
  if (accountUnderReview) {
    window.location.assign('./account-review.html');
    return;
  }
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

// ── Outstanding rider fee (spec §7.1, #3995/#3998) ─────
// She is NEVER blocked from booking — a block would deadlock, because taking a ride is
// the only way a cash rider can clear a fee. Her entire outstanding balance is recovered
// on her next completed trip, every time, so a single dismissible banner states the
// full amount owed. Driven by fee-store.js's own query-string switches
// (?fees=N, ?zero, ?error), so no extra state is needed here.
const FEE_BANNER_DISMISSED_KEY = 'shedrive.feeBannerDismissed';

function checkFeeStatus() {
  const banner = qs('#fee-banner');
  const owed = getOutstandingTotal();

  // Booking is always available. Nothing here ever hides the ride sheet.
  qs('#ride-sheet')?.removeAttribute('hidden');

  if (owed <= 0) {
    banner?.setAttribute('hidden', '');
    return;
  }

  const dismissed = sessionStorage.getItem(FEE_BANNER_DISMISSED_KEY) === '1';
  if (dismissed) {
    banner?.setAttribute('hidden', '');
    return;
  }

  qs('#fee-banner-msg').textContent = translate('fees.homeBanner', { amount: getRecoveryAmount() });
  banner?.removeAttribute('hidden');
}
checkFeeStatus();
document.addEventListener(I18N_EVENT, checkFeeStatus);

qs('#fee-banner-dismiss')?.addEventListener('click', () => {
  qs('#fee-banner')?.setAttribute('hidden', '');
  sessionStorage.setItem(FEE_BANNER_DISMISSED_KEY, '1');
});

// ── Demo: search previews open the overlay in the right mode ──
if (['search', 'search-pickup', 'search-error'].includes(demo.get('state'))) {
  openSearch(demo.get('state') === 'search-pickup' ? 'pickup' : 'destination');
  if (demo.get('state') === 'search-error' && searchInput) {
    searchInput.value = 'مول';
    runAutocomplete(searchInput.value);
  }
}

// ── Side drawer ──────────────────────────────────────
qs('#menu-btn')?.addEventListener('click', () => Drawer.open());
qs('#profile-btn')?.addEventListener('click', () => Drawer.open());

// ── Helpers ──────────────────────────────────────────
function storePendingTrip(destination) {
  sessionStorage.setItem('shedrive.pendingTrip', JSON.stringify({
    pickup: pickupInput?.value || '',
    destination,
  }));
}
