/**
 * emergency.js — Driver SOS alert screen controller (Phase 1 SOS)
 * Mirrors rider/scripts/emergency.js: who was alerted, per-contact delivery
 * status, live-location sharing, public emergency numbers, and a stand-down.
 * (#1951 / #1952)
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { goBack } from '../../shared/scripts/navigation.js';
import { getEmergencyContacts, relationshipLabel } from '../../shared/scripts/emergency-contacts.js';

auth.requireAuth();
await initI18n();

// ── Language switcher ──
qsa('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Trip recap ──
// There is no driver vehicle profile in storage yet, so a plausible fallback
// stands in when the active-trip record doesn't carry plate/vehicle (mock only).
const tripRaw = sessionStorage.getItem('shedrive.activeDriverTrip');
const fallback = {
  rider: { name: 'نور أحمد', nameEn: 'Nour Ahmed' },
  plate: 'ق د و ٤٥٦',
  vehicle: 'هيونداي إلنترا 2022',
};
let trip = fallback;
try {
  trip = tripRaw ? JSON.parse(tripRaw) : fallback;
} catch (err) {
  trip = fallback;
}

const riderName = document.documentElement.lang === 'ar'
  ? (trip.rider?.name || fallback.rider.name)
  : (trip.rider?.nameEn || trip.rider?.name || fallback.rider.nameEn);

qs('#recap-rider').textContent = riderName || '—';
qs('#recap-plate').textContent = trip.plate || fallback.plate;
qs('#recap-vehicle').textContent = trip.vehicle || fallback.vehicle;
qs('#recap-location').textContent = '30.0444°N, 31.2357°E';

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      qs('#recap-location').textContent =
        `${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`;
    },
    () => {},
    { timeout: 5000 }
  );
}

// ── Render the emergency contacts that were alerted (Phase 1 SOS) ──
function renderNotifiedContacts() {
  const list = qs('#notified-contacts');
  const emptyMsg = qs('#no-contacts-msg');
  if (!list) return;
  const contacts = getEmergencyContacts();
  list.innerHTML = '';
  if (!contacts.length) {
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }
  if (emptyMsg) emptyMsg.hidden = true;
  contacts.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'emergency-contact-notified';
    li.dataset.contactId = c.id || '';

    const info = document.createElement('span');
    info.className = 'emergency-contact-notified__info';
    const name = document.createElement('span');
    name.className = 'emergency-contact-notified__name';
    name.textContent = c.name || '';
    const meta = document.createElement('span');
    meta.className = 'emergency-contact-notified__meta';
    // The stored relationship is a key (or legacy free text) — show its label.
    meta.textContent = [relationshipLabel(c), c.phone].filter(Boolean).join(' · ');
    info.append(name, meta);

    // Delivery starts as "sending" and settles once the SMS gateway reports back.
    // No gateway exists yet (#1952) — settleDeliveryStatuses() below simulates it.
    const status = document.createElement('span');
    status.className = 'emergency-contact-notified__status is-sending';
    // The key rides on the element: applyTranslations() re-renders it on a
    // language switch, which plain textContent would not survive.
    status.setAttribute('data-i18n', 'emergency.deliverySending');
    status.textContent = translate('emergency.deliverySending');

    li.append(info, status);
    list.appendChild(li);
  });
}
renderNotifiedContacts();

// The relationship label follows a language switch; delivery statuses keep their state.
document.addEventListener(I18N_EVENT, () => {
  const contacts = getEmergencyContacts();
  qsa('.emergency-contact-notified').forEach((li) => {
    const c = contacts.find((x) => (x.id || '') === li.dataset.contactId);
    const meta = li.querySelector('.emergency-contact-notified__meta');
    if (c && meta) meta.textContent = [relationshipLabel(c), c.phone].filter(Boolean).join(' · ');
  });
});

// ── Delivery status simulation (no SMS gateway yet — #1952) ──
// Each contact settles from "sending" to "delivered", except the last of two-or-more
// contacts, which settles to "failed" so the failure state is demonstrable.
function settleDeliveryStatuses() {
  const statuses = qsa('.emergency-contact-notified__status');
  statuses.forEach((el, i) => {
    const willFail = statuses.length > 1 && i === statuses.length - 1;
    setTimeout(() => {
      el.classList.remove('is-sending');
      if (willFail) {
        el.classList.add('is-failed');
        el.setAttribute('data-i18n', 'emergency.deliveryFailed');
        el.textContent = translate('emergency.deliveryFailed');
      } else {
        el.classList.add('is-delivered');
        el.setAttribute('data-i18n', 'emergency.deliveryDelivered');
        el.textContent = translate('emergency.deliveryDelivered');
      }
    }, 1200 + i * 400);
  });
}
settleDeliveryStatuses();

// ── Timeline: activate the "sharing live location" step shortly after ──
setTimeout(() => {
  const step = qs('[data-step="2"]');
  if (step) {
    step.classList.remove('emergency-step--pending');
    step.classList.add('emergency-step--active');
  }
}, 1500);

// ── Mock call buttons (public services: police / ambulance) ──
qsa('.emergency-call').forEach((btn) => {
  btn.addEventListener('click', () => {
    const labelKey = btn.dataset.callLabel;
    showToast(translate('emergency.calling', { target: translate(labelKey) }), 'info');
  });
});

// ── Stop sharing (revokes the live location link immediately; the alert itself
// stays active). Confirmed first on a sheet — Figma "Stop Live Sharing". ──
const stopBackdrop = qs('#stop-sharing-backdrop');
const stopBtn = qs('#stop-sharing-btn');

function openStopSheet() {
  if (!stopBackdrop || stopBtn?.disabled) return;
  stopBackdrop.hidden = false;
  stopBackdrop.removeAttribute('aria-hidden');
  void stopBackdrop.offsetHeight; // flush [hidden] so the slide-up transition runs
  stopBackdrop.classList.add('is-open');
  qs('#stop-sharing-keep')?.focus();
}
function closeStopSheet() {
  if (!stopBackdrop) return;
  stopBackdrop.classList.remove('is-open');
  stopBackdrop.hidden = true;
  stopBackdrop.setAttribute('aria-hidden', 'true');
}

function stopSharing() {
  if (stopBtn) stopBtn.disabled = true;
  const step2 = qs('[data-step="2"]');
  if (step2) {
    step2.classList.remove('emergency-step--active', 'emergency-step--pending');
    step2.classList.add('emergency-step--done');
    const text = step2.querySelector('.emergency-step__text');
    if (text) {
      text.setAttribute('data-i18n', 'emergency.sharingStopped');
      text.textContent = translate('emergency.sharingStopped');
    }
  }
  showToast(translate('emergency.sharingStopped'), 'success');
}

stopBtn?.addEventListener('click', openStopSheet);
qs('#stop-sharing-keep')?.addEventListener('click', closeStopSheet);
qs('#stop-sharing-confirm')?.addEventListener('click', () => {
  closeStopSheet();
  stopSharing();
});
stopBackdrop?.addEventListener('click', (e) => { if (e.target === stopBackdrop) closeStopSheet(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stopBackdrop && !stopBackdrop.hidden) closeStopSheet();
});

// Design preview: ?sheet=stop opens the confirmation straight away.
if (new URLSearchParams(location.search).get('sheet') === 'stop') openStopSheet();

// ── Navigation ──
// The header arrow is a data-back control (shared/scripts/navigation.js). Going back
// through history returns her to the live trip as she left it, without stacking a
// second copy of it that the system back button would then land on.
qs('#return-btn').addEventListener('click', () => goBack('./trip.html'));

// ── Cancel alert — false alarm stand-down ──
qs('#cancel-btn').addEventListener('click', () => {
  showToast(translate('emergency.cancelToast'), 'success');
  setTimeout(() => goBack('./trip.html'), 800);
});

// ── Toast helper ──
function showToast(msg, type = 'info') {
  const host = document.querySelector('sd-toast-host') || qs('#toast-container');
  if (host?.showToast) { host.showToast(msg, type); return; }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  (qs('#toast-container') || document.body).appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
