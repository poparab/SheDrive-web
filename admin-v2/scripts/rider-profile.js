/**
 * rider-profile.js — SheDrive admin rider profile
 * #1662 profile + paginated trip history; #1740 suspend; #1741 reinstate.
 * A rider in Pending review was flagged automatically by a gender-mismatch
 * report (API #1687), so that state links through to the report (#1810).
 *
 * v22-09 kit port: two `col-xl-6` cards, the full-width Trip history card and
 * the bottom action row; Suspend is the kit's `default-modal`, Reinstate its
 * `popup-primary`, each followed by a `popup-success`.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { REASON_LISTS, SAFETY_REPORTS } from './seed.js';
import { formatCount, formatDate, formatDateTime, formatEgp, formatPhone } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { loadBootstrap } from './design-init.js';
import { iconUrl } from '../components/ad-styles.js';
import { reasonKey } from '../i18n/details.js';
import { t, hasKey, isRtl } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#profile-body');
const missing = qs('#profile-missing');
const loadError = qs('#profile-error');
const suspendBtn = qs('#suspend-btn');
const reinstateBtn = qs('#reinstate-btn');
const actionHint = qs('#action-hint');
const tripsTable = qs('#trips-table');

const id = new URLSearchParams(window.location.search).get('id');

/** Translated label for a stored reason string; unknown text passes through. */
function reasonLabel(text) {
  if (!text) return text;
  const key = `reason.${reasonKey(text)}`;
  return hasKey(key) ? t(key) : text;
}

const reasonOptions = (list) => list.map((reason) => ({ value: reason, label: reasonLabel(reason) }));

/** The stored reason values are English; "Other" needs the explanatory note. */
const isOther = (reason) => reason === 'Other' || reason === t('reason.other');

// ── Trip history (#1662 S2) — 10 rows/page ────────────

const tripQuery = { page: 1, pageSize: 10 };

tripsTable.pageSize = tripQuery.pageSize;
tripsTable.columns = [
  {
    key: 'createdAt',
    label: t('field.tripDate'),
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  {
    key: 'destination',
    label: t('riderProfile.colDestination'),
    className: 'ad-table__truncate',
    render: (trip) => trip.destination.address,
  },
  {
    key: 'fare',
    label: t('riderProfile.colFare'),
    numeric: true,
    ltr: true,
    render: (trip) => formatEgp(trip.fare?.total ?? trip.estimate.fare),
  },
  {
    key: 'status',
    label: t('riderProfile.colStatus'),
    render: (trip) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = trip.status;
      return pill;
    },
  },
];

tripsTable.emptyState = {
  icon: '☐',
  heading: t('riderProfile.emptyTripsHeading'),
  message: t('riderProfile.emptyTripsMessage'),
};

tripsTable.addEventListener('pagechange', (event) => {
  tripQuery.page = event.detail.page;
  loadTrips();
});

const tripGuard = createRequestGuard();

async function loadTrips() {
  const isCurrent = tripGuard();
  tripsTable.setLoading();
  try {
    const result = await mockApi.listRiderTrips(id, tripQuery);
    if (!isCurrent()) return;
    tripsTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    tripsTable.setError(error.message, loadTrips);
  }
}

// ── Profile ───────────────────────────────────────────

async function load() {
  let rider;
  try {
    rider = await mockApi.getRider(id);
  } catch {
    loadError.hidden = false;
    missing.hidden = true;
    body.hidden = true;
    return;
  }
  loadError.hidden = true;

  if (!rider) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  qs('#personal').items = [
    { label: t('field.fullName'), value: rider.name },
    { label: t('common.phone'), value: formatPhone(rider.phone), ltr: true },
    { label: t('riderProfile.registeredAt'), value: formatDate(rider.registeredAt) },
  ];

  const pill = document.createElement('ad-status-pill');
  pill.setAttribute('variant', 'chip');
  pill.status = rider.status;

  const statusItems = [
    { label: t('common.status'), value: pill },
    {
      label: t('riderProfile.lastTrip'),
      value: rider.lastTripAt ? formatDate(rider.lastTripAt) : t('riderProfile.emptyTripsHeading'),
    },
    { label: t('field.totalTrips'), value: formatCount(rider.tripsCompleted) },
  ];

  // Money she owes (a cancellation fee) or is owed (a waived fee she had paid).
  const outstanding = rider.outstanding ?? 0;
  const credit = (rider.balance ?? 0) > 0 ? rider.balance : 0;
  if (outstanding > 0) {
    const owed = document.createElement('span');
    owed.className = 'danger-color text-bold';
    owed.textContent = formatEgp(outstanding);
    statusItems.push({ label: t('riderBalances.statOutstanding'), value: owed, ltr: true });
  }
  if (credit > 0) {
    const owed = document.createElement('span');
    owed.className = 'success-color text-bold';
    owed.textContent = formatEgp(credit);
    statusItems.push({ label: t('kitPeople.credit'), value: owed, ltr: true });
  }
  qs('#balance-extra').hidden = !(outstanding > 0 || credit > 0);
  qs('#balance-link').href = `rider-balance-details.html?id=${encodeURIComponent(rider.id)}`;

  if (rider.suspensionReason) {
    statusItems.push({ label: t('riderProfile.suspensionReason'), value: reasonLabel(rider.suspensionReason), wide: true });
  }
  if (rider.suspendedBy) {
    statusItems.push({ label: t('riderProfile.suspendedBy'), value: rider.suspendedBy, ltr: true });
  }
  if (rider.suspendedAt) {
    statusItems.push({ label: t('riderProfile.suspendedOn'), value: formatDateTime(rider.suspendedAt) });
  }
  // Once reinstated, show why — otherwise the account reads as if it were never
  // suspended, and the reversal has no recorded justification.
  if (rider.reinstatement) {
    statusItems.push(
      { label: t('riderProfile.reinstatementReason'), value: reasonLabel(rider.reinstatement.reason), wide: true },
      { label: t('riderProfile.reinstatedBy'), value: rider.reinstatement.by, ltr: true },
      { label: t('riderProfile.reinstatedAt'), value: formatDateTime(rider.reinstatement.at) },
    );
  }

  // #1662 S3 — a Pending review rider links to the report that flagged her.
  if (rider.status === 'pending_review') {
    const report = SAFETY_REPORTS.find((r) => String(r.riderId) === String(rider.id));
    if (report) {
      const link = document.createElement('a');
      link.href = `safety-report.html?id=${report.id}`;
      link.className = 'list__link';
      link.textContent = t('riderProfile.reportLink', { id: report.id });
      statusItems.push({ label: t('riderProfile.reportLabel'), value: link, wide: true });
    } else {
      statusItems.push({
        label: t('riderProfile.reportLabel'),
        value: t('riderProfile.reportUnavailable'),
        muted: true,
        wide: true,
      });
    }
  }

  qs('#status-card').items = statusItems;

  renderActions(rider);
  loadTrips();
}

qs('#retry-btn').addEventListener('click', () => load());

// ── Kit modals ────────────────────────────────────────
// The kit's dialogs, built on <body> per open and removed once closed:
// `default-modal` / `popup-primary` forms with an icon header, the centred
// `popup-warning` confirm and the `popup-success` result. <ad-form-modal> only
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

/** The kit's `popup-success` (or `popup-warning`) result dialog. */
function kitResult({ tone = 'success', title, text, link }) {
  modalSeq += 1;
  const labelId = `people-modal-${modalSeq}`;
  const m = modalShell(`popup-${tone}`, labelId, { staticBackdrop: false });
  m.header.appendChild(m.close);
  const sign = el('div', `status-sign ${tone}`);
  sign.appendChild(faIcon(tone === 'success' ? 'fa-check' : 'fa-warning'));
  const heading = el('h4', '', title);
  heading.id = labelId;
  m.body.append(sign, heading);
  if (text) m.body.appendChild(el('p', '', text));
  const done = kitButton(`btn-${tone}`, 'fa-xmark', t('common.close'));
  done.setAttribute('data-bs-dismiss', 'modal');
  m.footer.appendChild(done);
  if (link) {
    const a = el('a', 'btn btn-primary-outline', link.label);
    a.href = link.href;
    m.footer.appendChild(a);
  }
  return presentModal(m.root, () => done.focus());
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


// ── #1740 suspend / #1741 reinstate ───────────────────

function renderActions(rider) {
  // A Pending review rider is resolved from the safety report, not from here,
  // so this screen only offers the two plain account actions.
  const suspendable = rider.status === 'active';
  const reinstatable = rider.status === 'suspended';

  suspendBtn.hidden = !suspendable;
  reinstateBtn.hidden = !reinstatable;

  if (suspendable) {
    actionHint.textContent = t('riderProfile.hintSuspend');
  } else if (reinstatable) {
    actionHint.textContent = t('riderProfile.hintReinstate');
  } else {
    actionHint.textContent = t('riderProfile.hintUnderReview');
  }
}

function noteField() {
  return {
    key: 'note',
    type: 'textarea',
    label: t('riderProfile.noteLabel'),
    placeholder: t('kitPeople.notePlaceholder'),
    maxLength: 500,
    requiredWhen: (values) => isOther(values.reason),
    emptyError: t('riderProfile.noteEmptyOther'),
    lengthError: t('riderProfile.noteTooLong'),
  };
}

suspendBtn.addEventListener('click', async () => {
  const result = await kitForm({
    icon: 'stop-women.svg',
    title: t('riderProfile.suspendTitle'),
    intro: t('riderProfile.suspendDescription'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('riderProfile.suspensionReason'),
        required: true,
        options: reasonOptions(REASON_LISTS.riderSuspension),
        emptyError: t('riderProfile.suspendReasonEmpty'),
      },
      noteField(),
    ],
    confirm: { variant: 'btn-danger', icon: 'fa-stop', label: t('riderProfile.suspendBtn') },
    cancel: { icon: 'fa-xmark', label: t('common.cancel') },
    onConfirm: async (values) => {
      await mockApi.suspendRider(id, values.reason, values.note);
      await load();
    },
  });
  if (!result) return;
  await kitResult({ title: t('kitPeople.riderSuspendedTitle'), text: t('kitPeople.riderSuspendedText') });
});

reinstateBtn.addEventListener('click', async () => {
  const result = await kitForm({
    kind: 'popup-primary',
    icon: 'checked-women.svg',
    title: t('riderProfile.reinstateTitle'),
    intro: t('riderProfile.reinstateDescription'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('riderProfile.reinstatementReason'),
        required: true,
        options: reasonOptions(REASON_LISTS.riderReinstatement),
        emptyError: t('riderProfile.reinstateReasonEmpty'),
      },
      noteField(),
    ],
    confirm: { variant: 'btn-success', icon: 'fa-play', label: t('riderProfile.reinstateBtn') },
    cancel: { icon: backIcon(), label: t('kitPeople.backToReview') },
    onConfirm: async (values) => {
      await mockApi.reinstateRider(id, values.reason, values.note);
      await load();
    },
  });
  if (!result) return;
  await kitResult({ title: t('kitPeople.riderReinstatedTitle'), text: t('kitPeople.riderReinstatedText') });
});

await load();
