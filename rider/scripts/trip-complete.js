/**
 * trip-complete.js — Post-trip rating screen
 * SheDrive rider app · ES module
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

// ── Auth guard ──
auth.requireAuth();

// ── i18n init ──
await initI18n();

// ── Language switcher ──
qsa('[data-lang-btn]').forEach(btn =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Load trip data from sessionStorage ──
const raw = sessionStorage.getItem('shedrive.activeTrip');
const data = raw
  ? JSON.parse(raw)
  : {
      driver: { name: 'نورا أحمد' },
      trip: { pickup: 'موقعي الحالي', destination: 'مدينة نصر' },
    };

qs('#driver-name').textContent = data.driver?.name || '—';
qs('#trip-pickup').textContent = data.trip?.pickup || '—';
qs('#trip-destination').textContent = data.trip?.destination || '—';

// ── Star rating ──
let currentRating = 0;
const ratingStars = qs('#rating-stars');
const tagsSection = qs('#complete-tags');

ratingStars?.addEventListener('change', (event) => {
  currentRating = event.detail?.value ?? 0;

  if (currentRating >= 4) {
    tagsSection?.classList.add('is-visible');
    tagsSection?.removeAttribute('aria-hidden');
    return;
  }

  tagsSection?.classList.remove('is-visible');
  tagsSection?.setAttribute('aria-hidden', 'true');
});

// ── Tag chips (multi-select) ──
qsa('.tag-chip').forEach(chip =>
  chip.addEventListener('click', () => chip.classList.toggle('is-selected'))
);

// ── Tip chips (single-select) ──
const tipChips = qsa('.tip-chip');
tipChips[0]?.classList.add('is-selected'); // default: no tip
tipChips[0]?.setAttribute('aria-pressed', 'true');

tipChips.forEach(chip => {
  chip.addEventListener('click', () => {
    tipChips.forEach(c => {
      c.classList.remove('is-selected');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('is-selected');
    chip.setAttribute('aria-pressed', 'true');
  });
});

// ── Payment branch ────────────────────────────────────
const paymentMethod = localStorage.getItem('shedrive.paymentMethod');
const urlState = new URLSearchParams(location.search).get('state');
const isCard = paymentMethod === 'card' || urlState === 'card';
const cashNote = qs('#cash-note');
const payNowBtn = qs('#pay-now-btn');

if (cashNote) cashNote.hidden = isCard;
if (payNowBtn) payNowBtn.hidden = !isCard;

payNowBtn?.addEventListener('click', () => {
  window.location.assign('./payment.html');
});

// ── Submit: validate stars, send rating + navigate home ──
const starsError = qs('#stars-error');

qs('#submit-btn').addEventListener('click', () => {
  if (currentRating === 0) {
    if (starsError) starsError.hidden = false;
    qs('#rating-stars')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (starsError) starsError.hidden = true;
  sessionStorage.removeItem('shedrive.activeTrip');
  sessionStorage.setItem('shedrive.completedRating', '1');
  showToast(translate('complete.thanks'), 'success');
  setTimeout(() => window.location.replace('./home.html'), 800);
});

// ── Skip: navigate home without toast ──
qs('#skip-btn').addEventListener('click', () => {
  sessionStorage.removeItem('shedrive.activeTrip');
  window.location.replace('./home.html');
});

// ── Toast helper ──
function showToast(msg, type = 'info') {
  const container = qs('#toast-container');
  if (!container) return;

  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.25s ease';
    setTimeout(() => t.remove(), 300);
  }, 3700);
}
