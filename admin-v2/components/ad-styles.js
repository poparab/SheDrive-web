/**
 * ad-styles.js — SheDrive admin portal (v2 design) stylesheet injection
 * Shared by <ad-shell> and the unauthenticated auth screens so both get the
 * same CSS stack in the same order.
 *
 * The v2 portal is built on the delivered SheDrive.AdminPanel design kit
 * (Bootstrap 5 + Tajawal + Font Awesome + the compiled styles.css), vendored
 * under admin-v2/vendor/. The legacy `ad-*` / `btn--*` vocabulary the screen
 * scripts still emit is re-skinned on top of it by styles/admin.css.
 */

import { isRtl } from '../scripts/admin-i18n.js';

const MODULE_URL = import.meta.url;

const FONT_AWESOME =
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css';
const MAPBOX_STYLESHEET = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';

/**
 * Load order matters:
 *   bootstrap → design kit → shared tokens → design token overrides → bridge.
 * The bridge (admin.css) is last so it always wins over the kit for the
 * legacy class names it re-skins.
 */
const STYLE_STACK_LTR = [
  ['adv2-bootstrap', '../vendor/css/bootstrap/bootstrap.min.css'],
  ['adv2-lightbox', '../vendor/css/lightbox/magnific-popup.css'],
  ['adv2-kit', '../vendor/css/styles.css'],
  ['adv2-tokens-shared', '../../shared/styles/tokens.css'],
  ['adv2-tokens-admin', '../styles/admin-tokens.css'],
  ['adv2-tokens-design', '../styles/design-tokens.css'],
  ['adv2-layout', '../styles/admin.css'],
  ['adv2-bridge', '../styles/admin-bridge.css'],
];

/**
 * Arabic swaps the three direction-dependent sheets for the kit's own RTL
 * builds, then adds admin-rtl.css for the portal's own flips. Everything else
 * (tokens, admin.css, the bridge, screen styles) is direction-agnostic and is
 * shared by both languages.
 */
const STYLE_STACK_RTL = [
  ['adv2-bootstrap', '../vendor/css/bootstrap/bootstrap.rtl.min.css'],
  ['adv2-lightbox', '../vendor/css/lightbox/magnific-popup.rtl.css'],
  ['adv2-kit', '../vendor/css/styles-ar.css'],
  ...STYLE_STACK_LTR.slice(3),
  ['adv2-rtl', '../styles/admin-rtl.css'],
];

function hasEntry(key) {
  return Array.from(document.head.querySelectorAll('link[data-ad-entry]')).some(
    (node) => node.dataset.adEntry === key,
  );
}

function hasHref(href) {
  return Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).some(
    (node) => node.href === href || node.getAttribute('href') === href,
  );
}

function ensureStylesheet(href, key) {
  if (hasEntry(key) || hasHref(href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.adEntry = key;
  document.head.appendChild(link);
}

function ensurePreconnect(href, key, crossOrigin = false) {
  if (hasEntry(key)) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  link.dataset.adEntry = key;
  if (crossOrigin) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function ensureFavicon() {
  if (document.head.querySelector('link[rel="shortcut icon"], link[rel="icon"]')) return;
  const link = document.createElement('link');
  link.rel = 'shortcut icon';
  link.type = 'image/x-icon';
  link.href = new URL('../vendor/img/favicon.png', MODULE_URL).toString();
  document.head.appendChild(link);
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Absolute URL for anything shipped inside admin-v2/, from any screen depth. */
export function assetUrl(path) {
  return new URL(`../${path.replace(/^\/+/, '')}`, MODULE_URL).toString();
}

/** Absolute URL for one of the design kit's SVG icons. */
export function iconUrl(name) {
  return assetUrl(`vendor/icons/${name}`);
}

/**
 * Inject the admin CSS stack.
 * @param {{mapbox?: boolean, screenStyles?: string, fonts?: boolean}} options
 */
export function injectAdminStyles({ mapbox = false, screenStyles = '' } = {}) {
  ensurePreconnect('https://cdnjs.cloudflare.com', 'adv2-fa-preconnect', true);
  ensureStylesheet(FONT_AWESOME, 'adv2-font-awesome');

  // Direction is already on <html> by the time any screen injects styles.
  const stack = isRtl() ? STYLE_STACK_RTL : STYLE_STACK_LTR;

  stack.forEach(([key, path]) => {
    ensureStylesheet(new URL(path, MODULE_URL).toString(), key);
  });

  parseList(screenStyles).forEach((href) => {
    const resolved = new URL(href, window.location.href).toString();
    ensureStylesheet(resolved, `adv2-screen:${resolved}`);
  });

  if (mapbox) {
    ensureStylesheet(MAPBOX_STYLESHEET, 'adv2-mapbox');
  }

  ensureFavicon();
}

/** Mount the shared toast host and return a showToast(message, type) function. */
export function ensureToastHost() {
  let host = document.querySelector('sd-toast-host');
  if (!host) {
    host = document.createElement('sd-toast-host');
    document.body.appendChild(host);
  }
  return (message, type = 'info', duration = 3500) => host.showToast?.(message, type, duration);
}
