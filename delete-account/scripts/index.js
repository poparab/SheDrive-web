/**
 * index.js — public account deletion request page (/delete-account/).
 *
 * Google Play requires a web link where someone without the app can ask for her
 * account to be deleted. No session: she proves the number is hers with a code,
 * then the same rules apply as in the app (shared/scripts/account-deletion.js).
 *
 * Mock numbers: 0155… has no account; 0122… is blocked (active trip or unsettled
 * balance); anything else is scheduled for deletion.
 * ?state= verify | none | blocked | done
 */

import { initI18n } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import {
  scheduleDeletion,
  bindDeletionDate,
  previewDeletion,
  wireOtpStep,
} from '../../shared/scripts/account-deletion.js';

await initI18n();

const show = (name) => {
  qsa('[data-del-step]').forEach((el) => { el.hidden = el.getAttribute('data-del-step') !== name; });
  window.scrollTo(0, 0);
  qs(`[data-del-step="${name}"] .del-hero__title`)?.focus?.();
};

const phoneInput = qs('#del-phone');
const phoneError = qs('#del-phone-error');
let phone = '';

const validPhone = (digits) => /^01[0125]\d{8}$/.test(digits);
const selectedApp = () => qs('input[name="del-app"]:checked')?.value || 'rider';

phoneInput?.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  if (phoneError) phoneError.hidden = true;
  phoneInput.removeAttribute('aria-invalid');
});

const otp = wireOtpStep({
  input: qs('#del-otp'),
  error: qs('#del-otp-error'),
  submit: qs('#del-confirm'),
  resend: qs('#del-resend'),
  resendLabel: qs('#del-resend-countdown'),
  onVerified: () => {
    // Whether the number has an account is only revealed after the code, so the
    // page never tells a stranger which numbers are registered.
    if (phone.startsWith('0155')) { show('none'); return; }
    if (phone.startsWith('0122')) { show('blocked'); return; }
    bindDeletionDate(scheduleDeletion(selectedApp(), { phone }));
    show('done');
  },
});

qs('#del-send')?.addEventListener('click', () => {
  const digits = (phoneInput?.value || '').trim();
  if (!validPhone(digits)) {
    if (phoneError) phoneError.hidden = false;
    phoneInput?.setAttribute('aria-invalid', 'true');
    phoneInput?.focus();
    return;
  }
  phone = digits;
  const phoneEl = qs('#del-verify-phone');
  if (phoneEl) phoneEl.textContent = `+20 ${digits.replace(/^0/, '')}`;
  show('verify');
  otp.start();
});

qs('#del-change-number')?.addEventListener('click', () => show('request'));
qsa('[data-del-restart]').forEach((btn) => btn.addEventListener('click', () => show('request')));

// ── Design review deep links ──────────────────────────
const state = new URLSearchParams(window.location.search).get('state');
if (state === 'verify') {
  phone = '01012345678';
  const phoneEl = qs('#del-verify-phone');
  if (phoneEl) phoneEl.textContent = '+20 1012345678';
  show('verify');
  otp.start();
} else if (state === 'none' || state === 'blocked') {
  show(state);
} else if (state === 'done') {
  bindDeletionDate(previewDeletion());
  show('done');
}
