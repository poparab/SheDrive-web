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
const activeTripRaw = sessionStorage.getItem('shedrive.activeTrip');
const fallback = {
  driver: { name: 'نورا أحمد', plate: 'ق أ ب 123', vehicle: 'تويوتا كورولا 2023' },
  trip: {},
};
let data = fallback;
try {
  data = activeTripRaw ? JSON.parse(activeTripRaw) : fallback;
} catch (err) {
  data = fallback;
}

qs('#recap-driver').textContent = data.driver?.name || '—';
qs('#recap-plate').textContent = data.driver?.plate || '—';
qs('#recap-vehicle').textContent = data.driver?.vehicle || '—';
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
    const name = document.createElement('span');
    name.className = 'emergency-contact-notified__name';
    name.textContent = c.name || '';
    const meta = document.createElement('span');
    meta.className = 'emergency-contact-notified__meta';
    meta.textContent = [c.relationship, c.phone].filter(Boolean).join(' · ');
    li.append(name, meta);
    list.appendChild(li);
  });
}
renderNotifiedContacts();

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

// ── Navigation ──
qs('#return-btn').addEventListener('click', () => window.location.assign('./active-trip.html'));
qs('#back-btn')?.addEventListener('click', () => window.location.assign('./active-trip.html'));

// ── Cancel alert ──
qs('#cancel-btn').addEventListener('click', () => {
  showToast(translate('emergency.cancelToast'), 'success');
  setTimeout(() => window.location.assign('./active-trip.html'), 800);
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
