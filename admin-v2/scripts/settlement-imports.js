/**
 * settlement-imports.js — SheDrive admin settlement sheet import
 * Spec: docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md §4 (§1 approvals)
 *
 * Finance sends a CSV of payments drivers have already made to SheDrive. Every
 * row is applied as paid — any amount: less than she owes settles part of it,
 * more adds the extra to her balance. Only two rows can't be applied: a
 * national ID that matches no driver, and a payment reference already imported.
 * The screen sends the rows that can be applied as one `settlement_import`
 * request. Nothing is settled here: a different admin approves it on
 * approvals.html, and only then does each row post a settlement with an
 * S-nnnnn receipt. Rows that can't be applied are never stored.
 *
 * Kit parts: the upload box + attachment row from driver-balance-details'
 * #recordPayoutModal, neutral-widjet KPI tiles, custom-grid-list grids with
 * status lamps, kit alerts, a light-medium-bg table card for the history and a
 * default-modal for an import's detail (`?id=IMP-0001` opens it on load).
 *
 * `?state=empty|loading|error|long` applies to the history grid only. The
 * upload steps are a tool, not a list, so their calls run with the override
 * lifted (see `live()`), and the steps stay usable in every state.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime, formatEgp, formatCount } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { loadBootstrap } from './design-init.js';
import '../components/ad-data-table.js';
import '../components/ad-stat-card.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const fileInput = qs('#sheet-file');
const busy = qs('#upload-busy');
const sheetError = qs('#upload-error');
const resultPanel = qs('#step-result');
const checkTable = qs('#check-table');
const submitButton = qs('#btn-submit');
const submitLabel = qs('#btn-submit-label');
const submitted = qs('#submitted');
const historyTable = qs('#imports-table');
const modalEl = qs('#import-modal');
const rowsTable = qs('#import-rows');

// The kit's Bootstrap modal must sit on <body> so no positioned ancestor traps it.
document.body.appendChild(modalEl);

/** The sheet currently on screen: { fileName, result } or null. */
let current = null;

/**
 * Run a mock-api call with `?state=` lifted from the URL for the duration of
 * the synchronous call (the mock reads the override as its first statement),
 * so the designer states only ever affect the history grid.
 */
function live(call) {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('state')) return call();
  const original = window.location.href;
  url.searchParams.delete('state');
  window.history.replaceState(window.history.state, '', url);
  try {
    return call();
  } finally {
    window.history.replaceState(window.history.state, '', original);
  }
}

// ── Small helpers ────────────────────────────────────
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function ltr(text, className = '') {
  if (text === null || text === undefined || text === '') return null;
  return el('span', `ad-ltr ${className}`.trim(), text);
}

/** Kit status lamp. */
function lamp(className, label) {
  const wrap = el('div', className);
  wrap.append(el('div', 'lamp'), document.createTextNode(label));
  return wrap;
}

/** Money with the kit's colour: what she owes in danger, a credit in success. */
function balance(value) {
  if (value === null || value === undefined) return null;
  const tone = value < 0 ? 'danger-color' : value > 0 ? 'success-color' : '';
  return el('p', `text-bold ad-ltr ${tone}`.trim(), formatEgp(value));
}

/** Two stacked lines — who and when. */
function whoWhen(who, when) {
  if (!who && !when) return null;
  const wrap = el('div', 'si-who');
  wrap.append(el('span', 'ad-ltr', who ?? '—'), el('span', 'si-who__when', when ? formatDateTime(when) : ''));
  return wrap;
}

/** Give an in-memory row list the paginated shape ad-data-table expects. */
const onePage = (rows) => ({ rows, total: rows.length, page: 1, pageSize: Math.max(rows.length, 1), totalPages: 1 });

// ── Labels ───────────────────────────────────────────
const CHANNEL_KEYS = {
  'Bank transfer': 'settlementImports.channelBank',
  Fawry: 'settlementImports.channelFawry',
  'Mobile wallet': 'settlementImports.channelWallet',
  'Field agent': 'settlementImports.channelAgent',
};
const channelLabel = (value) => (CHANNEL_KEYS[value] ? t(CHANNEL_KEYS[value]) : value || null);

/**
 * What a row does to her balance (§4), as a kit lamp: every row is a payment
 * that already went through, so any amount applies. Only an unknown national
 * ID or an already-imported payment reference can't be applied.
 */
function resultLamp(row) {
  if (row.status === 'unknown_driver') return lamp('status-danger-lamp', t('settlementImports.resultUnknownDriver'));
  if (row.status === 'duplicate') return lamp('status-danger-lamp', t('settlementImports.resultDuplicate'));
  switch (row.outcome) {
    case 'full': return lamp('status-active-lamp', t('settlementImports.outcomeFull'));
    case 'partial': return lamp('status-warning-lamp', t('settlementImports.outcomePartial', { owed: formatEgp(-row.balanceAfter) }));
    case 'credit': return lamp('status-blue-lamp', t('settlementImports.outcomeCredit', { extra: formatEgp(Math.min(row.amount, row.balanceAfter)) }));
    default: return lamp('status-active-lamp', t('settlementImports.resultReady'));
  }
}

const IMPORT_STATUS = {
  pending: ['status-warning-lamp', 'settlementImports.statusPending'],
  approved: ['status-active-lamp', 'settlementImports.statusApproved'],
  rejected: ['status-danger-lamp', 'settlementImports.statusRejected'],
};
function importLamp(status) {
  const [cls, key] = IMPORT_STATUS[status] ?? ['status-disabled-lamp', null];
  return lamp(cls, key ? t(key) : status);
}

// ── Step 1 — template ────────────────────────────────
function downloadText(fileName, text) {
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

qs('#btn-template').addEventListener('click', downloadTemplate);

async function downloadTemplate() {
  try {
    const template = await live(() => mockApi.getSettlementTemplate());
    downloadText(template.fileName, template.csv);
  } catch {
    shell.showToast(t('settlementImports.templateFailed'), 'danger', {
      title: t('toast.failedTitle'),
      action: { label: t('toast.retry'), onClick: downloadTemplate },
    });
  }
}

// ── Step 2 — upload (kit upload box + attachment row) ──
const attachment = {
  item: qs('#sheet-attachment'),
  name: qs('#sheet-attachment-name'),
  pct: qs('#sheet-attachment-pct'),
  bar: qs('#sheet-attachment-bar'),
  /** state: 'checking' | 'done' | 'failed'; no file name hides the row. */
  set(fileName, state) {
    this.item.hidden = !fileName;
    this.name.textContent = fileName ?? '';
    const tone = state === 'failed' ? 'bg-danger' : state === 'checking' ? 'progress-bar-striped progress-bar-animated bg-primary' : 'bg-success';
    this.bar.className = `progress-bar ${tone}`;
    this.bar.style.width = '100%';
    this.bar.setAttribute('aria-valuenow', '100');
    this.pct.textContent = state === 'checking' ? '…' : '100%';
  },
};

qs('#sheet-attachment-remove').addEventListener('click', resetSteps);

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    attachment.set(file.name, 'failed');
    showSheetError([t('settlementImports.notCsv')]);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => checkSheet(file.name, String(reader.result ?? ''));
  reader.onerror = () => {
    attachment.set(file.name, 'failed');
    showSheetError([t('settlementImports.readFailed')]);
  };
  reader.readAsText(file);
});

qs('#btn-sample').addEventListener('click', async () => {
  try {
    const sample = await live(() => mockApi.buildSampleSettlementSheet());
    fileInput.value = '';
    await checkSheet(sample.fileName, sample.csv);
  } catch (error) {
    showSheetError([error.message || t('settlementImports.checkFailed')]);
  }
});

function showSheetError(messages) {
  const list = qs('#upload-error-list');
  list.textContent = '';
  messages.forEach((message) => list.appendChild(el('li', '', message)));
  sheetError.hidden = false;
  resultPanel.hidden = true;
  current = null;
}

function detailMessage(detail) {
  if (detail.code === 'missing_column') return t('settlementImports.missingColumn', { column: detail.column });
  if (detail.code === 'empty') return t('settlementImports.emptySheet');
  return detail.message ?? detail.code;
}

async function checkSheet(fileName, csvText) {
  sheetError.hidden = true;
  submitted.hidden = true;
  busy.hidden = false;
  attachment.set(fileName, 'checking');
  try {
    const result = await live(() => mockApi.checkSettlementSheet(csvText));
    current = { fileName, result };
    attachment.set(fileName, 'done');
    renderResult();
  } catch (error) {
    attachment.set(fileName, 'failed');
    const details = Array.isArray(error.details) && error.details.length ? error.details.map(detailMessage) : [error.message || t('settlementImports.checkFailed')];
    showSheetError(details);
  } finally {
    busy.hidden = true;
  }
}

// ── Step 3 — check result ────────────────────────────
checkTable.columns = [
  { key: 'rowNo', label: t('settlementImports.colRow'), numeric: true, render: (r) => String(r.rowNo) },
  // Product rule: national IDs are shown in full.
  { key: 'nationalId', label: t('settlementImports.colNid'), ltr: true, render: (r) => ltr(r.nationalId, 'si-mono') },
  {
    // Name in system, with the sheet's own spelling under it (reference only).
    key: 'systemName',
    label: t('settlementImports.colNameSystem'),
    className: 'si-wrap',
    render: (r) => {
      const stack = el('div', 'si-stack');
      stack.appendChild(r.systemName ? el('p', 'text-bold', r.systemName) : el('p', 'danger-color', t('settlementImports.noMatch')));
      if (r.driverName) stack.appendChild(el('span', 'si-muted', t('kitFinance.siNameInSheet', { name: r.driverName })));
      return stack;
    },
  },
  {
    key: 'amount',
    label: t('settlementImports.colAmountEgp'),
    numeric: true,
    ltr: true,
    render: (r) => el('p', 'text-bold ad-ltr', formatEgp(r.amount)),
  },
  { key: 'balanceBefore', label: t('settlementImports.colBalanceBefore'), numeric: true, ltr: true, render: (r) => balance(r.balanceBefore) },
  { key: 'balanceAfter', label: t('settlementImports.colBalanceAfter'), numeric: true, ltr: true, render: (r) => balance(r.balanceAfter) },
  {
    // Payment reference, with the channel under it.
    key: 'paymentRef',
    label: t('settlementImports.colPaymentRef'),
    render: (r) => {
      const stack = el('div', 'si-stack');
      stack.appendChild(ltr(r.paymentRef, 'si-mono') ?? el('span', '', t('common.notAvailable')));
      const channel = channelLabel(r.channel);
      if (channel) stack.appendChild(el('span', 'si-muted', channel));
      return stack;
    },
  },
  { key: 'status', label: t('settlementImports.colResult'), className: 'si-wrap-wide', render: resultLamp },
];

function setSubmitLabel(text) {
  submitLabel.textContent = text;
}

function readyLabel(readyCount) {
  if (readyCount === 0) return t('settlementImports.submitNone');
  return readyCount === 1 ? t('settlementImports.submitOne') : t('settlementImports.submit', { n: readyCount });
}

function renderResult() {
  const { fileName, result } = current;
  // A sheet can come back null only if the mock is in a designer state; treat it as empty.
  const rows = result?.rows ?? [];
  const readyCount = result?.readyCount ?? 0;
  const rejected = rows.length - readyCount;

  qs('#result-file').textContent = fileName;
  qs('#stat-total').setAttribute('value', formatCount(rows.length));
  qs('#stat-ready').setAttribute('value', formatCount(readyCount));
  qs('#stat-amount').setAttribute('value', formatEgp(result?.readyAmount ?? 0));
  qs('#stat-rejected').setAttribute('value', formatCount(rejected));
  qs('#rejected-note').hidden = rejected === 0;

  checkTable.setData(onePage(rows));

  submitButton.disabled = readyCount === 0;
  setSubmitLabel(readyLabel(readyCount));

  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetSteps() {
  current = null;
  fileInput.value = '';
  attachment.set(null);
  sheetError.hidden = true;
  submitted.hidden = true;
  resultPanel.hidden = true;
  submitButton.disabled = false;
}

qs('#btn-reset').addEventListener('click', resetSteps);

submitButton.addEventListener('click', async () => {
  if (!current?.result?.readyCount) return;
  const label = submitLabel.textContent;
  submitButton.disabled = true;
  setSubmitLabel(t('settlementImports.submitting'));
  try {
    const response = await live(() => mockApi.submitSettlementImport({ fileName: current.fileName, rows: current.result.rows }));
    const requestId = response.request.id;
    const n = current.result.readyCount;
    shell.showToast(t('settlementImports.submitted', { n, id: response.import.id }), 'success');

    qs('#submitted-text').textContent = t('settlementImports.submitted', { n, id: response.import.id });
    const link = qs('#submitted-link');
    link.href = `approvals.html?id=${encodeURIComponent(requestId)}`;
    link.textContent = t('settlementImports.submittedLink', { id: requestId });
    submitted.hidden = false;
    // The rows are now in a pending import; resubmitting them would only be rejected.
    setSubmitLabel(label);
    submitButton.disabled = true;
    loadHistory();
  } catch (error) {
    setSubmitLabel(label);
    submitButton.disabled = false;
    shell.showToast(error.message || t('settlementImports.submitFailed'), 'danger', { title: t('toast.failedTitle') });
  }
});

// ── History ──────────────────────────────────────────
const historyQuery = { page: 1, pageSize: 20 };

historyTable.pageSize = historyQuery.pageSize;
historyTable.columns = [
  { key: 'id', label: t('settlementImports.colImportId'), ltr: true, render: (r) => ltr(r.id, 'si-mono') },
  { key: 'fileName', label: t('settlementImports.colFile'), ltr: true, className: 'si-wrap', render: (r) => ltr(r.fileName) },
  { key: 'createdAt', label: t('settlementImports.colUploaded'), render: (r) => whoWhen(r.createdBy, r.createdAt) },
  {
    key: 'rows',
    label: t('settlementImports.colRows'),
    headerClass: 'si-wrap',
    numeric: true,
    render: (r) => t('settlementImports.rowsOf', { ready: formatCount(r.readyRows), total: formatCount(r.totalRows) }),
  },
  { key: 'amount', label: t('settlementImports.colAmountTotal'), numeric: true, ltr: true, render: (r) => el('p', 'text-bold ad-ltr', formatEgp(r.amount)) },
  { key: 'status', label: t('settlementImports.colStatus'), render: (r) => importLamp(r.status) },
  { key: 'decidedAt', label: t('settlementImports.colDecided'), render: (r) => whoWhen(r.decidedBy, r.decidedAt) },
  {
    key: 'actions',
    label: t('common.actions'),
    render: (r) => {
      // Opens the detail in place (so a sheet being checked above is not lost)
      // and puts `?id=` in the address, the shareable deep link.
      const btn = el('button', 'btn grid-options-btn view-icon');
      btn.type = 'button';
      btn.setAttribute('aria-label', `${t('common.view')} ${r.id}`);
      const i = el('i', 'fa-regular fa-eye');
      i.setAttribute('aria-hidden', 'true');
      // Icon-only, as the kit's admin-accounts row actions are; the label is the title + aria-label.
      btn.title = t('common.view');
      btn.appendChild(i);
      btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('id', r.id);
        window.history.replaceState(window.history.state, '', url);
        openImport(r.id);
      });
      return btn;
    },
  },
];
historyTable.emptyState = {
  icon: 'upload-file.svg',
  heading: t('settlementImports.emptyHeading'),
  message: t('settlementImports.emptyMessage'),
};

historyTable.addEventListener('pagechange', (event) => {
  historyQuery.page = event.detail.page;
  loadHistory();
});
modalEl.addEventListener('hidden.bs.modal', () => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('id')) return;
  url.searchParams.delete('id');
  window.history.replaceState(window.history.state, '', url);
});

const historyGuard = createRequestGuard();

async function loadHistory() {
  const isCurrent = historyGuard();
  historyTable.setLoading();
  try {
    const page = await mockApi.listSettlementImports(historyQuery);
    if (!isCurrent()) return;
    historyTable.setData(page);
  } catch (error) {
    if (!isCurrent()) return;
    historyTable.setError(error.message, loadHistory);
  }
}

// ── Import detail modal ──────────────────────────────
rowsTable.columns = [
  { key: 'rowNo', label: t('settlementImports.colRow'), numeric: true, render: (r) => String(r.rowNo) },
  { key: 'nationalId', label: t('settlementImports.colNid'), ltr: true, render: (r) => ltr(r.nationalId, 'si-mono') },
  { key: 'driverName', label: t('settlementImports.colNameSheet'), render: (r) => r.driverName || null },
  { key: 'amount', label: t('settlementImports.colAmountEgp'), numeric: true, ltr: true, render: (r) => el('p', 'text-bold ad-ltr', formatEgp(r.amount)) },
  { key: 'paymentDate', label: t('common.date'), ltr: true, render: (r) => ltr(r.paymentDate) },
  { key: 'channel', label: t('settlementImports.colChannel'), render: (r) => channelLabel(r.channel) },
  { key: 'paymentRef', label: t('settlementImports.colPaymentRef'), ltr: true, render: (r) => ltr(r.paymentRef, 'si-mono') },
  { key: 'receipt', label: t('settlementImports.colReceipt'), ltr: true, render: (r) => ltr(r.receipt, 'si-mono text-bold') },
];

let modal = null;
async function showModal() {
  await loadBootstrap().catch(() => {});
  if (window.bootstrap?.Modal) {
    modal ??= window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } else {
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
  }
}

/** Kit key/value list in two columns: [[label, value], …]. */
function kvColumns(pairs) {
  const list = el('div', 'list-multi-column no-border p-0');
  const row = el('div', 'row gx-4');
  const half = Math.ceil(pairs.length / 2);
  [pairs.slice(0, half), pairs.slice(half)].forEach((group) => {
    const col = el('div', 'col-md-6');
    group.forEach(([label, value]) => {
      const line = el('div', 'row gx-0 list-row');
      const val = el('div', 'list-item col-auto justify-content-md-end');
      if (value instanceof Node) val.appendChild(value);
      else val.textContent = value ?? t('common.notAvailable');
      line.append(el('div', 'list-item col text-bold', label), val);
      col.appendChild(line);
    });
    row.appendChild(col);
  });
  list.appendChild(row);
  return list;
}

/** The approval request that carries this import, if any. */
async function findRequest(importId) {
  const [pending, decided] = await Promise.all([
    mockApi.listApprovals({ status: 'pending', type: 'settlement_import', pageSize: 1000 }),
    mockApi.listApprovals({ status: 'decided', type: 'settlement_import', pageSize: 1000 }),
  ]);
  return [...(pending?.rows ?? []), ...(decided?.rows ?? [])].find((r) => r.subject?.id === importId) ?? null;
}

async function openImport(id) {
  const detail = qs('#import-detail');
  const detailCard = qs('#import-detail-card');
  const link = qs('#import-approvals-link');
  const note = qs('#import-receipts-note');
  qs('#import-modal-title').textContent = t('settlementImports.detailTitle', { id });
  qs('#import-modal-file').textContent = '';
  modalEl.querySelectorAll('.si-modal-missing').forEach((n) => n.remove());
  detail.textContent = '';
  detailCard.hidden = false;
  note.hidden = true;
  link.hidden = true;
  rowsTable.hidden = false;
  rowsTable.setLoading();
  showModal();

  try {
    const imp = await mockApi.getSettlementImport(id);
    if (!imp) {
      rowsTable.hidden = true;
      detailCard.hidden = true;
      const empty = el('div', 'result-message warning');
      const iconWrap = el('span', 'icon');
      const img = el('img');
      img.src = 'vendor/icons/not-found.svg';
      img.alt = '';
      iconWrap.appendChild(img);
      empty.append(iconWrap, el('h3', '', t('settlementImports.detailNotFound')), el('p', '', t('settlementImports.detailNotFoundHint', { id })));
      detailCard.after(empty);
      empty.classList.add('si-modal-missing');
      return;
    }
    qs('#import-modal-file').textContent = imp.fileName;
    const decidedWho = imp.decidedBy ? whoWhen(imp.decidedBy, imp.decidedAt) : t('common.notAvailable');
    detail.appendChild(kvColumns([
      [t('settlementImports.detailStatus'), importLamp(imp.status)],
      [t('settlementImports.detailRows'), t('settlementImports.rowsOf', { ready: formatCount(imp.readyRows), total: formatCount(imp.totalRows) })],
      [t('settlementImports.detailAmount'), el('p', 'text-bold ad-ltr', formatEgp(imp.amount))],
      [t('settlementImports.detailUploaded'), whoWhen(imp.createdBy, imp.createdAt)],
      [t('settlementImports.detailDecided'), decidedWho],
      [t('settlementImports.detailFile'), ltr(imp.fileName)],
    ]));
    note.hidden = imp.status !== 'pending';
    rowsTable.setData(onePage(imp.rows ?? []));

    const request = await findRequest(imp.id).catch(() => null);
    if (request) {
      link.href = `approvals.html?id=${encodeURIComponent(request.id)}`;
      link.hidden = false;
    }
  } catch (error) {
    rowsTable.setError(error.message, () => openImport(id));
  }
}

// ── Boot ─────────────────────────────────────────────
loadHistory();
const deepLink = new URLSearchParams(window.location.search).get('id');
if (deepLink) openImport(deepLink);
