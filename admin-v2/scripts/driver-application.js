/**
 * driver-application.js — SheDrive admin full driver application
 * #1658 all submitted details with the four documents inline, #1659 approve,
 * #1660 reject with a reason from the predefined list.
 *
 * v22-09 kit port (driver-application-view.html): the 6-card grid plus the
 * portal's Payout method and Decision history cards; Approve is the kit's
 * `popup-warning` confirm, Reject its `default-modal` with a reason; either
 * returns to the queue, which shows the result as a toast.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { REASON_LISTS } from './seed.js';
import { formatDate, formatDateTime, formatElapsed, formatPhone, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { withKitArt, kitArt, kitVehiclePhotos } from './doc-images.js';
import { loadBootstrap, bindLightbox } from './design-init.js';
import { iconUrl } from '../components/ad-styles.js';
import { reasonKey } from '../i18n/details.js';
import { t, hasKey, isRtl } from './admin-i18n.js';
import { can } from './roles.js';
import { queueToast } from '../components/ad-toast.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#app-body');
const missing = qs('#app-missing');
const loadError = qs('#app-error');
const approveBtn = qs('#approve-btn');
const rejectBtn = qs('#reject-btn');

const id = new URLSearchParams(window.location.search).get('id');

const TONE_BY_STATE = {
  submitted: 'muted',
  approved: 'success',
  reinstated: 'success',
  rejected: 'danger',
  suspended: 'danger',
  pending_suspension: 'warning',
};

/** Translated label for a stored reason string; unknown text passes through. */
function reasonLabel(text) {
  if (!text) return text;
  const key = `reason.${reasonKey(text)}`;
  return hasKey(key) ? t(key) : text;
}

/** Licence or registration already expired is decision-relevant, so flag it. */
function expiryValue(timestamp) {
  const expired = timestamp < Date.now();
  const span = document.createElement('span');
  span.textContent = formatDate(timestamp);
  if (expired) {
    span.className = 'list__expired danger-color';
    span.textContent += t('field.expiredSuffix');
  }
  return span;
}

/** The kit's round profile-photo thumbnail, opening in the lightbox. */
function profilePhoto(src, label) {
  const full = kitArt(src);
  const trigger = document.createElement('a');
  trigger.className = 'photo-trigger';
  trigger.href = full;
  trigger.title = label;
  trigger.setAttribute('aria-label', t('docs.enlarge', { label }));
  const container = document.createElement('div');
  container.className = 'lightbox-container';
  const thumb = document.createElement('div');
  thumb.className = 'thumb-item profile-photo';
  const frame = document.createElement('div');
  frame.className = 'thumb-img';
  const photo = document.createElement('div');
  photo.className = 'photo';
  photo.style.backgroundImage = `url("${full}")`;
  photo.innerHTML = '<i class="fa-solid fa-expand" aria-hidden="true"></i>';
  frame.appendChild(photo);
  thumb.appendChild(frame);
  container.appendChild(thumb);
  trigger.appendChild(container);
  return trigger;
}

async function load() {
  let application;
  try {
    application = await mockApi.getApplication(id);
  } catch {
    loadError.hidden = false;
    missing.hidden = true;
    body.hidden = true;
    return null;
  }
  loadError.hidden = true;

  // #1658 Scenario 3 — unknown or already-reviewed application.
  if (!application) {
    missing.hidden = false;
    body.hidden = true;
    return null;
  }

  missing.hidden = true;
  body.hidden = false;

  // National ID in full — product rule; Operations roles only (#6210).
  qs('#personal').items = [
    { label: t('field.fullName'), value: application.name },
    { label: t('common.phone'), value: formatPhone(application.phone), ltr: true },
    { label: t('field.dob'), value: formatDate(application.dob) },
    ...(can('driver.nationalId') ? [{ label: t('field.nid'), value: application.nid, ltr: true }] : []),
    { label: t('docs.profilePhoto'), value: profilePhoto(application.profilePhoto, t('docs.profilePhoto')) },
  ];
  bindLightbox(qs('#personal'));

  qs('#vehicle').items = [
    { label: t('field.make'), value: application.vehicle.make },
    { label: t('field.model'), value: application.vehicle.model },
    { label: t('field.year'), value: application.vehicle.year },
    { label: t('field.plate'), value: application.vehicle.plate, ltr: true },
    { label: t('field.colour'), value: application.vehicle.colour },
    { label: t('field.type'), value: application.vehicle.type },
  ];

  qs('#licence').items = [
    { label: t('field.licenceNumber'), value: application.licenceNumber, ltr: true },
    { label: t('field.licenceExpiry'), value: expiryValue(application.licenceExpiry) },
    { label: t('field.registrationExpiry'), value: expiryValue(application.registrationExpiry) },
  ];

  const status = document.createElement('ad-status-pill');
  status.setAttribute('variant', 'chip');
  status.status = application.status;

  qs('#summary').items = [
    { label: t('common.status'), value: status },
    { label: t('field.submitted'), value: formatDateTime(application.submittedAt) },
    { label: t('application.waiting'), value: formatElapsed(application.submittedAt) },
    { label: t('field.homeArea'), value: application.homeArea },
  ];

  // #6210 — the payout method goes to Finance roles only.
  qs('#payout-col').hidden = !can('driver.payoutMethod');
  if (can('driver.payoutMethod')) renderPayoutMethod(application);

  // Kit artwork stands in for the seed's flat placeholders (presentation only).
  qs('#docs').docs = withKitArt(
    application.documents
      .filter((doc) => doc.key !== 'national_id' || can('driver.nationalId'))
      .map((doc) => ({
      // The seed is the frozen data layer, so the label is translated here.
      label: hasKey(`docs.${doc.key}`) ? t(`docs.${doc.key}`) : doc.label,
      src: doc.src,
      ref: doc.ref,
      meta: t('docs.uploaded', { date: formatDate(doc.uploadedAt) }),
    })),
  );

  qs('#photos').docs = kitVehiclePhotos(t('docs.uploaded', { date: formatDate(application.submittedAt) }));

  // Decisions already made on this application (approve, reject, suspend…).
  const history = application.decisionHistory ?? [];
  qs('#history-section').hidden = history.length <= 1;
  if (history.length > 1) {
    qs('#history').items = history.map((entry) => ({
      label: hasKey(`status.${entry.state}`) ? t(`status.${entry.state}`) : humanize(entry.state),
      meta: [formatDateTime(entry.at), entry.actor].filter(Boolean).join(' · '),
      note: reasonLabel(entry.note),
      tone: TONE_BY_STATE[entry.state] ?? 'default',
    }));
  }

  return application;
}

qs('#retry-btn').addEventListener('click', () => load());

// ── Payout method (2026-10-14 spec §2) — read-only, number in full ──

function renderPayoutMethod(application) {
  const section = qs('#payout');
  section.setAttribute('hint', t('driverPayout.applicationHint'));
  const method = application.payoutMethod;
  if (!method) {
    section.items = [{ label: t('driverPayout.type'), value: t('driverPayout.none'), muted: true, wide: true }];
    return;
  }
  const items = [{ label: t('driverPayout.type'), value: t(`driverPayout.type${method.type}`) }];
  if (method.type === 'MOBILE_WALLET') {
    items.push({ label: t('driverPayout.walletProvider'), value: method.provider, ltr: true });
  } else if (method.type === 'BANK_ACCOUNT') {
    items.push({ label: t('driverPayout.bank'), value: method.provider, ltr: true });
  }
  const isCard = method.type === 'PREPAID_CARD';
  items.push(
    { label: isCard ? t('driverPayout.cardName') : t('driverPayout.holderName'), value: method.holderName },
    {
      label: {
        MOBILE_WALLET: t('driverPayout.walletNumber'),
        BANK_ACCOUNT: t('driverPayout.accountNumber'),
        PREPAID_CARD: t('driverPayout.cardNumber'),
      }[method.type],
      value: method.number || '—',
      ltr: true,
    },
    // #5624 — who changed it last: the driver in the app, or an admin.
    {
      label: t('driverPayout.lastChangedBy'),
      value: method.updatedBy && method.updatedBy !== 'driver'
        ? t('driverPayout.changedByAdmin', { who: method.updatedBy })
        : t('driverPayout.changedByDriver'),
      wide: true,
    },
  );
  section.items = items;
}

// ── Kit modals ────────────────────────────────────────
// The kit's dialogs, built on <body> per open and removed once closed:
// `default-modal` / `popup-primary` forms with an icon header, the centred
// `popup-warning` confirm; results are toasts (kitResult). <ad-form-modal> only
// renders the centred popup layout, so the header-icon forms are built here.

let modalSeq = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function faIcon(name) {
  const i = el('i', `fa-solid ${name}`);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

function kitButton(variant, icon, label, type = 'button') {
  const button = el('button', `btn ${variant}`);
  button.type = type;
  if (icon) button.appendChild(faIcon(icon));
  button.append(label);
  return button;
}

const backIcon = () => (isRtl() ? 'fa-arrow-right' : 'fa-arrow-left');

function modalShell(kind, labelId, { staticBackdrop = true } = {}) {
  const root = el('div', `modal fade ${kind}`);
  root.tabIndex = -1;
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('aria-labelledby', labelId);
  if (staticBackdrop) root.setAttribute('data-bs-backdrop', 'static');
  const dialog = el('div', 'modal-dialog modal-dialog-centered');
  const content = el('div', 'modal-content');
  const header = el('div', 'modal-header');
  const bodyEl = el('div', 'modal-body');
  const footer = el('div', 'modal-footer');
  content.append(header, bodyEl, footer);
  dialog.appendChild(content);
  root.appendChild(dialog);
  const close = el('button', 'btn-close');
  close.type = 'button';
  close.setAttribute('data-bs-dismiss', 'modal');
  close.setAttribute('aria-label', t('aria.closeDialog'));
  return { root, header, body: bodyEl, footer, close };
}

/** Mount on <body>, show, and resolve once the dialog has fully closed. */
async function presentModal(root, onShown) {
  document.body.appendChild(root);
  try {
    await loadBootstrap();
  } catch {
    /* manual fallback below */
  }
  return new Promise((resolve) => {
    const finish = () => {
      root.remove();
      resolve();
    };
    if (window.bootstrap?.Modal) {
      const instance = window.bootstrap.Modal.getOrCreateInstance(root);
      root.addEventListener('shown.bs.modal', () => onShown?.(), { once: true });
      root.addEventListener(
        'hidden.bs.modal',
        () => {
          instance.dispose();
          finish();
        },
        { once: true },
      );
      root.hideModal = () => instance.hide();
      instance.show();
      return;
    }
    // Bootstrap failed to load: show the same markup without it.
    const backdrop = el('div', 'modal-backdrop fade show');
    root.classList.add('show');
    root.style.display = 'block';
    root.removeAttribute('aria-hidden');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('role', 'dialog');
    document.body.appendChild(backdrop);
    root.hideModal = () => {
      backdrop.remove();
      finish();
    };
    root.querySelectorAll('[data-bs-dismiss="modal"]').forEach((node) =>
      node.addEventListener('click', () => root.hideModal()),
    );
    onShown?.();
  });
}

/**
 * The result of a decision. It used to be the kit's popup-success, which the
 * admin had to close; it needs no decision, so it is a toast. Every decision
 * here returns to the queue, so the toast is queued for that page.
 */
function kitResult({ tone = 'success', title, text }) {
  queueToast(text || title, tone, { title: text ? title : undefined });
  return Promise.resolve();
}

/**
 * The kit's form dialog: header icon + title (+ subject name), an optional
 * intro and notice, a validated form, confirm + cancel in the footer.
 * `fields` may be a function of the current values; a field with `rerender`
 * rebuilds the form when it changes (the payout type picks its own fields).
 * Resolves to onConfirm's result once closed, or null when dismissed.
 */
function kitForm({ kind = 'default-modal', icon, title, subject, intro, notice, fields, confirm, cancel, onConfirm }) {
  modalSeq += 1;
  const uid = `people-modal-${modalSeq}`;
  const m = modalShell(kind, `${uid}-title`);

  const img = el('img', 'icon');
  img.src = iconUrl(icon);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  const heading = el('h3', '', title);
  heading.id = `${uid}-title`;
  m.header.append(img, heading);
  if (subject) m.header.appendChild(el('span', 'tertiary-color text-bold', subject));
  m.header.appendChild(m.close);

  if (intro) m.body.appendChild(el('p', 'small lh-sm', intro));
  if (notice) m.body.appendChild(notice);

  const summary = el('div', 'alert danger mt-3');
  summary.setAttribute('role', 'alert');
  summary.hidden = true;
  const summaryText = el('p');
  summary.append(faIcon('fa-circle-exclamation'), summaryText);

  const form = el('form', 'row gy-3');
  form.id = `${uid}-form`;
  form.noValidate = true;
  m.body.append(summary, form);

  let specs = [];
  let controls = new Map();
  let errors = new Map();

  const currentValues = () => {
    const values = {};
    controls.forEach((control, key) => {
      values[key] = String(control.value ?? '').trim();
    });
    return values;
  };

  function renderFields() {
    const previous = currentValues();
    specs = typeof fields === 'function' ? fields(previous) : fields;
    form.textContent = '';
    controls = new Map();
    errors = new Map();

    specs.forEach((field) => {
      const col = el('div', 'col-12');
      const controlId = `${uid}-${field.key}`;
      const label = el('label', '', field.label);
      label.htmlFor = controlId;
      if (field.required) {
        const star = el('span', 'danger-color', ' *');
        star.setAttribute('aria-hidden', 'true');
        label.appendChild(star);
      }

      let control;
      if (field.type === 'select') {
        control = el('select', 'form-select');
        const placeholder = el('option', '', field.placeholder ?? t('kitPeople.selectReason'));
        placeholder.value = '';
        control.appendChild(placeholder);
        (field.options ?? []).forEach((option) => {
          const opt = el('option', '', option.label);
          opt.value = option.value;
          control.appendChild(opt);
        });
      } else if (field.type === 'textarea') {
        control = el('textarea', 'form-control');
        control.rows = field.rows ?? 2;
        if (field.placeholder) control.placeholder = field.placeholder;
      } else {
        control = el('input', 'form-control');
        control.type = 'text';
        if (field.placeholder) control.placeholder = field.placeholder;
      }
      control.id = controlId;
      control.name = field.key;
      // A rebuild keeps what the admin already entered in a field that survives it.
      control.value = Object.prototype.hasOwnProperty.call(previous, field.key)
        ? previous[field.key]
        : field.value ?? '';
      // Latin data (numbers, ids) keeps its own direction inside an Arabic form.
      if (field.ltr) control.classList.add('ad-ltr', 'text-dir-ltr');
      col.append(label, control);

      const described = [];
      if (field.hint) {
        const hint = el('div', 'form-text', field.hint);
        hint.id = `${controlId}-hint`;
        described.push(hint.id);
        col.appendChild(hint);
      }
      const error = el('div', 'invalid-feedback');
      error.id = `${controlId}-error`;
      described.push(error.id);
      col.appendChild(error);
      control.setAttribute('aria-describedby', described.join(' '));

      const clear = () => {
        control.classList.remove('is-invalid');
        control.removeAttribute('aria-invalid');
        error.textContent = '';
      };
      control.addEventListener('input', clear);
      control.addEventListener('change', clear);
      if (field.rerender) {
        control.addEventListener('change', () => {
          renderFields();
          controls.get(field.key)?.focus();
        });
      }

      controls.set(field.key, control);
      errors.set(field.key, error);
      form.appendChild(col);
    });
  }

  function validate() {
    const values = currentValues();
    let first = null;
    specs.forEach((field) => {
      const raw = values[field.key] ?? '';
      const required = field.required || field.requiredWhen?.(values);
      const control = controls.get(field.key);
      control.classList.remove('is-invalid');
      control.removeAttribute('aria-invalid');
      errors.get(field.key).textContent = '';
      let message = null;
      if (required && !raw) message = field.emptyError ?? t('validation.required', { label: field.label });
      else if (raw && field.maxLength && raw.length > field.maxLength) message = field.lengthError;
      else if (raw && field.validate) message = field.validate(raw, values);
      if (message) {
        control.classList.add('is-invalid');
        control.setAttribute('aria-invalid', 'true');
        errors.get(field.key).textContent = message;
        first = first ?? control;
      }
    });
    first?.focus();
    return !first;
  }

  renderFields();

  const confirmBtn = kitButton(confirm.variant, confirm.icon, confirm.label, 'submit');
  confirmBtn.setAttribute('form', form.id);
  const cancelBtn = kitButton('btn-primary-outline', cancel?.icon ?? 'fa-xmark', cancel?.label ?? t('common.cancel'));
  cancelBtn.setAttribute('data-bs-dismiss', 'modal');
  m.footer.append(confirmBtn, cancelBtn);

  let result = null;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    summary.hidden = true;
    if (!validate()) return;
    const busy = [confirmBtn, cancelBtn, m.close];
    busy.forEach((node) => {
      node.disabled = true;
    });
    try {
      result = (await onConfirm(currentValues())) ?? true;
      m.root.hideModal();
    } catch (error) {
      summaryText.textContent = error?.message ?? t('modal.saveFailed');
      summary.hidden = false;
    } finally {
      busy.forEach((node) => {
        node.disabled = false;
      });
    }
  });

  return presentModal(m.root, () => (form.querySelector('select, input, textarea') ?? confirmBtn).focus()).then(
    () => result,
  );
}


/** The kit's centred `popup-warning` confirm. Resolves true once confirmed. */
function kitConfirm({ title, text, confirmLabel, onConfirm }) {
  modalSeq += 1;
  const labelId = `people-modal-${modalSeq}`;
  const m = modalShell('popup-warning', labelId);
  m.header.appendChild(m.close);
  const sign = el('div', 'status-sign warning');
  sign.appendChild(faIcon('fa-warning'));
  const heading = el('h4', '', title);
  heading.id = labelId;
  const errorLine = el('p', 'danger-color');
  errorLine.setAttribute('role', 'alert');
  errorLine.hidden = true;
  m.body.append(sign, heading, el('p', '', text), errorLine);

  const confirmBtn = kitButton('btn-success', 'fa-check', confirmLabel);
  const backBtn = kitButton('btn-warning-outline', backIcon(), t('kitPeople.backToReview'));
  backBtn.setAttribute('data-bs-dismiss', 'modal');
  m.footer.append(confirmBtn, backBtn);

  let confirmed = false;
  confirmBtn.addEventListener('click', async () => {
    errorLine.hidden = true;
    [confirmBtn, backBtn, m.close].forEach((node) => {
      node.disabled = true;
    });
    try {
      await onConfirm();
      confirmed = true;
      m.root.hideModal();
    } catch (error) {
      errorLine.textContent = error?.message ?? t('modal.saveFailed');
      errorLine.hidden = false;
    } finally {
      [confirmBtn, backBtn, m.close].forEach((node) => {
        node.disabled = false;
      });
    }
  });

  return presentModal(m.root, () => confirmBtn.focus()).then(() => confirmed);
}

// ── #1659 approve ─────────────────────────────────────

approveBtn.addEventListener('click', async () => {
  const confirmed = await kitConfirm({
    title: t('application.approveTitle'),
    text: t('application.approveDescription'),
    confirmLabel: t('kitPeople.approveConfirm'),
    onConfirm: () => mockApi.approveApplication(id),
  });
  if (!confirmed) return;
  await kitResult({ title: t('kitPeople.approvedTitle'), text: t('kitPeople.approvedText') });
  window.location.href = 'driver-applications.html';
});

// ── #1660 reject with reason ──────────────────────────

rejectBtn.addEventListener('click', async () => {
  const result = await kitForm({
    icon: 'rejected-file.svg',
    title: t('application.rejectTitle'),
    intro: t('application.rejectDescription'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('driverProfile.rejectionReason'),
        required: true,
        options: REASON_LISTS.rejection.map((reason) => ({ value: reason, label: reasonLabel(reason) })),
        emptyError: t('application.rejectReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('application.rejectNoteLabel'),
        placeholder: t('kitPeople.rejectNotePlaceholder'),
        maxLength: 500,
        hint: t('application.rejectNoteHint'),
        lengthError: t('driverProfile.noteTooLong'),
      },
    ],
    confirm: { variant: 'btn-danger', icon: 'fa-xmark', label: t('application.rejectBtn') },
    cancel: { icon: backIcon(), label: t('kitPeople.backToReview') },
    onConfirm: (values) => mockApi.rejectApplication(id, values.reason),
  });
  if (!result) return;
  await kitResult({ title: t('kitPeople.rejectedTitle'), text: t('kitPeople.rejectedText') });
  window.location.href = 'driver-applications.html';
});

await load();
