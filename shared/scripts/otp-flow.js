/**
 * otp-flow.js — Shared OTP flow helpers (no real network).
 *
 * Exports:
 *   startResendCountdown(btnEl, labelEl, seconds)
 *   getOtpErrorKey(errorCode)
 *   MAX_ATTEMPTS
 */

export const MAX_ATTEMPTS = 3;
export const RESEND_SECONDS = 60;

/**
 * Start the 60-second resend cooldown.
 * Disables btnEl and updates labelEl with the countdown string.
 * Returns the interval id (auto-clears on completion).
 *
 * @param {HTMLButtonElement} btnEl   — the "Resend OTP" button
 * @param {HTMLElement}       labelEl — element showing cooldown text
 * @param {number}            seconds — countdown length (default RESEND_SECONDS)
 * @param {Function}          onDone  — optional callback when countdown ends
 */
export function startResendCountdown(btnEl, labelEl, seconds = RESEND_SECONDS, onDone) {
  btnEl.disabled = true;
  let remaining = seconds;

  function tick() {
    if (labelEl) {
      const key = 'login.resend.cooldown';
      const text = (typeof translate === 'function' ? translate(key, { n: remaining }) : null)
        || labelEl.dataset.cooldownTemplate?.replace('{{n}}', remaining)
        || `${remaining}s`;
      labelEl.textContent = text;
    }
  }

  tick();

  const id = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(id);
      btnEl.disabled = false;
      if (labelEl) labelEl.textContent = '';
      if (typeof onDone === 'function') onDone();
    } else {
      tick();
    }
  }, 1000);

  return id;
}

/**
 * Map an OTP/auth error code to its i18n key.
 * @param {'expired'|'wrong'|'tooMany'|'network'|'notRegistered'|'phoneFormat'} code
 * @returns {string} i18n key
 */
export function getOtpErrorKey(code) {
  const map = {
    expired: 'login.error.expired',
    wrong: 'login.error.wrongOtp',
    tooMany: 'login.error.tooManyAttempts',
    network: 'login.error.network',
    notRegistered: 'login.error.notRegistered',
    phoneFormat: 'login.error.phoneFormat',
  };
  return map[code] || 'login.error.network';
}
