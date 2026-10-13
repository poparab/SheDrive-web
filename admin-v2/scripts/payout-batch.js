/**
 * payout-batch.js — SheDrive admin payout batch detail (2026-10-14 spec §3)
 *
 * One batch through its whole life: Pending approval → Ready to export →
 * Sent to bank → Result pending approval → Completed (or Rejected).
 *
 * What an admin can do depends only on the status:
 *   pending_approval / result_pending — nothing; another admin decides it on
 *     the Approvals screen (§1), linked from here.
 *   ready — export the bank file, which moves the batch to Sent to bank.
 *   sent_to_bank and later — download the file again (a copy, changes nothing).
 *   sent_to_bank — import Finance's result file. A valid file becomes a
 *     `payout_result` request; nothing posts to a ledger until it is approved.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { formatDateTime, formatEgp, formatCount, maskNid } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const body = qs('#batch-body');
const missing = qs('#batch-missing');
const errorBox = qs('#batch-error');
const loading = qs('#batch-loading');
const linesTable = qs('#lines-table');

const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const EXPORT_COLUMNS = ['batch_ref', 'line_ref', 'national_id', 'driver_name', 'payout_type', 'provider_or_bank', 'account_number', 'account_holder', 'amount_egp'];
const RESULT_COLUMNS = ['status', 'bank_reference', 'failure_reason'];

/** Batch status → the kit's solid chip. */
const CHIP = {
  pending_approval: { className: 'status-pending', icon: 'fa-hourglass-half' },
  ready: { className: 'status-created', icon: 'fa-file-export' },
  sent_to_bank: { className: 'status-created', icon: 'fa-building-columns' },
  result_pending: { className: 'status-pending', icon: 'fa-hourglass-half' },
  completed: { className: 'status-approved', icon: 'fa-check' },
  rejected: { className: 'status-rejected', icon: 'fa-xmark' },
};

/** Line status → lamp class + label key. */
const LINE = {
  pending: { lamp: 'status-warning-lamp', key: 'payoutBatch.lineIn' },
  sent: { lamp: 'status-primary-lamp', key: 'payoutBatch.lineSent' },
  paid: { lamp: 'status-active-lamp', key: 'payoutBatch.linePaid' },
  failed: { lamp: 'status-danger-lamp', key: 'payoutBatch.lineFailed' },
};

let batch = null;
let busy = false;

// ── Small DOM helpers ────────────────────────────────
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function ltr(text) {
  return el('span', 'ad-ltr', text);
}

function link(href, text, className = 'list__link') {
  const a = el('a', className, text);
  a.href = href;
  return a;
}

function button(label, className, icon) {
  const b = el('button', `btn ${className}`);
  b.type = 'button';
  if (icon) {
    const i = el('i', `fa-solid ${icon}`);
    i.setAttribute('aria-hidden', 'true');
    b.append(i, document.createTextNode(' '));
  }
  b.append(document.createTextNode(label));
  return b;
}

function chip(status) {
  const spec = CHIP[status] ?? CHIP.ready;
  const wrap = el('div', spec.className);
  const icon = el('div', 'icon');
  icon.innerHTML = `<i class="fa-solid ${spec.icon}" aria-hidden="true"></i>`;
  wrap.append(icon, document.createTextNode(t(`payouts.status_${status}`)));
  return wrap;
}

/** "date by admin", or just the date when the actor is not recorded. */
const atBy = (at, name) => {
  if (!at) return null;
  return name ? t('payoutBatch.atBy', { at: formatDateTime(at), name }) : formatDateTime(at);
};

const typeLabel = (type) => t(`payouts.type_${type}`);

function requestOf(type, status = null) {
  return (batch.requests ?? []).filter((r) => r.type === type && (!status || r.status === status))
    .sort((a, b) => (b.madeAt ?? 0) - (a.madeAt ?? 0))[0] ?? null;
}

function notice(text, tone = '') {
  return el('p', `batch-notice${tone ? ` batch-notice--${tone}` : ''}`, text);
}

function approvalLink(request) {
  return link(`approvals.html?id=${encodeURIComponent(request.id)}`, t('payoutBatch.openApproval'), 'btn btn-primary-outline btn--full');
}

// ── Download ─────────────────────────────────────────
function downloadText(fileName, text) {
  // BOM so Excel opens the Arabic-safe UTF-8 file correctly (same as format.downloadCsv).
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportFile(firstExport) {
  if (busy) return;
  busy = true;
  try {
    const result = await mockApi.exportPayoutBatch(batch.id);
    downloadText(result.fileName, result.csv);
    if (firstExport) shell.showToast(t('payoutBatch.exportedToast'), 'success');
    await load();
  } catch (error) {
    shell.showToast(error.message, 'danger');
  } finally {
    busy = false;
  }
}

// ── Import ───────────────────────────────────────────
function errorText(d) {
  switch (d.code) {
    case 'missing_column': return t('payoutBatch.errMissingColumn', { column: d.column });
    case 'unknown_line': return t('payoutBatch.errUnknownLine', { rowNo: d.rowNo, lineRef: d.lineRef || '—' });
    case 'duplicate_line': return t('payoutBatch.errDuplicateLine', { rowNo: d.rowNo, lineRef: d.lineRef });
    case 'bad_status': return t('payoutBatch.errBadStatus', { rowNo: d.rowNo, lineRef: d.lineRef, value: d.value ?? '' });
    case 'missing_line': return t('payoutBatch.errMissingLine', { lineRef: d.lineRef });
    default: return d.code;
  }
}

function showImportErrors(host, error) {
  host.textContent = '';
  host.hidden = false;
  host.appendChild(el('strong', 'batch-import__errors-title', t('payoutBatch.importErrorsHeading')));
  const details = Array.isArray(error?.details) ? error.details : [];
  if (!details.length) {
    host.appendChild(el('p', '', error?.message ?? t('payoutBatch.errReadFile')));
    return;
  }
  host.appendChild(el('p', '', error.message));
  const list = el('ul', 'batch-import__errors-list');
  details.forEach((d) => {
    const li = el('li');
    li.appendChild(ltrSafe(errorText(d)));
    list.appendChild(li);
  });
  host.appendChild(list);
}

/** The message mixes Latin line refs into translated text; let bidi handle it per item. */
function ltrSafe(text) {
  const span = el('span', '', text);
  span.dir = 'auto';
  return span;
}

async function importText(csvText, errorsHost, status) {
  if (busy) return;
  busy = true;
  errorsHost.hidden = true;
  status.hidden = false;
  try {
    const result = await mockApi.importPayoutResult(batch.id, csvText);
    shell.showToast(t('payoutBatch.importDone', { success: formatCount(result.success), failed: formatCount(result.failed) }), 'success');
    busy = false;
    await load();
  } catch (error) {
    showImportErrors(errorsHost, error);
  } finally {
    busy = false;
    status.hidden = true;
  }
}

function importBlock() {
  const wrap = el('div', 'batch-import');
  wrap.appendChild(el('h6', 'batch-import__title', t('payoutBatch.importHeading')));
  wrap.appendChild(el('p', 'ad-section__hint', t('payoutBatch.importHint')));

  const input = el('input', 'visually-hidden');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.id = 'result-file';
  const label = el('label', 'btn btn-primary btn--full');
  label.htmlFor = 'result-file';
  label.innerHTML = '<i class="fa-solid fa-file-import" aria-hidden="true"></i> ';
  label.append(document.createTextNode(t('payoutBatch.importChoose')));

  const status = el('p', 'batch-import__status');
  status.append(el('span', 'spinner'), document.createTextNode(` ${t('payoutBatch.importing')}`));
  status.hidden = true;

  const errors = el('div', 'batch-import__errors');
  errors.setAttribute('role', 'alert');
  errors.hidden = true;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importText(String(reader.result ?? ''), errors, status);
    reader.onerror = () => showImportErrors(errors, { message: t('payoutBatch.errReadFile') });
    reader.readAsText(file);
    input.value = '';
  });

  // Demo only: Finance's file does not exist in a mockup, so build one.
  const sample = el('button', 'btn btn-link batch-import__sample');
  sample.type = 'button';
  sample.append(el('span', 'batch-demo-tag', t('payoutBatch.demo')), document.createTextNode(` ${t('payoutBatch.importSample')}`));
  sample.addEventListener('click', async () => {
    try {
      const { csv } = await mockApi.buildSampleResult(batch.id);
      await importText(csv, errors, status);
    } catch (error) {
      showImportErrors(errors, error);
    }
  });

  wrap.append(input, label, sample, status, errors);
  return wrap;
}

// ── Render ───────────────────────────────────────────
function renderSummary() {
  const approve = requestOf('payout_batch');
  const items = [
    { label: t('payoutBatch.reference'), value: batch.ref, ltr: true },
    { label: t('payoutBatch.status'), value: chip(batch.status) },
    { label: t('payoutBatch.created'), value: atBy(batch.createdAt, batch.createdBy) },
  ];
  if (batch.status === 'rejected') {
    items.push(
      { label: t('payoutBatch.rejected'), value: atBy(approve?.decidedAt ?? batch.completedAt, approve?.checker) },
      { label: t('payoutBatch.rejectReason'), value: approve?.rejectReason ?? null, wide: true },
    );
  } else {
    items.push(
      { label: t('payoutBatch.approved'), value: atBy(batch.approvedAt, batch.approvedBy) ?? t('payoutBatch.notYet'), muted: !batch.approvedAt },
      { label: t('payoutBatch.exported'), value: atBy(batch.exportedAt, batch.exportedBy) ?? t('payoutBatch.notYet'), muted: !batch.exportedAt },
      { label: t('payoutBatch.resultImported'), value: atBy(batch.resultImportedAt, batch.resultImportedBy) ?? t('payoutBatch.notYet'), muted: !batch.resultImportedAt },
      { label: t('payoutBatch.completed'), value: batch.completedAt ? formatDateTime(batch.completedAt) : t('payoutBatch.notYet'), muted: !batch.completedAt },
    );
  }
  items.push(
    { label: t('payoutBatch.lines'), value: formatCount(batch.lines.length) },
    { label: t('payoutBatch.total'), value: formatEgp(batch.total), ltr: true },
    { label: t('payoutBatch.paidTotal'), value: formatEgp(batch.paidTotal), ltr: true },
  );
  qs('#batch-summary').items = items;
}

function renderTimeline() {
  const section = qs('#batch-progress');
  section.items = [];
  const host = section.body;
  host.textContent = '';
  const timeline = document.createElement('ad-timeline');

  const resultReq = requestOf('payout_result', 'approved');
  const s = batch.status;
  const waiting = t('payoutBatch.stepWaiting');
  const step = (label, at, by, done, current) => ({
    label,
    meta: done ? (atBy(at, by) ?? '') : waiting,
    tone: done ? 'success' : current ? 'warning' : 'muted',
  });

  const items = [step(t('payoutBatch.stepGenerated'), batch.createdAt, batch.createdBy, true, false)];
  if (s === 'rejected') {
    const req = requestOf('payout_batch');
    items.push({
      label: t('payoutBatch.stepRejected'),
      meta: atBy(req?.decidedAt ?? batch.completedAt, req?.checker) ?? '',
      note: req?.rejectReason ?? null,
      tone: 'danger',
    });
  } else {
    items.push(
      step(t('payoutBatch.stepApproved'), batch.approvedAt, batch.approvedBy, Boolean(batch.approvedAt), s === 'pending_approval'),
      step(t('payoutBatch.stepExported'), batch.exportedAt, batch.exportedBy, Boolean(batch.exportedAt), s === 'ready'),
      step(t('payoutBatch.stepResultImported'), batch.resultImportedAt, batch.resultImportedBy, Boolean(batch.resultImportedAt), s === 'sent_to_bank'),
      step(t('payoutBatch.stepResultApproved'), resultReq?.decidedAt ?? batch.completedAt, resultReq?.checker, s === 'completed', s === 'result_pending'),
      step(t('payoutBatch.stepCompleted'), batch.completedAt, null, s === 'completed', false),
    );
  }
  timeline.items = items;
  host.appendChild(timeline);
}

function renderActions() {
  const section = qs('#batch-actions');
  section.items = [];
  const host = section.body;
  host.textContent = '';
  const s = batch.status;

  if (s === 'pending_approval') {
    host.appendChild(notice(t('payoutBatch.waitingApproval'), 'warning'));
    const req = requestOf('payout_batch', 'pending');
    if (req) host.appendChild(approvalLink(req));
  }

  if (s === 'ready') {
    host.appendChild(notice(t('payoutBatch.readyNote')));
    const b = button(t('payoutBatch.exportFile'), 'btn-primary btn--full', 'fa-file-export');
    b.id = 'btn-export';
    b.addEventListener('click', () => exportFile(true));
    host.appendChild(b);
  }

  if (s === 'result_pending') {
    host.appendChild(notice(t('payoutBatch.waitingResultApproval'), 'warning'));
    const req = requestOf('payout_result', 'pending');
    if (req) host.appendChild(approvalLink(req));
  }

  if (s === 'completed') {
    const paid = batch.lines.filter((l) => l.status === 'paid').length;
    const failed = batch.lines.filter((l) => l.status === 'failed').length;
    host.appendChild(
      notice(
        failed
          ? t('payoutBatch.completedSummary', { paid: formatCount(paid), lines: formatCount(batch.lines.length), amount: formatEgp(batch.paidTotal), failed: formatCount(failed) })
          : t('payoutBatch.completedAllPaid', { lines: formatCount(batch.lines.length), amount: formatEgp(batch.paidTotal) }),
        failed ? 'warning' : 'success',
      ),
    );
  }

  if (s === 'rejected') {
    host.appendChild(notice(t('payoutBatch.rejectedNote'), 'danger'));
  }

  if (s === 'sent_to_bank') {
    // A rejected result sends the batch back here; say why, so the next file is right.
    const rejected = requestOf('payout_result', 'rejected');
    if (rejected) {
      host.appendChild(notice(t('payoutBatch.resultRejected', { name: rejected.checker, reason: rejected.rejectReason ?? '' }), 'danger'));
    }
    host.appendChild(importBlock());
  }

  if (['sent_to_bank', 'result_pending', 'completed'].includes(s)) {
    const again = el('div', 'batch-again');
    const b = button(t('payoutBatch.exportAgain'), 'btn-primary-outline btn--full', 'fa-download');
    b.id = 'btn-export-again';
    b.addEventListener('click', () => exportFile(false));
    again.append(b, el('p', 'ad-section__hint', t('payoutBatch.exportAgainHint')));
    host.appendChild(again);
  }
}

function renderColumns() {
  const section = qs('#batch-columns');
  section.items = [];
  const host = section.body;
  host.textContent = '';
  const block = (title, cols) => {
    const wrap = el('div', 'batch-columns');
    wrap.appendChild(el('span', 'batch-columns__title', title));
    const list = el('ul', 'batch-columns__list');
    cols.forEach((c) => list.appendChild(el('li', 'ad-ltr', c)));
    wrap.appendChild(list);
    return wrap;
  };
  host.append(block(t('payoutBatch.columnsExport'), EXPORT_COLUMNS), block(t('payoutBatch.columnsResult'), RESULT_COLUMNS));
}

// ── Lines grid ───────────────────────────────────────
const LINE_PAGE = 20;
let linePage = 1;

linesTable.pageSize = LINE_PAGE;
linesTable.columns = [
  { key: 'lineRef', label: t('payoutBatch.colLineRef'), render: (row) => ltr(row.lineRef) },
  {
    key: 'driverName',
    label: t('payoutBatch.colDriver'),
    render: (row) => link(`driver-profile.html?id=${encodeURIComponent(row.driverId)}`, row.driverName),
  },
  { key: 'nationalId', label: t('payoutBatch.colNid'), render: (row) => ltr(maskNid(row.nationalId)) },
  { key: 'payoutType', label: t('payoutBatch.colType'), render: (row) => typeLabel(row.payoutType) },
  { key: 'provider', label: t('payoutBatch.colProvider'), render: (row) => row.provider || null },
  { key: 'masked', label: t('payoutBatch.colNumber'), render: (row) => ltr(row.masked) },
  { key: 'amount', label: t('payoutBatch.colAmount'), numeric: true, render: (row) => formatEgp(row.amount) },
  {
    key: 'status',
    label: t('payoutBatch.colStatus'),
    render: (row) => {
      const spec = LINE[row.status] ?? LINE.pending;
      const stack = el('div', 'batch-line-status');
      const lamp = el('div', spec.lamp);
      lamp.append(el('div', 'lamp'), document.createTextNode(t(spec.key)));
      stack.appendChild(lamp);
      if (row.status === 'paid' && row.bankReference) stack.appendChild(el('span', 'batch-line-status__meta ad-ltr', row.bankReference));
      if (row.status === 'failed' && row.failureReason) stack.appendChild(el('span', 'batch-line-status__meta batch-line-status__meta--failed', row.failureReason));
      return stack;
    },
  },
];
linesTable.emptyState = {
  icon: 'not-found.svg',
  heading: t('payoutBatch.linesEmptyHeading'),
  message: t('payoutBatch.linesEmptyMessage'),
};
linesTable.addEventListener('pagechange', (event) => {
  linePage = event.detail.page;
  renderLines();
});

function renderLines() {
  const rows = batch.lines;
  const totalPages = Math.max(1, Math.ceil(rows.length / LINE_PAGE));
  linePage = Math.min(linePage, totalPages);
  linesTable.setData({
    rows: rows.slice((linePage - 1) * LINE_PAGE, linePage * LINE_PAGE),
    total: rows.length,
    page: linePage,
    pageSize: LINE_PAGE,
    totalPages,
  });
}

// ── Load ─────────────────────────────────────────────
function show(which) {
  loading.hidden = which !== 'loading';
  body.hidden = which !== 'body';
  missing.hidden = which !== 'missing';
  errorBox.hidden = which !== 'error';
}

async function load() {
  if (!batch) show('loading');
  try {
    const result = id ? await mockApi.getPayoutBatch(id) : null;
    if (!result) {
      show('missing');
      return;
    }
    batch = result;
    document.title = `${t('shell.brand')} — ${batch.ref}`;
    renderSummary();
    renderTimeline();
    renderActions();
    renderColumns();
    renderLines();
    show('body');
  } catch (error) {
    qs('#batch-error-state').setAttribute('message', error.message);
    show('error');
  }
}

qs('#batch-retry').addEventListener('click', load);

await load();

// Arriving from "Generate payout batch" on payouts.html.
if (params.get('created') && batch) {
  shell.showToast(t('payouts.sentForApproval', { ref: batch.ref }), 'success');
  params.delete('created');
  const qsStr = params.toString();
  history.replaceState(null, '', `${window.location.pathname}${qsStr ? `?${qsStr}` : ''}`);
}
