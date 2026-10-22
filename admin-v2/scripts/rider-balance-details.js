/**
 * rider-balance-details.js — one rider's fee ledger (FIN-11), kit v22-09
 * `rider-balance-details.html`. Reached from rider-balances.html as
 * rider-balance-details.html?id=<riderId>.
 *
 * One cancellation fee at a time can be waived (2026-10-14 spec §5). The kit
 * waives the whole outstanding amount from a single header button; the spec
 * waives ONE fee, so the action sits on each fee row and opens the kit's
 * waiver `default-modal` for that fee. Waiving is a maker-checker request
 * (§1): nothing changes until a different admin approves it, and then the
 * rider ledger posts `fee_waived` and the credited driver's ledger posts
 * `fee_credit_reversed`. A waived fee she had already paid leaves her a
 * credit — shown, not spent, this phase. Persistent abuse stays a human
 * decision, handled from her profile (the "View profile" link).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';
import { loadBootstrap } from './design-init.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const riderId = new URLSearchParams(window.location.search).get('id') ?? '';

const body = qs('#ledger-body');
const missing = qs('#ledger-missing');
const errorHost = qs('#ledger-error');
const ledgerTable = qs('#ledger-table');

const ledgerQuery = { riderId, page: 1, pageSize: 20 };

let rider = null;

const REASON_MIN = 10;
const REASON_MAX = 500;

const ENTRY_LABEL_KEYS = {
  cancellation_fee: 'riderBalances.entryCancellationFee',
  fee_collected: 'riderBalances.entryFeeCollected',
  fee_waived: 'riderBalancesFinance.entryFeeWaived',
};

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

/** A kit status chip: `<div class="status-approved"><div class="icon"><i></i></div>text</div>`. */
function statusChip(className, iconClass, text) {
  const chip = el('div', `${className} ledger-chip`);
  const wrap = el('div', 'icon');
  wrap.appendChild(icon(iconClass));
  chip.append(wrap, text);
  return chip;
}

// ── Kit modals (default-modal; results are toasts) ───
// Built fresh per open and removed on close.

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
  root.id = `rbd-modal-${modalCount}`;
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

/** The kit's success popup, worded as a request sent for approval. */
function showSentForApproval(request) {
  // A toast with an "Open request" action; the kit's popup-success asked
  // nothing of the admin but to close it.
  document.querySelector('ad-shell').showToast(t('kitBalances.waiverSentMessage'), 'success', {
    title: t('kitBalances.sentTitle'),
    action: request?.id ? { label: t('riderBalancesFinance.openRequest'), href: approvalHref(request.id) } : null,
  });
}

// ── Waive fee (2026-10-14 spec §5) ───────────────────
function openWaiver(entry) {
  if (!rider) return;
  const { root, content } = modalShell('default-modal');
  root.setAttribute('data-bs-backdrop', 'static');

  const header = el('div', 'modal-header');
  const headIcon = el('img', 'icon');
  headIcon.src = iconUrl('money-slash.svg');
  headIcon.alt = '';
  const h3 = el('h3', '', t('kitBalances.waiveModalTitle'));
  h3.id = `${root.id}-title`;
  header.append(headIcon, h3, el('span', 'tertiary-color text-bold', rider.name), closeButton());

  const mbody = el('div', 'modal-body');
  const intro = el('p', 'small lh-sm mb-2');
  intro.textContent = t('kitBalances.waiveIntro', {
    amount: formatEgp(Math.abs(entry.amount)),
    trip: entry.tripId ?? t('common.notAvailable'),
  });
  // The driver's share is removed too, and another admin must approve.
  const note = el('div', 'alert info mt-2');
  note.append(icon('fa-solid fa-circle-info'), el('p', '', t('riderBalancesFinance.waiveDescription')));

  const summary = el('div', 'alert danger mt-2 ledger-form-summary');
  summary.setAttribute('role', 'alert');
  summary.hidden = true;
  const summaryText = el('p');
  summary.append(icon('fa-solid fa-circle-exclamation'), summaryText);

  const form = el('form', 'row');
  form.noValidate = true;
  const col = el('div', 'col-12');
  const id = `${root.id}-reason`;
  const label = el('label', '', t('riderBalancesFinance.waiveReason'));
  label.htmlFor = id;
  label.append(' ', el('span', 'danger-color', '*'));
  const reason = el('textarea', 'form-control');
  reason.id = id;
  reason.rows = 3;
  reason.maxLength = REASON_MAX;
  reason.placeholder = t('kitBalances.waiveReasonPlaceholder');
  const hint = el('p', 'ledger-field-hint', t('riderBalancesFinance.waiveReasonHint'));
  hint.id = `${id}-hint`;
  const error = el('p', 'ledger-field-error');
  error.id = `${id}-error`;
  error.hidden = true;
  reason.setAttribute('aria-describedby', `${hint.id} ${error.id}`);
  reason.addEventListener('input', () => {
    error.hidden = true;
    reason.classList.remove('is-invalid');
    reason.setAttribute('aria-invalid', 'false');
  });
  col.append(label, reason, error, hint);
  form.appendChild(col);
  mbody.append(intro, note, summary, form);

  const footer = el('div', 'modal-footer mt-4');
  const confirm = el('button', 'btn btn-success');
  confirm.type = 'button';
  const confirmIcon = el('img', 'icon');
  confirmIcon.src = iconUrl('money-slash.svg');
  confirmIcon.alt = '';
  confirm.append(confirmIcon, el('span', '', t('kitBalances.waiveButton')));
  const cancel = el('button', 'btn btn-primary-outline');
  cancel.type = 'button';
  cancel.setAttribute('data-bs-dismiss', 'modal');
  cancel.append(icon('fa-solid fa-xmark'), el('span', '', t('common.cancel')));
  footer.append(confirm, cancel);

  async function submit() {
    summary.hidden = true;
    const text = reason.value.trim();
    let message = null;
    if (!text) message = t('riderBalancesFinance.errReasonEmpty');
    else if (text.length < REASON_MIN || text.length > REASON_MAX) message = t('riderBalancesFinance.errReasonLength');
    error.textContent = message ?? '';
    error.hidden = !message;
    reason.classList.toggle('is-invalid', Boolean(message));
    reason.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) {
      reason.focus();
      return;
    }
    confirm.disabled = true;
    try {
      const result = await mockApi.requestFeeWaiver(rider.id, entry.id, text);
      root.addEventListener(
        'hidden.bs.modal',
        () => {
          showSentForApproval(result.request);
          load();
        },
        { once: true },
      );
      root._hide();
    } catch (err) {
      summaryText.textContent = err?.message ?? String(err);
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
  root.addEventListener('shown.bs.modal', () => reason.focus(), { once: true });
  showModal(root);
}

// ── Ledger table ─────────────────────────────────────
ledgerTable.pageSize = ledgerQuery.pageSize;
ledgerTable.columns = [
  { key: 'at', label: t('riderBalances.colDate'), render: (row) => el('p', '', formatDate(row.at)) },
  {
    key: 'type',
    label: t('riderBalances.colType'),
    render: (row) => el('p', '', ENTRY_LABEL_KEYS[row.type] ? t(ENTRY_LABEL_KEYS[row.type]) : row.type),
  },
  {
    key: 'amount',
    label: t('riderBalances.colAmount'),
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
    label: t('riderBalances.colSource'),
    ltr: true,
    render: (row) => (row.tripId ? el('p', '', row.tripId) : null),
  },
  {
    key: 'note',
    label: t('riderBalances.colNote'),
    className: 'ledger-note-cell',
    render: (row) => (row.note ? el('p', '', row.note) : null),
  },
  {
    // §5 — one fee at a time, never twice: a waived fee says so, a fee with a
    // waiver awaiting approval links to it, every other fee can be waived.
    key: 'action',
    label: t('common.actions'),
    render: (row) => {
      if (row.type !== 'cancellation_fee') return null;
      if (row.waived) return statusChip('status-approved', 'fa-solid fa-check', t('riderBalancesFinance.waived'));
      if (row.waiverPending) {
        const link = el('a', 'ledger-pending-link');
        link.href = approvalHref(row.waiverPending.id);
        link.appendChild(statusChip('status-pending', 'fa-regular fa-hourglass-half', t('riderBalancesFinance.waiverPending')));
        return link;
      }
      const button = el('button', 'btn grid-options-btn approved-icon');
      button.type = 'button';
      button.title = t('riderBalancesFinance.waive');
      button.append(icon('fa-solid fa-hand-holding-dollar'), el('span', 'link', t('riderBalancesFinance.waive')));
      button.addEventListener('click', () => openWaiver(row));
      return button;
    },
  },
];
ledgerTable.emptyState = {
  icon: '☐',
  heading: t('riderBalances.ledgerEmptyHeading'),
  message: t('riderBalances.ledgerEmptyMessage'),
};
ledgerTable.addEventListener('pagechange', (event) => {
  ledgerQuery.page = event.detail.page;
  load();
});

// ── Render ───────────────────────────────────────────

function render(r) {
  const title = t('kitBalances.ledgerFor', { name: r.name });
  const heading = qs('#ad-page-title');
  if (heading) heading.textContent = title;
  document.title = `${t('shell.brand')} — ${title}`;

  qs('#kpi-outstanding').value = r.outstanding > 0 ? `−${formatEgp(r.outstanding)}` : formatEgp(0);

  // §5 — the credit is shown, not spent, in this phase.
  const credit = qs('#kpi-credit');
  credit.hidden = !(r.credit > 0);
  if (r.credit > 0) {
    credit.value = `+${formatEgp(r.credit)}`;
    credit.meta = t('kitBalances.creditMeta');
  }

  qs('#btn-view-profile').href = `rider-profile.html?id=${encodeURIComponent(r.id)}`;
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
    const result = await mockApi.getRiderLedger(ledgerQuery);
    if (!isCurrent()) return;
    rider = result.rider;
    render(rider);
    ledgerTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    if (error?.status === 404) showMissing();
    else showError(error?.message ?? String(error));
  }
}

// A request's link opens the review here; a decision reloads this screen.
wireInPlaceApprovals({ onDecided: load });

if (!riderId) showMissing();
else load();
