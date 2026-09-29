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
import { unreadCount } from '../../shared/scripts/notifications.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// Unread badge on the bell — the inbox marks items read as she opens them.
qs('#notif-bell')?.setAttribute('count', String(unreadCount('driver')));

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
const onlineToggleLabel = qs('#online-toggle-label');
const onlinePill = qs('#online-pill');
const onlineLabel = qs('#online-label');
const driverStatus = qs('#driver-status');

// ?state=online is the designer deep link to the "Waiting New Request" state.
const demoState = new URLSearchParams(location.search).get('state');
let isOnline = demoState === 'online' || storage.get(ONLINE_KEY) === true;
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
    translate(isOnline ? 'driver.status.waiting' : 'driver.status.offline'),
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
  // Amount, limit and the way to settle always travel together (#3980).
  const amounts = { owed: getOutstanding(), limit: POLICY.balanceLimit };
  qs('#balance-warn-msg').textContent = translate(
    state === 'blocked' ? 'driver.home.blocked.band' : 'driver.balance.limitWarn',
    amounts,
  );
  // Carry the demo state across so settle.html shows the same balance.
  qs('#balance-warn-action').href = `./settle.html${location.search}`;
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
  onlinePill.classList.toggle('toggle-pill--online', isOnline);
  onlineLabel.setAttribute('data-i18n', isOnline ? 'driver.online' : 'driver.offline');
  onlineLabel.textContent = translate(isOnline ? 'driver.online' : 'driver.offline');

  driverStatus.innerHTML = `<span data-i18n="${isOnline ? 'driver.status.waiting' : 'driver.status.offline'}">${
    translate(isOnline ? 'driver.status.waiting' : 'driver.status.offline')
  }</span>`;
  driverStatus.classList.toggle('driver-sheet__status--online', isOnline);

  // Figma: "Go Online" is the solid CTA; once online it becomes the outlined "Go Offline".
  onlineToggle.classList.toggle('btn--primary', !isOnline);
  onlineToggle.classList.toggle('btn--secondary', isOnline);
  onlineToggle.classList.toggle('is-online', isOnline);
  onlineToggleLabel.setAttribute('data-i18n', isOnline ? 'driver.goOffline' : 'driver.goOnline');
  onlineToggleLabel.textContent = translate(isOnline ? 'driver.goOffline' : 'driver.goOnline');
  document.body.dataset.state = isOnline ? 'online' : 'offline';
}

// ── Bottom sheet: collapsed ↔ slide-up (Figma "Waiting New Request - Slide Up") ──
const sheet = qs('#driver-sheet');
const sheetHandle = qs('#sheet-handle');

function setSheetExpanded(expanded) {
  sheet.classList.toggle('is-expanded', expanded);
  sheetHandle.setAttribute('aria-expanded', String(expanded));
  const key = expanded ? 'driver.home.sheetCollapse' : 'driver.home.sheetExpand';
  sheetHandle.setAttribute('data-i18n-aria-label', key);
  sheetHandle.setAttribute('aria-label', translate(key));
}

sheetHandle.addEventListener('click', () => {
  setSheetExpanded(!sheet.classList.contains('is-expanded'));
});

// A swipe on the handle or the sheet head slides it up or down.
let swipeStartY = null;
sheet.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, a') && event.target !== sheetHandle) return;
  if (!event.target.closest('.driver-sheet__handle, .driver-sheet__head')) return;
  swipeStartY = event.clientY;
});
sheet.addEventListener('pointerup', (event) => {
  if (swipeStartY === null) return;
  const delta = event.clientY - swipeStartY;
  swipeStartY = null;
  if (Math.abs(delta) < 24) return;
  setSheetExpanded(delta < 0);
});

setSheetExpanded(new URLSearchParams(location.search).get('sheet') === 'expanded');

// ── Working Zones modal ───────────────────────────
const zonesBackdrop = qs('#zones-backdrop');

// The shared .modal-backdrop is transparent and the .modal off-screen until
// .is-open is set — without it the modal opened invisibly and swallowed taps.
function openZones() {
  zonesBackdrop.hidden = false;
  zonesBackdrop.setAttribute('aria-hidden', 'false');
  void zonesBackdrop.offsetWidth; // commit the closed frame so the slide-up animates
  zonesBackdrop.classList.add('is-open');
  qs('#zones-close').focus();
}

function closeZones() {
  zonesBackdrop.classList.remove('is-open');
  zonesBackdrop.hidden = true;
  zonesBackdrop.setAttribute('aria-hidden', 'true');
  qs('#working-zones-btn').focus();
}

qs('#working-zones-btn').addEventListener('click', openZones);
qs('#zones-close').addEventListener('click', closeZones);

zonesBackdrop.addEventListener('click', (e) => {
  if (e.target === zonesBackdrop) closeZones();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !zonesBackdrop.hidden) closeZones();
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
