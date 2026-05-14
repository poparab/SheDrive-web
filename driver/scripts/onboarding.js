/**
 * onboarding.js — Driver onboarding multi-step flow controller
 * Steps: Personal info → National ID → Selfie → Vehicle docs → Pending
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

// ── Auth guard ───────────────────────────────────────
auth.requireAuth();

// ── i18n ─────────────────────────────────────────────
await initI18n();

// Language switcher
document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')));
});

// ── Step state ────────────────────────────────────────
let currentStep = 1;
const totalSteps = 5;

const progressFill = qs('#progress-fill');
const progressDots = qsa('.onboarding-progress__dot');

function goToStep(n) {
  // Hide current
  qs(`#step-${currentStep}`).classList.add('onboarding-step--hidden');
  progressDots[currentStep - 1].classList.remove('is-active');
  if (n > currentStep) progressDots[currentStep - 1].classList.add('is-done');

  currentStep = n;

  // Show next
  const nextEl = qs(`#step-${currentStep}`);
  nextEl.classList.remove('onboarding-step--hidden');
  progressDots[currentStep - 1].classList.add('is-active');
  progressDots[currentStep - 1].classList.remove('is-done');

  // Update progress bar
  progressFill.style.inlineSize = `${(currentStep / totalSteps) * 100}%`;

  // Update aria
  const progressBar = qs('.onboarding-progress');
  progressBar.setAttribute('aria-valuenow', String(currentStep));

  // Scroll to top of main
  qs('#onboarding-main').scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Step 1 ────────────────────────────────────────────
qs('#step1-next').addEventListener('click', () => {
  const name = qs('#full-name').value.trim();
  const dob = qs('#date-of-birth').value;

  if (!name) {
    showToast(translate('onboarding.error.name'), 'danger');
    qs('#full-name').focus();
    return;
  }
  if (!dob) {
    showToast(translate('onboarding.error.dob'), 'danger');
    qs('#date-of-birth').focus();
    return;
  }
  goToStep(2);
});

// ── Step 2 ────────────────────────────────────────────
setupUploadZone('id-front-input', 'id-front-preview', 'id-front-placeholder', 'id-front-zone');
setupUploadZone('id-back-input', 'id-back-preview', 'id-back-placeholder', 'id-back-zone');

qs('#step2-back').addEventListener('click', () => goToStep(1));
qs('#step2-next').addEventListener('click', () => {
  if (!qs('#id-front-zone').classList.contains('has-file')) {
    showToast(translate('onboarding.error.idFront'), 'danger');
    return;
  }
  if (!qs('#id-back-zone').classList.contains('has-file')) {
    showToast(translate('onboarding.error.idBack'), 'danger');
    return;
  }
  goToStep(3);
});

// ── Step 3 ────────────────────────────────────────────
setupUploadZone('selfie-input', 'selfie-preview', 'selfie-placeholder', 'selfie-zone');

qs('#step3-back').addEventListener('click', () => goToStep(2));
qs('#step3-next').addEventListener('click', () => {
  if (!qs('#selfie-zone').classList.contains('has-file')) {
    showToast(translate('onboarding.error.selfie'), 'danger');
    return;
  }
  goToStep(4);
});

// ── Step 4 ────────────────────────────────────────────
setupUploadZone('vehicle-reg-input', 'vehicle-reg-preview', 'vehicle-reg-placeholder', 'vehicle-reg-zone');
setupUploadZone('insurance-input', 'insurance-preview', 'insurance-placeholder', 'insurance-zone');

qs('#step4-back').addEventListener('click', () => goToStep(3));
qs('#step4-next').addEventListener('click', () => {
  if (!qs('#vehicle-reg-zone').classList.contains('has-file')) {
    showToast(translate('onboarding.error.vehicleReg'), 'danger');
    return;
  }
  if (!qs('#insurance-zone').classList.contains('has-file')) {
    showToast(translate('onboarding.error.insurance'), 'danger');
    return;
  }
  goToStep(5);
});

// ── Step 5 ────────────────────────────────────────────
qs('#step5-done').addEventListener('click', () => {
  localStorage.setItem('shedrive.driver.onboarded', 'true');
  window.location.assign('./home.html');
});

// ── Upload zone helper ────────────────────────────────
function setupUploadZone(inputId, previewId, placeholderId, zoneId) {
  const input = qs(`#${inputId}`);
  const preview = qs(`#${previewId}`);
  const placeholder = qs(`#${placeholderId}`);
  const zone = qs(`#${zoneId}`);

  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    preview.style.backgroundImage = `url(${url})`;
    zone.classList.add('has-file');
  });
}

// ── Toast helper ─────────────────────────────────────
const toastContainer = qs('#toast-container');

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
