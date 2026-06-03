/**
 * login.js — Rider login page controller
 * Handles phone input, mock OTP flow, language switching, and redirect to home.
 */

import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { auth } from '../../shared/scripts/auth.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

// Redirect if already logged in
if (auth.isLoggedIn()) {
  window.location.replace('./home.html');
}

await initI18n();

const form = qs('#login-form');
const stepPhone = qs('#step-phone');
const stepOtp = qs('#step-otp');
const phoneInput = qs('#phone-input');
const sendOtpBtn = qs('#send-otp-btn');
const verifyBtn = qs('#verify-btn');
const resendBtn = qs('#resend-btn');
const phoneError = qs('#phone-error');
const otpError = qs('#otp-error');
const otpBoxes = qsa('.otp-box');
const toastContainer = qs('#toast-container');

// ── Language switcher ────────────────────────────────

document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang-btn'));
  });
});

// ── Phone validation ─────────────────────────────────

function validatePhone() {
  const digits = phoneInput.value.replace(/\D/g, '');
  const valid = digits.length === 10 && digits.startsWith('0');
  phoneError.hidden = valid;
  phoneInput.setAttribute('aria-invalid', String(!valid));
  return valid;
}

phoneInput.addEventListener('input', () => {
  if (!phoneError.hidden) validatePhone();
});

// ── Send OTP ─────────────────────────────────────────

sendOtpBtn.addEventListener('click', async () => {
  if (!validatePhone()) {
    phoneInput.focus();
    return;
  }

  sendOtpBtn.disabled = true;
  sendOtpBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';

  // Mock: simulate network delay
  await new Promise((r) => setTimeout(r, 1200));

  sendOtpBtn.disabled = false;
  sendOtpBtn.setAttribute('data-i18n', 'login.button.sendOtp');

  showToast('Verification code sent! (mock: use any 6 digits)', 'success');

  stepPhone.classList.add('login-step--hidden');
  stepOtp.classList.remove('login-step--hidden');
  otpBoxes[0].focus();
});

// ── OTP box keyboard navigation ──────────────────────

otpBoxes.forEach((box, idx) => {
  box.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(-1);

    e.target.classList.toggle('otp-box--filled', e.target.value !== '');

    if (val && idx < otpBoxes.length - 1) {
      otpBoxes[idx + 1].focus();
    }
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && idx > 0) {
      otpBoxes[idx - 1].value = '';
      otpBoxes[idx - 1].classList.remove('otp-box--filled');
      otpBoxes[idx - 1].focus();
    }
  });

  box.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData)
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    pasted.split('').forEach((ch, i) => {
      if (otpBoxes[i]) {
        otpBoxes[i].value = ch;
        otpBoxes[i].classList.add('otp-box--filled');
      }
    });
    const next = Math.min(pasted.length, otpBoxes.length - 1);
    otpBoxes[next].focus();
  });
});

// ── Resend OTP ───────────────────────────────────────

resendBtn.addEventListener('click', async () => {
  resendBtn.disabled = true;
  otpBoxes.forEach((b) => {
    b.value = '';
    b.classList.remove('otp-box--filled');
  });
  await new Promise((r) => setTimeout(r, 800));
  showToast('Code resent! (mock)', 'success');
  resendBtn.disabled = false;
  otpBoxes[0].focus();
});

// ── Verify & continue ────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const code = otpBoxes.map((b) => b.value).join('');
  if (code.length !== 6) {
    otpError.hidden = false;
    otpBoxes[0].focus();
    return;
  }
  otpError.hidden = true;

  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';

  // Mock: any 6-digit code is "valid"
  await new Promise((r) => setTimeout(r, 1000));

  auth.login('rider', phoneInput.value);
  window.location.replace('./home.html');
});

// ── Toast helper ─────────────────────────────────────

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
