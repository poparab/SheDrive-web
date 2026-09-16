/**
 * index.js — Rider login + register screen controller
 * One flow for sign-in and sign-up: phone validation, OTP, and — for a number with
 * no account — a full-name step after the code is verified.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import { storage } from '../../shared/scripts/storage.js';
import { startResendCountdown, MAX_ATTEMPTS } from '../../shared/scripts/otp-flow.js';

await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

qs('#login-form')?.addEventListener('submit', (e) => e.preventDefault());

// ── Flow state ────────────────────────────────────────
// One flow for sign-in and sign-up: phone → OTP → (new number only) full name.
// Whether the number already has an account is only revealed after the OTP is
// verified, so the phone step never tells a stranger which numbers are registered.
let attempts = 0;
let isExpired = false;
let expireTimer = null;

const formTitle    = qs('#form-title');
const formSubtitle = qs('#form-subtitle');
const nameInput    = qs('#name-input');
const nameError    = qs('#name-error');

function setHeading(titleKey, subtitleKey) {
  formTitle?.setAttribute('data-i18n', titleKey);
  formSubtitle?.setAttribute('data-i18n', subtitleKey);
  if (formTitle) formTitle.textContent = translate(titleKey);
  if (formSubtitle) formSubtitle.textContent = translate(subtitleKey);
}

// ── Step navigation ───────────────────────────────────
function showStep(step) {
  ['phone', 'otp', 'name'].forEach((name) =>
    qs(`#step-${name}`)?.classList.toggle('login-step--hidden', step !== name)
  );
  // The terms line only belongs where she is agreeing to continue, not on the name step.
  qs('.login-terms')?.toggleAttribute('hidden', step === 'name');
}

// ── Phone validation ──────────────────────────────────
const phoneInput = qs('#phone-input');
const phoneError = qs('#phone-error');
const sendOtpBtn = qs('#send-otp-btn');

function validatePhone(digits) {
  return /^01[0125]/.test(digits) && digits.length === 11;
}

function clearPhoneError() {
  if (phoneError) phoneError.hidden = true;
}

function showPhoneError(key) {
  if (phoneError) {
    phoneError.textContent = translate(key);
    phoneError.hidden = false;
  }
}

sendOtpBtn?.addEventListener('click', () => {
  const digits = (phoneInput?.value || '').replace(/\D/g, '');
  clearPhoneError();

  if (!validatePhone(digits)) {
    showPhoneError('login.error.phoneFormat');
    phoneInput?.focus();
    return;
  }

  // Every valid number gets a code — registered or not. The account check waits
  // until the OTP proves she owns the number.
  startOtpStep(digits);
});

// ── OTP step ──────────────────────────────────────────
const otpInput    = qs('#otp-input');
const otpErrorMsg = qs('#otp-error-msg');
const verifyBtn   = qs('#verify-btn');
const resendBtn   = qs('#resend-btn');
const resendLabel = qs('#resend-countdown');

let currentPhone = '';

function startOtpStep(digits) {
  currentPhone = digits;
  attempts = 0;
  isExpired = false;
  showStep('otp');
  clearOtpError();
  otpInput?.clear?.();
  otpInput?.removeAttribute('error');
  otpInput?.focus?.();
  startResendCountdown(resendBtn, resendLabel, 60);

  // 90s expiry timer
  clearTimeout(expireTimer);
  expireTimer = setTimeout(() => {
    isExpired = true;
    showOtpError('login.error.expired');
    otpInput?.setAttribute('error', 'true');
    if (verifyBtn) verifyBtn.disabled = true;
  }, 90_000);
}

function showOtpError(key) {
  if (otpErrorMsg) {
    otpErrorMsg.textContent = translate(key);
    otpErrorMsg.hidden = false;
  }
}

function clearOtpError() {
  if (otpErrorMsg) otpErrorMsg.hidden = true;
  otpInput?.removeAttribute('error');
}

// Mock account registry. A prefix, not a list, so any number a reviewer types still
// demos one of the two paths: 0100… is an existing rider, anything else is new and
// continues to the name step. (The old 0199 mock was unreachable — 0199 fails the
// Egyptian operator-prefix check on the phone step.)
function isNewRider(digits) {
  return !digits.startsWith('0100');
}

function verifyOtp(value) {
  if (isExpired) {
    showOtpError('login.error.expired');
    otpInput?.setAttribute('error', 'true');
    return;
  }

  if (value === '123456') {
    clearTimeout(expireTimer);
    if (isNewRider(currentPhone)) {
      startNameStep();
      return;
    }
    auth.login('rider', currentPhone);
    window.location.assign('./home.html');
    return;
  }

  attempts += 1;
  if (attempts >= MAX_ATTEMPTS) {
    showOtpError('login.error.tooManyAttempts');
    otpInput?.setAttribute('error', 'true');
    if (verifyBtn) verifyBtn.disabled = true;
    if (resendBtn) resendBtn.disabled = false;
    return;
  }

  showOtpError('login.error.wrongOtp');
  otpInput?.setAttribute('error', 'true');
  otpInput?.clear?.();
  otpInput?.focus?.();
}

otpInput?.addEventListener('sd-otp-complete', (e) => {
  clearOtpError();
  verifyOtp(e.detail.value);
});

otpInput?.addEventListener('sd-otp-change', () => {
  clearOtpError();
});

verifyBtn?.addEventListener('click', () => {
  const val = otpInput?.value || '';
  verifyOtp(val);
});

resendBtn?.addEventListener('click', () => {
  if (resendBtn.disabled) return;
  clearOtpError();
  isExpired = false;
  attempts = 0;
  otpInput?.clear?.();
  otpInput?.removeAttribute('error');
  if (verifyBtn) verifyBtn.disabled = false;
  startResendCountdown(resendBtn, resendLabel, 60);
  clearTimeout(expireTimer);
  expireTimer = setTimeout(() => {
    isExpired = true;
    showOtpError('login.error.expired');
    otpInput?.setAttribute('error', 'true');
    if (verifyBtn) verifyBtn.disabled = true;
  }, 90_000);
});

// ── Name step (new riders only) ───────────────────────
function startNameStep() {
  setHeading('register.nameStep.title', 'register.nameStep.subtitle');
  showStep('name');
  if (nameError) nameError.hidden = true;
  nameInput?.focus();
}

function showNameError(key) {
  if (nameError) {
    nameError.textContent = translate(key);
    nameError.hidden = false;
  }
  nameInput?.setAttribute('aria-invalid', 'true');
  nameInput?.focus();
}

function validateName(value) {
  if (!value) return 'register.name.error.empty';
  if (!/^[\p{L}\s'-]+$/u.test(value)) return 'register.name.error.format';
  if (value.length < 2 || value.length > 50) return 'register.name.error.length';
  return null;
}

function submitName() {
  const value = (nameInput?.value || '').trim().replace(/\s+/g, ' ');
  const errorKey = validateName(value);
  if (errorKey) {
    showNameError(errorKey);
    return;
  }
  // The account is only created once she has a name — leaving here means no account.
  storage.set('shedrive.profile', { ...(storage.get('shedrive.profile') || {}), name: value });
  auth.login('rider', currentPhone);
  window.location.assign('./home.html');
}

nameInput?.addEventListener('input', () => {
  if (nameError) nameError.hidden = true;
  nameInput.removeAttribute('aria-invalid');
});
nameInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitName();
  }
});
qs('#save-name-btn')?.addEventListener('click', submitName);

// ── Design review deep links ──────────────────────────
// ?state=otp opens the code step; ?state=name opens the new-rider name step.
const previewState = new URLSearchParams(window.location.search).get('state');
if (previewState === 'otp') {
  startOtpStep('01012345678');
} else if (previewState === 'name') {
  currentPhone = '01112345678';
  startNameStep();
} else if (auth.getSession()) {
  // ── Skip if already authenticated ───────────────────
  window.location.replace('./home.html');
}
