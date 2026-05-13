import './sd-app-header.js';
import './sd-button.js';
import './sd-bottom-sheet.js';
import './sd-driver-card.js';
import './sd-rating-stars.js';
import './sd-toast-host.js';
import { Drawer } from '../scripts/drawer.js';
import { applyTranslations, isI18nReady } from '../scripts/i18n.js';

const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&display=swap';
const MAPBOX_STYLESHEET = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';
const MODULE_URL = import.meta.url;
const SHARED_STYLES = [
  ['shedrive-tokens', '../styles/tokens.css'],
  ['shedrive-reset', '../styles/reset.css'],
  ['shedrive-base', '../styles/base.css'],
  ['shedrive-components', '../styles/components.css'],
  ['shedrive-utilities', '../styles/utilities.css'],
  ['shedrive-f7-overrides', '../styles/f7-overrides.css'],
  ['shedrive-web-components', '../styles/web-components.css'],
  ['shedrive-rtl', '../styles/rtl.css'],
];

function resolveModuleAsset(path) {
  return new URL(path, MODULE_URL).toString();
}

function resolvePageAsset(path) {
  return new URL(path, window.location.href).toString();
}

function hasHeadEntry(tagName, key) {
  return Array.from(document.head.querySelectorAll(`${tagName}[data-sd-entry]`)).some(
    (node) => node.dataset.sdEntry === key,
  );
}

function ensurePreconnect(href, key, needsCrossOrigin = false) {
  if (hasHeadEntry('link', key)) return;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  link.dataset.sdEntry = key;
  if (needsCrossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

function ensureStylesheet(href, key, id = '') {
  if (hasHeadEntry('link', key)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.sdEntry = key;
  if (id) {
    link.id = id;
  }
  document.head.appendChild(link);
}

function parseCommaList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

class SdPage extends HTMLElement {
  connectedCallback() {
    if (this.dataset.sdMounted === 'true') return;

    this.dataset.sdMounted = 'true';
    this.classList.add('sd-page');

    document.documentElement.classList.add(this.getAttribute('f7-theme') || 'ios');
    document.body.classList.add('framework7-root');

    this.applyBodyClasses();
    this.ensureHeadAssets();
    this.ensureToastHost();

    if (this.hasAttribute('drawer')) {
      Drawer.mount();
    }

    if (isI18nReady()) {
      applyTranslations();
    }
  }

  applyBodyClasses() {
    const classes = (this.getAttribute('body-class') || '')
      .split(/\s+/)
      .map((className) => className.trim())
      .filter(Boolean);

    classes.forEach((className) => document.body.classList.add(className));
  }

  ensureHeadAssets() {
    if (!this.hasAttribute('no-fonts')) {
      ensurePreconnect('https://fonts.googleapis.com', 'shedrive-fonts-preconnect');
      ensurePreconnect('https://fonts.gstatic.com', 'shedrive-fonts-static-preconnect', true);
      ensureStylesheet(FONT_STYLESHEET, 'shedrive-fonts');
    }

    SHARED_STYLES.forEach(([key, href]) => {
      const id = key === 'shedrive-rtl' ? 'rtl-stylesheet' : '';
      ensureStylesheet(resolveModuleAsset(href), key, id);
    });

    if (this.hasAttribute('drawer')) {
      ensureStylesheet(resolveModuleAsset('../styles/drawer.css'), 'shedrive-drawer');
    }

    if (this.hasAttribute('mapbox')) {
      ensureStylesheet(MAPBOX_STYLESHEET, 'shedrive-mapbox');
    }

    parseCommaList(this.getAttribute('screen-styles')).forEach((href) => {
      const resolvedHref = resolvePageAsset(href);
      ensureStylesheet(resolvedHref, `screen:${resolvedHref}`);
    });
  }

  ensureToastHost() {
    if (this.querySelector('sd-toast-host')) return;

    const toastHost = document.createElement('sd-toast-host');
    toastHost.id = 'app-toast-host';
    this.appendChild(toastHost);
  }
}

if (!customElements.get('sd-page')) {
  customElements.define('sd-page', SdPage);
}