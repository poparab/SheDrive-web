/**
 * login.js — SheDrive admin portal sign-in controller
 * Implements #1656 (email + password), #1806 (TOTP, enrolment, recovery codes,
 * lockout) and #1822 (password reset request, forced first-login change).
 * Validation messages come straight from those stories' Field Validation tables
 * (English half only — the portal is English-only).
 */

import { injectAdminStyles, ensureToastHost } from '../components/ad-styles.js';
import '../../shared/components/sd-toast-host.js';
import { mockAuth, stateOverride } from './mock-api.js';
import { adminAuth } from './admin-auth.js';
import { qs } from '../../shared/scripts/utils.js';

injectAdminStyles({ screenStyles: 'styles/login.css' });
const showToast = ensureToastHost();

// An already-signed-in admin has no business on the login screen.
adminAuth.redirectIfSignedIn();

const MAX_TOTP_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

const steps = {
  credentials: qs('#step-credentials'),
  twoFactor: qs('#step-2fa'),
  enrol: qs('#step-enrol'),
  change: qs('#step-change'),
  forgot: qs('#step-forgot'),
};

let pendingAdmin = null;
let totpAttempts = 0;
let lockedUntil = 0;

function showStep(name) {
  Object.entries(steps).forEach(([key, section]) => {
    section.hidden = key !== name;
  });
  steps[name].querySelector('input:not([type=hidden])')?.focus();
}

function setFieldError(inputId, message) {
  const input = qs(`#${inputId}`);
  const error = qs(`#${inputId}-error`);
  if (message) {
    error.textContent = message;
    error.hidden = false;
    input.classList.add('input--error');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${inputId}-error`);
  } else {
    error.textContent = '';
    error.hidden = true;
    input.classList.remove('input--error');
    input.removeAttribute('aria-invalid');
  }
}

function setFormError(id, message) {
  const box = qs(`#${id}`);
  box.textContent = message ?? '';
  box.classList.toggle('is-visible', Boolean(message));
}

function clearFieldErrorOnInput(inputId) {
  qs(`#${inputId}`).addEventListener('input', () => setFieldError(inputId, null));
}

['email', 'password', 'totp', 'recovery', 'new-password', 'confirm-password', 'forgot-email'].forEach(
  clearFieldErrorOnInput,
);

// ── Step 1 — credentials (#1656) ──────────────────────

/** #1656 Field Validation: required, format, ≤254 chars. */
function validateEmail(value, inputId = 'email') {
  if (!value) {
    setFieldError(inputId, 'Enter your email address');
    return false;
  }
  if (value.length > 254) {
    setFieldError(inputId, 'Email must be ≤ 254 characters');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    setFieldError(inputId, 'Invalid email address');
    return false;
  }
  setFieldError(inputId, null);
  return true;
}

qs('#credentials-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setFormError('credentials-error', null);

  const email = qs('#email').value.trim();
  const password = qs('#password').value;

  // Validate both fields so empty-email and empty-password show together
  // (#1656 Scenario 3).
  const emailOk = validateEmail(email);
  let passwordOk = true;
  if (!password) {
    setFieldError('password', 'Enter your password');
    passwordOk = false;
  } else if (password.length < 8) {
    setFieldError('password', 'Password must be at least 8 characters');
    passwordOk = false;
  } else {
    setFieldError('password', null);
  }

  if (!emailOk || !passwordOk) return;

  const submit = qs('#credentials-submit');
  submit.disabled = true;
  submit.textContent = 'Checking…';

  try {
    pendingAdmin = await mockAuth.login(email, password);
    totpAttempts = 0;

    if (pendingAdmin.requiresEnrolment) {
      renderRecoveryCodes();
      showStep('enrol');
    } else {
      qs('#tfa-hint').textContent = 'Enter the 6-digit code from your authenticator app.';
      showStep('twoFactor');
    }
  } catch (error) {
    setFormError('credentials-error', error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Continue';
  }
});

qs('#forgot-link').addEventListener('click', () => {
  qs('#forgot-email').value = qs('#email').value.trim();
  qs('#forgot-success').hidden = true;
  setFormError('forgot-error', null);
  showStep('forgot');
});

// ── Enrolment (#1806 Scenario 1) ───────────────────────

function renderRecoveryCodes() {
  const list = qs('#recovery-list');
  list.textContent = '';
  mockAuth.recoveryCodes().forEach((code) => {
    const li = document.createElement('li');
    li.textContent = code;
    list.appendChild(li);
  });
}

qs('#enrol-continue').addEventListener('click', () => {
  qs('#tfa-hint').textContent =
    'Enrolment saved. Enter a code from your authenticator app to finish signing in.';
  showStep('twoFactor');
});

// ── Step 2 — second factor (#1806) ─────────────────────

let usingRecovery = false;

qs('#toggle-recovery').addEventListener('click', () => {
  usingRecovery = !usingRecovery;
  qs('#totp-field').hidden = usingRecovery;
  qs('#recovery-field').hidden = !usingRecovery;
  qs('#toggle-recovery').textContent = usingRecovery
    ? 'Use your authenticator app instead'
    : 'Lost your device? Use a recovery code';
  setFormError('tfa-error', null);
  (usingRecovery ? qs('#recovery') : qs('#totp')).focus();
});

qs('#tfa-back').addEventListener('click', () => {
  pendingAdmin = null;
  showStep('credentials');
});

qs('#totp').addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
});

qs('#tfa-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setFormError('tfa-error', null);

  // #1806 Scenario 4 — repeated failures lock the attempt for a cool-down.
  if (Date.now() < lockedUntil) {
    const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
    setFormError('tfa-error', `Too many incorrect codes. Try again in ${seconds}s.`);
    return;
  }

  const value = usingRecovery ? qs('#recovery').value.trim() : qs('#totp').value.trim();
  const fieldId = usingRecovery ? 'recovery' : 'totp';

  if (!value) {
    setFieldError(
      fieldId,
      usingRecovery ? 'Enter a recovery code' : 'Enter the authentication code',
    );
    return;
  }

  if (!usingRecovery && !/^\d{6}$/.test(value)) {
    setFieldError('totp', 'Code must be exactly 6 digits');
    return;
  }

  setFieldError(fieldId, null);

  const submit = qs('#tfa-submit');
  submit.disabled = true;
  submit.textContent = 'Verifying…';

  try {
    const result = await mockAuth.verifySecondFactor(value);
    if (result.usedRecoveryCode) {
      showToast('Recovery code accepted and consumed.', 'warning');
    }

    if (pendingAdmin?.mustChangePassword) {
      showStep('change');
      return;
    }

    completeSignIn();
  } catch (error) {
    totpAttempts += 1;
    if (totpAttempts >= MAX_TOTP_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_MS;
      totpAttempts = 0;
      setFormError(
        'tfa-error',
        'Too many incorrect codes. This sign-in attempt is locked for 30 seconds.',
      );
    } else {
      const remaining = MAX_TOTP_ATTEMPTS - totpAttempts;
      setFieldError(
        fieldId,
        usingRecovery
          ? 'Invalid or already-used recovery code'
          : 'Invalid or expired code',
      );
      setFormError('tfa-error', `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }
  } finally {
    submit.disabled = false;
    submit.textContent = 'Verify';
  }
});

// ── Forced password change (#1822) ─────────────────────

qs('#change-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setFormError('change-error', null);

  const next = qs('#new-password').value;
  const confirm = qs('#confirm-password').value;

  if (!next) {
    setFieldError('new-password', 'Enter a new password');
    return;
  }
  if (next.length < 8) {
    setFieldError('new-password', 'Password must be at least 8 characters');
    return;
  }
  setFieldError('new-password', null);

  if (next !== confirm) {
    setFieldError('confirm-password', 'Passwords do not match');
    return;
  }
  setFieldError('confirm-password', null);

  await mockAuth.changePassword();
  completeSignIn();
});

// ── Password reset request (#1822) ─────────────────────

qs('#forgot-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = qs('#forgot-email').value.trim();
  if (!validateEmail(email, 'forgot-email')) return;

  await mockAuth.requestPasswordReset(email);
  // Deliberately does not reveal whether the address exists.
  qs('#forgot-success').hidden = false;
});

qs('#forgot-back').addEventListener('click', () => showStep('credentials'));

// ── Completion ─────────────────────────────────────────

function completeSignIn() {
  adminAuth.login(pendingAdmin.email);
  window.location.href = './dashboard.html';
}

// The ?state= override is a list-screen concern; note it here so the designer
// knows the login screen deliberately ignores it.
if (stateOverride()) {
  console.info(
    `[admin mockup] ?state=${stateOverride()} has no effect on the sign-in screen.`,
  );
}
