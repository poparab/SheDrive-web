/**
 * ad-styles.js — SheDrive admin portal stylesheet injection
 * Shared by <ad-shell> and the unauthenticated login page so both get the same
 * CSS stack in the same order. Mirrors how sd-page.js handles the rider app.
 */

const MODULE_URL = import.meta.url;

const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
const MAPBOX_STYLESHEET = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';

/** Load order matters: tokens → reset → base → components → utilities → admin. */
const STYLE_STACK = [
  ['admin-tokens-shared', '../../shared/styles/tokens.css'],
  ['admin-reset', '../../shared/styles/reset.css'],
  ['admin-base', '../../shared/styles/base.css'],
  ['admin-components', '../../shared/styles/components.css'],
  ['admin-utilities', '../../shared/styles/utilities.css'],
  ['admin-tokens', '../styles/admin-tokens.css'],
  ['admin-layout', '../styles/admin.css'],
];

function hasEntry(key) {
  return Array.from(document.head.querySelectorAll('link[data-ad-entry]')).some(
    (node) => node.dataset.adEntry === key,
  );
}

/**
 * Also dedupes by resolved href, so a stylesheet already present as a static
 * <link> in the page head (as map screens do for mapbox-gl.css, to get it
 * parser-loaded before mapbox-gl.js runs) is not fetched a second time.
 */
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

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Inject the admin CSS stack.
 * @param {{mapbox?: boolean, screenStyles?: string, fonts?: boolean}} options
 */
export function injectAdminStyles({ mapbox = false, screenStyles = '', fonts = true } = {}) {
  if (fonts) {
    ensurePreconnect('https://fonts.googleapis.com', 'admin-fonts-preconnect');
    ensurePreconnect('https://fonts.gstatic.com', 'admin-fonts-static', true);
    ensureStylesheet(FONT_STYLESHEET, 'admin-fonts');
  }

  STYLE_STACK.forEach(([key, path]) => {
    ensureStylesheet(new URL(path, MODULE_URL).toString(), key);
  });

  parseList(screenStyles).forEach((href) => {
    const resolved = new URL(href, window.location.href).toString();
    ensureStylesheet(resolved, `admin-screen:${resolved}`);
  });

  if (mapbox) {
    ensureStylesheet(MAPBOX_STYLESHEET, 'admin-mapbox');
  }
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
