/**
 * account-deletion.js — account deletion, rider and driver.
 *
 * App Store and Google Play both refuse an app that lets people create an account
 * without letting them delete it from inside the app. Both apps' delete-account
 * screens and the restore step on both login screens run on the helpers here.
 *
 * Product rules the mockup demonstrates:
 * - Deleting starts a 30-day window. The account is deactivated and signed out at
 *   once; signing in again inside the window offers to restore it. After the
 *   window the deletion is final, and the number can never sign up to that app
 *   again (`isDeletedNumber`).
 * - The phone number is re-confirmed with a one-time code before anything happens.
 * - An active trip blocks the request. A driver who owes SheDrive cash blocks it
 *   too — she can settle, so there is a way through. A rider's outstanding fee does
 *   NOT block it: she can only pay it by taking a ride, and "take a ride to delete
 *   your account" is the same deadlock that got the rider booking gate rejected.
 *
 * Storage: localStorage `shedrive.accountDeletion` = { rider?: {...}, driver?: {...} }
 * with each entry { phone, requestedAt, deleteOn }. An entry past `deleteOn` is a
 * completed deletion: no longer pending, but its number stays blocked.
 *
 * Page scripts call `mountAccountDeletion(role)`; the login screens call
 * `getPendingDeletion` / `cancelDeletion` / `isDeletedNumber`.
 */

import { auth } from './auth.js';
import { translate, I18N_EVENT } from './i18n.js';
import { qs, qsa } from './utils.js';
import { storage } from './storage.js';
import { startResendCountdown, MAX_ATTEMPTS } from './otp-flow.js';

export const DELETION_STORAGE_KEY = 'shedrive.accountDeletion';
export const GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_OTP = '123456';

// ── Store ────────────────────────────────────────────────────────────────

function readAll() {
  const all = storage.get(DELETION_STORAGE_KEY);
  return all && typeof all === 'object' ? all : {};
}

/** The pending deletion for this app, or null. Expired entries count as gone. */
export function getPendingDeletion(role) {
  const entry = readAll()[role];
  if (!entry || entry.deleteOn <= Date.now()) return null;
  return entry;
}

export function scheduleDeletion(role, { phone = '' } = {}) {
  const requestedAt = Date.now();
  const entry = { phone, requestedAt, deleteOn: requestedAt + GRACE_DAYS * DAY_MS };
  storage.set(DELETION_STORAGE_KEY, { ...readAll(), [role]: entry });
  return entry;
}

export function cancelDeletion(role) {
  const all = readAll();
  delete all[role];
  storage.set(DELETION_STORAGE_KEY, all);
}

/** A sample entry for design-review deep links, never written to storage. */
export function previewDeletion() {
  const requestedAt = Date.now();
  return { phone: '', requestedAt, deleteOn: requestedAt + GRACE_DAYS * DAY_MS };
}

// Mock: 0150… stands for a number whose account was deleted, so reviewers can see
// the sign-up refusal without waiting out a 30-day window.
export const DELETED_NUMBER_PREFIX = '0150';

/** True once a deletion for this number has completed: it can never sign up again. */
export function isDeletedNumber(role, phone) {
  if (phone.startsWith(DELETED_NUMBER_PREFIX)) return true;
  const entry = readAll()[role];
  return Boolean(entry && entry.phone === phone && entry.deleteOn <= Date.now());
}

/** "27 October 2026" in the page's current language. */
export function formatDeletionDate(ts) {
  const lang = document.documentElement.lang === 'en' ? 'en-GB' : 'ar-EG';
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(ts);
}

/**
 * Fill every `[data-deletion-date]` element with its key, interpolated with the
 * deletion date. Re-runs on a language switch so the date follows the language.
 */
export function bindDeletionDate(entry) {
  const render = () => qsa('[data-deletion-date]').forEach((el) => {
    el.textContent = translate(el.getAttribute('data-deletion-date'), { date: formatDeletionDate(entry.deleteOn) });
  });
  render();
  document.addEventListener(I18N_EVENT, render);
}

// ── OTP step ─────────────────────────────────────────────────────────────

/**
 * Wire a code step: six-box input, confirm button, resend with cooldown, and the
 * same attempt / expiry rules as sign-in. `onVerified` runs once the code matches.
 * Returns `start()`, which resets the step and sends a (mock) code.
 */
export function wireOtpStep({ input, error, submit, resend, resendLabel, onVerified }) {
  let attempts = 0;
  let expired = false;
  let expireTimer = null;

  const showError = (key) => {
    if (error) { error.textContent = translate(key); error.hidden = false; }
    input?.setAttribute('error', 'true');
  };
  const clearError = () => {
    if (error) error.hidden = true;
    input?.removeAttribute('error');
  };

  const start = () => {
    attempts = 0;
    expired = false;
    clearError();
    input?.clear?.();
    if (submit) submit.disabled = false;
    if (resend) startResendCountdown(resend, resendLabel, 60);
    clearTimeout(expireTimer);
    expireTimer = setTimeout(() => {
      expired = true;
      showError('login.error.expired');
      if (submit) submit.disabled = true;
    }, 90_000);
    input?.focus?.();
  };

  const verify = (value) => {
    if (expired) { showError('login.error.expired'); return; }
    if ((value || '').length < 6) { showError('deleteAccount.verify.incomplete'); return; }
    if (value === MOCK_OTP) {
      clearTimeout(expireTimer);
      onVerified();
      return;
    }
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      showError('login.error.tooManyAttempts');
      if (submit) submit.disabled = true;
      if (resend) resend.disabled = false;
      return;
    }
    showError('login.error.wrongOtp');
    input?.clear?.();
    input?.focus?.();
  };

  input?.addEventListener('sd-otp-change', clearError);
  submit?.addEventListener('click', () => verify(input?.value || ''));
  resend?.addEventListener('click', () => { if (!resend.disabled) start(); });

  return { start };
}

// ── In-app screen ────────────────────────────────────────────────────────

/**
 * Drive `rider|driver/delete-account.html`.
 *
 * Steps: review → verify → done, or blocked in place of review. The review step is
 * one short confirmation; the code on the next step is what confirms the request.
 * ?state= review (default) | fee | owed | blocked-trip | blocked-balance | verify | done
 */
export function mountAccountDeletion(role) {
  const state = new URLSearchParams(window.location.search).get('state') || '';
  const session = auth.getSession();
  const phone = session?.phone || '';

  const steps = qsa('[data-del-step]');
  const show = (name) => {
    steps.forEach((el) => { el.hidden = el.getAttribute('data-del-step') !== name; });
    window.scrollTo(0, 0);
  };

  // Notices on the review step — information, never a gate.
  if (state === 'fee') qs('#del-notice-fee')?.removeAttribute('hidden');
  if (state === 'owed') qs('#del-notice-owed')?.removeAttribute('hidden');

  // Blockers. An active trip is read from the real handoff key too, so the
  // mockup refuses for the same reason the app would.
  const onTrip = state === 'blocked-trip' || Boolean(sessionStorage.getItem('shedrive.activeTrip'));
  const owesBalance = role === 'driver' && state === 'blocked-balance';
  if (onTrip || owesBalance) {
    qs(onTrip ? '#del-blocked-trip' : '#del-blocked-balance')?.removeAttribute('hidden');
    show('blocked');
    return;
  }

  const continueBtn = qs('#del-continue');

  const phoneEl = qs('#del-verify-phone');
  if (phoneEl) phoneEl.textContent = phone ? `+20 ${phone.replace(/^0/, '')}` : '';

  const otp = wireOtpStep({
    input: qs('#del-otp'),
    error: qs('#del-otp-error'),
    submit: qs('#del-confirm'),
    resend: qs('#del-resend'),
    resendLabel: qs('#del-resend-countdown'),
    onVerified: () => finish(scheduleDeletion(role, { phone })),
  });

  continueBtn?.addEventListener('click', () => {
    show('verify');
    otp.start();
  });

  function finish(entry) {
    bindDeletionDate(entry);
    // Deactivated at once: the session on this phone ends with the request.
    auth.logout();
    sessionStorage.removeItem('shedrive.driverStatus');
    show('done');
    qs('#del-done-title')?.focus?.();
  }

  if (state === 'verify') {
    show('verify');
    otp.start();
    return;
  }
  if (state === 'done') {
    bindDeletionDate(previewDeletion());
    show('done');
    return;
  }
  show('review');
}
