/**
 * trip-detail.js — Past trip detail screen controller
 * Auth guard + i18n + static map + per-trip data (handed off from history.js via
 * sessionStorage) + interactive rating for trips the rider skipped rating (#1568).
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';
import { qs } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Load the trip selected from history.js (falls back to a demo record for direct nav) ──
const FALLBACK_TRIP = {
  id: 't1',
  date: 'الإثنين، ٢ يونيو ٢٠٢٦ — ٠٩:٣٤ ص',
  pickup: 'المعادي، القاهرة — شارع ٩',
  destination: 'مدينة نصر — سيتي ستارز',
  driverName: 'نورا أحمد',
  avatar: 'ن',
  vehicle: 'تويوتا كورولا 2023 — أبيض',
  fare: 55,
  baseFare: 5,
  distanceFare: 32,
  timeFare: 18,
  distanceKm: 8.2,
  durationMin: 18,
  rating: { stars: 5, tags: ['complete.tagSafe', 'complete.tagClean'] },
};

const raw = sessionStorage.getItem('shedrive.selectedTrip');
const trip = raw ? JSON.parse(raw) : FALLBACK_TRIP;

// ── Populate trip fields ──────────────────────────────
const setText = (id, value) => { const el = qs(`#${id}`); if (el) el.textContent = value; };

setText('detail-datetime', trip.date ?? '—');
setText('detail-pickup', trip.pickup ?? '—');
setText('detail-destination', trip.destination ?? '—');
setText('detail-ref-id', `#SDR-${trip.id ?? '0000'}`);

const distanceEl = qs('#detail-distance');
if (distanceEl) distanceEl.innerHTML = `${trip.distanceKm ?? '—'} <span data-i18n="complete.km">${translate('complete.km')}</span>`;
const durationEl = qs('#detail-duration');
if (durationEl) durationEl.innerHTML = `${trip.durationMin ?? '—'} <span data-i18n="complete.minutes">${translate('complete.minutes')}</span>`;

const driverNameEl = qs('#detail-driver-name');
if (driverNameEl) driverNameEl.textContent = trip.driverName ?? '—';
const driverVehicleEl = qs('#detail-driver-vehicle');
if (driverVehicleEl) driverVehicleEl.textContent = trip.vehicle ?? '—';
const driverAvatarEl = qs('.trip-detail-driver .driver-card__avatar');
if (driverAvatarEl && trip.avatar) driverAvatarEl.textContent = trip.avatar;

setText('detail-fare-base', `${trip.baseFare ?? '—'} ج.م.`);
setText('detail-fare-distance', `${trip.distanceFare ?? '—'} ج.م.`);
setText('detail-fare-duration', `${trip.timeFare ?? '—'} ج.م.`);
setText('detail-fare-total', `${trip.fare ?? '—'} ج.م.`);

// ── Rating display vs. interactive rate section (#1568) ──
function renderStaticStars(container, stars) {
  if (!container) return;
  container.innerHTML = '';
  container.setAttribute('aria-label', translate(`complete.star${Math.max(1, Math.min(5, stars))}Aria`));
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.className = `trip-detail-star${i <= stars ? ' trip-detail-star--filled' : ''}`;
    span.setAttribute('aria-hidden', 'true');
    span.textContent = '★';
    container.appendChild(span);
  }
}

if (trip.rating) {
  document.body.dataset.state = 'rated';
  renderStaticStars(qs('#detail-rating-stars'), trip.rating.stars);
  const tagsEl = qs('#detail-rating-tags');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    (trip.rating.tags || []).forEach((tagKey) => {
      const span = document.createElement('span');
      span.className = 'tag-chip tag-chip--selected';
      span.setAttribute('data-i18n', tagKey);
      span.textContent = translate(tagKey);
      tagsEl.appendChild(span);
    });
  }
} else {
  document.body.dataset.state = 'unrated';
}

let detailRating = 0;
const detailStars   = qs('#detail-stars');
const detailRateBtn = qs('#detail-rate-btn');
const detailError   = qs('#detail-stars-error');
const rateSection   = qs('#rate-section');
const ratedMsg      = qs('#rating-submitted-msg');

detailStars?.addEventListener('change', (e) => {
  detailRating = e.detail?.value ?? 0;
  if (detailError) detailError.hidden = true;
});

detailRateBtn?.addEventListener('click', () => {
  if (detailRating === 0) {
    if (detailError) detailError.hidden = false;
    return;
  }
  if (rateSection) rateSection.hidden = true;
  if (ratedMsg) ratedMsg.hidden = false;

  // Persist so returning to this trip later shows it as rated (mock only — no backend).
  trip.rating = { stars: detailRating, tags: [] };
  sessionStorage.setItem('shedrive.selectedTrip', JSON.stringify(trip));
});

// ── Static route map — non-interactive thumbnail ──────
const map = MapService.init('map', { zoom: 12, center: [31.2357, 30.0444] });

if (map) {
  // Disable all interactions so the map is purely decorative/static
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.dragRotate.disable();
  map.dragPan.disable();
  map.keyboard.disable();
  map.doubleClickZoom.disable();
  map.touchZoomRotate.disable();

  const rootStyles = getComputedStyle(document.documentElement);
  const routeColor = rootStyles.getPropertyValue('--color-primary-600').trim() || '#6b2bd9';

  map.on('load', () => {
    // Static route polyline
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [31.2357, 30.0444], // pickup
            [31.238,  30.047],
            [31.242,  30.051],
            [31.2457, 30.0544], // destination
          ],
        },
      },
    });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': routeColor, 'line-width': 4, 'line-opacity': 0.85 },
    });

    // Pickup marker (green)
    const pickupEl = document.createElement('div');
    pickupEl.className = 'map-user-dot';
    new mapboxgl.Marker({ element: pickupEl }).setLngLat([31.2357, 30.0444]).addTo(map);

    // Destination marker (brand)
    new mapboxgl.Marker({ color: '#d63ae2' }).setLngLat([31.2457, 30.0544]).addTo(map);
  });
}
