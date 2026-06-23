import { auth } from '../../shared/scripts/auth.js';
import { initI18n } from '../../shared/scripts/i18n.js';
import { qs, sleep } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

// Load fare total from active trip
const raw = sessionStorage.getItem('shedrive.activeTrip');
const trip = raw ? JSON.parse(raw) : null;
const totalEl = qs('#pay-total');
if (totalEl && trip?.trip?.fare) totalEl.textContent = trip.trip.fare;

// State management
function showState(stateName) {
  ['form', 'success', 'declined', 'network-error'].forEach((s) => {
    const el = qs(`#state-${s}`);
    if (el) el.hidden = s !== stateName;
  });
}

// Apply URL state for designer previews
const urlState = new URLSearchParams(location.search).get('state');
if (urlState && ['success', 'declined', 'network-error'].includes(urlState)) {
  showState(urlState);
} else {
  showState('form');
}

// Pay button: 1.5s loading → success
const payBtn = qs('#pay-submit-btn');
payBtn?.addEventListener('click', async () => {
  if (payBtn.disabled) return;
  payBtn.disabled = true;
  payBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  await sleep(1500);
  showState('success');
});

// Retry buttons
qs('#retry-declined-btn')?.addEventListener('click', () => showState('form'));
qs('#retry-network-btn')?.addEventListener('click', () => showState('form'));
