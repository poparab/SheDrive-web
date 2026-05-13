/**
 * i18n.js — SheDrive bilingual (AR/EN) translation module
 * Reads strings from /shared/i18n/{lang}.json.
 * Applies [dir] and [lang] to <html>, and scans [data-i18n] attributes.
 */

import { storage } from './storage.js';
import { STORAGE_KEYS, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './config.js';

let currentLang = DEFAULT_LANGUAGE;
let strings = {};
let i18nReady = false;

export const I18N_EVENT = 'shedrive:i18n:updated';

/**
 * Load a locale JSON file. Path is resolved relative to shared/i18n/.
 * Assumes the script is served from rider/ or driver/ so the path is ../shared/i18n/.
 */
async function loadLocale(lang) {
  const response = await fetch(`../shared/i18n/${lang}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load locale: ${lang}`);
  return response.json();
}

/**
 * Return the translated string for `key`, with optional {{placeholder}} interpolation.
 * Falls back to the key itself if not found.
 * @param {string} key
 * @param {Record<string, string>} [vars]
 */
export function translate(key, vars = {}) {
  let str = strings[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return str;
}

/** Shorthand alias */
export const t = translate;

/** Return the currently active language code */
export function getLanguage() {
  return currentLang;
}

/** Return whether locale strings have been loaded at least once */
export function isI18nReady() {
  return i18nReady;
}

/**
 * Apply direction and lang attributes to <html>, and swap the RTL stylesheet.
 * @param {'ar'|'en'} lang
 */
export function applyDirection(lang) {
  const isRtl = lang === 'ar';
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);

  const rtlLink = document.getElementById('rtl-stylesheet');
  if (rtlLink) {
    rtlLink.disabled = !isRtl;
  }
}

/**
 * Scan DOM for [data-i18n] and [data-i18n-placeholder] attributes and apply translations.
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = translate(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', translate(key));
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', translate(key));
  });

  document.querySelectorAll('[data-i18n-value]').forEach((el) => {
    const key = el.getAttribute('data-i18n-value');
    el.value = translate(key);
  });
}

/**
 * Switch language, persist preference, update DOM.
 * @param {'ar'|'en'} lang
 */
export async function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  strings = await loadLocale(lang);
  currentLang = lang;
  i18nReady = true;
  storage.set(STORAGE_KEYS.LANGUAGE, lang);
  applyDirection(lang);
  applyTranslations();

  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    const isActive = btn.getAttribute('data-lang-btn') === lang;
    btn.classList.toggle('lang-switcher__btn--active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  document.dispatchEvent(new CustomEvent(I18N_EVENT, { detail: { lang } }));
}

/**
 * Initialize i18n: load saved or default language, apply to DOM.
 * Call once at page load before rendering dynamic content.
 */
export async function initI18n() {
  const saved = storage.get(STORAGE_KEYS.LANGUAGE);
  const lang = SUPPORTED_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  await setLanguage(lang);
}
