/**
 * trip-detail.js — Driver past trip detail screen controller
 * Auth guard + i18n + static non-interactive map.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { MapService } from '../../shared/scripts/map.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Static route map (non-interactive thumbnail) ──────
const map = MapService.init('map', { zoom: 12, center: [31.2357, 30.0444] });

if (map) {
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.dragRotate.disable();
  map.dragPan.disable();
  map.keyboard.disable();
  map.doubleClickZoom.disable();
  map.touchZoomRotate.disable();

  const routeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary-600').trim() || '#6b2bd9';

  map.on('load', () => {
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [31.2357, 30.0444],
            [31.238,  30.047],
            [31.242,  30.051],
            [31.2457, 30.0544],
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

    const pickupEl = document.createElement('div');
    pickupEl.className = 'map-user-dot';
    new mapboxgl.Marker({ element: pickupEl }).setLngLat([31.2357, 30.0444]).addTo(map);
    new mapboxgl.Marker({ color: '#d63ae2' }).setLngLat([31.2457, 30.0544]).addTo(map);
  });
}
