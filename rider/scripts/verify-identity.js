/**
 * verify-identity.js — Rider identity verification flow controller
 * 3-step flow: ID front → ID back → selfie.
 * On completion sets localStorage flag and redirects to home.
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

// ── Auth guard ────────────────────────────────────────
auth.requireAuth();

// ── i18n ──────────────────────────────────────────────
await initI18n();

// ── Language switcher ─────────────────────────────────
document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang-btn'));
  });
});

// ── State ─────────────────────────────────────────────
let currentStep = 1;
const totalSteps = 3;

// ── DOM refs ──────────────────────────────────────────
const ctaBtn = qs('#cta-btn');
const stepPanels = document.querySelectorAll('.verify-step');
const stepDots = document.querySelectorAll('[data-step-dot]');

// ── Step navigation ───────────────────────────────────
function goToStep(n) {
  if (n < 1 || n > totalSteps) return;
  currentStep = n;

  // Show/hide step panels
  stepPanels.forEach((panel) => {
    const panelStep = Number(panel.getAttribute('data-step'));
    const isActive = panelStep === currentStep;

    panel.classList.toggle('verify-step--active', isActive);
    panel.hidden = !isActive;

    if (isActive) {
      panel.removeAttribute('hidden');
    }
  });

  // Update stepper dots
  stepDots.forEach((dot) => {
    const dotStep = Number(dot.getAttribute('data-step-dot'));
    dot.classList.remove('verify-step-dot--active', 'verify-step-dot--done');
    dot.setAttribute('aria-selected', 'false');

    if (dotStep < currentStep) {
      dot.classList.add('verify-step-dot--done');
    } else if (dotStep === currentStep) {
      dot.classList.add('verify-step-dot--active');
      dot.setAttribute('aria-selected', 'true');
    }
  });

  // Update CTA label
  if (currentStep === totalSteps) {
    ctaBtn.setAttribute('data-i18n', 'verify.finish');
    ctaBtn.textContent = 'إنهاء التحقق';
  } else {
    ctaBtn.setAttribute('data-i18n', 'verify.continue');
    ctaBtn.textContent = 'متابعة';
  }

  // Re-run i18n translation pass for updated data-i18n attributes
  // (i18n module typically handles DOM mutations; explicit call ensures CTA label is translated)
  if (typeof document.dispatchEvent === 'function') {
    document.dispatchEvent(new CustomEvent('shedrive:i18n:refresh'));
  }
}

// ── Finish handler ─────────────────────────────────────
function finish() {
  localStorage.setItem('shedrive.identityVerified', '1');
  window.location.replace('./home.html');
}

// ── CTA button click ───────────────────────────────────
ctaBtn.addEventListener('click', () => {
  if (currentStep < totalSteps) {
    goToStep(currentStep + 1);
  } else {
    finish();
  }
});

// ── File input + upload card wiring ───────────────────

/**
 * Wire up a single upload step.
 *
 * @param {object} cfg
 * @param {string} cfg.inputId          - Hidden <input type="file"> id
 * @param {string} cfg.cardId           - .upload-card element id
 * @param {string} cfg.takePhotoId      - "Take photo" button id
 * @param {string} cfg.uploadGalleryId  - "Upload from gallery" button id
 */
function wireUploadStep({ inputId, cardId, takePhotoId, uploadGalleryId }) {
  const fileInput = qs(`#${inputId}`);
  const card = qs(`#${cardId}`);
  const takePhotoBtn = qs(`#${takePhotoId}`);
  const uploadGalleryBtn = qs(`#${uploadGalleryId}`);

  if (!fileInput || !card) return;

  // Show preview when a file is chosen
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    showPreview(card, url);
  });

  // "Take photo" — use capture attribute already set on input
  if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', () => {
      // Ensure capture attribute is set
      fileInput.setAttribute('capture', fileInput.getAttribute('capture') || 'environment');
      fileInput.click();
    });
  }

  // "Upload from gallery" — remove capture so OS shows gallery picker
  if (uploadGalleryBtn) {
    uploadGalleryBtn.addEventListener('click', () => {
      fileInput.removeAttribute('capture');
      fileInput.click();
      // Restore capture after picker opens (next tick)
      setTimeout(() => {
        const originalCapture = inputId === 'selfie-input' ? 'user' : 'environment';
        fileInput.setAttribute('capture', originalCapture);
      }, 500);
    });
  }

  // Tapping the card itself triggers the file picker (gallery mode)
  card.addEventListener('click', () => {
    fileInput.removeAttribute('capture');
    fileInput.click();
    setTimeout(() => {
      const originalCapture = inputId === 'selfie-input' ? 'user' : 'environment';
      fileInput.setAttribute('capture', originalCapture);
    }, 500);
  });

  // Keyboard accessibility for the card
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });
}

/**
 * Render a thumbnail preview inside an upload card.
 * Creates the <img> element if it doesn't exist yet.
 *
 * @param {HTMLElement} card - .upload-card element
 * @param {string} url - Object URL for the selected image
 */
function showPreview(card, url) {
  let img = card.querySelector('.upload-card__preview');
  if (!img) {
    img = document.createElement('img');
    img.className = 'upload-card__preview';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    card.appendChild(img);
  }
  img.src = url;

  // Hide the placeholder icon and label so the preview is unobscured
  const icon = card.querySelector('.upload-card__icon');
  const label = card.querySelector('.upload-card__label');
  if (icon) icon.style.display = 'none';
  if (label) label.style.display = 'none';
}

// ── Wire all three steps ──────────────────────────────
wireUploadStep({
  inputId: 'id-front-input',
  cardId: 'upload-card-front',
  takePhotoId: 'take-photo-front',
  uploadGalleryId: 'upload-gallery-front',
});

wireUploadStep({
  inputId: 'id-back-input',
  cardId: 'upload-card-back',
  takePhotoId: 'take-photo-back',
  uploadGalleryId: 'upload-gallery-back',
});

wireUploadStep({
  inputId: 'selfie-input',
  cardId: 'upload-card-selfie',
  takePhotoId: 'take-photo-selfie',
  uploadGalleryId: 'upload-gallery-selfie',
});

// ── Initialise to step 1 ──────────────────────────────
goToStep(1);
