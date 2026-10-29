/**
 * payout-batch.js — SheDrive admin payout batch detail (2026-10-14 spec §3)
 *
 * One batch through its whole life: Ready to export → Sent to bank → Result
 * pending approval → Completed. A generated batch needs no approval
 * (2026-10-29); each method's bank file is exported and its result imported
 * on its own, and the batch completes when every file's result is approved.
 *
 * Laid out as the kit's v22-10 payout-batch page: a summary card (with the
 * "download bank file again" footer) beside the State timeline card, then the
 * batch contents table, then the next step full width.
 *
 * What an admin can do depends only on the status:
 *   ready — export the bank files, one per payout method (kit popup-warning
 *     confirm), which moves the batch to Sent to bank.
 *   sent_to_bank and later — download any file again (a copy, changes nothing).
 *   while a file waits for its result — import that file's result through the
 *     kit upload box. A valid file becomes a `payout_result` request for that
 *     method; nothing posts to a ledger until a Financial lead approves it, in
 *     the review the link here opens in place (or on the Approvals screen, §1).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { formatDate, formatDateTime, formatEgp, formatCount, formatPercent } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';

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

/** Batch status → the kit's chip. */
const CHIP = {
  ready: { className: 'status-created', icon: 'fa-file-export' },
  sent_to_bank: { className: 'status-created', icon: 'fa-building-columns' },
  result_pending: { className: 'status-pending', icon: 'fa-hourglass-half' },
  completed: { className: 'status-approved', icon: 'fa-check' },
};

/** One method's file → lamp class + label key (2026-10-29). */
const FILE = {
  ready: { lamp: 'status-blue-lamp', key: 'payoutBatch.fileReady' },
  sent: { lamp: 'status-primary-lamp', key: 'payoutBatch.fileSent' },
  result_pending: { lamp: 'status-warning-lamp', key: 'payoutBatch.fileResultPending' },
  done: { lamp: 'status-active-lamp', key: 'payoutBatch.fileDone' },
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

function ltr(text, tag = 'span') {
  return el(tag, 'ad-ltr', text);
}

function link(href, text, className = 'list__link') {
  const a = el('a', className, text);
  a.href = href;
  return a;
}

function glyph(classes) {
  const i = el('i', classes);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

function button(label, className, icon) {
  const b = el('button', `btn ${className}`);
  b.type = 'button';
  if (icon) b.appendChild(glyph(`fa-solid ${icon}`));
  b.append(document.createTextNode(label));
  return b;
}

/** Kit alert: icon + text (or a `.details` block of nodes). */
function alertBox(tone, content, icon = null) {
  const icons = {
    info: 'fa-circle-info',
    warning: 'fa-triangle-exclamation',
    success: 'fa-circle-check',
    danger: 'fa-circle-exclamation',
  };
  const box = el('div', `alert ${tone}`);
  box.appendChild(glyph(`fa-solid ${icon ?? icons[tone] ?? icons.info}`));
  if (content instanceof Node) box.appendChild(content);
  else box.appendChild(el('p', '', content));
  return box;
}

function chip(status) {
  const spec = CHIP[status] ?? CHIP.ready;
  const wrap = el('div', spec.className);
  const icon = el('div', 'icon');
  icon.appendChild(glyph(`fa-solid ${spec.icon}`));
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

function approvalLink(request) {
  const a = link(approvalHref(request.id), '', 'btn btn-primary-outline w-100');
  a.append(glyph('fa-solid fa-arrow-up-right-from-square'), document.createTextNode(t('payoutBatch.openApproval')));
  return a;
}

/** Kit key/value list: [[label, value, muted?], …]. */
function kvList(pairs) {
  const list = el('div', 'list-multi-column no-border p-0');
  const row = el('div', 'row gx-4');
  const col = el('div', 'col');
  pairs.forEach(([label, value, muted]) => {
    const line = el('div', 'row gx-0 list-row');
    const key = el('div', 'list-item col text-bold', label);
    const val = el('div', `list-item col-auto justify-content-md-end${muted ? ' batch-muted' : ''}`);
    if (value instanceof Node) val.appendChild(value);
    else val.textContent = value === null || value === undefined || value === '' ? t('common.notAvailable') : String(value);
    line.append(key, val);
    col.appendChild(line);
  });
  row.appendChild(col);
  list.appendChild(row);
  return list;
}

// ── Kit popups (export confirm) ──────────────────────
async function bootstrapModal() {
  try {
    await loadBootstrap();
  } catch {
    /* fall back to class toggling */
  }
  return window.bootstrap?.Modal ?? null;
}

let exportPopup = null;

function buildExportPopup() {
  const root = el('div', 'modal fade popup-warning batch-popup');
  root.id = 'export-confirm';
  root.tabIndex = -1;
  root.dataset.bsBackdrop = 'static';
  root.setAttribute('aria-labelledby', 'export-confirm-title');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header"><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="status-sign warning"><i class="fa-solid fa-warning" aria-hidden="true"></i></div>
          <h4 id="export-confirm-title"></h4>
          <p></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-success" id="export-confirm-btn"><i class="fa-solid fa-file-export" aria-hidden="true"></i><span></span></button>
          <button type="button" class="btn btn-warning-outline" data-bs-dismiss="modal"><i class="fa-solid fa-xmark" aria-hidden="true"></i><span></span></button>
        </div>
      </div>
    </div>`;
  qs('.btn-close', root).setAttribute('aria-label', t('aria.closeDialog'));
  qs('h4', root).textContent = t('kitFinance.pbExportConfirmTitle');
  qs('.modal-body p', root).textContent = t('kitFinance.pbExportConfirmBody');
  qs('#export-confirm-btn span', root).textContent = t('payoutBatch.exportFile');
  qs('.btn-warning-outline span', root).textContent = t('common.cancel');
  qs('#export-confirm-btn', root).addEventListener('click', async () => {
    const Modal = window.bootstrap?.Modal;
    if (Modal) Modal.getOrCreateInstance(root).hide();
    else {
      root.classList.remove('show');
      root.style.display = 'none';
    }
    await exportFile(true);
  });
  document.body.appendChild(root);
  return root;
}

async function confirmExport() {
  exportPopup ??= buildExportPopup();
  const Modal = await bootstrapModal();
  if (Modal) Modal.getOrCreateInstance(exportPopup).show();
  else {
    exportPopup.classList.add('show');
    exportPopup.style.display = 'block';
  }
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

/** Downloads every method's file, or just `type`'s — one CSV per payout method (2026-10-29). */
async function exportFile(firstExport, type = null) {
  if (busy) return;
  busy = true;
  try {
    const result = await mockApi.exportPayoutBatch(batch.id, type);
    for (const file of result.files) {
      downloadText(file.fileName, file.csv);
      // Browsers drop rapid back-to-back downloads; space them out.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (firstExport) shell.showToast(t('payoutBatch.exportedToast', { n: formatCount(result.files.length) }), 'success');
    await load();
  } catch (error) {
    shell.showToast(error.message, 'danger', {
      title: t('toast.failedTitle'),
      action: { label: t('toast.retry'), onClick: () => exportFile(firstExport, type) },
    });
  } finally {
    busy = false;
  }
}

// ── Import (kit upload box) ──────────────────────────
function errorText(d) {
  switch (d.code) {
    case 'missing_column': return t('payoutBatch.errMissingColumn', { column: d.column });
    case 'unknown_line': return t('payoutBatch.errUnknownLine', { rowNo: d.rowNo, lineRef: d.lineRef || '—' });
    case 'duplicate_line': return t('payoutBatch.errDuplicateLine', { rowNo: d.rowNo, lineRef: d.lineRef });
    case 'bad_status': return t('payoutBatch.errBadStatus', { rowNo: d.rowNo, lineRef: d.lineRef, value: d.value ?? '' });
    case 'missing_line': return t('payoutBatch.errMissingLine', { lineRef: d.lineRef });
    case 'other_file': return t('payoutBatch.errOtherFile', { rowNo: d.rowNo, lineRef: d.lineRef });
    default: return d.code;
  }
}

/** The message mixes Latin line refs into translated text; let bidi handle it per item. */
function ltrSafe(text) {
  const span = el('span', '', text);
  span.dir = 'auto';
  return span;
}

function showImportErrors(host, error) {
  const details = el('div', 'details');
  details.appendChild(el('h6', '', t('payoutBatch.importErrorsHeading')));
  const items = Array.isArray(error?.details) ? error.details : [];
  details.appendChild(el('p', '', items.length ? error.message : error?.message ?? t('payoutBatch.errReadFile')));
  if (items.length) {
    const list = el('ul', 'batch-errors');
    items.forEach((d) => {
      const li = el('li');
      li.appendChild(ltrSafe(errorText(d)));
      list.appendChild(li);
    });
    details.appendChild(list);
  }
  const box = alertBox('danger', details);
  box.setAttribute('role', 'alert');
  host.replaceChildren(box);
  host.hidden = false;
}

/** The kit's attachment row under the upload box: file name, progress bar, remove. */
function attachmentRow(onRemove) {
  const item = el('div', 'attachment-item');
  item.hidden = true;
  const progressTitle = el('div', 'progress-title');
  const details = el('div', 'details');
  const name = el('span', 'title ad-ltr');
  const pct = el('span', 'percentage ad-ltr');
  details.append(name, pct);
  const progress = el('div', 'progress');
  const bar = el('div', 'progress-bar');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  progress.appendChild(bar);
  progressTitle.append(details, progress);
  const closeWrap = el('div', 'close-button-container');
  const close = el('button', 'close-button btn btn-link p-0');
  close.type = 'button';
  close.setAttribute('aria-label', t('aria.closeDialog'));
  close.appendChild(glyph('fa-solid fa-circle-xmark'));
  close.addEventListener('click', onRemove);
  closeWrap.appendChild(close);
  item.append(progressTitle, closeWrap);

  const set = (fileName, state) => {
    item.hidden = !fileName;
    name.textContent = fileName ?? '';
    // checking → animated, done → full green, failed → full red
    bar.className = `progress-bar ${state === 'failed' ? 'bg-danger' : state === 'checking' ? 'progress-bar-striped progress-bar-animated bg-primary' : 'bg-success'}`;
    bar.style.width = '100%';
    bar.setAttribute('aria-valuenow', '100');
    pct.textContent = state === 'checking' ? '…' : '100%';
  };
  return { item, set };
}

async function importText(fileName, csvText, ui) {
  if (busy) return;
  busy = true;
  ui.errors.hidden = true;
  ui.attachment.set(fileName, 'checking');
  try {
    const result = await mockApi.importPayoutResult(batch.id, csvText);
    shell.showToast(t('payoutBatch.importDone', {
      type: typeLabel(result.payoutType),
      success: formatCount(result.success),
      failed: formatCount(result.failed),
    }), 'success');
    busy = false;
    await load();
  } catch (error) {
    ui.attachment.set(fileName, 'failed');
    showImportErrors(ui.errors, error);
  } finally {
    busy = false;
  }
}

function importBlock() {
  const wrap = el('div', 'batch-import');
  wrap.appendChild(el('h6', 'batch-import__title', t('payoutBatch.importHeading')));
  wrap.appendChild(el('small', 'batch-muted', t('payoutBatch.importHint')));

  // Kit upload component (driver-balance-details #recordPayoutModal).
  const group = el('div', 'input-group mt-2 batch-upload');
  const input = el('input', 'form-control custom-file-input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.id = 'result-file';
  const label = el('label', 'custom-file-label');
  label.htmlFor = 'result-file';
  const img = el('img');
  img.src = iconUrl('upload.svg');
  img.alt = '';
  label.append(img, document.createTextNode(t('kitFinance.pbUploadPrompt')), el('span', '', t('kitFinance.pbUploadLimits')));
  group.append(input, label);

  const errors = el('div', 'batch-import__errors');
  errors.hidden = true;
  const attachment = attachmentRow(() => {
    attachment.set(null);
    errors.hidden = true;
    input.value = '';
  });
  const ui = { errors, attachment };

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importText(file.name, String(reader.result ?? ''), ui);
    reader.onerror = () => {
      attachment.set(file.name, 'failed');
      showImportErrors(errors, { message: t('payoutBatch.errReadFile') });
    };
    reader.readAsText(file);
    input.value = '';
  });

  // Demo only: Finance's file does not exist in a mockup, so build one.
  const sample = el('button', 'btn btn-secondary-outline batch-import__sample');
  sample.type = 'button';
  sample.id = 'btn-sample-result';
  sample.append(el('span', 'batch-demo-tag', t('payoutBatch.demo')), document.createTextNode(t('payoutBatch.importSample')));
  sample.addEventListener('click', async () => {
    try {
      const { csv, fileName } = await mockApi.buildSampleResult(batch.id);
      await importText(fileName ?? `${batch.ref}-result.csv`, csv, ui);
    } catch (error) {
      showImportErrors(errors, error);
    }
  });

  wrap.append(group, attachment.item, sample, errors);
  return wrap;
}

// ── Render: summary card ─────────────────────────────

/** Date on one line, the admin under it — a narrow card cannot fit "date by email". */
function whenWho(at, name) {
  if (!at) return null;
  const stack = el('div', 'batch-when');
  stack.appendChild(el('span', '', formatDateTime(at)));
  if (name) stack.appendChild(ltr(name)).classList.add('batch-muted');
  return stack;
}

function renderSummary() {
  qs('#batch-ref').textContent = batch.ref;
  const notYet = t('payoutBatch.notYet');
  const s = batch.settings;
  const pairs = [
    [t('payoutBatch.reference'), ltr(batch.ref)],
    [t('payoutBatch.status'), chip(batch.status)],
    [t('payoutBatch.created'), whenWho(batch.createdAt, batch.createdBy)],
    // Its 7-day cut-off line (2026-10-29); older seeded batches have none.
    ...(batch.cutoffDay ? [[t('payoutBatch.cutoff'), t('payoutBatch.cutoffValue', { day: formatDate(batch.cutoffDay) })]] : []),
    [t('payoutBatch.exported'), whenWho(batch.exportedAt, batch.exportedBy) ?? notYet, !batch.exportedAt],
    [t('payoutBatch.resultImported'), whenWho(batch.resultImportedAt, batch.resultImportedBy) ?? notYet, !batch.resultImportedAt],
    [t('payoutBatch.completed'), batch.completedAt ? formatDateTime(batch.completedAt) : notYet, !batch.completedAt],
    [t('payoutBatch.lines'), formatCount(batch.lines.length)],
    [t('payoutBatch.files'), formatCount(batch.files.length)],
    [t('payoutBatch.total'), el('p', 'text-bold ad-ltr', formatEgp(batch.total))],
  ];
  // The transfer fee it was generated with (2026-10-29).
  if (s?.feePercent !== undefined) {
    const fee = t('payouts.feeRule', { pct: formatPercent(s.feePercent), min: formatEgp(s.feeMin), max: formatEgp(s.feeMax) });
    pairs.push(
      [t('payoutBatch.transferFee'), t(s.feePaidBy === 'driver' ? 'payoutBatch.feeByDriver' : 'payoutBatch.feeByShedrive', { fee })],
      [t('payoutBatch.feeTotal'), el('p', 'text-bold ad-ltr', formatEgp(batch.lines.reduce((sum, l) => sum + (l.fee ?? 0), 0)))],
    );
  }
  pairs.push(
    [t('payoutBatch.paidTotal'), el('p', 'text-bold success-color ad-ltr', formatEgp(batch.paidTotal))],
  );
  qs('#batch-summary-body').replaceChildren(kvList(pairs));
}

// ── Render: state timeline card ──────────────────────
function renderTimeline() {
  const s = batch.status;
  const waiting = t('payoutBatch.stepWaiting');
  const resultReq = requestOf('payout_result', 'approved');

  // Generated → Sent to bank → Result imported → Completed (no batch approval, 2026-10-29)
  const step = (label, at, by, done, current) => ({
    label,
    meta: done ? (atBy(at, by) ?? '') : waiting,
    tone: done ? 'success' : current ? 'warning' : 'todo',
  });
  const allImported = batch.files.every((f) => ['result_pending', 'done'].includes(f.status));
  const items = [
    step(t('payoutBatch.stepGenerated'), batch.createdAt, batch.createdBy, true, false),
    step(t('payouts.status_sent_to_bank'), batch.exportedAt, batch.exportedBy, Boolean(batch.exportedAt), s === 'ready'),
    step(t('payoutBatch.stepResultImported'), batch.resultImportedAt, batch.resultImportedBy, allImported && Boolean(batch.resultImportedAt), s === 'sent_to_bank'),
    step(t('payoutBatch.stepCompleted'), resultReq?.decidedAt ?? batch.completedAt, resultReq?.checker, s === 'completed', s === 'result_pending'),
  ];

  const list = el('ol', 'timeline-vertical batch-timeline');
  items.forEach((item) => {
    // Kit v22-10 colours success / warning / danger itself; the step in hand is `current-state`.
    const li = el('li', item.tone === 'warning' ? 'warning current-state' : item.tone);
    // The kit's own tag name for a timeline label.
    li.appendChild(el('lable', '', item.label));
    li.appendChild(el('span', '', item.meta));
    if (item.note) li.appendChild(el('span', 'batch-timeline__note', item.note));
    list.appendChild(li);
  });
  qs('#batch-timeline-body').replaceChildren(list);
}

// ── Render: next-step card ───────────────────────────
function renderActions() {
  const host = qs('#batch-actions-body');
  const nodes = [];
  const s = batch.status;

  if (s === 'ready') {
    nodes.push(alertBox('info', t('payoutBatch.readyNote', { n: formatCount(batch.files.length) })));
    const b = button(t('payoutBatch.exportFile'), 'btn-primary w-100', 'fa-file-export');
    b.id = 'btn-export';
    b.addEventListener('click', confirmExport);
    nodes.push(b);
  }

  // One row per method's file: its own download, its own result (2026-10-29).
  nodes.push(filesList());

  if (s === 'result_pending') {
    nodes.push(alertBox('warning', t('payoutBatch.waitingResultApproval'), 'fa-hourglass-half'));
  }

  if (s === 'completed') {
    const paid = batch.lines.filter((l) => l.status === 'paid').length;
    const failed = batch.lines.filter((l) => l.status === 'failed').length;
    nodes.push(
      alertBox(
        failed ? 'warning' : 'success',
        failed
          ? t('payoutBatch.completedSummary', { paid: formatCount(paid), lines: formatCount(batch.lines.length), amount: formatEgp(batch.paidTotal), failed: formatCount(failed) })
          : t('payoutBatch.completedAllPaid', { lines: formatCount(batch.lines.length), amount: formatEgp(batch.paidTotal) }),
      ),
    );
  }

  if (batch.files.some((f) => f.status === 'sent')) {
    // A rejected result sends that file back here; say why, so the next file is right.
    batch.files.filter((f) => f.status === 'sent' && f.request?.status === 'rejected').forEach((f) => {
      nodes.push(alertBox('danger', t('payoutBatch.resultRejected', {
        type: typeLabel(f.type),
        name: f.request.checker,
        reason: f.request.rejectReason ?? '',
      })));
    });
    nodes.push(importBlock());
  }

  // Kit v22-10: "Download bank file again" is the summary card's footer.
  const footer = qs('#batch-summary-footer');
  if (['sent_to_bank', 'result_pending', 'completed'].includes(s)) {
    const b = button(t('payoutBatch.exportAgain'), 'btn-primary-outline d-flex', 'fa-download');
    b.id = 'btn-export-again';
    b.addEventListener('click', () => exportFile(false));
    footer.replaceChildren(b, el('p', 'small lh-sm batch-muted', t('payoutBatch.exportAgainHint')));
    footer.hidden = false;
  } else {
    footer.replaceChildren();
    footer.hidden = true;
  }

  host.replaceChildren(...nodes);
}

/** The batch's bank files, one per payout method, each with where its result is. */
function filesList() {
  const wrap = el('div', 'batch-files');
  wrap.appendChild(el('h6', 'batch-import__title', t('payoutBatch.filesHeading')));
  batch.files.forEach((file) => {
    const row = el('div', 'batch-file');
    const info = el('div', 'batch-file__info');
    info.appendChild(el('p', 'text-bold', typeLabel(file.type)));
    info.appendChild(el('span', 'batch-muted ad-ltr', file.fileName));
    info.appendChild(el('span', 'batch-muted', t('payoutBatch.fileMeta', {
      lines: formatCount(file.lineCount),
      amount: formatEgp(file.transferTotal),
    })));
    const spec = FILE[file.status] ?? FILE.sent;
    const lamp = el('div', spec.lamp);
    lamp.append(el('div', 'lamp'), document.createTextNode(file.status === 'done'
      ? t('payoutBatch.fileDoneCounts', { paid: formatCount(file.paidCount), failed: formatCount(file.failedCount) })
      : t(spec.key)));
    info.appendChild(lamp);
    row.appendChild(info);

    const actions = el('div', 'batch-file__actions');
    if (file.status === 'result_pending' && file.request?.status === 'pending') actions.appendChild(approvalLink(file.request));
    if (file.status !== 'ready') {
      const b = button(t('payoutBatch.downloadFile'), 'btn-primary-outline btn-sm d-flex', 'fa-download');
      b.dataset.fileType = file.type;
      b.addEventListener('click', () => exportFile(false, file.type));
      actions.appendChild(b);
    }
    row.appendChild(actions);
    wrap.appendChild(row);
  });
  return wrap;
}

// ── Lines grid ───────────────────────────────────────
const LINE_PAGE = 20;
let linePage = 1;

linesTable.pageSize = LINE_PAGE;
linesTable.columns = [
  { key: 'lineRef', label: t('payoutBatch.colLineRef'), ltr: true, render: (row) => ltr(row.lineRef) },
  {
    key: 'driverName',
    label: t('payoutBatch.colDriver'),
    // Generated review-case payees (finance-seed.js) have no driver record to open.
    render: (row) => {
      const stack = el('div', 'batch-method');
      stack.appendChild(row.driverId
        ? link(`driver-balance-details.html?id=${encodeURIComponent(row.driverId)}`, row.driverName)
        : el('span', null, row.driverName));
      // Every bank file carries her phone number (2026-10-29).
      if (row.phone) stack.appendChild(el('span', 'batch-muted ad-ltr', row.phone));
      return stack;
    },
  },
  // Product rule: national IDs are shown in full.
  { key: 'nationalId', label: t('payoutBatch.colNid'), ltr: true, render: (row) => ltr(row.nationalId) },
  {
    key: 'payoutType',
    label: t('kitFinance.pbColMethod'),
    render: (row) => {
      const stack = el('div', 'batch-method');
      stack.appendChild(el('p', 'text-bold', typeLabel(row.payoutType)));
      if (row.provider) stack.appendChild(el('span', 'batch-muted', row.provider));
      return stack;
    },
  },
  // Payout numbers are shown in full (2026-10-18).
  { key: 'number', label: t('payoutBatch.colNumber'), ltr: true, render: (row) => ltr(row.number) },
  { key: 'amount', label: t('payoutBatch.colAmount'), numeric: true, render: (row) => el('p', 'text-bold ad-ltr', formatEgp(row.amount)) },
  {
    key: 'fee',
    label: t('payoutBatch.colFee'),
    numeric: true,
    render: (row) => ltr(row.feePaidBy === 'driver' ? `−${formatEgp(row.fee ?? 0)}` : formatEgp(row.fee ?? 0)),
  },
  { key: 'transferAmount', label: t('payoutBatch.colSent'), numeric: true, render: (row) => el('p', 'text-bold ad-ltr', formatEgp(row.transferAmount)) },
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
      if (row.status === 'failed' && row.failureReason) stack.appendChild(el('span', 'batch-line-status__meta danger-color', row.failureReason));
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
    renderLines();
    show('body');
  } catch (error) {
    qs('#batch-error-state').setAttribute('message', error.message);
    show('error');
  }
}

// A request's link opens the review here; a decision reloads this screen.
wireInPlaceApprovals({ onDecided: load });

qs('#batch-retry').addEventListener('click', load);

await load();

// Arriving from "Generate payout batch" on payouts.html.
if (params.get('created') && batch) {
  shell.showToast(t('payouts.generated', { ref: batch.ref }), 'success');
  params.delete('created');
  const qsStr = params.toString();
  history.replaceState(null, '', `${window.location.pathname}${qsStr ? `?${qsStr}` : ''}`);
}
