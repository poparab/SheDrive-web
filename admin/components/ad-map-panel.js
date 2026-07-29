/**
 * ad-map-panel.js — SheDrive admin map surface
 * One component for all three admin map needs:
 *   • live operations map with clustering and marker popovers (#1823–#1826)
 *   • service-zone polygons, plus draw-a-boundary mode (#1756, #1830, #1831)
 *   • a completed trip's recorded route (#1672)
 *
 * Built on Mapbox GL JS through the shared MapService for token handling.
 * Markers use GeoJSON circle layers rather than DOM markers so Mapbox's native
 * clustering does the work — updating a source leaves the camera untouched,
 * which is what #1823 Scenario 5 (viewport preserved on refresh) requires.
 *
 * NOTE: stories #1823–#1826, #1756 and #1831 name the Google Maps JavaScript
 * API. This mockup uses Mapbox because it is already wired into the repo. The
 * discrepancy is tracked in docs/ux/admin-wireframes.md.
 *
 * Usage:
 *   await panel.mount({ tall: true });
 *   panel.setMarkers(markers);
 *   panel.setPolygons(zones);
 *   panel.setRoute(coords);
 *   panel.setEmpty(true, 'No drivers online and no active trips.');
 *   panel.startDraw(); const polygon = panel.finishDraw();
 *
 * Children with data-slot="toolbar" render in the toolbar row.
 * Emits 'markerclick' (bubbles) → detail { marker }.
 */

import { MapService } from '../../shared/scripts/map.js';
import { DEFAULT_MAP_CENTER } from '../../shared/scripts/config.js';

const MOUNT_TIMEOUT_MS = 8000;
const MARKER_SOURCE = 'ad-markers';
const ZONE_SOURCE = 'ad-zones';
const ROUTE_SOURCE = 'ad-route';
const DRAW_SOURCE = 'ad-draw';

let instanceCount = 0;

/** True when any two non-adjacent edges of the ring cross (#1756 validation). */
export function selfIntersects(ring) {
  const points = ring.length > 2 && samePoint(ring[0], ring[ring.length - 1])
    ? ring.slice(0, -1)
    : ring;
  const n = points.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      // Skip shared-vertex neighbours, including the closing edge pair.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (
        segmentsIntersect(
          points[i], points[(i + 1) % n],
          points[j], points[(j + 1) % n],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function orientation(p, q, r) {
  const value = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  return o1 !== o2 && o3 !== o4;
}

/**
 * Mapbox paint properties cannot read CSS custom properties, so the design
 * tokens are resolved to concrete values at layer-creation time. This keeps
 * tokens.css the single source of truth instead of hardcoding hex here.
 */
function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function palette() {
  return {
    brand: token('--color-primary-600', '#6b2bd9'),
    brandLight: token('--color-primary-500', '#8b5cf6'),
    accent: token('--color-accent-500', '#d63ae2'),
    info: token('--color-info', '#3b82f6'),
    success: token('--color-success', '#10b981'),
    danger: token('--color-danger', '#ef4444'),
    muted: token('--color-text-muted', '#6b6580'),
    text: token('--color-text', '#1a1530'),
    surface: token('--color-surface', '#ffffff'),
  };
}

class AdMapPanel extends HTMLElement {
  connectedCallback() {
    if (!this._built) this.build();
  }

  build() {
    instanceCount += 1;
    this._canvasId = `ad-map-canvas-${instanceCount}`;

    const passthrough = Array.from(this.childNodes);

    this.classList.add('ad-map');

    this._toolbar = document.createElement('div');
    this._toolbar.className = 'ad-map__toolbar';

    // Mapbox requires its container to be empty, so the overlay is a sibling
    // of the canvas inside a positioned frame rather than a child of it.
    this._frame = document.createElement('div');
    this._frame.className = 'ad-map__frame';

    this._canvas = document.createElement('div');
    this._canvas.className = 'ad-map__canvas';
    this._canvas.id = this._canvasId;

    this._overlay = document.createElement('div');
    this._overlay.className = 'ad-map__overlay';
    this._overlayText = document.createElement('p');
    this._overlayText.className = 'ad-state__message';
    this._overlay.appendChild(this._overlayText);

    this._frame.append(this._canvas, this._overlay);

    this.textContent = '';
    this.append(this._toolbar, this._frame);

    passthrough.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.slot === 'toolbar') {
        this._toolbar.appendChild(node);
      }
    });
    this._toolbar.hidden = this._toolbar.childNodes.length === 0;

    this._markers = [];
    this._drawPoints = [];
    this._drawing = false;
    this._built = true;
  }

  /** Add a legend for the live-operations marker kinds. */
  addLegend(items) {
    const legend = document.createElement('div');
    legend.className = 'ad-map__legend';
    items.forEach((item) => {
      const wrap = document.createElement('span');
      wrap.className = 'ad-map__legend-item';
      const swatch = document.createElement('span');
      swatch.className = `ad-map__swatch ad-map__swatch--${item.kind}`;
      wrap.append(swatch, document.createTextNode(item.label));
      legend.appendChild(wrap);
    });
    this._toolbar.appendChild(legend);
    this._toolbar.hidden = false;
    return legend;
  }

  get toolbar() {
    return this._toolbar;
  }

  /**
   * Initialise the Mapbox map.
   * @returns {Promise<mapboxgl.Map|null>} null when Mapbox or the token is missing
   */
  mount({ center = DEFAULT_MAP_CENTER, zoom = 10.5, tall = false } = {}) {
    if (!this._built) this.build();
    if (tall) this._canvas.classList.add('ad-map__canvas--tall');

    if (typeof mapboxgl === 'undefined') {
      this.setEmpty(true, 'Map library did not load. Check the Mapbox script tag on this page.');
      return Promise.resolve(null);
    }

    // Headless browsers and locked-down machines have no WebGL. Fail visibly
    // and immediately rather than leaving callers awaiting a load that never
    // comes — a screen must never be blocked on its map.
    if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) {
      this.setEmpty(true, 'This browser cannot display the map (WebGL unavailable).');
      return Promise.resolve(null);
    }

    this._map = MapService.init(this._canvasId, { center, zoom });

    if (!this._map) {
      this.setEmpty(
        true,
        'Map could not start — no Mapbox token available. Set localStorage "shedrive.mapboxToken" and reload.',
      );
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      let settled = false;

      const ready = () => {
        if (this._ready) return;
        this.initLayers();
        this._ready = true;
        // Replay anything set before the map finished loading.
        if (this._pendingMarkers) this.setMarkers(this._pendingMarkers);
        if (this._pendingPolygons) this.setPolygons(this._pendingPolygons);
        if (this._pendingRoute) this.setRoute(this._pendingRoute);
      };

      this._map.on('load', () => {
        ready();
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(this._map);
        }
      });

      this._map.on('error', (event) => {
        console.warn('[ad-map-panel] Mapbox error:', event?.error?.message ?? event);
      });

      // Never hang a caller on tiles that are not coming.
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        this.setEmpty(true, 'Map tiles did not load. Check the network connection and Mapbox token.');
        resolve(null);
      }, MOUNT_TIMEOUT_MS);
    });
  }

  get map() {
    return this._map ?? null;
  }

  initLayers() {
    const map = this._map;
    const colour = palette();

    // ── Zones (drawn beneath markers) ──
    map.addSource(ZONE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'ad-zone-fill',
      type: 'fill',
      source: ZONE_SOURCE,
      paint: {
        'fill-color': ['match', ['get', 'status'], 'active', colour.brandLight, colour.muted],
        'fill-opacity': ['match', ['get', 'status'], 'active', 0.28, 0.14],
      },
    });
    map.addLayer({
      id: 'ad-zone-line',
      type: 'line',
      source: ZONE_SOURCE,
      paint: {
        'line-color': ['match', ['get', 'status'], 'active', colour.brand, colour.muted],
        'line-width': 2,
        'line-dasharray': ['match', ['get', 'status'], 'active', ['literal', [1]], ['literal', [2, 2]]],
      },
    });
    map.addLayer({
      id: 'ad-zone-label',
      type: 'symbol',
      source: ZONE_SOURCE,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': colour.text,
        'text-halo-color': colour.surface,
        'text-halo-width': 1.5,
      },
    });

    // ── Route (completed trip) ──
    map.addSource(ROUTE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'ad-route-line',
      type: 'line',
      source: ROUTE_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colour.brand, 'line-width': 4, 'line-opacity': 0.85 },
    });
    map.addLayer({
      id: 'ad-route-points',
      type: 'circle',
      source: ROUTE_SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 7,
        'circle-color': ['match', ['get', 'role'], 'pickup', colour.success, colour.danger],
        'circle-stroke-width': 2,
        'circle-stroke-color': colour.surface,
      },
    });

    // ── Markers with native clustering (#1824) ──
    map.addSource(MARKER_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 48,
      clusterMaxZoom: 14,
    });
    map.addLayer({
      id: 'ad-cluster',
      type: 'circle',
      source: MARKER_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': colour.brand,
        'circle-opacity': 0.9,
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
        'circle-stroke-width': 2,
        'circle-stroke-color': colour.surface,
      },
    });
    map.addLayer({
      id: 'ad-cluster-count',
      type: 'symbol',
      source: MARKER_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': colour.surface },
    });
    map.addLayer({
      id: 'ad-marker',
      type: 'circle',
      source: MARKER_SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 8,
        // #1823 Scenario 3 — each marker kind must be visually distinct.
        'circle-color': [
          'match',
          ['get', 'kind'],
          'driver-idle', colour.info,
          'driver-on-trip', colour.success,
          'ride-request', colour.accent,
          colour.brand,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': colour.surface,
      },
    });

    // ── Boundary draw preview ──
    map.addSource(DRAW_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'ad-draw-fill',
      type: 'fill',
      source: DRAW_SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': colour.accent, 'fill-opacity': 0.2 },
    });
    map.addLayer({
      id: 'ad-draw-line',
      type: 'line',
      source: DRAW_SOURCE,
      filter: ['!=', ['geometry-type'], 'Point'],
      paint: { 'line-color': colour.accent, 'line-width': 2 },
    });
    map.addLayer({
      id: 'ad-draw-vertex',
      type: 'circle',
      source: DRAW_SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': colour.surface,
        'circle-stroke-width': 2,
        'circle-stroke-color': colour.accent,
      },
    });

    // ── Interactions ──
    map.on('click', 'ad-cluster', (event) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: ['ad-cluster'] })[0];
      map.getSource(MARKER_SOURCE).getClusterExpansionZoom(
        feature.properties.cluster_id,
        (err, expansionZoom) => {
          if (err) return;
          map.easeTo({ center: feature.geometry.coordinates, zoom: expansionZoom });
        },
      );
    });

    map.on('click', 'ad-marker', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const marker = this._markers.find((m) => String(m.id) === String(feature.properties.id));
      if (!marker) return;
      this.showPopover(feature.geometry.coordinates, marker);
      this.dispatchEvent(new CustomEvent('markerclick', { bubbles: true, detail: { marker } }));
    });

    ['ad-marker', 'ad-cluster'].forEach((layer) => {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    map.on('click', (event) => {
      if (!this._drawing) return;
      this._drawPoints.push([
        Number(event.lngLat.lng.toFixed(6)),
        Number(event.lngLat.lat.toFixed(6)),
      ]);
      this.renderDraw();
      this._onDrawChange?.(this._drawPoints.length);
    });
  }

  /** #1825: click a marker to see a summary, with a link through to trip detail. */
  showPopover(coordinates, marker) {
    this._popup?.remove();

    const content = document.createElement('div');
    content.className = 'ad-popover';

    const title = document.createElement('p');
    title.className = 'ad-popover__title';
    title.textContent = marker.popover?.title ?? marker.name ?? marker.id;
    content.appendChild(title);

    (marker.popover?.rows ?? []).forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'ad-popover__row';
      const key = document.createElement('span');
      key.textContent = label;
      const val = document.createElement('span');
      val.textContent = value ?? '—';
      row.append(key, val);
      content.appendChild(row);
    });

    if (marker.popover?.link) {
      const link = document.createElement('a');
      link.className = 'ad-popover__link';
      link.href = marker.popover.link.href;
      link.textContent = marker.popover.link.label;
      content.appendChild(link);
    }

    this._popup = new mapboxgl.Popup({ offset: 14, closeButton: true, maxWidth: '20rem' })
      .setLngLat(coordinates)
      .setDOMContent(content)
      .addTo(this._map);
  }

  /** @param {Array<{id:string,kind:string,position:[number,number],popover?:object}>} markers */
  setMarkers(markers) {
    this._markers = markers ?? [];
    if (!this._ready) {
      this._pendingMarkers = this._markers;
      return;
    }
    this._map.getSource(MARKER_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: this._markers
        .filter((marker) => Array.isArray(marker.position))
        .map((marker) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: marker.position },
          properties: { id: String(marker.id), kind: marker.kind },
        })),
    });
  }

  /** @param {Array<{id:string,name:string,status:string,polygon:Array}>} zones */
  setPolygons(zones) {
    if (!this._ready) {
      this._pendingPolygons = zones;
      return;
    }
    this._map.getSource(ZONE_SOURCE)?.setData({
      type: 'FeatureCollection',
      features: (zones ?? []).map((zone) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [zone.polygon] },
        properties: { id: String(zone.id), name: zone.name, status: zone.status },
      })),
    });
  }

  /** @param {Array<[number,number]>} coordinates recorded GPS path */
  setRoute(coordinates) {
    if (!this._ready) {
      this._pendingRoute = coordinates;
      return;
    }
    const path = coordinates ?? [];
    const features = [];

    if (path.length > 1) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: path },
        properties: {},
      });
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: path[0] },
        properties: { role: 'pickup' },
      });
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: path[path.length - 1] },
        properties: { role: 'dropoff' },
      });
    }

    this._map.getSource(ROUTE_SOURCE)?.setData({ type: 'FeatureCollection', features });
    if (path.length > 1) this.fitTo(path);
  }

  /** Fit the camera to a set of coordinates. */
  fitTo(coordinates, padding = 48) {
    if (!this._map || !coordinates?.length) return;
    const bounds = coordinates.reduce(
      (acc, point) => acc.extend(point),
      new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
    );
    this._map.fitBounds(bounds, { padding, duration: 600, maxZoom: 15 });
  }

  setEmpty(isEmpty, message = '') {
    if (!this._built) this.build();
    this._overlayText.textContent = message;
    this._overlay.classList.toggle('is-visible', Boolean(isEmpty));
  }

  // ── Boundary draw mode (#1756, #1830) ─────────────

  startDraw(onChange) {
    this._drawing = true;
    this._drawPoints = [];
    this._onDrawChange = onChange;
    this.renderDraw();
    if (this._map) this._map.getCanvas().style.cursor = 'crosshair';
  }

  undoDrawPoint() {
    this._drawPoints.pop();
    this.renderDraw();
    this._onDrawChange?.(this._drawPoints.length);
  }

  cancelDraw() {
    this._drawing = false;
    this._drawPoints = [];
    this.renderDraw();
    if (this._map) this._map.getCanvas().style.cursor = '';
  }

  /**
   * Close and return the drawn ring.
   * @returns {{polygon: Array|null, error: string|null}}
   */
  finishDraw() {
    if (this._drawPoints.length < 3) {
      return { polygon: null, error: 'Draw the zone boundary on the map' };
    }
    if (selfIntersects(this._drawPoints)) {
      return { polygon: null, error: 'Boundary must not self-intersect' };
    }
    const ring = [...this._drawPoints, this._drawPoints[0]];
    this._drawing = false;
    if (this._map) this._map.getCanvas().style.cursor = '';
    return { polygon: ring, error: null };
  }

  /** Preload an existing boundary for editing. */
  loadDrawPolygon(ring) {
    const points = ring?.length && samePoint(ring[0], ring[ring.length - 1])
      ? ring.slice(0, -1)
      : (ring ?? []);
    this._drawPoints = [...points];
    this._drawing = true;
    this.renderDraw();
    if (this._map) this._map.getCanvas().style.cursor = 'crosshair';
  }

  renderDraw() {
    if (!this._ready) return;
    const features = this._drawPoints.map((point) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: point },
      properties: {},
    }));

    if (this._drawPoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...this._drawPoints, this._drawPoints[0]]] },
        properties: {},
      });
    } else if (this._drawPoints.length === 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: this._drawPoints },
        properties: {},
      });
    }

    this._map.getSource(DRAW_SOURCE)?.setData({ type: 'FeatureCollection', features });
  }
}

if (!customElements.get('ad-map-panel')) {
  customElements.define('ad-map-panel', AdMapPanel);
}
