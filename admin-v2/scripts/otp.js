/**
 * otp.js — SheDrive admin portal (v2) email one-time code screen
 *
 * MOCKUP SCREEN. The delivered design kit ships an email-OTP step (otp.html)
 * that the portal has never had as a page: the sign-in flow in index.html goes
 * credentials → authenticator enrolment → TOTP. This page renders that kit
 * screen so the design is reviewable, and hands off to the enrolment step when
 * the code checks out.
 *
 * It deliberately adds no session behaviour of its own — the code is checked
 * with the same `mockAuth.verifySecondFactor()` the sign-in screen uses, and
 * signing in still happens on index.html. "Resend code" is UI only: it restarts
 * the cool-down, it does not send anything.
 *
 * Validation messages are the ones #1806 already uses for a 6-digit code; both
 * halves live in i18n/auth.js under `auth.validation.*`.
 */

import { injectAdminStyles, ensureToastHost, iconUrl } from '../components/ad-styles.js';
import '../../shared/components/sd-toast-host.js';
import { mockAuth } from './mock-api.js';
import { initDesignChrome, initOtpInputs, readOtp } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import {
  t,
  lang,
  LANGUAGES,
  setAdminLanguage,
  initAdminI18n,
  applyAdminTranslations,
} from './admin-i18n.js';

// Direction has to be on <html> before the style stack picks LTR or RTL.
initAdminI18n();

injectAdminStyles({ screenStyles: 'styles/login.css' });
const showToast = ensureToastHost();
initDesignChrome({ lightbox: false });

const RESEND_SECONDS = 60;

const boxes = qs('#otp-field');
const codeError = qs('#otp-code-error');
const formError = qs('#otp-error');
const submit = qs('#otp-submit');
const submitLabel = qs('#otp-submit-label');
const resendButton = qs('#otp-resend');
const counter = qs('#otp-counter');
const counterValue = qs('#otp-counter-value');

initOtpInputs(boxes);

// ── Language switcher (no topbar on the auth screens) ──

function buildLanguageSwitcher() {
  const host = qs('#auth-lang');
  if (!host) return;
  host.textContent = '';

  LANGUAGES.forEach((option, index) => {
    if (index > 0) {
      const separator = document.createElement('span');
      separator.className = 'auth-lang__sep';
      separator.setAttribute('aria-hidden', 'true');
      separator.textContent = '/';
      host.appendChild(separator);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-link auth-linkbtn auth-lang__option';
    button.lang = option.code;
    if (option.code === lang()) button.setAttribute('aria-current', 'true');

    const flag = document.createElement('img');
    flag.className = 'auth-lang__flag';
    flag.src = iconUrl(`language/${option.flag}`);
    flag.alt = '';
    flag.setAttribute('aria-hidden', 'true');

    button.append(flag, document.createTextNode(option.label));
    button.addEventListener('click', () => setAdminLanguage(option.code));
    host.appendChild(button);
  });
}

/** Per-position labels for the six boxes; the container names the key. */
function labelOtpDigits(container) {
  const key = container?.dataset.digitKey;
  if (!key) return;
  container.querySelectorAll('.otp-input').forEach((box, index) => {
    box.setAttribute('aria-label', t(key, { n: index + 1 }));
  });
}

/** mockAuth throws English text; map the one error this screen can see. */
function apiErrorMessage(error) {
  return error?.message === 'Invalid or expired code.'
    ? t('auth.error.invalidCode')
    : (error?.message ?? '');
}

// ── Error helpers (same vocabulary as the sign-in screen) ──

function setCodeError(message) {
  if (message) {
    codeError.textContent = message;
    codeError.hidden = false;
    boxes.classList.add('otp-row--error');
  } else {
    codeError.textContent = '';
    codeError.hidden = true;
    boxes.classList.remove('otp-row--error');
  }
}

function setFormError(message) {
  formError.textContent = message ?? '';
  formError.classList.toggle('is-visible', Boolean(message));
}

boxes.addEventListener('input', (event) => {
  if (!event.target.classList.contains('otp-input')) return;
  setCodeError(null);
});

// ── Confirm the code ───────────────────────────────────

qs('#otp-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setFormError(null);

  const value = readOtp(boxes);

  if (!value) {
    setCodeError(t('auth.validation.codeRequired'));
    return;
  }
  if (!/^\d{6}$/.test(value)) {
    setCodeError(t('auth.validation.codeLength'));
    return;
  }
  setCodeError(null);

  submit.disabled = true;
  submitLabel.textContent = t('auth.checking');

  try {
    await mockAuth.verifySecondFactor(value);
    // Continue into the authenticator enrolment step of the sign-in flow.
    window.location.href = './index.html?step=enrol';
  } catch (error) {
    setCodeError(t('auth.validation.codeInvalid'));
    setFormError(apiErrorMessage(error));
  } finally {
    submit.disabled = false;
    submitLabel.textContent = t('auth.otpSubmit');
  }
});

// ── Resend cool-down ───────────────────────────────────

let remaining = 0;
let timer = null;

function renderCounter() {
  counterValue.textContent = String(remaining);
}

function startCountdown() {
  window.clearInterval(timer);
  remaining = RESEND_SECONDS;
  resendButton.disabled = true;
  counter.hidden = false;
  renderCounter();

  timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0;
      window.clearInterval(timer);
      timer = null;
      resendButton.disabled = false;
      counter.hidden = true;
    }
    renderCounter();
  }, 1000);
}

resendButton.addEventListener('click', () => {
  boxes.querySelectorAll('.otp-input').forEach((box) => {
    box.value = '';
  });
  setCodeError(null);
  setFormError(null);
  showToast(t('auth.toast.codeResent'), 'success');
  startCountdown();
  boxes.querySelector('.otp-input')?.focus();
});

// ── Translate the static markup, then start ───────────

buildLanguageSwitcher();
applyAdminTranslations();
labelOtpDigits(boxes);
document.title = t('auth.docTitle.otp');

startCountdown();
