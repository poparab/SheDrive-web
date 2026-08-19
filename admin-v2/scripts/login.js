/**
 * login.js — SheDrive admin portal sign-in controller
 * Implements #1656 (email + password), #1806 (TOTP, enrolment, recovery codes,
 * lockout) and #1822 (password reset request, forced first-login change).
 *
 * Validation messages come straight from those stories' Field Validation
 * tables. The English half is verbatim from the stories; the Arabic half lives
 * beside it in i18n/auth.js under `auth.validation.*`. Nothing about the rules
 * themselves — required-ness, lengths, the 6-digit test, the three-attempt
 * counter or the 30-second lockout — changes with the language.
 */

import { injectAdminStyles, ensureToastHost, iconUrl } from '../components/ad-styles.js';
import '../../shared/components/sd-toast-host.js';
import { mockAuth, stateOverride } from './mock-api.js';
import { adminAuth, DEMO_ADMIN_EMAIL } from './admin-auth.js';
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

// Design-kit chrome — the only piece this screen uses is the show/hide password
// eye on every `.input-group`. No lightbox on an auth screen.
initDesignChrome({ lightbox: false });

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

// ── Language switcher ──────────────────────────────────
//
// The auth screens have no topbar, so the shell's language dropdown is not
// available here. The same LANGUAGES list is rendered as a small pair of
// flagged links above the form; setAdminLanguage() persists the choice and
// reloads on the same URL, so `?step=` deep links survive the switch.

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

/**
 * The six OTP boxes need a per-position label ("… digit 3"), which a static
 * `data-i18n-aria-label` cannot interpolate. The container names the key.
 */
function labelOtpDigits(container) {
  const key = container?.dataset.digitKey;
  if (!key) return;
  container.querySelectorAll('.otp-input').forEach((box, index) => {
    box.setAttribute('aria-label', t(key, { n: index + 1 }));
  });
}

/** Errors thrown by mockAuth carry English text; map the known ones. */
const API_ERRORS = {
  'Email or password is incorrect.': 'auth.error.invalidCredentials',
  'This admin account is disabled.': 'auth.error.accountDisabled',
  'Invalid or expired code.': 'auth.error.invalidCode',
};

function apiErrorMessage(error) {
  const key = API_ERRORS[error?.message];
  return key ? t(key) : (error?.message ?? '');
}

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
    setFieldError(inputId, t('auth.validation.emailRequired'));
    return false;
  }
  if (value.length > 254) {
    setFieldError(inputId, t('auth.validation.emailTooLong'));
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    setFieldError(inputId, t('auth.validation.emailInvalid'));
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
    setFieldError('password', t('auth.validation.passwordRequired'));
    passwordOk = false;
  } else if (password.length < 8) {
    setFieldError('password', t('auth.validation.passwordTooShort'));
    passwordOk = false;
  } else {
    setFieldError('password', null);
  }

  if (!emailOk || !passwordOk) return;

  const submit = qs('#credentials-submit');
  submit.disabled = true;
  submit.textContent = t('auth.checking');

  try {
    pendingAdmin = await mockAuth.login(email, password);
    totpAttempts = 0;

    if (pendingAdmin.requiresEnrolment) {
      renderRecoveryCodes();
      showStep('enrol');
    } else {
      qs('#tfa-hint').textContent = t('auth.tfaHint');
      showStep('twoFactor');
    }
  } catch (error) {
    setFormError('credentials-error', apiErrorMessage(error));
  } finally {
    submit.disabled = false;
    submit.textContent = t('auth.continue');
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
    // A recovery code is a Latin run inside otherwise Arabic copy.
    li.className = 'ad-ltr';
    li.textContent = code;
    list.appendChild(li);
  });
}

qs('#enrol-continue').addEventListener('click', () => {
  qs('#tfa-hint').textContent = t('auth.tfaHintEnrolled');
  showStep('twoFactor');
});

// ── Step 2 — second factor (#1806) ─────────────────────

let usingRecovery = false;

qs('#toggle-recovery').addEventListener('click', () => {
  usingRecovery = !usingRecovery;
  qs('#totp-field').hidden = usingRecovery;
  qs('#recovery-field').hidden = !usingRecovery;
  qs('#toggle-recovery').textContent = usingRecovery
    ? t('auth.useAuthenticator')
    : t('auth.useRecovery');
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
    setFormError('tfa-error', t('auth.validation.lockedRetry', { seconds }));
    return;
  }

  const value = usingRecovery ? qs('#recovery').value.trim() : qs('#totp').value.trim();
  const fieldId = usingRecovery ? 'recovery' : 'totp';

  if (!value) {
    setFieldError(
      fieldId,
      usingRecovery ? t('auth.validation.recoveryRequired') : t('auth.validation.codeRequired'),
    );
    return;
  }

  if (!usingRecovery && !/^\d{6}$/.test(value)) {
    setFieldError('totp', t('auth.validation.codeLength'));
    return;
  }

  setFieldError(fieldId, null);

  const submit = qs('#tfa-submit');
  submit.disabled = true;
  submit.textContent = t('auth.verifying');

  try {
    const result = await mockAuth.verifySecondFactor(value);
    if (result.usedRecoveryCode) {
      showToast(t('auth.toast.recoveryUsed'), 'warning');
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
      setFormError('tfa-error', t('auth.validation.lockedNow'));
    } else {
      const remaining = MAX_TOTP_ATTEMPTS - totpAttempts;
      setFieldError(
        fieldId,
        usingRecovery
          ? t('auth.validation.recoveryInvalid')
          : t('auth.validation.codeInvalid'),
      );
      setFormError(
        'tfa-error',
        remaining === 1
          ? t('auth.validation.attemptsRemainingOne')
          : t('auth.validation.attemptsRemainingMany', { count: remaining }),
      );
    }
  } finally {
    submit.disabled = false;
    submit.textContent = t('auth.verify');
  }
});

// ── Forced password change (#1822) ─────────────────────

qs('#change-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setFormError('change-error', null);

  const next = qs('#new-password').value;
  const confirm = qs('#confirm-password').value;

  if (!next) {
    setFieldError('new-password', t('auth.validation.newPasswordRequired'));
    return;
  }
  if (next.length < 8) {
    setFieldError('new-password', t('auth.validation.passwordTooShort'));
    return;
  }
  setFieldError('new-password', null);

  if (next !== confirm) {
    setFieldError('confirm-password', t('auth.validation.passwordsMismatch'));
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

// ── Design-kit OTP boxes (presentation only) ──────────
//
// The kit renders the 2FA and enrolment codes as six single-character boxes.
// `#totp` is still the one field this controller validates — the boxes simply
// mirror their joined value into it, so the 6-digit rule, the attempt counter
// and the 30-second lockout above are enforced on exactly the same value they
// always were.

const totpBoxes = qs('#totp-field');
const enrolBoxes = qs('#enrol-otp');

initOtpInputs(totpBoxes);
initOtpInputs(enrolBoxes);

function syncTotpFromBoxes() {
  const totp = qs('#totp');
  totp.value = readOtp(totpBoxes);
  // Non-bubbling: reaches the field's own listeners (sanitise + clear error)
  // without re-entering the container listener below.
  totp.dispatchEvent(new Event('input'));
}

totpBoxes.addEventListener('input', (event) => {
  if (!event.target.classList.contains('otp-input')) return;
  syncTotpFromBoxes();
});

function clearOtpBoxes(container) {
  container.querySelectorAll('.otp-input').forEach((box) => {
    box.value = '';
  });
}

// The toggle above focuses `#totp`, which is now the hidden mirror field —
// put the caret in the first box instead.
qs('#toggle-recovery').addEventListener('click', () => {
  if (!qs('#totp-field').hidden) totpBoxes.querySelector('.otp-input')?.focus();
});

// Leaving the 2FA step discards the half-typed code.
qs('#tfa-back').addEventListener('click', () => {
  clearOtpBoxes(totpBoxes);
  syncTotpFromBoxes();
});

// The enrolment screen's step 2 boxes and the 2FA screen's boxes ask for the
// same code, so carry whatever was typed across instead of clearing it.
qs('#enrol-continue').addEventListener('click', () => {
  const source = Array.from(enrolBoxes.querySelectorAll('.otp-input'));
  Array.from(totpBoxes.querySelectorAll('.otp-input')).forEach((box, index) => {
    box.value = source[index]?.value ?? '';
  });
  syncTotpFromBoxes();
});

// Copy the manual-entry setup key next to the QR code.
qs('#enrol-copy').addEventListener('click', async () => {
  const secret = qs('#enrol-secret').textContent.trim();
  try {
    await navigator.clipboard.writeText(secret);
    showToast(t('auth.toast.setupKeyCopied'), 'success');
  } catch {
    showToast(t('auth.toast.copyUnavailable'), 'warning');
  }
});

// ── Completion ─────────────────────────────────────────

function completeSignIn() {
  adminAuth.login(pendingAdmin.email);
  window.location.href = './dashboard.html';
}

// ── Translate the static markup ───────────────────────

buildLanguageSwitcher();
applyAdminTranslations();
labelOtpDigits(totpBoxes);
labelOtpDigits(enrolBoxes);
document.title = t('auth.docTitle.signIn');

// ── ?step= deep links ─────────────────────────────────
//
// Three of these steps are normally only reachable by signing in as the one
// seeded admin who has never logged in, which is not discoverable. Every other
// screen in the portal is directly linkable, so these are too:
//   ?step=forgot   reset request
//   ?step=2fa      two-factor code
//   ?step=enrol    first-time authenticator enrolment
//   ?step=change   forced first-login password change
//   ?step=recovery the 2FA step with the recovery-code field already open
const STEP_LINKS = {
  credentials: 'credentials',
  forgot: 'forgot',
  '2fa': 'twoFactor',
  recovery: 'twoFactor',
  enrol: 'enrol',
  change: 'change',
};

function applyStepOverride() {
  const requested = new URLSearchParams(window.location.search).get('step');
  if (!requested) return;

  const step = STEP_LINKS[requested];
  if (!step) {
    console.warn(
      `[admin mockup] Unknown ?step=${requested}. Valid values: ${Object.keys(STEP_LINKS).join(', ')}.`,
    );
    return;
  }

  // A deep link skips the credentials step, so stand in an admin — otherwise
  // completing the step would have no identity to sign in as.
  pendingAdmin = {
    email: DEMO_ADMIN_EMAIL,
    requiresEnrolment: requested === 'enrol',
    mustChangePassword: requested === 'change',
  };

  if (step === 'enrol') renderRecoveryCodes();
  showStep(step);

  // ?step=recovery lands on the same 2FA step with the recovery-code field
  // showing. Reuse the toggle so `usingRecovery` stays in step with the DOM.
  if (requested === 'recovery' && !usingRecovery) qs('#toggle-recovery').click();
}

applyStepOverride();

// The ?state= override is a list-screen concern; note it here so the designer
// knows the login screen deliberately ignores it.
if (stateOverride()) {
  console.info(
    `[admin mockup] ?state=${stateOverride()} has no effect on the sign-in screen. Use ?step= instead.`,
  );
}
