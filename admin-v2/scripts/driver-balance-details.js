/**
 * driver-balance-details.js — one driver's ledger (#1813), kit v22-09
 * `driver-balance-details.html`. Reached from balances.html as
 * driver-balance-details.html?id=<driverId>.
 *
 * The balance is never edited. Recording a settlement or a payout is a
 * maker-checker request (2026-10-14 spec §1): nothing changes until a
 * different admin approves it on approvals.html, and only then is an
 * immutable entry appended to her ledger and the balance recomputed. While a
 * request is pending, its button gives way to a notice that links to it (one
 * pending request per subject).
 *
 * The page also shows her payout position (§3: on hold → due → in a batch →
 * sent to bank → paid), her last failed payout, and her payout method — the
 * destination named in both modals, account number in full.
 *
 * Both modals are the kit's `default-modal` (header icon + title + her name,
 * explanatory paragraph, `alert.info` destination, fields, receipt upload),
 * followed by a toast that says the request was sent for approval.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatDateTime, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { assetUrl, iconUrl } from '../components/ad-styles.js';
import { bindLightbox, loadBootstrap } from './design-init.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const driverId = new URLSearchParams(window.location.search).get('id') ?? '';

const body = qs('#ledger-body');
const missing = qs('#ledger-missing');
const errorHost = qs('#ledger-error');
const ledgerTable = qs('#ledger-table');
const settleBtn = qs('#btn-settle');
const payoutBtn = qs('#btn-payout');

const ledgerQuery = { driverId, page: 1, pageSize: 20 };

let options = { settlementMethods: [], payoutMethods: [], policy: {} };
let driver = null;

// ── Helpers ──────────────────────────────────────────

function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}

function icon(className) {
  const i = el('i', className);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/** Negative means she owes the platform, positive means the platform owes her. */
function signedEgp(balance) {
  if (!balance) return formatEgp(0);
  return balance > 0 ? `+${formatEgp(balance)}` : `−${formatEgp(Math.abs(balance))}`;
}

const ENTRY_LABEL_KEYS = {
  trip_commission: 'balances.entryTripCommission',
  trip_earnings: 'balances.entryTripEarnings',
  driver_cancellation_fee: 'balances.entryDriverCancellationFee',
  rider_cancellation_fee_credit: 'balances.entryRiderCancellationFeeCredit',
  settlement: 'balances.entrySettlement',
  payout: 'balances.entryPayout',
  fee_credit_reversed: 'balancesFinance.entryFeeCreditReversed',
};

/** §3 payout status of a payable entry → [label key, kit solid chip]. */
const PAYOUT_STATUS = {
  on_hold: ['balancesFinance.statusOnHold', 'status-primary-solid'],
  due: ['balancesFinance.statusDue', 'status-warning-solid'],
  in_batch: ['balancesFinance.statusInBatch', 'status-blue-solid'],
  sent: ['balancesFinance.statusSent', 'status-secondary-solid'],
  paid: ['balancesFinance.statusPaid', 'status-active-solid'],
  reversed: ['balancesFinance.statusReversed', 'status-danger-solid'],
};

function payoutStatusChip(row) {
  const [key, className] = PAYOUT_STATUS[row.payoutStatus] ?? [];
  if (!key) return null;
  return el('span', `${className} ledger-chip`, t(key, { date: row.dueAt ? formatDate(row.dueAt) : '' }));
}

/**
 * The receipt photo or transfer slip attached to a money movement (#3982).
 * Seeded entries carry a placeholder path; one recorded in this session carries
 * the data URL of the image the admin picked. Both open in the kit's lightbox.
 */
function proofLink(proof) {
  const href = proof.dataUrl ?? assetUrl(proof.src ?? '');
  if (!href) return null;
  const link = el('a', 'photo-trigger ledger-proof');
  link.href = href;
  link.title = t('balances.proofAlt');
  const thumb = document.createElement('img');
  thumb.src = href;
  thumb.alt = t('balances.proofAlt');
  link.append(thumb, el('span', '', t('balances.proofView')));
  return link;
}

/** "Mobile wallet destination · Vodafone Cash · 01012343205" — the number in full. */
function destinationText(method) {
  if (!method) return t('kitBalances.noDestination');
  return t('kitBalances.destination', {
    method: t(`balancesFinance.type${method.type}`),
    details: [method.provider, method.number].filter(Boolean).join(' · '),
  });
}

// ── Kit modals (default-modal; results are toasts) ───
// Built fresh per open and removed on close, so no state leaks between
// drivers or between a cancelled and a confirmed attempt.

async function showModal(root) {
  document.body.appendChild(root);
  try {
    await loadBootstrap();
  } catch {
    /* fall back to showing the markup ourselves */
  }
  if (window.bootstrap?.Modal) {
    root.addEventListener('hidden.bs.modal', () => root.remove(), { once: true });
    const instance = window.bootstrap.Modal.getOrCreateInstance(root);
    root._hide = () => instance.hide();
    instance.show();
    return;
  }
  const backdrop = el('div', 'modal-backdrop fade show');
  const onKey = (event) => {
    if (event.key === 'Escape') root._hide();
  };
  root._hide = () => {
    root.remove();
    backdrop.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    root.dispatchEvent(new Event('hidden.bs.modal'));
  };
  root.classList.add('show');
  root.style.display = 'block';
  root.removeAttribute('aria-hidden');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('role', 'dialog');
  document.body.append(backdrop);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-bs-dismiss="modal"]').forEach((b) => b.addEventListener('click', () => root._hide()));
}

let modalCount = 0;

function modalShell(className) {
  modalCount += 1;
  const root = el('div', `modal fade ${className}`);
  root.id = `bd-modal-${modalCount}`;
  root.tabIndex = -1;
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('aria-labelledby', `${root.id}-title`);
  const dialog = el('div', 'modal-dialog modal-dialog-centered');
  const content = el('div', 'modal-content');
  dialog.appendChild(content);
  root.appendChild(dialog);
  return { root, content };
}

function closeButton() {
  const close = el('button', 'btn-close');
  close.type = 'button';
  close.setAttribute('data-bs-dismiss', 'modal');
  close.setAttribute('aria-label', t('aria.closeDialog'));
  return close;
}

/**
 * Sent for approval — never "recorded". A toast with an "Open request" action;
 * the kit's popup-success asked nothing of the admin but to close it.
 */
function showSentForApproval(request, message) {
  document.querySelector('ad-shell').showToast(message, 'success', {
    title: t('kitBalances.sentTitle'),
    action: request?.id ? { label: t('balancesFinance.openRequest'), href: approvalHref(request.id) } : null,
  });
}

/**
 * A kit default-modal form.
 * fields: { key, type: number|date|text|textarea|select|image, label, required,
 *           min, max, maxLength, notFuture, options, value, placeholder,
 *           emptyError, invalidError, rangeError, lengthError }
 */
function openFormModal({ iconName, title, name, description, alertText, alertTone = 'info', fields, confirmLabel, confirmClass, confirmIcon, onSubmit }) {
  const { root, content } = modalShell('default-modal');
  root.setAttribute('data-bs-backdrop', 'static');

  const header = el('div', 'modal-header');
  const headIcon = el('img', 'icon');
  headIcon.src = iconUrl(iconName);
  headIcon.alt = '';
  // The name now sits on its own line under the title, so drop the old "Title —" joiner.
  const h3 = el('h3', '', String(title).replace(/\s*[—–-]\s*$/, ''));
  h3.id = `${root.id}-title`;
  // Kit v22-10: the title and the driver's name stack in a `.title` block.
  const titleBlock = el('div', 'title');
  titleBlock.append(h3, el('span', '', name));
  header.append(headIcon, titleBlock, closeButton());

  const mbody = el('div', 'modal-body');
  mbody.appendChild(el('p', 'small lh-sm', description));
  if (alertText) {
    const alert = el('div', `alert ${alertTone} mt-3`);
    alert.append(icon(alertTone === 'info' ? 'fa-solid fa-circle-info' : 'fa-solid fa-triangle-exclamation'), el('p', '', alertText));
    mbody.appendChild(alert);
  }
  const summary = el('div', 'alert danger mt-2 ledger-form-summary');
  summary.setAttribute('role', 'alert');
  summary.hidden = true;
  const summaryText = el('p');
  summary.append(icon('fa-solid fa-circle-exclamation'), summaryText);

  const form = el('form', 'row');
  form.noValidate = true;
  const controls = new Map();
  const errors = new Map();
  const images = new Map();

  fields.forEach((field) => {
    const col = el('div', 'col-12');
    const id = `${root.id}-${field.key}`;
    const error = el('p', 'ledger-field-error');
    error.id = `${id}-error`;
    error.hidden = true;
    errors.set(field.key, error);

    if (field.type === 'image') {
      const group = el('div', 'input-group mt-3');
      const input = el('input', 'form-control custom-file-input');
      input.type = 'file';
      input.id = id;
      input.accept = 'image/jpeg,image/png';
      const label = el('label', 'custom-file-label');
      label.htmlFor = id;
      const up = el('img');
      up.src = iconUrl('upload.svg');
      up.alt = '';
      label.append(up, ` ${field.label} — ${t('kitBalances.uploadPrompt')} `, el('span', '', t('kitBalances.uploadLimits')));
      group.append(input, label);

      const item = el('div', 'attachment-item');
      item.hidden = true;
      const progressTitle = el('div', 'progress-title');
      const details = el('div', 'details');
      const fileName = el('span', 'title');
      details.append(fileName, el('span', 'percentage', '%100'));
      const progress = el('div', 'progress');
      const bar = el('div', 'progress-bar bg-success w-100');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuenow', '100');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      progress.appendChild(bar);
      progressTitle.append(details, progress);
      const closeWrap = el('div', 'close-button-container');
      const remove = el('a', 'close-button');
      remove.href = '#';
      remove.setAttribute('role', 'button');
      remove.setAttribute('aria-label', t('kitBalances.removeFile'));
      remove.appendChild(icon('fa-solid fa-circle-xmark'));
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        images.delete(field.key);
        input.value = '';
        item.hidden = true;
      });
      closeWrap.appendChild(remove);
      item.append(progressTitle, closeWrap);

      input.addEventListener('change', () => {
        images.delete(field.key);
        item.hidden = true;
        error.hidden = true;
        const file = input.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
          input.value = '';
          error.textContent = t('validation.imageType');
          error.hidden = false;
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          input.value = '';
          error.textContent = t('validation.imageSize', { max: 5 });
          error.hidden = false;
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          images.set(field.key, { name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result) });
          fileName.textContent = file.name;
          item.hidden = false;
        };
        reader.readAsDataURL(file);
      });

      col.append(group, error, item);
      form.appendChild(col);
      return;
    }

    const label = el('label', '', field.label);
    label.htmlFor = id;
    if (field.required) {
      label.append(' ', el('span', 'danger-color', '*'));
    }
    let control;
    if (field.type === 'select') {
      control = el('select', 'form-select');
      const placeholder = el('option', '', t('modal.selectPlaceholder'));
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
    } else {
      control = el('input', 'form-control');
      control.type = field.type;
      if (field.type === 'number') {
        control.step = '0.01';
        control.min = '0.01';
        control.inputMode = 'decimal';
      }
      if (field.type === 'date' && field.notFuture) control.max = toDateInputValue(Date.now());
    }
    if (field.ltr) control.dir = 'ltr';
    if (field.placeholder) control.placeholder = field.placeholder;
    control.id = id;
    control.setAttribute('aria-describedby', error.id);
    control.value = field.value ?? '';
    control.addEventListener('input', () => {
      error.hidden = true;
      control.classList.remove('is-invalid');
    });
    controls.set(field.key, control);
    col.append(label, control, error);
    form.appendChild(col);
  });

  mbody.append(summary, form);

  function validateField(field, raw) {
    const value = String(raw ?? '').trim();
    if (!value) return field.required ? field.emptyError : null;
    if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) return field.invalidError;
      if (n < 0.01 || (field.max !== undefined && n > field.max)) return field.rangeError;
    }
    if (field.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return field.invalidError;
      if (field.notFuture && value > toDateInputValue(Date.now())) return field.rangeError;
    }
    if (field.maxLength && value.length > field.maxLength) return field.lengthError;
    if (field.minLength && value.length < field.minLength) return field.lengthError;
    return null;
  }

  const footer = el('div', 'modal-footer mt-2');
  const confirm = el('button', `btn ${confirmClass}`);
  confirm.type = 'button';
  const confirmText = el('span', '', confirmLabel);
  confirm.append(icon(confirmIcon), confirmText);
  const cancel = el('button', 'btn btn-primary-outline');
  cancel.type = 'button';
  cancel.setAttribute('data-bs-dismiss', 'modal');
  cancel.append(icon('fa-solid fa-xmark'), el('span', '', t('common.cancel')));
  footer.append(confirm, cancel);

  async function submit() {
    summary.hidden = true;
    const values = {};
    let firstInvalid = null;
    fields.forEach((field) => {
      if (field.type === 'image') {
        values[field.key] = images.get(field.key) ?? null;
        return;
      }
      const control = controls.get(field.key);
      values[field.key] = control.value.trim();
      const message = validateField(field, control.value);
      const error = errors.get(field.key);
      error.hidden = !message;
      error.textContent = message ?? '';
      control.classList.toggle('is-invalid', Boolean(message));
      control.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (message && !firstInvalid) firstInvalid = control;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    confirm.disabled = true;
    try {
      const result = await onSubmit(values);
      root.addEventListener('hidden.bs.modal', () => result?.after?.(), { once: true });
      root._hide();
    } catch (error) {
      summaryText.textContent = error?.message ?? String(error);
      summary.hidden = false;
      confirm.disabled = false;
    }
  }

  confirm.addEventListener('click', submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  content.append(header, mbody, footer);
  root.addEventListener('shown.bs.modal', () => form.querySelector('input:not([type=file]), select, textarea')?.focus(), { once: true });
  showModal(root);
}

// ── Ledger table ─────────────────────────────────────
ledgerTable.pageSize = ledgerQuery.pageSize;
ledgerTable.columns = [
  { key: 'at', label: t('balances.colDate'), render: (row) => el('p', '', formatDate(row.at)) },
  {
    key: 'type',
    label: t('balances.colType'),
    render: (row) => el('p', '', ENTRY_LABEL_KEYS[row.type] ? t(ENTRY_LABEL_KEYS[row.type]) : row.type),
  },
  {
    key: 'amount',
    label: t('balances.colAmount'),
    numeric: true,
    render: (row) =>
      el(
        'p',
        `text-bold ${row.amount >= 0 ? 'success-color' : 'danger-color'}`,
        `${row.amount >= 0 ? '+' : '−'}${formatEgp(Math.abs(row.amount))}`,
      ),
  },
  {
    key: 'source',
    label: t('balances.colSource'),
    ltr: true,
    render: (row) => {
      const source = row.tripId ?? row.ref ?? null;
      return source ? el('p', '', source) : null;
    },
  },
  {
    // The receipt or transfer slip attached when the settlement or payout was recorded (#3982).
    key: 'proof',
    label: t('balances.colProof'),
    render: (row) => (row.proof ? proofLink(row.proof) : null),
  },
  {
    // §3 — only payable entries (trip earnings, rider fee credits) have one.
    key: 'payoutStatus',
    label: t('balancesFinance.colPayout'),
    render: (row) => (row.payoutStatus ? payoutStatusChip(row) : null),
  },
];
ledgerTable.emptyState = {
  icon: '☐',
  heading: t('balances.ledgerEmptyHeading'),
  message: t('balances.ledgerEmptyMessage'),
};
ledgerTable.addEventListener('pagechange', (event) => {
  ledgerQuery.page = event.detail.page;
  load();
});

// ── Render ───────────────────────────────────────────

function renderTitle(d) {
  const title = t('kitBalances.ledgerFor', { name: d.name });
  const heading = qs('#ad-page-title');
  if (heading) heading.textContent = title;
  document.title = `${t('shell.brand')} — ${title}`;
}

function renderFailure(d) {
  const band = qs('#ledger-failure');
  const failure = d.lastPayoutFailure;
  band.hidden = !failure;
  if (!failure) return;
  qs('#ledger-failure-text').textContent = `${t('balancesFinance.lastPayoutFailed', {
    reason: failure.reason,
    batchId: failure.batchId,
  })} `;
  qs('#ledger-failure-link').href = `payout-batch.html?id=${encodeURIComponent(failure.batchId)}`;
}

/** One pending request per subject (§1): its button gives way to a notice. */
function renderPending(button, noticeId, pending, key) {
  const notice = qs(noticeId);
  button.hidden = Boolean(pending);
  notice.hidden = !pending;
  notice.textContent = '';
  if (!pending) return;
  notice.append(
    icon('fa-regular fa-hourglass-half'),
    el('span', '', t(key, { maker: pending.maker, time: formatDateTime(pending.madeAt) })),
  );
  notice.href = approvalHref(pending.id);
}

function renderKpis(d) {
  const balanceCard = qs('#kpi-balance');
  balanceCard.setAttribute('tone', d.balance > 0 ? 'success' : d.balance < 0 ? 'danger' : 'primary');
  balanceCard.value = signedEgp(d.balance);
  const position = d.position ?? { onHold: 0, due: 0, inBatch: 0, sent: 0 };
  qs('#kpi-on-hold').value = formatEgp(position.onHold);
  qs('#kpi-due').value = formatEgp(position.due);
  qs('#kpi-in-batch').value = formatEgp(position.inBatch);
  qs('#kpi-sent').value = formatEgp(position.sent);
}

function render(d) {
  renderTitle(d);
  renderFailure(d);
  renderKpis(d);
  renderPending(settleBtn, '#settle-pending', d.pendingSettlement, 'balancesFinance.pendingSettlement');
  renderPending(payoutBtn, '#payout-pending', d.pendingPayout, 'balancesFinance.pendingPayout');
  // Settling is only meaningful when the balance is negative (#1813 S7).
  settleBtn.disabled = d.balance >= 0;
  // A manual payout only needs money owed (§3: amount ≤ her balance).
  payoutBtn.disabled = !(d.balance > 0);
}

function showMissing() {
  body.hidden = true;
  errorHost.hidden = true;
  missing.hidden = false;
}

function showError(message) {
  body.hidden = true;
  missing.hidden = true;
  errorHost.hidden = false;
  errorHost.textContent = '';
  const state = document.createElement('ad-empty-state');
  state.setAttribute('icon', 'cloud-connection-off.svg');
  state.setAttribute('tone', 'danger');
  state.setAttribute('heading', t('kitBalances.loadErrorHeading'));
  state.setAttribute('message', message);
  const retry = el('button', 'btn btn-primary-rounded-outline', t('common.tryAgain'));
  retry.type = 'button';
  retry.addEventListener('click', () => {
    errorHost.hidden = true;
    body.hidden = false;
    load();
  });
  state.appendChild(retry);
  errorHost.appendChild(state);
}

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  ledgerTable.setLoading();
  try {
    const result = await mockApi.getDriverLedger(ledgerQuery);
    if (!isCurrent()) return;
    driver = result.driver;
    render(driver);
    ledgerTable.setData(result);
    bindLightbox(ledgerTable);
  } catch (error) {
    if (!isCurrent()) return;
    if (error?.status === 404) showMissing();
    else showError(error?.message ?? String(error));
  }
}

// ── Record settlement (#1813 S3–S7) ──────────────────
settleBtn.addEventListener('click', () => {
  if (!driver) return;
  const owed = driver.balance < 0 ? Math.abs(driver.balance) : 0;
  const today = toDateInputValue(Date.now());
  openFormModal({
    iconName: 'wallet-minus.svg',
    title: t('kitBalances.settleModalTitle'),
    name: driver.name,
    description: `${t('balances.settleDescription', { amount: formatEgp(owed) })} ${t('balancesFinance.needsApproval')}`,
    alertText: destinationText(driver.payoutMethod),
    alertTone: driver.payoutMethod ? 'info' : 'warning',
    confirmLabel: t('balances.recordSettlement'),
    confirmClass: 'btn-success',
    confirmIcon: 'fa-regular fa-circle-down',
    fields: [
      {
        // Deliberately uncapped (#3982): a surplus becomes an available balance.
        key: 'amount',
        type: 'number',
        required: true,
        ltr: true,
        label: t('balances.settleAmount'),
        emptyError: t('balances.errAmountEmpty'),
        invalidError: t('balances.errAmountInvalid'),
        rangeError: t('balances.errAmountRange'),
      },
      {
        key: 'date',
        type: 'date',
        required: true,
        notFuture: true,
        value: today,
        label: t('balances.settleDate'),
        emptyError: t('balances.errDateEmpty'),
        invalidError: t('balances.errDateInvalid'),
        rangeError: t('balances.errDateFuture'),
      },
      {
        key: 'method',
        type: 'select',
        required: true,
        label: t('balances.settleMethod'),
        value: options.settlementMethods[0] ?? '',
        options: options.settlementMethods.map((m) => ({ value: m, label: m })),
        emptyError: t('balances.errMethodEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('balances.settleNote'),
        maxLength: 500,
        lengthError: t('balances.errNoteLength'),
      },
      { key: 'proof', type: 'image', label: t('balances.settleProof') },
    ],
    onSubmit: async (values) => {
      // A request, not a posting (§1): the balance stays until a second admin approves.
      const result = await mockApi.recordSettlement(driver.id, values);
      return {
        after: () => {
          showSentForApproval(result.request, t('kitBalances.sentMessage'));
          load();
        },
      };
    },
  });
});

// ── Record payout (spec §3) ──────────────────────────
// One-off transfers outside a batch: Finance has already sent the money. It is
// a `payout` request — on approval it posts the debit and pays her oldest due
// entries first.
payoutBtn.addEventListener('click', () => {
  if (!driver) return;
  const max = driver.balance > 0 ? driver.balance : 0;
  const today = toDateInputValue(Date.now());
  openFormModal({
    iconName: 'wallet-plus.svg',
    title: t('kitBalances.payoutModalTitle'),
    name: driver.name,
    description: `${t('balancesFinance.payoutDescription', { amount: formatEgp(max) })} ${t('balancesFinance.needsApproval')}`,
    alertText: destinationText(driver.payoutMethod),
    alertTone: driver.payoutMethod ? 'info' : 'warning',
    confirmLabel: t('balances.recordPayout'),
    confirmClass: 'btn-primary',
    confirmIcon: 'fa-regular fa-circle-up',
    fields: [
      {
        key: 'amount',
        type: 'number',
        required: true,
        ltr: true,
        max,
        label: t('balances.payoutAmount'),
        emptyError: t('balances.errPayoutAmountEmpty'),
        invalidError: t('balances.errPayoutAmountInvalid'),
        rangeError: t('balances.errPayoutAmountRange', { max: formatEgp(max) }),
      },
      {
        key: 'date',
        type: 'date',
        required: true,
        notFuture: true,
        value: today,
        label: t('balances.payoutDate'),
        emptyError: t('balances.errPayoutDateEmpty'),
        invalidError: t('balances.errPayoutDateInvalid'),
        rangeError: t('balances.errPayoutDateFuture'),
      },
      {
        key: 'reference',
        type: 'text',
        required: true,
        ltr: true,
        maxLength: 60,
        label: t('balances.payoutReference'),
        emptyError: t('balances.errPayoutReferenceEmpty'),
        lengthError: t('balances.errPayoutReferenceLength'),
      },
      { key: 'proof', type: 'image', label: t('balances.payoutProof') },
    ],
    onSubmit: async (values) => {
      const result = await mockApi.recordPayout(driver.id, values);
      return {
        after: () => {
          showSentForApproval(result.request, t('kitBalances.sentMessage'));
          load();
        },
      };
    },
  });
});

// A request's link opens the review here; a decision reloads this screen.
wireInPlaceApprovals({ onDecided: load });

// ── Boot ─────────────────────────────────────────────
if (!driverId) {
  showMissing();
} else {
  load();
  mockApi
    .getFinanceOptions()
    .then((result) => {
      options = result ?? options;
    })
    .catch(() => {});
}
