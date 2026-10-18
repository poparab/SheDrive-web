/**
 * driver-profile.js — SheDrive admin driver profile
 * #1666 profile with documents, decision history and completed-trip history;
 * #1742 suspend (Pending suspension when the driver is mid-trip); #1743 reinstate.
 * Approve/reject deliberately live on the queue screens, not here.
 *
 * v22-09 kit port: the kit's card grid (driver-profile.html), the kit's
 * Suspend `default-modal` and Reinstate `popup-primary` (driver-unsuspend.html),
 * a toast after each action. The payout method, payout position and
 * decision history are extra cards in the same grid.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { REASON_LISTS } from './seed.js';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatEgp,
  formatPhone,
  humanize,
} from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { withKitArt, kitArt, kitVehiclePhotos } from './doc-images.js';
import { loadBootstrap, bindLightbox } from './design-init.js';
import { iconUrl } from '../components/ad-styles.js';
import { reasonKey } from '../i18n/details.js';
import { t, hasKey, isRtl } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#profile-body');
const missing = qs('#profile-missing');
const banner = qs('#status-banner');
const loadError = qs('#profile-error');
const suspendBtn = qs('#suspend-btn');
const reinstateBtn = qs('#reinstate-btn');
const actionHint = qs('#action-hint');
const tripsTable = qs('#trips-table');

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

const reasonOptions = (list) => list.map((reason) => ({ value: reason, label: reasonLabel(reason) }));

/** The stored reason values are English; "Other" needs the explanatory note. */
const isOther = (reason) => reason === 'Other' || reason === t('reason.other');

// ── Trip history (#1666 S5) — 10 rows/page ────────────

const tripQuery = { page: 1, pageSize: 10 };

tripsTable.pageSize = tripQuery.pageSize;
tripsTable.columns = [
  {
    key: 'createdAt',
    label: t('field.tripDate'),
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  { key: 'destination', label: t('driverProfile.colDestinationArea'), render: (trip) => trip.destination.area },
  {
    key: 'fare',
    label: t('driverProfile.colFare'),
    numeric: true,
    ltr: true,
    render: (trip) => {
      // The kit's fare cell: bold, success-coloured.
      const p = document.createElement('span');
      p.className = 'success-color text-bold';
      p.textContent = formatEgp(trip.fare?.total);
      return p;
    },
  },
  {
    key: 'rating',
    label: t('driverProfile.colRating'),
    render: (trip) => {
      if (!trip.rating) {
        const none = document.createElement('span');
        none.className = 'ad-muted';
        none.textContent = t('field.noRating');
        return none;
      }
      const wrap = document.createElement('span');
      wrap.className = 'list__rating';
      wrap.append(document.createTextNode(String(trip.rating.stars)));
      const star = document.createElement('span');
      star.className = 'warning-color ms-1';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '★';
      wrap.appendChild(star);
      return wrap;
    },
  },
];

tripsTable.emptyState = {
  icon: '☐',
  heading: t('driverProfile.emptyTripsHeading'),
  message: t('driverProfile.emptyTripsMessage'),
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
    const result = await mockApi.listDriverTrips(id, tripQuery);
    if (!isCurrent()) return;
    tripsTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    tripsTable.setError(error.message, loadTrips);
  }
}

// ── Profile ───────────────────────────────────────────

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

function statusChip(status) {
  const pill = document.createElement('ad-status-pill');
  pill.setAttribute('variant', 'chip');
  pill.status = status;
  return pill;
}

async function load() {
  let driver;
  try {
    driver = await mockApi.getDriver(id);
  } catch {
    banner.hide();
    loadError.hidden = false;
    missing.hidden = true;
    body.hidden = true;
    return;
  }
  loadError.hidden = true;

  if (!driver) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;
  renderStatusBanner(driver);

  // ── Account status (the kit's first card) ──
  const decision = driver.decisionHistory.find((entry) => entry.state === 'approved' || entry.state === 'rejected');
  const statusItems = [
    { label: t('common.status'), value: statusChip(driver.status) },
    { label: t('kitPeople.submissionDate'), value: formatDateTime(driver.submittedAt) },
  ];
  if (decision) {
    statusItems.push({ label: t('kitPeople.decisionDate'), value: formatDateTime(decision.at) });
  }
  statusItems.push(
    { label: t('field.onlineNow'), value: driver.online ? t('common.yes') : t('common.no') },
    { label: t('field.homeArea'), value: driver.homeArea },
  );

  // #1666 S3 — a suspended driver shows the recorded reason, plus who suspended
  // her and when. Derived from the decision history rather than stored twice, so
  // it works for both seeded and live suspensions.
  if (driver.suspensionReason) {
    const suspension = [...driver.decisionHistory]
      .reverse()
      .find((entry) => entry.state === 'suspended' || entry.state === 'pending_suspension');

    statusItems.push({
      label: driver.status === 'pending_suspension' ? t('driverProfile.pendingSuspensionReason') : t('driverProfile.suspensionReason'),
      value: reasonLabel(driver.suspensionReason),
      wide: true,
    });
    if (suspension?.actor) {
      statusItems.push({ label: t('driverProfile.suspendedBy'), value: suspension.actor, ltr: true });
    }
    if (suspension?.at) {
      statusItems.push({ label: t('driverProfile.suspendedAt'), value: formatDateTime(suspension.at) });
    }
  }
  if (driver.rejectionReason) {
    statusItems.push({ label: t('driverProfile.rejectionReason'), value: reasonLabel(driver.rejectionReason), wide: true });
  }
  // Once reinstated, show why — otherwise the account reads as if it were never suspended.
  if (driver.reinstatement) {
    statusItems.push(
      { label: t('driverProfile.reinstatementReason'), value: reasonLabel(driver.reinstatement.reason), wide: true },
      { label: t('driverProfile.reinstatedBy'), value: driver.reinstatement.by, ltr: true },
      { label: t('driverProfile.reinstatedAt'), value: formatDateTime(driver.reinstatement.at) },
    );
  }
  qs('#status-card').items = statusItems;

  // ── Personal (national ID in full — product rule) ──
  qs('#personal').items = [
    { label: t('field.fullName'), value: driver.name },
    { label: t('common.phone'), value: formatPhone(driver.phone), ltr: true },
    { label: t('field.dob'), value: formatDate(driver.dob) },
    { label: t('field.nid'), value: driver.nid, ltr: true },
    { label: t('docs.profilePhoto'), value: profilePhoto(driver.profilePhoto, t('docs.profilePhoto')) },
  ];

  qs('#vehicle').items = [
    { label: t('field.make'), value: driver.vehicle.make },
    { label: t('field.model'), value: driver.vehicle.model },
    { label: t('field.year'), value: driver.vehicle.year },
    { label: t('field.plate'), value: driver.vehicle.plate, ltr: true },
    { label: t('field.colour'), value: driver.vehicle.colour },
    { label: t('field.type'), value: driver.vehicle.type },
  ];

  qs('#licence').items = [
    { label: t('field.licenceNumber'), value: driver.licenceNumber, ltr: true },
    { label: t('field.licenceExpiry'), value: formatDate(driver.licenceExpiry) },
    { label: t('field.registrationExpiry'), value: formatDate(driver.registrationExpiry) },
  ];

  qs('#stats').items = [
    { label: t('field.totalTrips'), value: formatCount(driver.tripsCompleted) },
    {
      label: t('driverProfile.avgRating'),
      value: driver.avgRating ? `${driver.avgRating} ★` : t('driverProfile.noRatingsYet'),
    },
    { label: t('kitPeople.cashDue'), value: formatEgp(driver.cashBalance), ltr: true },
  ];

  // Kit artwork stands in for the seed's flat placeholders (presentation only).
  qs('#docs').docs = withKitArt(
    driver.documents.map((doc) => ({
      // The seed is the frozen data layer, so the label is translated here.
      label: hasKey(`docs.${doc.key}`) ? t(`docs.${doc.key}`) : doc.label,
      src: doc.src,
      ref: doc.ref,
      meta: t('docs.uploaded', { date: formatDate(doc.uploadedAt) }),
    })),
  );
  qs('#photos').docs = [
    ...withKitArt([{ label: t('docs.vehiclePhoto'), src: driver.vehiclePhoto }]),
    ...kitVehiclePhotos(formatDate(driver.submittedAt)).slice(1),
  ];
  bindLightbox(qs('#personal'));

  // Decision history for anything past submission (#1666 S2/S3).
  if (driver.decisionHistory.length > 1) {
    qs('#history-section').hidden = false;
    qs('#history').items = driver.decisionHistory.map((entry) => ({
      label: hasKey(`status.${entry.state}`) ? t(`status.${entry.state}`) : humanize(entry.state),
      meta: [formatDateTime(entry.at), entry.actor].filter(Boolean).join(' · '),
      note: reasonLabel(entry.note),
      tone: TONE_BY_STATE[entry.state] ?? 'default',
    }));
  } else {
    qs('#history-section').hidden = true;
  }

  qs('#ledger-link').href = `driver-balance-details.html?id=${encodeURIComponent(driver.id)}`;

  renderActions(driver);
  await loadPayout(driver);
  loadTrips();
}

qs('#retry-btn').addEventListener('click', () => load());

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
 * The result of an action. It used to be the kit's popup-success, which the
 * admin had to close; it needs no decision, so it is a toast now. A link (the
 * approval a change went to) becomes the toast's action.
 */
function kitResult({ tone = 'success', title, text, link }) {
  qs('ad-shell').showToast(text || title, tone, {
    title: text ? title : undefined,
    action: link ? { label: link.label, href: link.href } : null,
  });
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

// ── Payout method (2026-10-14 spec §2) ────────────────

const payoutEditBtn = qs('#payout-edit-btn');
const payoutHint = qs('#payout-hint');
let payoutOptions = null;
let currentDriver = null;
let currentPayout = null;

const typeLabel = (type) => t(`driverPayout.type${type}`);

/** The kit's inline alert: `.alert.<tone> > i + .details > h6 + p (+ a)`. */
function kitAlert(tone, icon, heading, text, link) {
  const box = document.createElement('div');
  box.className = `alert ${tone} mb-0`;
  box.setAttribute('role', 'status');
  const i = document.createElement('i');
  i.className = `fa-solid ${icon}`;
  i.setAttribute('aria-hidden', 'true');
  const details = document.createElement('div');
  details.className = 'details';
  const h = document.createElement('h6');
  h.textContent = heading;
  details.appendChild(h);
  if (text) {
    const p = document.createElement('p');
    p.textContent = text;
    details.appendChild(p);
  }
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    details.appendChild(a);
  }
  box.append(i, details);
  return box;
}

function updatedByText(method) {
  const when = formatDateTime(method.updatedAt);
  return method.updatedBy && method.updatedBy !== 'driver'
    ? t('driverPayout.updatedByAdmin', { when, who: method.updatedBy })
    : t('driverPayout.updatedByDriver', { when });
}

const numberLabel = (type) =>
  ({
    MOBILE_WALLET: t('driverPayout.walletNumber'),
    BANK_ACCOUNT: t('driverPayout.accountNumber'),
    PREPAID_CARD: t('driverPayout.cardNumber'),
  })[type];

async function loadPayout(driver) {
  currentDriver = driver;
  let payout;
  try {
    [payout, payoutOptions] = await Promise.all([
      mockApi.getDriverPayout(driver.id),
      payoutOptions ? Promise.resolve(payoutOptions) : mockApi.getPayoutOptions(),
    ]);
  } catch (error) {
    qs('#payout').items = [{ label: t('driverPayout.type'), value: error.message, muted: true, wide: true }];
    payoutEditBtn.disabled = true;
    return;
  }
  currentPayout = payout;

  const method = payout.method;
  if (method) {
    const isCard = method.type === 'PREPAID_CARD';
    const items = [{ label: t('driverPayout.type'), value: typeLabel(method.type) }];
    if (!isCard) {
      items.push({
        label: method.type === 'MOBILE_WALLET' ? t('driverPayout.walletProvider') : t('driverPayout.bank'),
        value: method.provider,
        ltr: true,
      });
    }
    items.push(
      { label: isCard ? t('driverPayout.cardName') : t('driverPayout.holderName'), value: method.holderName },
      // Shown in full — nothing is masked (2026-10-18).
      { label: numberLabel(method.type), value: method.number, ltr: true },
      { label: t('driverPayout.lastUpdated'), value: updatedByText(method), wide: true },
    );
    qs('#payout').items = items;
  } else {
    qs('#payout').items = [{ label: t('driverPayout.type'), value: t('driverPayout.none'), muted: true, wide: true }];
  }

  const notices = qs('#payout-notices');
  notices.textContent = '';
  if (payout.lastFailure) {
    const f = payout.lastFailure;
    notices.appendChild(
      kitAlert(
        'danger',
        'fa-circle-exclamation',
        t('driverPayout.lastFailed', { reason: f.reason }),
        t('driverPayout.lastFailedMeta', { when: formatDateTime(f.at), lineRef: f.lineRef ?? '—' }),
        f.batchId
          ? { href: `payout-batch.html?id=${encodeURIComponent(f.batchId)}`, label: t('driverPayout.viewBatch') }
          : null,
      ),
    );
  }
  if (payout.pendingChange) {
    const p = payout.pendingChange;
    notices.appendChild(
      kitAlert(
        'warning',
        'fa-hourglass-half',
        t('driverPayout.pendingHeading'),
        t('driverPayout.pendingMeta', { who: p.maker, when: formatDateTime(p.madeAt) }),
        { href: `approvals.html?id=${encodeURIComponent(p.id)}`, label: t('driverPayout.viewRequest') },
      ),
    );
  }
  notices.hidden = !notices.childNodes.length;

  // An admin edit is a request (§1); one pending request per driver.
  const editable = ['approved', 'suspended', 'pending_suspension', 'pending'].includes(driver.status);
  payoutEditBtn.hidden = !editable;
  payoutEditBtn.disabled = Boolean(payout.pendingChange);
  payoutHint.textContent = payout.pendingChange ? t('driverPayout.editLockedHint') : t('driverPayout.editHint');

  const pos = payout.position;
  qs('#payout-position').items = [
    { label: t('driverPayout.positionDue'), value: formatEgp(pos.due), ltr: true },
    { label: t('driverPayout.positionOnHold'), value: formatEgp(pos.onHold), ltr: true },
    { label: t('driverPayout.positionInBatch'), value: formatEgp(pos.inBatch), ltr: true },
    { label: t('driverPayout.positionSent'), value: formatEgp(pos.sent), ltr: true },
  ];
  qs('#payout-position-hint').textContent = t('driverPayout.positionHint', { days: payoutOptions.holdDays });
}

const digitsOnly = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

function holderField(label, emptyError) {
  return {
    key: 'holderName',
    type: 'text',
    label,
    required: true,
    value: currentDriver.name,
    maxLength: 100,
    emptyError,
    lengthError: t('driverPayout.holderLength'),
    validate: (value) => {
      const length = String(value).trim().length;
      return length < 3 || length > 100 ? t('driverPayout.holderLength') : null;
    },
  };
}

/** The type select, then the chosen type's own fields (§2). */
function payoutFields(values) {
  const type = values.type ?? currentPayout?.method?.type ?? '';
  const current = currentPayout?.method?.type === type ? currentPayout.method : null;
  const fields = [
    {
      key: 'type',
      type: 'select',
      label: t('driverPayout.type'),
      required: true,
      rerender: true,
      value: currentPayout?.method?.type ?? '',
      placeholder: t('kitPeople.selectReason'),
      options: payoutOptions.payoutTypes.map((option) => ({ value: option, label: typeLabel(option) })),
      emptyError: t('driverPayout.typeEmpty'),
    },
  ];
  if (type === 'MOBILE_WALLET') {
    fields.push(
      {
        key: 'walletProvider',
        type: 'select',
        label: t('driverPayout.walletProvider'),
        required: true,
        value: current?.provider ?? '',
        options: payoutOptions.walletProviders.map((p) => ({ value: p, label: p })),
        emptyError: t('driverPayout.providerEmpty'),
      },
      {
        key: 'walletNumber',
        type: 'text',
        label: t('driverPayout.walletNumber'),
        required: true,
        ltr: true,
        placeholder: '01XXXXXXXXX',
        hint: t('driverPayout.walletNumberHint'),
        emptyError: t('driverPayout.walletNumberEmpty'),
        validate: (value) => (/^01[0125]\d{8}$/.test(digitsOnly(value)) ? null : t('driverPayout.walletNumberInvalid')),
      },
    );
  } else if (type === 'BANK_ACCOUNT') {
    fields.push(
      {
        key: 'bank',
        type: 'select',
        label: t('driverPayout.bank'),
        required: true,
        value: current?.provider ?? '',
        options: payoutOptions.banks.map((b) => ({ value: b, label: b })),
        emptyError: t('driverPayout.bankEmpty'),
      },
      holderField(t('driverPayout.holderName'), t('driverPayout.holderEmpty')),
      {
        key: 'accountNumber',
        type: 'text',
        label: t('driverPayout.accountNumber'),
        required: true,
        ltr: true,
        hint: t('driverPayout.accountHint'),
        emptyError: t('driverPayout.accountEmpty'),
        validate: (value) => {
          const n = digitsOnly(value);
          return /^\d{10,20}$/.test(n) || /^EG\d{27}$/.test(n) ? null : t('driverPayout.accountInvalid');
        },
      },
    );
  } else if (type === 'PREPAID_CARD') {
    fields.push(holderField(t('driverPayout.cardName'), t('driverPayout.cardNameEmpty')), {
      key: 'cardNumber',
      type: 'text',
      label: t('driverPayout.cardNumber'),
      required: true,
      ltr: true,
      hint: t('driverPayout.cardNumberHint'),
      emptyError: t('driverPayout.cardNumberEmpty'),
      validate: (value) => (/^\d{16}$/.test(digitsOnly(value)) ? null : t('driverPayout.cardNumberInvalid')),
    });
  }
  return fields;
}

/** The kit's `alert.info` with the method in use now, number in full. */
function currentMethodNotice() {
  const method = currentPayout?.method;
  if (!method) return null;
  const parts = [typeLabel(method.type), method.provider, method.number].filter(Boolean).join(' · ');
  const box = el('div', 'alert info mt-3');
  box.append(faIcon('fa-circle-info'), el('p', '', t('kitPeople.currentMethod', { method: parts })));
  return box;
}

payoutEditBtn.addEventListener('click', async () => {
  if (!currentDriver || currentPayout?.pendingChange) return;
  const driver = currentDriver;
  const result = await kitForm({
    icon: 'wallet.svg',
    title: t('kitPeople.payoutEditTitle'),
    subject: driver.name,
    intro: t('driverPayout.chooseDescription'),
    notice: currentMethodNotice(),
    fields: payoutFields,
    confirm: { variant: 'btn-success', icon: 'fa-paper-plane', label: t('driverPayout.sendForApproval') },
    cancel: { icon: 'fa-xmark', label: t('common.cancel') },
    onConfirm: async (values) => {
      // Each type has its own field keys, so switching type never carries a
      // wallet number into a card field.
      const byType = {
        MOBILE_WALLET: { provider: values.walletProvider, number: values.walletNumber },
        BANK_ACCOUNT: { provider: values.bank, number: values.accountNumber },
        PREPAID_CARD: { provider: null, number: values.cardNumber },
      }[values.type];
      const response = await mockApi.requestPayoutMethodChange(driver.id, {
        type: values.type,
        provider: byType.provider || null,
        // A wallet carries no holder field; the data layer defaults it to her name.
        holderName: values.holderName || driver.name,
        number: digitsOnly(byType.number),
      });
      await loadPayout(driver);
      return response;
    },
  });
  if (!result) return;
  const requestId = result.request?.id;
  await kitResult({
    title: t('kitPeople.payoutSentTitle'),
    text: t('driverPayout.toastSent'),
    link: requestId
      ? { href: `approvals.html?id=${encodeURIComponent(requestId)}`, label: t('driverPayout.viewRequest') }
      : null,
  });
});

// ── Status banner ─────────────────────────────────────
// What the account cannot do right now stays on screen for as long as it is
// true; the toast after suspending only reports that the action happened.

function renderStatusBanner(driver) {
  const reason = driver.suspensionReason ?? driver.rejectionReason ?? '';
  switch (driver.status) {
    case 'suspended':
      banner.show({
        tone: 'danger',
        heading: t('banner.driverSuspendedHeading'),
        message: t('banner.driverSuspendedMessage', { reason }),
      });
      break;
    case 'pending_suspension':
      banner.show({
        tone: 'warning',
        heading: t('banner.driverPendingSuspensionHeading'),
        message: t('banner.driverPendingSuspensionMessage', { reason }),
      });
      break;
    case 'pending':
      banner.show({
        tone: 'info',
        heading: t('banner.driverPendingHeading'),
        message: t('banner.driverPendingMessage'),
        action: { label: t('banner.driverPendingAction'), href: `driver-application.html?id=${driver.id}` },
      });
      break;
    case 'rejected':
      banner.show({
        tone: 'info',
        heading: t('banner.driverRejectedHeading'),
        message: t('banner.driverRejectedMessage', { reason }),
      });
      break;
    default:
      banner.hide();
  }
}

// ── #1742 suspend / #1743 reinstate ───────────────────

function renderActions(driver) {
  const suspendable = driver.status === 'approved';
  const reinstatable = driver.status === 'suspended' || driver.status === 'pending_suspension';

  suspendBtn.hidden = !suspendable;
  reinstateBtn.hidden = !reinstatable;

  if (suspendable) {
    actionHint.textContent = t('driverProfile.hintSuspend');
  } else if (reinstatable) {
    actionHint.textContent = t('driverProfile.hintReinstate');
  } else {
    actionHint.textContent =
      driver.status === 'pending' ? t('driverProfile.hintPending') : t('driverProfile.hintRejected');
  }
}

function noteField(emptyError, lengthError) {
  return {
    key: 'note',
    type: 'textarea',
    label: t('driverProfile.noteLabel'),
    placeholder: t('kitPeople.notePlaceholder'),
    maxLength: 500,
    // The story requires a note only when "Other" is the reason.
    requiredWhen: (values) => isOther(values.reason),
    emptyError,
    lengthError,
  };
}

suspendBtn.addEventListener('click', async () => {
  const result = await kitForm({
    icon: 'stop-women.svg',
    title: t('driverProfile.suspendTitle'),
    intro: t('driverProfile.suspendDescription'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('driverProfile.suspensionReason'),
        required: true,
        options: reasonOptions(REASON_LISTS.driverSuspension),
        emptyError: t('driverProfile.suspendReasonEmpty'),
      },
      noteField(t('driverProfile.noteEmptyOther'), t('driverProfile.noteTooLong')),
    ],
    confirm: { variant: 'btn-danger', icon: 'fa-stop', label: t('driverProfile.suspendBtn') },
    cancel: { icon: 'fa-xmark', label: t('common.cancel') },
    onConfirm: async (values) => {
      const response = await mockApi.suspendDriver(id, values.reason, values.note);
      await load();
      return response;
    },
  });
  if (!result) return;
  await kitResult(
    result.pending
      ? { tone: 'warning', title: t('kitPeople.pendingSuspensionTitle'), text: t('driverProfile.toastPendingSuspension') }
      : { title: t('kitPeople.suspendedTitle'), text: t('kitPeople.suspendedText') },
  );
});

reinstateBtn.addEventListener('click', async () => {
  const result = await kitForm({
    kind: 'popup-primary',
    icon: 'checked-women.svg',
    title: t('driverProfile.reinstateTitle'),
    intro: t('driverProfile.reinstateDescription'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('driverProfile.reinstatementReason'),
        required: true,
        options: reasonOptions(REASON_LISTS.driverReinstatement),
        emptyError: t('driverProfile.reinstateReasonEmpty'),
      },
      noteField(t('driverProfile.noteEmptyOther'), t('driverProfile.noteTooLong')),
    ],
    confirm: { variant: 'btn-success', icon: 'fa-play', label: t('driverProfile.reinstateBtn') },
    cancel: { icon: 'fa-xmark', label: t('common.cancel') },
    onConfirm: async (values) => {
      await mockApi.reinstateDriver(id, values.reason, values.note);
      await load();
    },
  });
  if (!result) return;
  await kitResult({ title: t('kitPeople.reinstatedTitle'), text: t('kitPeople.reinstatedText') });
});

await load();
