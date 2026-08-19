/**
 * admin-i18n.js — SheDrive admin portal (v2) bilingual runtime
 *
 * The admin portal used to be English-only. v2 is bilingual: Arabic (RTL) and
 * English (LTR), using the design kit's own `styles-ar.css` / `bootstrap.rtl`
 * builds for the Arabic direction.
 *
 * Two things make this different from the rider app's i18n:
 *
 *   1. **Strings are synchronous.** Most admin copy is generated inside module
 *      top-level code (grid columns, filter fields, modal specs), which runs
 *      before any `await` a page could add. So the locales are ES modules,
 *      statically imported — `t()` is usable from the first line of any script.
 *   2. **Switching language reloads the page.** Screens build their columns and
 *      filter specs once at import time; re-translating the DOM in place would
 *      leave those stale. The choice is persisted first, so the reload comes
 *      back in the new language with the same URL, filters and record id.
 *
 * Usage:
 *   import { t, lang, isRtl, setAdminLanguage, applyAdminTranslations } from './admin-i18n.js';
 *   t('common.save');
 *   t('drivers.count', { count: 12 });
 *
 * Markup:
 *   <span data-i18n="common.save">حفظ</span>
 *   <input data-i18n-placeholder="filters.searchPlaceholder" />
 *   <button data-i18n-aria-label="aria.closeDialog"></button>
 *   <img data-i18n-alt="aria.logo" />
 *   <a data-i18n-title="common.openInNewTab"></a>
 *
 * As in the rider app, the Arabic text is also written into the HTML as the
 * element's own content, so a screen reads correctly before scripts run.
 */

import { STRINGS } from '../i18n/index.js';

export const ADMIN_LANG_KEY = 'shedrive.adminLang';
export const ADMIN_I18N_EVENT = 'shedrive:admin-i18n:updated';

const SUPPORTED = ['ar', 'en'];

/**
 * English is the default: the backlog, the ADO stories and the reviewers'
 * acceptance criteria are all written in English, so a cold visit lands where
 * review happens. Arabic is one click away in the topbar and is remembered.
 */
const DEFAULT_LANG = 'en';

function readStoredLang() {
  try {
    const stored = window.localStorage.getItem(ADMIN_LANG_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {
    /* private mode — fall through to the default */
  }
  return null;
}

/** `?lang=en` wins over the stored choice, so a link can pin a language. */
function readUrlLang() {
  try {
    const value = new URLSearchParams(window.location.search).get('lang');
    return value && SUPPORTED.includes(value) ? value : null;
  } catch {
    return null;
  }
}

let current = readUrlLang() ?? readStoredLang() ?? DEFAULT_LANG;

/** The active language code. */
export function lang() {
  return current;
}

/** True when the active language is right-to-left. */
export function isRtl() {
  return current === 'ar';
}

export const LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: 'egypt.svg' },
  { code: 'en', label: 'English', flag: 'united-kingdom.svg' },
];

function lookup(key, code) {
  return key.split('.').reduce((node, part) => (node ? node[part] : undefined), STRINGS[code]);
}

/**
 * Translate a key. Falls back to English, then to the key itself, so a missing
 * string is visible in review instead of rendering as an empty element.
 * @param {string} key dotted path, e.g. 'drivers.title'
 * @param {Record<string, string|number>} [vars] {name} placeholders
 */
export function t(key, vars) {
  const value = lookup(key, current) ?? lookup(key, 'en') ?? key;
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/** True when a key exists in the active or fallback locale. */
export function hasKey(key) {
  return lookup(key, current) !== undefined || lookup(key, 'en') !== undefined;
}

const ATTRIBUTE_MAP = [
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-title', 'title'],
  ['data-i18n-alt', 'alt'],
  ['data-i18n-value', 'value'],
  // <ad-stat-card label="…"> and friends take their copy as an attribute.
  ['data-i18n-label', 'label'],
  ['data-i18n-section-title', 'section-title'],
  ['data-i18n-panel-title', 'panel-title'],
  ['data-i18n-heading', 'heading'],
  ['data-i18n-message', 'message'],
];

/** Apply every `data-i18n*` attribute inside `root` (default: the document). */
export function applyAdminTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });

  ATTRIBUTE_MAP.forEach(([dataAttr, target]) => {
    root.querySelectorAll(`[${dataAttr}]`).forEach((node) => {
      node.setAttribute(target, t(node.getAttribute(dataAttr)));
    });
  });
}

/** Set `dir` / `lang` on the document element. Stylesheets are swapped by ad-styles.js. */
export function applyDirection() {
  const root = document.documentElement;
  root.setAttribute('lang', current);
  root.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
}

/**
 * Persist a language and reload into it.
 * The reload is deliberate — see the module header.
 */
export function setAdminLanguage(code) {
  if (!SUPPORTED.includes(code) || code === current) return;
  try {
    window.localStorage.setItem(ADMIN_LANG_KEY, code);
  } catch {
    /* private mode: the ?lang= parameter below still carries the choice */
  }

  const url = new URL(window.location.href);
  // Keep an explicit ?lang= only if the page was already pinned to one.
  if (url.searchParams.has('lang')) url.searchParams.set('lang', code);
  window.location.href = url.toString();
}

/**
 * Called once by the shell (and by the auth screens) before anything renders.
 * Sets direction and translates whatever static markup is already in the page.
 */
export function initAdminI18n() {
  applyDirection();
  applyAdminTranslations();
  document.dispatchEvent(new CustomEvent(ADMIN_I18N_EVENT, { detail: { lang: current } }));
  return current;
}
