/**
 * config.js — SheDrive global configuration
 * Single source of truth for URLs, local config keys, and map defaults.
 */

export const MAPBOX_TOKEN_STORAGE_KEY = 'shedrive.mapboxToken';

function readMapboxToken() {
  try {
    return globalThis.localStorage?.getItem(MAPBOX_TOKEN_STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export const MAPBOX_TOKEN = readMapboxToken();

export const API_BASE_URL = 'https://api.shedrive.app/v1'; // TODO: replace with real API

export const DEFAULT_MAP_CENTER = [31.2357, 30.0444]; // Cairo, Egypt [lng, lat]
export const DEFAULT_ZOOM = 12;
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

export const STORAGE_KEYS = {
  LANGUAGE: 'shedrive.lang',
  SESSION: 'shedrive.session',
};

export const DEFAULT_LANGUAGE = 'ar';

export const SUPPORTED_LANGUAGES = ['ar', 'en'];

export const PHONE_COUNTRY_CODE = '+20';
