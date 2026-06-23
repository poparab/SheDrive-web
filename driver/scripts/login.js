/**
 * login.js — Driver login + register screen controller (#1569, #1570, #1571)
 * Login/register mode toggle, phone validation, OTP flow, onboarding-status routing.
 * On success: approved driver → home.html; pending/rejected → onboarding.html
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs } from '../../shared/scripts/utils.js';
import { startResendCountdown, MAX_ATTEMPTS } from '../../shared/scripts/otp-flow.js';

// Skip login if already authenticated
if (auth.getSession()) window.location.replace('./home.html');

await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── Mode state ─────────────────────────────────────────
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

  const isRegister = mode === 'register';
  nameField?.toggleAttribute('hidden', !isRegister);

  if (formTitle) {
    formTitle.setAttribute('data-i18n', isRegister ? 'register.title.driver' : 'login.title.driver');
    formTitle.textContent = translate(formTitle.getAttribute('data-i18n'));
  }
  if (formSubtitle) {
    formSubtitle.setAttribute('data-i18n', isRegister ? 'register.subtitle.driver' : 'login.subtitle.driver');
    formSubtitle.textContent = translate(formSubtitle.getAttribute('data-i18n'));
  }

  qs('.auth-mode--login', modeToggle)?.toggleAttribute('hidden', isRegister);
  qs('.auth-mode--register', modeToggle)?.toggleAttribute('hidden', !isRegister);

  showStep('phone');
  clearPhoneError();
}

modeToggle?.addEventListener('click', () => {
  switchMode(mode === 'login' ? 'register' : 'login');
});

// ── Step navigation ────────────────────────────────────
function showStep(step) {
  qs('#step-phone')?.classList.toggle('login-step--hidden', step !== 'phone');
  qs('#step-otp')?.classList.toggle('login-step--hidden', step !== 'otp');
}

// ── Phone validation ───────────────────────────────────
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

  // Mock: 0199xxxx → not registered (login mode only)
  if (mode === 'login' && digits.startsWith('0199')) {
    showPhoneError('login.error.notRegistered');
    const switchLink = document.createElement('button');
    switchLink.type = 'button';
    switchLink.className = 'btn btn--ghost btn--sm auth-switch-link';
    switchLink.textContent = translate('register.driver.switchToRegister');
    switchLink.style.marginInlineStart = 'var(--space-2)';
    switchLink.addEventListener('click', () => switchMode('register'));
    if (phoneError && !phoneError.querySelector('.auth-switch-link')) {
      phoneError.appendChild(switchLink);
    }
    return;
  }

  // Mock: 0100xxxx → already registered (register mode only) → silent login
  if (mode === 'register' && digits.startsWith('0100')) {
    auth.login('driver', digits);
    routeAfterLogin(digits);
    return;
  }

  startOtpStep(digits);
});

// ── OTP step ───────────────────────────────────────────
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

// Routing after successful OTP (#1571) — approved → home, else → onboarding
function routeAfterLogin(phone) {
  // Mock: 0111xxxx → pending; 0122xxxx → rejected; all others → approved
  const status = phone.startsWith('0111') ? 'pending'
    : phone.startsWith('0122') ? 'rejected'
    : 'approved';
  sessionStorage.setItem('shedrive.driverStatus', status);
  if (status === 'approved') {
    window.location.assign('./home.html');
  } else {
    window.location.assign('./onboarding.html?status=' + status);
  }
}

function verifyOtp(value) {
  if (isExpired) {
    showOtpError('login.error.expired');
    otpInput?.setAttribute('error', 'true');
    return;
  }

  if (value === '123456') {
    clearTimeout(expireTimer);
    auth.login('driver', currentPhone);
    routeAfterLogin(currentPhone);
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

otpInput?.addEventListener('sd-otp-change', () => clearOtpError());

verifyBtn?.addEventListener('click', () => verifyOtp(otpInput?.value || ''));

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
