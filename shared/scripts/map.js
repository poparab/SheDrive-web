/**
 * map.js — SheDrive MapService
 * Wraps Mapbox GL JS. Requires mapboxgl to be loaded from CDN before this module runs.
 * All map instances are managed here; pages import and call MapService.init().
 */

import {
  MAPBOX_TOKEN,
  MAPBOX_TOKEN_STORAGE_KEY,
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_MAP_STYLE,
} from './config.js';

export const MapService = {
  /** @type {mapboxgl.Map | null} */
  _map: null,

  /** @type {mapboxgl.Marker | null} */
  _userMarker: null,

  /**
   * Initialize a Mapbox map inside the given container element.
   * @param {string} containerId  — id of the DOM element
   * @param {object} [options]    — overrides for center, zoom, style
   * @returns {mapboxgl.Map}
   */
  init(containerId, options = {}) {
    if (typeof mapboxgl === 'undefined') {
      console.error('Mapbox GL JS is not loaded. Check CDN link in <head>.');
      return null;
    }

    if (!MAPBOX_TOKEN) {
      console.error(
        `Mapbox token is not configured. Set localStorage key "${MAPBOX_TOKEN_STORAGE_KEY}" before loading a map.`,
      );
      this._map = null;
      return null;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    this._map = new mapboxgl.Map({
      container: containerId,
      style: options.style ?? DEFAULT_MAP_STYLE,
      center: options.center ?? DEFAULT_MAP_CENTER,
      zoom: options.zoom ?? DEFAULT_ZOOM,
      attributionControl: false,
    });

    this._map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    this._map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    return this._map;
  },

  /**
   * Add a marker at the given coordinates.
   * @param {[number, number]} lngLat
   * @param {object} [options]  — color, element, popup text
   * @returns {mapboxgl.Marker}
   */
  addMarker(lngLat, options = {}) {
    if (!this._map) return null;

    const marker = new mapboxgl.Marker({
      color: options.color ?? '#6b2bd9',
      element: options.element,
    }).setLngLat(lngLat);

    if (options.popupText) {
      marker.setPopup(
        new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(options.popupText),
      );
    }

    marker.addTo(this._map);
    return marker;
  },

  /**
   * Fly the map camera to a new location.
   * @param {[number, number]} lngLat
   * @param {number} [zoom]
   */
  flyTo(lngLat, zoom) {
    if (!this._map) return;
    this._map.flyTo({
      center: lngLat,
      zoom: zoom ?? this._map.getZoom(),
      essential: true,
      duration: 1200,
    });
  },

  /**
   * Instantly reposition the map center without animation.
   * @param {[number, number]} lngLat
   */
  setCenter(lngLat) {
    if (!this._map) return;
    this._map.setCenter(lngLat);
  },

  /**
   * Request the browser's geolocation and return a Promise resolving to [lng, lat].
   * @returns {Promise<[number, number]>}
   */
  getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve([pos.coords.longitude, pos.coords.latitude]);
        },
        (err) => {
          reject(new Error(`Geolocation error: ${err.message}`));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  },

  /**
   * Place or update the user's location marker on the map.
   * @param {[number, number]} lngLat
   */
  setUserLocation(lngLat) {
    if (!this._map) return;

    if (this._userMarker) {
      this._userMarker.setLngLat(lngLat);
    } else {
      const el = document.createElement('div');
      el.className = 'map-user-dot';
      el.setAttribute('aria-label', 'Your location');
      this._userMarker = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(this._map);
    }
  },
};
