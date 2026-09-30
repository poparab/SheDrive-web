import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, getLanguage, I18N_EVENT } from '../../shared/scripts/i18n.js';
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
const activeTripRaw = sessionStorage.getItem('shedrive.activeTrip');
const fallback = {
  driver: { name: 'نورا أحمد', nameEn: 'Nora Ahmed', plate: 'ق أ ب 123', vehicle: 'تويوتا كورولا 2023', vehicleEn: 'Toyota Corolla 2023' },
  trip: {},
};
let data = fallback;
try {
  data = activeTripRaw ? JSON.parse(activeTripRaw) : fallback;
} catch (err) {
  data = fallback;
}

// Driver name and vehicle follow the active language when the trip carries both.
function renderRecap() {
  const en = getLanguage() === 'en';
  const d = data.driver || {};
  qs('#recap-driver').textContent = (en && d.nameEn) || d.name || '—';
  qs('#recap-plate').textContent = d.plate || '—';
  qs('#recap-vehicle').textContent = (en && d.vehicleEn) || d.vehicle || '—';
}
renderRecap();
document.addEventListener(I18N_EVENT, renderRecap);
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
function contactMeta(c) {
  return [relationshipLabel(c), c.phone].filter(Boolean).join(' · ');
}

// Keep the relationship label in step with a language switch (statuses stay as they are).
document.addEventListener(I18N_EVENT, () => {
  const contacts = getEmergencyContacts();
  qsa('.emergency-contact-notified__meta').forEach((el) => {
    const c = contacts.find((x) => (x.id || '') === el.dataset.contactId);
    if (c) el.textContent = contactMeta(c);
  });
});

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
    // Relationship is stored as a key — show its label in the active language.
    meta.textContent = contactMeta(c);
    meta.dataset.contactId = c.id || '';
    info.append(name, meta);

    // Delivery starts as "sending" and settles once the SMS gateway reports back.
    // No gateway exists yet (#1780) — settleDeliveryStatuses() below simulates it.
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

// ── Delivery status simulation (no SMS gateway yet — #1780) ──
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

// ── Confirmation sheets (stop sharing, false alarm) ──
let lastFocus = null;

function openSheet(sheet) {
  if (!sheet) return;
  lastFocus = document.activeElement;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  sheet.querySelector('.emergency-dialog__actions .btn')?.focus({ preventScroll: true });
}

function closeSheet(sheet) {
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('is-open');
  sheet.hidden = true;
  lastFocus?.focus?.({ preventScroll: true });
}

qsa('.emergency-dialog').forEach((sheet) => {
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-dismiss]')) closeSheet(sheet);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') qsa('.emergency-dialog:not([hidden])').forEach(closeSheet);
});

// ── Stop sharing (revokes the live location link immediately; the alert itself
// stays active) — #3968 S8 ──
function stopSharing() {
  const btn = qs('#stop-sharing-btn');
  if (btn) btn.disabled = true;
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
  // The hero no longer claims her location is being shared.
  const alertBody = qs('#alert-body');
  if (alertBody) {
    alertBody.setAttribute('data-i18n', 'emergency.sharingStopped');
    alertBody.textContent = translate('emergency.sharingStopped');
  }
  const live = qs('#live-status');
  const liveText = qs('#live-status-text');
  live?.classList.add('is-stopped');
  if (liveText) {
    liveText.setAttribute('data-i18n', 'emergency.liveStopped');
    liveText.textContent = translate('emergency.liveStopped');
  }
}

const stopDialog = qs('#stop-dialog');
qs('#stop-sharing-btn')?.addEventListener('click', () => openSheet(stopDialog));
qs('#stop-keep')?.addEventListener('click', () => closeSheet(stopDialog));
qs('#stop-confirm')?.addEventListener('click', () => {
  closeSheet(stopDialog);
  stopSharing();
  showToast(translate('emergency.sharingStopped'), 'success');
});

// ── Navigation ──
// The header arrow is a data-back control (shared/scripts/navigation.js). Going back
// through history returns her to the live trip as she left it, without stacking a
// second copy of it that the system back button would then land on.
qs('#return-btn').addEventListener('click', () => goBack('./active-trip.html'));

// ── Cancel alert: she confirms it was a false alarm; sharing stops (#3968 S10) ──
const alarmDialog = qs('#alarm-dialog');
qs('#cancel-btn').addEventListener('click', () => openSheet(alarmDialog));
qs('#alarm-keep')?.addEventListener('click', () => closeSheet(alarmDialog));
qs('#alarm-confirm')?.addEventListener('click', () => {
  closeSheet(alarmDialog);
  stopSharing();
  showToast(translate('emergency.cancelToast'), 'success');
  setTimeout(() => goBack('./active-trip.html'), 800);
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
