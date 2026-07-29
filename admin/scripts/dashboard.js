/**
 * dashboard.js — SheDrive admin operations dashboard controller
 * #1669 five live metric cards refreshed every 30 s with a last-refreshed
 * stamp, plus the live operations map (#1823) with clustering (#1824), marker
 * popovers linking to trip detail (#1825) and the layer filter (#1826).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi, stateOverride } from './mock-api.js';
import { formatCount, formatEgp, formatElapsed, formatTime, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const METRIC_REFRESH_MS = 30_000;
const MAP_REFRESH_MS = 5_000;

const cards = {
  activeTrips: qs('#metric-active-trips'),
  onlineDrivers: qs('#metric-online-drivers'),
  tripsToday: qs('#metric-trips-today'),
  registeredRiders: qs('#metric-riders'),
  approvedDrivers: qs('#metric-drivers'),
};

const metricsStatus = qs('#metrics-status');
const metricsError = qs('#metrics-error');
const mapStatus = qs('#map-status');
const mapPanel = qs('#ops-map');
const layerFilter = qs('#layer-filter');

// ── Metric cards (#1669) ──────────────────────────────

async function refreshMetrics() {
  try {
    const metrics = await mockApi.getDashboardMetrics();
    const stamp = `Updated ${formatTime(metrics.refreshedAt)}`;

    Object.entries(cards).forEach(([key, card]) => {
      card.value = formatCount(metrics[key]);
      card.meta = stamp;
    });

    metricsStatus.textContent = `Live — refreshes every 30 seconds. ${stamp}`;
    metricsError.classList.remove('is-visible');
  } catch (error) {
    metricsError.textContent = `Could not load metrics: ${error.message}`;
    metricsError.classList.add('is-visible');
    metricsStatus.textContent = 'Metrics unavailable';
    Object.values(cards).forEach((card) => {
      card.value = '—';
      card.meta = '';
    });
  }
}

// ── Live operations map (#1823–#1826) ─────────────────

function buildPopover(marker) {
  if (marker.kind === 'ride-request') {
    return {
      title: 'Ride request',
      rows: [
        ['Rider', marker.riderName],
        ['Pickup', marker.pickup],
        ['Destination', marker.destination],
        ['Estimated fare', formatEgp(marker.estimatedFare)],
        ['Waiting', formatElapsed(marker.requestedAt)],
      ],
    };
  }

  const vehicle = marker.vehicle
    ? `${marker.vehicle.make} ${marker.vehicle.model} · ${marker.vehicle.plate}`
    : '—';

  // #1825 Scenario 1 — an idle driver shows name and vehicle only.
  if (!marker.trip) {
    return {
      title: marker.name,
      rows: [
        ['Status', 'Online — idle'],
        ['Vehicle', vehicle],
      ],
    };
  }

  // #1825 Scenario 2 — a driver on a trip also shows the trip, with a link.
  return {
    title: marker.name,
    rows: [
      ['Status', humanize(marker.trip.status)],
      ['Vehicle', vehicle],
      ['Trip', marker.trip.id],
      ['Rider', marker.trip.riderName],
      ['Pickup', marker.trip.pickup],
      ['Destination', marker.trip.destination],
    ],
    link: { href: `trip-detail.html?id=${marker.trip.id}`, label: 'Open trip detail →' },
  };
}

async function refreshMap() {
  try {
    const { markers, refreshedAt } = await mockApi.getLiveMapData({
      layer: layerFilter.value,
    });

    mapPanel.setMarkers(markers.map((marker) => ({ ...marker, popover: buildPopover(marker) })));

    // #1823 Scenario 4 — idle state when there is nothing to plot.
    const isEmpty = markers.length === 0;
    mapPanel.setEmpty(
      isEmpty,
      layerFilter.value === 'requests'
        ? 'No ride requests waiting for a driver right now.'
        : layerFilter.value === 'drivers'
          ? 'No drivers are online right now.'
          : 'No drivers online and no active trips right now.',
    );

    const driverCount = markers.filter((m) => m.kind.startsWith('driver')).length;
    const requestCount = markers.filter((m) => m.kind === 'ride-request').length;
    mapStatus.textContent =
      `Cairo / Giza · ${driverCount} driver${driverCount === 1 ? '' : 's'}, ` +
      `${requestCount} request${requestCount === 1 ? '' : 's'} · updated ${formatTime(refreshedAt)}`;
  } catch (error) {
    mapPanel.setEmpty(true, `Could not load map data: ${error.message}`);
    mapStatus.textContent = 'Map data unavailable';
  }
}

// ── Boot ──────────────────────────────────────────────

mapPanel.addLegend([
  { kind: 'idle', label: 'Driver — idle' },
  { kind: 'on-trip', label: 'Driver — on trip' },
  { kind: 'request', label: 'Ride request' },
]);

layerFilter.addEventListener('change', () => {
  // #1826 Scenario 1–3 — the selection persists across the periodic refresh
  // because every refresh reads the current filter value.
  refreshMap();
});

// The metric cards must never wait on the map: if WebGL is unavailable or the
// tiles are slow, #1669 still has to render.
refreshMetrics();

// ?state=loading intentionally leaves the screen mid-load, so skip the timers.
if (stateOverride() !== 'loading') {
  window.setInterval(refreshMetrics, METRIC_REFRESH_MS);
}

const map = await mapPanel.mount({ zoom: 10.4 });

if (map) {
  refreshMap();
  if (stateOverride() !== 'loading') {
    window.setInterval(refreshMap, MAP_REFRESH_MS);
  }
} else {
  mapStatus.textContent = 'Map unavailable — metrics above are unaffected';
}
