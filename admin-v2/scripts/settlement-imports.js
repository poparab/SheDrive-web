/**
 * settlement-imports.js — SheDrive admin settlement sheet import
 * Spec: docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md §4 (§1 approvals)
 *
 * Finance sends a CSV of drivers who paid SheDrive. The screen checks every row
 * (national ID match → owes something → unique payment reference → exact
 * amount → nothing already awaiting approval) and submits only the ready rows
 * as one `settlement_import` request. Nothing is settled here: a different
 * admin approves it on approvals.html, and only then does each row post a
 * settlement with an S-nnnnn receipt. Rejected rows are never stored.
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
import '../components/ad-status-pill.js';
import '../components/ad-data-table.js';

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

// ── Labels ───────────────────────────────────────────
const CHANNEL_KEYS = {
  'Bank transfer': 'settlementImports.channelBank',
  Fawry: 'settlementImports.channelFawry',
  'Mobile wallet': 'settlementImports.channelWallet',
  'Field agent': 'settlementImports.channelAgent',
};
const channelLabel = (value) => (CHANNEL_KEYS[value] ? t(CHANNEL_KEYS[value]) : value || null);

/** Check result → [pill status (sets the tone), label]. */
function resultPill(row) {
  const spec = {
    ready: ['approved', t('settlementImports.resultReady')],
    unknown_driver: ['rejected', t('settlementImports.resultUnknownDriver')],
    nothing_owed: ['rejected', t('settlementImports.resultNothingOwed')],
    duplicate: ['rejected', t('settlementImports.resultDuplicate')],
    amount_mismatch: [
      'rejected',
      t('settlementImports.resultAmountMismatch', { amount: formatEgp(row.amount), owed: formatEgp(row.owed) }),
    ],
    pending_approval: ['pending', t('settlementImports.resultPendingApproval')],
  }[row.status] ?? ['rejected', row.status];
  return pill(spec[0], spec[1]);
}

const IMPORT_STATUS_KEYS = {
  pending: 'settlementImports.statusPending',
  approved: 'settlementImports.statusApproved',
  rejected: 'settlementImports.statusRejected',
};

function pill(status, label) {
  const el = document.createElement('ad-status-pill');
  el.setAttribute('status', status);
  el.setAttribute('label', label);
  return el;
}

function ltr(text, className = '') {
  if (text === null || text === undefined || text === '') return null;
  const span = document.createElement('span');
  span.className = `ad-ltr ${className}`.trim();
  span.textContent = text;
  return span;
}

/** Two stacked lines — who and when. */
function whoWhen(who, when) {
  if (!who && !when) return null;
  const wrap = document.createElement('div');
  wrap.className = 'si-who';
  const a = document.createElement('span');
  a.className = 'ad-ltr';
  a.textContent = who ?? '—';
  const b = document.createElement('span');
  b.className = 'si-who__when';
  b.textContent = when ? formatDateTime(when) : '';
  wrap.append(a, b);
  return wrap;
}

/** Give an in-memory row list the paginated shape ad-data-table expects. */
const onePage = (rows) => ({ rows, total: rows.length, page: 1, pageSize: Math.max(rows.length, 1), totalPages: 1 });

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

qs('#btn-template').addEventListener('click', async () => {
  try {
    const template = await live(() => mockApi.getSettlementTemplate());
    downloadText(template.fileName, template.csv);
  } catch {
    shell.showToast(t('settlementImports.templateFailed'), 'danger');
  }
});

// ── Step 2 — upload ──────────────────────────────────
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    showSheetError([t('settlementImports.notCsv')]);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => checkSheet(file.name, String(reader.result ?? ''));
  reader.onerror = () => showSheetError([t('settlementImports.readFailed')]);
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
  messages.forEach((message) => {
    const li = document.createElement('li');
    li.textContent = message;
    list.appendChild(li);
  });
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
  try {
    const result = await live(() => mockApi.checkSettlementSheet(csvText));
    current = { fileName, result };
    renderResult();
  } catch (error) {
    const details = Array.isArray(error.details) && error.details.length ? error.details.map(detailMessage) : [error.message || t('settlementImports.checkFailed')];
    showSheetError(details);
  } finally {
    busy.hidden = true;
  }
}

// ── Step 3 — check result ────────────────────────────
checkTable.columns = [
  { key: 'rowNo', label: t('settlementImports.colRow'), numeric: true, render: (r) => String(r.rowNo) },
  { key: 'nationalId', label: t('settlementImports.colNid'), ltr: true, render: (r) => ltr(r.nationalId, 'si-mono') },
  { key: 'driverName', label: t('settlementImports.colNameSheet'), render: (r) => r.driverName || null },
  {
    key: 'systemName',
    label: t('settlementImports.colNameSystem'),
    render: (r) => {
      if (r.systemName) return r.systemName;
      const span = document.createElement('span');
      span.className = 'si-muted';
      span.textContent = t('settlementImports.noMatch');
      return span;
    },
  },
  {
    key: 'amount',
    label: t('settlementImports.colAmountEgp'),
    numeric: true,
    ltr: true,
    render: (r) => ltr(formatEgp(r.amount), r.status === 'amount_mismatch' ? 'si-amount si-amount--off' : 'si-amount'),
  },
  {
    key: 'owed',
    label: t('settlementImports.colOwed'),
    numeric: true,
    ltr: true,
    render: (r) => (r.driverId ? ltr(formatEgp(r.owed), 'si-amount') : null),
  },
  { key: 'channel', label: t('settlementImports.colChannel'), render: (r) => channelLabel(r.channel) },
  { key: 'paymentRef', label: t('settlementImports.colPaymentRef'), ltr: true, render: (r) => ltr(r.paymentRef, 'si-mono') },
  { key: 'status', label: t('settlementImports.colResult'), render: resultPill },
];

function renderResult() {
  const { fileName, result } = current;
  // A sheet can come back null only if the mock is in a designer state; treat it as empty.
  const rows = result?.rows ?? [];
  const readyCount = result?.readyCount ?? 0;
  const rejected = rows.length - readyCount;

  qs('#result-file').textContent = fileName;
  qs('#stat-total').textContent = formatCount(rows.length);
  qs('#stat-ready').textContent = formatCount(readyCount);
  qs('#stat-amount').textContent = formatEgp(result?.readyAmount ?? 0);
  qs('#stat-rejected').textContent = formatCount(rejected);
  qs('#rejected-note').hidden = rejected === 0;

  checkTable.setData(onePage(rows));

  submitButton.disabled = readyCount === 0;
  submitButton.textContent = readyCount === 0
    ? t('settlementImports.submitNone')
    : readyCount === 1 ? t('settlementImports.submitOne') : t('settlementImports.submit', { n: readyCount });

  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetSteps() {
  current = null;
  fileInput.value = '';
  sheetError.hidden = true;
  submitted.hidden = true;
  resultPanel.hidden = true;
  submitButton.disabled = false;
}

qs('#btn-reset').addEventListener('click', resetSteps);

submitButton.addEventListener('click', async () => {
  if (!current?.result?.readyCount) return;
  const label = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = t('settlementImports.submitting');
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
    submitButton.textContent = label;
    submitButton.disabled = true;
    loadHistory();
  } catch (error) {
    submitButton.textContent = label;
    submitButton.disabled = false;
    shell.showToast(error.message || t('settlementImports.submitFailed'), 'danger');
  }
});

// ── History ──────────────────────────────────────────
const historyQuery = { page: 1, pageSize: 20 };

historyTable.pageSize = historyQuery.pageSize;
historyTable.columns = [
  { key: 'id', label: t('settlementImports.colImportId'), ltr: true, render: (r) => ltr(r.id, 'si-mono') },
  { key: 'fileName', label: t('settlementImports.colFile'), ltr: true, render: (r) => ltr(r.fileName) },
  { key: 'createdAt', label: t('settlementImports.colUploaded'), render: (r) => whoWhen(r.createdBy, r.createdAt) },
  {
    key: 'rows',
    label: t('settlementImports.colRows'),
    numeric: true,
    render: (r) => t('settlementImports.rowsOf', { ready: formatCount(r.readyRows), total: formatCount(r.totalRows) }),
  },
  { key: 'amount', label: t('settlementImports.colAmountTotal'), numeric: true, ltr: true, render: (r) => ltr(formatEgp(r.amount), 'si-amount') },
  {
    key: 'status',
    label: t('settlementImports.colStatus'),
    render: (r) => pill(r.status, IMPORT_STATUS_KEYS[r.status] ? t(IMPORT_STATUS_KEYS[r.status]) : r.status),
  },
  { key: 'decidedAt', label: t('settlementImports.colDecided'), render: (r) => whoWhen(r.decidedBy, r.decidedAt) },
];
historyTable.emptyState = {
  icon: '⇪',
  heading: t('settlementImports.emptyHeading'),
  message: t('settlementImports.emptyMessage'),
};

historyTable.addEventListener('pagechange', (event) => {
  historyQuery.page = event.detail.page;
  loadHistory();
});
// A history row links to `?id=` (shareable, and the deep link a story cites),
// but opens the modal in place so a sheet being checked above is not lost.
historyTable.rowHref = (r) => {
  const url = new URL(window.location.href);
  url.searchParams.set('id', r.id);
  return `${url.pathname}${url.search}`;
};
function interceptRowLink(event) {
  if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
  const tr = event.target.closest('tr[data-row-link]');
  if (!tr || event.target.closest('a, button')) return;
  event.preventDefault();
  event.stopPropagation();
  const id = new URL(tr.dataset.rowLink, window.location.href).searchParams.get('id');
  window.history.replaceState(window.history.state, '', tr.dataset.rowLink);
  openImport(id);
}
historyTable.addEventListener('click', interceptRowLink, true);
historyTable.addEventListener('keydown', interceptRowLink, true);
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
  { key: 'amount', label: t('settlementImports.colAmountEgp'), numeric: true, ltr: true, render: (r) => ltr(formatEgp(r.amount), 'si-amount') },
  { key: 'paymentDate', label: t('common.date'), ltr: true, render: (r) => ltr(r.paymentDate) },
  { key: 'channel', label: t('settlementImports.colChannel'), render: (r) => channelLabel(r.channel) },
  { key: 'paymentRef', label: t('settlementImports.colPaymentRef'), ltr: true, render: (r) => ltr(r.paymentRef, 'si-mono') },
  { key: 'receipt', label: t('settlementImports.colReceipt'), ltr: true, render: (r) => ltr(r.receipt, 'si-mono') },
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

function detailItem(label, value) {
  const item = document.createElement('div');
  item.className = 'si-detail__item';
  const l = document.createElement('span');
  l.className = 'si-detail__label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'si-detail__value';
  if (value instanceof Node) v.appendChild(value);
  else v.textContent = value ?? '—';
  item.append(l, v);
  return item;
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
  const link = qs('#import-approvals-link');
  const note = qs('#import-receipts-note');
  qs('#import-modal-title').textContent = t('settlementImports.detailTitle', { id });
  detail.textContent = '';
  note.hidden = true;
  link.hidden = true;
  rowsTable.hidden = false;
  rowsTable.setLoading();
  showModal();

  try {
    const imp = await mockApi.getSettlementImport(id);
    if (!imp) {
      rowsTable.hidden = true;
      const empty = document.createElement('div');
      empty.className = 'result-message warning';
      const h = document.createElement('h3');
      h.textContent = t('settlementImports.detailNotFound');
      const p = document.createElement('p');
      p.textContent = t('settlementImports.detailNotFoundHint', { id });
      empty.append(h, p);
      detail.appendChild(empty);
      return;
    }
    const decidedWho = imp.decidedBy ? whoWhen(imp.decidedBy, imp.decidedAt) : '—';
    detail.append(
      detailItem(t('settlementImports.detailFile'), ltr(imp.fileName)),
      detailItem(t('settlementImports.detailStatus'), pill(imp.status, IMPORT_STATUS_KEYS[imp.status] ? t(IMPORT_STATUS_KEYS[imp.status]) : imp.status)),
      detailItem(t('settlementImports.detailRows'), t('settlementImports.rowsOf', { ready: formatCount(imp.readyRows), total: formatCount(imp.totalRows) })),
      detailItem(t('settlementImports.detailAmount'), ltr(formatEgp(imp.amount))),
      detailItem(t('settlementImports.detailUploaded'), whoWhen(imp.createdBy, imp.createdAt)),
      detailItem(t('settlementImports.detailDecided'), decidedWho),
    );
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
