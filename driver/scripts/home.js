/**
 * home.js — Driver home page controller
 * Auth guard, map init, online/offline toggle, earnings chip, working zones.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs } from '../../shared/scripts/utils.js';
import { POLICY, getLimitState, getOutstanding } from './finance-store.js';
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
  // Balance gate (#TBD-F): only going online is refused. A driver already online is
  // never knocked offline, and going offline is always allowed.
  if (!isOnline && getLimitState() === 'blocked') {
    openBalanceBlock();
    return;
  }

  isOnline = !isOnline;
  storage.set(ONLINE_KEY, isOnline);
  renderOnlineState();
  showToast(
    isOnline ? translate('driver.goOnline') : translate('driver.goOffline'),
    isOnline ? 'success' : 'info',
  );
});

// ── Balance limit: warning band + blocked sheet (#TBD-G) ──
const balanceWarn = qs('#balance-warn');
const balanceBlock = qs('#balance-block');

function renderBalanceWarn() {
  const state = getLimitState();
  const show = state !== 'ok';
  balanceWarn.hidden = !show;
  balanceWarn.setAttribute('aria-hidden', String(!show));
  if (!show) return;

  balanceWarn.classList.toggle('balance-warn--blocked', state === 'blocked');
  qs('#balance-warn-msg').textContent =
    state === 'blocked'
      ? translate('driver.balance.limitBlock')
      : translate('driver.balance.limitWarn', {
          owed: getOutstanding(),
          limit: POLICY.balanceLimit,
        });
}

function openBalanceBlock() {
  qs('#balance-block-body').textContent = translate('driver.home.blocked.body', {
    owed: getOutstanding(),
    limit: POLICY.balanceLimit,
  });
  balanceBlock.hidden = false;
  balanceBlock.setAttribute('aria-hidden', 'false');
  qs('#balance-block-close')?.focus();
}

function closeBalanceBlock() {
  balanceBlock.hidden = true;
  balanceBlock.setAttribute('aria-hidden', 'true');
  onlineToggle.focus();
}

qs('#balance-block-close')?.addEventListener('click', closeBalanceBlock);
qs('#balance-block-scrim')?.addEventListener('click', closeBalanceBlock);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !balanceBlock.hidden) closeBalanceBlock();
});

renderBalanceWarn();
document.addEventListener(I18N_EVENT, renderBalanceWarn);

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

// ── Working Zones modal ───────────────────────────
const zonesBackdrop = qs('#zones-backdrop');

qs('#working-zones-btn').addEventListener('click', () => {
  zonesBackdrop.hidden = false;
  zonesBackdrop.setAttribute('aria-hidden', 'false');
  qs('#zones-close').focus();
});

qs('#zones-close').addEventListener('click', () => {
  zonesBackdrop.hidden = true;
  zonesBackdrop.setAttribute('aria-hidden', 'true');
});

zonesBackdrop.addEventListener('click', (e) => {
  if (e.target === zonesBackdrop) {
    zonesBackdrop.hidden = true;
    zonesBackdrop.setAttribute('aria-hidden', 'true');
  }
});

// ── Simulate request (demo) ───────────────────────
qs('#simulate-request-btn').addEventListener('click', () => {
  window.location.assign('./request.html');
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
