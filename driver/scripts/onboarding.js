/**
 * onboarding.js — Driver onboarding multi-step flow controller (#1572–#1576, #1686, #1854)
 * Steps: 1=Personal+NID → 2=National ID photos → 3=Vehicle details → 4=Documents
 *        → 5=Vehicle photo → 6=Selfie+Submit
 * Status screens: pending / rejected (reached via ?status= or after submit)
 */

import { auth } from '../../shared/scripts/auth.js';
import { initI18n, setLanguage, translate, I18N_EVENT } from '../../shared/scripts/i18n.js';
import { qs, qsa } from '../../shared/scripts/utils.js';

auth.requireAuth();
await initI18n();

document.querySelectorAll('[data-lang-btn]').forEach((btn) =>
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang-btn')))
);

// Demo entry points: ?status=pending|rejected opens a status screen, ?step=2…6 opens a step.
const params = new URLSearchParams(location.search);

// ── Common Egypt-market vehicle makes → models (#1573) ──
const VEHICLE_MODELS = {
  Toyota: ['Corolla', 'Yaris', 'Camry', 'Hilux', 'Land Cruiser', 'RAV4', 'C-HR'],
  Hyundai: ['Elantra', 'Accent', 'Tucson', 'Creta', 'i10', 'i20', 'Sonata'],
  Kia: ['Cerato', 'Sportage', 'Picanto', 'Sorento', 'Rio', 'Seltos'],
  Nissan: ['Sunny', 'Sentra', 'Qashqai', 'X-Trail', 'Juke'],
  Chevrolet: ['Optra', 'Aveo', 'Captiva', 'Lanos'],
  Mitsubishi: ['Lancer', 'Pajero', 'Attrage', 'Eclipse Cross'],
  Renault: ['Logan', 'Sandero', 'Duster', 'Megane', 'Clio'],
  Peugeot: ['301', '208', '2008', '308', '3008'],
  Fiat: ['Tipo', '500', 'Punto'],
  Skoda: ['Octavia', 'Fabia', 'Superb', 'Kamiq'],
  Volkswagen: ['Golf', 'Passat', 'Polo', 'Tiguan'],
  Suzuki: ['Swift', 'Dzire', 'Vitara', 'Ertiga'],
  MG: ['MG5', 'MG6', 'ZS', 'RX5'],
  BYD: ['F3', 'L3', 'Song', 'Han'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'A-Class', 'GLC'],
  BMW: ['3 Series', '5 Series', 'X3', 'X1'],
};

runWizard();

function runWizard() {
  let currentStep = 1;
  const TOTAL_STEPS = 6;

  // Header title per step (the step's own <h2> carries the longer hero heading).
  const STEP_TITLES = {
    1: 'onboarding.step1.title',
    2: 'onboarding.idCapture.title',
    3: 'onboarding.step2.title',
    4: 'onboarding.step4.title',
    5: 'onboarding.step3.title',
    6: 'onboarding.step5.title',
  };

  const progressFill = qs('#progress-fill');
  const progressDots = qsa('.onboarding-progress__dot');
  const progressCount = qs('#progress-count');
  const headerTitle = qs('#onboarding-title');
  const headerBack = qs('#onboarding-back');
  const main = qs('#onboarding-main');

  function renderChrome() {
    if (headerTitle) {
      headerTitle.setAttribute('data-i18n', STEP_TITLES[currentStep]);
      headerTitle.textContent = translate(STEP_TITLES[currentStep]);
    }
    if (progressCount) progressCount.textContent = translate('onboarding.stepOf', { n: currentStep, total: TOTAL_STEPS });
    if (headerBack) headerBack.disabled = currentStep === 1;
  }
  document.addEventListener(I18N_EVENT, renderChrome);

  function goToStep(n, { smooth = true } = {}) {
    qsa('.onboarding-step').forEach((sec) => sec.classList.add('onboarding-step--hidden'));
    document.body.classList.remove('onboarding-page--status');
    qs('#onboarding-progress')?.removeAttribute('hidden');

    currentStep = n;
    qs(`#step-${currentStep}`)?.classList.remove('onboarding-step--hidden');

    progressDots.forEach((dot, i) => {
      dot.classList.toggle('is-done', i < currentStep - 1);
      dot.classList.toggle('is-active', i === currentStep - 1);
    });
    if (progressFill) progressFill.style.inlineSize = `${(currentStep / TOTAL_STEPS) * 100}%`;
    qs('.onboarding-progress')?.setAttribute('aria-valuenow', String(currentStep));
    renderChrome();
    main?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  function showStatus(status) {
    qs('#onboarding-progress')?.setAttribute('hidden', '');
    document.body.classList.add('onboarding-page--status');
    qsa('.onboarding-step').forEach((sec) => sec.classList.add('onboarding-step--hidden'));
    qs(`#step-${status}`)?.classList.remove('onboarding-step--hidden');
    main?.scrollTo({ top: 0 });
  }

  // Header back arrow = the current step's own Back action (step 1 has none).
  headerBack?.addEventListener('click', () => qs(`#step${currentStep}-back`)?.click());

  // Status screens (#1576): a pending driver has no way into the app — "Got it"
  // signs her out rather than sending her to the login page, which would bounce
  // a signed-in driver straight to home.
  qs('#pending-done-btn')?.addEventListener('click', () => {
    auth.logout();
    window.location.replace('./index.html');
  });
  qs('#rejected-retry-btn')?.addEventListener('click', () => goToStep(1));

  // ── Step 1: Personal details + NID + consent (#1572) ──
  qs('#step1-next')?.addEventListener('click', () => {
    const nameEl = qs('#full-name');
    const dobEl = qs('#date-of-birth');
    const nidEl = qs('#nid-input');
    const nameErr = qs('#name-error');
    const dobErr = qs('#dob-error');
    const nidErr = qs('#nid-error');

    let ok = true;

    const name = nameEl?.value.trim() || '';
    if (!name || !/^[\p{L}\s'-]+$/u.test(name)) {
      if (nameErr) { nameErr.textContent = translate('onboarding.error.name'); nameErr.hidden = false; }
      nameEl?.focus();
      ok = false;
    } else { if (nameErr) nameErr.hidden = true; }

    const showDobErr = (key) => {
      if (!dobErr) return;
      dobErr.setAttribute('data-i18n', key);
      dobErr.textContent = translate(key);
      dobErr.hidden = false;
    };
    const dob = dobEl?.value || '';
    if (!dob) {
      showDobErr('onboarding.error.dob');
      if (ok) { dobEl?.focus(); ok = false; }
    } else {
      const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) {
        showDobErr('onboarding.error.age');
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

  // ── Step 2: National ID photos (front + back) (#1854) ──
  setupUploadZone('nid-front-input', 'nid-front-preview', 'nid-front-placeholder', 'nid-front-zone');
  setupUploadZone('nid-back-input', 'nid-back-preview', 'nid-back-placeholder', 'nid-back-zone');

  qs('#step2-back')?.addEventListener('click', () => goToStep(1));
  qs('#step2-next')?.addEventListener('click', () => {
    const ok = ['nid-front-zone', 'nid-back-zone'].every((id) => qs(`#${id}`)?.classList.contains('has-file'));
    const err = qs('#nid-docs-error');
    if (!ok) { if (err) err.hidden = false; return; }
    if (err) err.hidden = true;
    goToStep(3);
  });

  // ── Step 3: Vehicle details with make/model dropdowns (#1573) ──
  setupMakeModel();

  qs('#step3-back')?.addEventListener('click', () => goToStep(2));
  qs('#step3-next')?.addEventListener('click', () => {
    let ok = true;
    let firstFail = null;

    // Make (dropdown + Other → free text)
    const makeSel = qs('#vehicle-make');
    const makeOther = qs('#vehicle-make-other');
    const makeErr = qs('#make-error');
    const makeVal = makeSel?.value === 'other' ? (makeOther?.value.trim() || '') : (makeSel?.value || '');
    if (!makeVal) {
      if (makeErr) { makeErr.textContent = translate('onboarding.error.make'); makeErr.hidden = false; }
      firstFail = makeSel?.value === 'other' ? makeOther : makeSel;
      ok = false;
    } else if (makeErr) makeErr.hidden = true;

    // Model (dependent dropdown + Other → free text)
    const makeIsOther = makeSel?.value === 'other';
    const modelSel = qs('#vehicle-model');
    const modelOther = qs('#vehicle-model-other');
    const modelErr = qs('#model-error');
    const modelIsOther = makeIsOther || modelSel?.value === 'other';
    const modelVal = modelIsOther ? (modelOther?.value.trim() || '') : (modelSel?.value || '');
    if (!modelVal) {
      if (modelErr) { modelErr.textContent = translate('onboarding.error.model'); modelErr.hidden = false; }
      if (ok) firstFail = modelIsOther ? modelOther : modelSel;
      ok = false;
    } else if (modelErr) modelErr.hidden = true;

    // Year
    const yearEl = qs('#vehicle-year');
    const yearErr = qs('#year-error');
    const yearVal = parseInt(yearEl?.value || '', 10);
    const currentYear = new Date().getFullYear();
    if (!yearVal || yearVal < 2010 || yearVal > currentYear) {
      if (yearErr) { yearErr.textContent = translate('onboarding.error.year'); yearErr.hidden = false; }
      if (ok) firstFail = yearEl;
      ok = false;
    } else if (yearErr) yearErr.hidden = true;

    // Plate (free text)
    const plateEl = qs('#vehicle-plate');
    const plateErr = qs('#plate-error');
    if (!(plateEl?.value.trim())) {
      if (plateErr) { plateErr.textContent = translate('onboarding.error.plate'); plateErr.hidden = false; }
      if (ok) firstFail = plateEl;
      ok = false;
    } else if (plateErr) plateErr.hidden = true;

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
    goToStep(4);
  });

  // ── Step 4: Documents — licence + registration (#1575) ──
  [
    ['licence-front-input', 'licence-front-preview', 'licence-front-placeholder', 'licence-front-zone'],
    ['licence-back-input', 'licence-back-preview', 'licence-back-placeholder', 'licence-back-zone'],
    ['reg-front-input', 'reg-front-preview', 'reg-front-placeholder', 'reg-front-zone'],
    ['reg-back-input', 'reg-back-preview', 'reg-back-placeholder', 'reg-back-zone'],
  ].forEach(([inp, prev, plac, zone]) => setupUploadZone(inp, prev, plac, zone));

  qs('#step4-back')?.addEventListener('click', () => goToStep(3));
  qs('#step4-next')?.addEventListener('click', () => {
    const required = ['licence-front-zone', 'licence-back-zone', 'reg-front-zone', 'reg-back-zone'];
    const allUploaded = required.every((id) => qs(`#${id}`)?.classList.contains('has-file'));
    const allErr = qs('#docs-all-error');

    // Typed fields: licence number + licence/registration expiry (#1575)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const num = qs('#licence-number');
    const licExp = qs('#licence-expiry');
    const regExp = qs('#reg-expiry');
    const numOk = !!num && /^[A-Za-z0-9]{6,20}$/.test(num.value.trim());
    const licExpOk = !!licExp && !!licExp.value && new Date(licExp.value) > today;
    const regExpOk = !!regExp && !!regExp.value && new Date(regExp.value) > today;
    const toggleErr = (id, ok, key) => {
      const el = qs(`#${id}`);
      if (!el) return;
      if (!ok && key) { el.setAttribute('data-i18n', key); el.textContent = translate(key); }
      el.hidden = ok;
    };
    const expiryKey = (el, base) => `${base}.error.${el?.value ? 'expired' : 'empty'}`;
    toggleErr('licence-number-error', numOk, `onboarding.licenceNumber.error.${num?.value.trim() ? 'format' : 'empty'}`);
    toggleErr('licence-expiry-error', licExpOk, expiryKey(licExp, 'onboarding.licenceExpiry'));
    toggleErr('reg-expiry-error', regExpOk, expiryKey(regExp, 'onboarding.regExpiry'));

    if (!allUploaded) { if (allErr) allErr.hidden = false; return; }
    if (allErr) allErr.hidden = true;
    if (!numOk || !licExpOk || !regExpOk) return;
    goToStep(5);
  });

  // ── Step 5: Vehicle photo (#1574) ──
  setupUploadZone('vehicle-photo-input', 'vehicle-photo-preview', 'vehicle-photo-placeholder', 'vehicle-photo-zone');

  qs('#step5-back')?.addEventListener('click', () => goToStep(4));
  qs('#step5-next')?.addEventListener('click', () => {
    const zone = qs('#vehicle-photo-zone');
    const err = qs('#vehicle-photo-error');
    if (!zone?.classList.contains('has-file')) { if (err) err.hidden = false; return; }
    if (err) err.hidden = true;
    goToStep(6);
  });

  // ── Step 6: Selfie + Submit (#1686) ──
  setupUploadZone('selfie-input', 'selfie-preview', 'selfie-placeholder', 'selfie-zone');

  qs('#step6-back')?.addEventListener('click', () => goToStep(5));
  qs('#step6-submit')?.addEventListener('click', () => {
    const zone = qs('#selfie-zone');
    const err = qs('#selfie-error');
    if (!zone?.classList.contains('has-file')) { if (err) err.hidden = false; return; }
    if (err) err.hidden = true;

    const btn = qs('#step6-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>'; }
    setTimeout(() => showStatus('pending'), 1200);
  });

  // ── Initial screen ──
  const status = params.get('status');
  const stepParam = parseInt(params.get('step') || '', 10);
  if (status === 'pending' || status === 'rejected') showStatus(status);
  else goToStep(stepParam >= 1 && stepParam <= TOTAL_STEPS ? stepParam : 1, { smooth: false });
}

// ── Make/Model dependent dropdowns (#1573) ─────────
function setupMakeModel() {
  const makeSel = qs('#vehicle-make');
  const makeOther = qs('#vehicle-make-other');
  const modelSel = qs('#vehicle-model');
  const modelOther = qs('#vehicle-model-other');
  if (!makeSel || !modelSel) return;

  makeSel.addEventListener('change', () => {
    const val = makeSel.value;

    if (val === 'other') {
      if (makeOther) makeOther.hidden = false;
      modelSel.hidden = true;
      modelSel.disabled = true;
      if (modelOther) modelOther.hidden = false;
      return;
    }

    if (makeOther) { makeOther.hidden = true; makeOther.value = ''; }
    modelSel.hidden = false;
    modelSel.disabled = false;
    if (modelOther) { modelOther.hidden = true; modelOther.value = ''; }

    // Repopulate the model dropdown for the chosen make
    modelSel.textContent = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.disabled = true;
    ph.selected = true;
    ph.textContent = translate('onboarding.vehicle.model.select') || 'اختاري الموديل';
    modelSel.appendChild(ph);
    (VEHICLE_MODELS[val] || []).forEach((m) => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      modelSel.appendChild(o);
    });
    const other = document.createElement('option');
    other.value = 'other';
    other.textContent = translate('onboarding.vehicle.model.other') || 'أخرى';
    modelSel.appendChild(other);
  });

  modelSel.addEventListener('change', () => {
    if (modelSel.value === 'other') {
      if (modelOther) modelOther.hidden = false;
    } else if (modelOther) {
      modelOther.hidden = true;
      modelOther.value = '';
    }
  });
}

// ── Upload zone helper ─────────────────────────────
function setupUploadZone(inputId, previewId, placeholderId, zoneId) {
  const input = qs(`#${inputId}`);
  const preview = qs(`#${previewId}`);
  const placeholder = qs(`#${placeholderId}`);
  const zone = qs(`#${zoneId}`);

  if (!input || !zone) return;

  zone.addEventListener('click', (e) => {
    if (e.target !== input) input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

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

    // A filled slot clears its own "missing" error, and the step-level one once
    // every slot in the step is filled.
    zone.querySelectorAll('.field__error').forEach((el) => { el.hidden = true; });
    const step = zone.closest('.onboarding-step');
    const slots = step ? qsa('.upload-zone, .selfie-zone', step) : [];
    if (slots.every((s) => s.classList.contains('has-file'))) {
      step?.querySelectorAll('#nid-docs-error, #docs-all-error').forEach((el) => { el.hidden = true; });
    }
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
