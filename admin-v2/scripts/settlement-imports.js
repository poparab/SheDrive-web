/**
 * settlement-imports.js — SheDrive admin settlement sheet import
 * Spec: docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md §4 (§1 approvals)
 * Story: #5620 · design #5636
 *
 * The screen opens on the import history (kit settlements.html). "Import
 * settlement" opens the kit's three-step wizard (settlement-import-step1..3):
 *
 *   1  Download template — the seven columns and how each is written.
 *   2  Upload sheet      — the template and format check: the columns are the
 *                          template's, and every cell is written as it says
 *                          (14-digit ID, plain number, YYYY-MM-DD, one of the
 *                          four channels, 01 mobile …). Any problem stops the
 *                          file here; cell problems come back as the sheet with
 *                          an errors column to download. Nothing is read about
 *                          drivers.
 *   3  Review result     — the business check, row by row: a registered
 *                          driver whose phone matches, a reference not imported before or repeated
 *                          in the file, a date not in the future. **One failed
 *                          row rejects the whole file**: nothing is sent, and
 *                          Finance uploads the corrected file again.
 *
 * Only a file that passes both goes, whole, as one `settlement_import`
 * request. Nothing is settled here: a Financial lead approves it on
 * approvals.html, and only then does each row post a settlement with an
 * S-nnnnn receipt.
 *
 * `?step=1|2|3` opens the wizard on that step (a step that needs a file it
 * doesn't have falls back to step 2). Demo deep links:
 * `?step=2&sample=format` (fails step 2), `?step=3&sample=business` (rejected
 * at step 3), `?step=3&sample=clean` (ready to send). An import's detail is its
 * own page, settlement-import.html?id=… (2026-11-04); an old `?id=` link here
 * is sent there. `?state=empty|loading|error|long` applies to the history
 * grid only: the wizard is a tool, not a list, so its calls run with the
 * override lifted (see `live()`).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime, formatEgp, formatCount, toCsv } from './format.js';
import { can } from './roles.js';
import { qs, qsa } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import '../components/ad-data-table.js';
import '../components/ad-stat-card.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

// The detail used to be a modal here; it is its own page now.
const legacyId = new URLSearchParams(window.location.search).get('id');
if (legacyId) {
  window.location.replace(`settlement-import.html?id=${encodeURIComponent(legacyId)}`);
  throw new Error('Redirecting to the import page');
}

const MAX_BYTES = 5 * 1024 * 1024;

const shell = qs('ad-shell');
const wizardEl = qs('#wizard');
const historySection = qs('#history');
const fileInput = qs('#sheet-file');
const busy = qs('#upload-busy');
const sheetError = qs('#upload-error');
const formatOk = qs('#format-ok');
const errorsFileButton = qs('#btn-errors-file');
const checkTable = qs('#check-table');
const backButton = qs('#btn-back');
const nextButton = qs('#btn-next');
const submitButton = qs('#btn-submit');
const submitLabel = qs('#btn-submit-label');
const againButton = qs('#btn-again');
const submitted = qs('#submitted');
const historyTable = qs('#imports-table');

/**
 * The wizard's state.
 *   step     1 | 2 | 3
 *   file     { fileName, csv } once a sheet is chosen
 *   format   null (not checked) | 'checking' | 'ok' | 'failed'
 *   result   the step 3 business check, or null
 *   sent     true once the file went for approval
 */
const wizard = { step: 1, file: null, format: null, result: null, sent: false };

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

function setUrlParams(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  });
  window.history.replaceState(window.history.state, '', url);
}

// ── Labels ───────────────────────────────────────────
const CHANNEL_KEYS = {
  'Bank transfer': 'settlementImports.channelBank',
  Fawry: 'settlementImports.channelFawry',
  'Mobile wallet': 'settlementImports.channelWallet',
  'Field agent': 'settlementImports.channelAgent',
};
const channelLabel = (value) => (CHANNEL_KEYS[value] ? t(CHANNEL_KEYS[value]) : value || null);

/** Step 2 problems about the file as a whole (no row). */
const FILE_ISSUE_KEYS = {
  not_csv: 'settlementImports.notCsv',
  too_large: 'settlementImports.tooLarge',
  read_failed: 'settlementImports.readFailed',
  missing_column: 'settlementImports.missingColumn',
  unknown_column: 'settlementImports.unknownColumn',
  duplicate_column: 'settlementImports.duplicateColumn',
  empty: 'settlementImports.emptySheet',
  too_many_rows: 'settlementImports.tooManyRows',
};
/** Step 2 problems in one cell (or one row). */
const CELL_ISSUE_KEYS = {
  cell_count: 'settlementImports.fmtCells',
  required: 'settlementImports.fmtRequired',
  nid_format: 'settlementImports.fmtNid',
  name_length: 'settlementImports.fmtName',
  phone_format: 'settlementImports.fmtPhone',
  amount_format: 'settlementImports.fmtAmount',
  amount_zero: 'settlementImports.fmtAmountZero',
  date_format: 'settlementImports.fmtDate',
  channel_value: 'settlementImports.fmtChannel',
  ref_format: 'settlementImports.fmtRef',
};

/** Step 3 business failures. */
const FAIL_KEYS = {
  unknown_driver: 'settlementImports.resultUnknownDriver',
  phone_mismatch: 'settlementImports.resultPhoneMismatch',
  duplicate: 'settlementImports.resultDuplicate',
  repeated_in_file: 'settlementImports.resultRepeated',
  future_date: 'settlementImports.resultFutureDate',
};

/**
 * A row's step 3 result as a kit lamp. In an accepted file a row says what it
 * will do to her balance (§4); in a rejected file nothing applies, so a row
 * that passed only says so.
 */
function resultLamp(row) {
  if (FAIL_KEYS[row.status]) return lamp('status-danger-lamp', t(FAIL_KEYS[row.status]));
  if (!wizard.result?.accepted) return lamp('status-active-lamp', t('settlementImports.resultPassed'));
  switch (row.outcome) {
    case 'full': return lamp('status-active-lamp', t('settlementImports.outcomeFull'));
    case 'partial': return lamp('status-warning-lamp', t('settlementImports.outcomePartial', { owed: formatEgp(-row.balanceAfter) }));
    case 'credit': return lamp('status-blue-lamp', t('settlementImports.outcomeCredit', { extra: formatEgp(Math.min(row.amount, row.balanceAfter)) }));
    default: return lamp('status-active-lamp', t('settlementImports.resultPassed'));
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

// ── List ↔ wizard ────────────────────────────────────
const pageActions = qs('#ad-page-actions');

const importButton = el('button', 'btn btn-success d-flex');
importButton.type = 'button';
importButton.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>';
importButton.append(el('span', '', t('settlementImports.importButton')));
importButton.addEventListener('click', () => openWizard(1));

const exitButton = el('button', 'btn btn-back btn-back-outline');
exitButton.type = 'button';
exitButton.setAttribute('aria-label', t('settlementImports.backToHistory'));
exitButton.title = t('settlementImports.backToHistory');
exitButton.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>';
exitButton.addEventListener('click', closeWizard);

// View roles get no import action (the role matrix); they still see the history.
const canImport = can('finance.request');

function showHeaderAction(button) {
  if (!pageActions) return;
  importButton.remove();
  exitButton.remove();
  if (button) pageActions.appendChild(button);
}

function openWizard(step) {
  resetWizard();
  wizardEl.hidden = false;
  historySection.hidden = true;
  showHeaderAction(exitButton);
  goTo(step);
}

function closeWizard() {
  resetWizard();
  wizardEl.hidden = true;
  historySection.hidden = false;
  showHeaderAction(canImport ? importButton : null);
  setUrlParams({ step: null, sample: null });
}

function resetWizard() {
  wizard.step = 1;
  wizard.file = null;
  wizard.format = null;
  wizard.result = null;
  wizard.sent = false;
  clearUpload();
}

/** The furthest step the wizard can show with what it has. */
function reachable(step) {
  if (step >= 3 && wizard.format === 'ok') return 3;
  return Math.min(step, 2);
}

function goTo(step) {
  wizard.step = Math.max(1, reachable(step));
  qsa('[data-step-panel]').forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== wizard.step;
  });
  // The buttons line up with the step's card: narrow on 1–2, full width on 3 (kit).
  qs('#step-nav').className = `${wizard.step === 3 ? 'container-fluid' : 'container-md-stays'} si-step-nav`;
  renderStepper();
  renderNav();
  setUrlParams({ step: wizard.step });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Kit stepper states: completed, active, warning, error. */
function stepState(n) {
  if (n < wizard.step) return 'completed';
  if (n > wizard.step) return '';
  if (n === 2 && wizard.format === 'failed') return 'error';
  if (n === 3 && wizard.sent) return 'completed';
  if (n === 3 && wizard.result && !wizard.result.accepted) return 'error';
  return 'active';
}

function renderStepper() {
  qsa('#stepper li').forEach((li) => {
    const n = Number(li.dataset.step);
    li.className = stepState(n);
    if (n === wizard.step) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
    // A step you have passed (or the next one, when it is open) can be clicked.
    const open = !wizard.sent && n !== wizard.step && reachable(n) === n && (n < wizard.step || n === wizard.step + 1);
    li.tabIndex = open ? 0 : -1;
    li.classList.toggle('si-step-open', open);
  });
}

qsa('#stepper li').forEach((li) => {
  const jump = () => {
    if (li.classList.contains('si-step-open')) goStep(Number(li.dataset.step));
  };
  li.addEventListener('click', jump);
  li.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      jump();
    }
  });
});

function renderNav() {
  const { step, format, result, sent } = wizard;
  backButton.disabled = step === 1 || sent;
  nextButton.hidden = step === 3;
  nextButton.disabled = step === 2 && format !== 'ok';
  submitButton.hidden = !(step === 3 && result?.accepted && !sent);
  againButton.hidden = !(step === 3 && result && !result.accepted);
}

/** Moving to step 3 runs the business check first. */
async function goStep(step) {
  if (step === 3 && wizard.format === 'ok' && !wizard.result) {
    const ok = await runBusinessCheck();
    if (!ok) return;
  }
  goTo(step);
}

backButton.addEventListener('click', () => goTo(wizard.step - 1));
nextButton.addEventListener('click', () => goStep(wizard.step + 1));
againButton.addEventListener('click', () => {
  clearUpload();
  wizard.file = null;
  wizard.format = null;
  wizard.result = null;
  goTo(2);
});

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

// ── Step 2 — upload + template / format check ────────
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

function clearUpload() {
  fileInput.value = '';
  attachment.set(null);
  sheetError.hidden = true;
  formatOk.hidden = true;
  submitted.hidden = true;
  errorsFile = null;
}

qs('#sheet-attachment-remove').addEventListener('click', () => {
  clearUpload();
  wizard.file = null;
  wizard.format = null;
  wizard.result = null;
  goTo(2);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    formatFailed(file.name, [{ code: 'not_csv' }]);
    return;
  }
  if (file.size > MAX_BYTES) {
    formatFailed(file.name, [{ code: 'too_large' }]);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => checkFormat(file.name, String(reader.result ?? ''));
  reader.onerror = () => formatFailed(file.name, [{ code: 'read_failed' }]);
  reader.readAsText(file);
});

qsa('[data-sample]').forEach((button) => button.addEventListener('click', () => loadSample(button.dataset.sample)));

async function loadSample(kind) {
  try {
    const sample = await live(() => mockApi.buildSampleSettlementSheet(kind));
    fileInput.value = '';
    return await checkFormat(sample.fileName, sample.csv);
  } catch (error) {
    shell.showToast(error.message || t('settlementImports.checkFailed'), 'danger', { title: t('toast.failedTitle') });
    return false;
  }
}

async function checkFormat(fileName, csv) {
  wizard.file = { fileName, csv };
  wizard.format = 'checking';
  wizard.result = null;
  sheetError.hidden = true;
  formatOk.hidden = true;
  busy.hidden = false;
  attachment.set(fileName, 'checking');
  renderNav();
  try {
    const { total } = await live(() => mockApi.validateSettlementSheet(csv));
    wizard.format = 'ok';
    attachment.set(fileName, 'done');
    qs('#format-ok-text').textContent = total === 1 ? t('settlementImports.formatOkOne') : t('settlementImports.formatOk', { n: formatCount(total) });
    formatOk.hidden = false;
    return true;
  } catch (error) {
    const details = Array.isArray(error.details) && error.details.length ? error.details : null;
    if (details) formatFailed(fileName, details, error.sheet);
    else {
      formatFailed(fileName, []);
      qs('#upload-error-summary').textContent = error.message || t('settlementImports.checkFailed');
    }
    return false;
  } finally {
    busy.hidden = true;
    renderStepper();
    renderNav();
  }
}

/** The errors file on offer after a failed step 2: { fileName, csv } or null. */
let errorsFile = null;

/**
 * The sheet handed back with an `errors` column (#5620 step 2): every row as
 * Finance sent it, and on each row with a problem, what to fix in each cell.
 * Re-uploading it is fine — the check ignores the errors column.
 */
function buildErrorsFile(fileName, sheet, cellIssues) {
  const byRow = new Map();
  cellIssues.forEach((i) => {
    const text = i.column ? `${i.column}: ${t(CELL_ISSUE_KEYS[i.code])}` : t(CELL_ISSUE_KEYS[i.code]);
    byRow.set(i.rowNo, [...(byRow.get(i.rowNo) ?? []), text]);
  });
  const headers = [...sheet.headers, 'errors'];
  const rows = sheet.rows.map((row, i) => [...sheet.headers.map((h) => row[h] ?? ''), (byRow.get(i + 1) ?? []).join(' | ')]);
  return { fileName: fileName.replace(/(-errors)?.csv$/i, '') + '-errors.csv', csv: toCsv(headers, rows) };
}

/**
 * A failed step 2. Problems with the file itself (type, size, columns, row
 * count) can't sit on a row, so the alert names them. Problems in cells are
 * not listed on screen: the file comes back with an errors column to fix.
 */
function formatFailed(fileName, issues, sheet = null) {
  wizard.file = wizard.file?.fileName === fileName ? wizard.file : { fileName, csv: null };
  wizard.format = 'failed';
  wizard.result = null;
  attachment.set(fileName, 'failed');

  const fileIssues = issues.filter((i) => FILE_ISSUE_KEYS[i.code]);
  const cellIssues = issues.filter((i) => CELL_ISSUE_KEYS[i.code]);

  const list = qs('#upload-error-list');
  list.textContent = '';
  fileIssues.forEach((i) => list.appendChild(el('li', '', t(FILE_ISSUE_KEYS[i.code], { column: i.column ?? '', n: formatCount(i.value ?? 0) }))));
  list.hidden = !fileIssues.length;

  errorsFile = cellIssues.length && sheet ? buildErrorsFile(fileName, sheet, cellIssues) : null;
  const rowCount = new Set(cellIssues.map((i) => i.rowNo)).size;
  qs('#upload-error-title').textContent = errorsFile
    ? t(rowCount === 1 ? 'settlementImports.cellErrorsTitleOne' : 'settlementImports.cellErrorsTitle', { rows: formatCount(rowCount) })
    : t('settlementImports.formatRejected');
  qs('#upload-error-summary').textContent = errorsFile ? t('settlementImports.cellErrorsHint') : '';
  errorsFileButton.hidden = !errorsFile;

  formatOk.hidden = true;
  sheetError.hidden = false;
  renderStepper();
  renderNav();
}

errorsFileButton.addEventListener('click', () => {
  if (errorsFile) downloadText(errorsFile.fileName, errorsFile.csv);
});

// ── Step 3 — business check ──────────────────────────
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
      stack.appendChild(r.systemName ? el('p', 'text-bold', r.systemName) : el('p', 'text-bold danger-color', t('settlementImports.noMatch')));
      if (r.driverName) stack.appendChild(el('span', 'info-color', t('kitFinance.siNameInSheet', { name: r.driverName })));
      if (r.phone) stack.appendChild(ltr(r.phone, 'info-color'));
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
  // Balance after only means something when the file will be applied.
  { key: 'balanceAfter', label: t('settlementImports.colBalanceAfter'), numeric: true, ltr: true, render: (r) => (wizard.result?.accepted ? balance(r.balanceAfter) : null) },
  {
    // Payment reference, with the payment date and channel under it.
    key: 'paymentRef',
    label: t('settlementImports.colPaymentRef'),
    render: (r) => {
      const stack = el('div', 'si-stack');
      stack.appendChild(ltr(r.paymentRef, 'si-mono') ?? el('span', '', t('common.notAvailable')));
      const under = [r.paymentDate, channelLabel(r.channel)].filter(Boolean).join(' • ');
      if (under) stack.appendChild(el('span', 'info-color', under));
      return stack;
    },
  },
  { key: 'status', label: t('settlementImports.colResult'), className: 'si-wrap-wide', render: resultLamp },
];

async function runBusinessCheck() {
  if (!wizard.file?.csv) return false;
  nextButton.disabled = true;
  busy.hidden = false;
  try {
    wizard.result = await live(() => mockApi.checkSettlementSheet(wizard.file.csv));
    renderResult();
    return true;
  } catch (error) {
    // The file changed under step 2's check (it shouldn't); send her back to it.
    const details = Array.isArray(error.details) && error.details.length ? error.details : null;
    if (details) formatFailed(wizard.file.fileName, details);
    else shell.showToast(error.message || t('settlementImports.checkFailed'), 'danger', { title: t('toast.failedTitle') });
    return false;
  } finally {
    busy.hidden = true;
    renderNav();
  }
}

function renderResult() {
  const { result } = wizard;
  const rows = result?.rows ?? [];
  const failed = result?.failedCount ?? 0;

  qs('#result-file').textContent = wizard.file.fileName;
  qs('#stat-total').setAttribute('value', formatCount(rows.length));
  qs('#stat-ready').setAttribute('value', formatCount(result?.readyCount ?? 0));
  qs('#stat-rejected').setAttribute('value', formatCount(failed));
  qs('#stat-amount').setAttribute('value', result?.accepted ? formatEgp(result.amount) : '—');

  qs('#verdict-rejected').hidden = result.accepted;
  qs('#verdict-rejected-title').textContent = failed === 1
    ? t('settlementImports.rejectedTitleOne')
    : t('settlementImports.rejectedTitle', { n: formatCount(failed) });
  qs('#verdict-accepted').hidden = !result.accepted;
  submitted.hidden = true;

  checkTable.setData(onePage(rows));
}

submitButton.addEventListener('click', async () => {
  if (!wizard.result?.accepted || wizard.sent) return;
  const label = submitLabel.textContent;
  submitButton.disabled = true;
  submitLabel.textContent = t('settlementImports.submitting');
  try {
    const response = await live(() => mockApi.submitSettlementImport({ fileName: wizard.file.fileName, rows: wizard.result.rows }));
    const requestId = response.request.id;
    const n = wizard.result.rows.length;
    const text = t('settlementImports.submitted', { n: formatCount(n), id: response.import.id });
    shell.showToast(text, 'success');

    qs('#submitted-text').textContent = text;
    const link = qs('#submitted-link');
    link.href = approvalHref(requestId);
    link.textContent = t('settlementImports.submittedLink', { id: requestId });
    submitted.hidden = false;
    qs('#verdict-accepted').hidden = true;
    wizard.sent = true;
    renderStepper();
    renderNav();
    loadHistory();
  } catch (error) {
    shell.showToast(error.message || t('settlementImports.submitFailed'), 'danger', { title: t('toast.failedTitle') });
  } finally {
    submitLabel.textContent = label;
    submitButton.disabled = false;
  }
});

// ── History ──────────────────────────────────────────
// #5620 grid spec: Uploaded (default, newest first), Amount and Decided sort.
const historyQuery = { page: 1, pageSize: 20, sort: { key: 'createdAt', dir: 'desc' } };

historyTable.pageSize = historyQuery.pageSize;
historyTable.sort = historyQuery.sort;
historyTable.columns = [
  { key: 'id', label: t('settlementImports.colImportId'), ltr: true, render: (r) => ltr(r.id, 'si-mono') },
  { key: 'fileName', label: t('settlementImports.colFile'), ltr: true, className: 'si-wrap', render: (r) => ltr(r.fileName) },
  { key: 'createdAt', label: t('settlementImports.colUploaded'), sortable: true, render: (r) => whoWhen(r.createdBy, r.createdAt) },
  {
    key: 'rows',
    label: t('settlementImports.colRows'),
    headerClass: 'si-wrap',
    numeric: true,
    render: (r) => formatCount(r.totalRows),
  },
  { key: 'amount', label: t('settlementImports.colAmountTotal'), sortable: true, numeric: true, ltr: true, render: (r) => el('p', 'text-bold ad-ltr', formatEgp(r.amount)) },
  { key: 'status', label: t('settlementImports.colStatus'), render: (r) => importLamp(r.status) },
  { key: 'decidedAt', label: t('settlementImports.colDecided'), sortable: true, render: (r) => whoWhen(r.decidedBy, r.decidedAt) },
  {
    key: 'actions',
    label: t('common.actions'),
    render: (r) => {
      // The import's own page (2026-11-04).
      const link = el('a', 'btn grid-options-btn view-icon');
      link.href = `settlement-import.html?id=${encodeURIComponent(r.id)}`;
      link.setAttribute('aria-label', `${t('common.view')} ${r.id}`);
      const i = el('i', 'fa-regular fa-eye');
      i.setAttribute('aria-hidden', 'true');
      // Icon-only, as the kit's admin-accounts row actions are; the label is the title + aria-label.
      link.title = t('common.view');
      link.appendChild(i);
      return link;
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
historyTable.addEventListener('sortchange', (event) => {
  historyQuery.sort = event.detail;
  historyTable.sort = historyQuery.sort;
  historyQuery.page = 1;
  loadHistory();
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

// A request's link opens the review here; a decision reloads this screen.
wireInPlaceApprovals({ onDecided: loadHistory });

// ── Boot ─────────────────────────────────────────────
loadHistory();
const params = new URLSearchParams(window.location.search);
const startStep = Number(params.get('step'));
if ([1, 2, 3].includes(startStep) && canImport) {
  openWizard(startStep);
  const sample = params.get('sample');
  // Demo deep links: load a sample sheet, then walk on to the asked-for step.
  if (['clean', 'format', 'business'].includes(sample)) {
    goTo(2);
    loadSample(sample).then((ok) => {
      if (ok && startStep === 3) goStep(3);
      setUrlParams({ sample });
    });
  }
} else {
  closeWizard();
}
