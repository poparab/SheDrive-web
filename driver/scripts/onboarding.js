/**
 * onboarding.js — Driver onboarding multi-step flow controller (#1572–#1576, #1686)
 * Steps: 1=Personal+NID → 2=Vehicle details → 3=Vehicle photo → 4=4 docs → 5=Selfie+Submit
 * Status screens: pending / rejected (reached via ?status= or after submit)
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// ── If ?status=pending|rejected, the inline demo script handles visibility.
// JS runs after that, so don't override it here.

const params = new URLSearchParams(location.search);
if (params.get('status')) {
  // Status screen only — wire buttons and exit early
  qs('#pending-done-btn')?.addEventListener('click', () => window.location.assign('./index.html'));
  qs('#rejected-retry-btn')?.addEventListener('click', () => {
    // Reset to step 1
    goToStep(1);
    qs('#onboarding-progress')?.removeAttribute('hidden');
    qs('#step-rejected')?.classList.add('onboarding-step--hidden');
    qs('#step-1')?.classList.remove('onboarding-step--hidden');
  });
  // No further setup needed
} else {
  runWizard();
}

function runWizard() {
  let currentStep = 1;
  const TOTAL_STEPS = 5;

  const progressFill = qs('#progress-fill');
  const progressDots = qsa('.onboarding-progress__dot');

  function goToStep(n) {
    const prev = qs(`#step-${currentStep}`);
    prev?.classList.add('onboarding-step--hidden');
    const dotPrev = progressDots[currentStep - 1];
    if (dotPrev) {
      dotPrev.classList.remove('is-active');
      if (n > currentStep) dotPrev.classList.add('is-done');
    }

    currentStep = n;

    const next = qs(`#step-${currentStep}`);
    next?.classList.remove('onboarding-step--hidden');
    const dotNext = progressDots[currentStep - 1];
    if (dotNext) { dotNext.classList.add('is-active'); dotNext.classList.remove('is-done'); }

    if (progressFill) progressFill.style.inlineSize = `${(currentStep / TOTAL_STEPS) * 100}%`;
    qs('.onboarding-progress')?.setAttribute('aria-valuenow', String(currentStep));
    qs('#onboarding-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showStatus(status) {
    // Hide progress bar and all steps, show status screen
    qs('#onboarding-progress')?.setAttribute('hidden', '');
    qsa('.onboarding-step').forEach(s => s.classList.add('onboarding-step--hidden'));
    qs(`#step-${status}`)?.classList.remove('onboarding-step--hidden');
  }

  // ── Step 1: Personal details + NID (#1572) ──────────
  qs('#step1-next')?.addEventListener('click', () => {
    const nameEl = qs('#full-name');
    const dobEl  = qs('#date-of-birth');
    const nidEl  = qs('#nid-input');
    const nameErr = qs('#name-error');
    const dobErr  = qs('#dob-error');
    const nidErr  = qs('#nid-error');

    let ok = true;

    const name = nameEl?.value.trim() || '';
    if (!name || !/^[\p{L}\s'-]+$/u.test(name)) {
      if (nameErr) { nameErr.textContent = translate('onboarding.error.name'); nameErr.hidden = false; }
      if (!name) { nameEl?.focus(); ok = false; }
    } else { if (nameErr) nameErr.hidden = true; }

    const dob = dobEl?.value || '';
    if (!dob) {
      if (dobErr) dobErr.hidden = false;
      if (ok) { dobEl?.focus(); ok = false; }
    } else {
      const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 21) {
        if (dobErr) dobErr.hidden = false;
        if (ok) { dobEl?.focus(); ok = false; }
      } else { if (dobErr) dobErr.hidden = true; }
    }

    const nid = (nidEl?.value || '').replace(/\D/g, '');
    if (nid.length !== 14) {
      if (nidErr) nidErr.hidden = false;
      if (ok) { nidEl?.focus(); ok = false; }
    } else { if (nidErr) nidErr.hidden = true; }

    // Background-check consent (#1572 — Scenario 6)
    const consentEl = qs('#bg-check-consent');
    const consentErr = qs('#consent-error');
    if (!consentEl?.checked) {
      if (consentErr) consentErr.hidden = false;
      if (ok) { consentEl?.focus(); ok = false; }
    } else { if (consentErr) consentErr.hidden = true; }

    if (ok) goToStep(2);
  });

  // ── Step 2: Vehicle details (#1573) ─────────────────
  qs('#step2-back')?.addEventListener('click', () => goToStep(1));
  qs('#step2-next')?.addEventListener('click', () => {
    const fields = [
      { id: 'vehicle-make',  errId: 'make-error',  key: 'onboarding.error.make' },
      { id: 'vehicle-model', errId: 'model-error', key: 'onboarding.error.model' },
      { id: 'vehicle-plate', errId: 'plate-error', key: 'onboarding.error.plate' },
    ];

    let ok = true;
    let firstFail = null;

    fields.forEach(({ id, errId, key }) => {
      const el = qs(`#${id}`);
      const errEl = qs(`#${errId}`);
      const val = el?.value.trim() || '';
      if (!val) {
        if (errEl) { errEl.textContent = translate(key); errEl.hidden = false; }
        if (ok) firstFail = el;
        ok = false;
      } else if (errEl) errEl.hidden = true;
    });

    // Year validation
    const yearEl = qs('#vehicle-year');
    const yearErr = qs('#year-error');
    const yearVal = parseInt(yearEl?.value || '', 10);
    const currentYear = new Date().getFullYear();
    if (!yearVal || yearVal < 2010 || yearVal > currentYear) {
      if (yearErr) { yearErr.textContent = translate('onboarding.error.year'); yearErr.hidden = false; }
      if (ok) firstFail = yearEl;
      ok = false;
    } else if (yearErr) yearErr.hidden = true;

    // Color
    const colorEl = qs('#vehicle-color');
    const colorErr = qs('#color-error');
    if (!colorEl?.value) {
      if (colorErr) { colorErr.textContent = translate('onboarding.error.color'); colorErr.hidden = false; }
      if (ok) firstFail = colorEl;
      ok = false;
    } else if (colorErr) colorErr.hidden = true;

    // Type
    const typeEl = qs('#vehicle-type');
    const typeErr = qs('#type-error');
    if (!typeEl?.value) {
      if (typeErr) { typeErr.textContent = translate('onboarding.error.type'); typeErr.hidden = false; }
      if (ok) firstFail = typeEl;
      ok = false;
    } else if (typeErr) typeErr.hidden = true;

    if (!ok) { firstFail?.focus(); return; }
    goToStep(3);
  });

  // ── Step 3: Vehicle photo (#1574) ────────────────────
  setupUploadZone('vehicle-photo-input', 'vehicle-photo-preview', 'vehicle-photo-placeholder', 'vehicle-photo-zone');

  qs('#step3-back')?.addEventListener('click', () => goToStep(2));
  qs('#step3-next')?.addEventListener('click', () => {
    const zone = qs('#vehicle-photo-zone');
    const err  = qs('#vehicle-photo-error');
    if (!zone?.classList.contains('has-file')) {
      if (err) err.hidden = false;
      return;
    }
    if (err) err.hidden = true;
    goToStep(4);
  });

  // ── Step 4: Four documents (#1575) ───────────────────
  [
    ['licence-front-input', 'licence-front-preview', 'licence-front-placeholder', 'licence-front-zone'],
    ['licence-back-input',  'licence-back-preview',  'licence-back-placeholder',  'licence-back-zone'],
    ['reg-front-input',     'reg-front-preview',     'reg-front-placeholder',     'reg-front-zone'],
    ['reg-back-input',      'reg-back-preview',      'reg-back-placeholder',      'reg-back-zone'],
  ].forEach(([inp, prev, plac, zone]) => setupUploadZone(inp, prev, plac, zone));

  qs('#step4-back')?.addEventListener('click', () => goToStep(3));
  qs('#step4-next')?.addEventListener('click', () => {
    const required = ['licence-front-zone', 'licence-back-zone', 'reg-front-zone', 'reg-back-zone'];
    const allUploaded = required.every(id => qs(`#${id}`)?.classList.contains('has-file'));
    const allErr = qs('#docs-all-error');
    if (!allUploaded) {
      if (allErr) allErr.hidden = false;
      return;
    }
    if (allErr) allErr.hidden = true;
    goToStep(5);
  });

  // ── Step 5: Selfie + Submit (#1686) ──────────────────
  setupUploadZone('selfie-input', 'selfie-preview', 'selfie-placeholder', 'selfie-zone');

  qs('#step5-back')?.addEventListener('click', () => goToStep(4));
  qs('#step5-submit')?.addEventListener('click', () => {
    const zone = qs('#selfie-zone');
    const err  = qs('#selfie-error');
    if (!zone?.classList.contains('has-file')) {
      if (err) err.hidden = false;
      return;
    }
    if (err) err.hidden = true;

    // Mock network: show spinner on button, then go to pending
    const btn = qs('#step5-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>'; }
    setTimeout(() => {
      showStatus('pending');
      qs('#pending-done-btn')?.addEventListener('click', () => window.location.assign('./index.html'));
    }, 1200);
  });
}

// ── Upload zone helper ─────────────────────────────
function setupUploadZone(inputId, previewId, placeholderId, zoneId) {
  const input       = qs(`#${inputId}`);
  const preview     = qs(`#${previewId}`);
  const placeholder = qs(`#${placeholderId}`);
  const zone        = qs(`#${zoneId}`);

  if (!input || !zone) return;

  zone.addEventListener('click', (e) => {
    if (e.target !== input) input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    // Type/size guard
    if (!file.type.startsWith('image/')) {
      showToast(translate('onboarding.error.fileType') || 'يرجى رفع صورة صحيحة', 'danger');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(translate('onboarding.error.fileSize') || 'حجم الملف كبير جداً (الحد 10 ميجا)', 'danger');
      return;
    }

    const url = URL.createObjectURL(file);
    if (preview) {
      preview.style.backgroundImage = `url(${url})`;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    zone.classList.add('has-file');
  });
}

// ── Toast helper ────────────────────────────────────
const toastContainer = qs('#toast-container');

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  toastContainer?.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
