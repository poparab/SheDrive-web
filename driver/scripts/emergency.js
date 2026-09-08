/**
 * emergency.js — Driver SOS alert screen controller (Phase 1 SOS)
 * Mirrors rider/scripts/emergency.js: who was alerted, per-contact delivery
 * status, live-location sharing, public emergency numbers, and a stand-down.
 * (#1951 / #1952)
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { getEmergencyContacts } from '../../shared/scripts/emergency-contacts.js';

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

    const info = document.createElement('span');
    info.className = 'emergency-contact-notified__info';
    const name = document.createElement('span');
    name.className = 'emergency-contact-notified__name';
    name.textContent = c.name || '';
    const meta = document.createElement('span');
    meta.className = 'emergency-contact-notified__meta';
    meta.textContent = [c.relationship, c.phone].filter(Boolean).join(' · ');
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
// stays active) ──
qs('#stop-sharing-btn')?.addEventListener('click', (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
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
});

// ── Navigation ──
qs('#return-btn').addEventListener('click', () => window.location.assign('./trip.html'));
qs('#back-btn')?.addEventListener('click', () => window.location.assign('./trip.html'));

// ── Cancel alert — false alarm stand-down ──
qs('#cancel-btn').addEventListener('click', () => {
  showToast(translate('emergency.cancelToast'), 'success');
  setTimeout(() => window.location.assign('./trip.html'), 800);
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
