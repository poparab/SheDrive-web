/**
 * utils.js — SheDrive general-purpose helpers
 * DOM shortcuts, formatting, debounce. No external dependencies.
 */

/** Select one element (throws if not found in debug mode) */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/** Select all elements as Array */
export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Format an Egyptian mobile number for display.
 * Accepts 10-digit local number, returns "+20 1XX XXX XXXX".
 */
export function formatPhoneEg(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length !== 10) return number;
  return `+20 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Debounce a function call by `wait` milliseconds */
export function debounce(fn, wait = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Clamp a number between min and max */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Return true if the environment supports touch events */
export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Simple template literal HTML escaper to prevent XSS in dynamic content */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Wait for `ms` milliseconds. Useful for async flows.
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Emit a custom DOM event on `target` with optional detail */
export function emit(target, eventName, detail = {}) {
  target.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail }));
}

/**
 * Start an incrementing MM:SS waiting counter from a given timestamp.
 * Updates `el.textContent` every second. Returns a cleanup function.
 * @param {HTMLElement} el - element to update
 * @param {number} fromTs - Date.now() value when waiting began
 * @returns {() => void} stop function
 */
export function startWaitingCounter(el, fromTs) {
  function tick() {
    const elapsed = Math.floor((Date.now() - fromTs) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
  }
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
