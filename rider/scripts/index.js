/**
 * index.js — Rider login + register screen controller
 * Handles login/register mode toggle, phone validation, OTP flow, error states.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import { startResendCountdown, MAX_ATTEMPTS } from '../../shared/scripts/otp-flow.js';

await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Mode state ────────────────────────────────────────
let mode = 'login'; // 'login' | 'register'
let attempts = 0;
let isExpired = false;
let expireTimer = null;

const formTitle    = qs('#form-title');
const formSubtitle = qs('#form-subtitle');
const modeToggle   = qs('#mode-toggle');
const nameField    = qs('#name-field');
const nameInput    = qs('#name-input');
const nameError    = qs('#name-error');

function switchMode(newMode) {
  mode = newMode;
  attempts = 0;
  isExpired = false;

  // Show/hide register-only elements
  const isRegister = mode === 'register';
  nameField?.removeAttribute('hidden');
  nameField?.toggleAttribute('hidden', !isRegister);

  // Update title/subtitle
  if (formTitle) {
    formTitle.setAttribute('data-i18n', isRegister ? 'register.title.rider' : 'login.title.rider');
    formTitle.textContent = translate(formTitle.getAttribute('data-i18n'));
  }
  if (formSubtitle) {
    formSubtitle.setAttribute('data-i18n', isRegister ? 'register.subtitle.rider' : 'login.subtitle.rider');
    formSubtitle.textContent = translate(formSubtitle.getAttribute('data-i18n'));
  }

  // Toggle mode-toggle links
  qs('.auth-mode--login', modeToggle)?.toggleAttribute('hidden', isRegister);
  qs('.auth-mode--register', modeToggle)?.toggleAttribute('hidden', !isRegister);

  // Reset steps
  showStep('phone');
  clearPhoneError();
}

modeToggle?.addEventListener('click', () => {
  switchMode(mode === 'login' ? 'register' : 'login');
});

// ── Step navigation ───────────────────────────────────
function showStep(step) {
  qs('#step-phone')?.classList.toggle('login-step--hidden', step !== 'phone');
  qs('#step-otp')?.classList.toggle('login-step--hidden', step !== 'otp');
}

// ── Phone validation ──────────────────────────────────
const phoneInput = qs('#phone-input');
const phoneError = qs('#phone-error');
const sendOtpBtn = qs('#send-otp-btn');

function validatePhone(digits) {
  return /^01[0-9]/.test(digits) && digits.length === 10;
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

  // Validate name in register mode
  if (mode === 'register') {
    const nameVal = (nameInput?.value || '').trim();
    if (!nameVal) {
      if (nameError) { nameError.textContent = translate('register.name.error.empty'); nameError.hidden = false; }
      nameInput?.focus();
      return;
    }
    if (!/^[\p{L}\s'-]+$/u.test(nameVal)) {
      if (nameError) { nameError.textContent = translate('register.name.error.format'); nameError.hidden = false; }
      nameInput?.focus();
      return;
    }
    if (nameVal.length < 2 || nameVal.length > 50) {
      if (nameError) { nameError.textContent = translate('register.name.error.length'); nameError.hidden = false; }
      nameInput?.focus();
      return;
    }
  }

  // Mock: phone starting 0199 is "not registered" in login mode
  if (mode === 'login' && digits.startsWith('0199')) {
    showPhoneError('login.error.notRegistered');
    const switchLink = document.createElement('button');
    switchLink.type = 'button';
    switchLink.className = 'btn btn--ghost btn--sm auth-switch-link';
    switchLink.textContent = translate('register.switchToRegister');
    switchLink.style.marginInlineStart = 'var(--space-2)';
    switchLink.addEventListener('click', () => switchMode('register'));
    if (phoneError && !phoneError.querySelector('.auth-switch-link')) {
      phoneError.appendChild(switchLink);
    }
    return;
  }

  // Mock: register mode with already-registered number (0100) → silent login
  if (mode === 'register' && digits.startsWith('0100')) {
    auth.login('rider', digits);
    window.location.assign('./home.html');
    return;
  }

  // Proceed to OTP step
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

function verifyOtp(value) {
  if (isExpired) {
    showOtpError('login.error.expired');
    otpInput?.setAttribute('error', 'true');
    return;
  }

  if (value === '123456') {
    clearTimeout(expireTimer);
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

// ── Skip if already authenticated ─────────────────────
if (auth.getSession()) {
  window.location.replace('./home.html');
}
