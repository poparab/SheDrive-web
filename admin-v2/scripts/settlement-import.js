/**
 * settlement-import.js — SheDrive admin settlement import view
 * Spec: docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md §4
 * Story: #5620 / #6492 · design #5636
 *
 * One sent settlement sheet, opened from the history on settlement-imports.html
 * (`?id=IMP-0001`). It replaces the history's detail modal now that the import
 * itself is a page-by-page wizard (2026-11-04).
 *
 * Laid out as payout-batch.html: the summary card (with "Download the file")
 * beside the state timeline, the step 3 tiles, then every row with a search,
 * a result filter and the kit's Rows count.
 *
 * Only an approved import has this page (2026-11-04): each row posted a
 * settlement and the Receipt column is filled. A pending file is read in its
 * approval request and a rejected one has nothing to show, so the history
 * offers no View for them and their `?id=` shows the not-found state.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { downloadCsv, formatCount, formatDateTime, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import '../components/ad-data-table.js';
import '../components/ad-stat-card.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#import-body');
const missing = qs('#import-missing');
const errorBox = qs('#import-error');
const loading = qs('#import-loading');
const rowsTable = qs('#rows-table');
const search = qs('#rows-search');
const resultFilter = qs('#rows-result');

const id = new URLSearchParams(window.location.search).get('id');

let imp = null;

// ── Small helpers ────────────────────────────────────
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function ltr(text, className = '') {
  if (text === null || text === undefined || text === '') return null;
  return el('span', `ad-ltr ${className}`.trim(), String(text));
}

function glyph(classes) {
  const i = el('i', classes);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/** Kit status lamp. */
function lamp(className, label) {
  const wrap = el('div', className);
  wrap.append(el('div', 'lamp'), document.createTextNode(label));
  return wrap;
}

/** Kit alert: icon + text, or a `.details` block. */
function alertBox(tone, content) {
  const icons = { info: 'fa-circle-info', warning: 'fa-hourglass-half', success: 'fa-circle-check', danger: 'fa-circle-exclamation' };
  const box = el('div', `alert ${tone} align-items-start`);
  box.appendChild(glyph(`fa-solid ${icons[tone]}`));
  box.appendChild(content instanceof Node ? content : el('p', '', content));
  return box;
}

/** Money with the kit's colour: what she owes in danger, a credit in success. */
function balance(value) {
  if (value === null || value === undefined) return null;
  const tone = value < 0 ? 'danger-color' : value > 0 ? 'success-color' : '';
  return el('p', `text-bold ad-ltr ${tone}`.trim(), formatEgp(value));
}

/** Date on one line, the admin under it. */
function whenWho(at, name) {
  if (!at) return null;
  const stack = el('div', 'sv-when');
  stack.appendChild(el('span', '', formatDateTime(at)));
  if (name) stack.appendChild(ltr(name, 'sv-muted'));
  return stack;
}

/** Kit key/value list: [[label, value, muted?], …]. */
function kvList(pairs) {
  const list = el('div', 'list-multi-column no-border p-0');
  const row = el('div', 'row gx-4');
  const col = el('div', 'col');
  pairs.forEach(([label, value, muted]) => {
    const line = el('div', 'row gx-0 list-row');
    const val = el('div', `list-item col-auto justify-content-md-end${muted ? ' sv-muted' : ''}`);
    if (value instanceof Node) val.appendChild(value);
    else val.textContent = value === null || value === undefined || value === '' ? t('common.notAvailable') : String(value);
    line.append(el('div', 'list-item col text-bold', label), val);
    col.appendChild(line);
  });
  row.appendChild(col);
  list.appendChild(row);
  return list;
}

// ── Labels ───────────────────────────────────────────
const CHANNEL_KEYS = {
  'Bank transfer': 'settlementImports.channelBank',
  Fawry: 'settlementImports.channelFawry',
  'Mobile wallet': 'settlementImports.channelWallet',
  'Field agent': 'settlementImports.channelAgent',
};
const channelLabel = (value) => (CHANNEL_KEYS[value] ? t(CHANNEL_KEYS[value]) : value || null);

const STATUS = {
  pending: ['status-warning-lamp', 'settlementImports.statusPending'],
  approved: ['status-active-lamp', 'settlementImports.statusApproved'],
  rejected: ['status-danger-lamp', 'settlementImports.statusRejected'],
};
function statusLamp(status) {
  const [cls, key] = STATUS[status] ?? ['status-disabled-lamp', null];
  return lamp(cls, key ? t(key) : status);
}

/**
 * What a row did to her balance, as step 3 worded it.
 */
function outcomeLamp(row) {
  switch (row.outcome) {
    case 'full':
      return lamp('status-active-lamp', t('settlementImports.outcomeFull'));
    case 'partial':
      return lamp('status-warning-lamp', t('settlementImports.outcomePartial', { owed: formatEgp(-row.balanceAfter) }));
    case 'credit':
      return lamp('status-blue-lamp', t('settlementImports.outcomeCredit', { extra: formatEgp(Math.min(row.amount, row.balanceAfter)) }));
    default:
      return lamp('status-disabled-lamp', t('settlementImports.resultPassed'));
  }
}

// ── Render: standing ─────────────────────────────────
function renderStanding() {
  qs('#import-standing').replaceChildren(alertBox('success', t('settlementImport.approvedNote', {
    name: imp.decidedBy ?? '—',
    at: imp.decidedAt ? formatDateTime(imp.decidedAt) : '—',
  })));
}

// ── Render: summary card ─────────────────────────────
function renderSummary() {
  qs('#import-file').textContent = imp.fileName;
  const notYet = t('settlementImport.notYet');
  const request = imp.request;
  let requestValue = null;
  if (request) {
    // A pending request opens in place; a decided one is still worth reading.
    const a = ltr(request.id);
    const link = el('a', 'list__link');
    link.href = approvalHref(request.id);
    link.appendChild(a);
    requestValue = link;
  }
  qs('#import-summary').replaceChildren(kvList([
    [t('settlementImport.fileId'), ltr(imp.id)],
    [t('settlementImport.fileName'), ltr(imp.fileName)],
    [t('settlementImport.status'), statusLamp(imp.status)],
    [t('settlementImport.uploaded'), whenWho(imp.createdAt, imp.createdBy)],
    [t('settlementImport.decided'), whenWho(imp.decidedAt, imp.decidedBy) ?? notYet, !imp.decidedAt],
    [t('settlementImport.rows'), formatCount(imp.totalRows)],
    [t('settlementImport.amount'), el('p', 'text-bold ad-ltr', formatEgp(imp.amount))],
    [t('settlementImport.request'), requestValue],
  ]));
}

// ── Render: state timeline ───────────────────────────
function renderTimeline() {
  const atBy = (at, name) => (at ? (name ? t('settlementImport.atBy', { at: formatDateTime(at), name }) : formatDateTime(at)) : '');
  const items = [
    { label: t('settlementImport.stepSent'), meta: atBy(imp.createdAt, imp.createdBy), tone: 'success' },
    { label: t('settlementImport.stepApproved'), meta: atBy(imp.decidedAt, imp.decidedBy), tone: 'success' },
    { label: t('settlementImport.stepApplied'), meta: atBy(imp.decidedAt), tone: 'success' },
  ];
  const list = el('ol', 'timeline-vertical sv-timeline');
  items.forEach((item) => {
    const li = el('li', item.tone);
    // The kit's own tag name for a timeline label.
    li.appendChild(el('lable', '', item.label));
    li.appendChild(el('span', '', item.meta));
    list.appendChild(li);
  });
  qs('#import-timeline').replaceChildren(list);
}

// ── Render: tiles ────────────────────────────────────
function renderStats() {
  const rows = imp.rows ?? [];
  const n = (outcome) => formatCount(rows.filter((r) => r.outcome === outcome).length);
  qs('#stat-amount').setAttribute('value', formatEgp(imp.amount));
  qs('#stat-full').setAttribute('value', n('full'));
  qs('#stat-partial').setAttribute('value', n('partial'));
  qs('#stat-credit').setAttribute('value', n('credit'));
}

// ── Rows grid ────────────────────────────────────────
const PAGE_SIZE = 10;
let page = 1;
let pageSize = PAGE_SIZE;

function columns() {
  const cols = [
    { key: 'rowNo', label: t('settlementImports.colRow'), numeric: true, render: (r) => String(r.rowNo) },
    {
      // Her name in the system, linked to her balance, with her phone and
      // national ID under it (shown in full — product rule).
      key: 'driver',
      label: t('settlementImport.colDriver'),
      className: 'sv-wrap',
      render: (r) => {
        const stack = el('div', 'sv-stack');
        const name = r.systemName ?? r.driverName;
        if (r.driverId) {
          const a = el('a', 'list__link text-bold', name);
          a.href = `driver-balance-details.html?id=${encodeURIComponent(r.driverId)}`;
          stack.appendChild(a);
        } else stack.appendChild(el('p', 'text-bold', name));
        if (r.driverName && r.driverName !== r.systemName) stack.appendChild(el('span', 'sv-muted', t('kitFinance.siNameInSheet', { name: r.driverName })));
        if (r.phone) stack.appendChild(ltr(r.phone, 'sv-muted'));
        if (r.nationalId) stack.appendChild(ltr(r.nationalId, 'sv-muted'));
        return stack;
      },
    },
    { key: 'amount', label: t('settlementImports.colAmountEgp'), numeric: true, ltr: true, render: (r) => el('p', 'text-bold ad-ltr', formatEgp(r.amount)) },
    { key: 'balanceBefore', label: t('settlementImport.colBalanceBefore'), numeric: true, ltr: true, render: (r) => balance(r.balanceBefore) },
    { key: 'balanceAfter', label: t('settlementImports.colBalanceAfter'), numeric: true, ltr: true, render: (r) => balance(r.balanceAfter) },
    {
      // Payment reference, with the payment date and channel under it.
      key: 'paymentRef',
      label: t('settlementImports.colPaymentRef'),
      render: (r) => {
        const stack = el('div', 'sv-stack');
        stack.appendChild(ltr(r.paymentRef) ?? el('span', '', t('common.notAvailable')));
        const under = [r.paymentDate, channelLabel(r.channel)].filter(Boolean).join(' • ');
        if (under) stack.appendChild(el('span', 'sv-muted', under));
        return stack;
      },
    },
    { key: 'outcome', label: t('settlementImports.colResult'), className: 'sv-wrap-wide', render: outcomeLamp },
  ];
  cols.push({ key: 'receipt', label: t('settlementImports.colReceipt'), ltr: true, render: (r) => ltr(r.receipt, 'text-bold') });
  return cols;
}

function matching() {
  const needle = search.value.trim().toLowerCase();
  const result = resultFilter.value;
  return (imp.rows ?? []).filter((r) => (result === 'all' || r.outcome === result)
    && (!needle || [r.systemName, r.driverName, r.nationalId, r.phone, r.paymentRef, r.receipt]
      .some((v) => v && String(v).toLowerCase().includes(needle))));
}

function renderRows() {
  const rows = matching();
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  page = Math.min(page, totalPages);
  rowsTable.setData({
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    totalPages,
  });
}

rowsTable.pageSize = PAGE_SIZE;
rowsTable.emptyState = {
  icon: 'not-found.svg',
  heading: t('settlementImport.noMatchHeading'),
  message: t('settlementImport.noMatchMessage'),
};
rowsTable.addEventListener('pagechange', (event) => {
  page = event.detail.page;
  renderRows();
});
// The kit's Rows count (10 / 20 / 50), as on every grid.
rowsTable.addEventListener('pagesizechange', (event) => {
  pageSize = event.detail.pageSize;
  rowsTable.pageSize = pageSize;
  page = 1;
  renderRows();
});
search.addEventListener('input', () => {
  page = 1;
  renderRows();
});
resultFilter.addEventListener('change', () => {
  page = 1;
  renderRows();
});

// ── Download ─────────────────────────────────────────
// The file as it was sent: the template's seven columns, one line per row.
qs('#btn-download').addEventListener('click', () => {
  if (!imp) return;
  downloadCsv(
    imp.fileName || `${t('settlementImport.csvName')}-${imp.id}-${toDateInputValue(Date.now())}.csv`,
    ['national_id', 'driver_name', 'phone_number', 'amount_egp', 'payment_date', 'payment_channel', 'payment_reference'],
    (imp.rows ?? []).map((r) => [r.nationalId, r.driverName, r.phone, r.amount, r.paymentDate, r.channel, r.paymentRef]),
  );
});

// ── Load ─────────────────────────────────────────────
function show(which) {
  loading.hidden = which !== 'loading';
  body.hidden = which !== 'body';
  missing.hidden = which !== 'missing';
  errorBox.hidden = which !== 'error';
}

async function load() {
  if (!imp) show('loading');
  try {
    const result = id ? await mockApi.getSettlementImport(id) : null;
    // Only an approved import can be viewed.
    if (!result || result.status !== 'approved') {
      show('missing');
      return;
    }
    imp = result;
    document.title = `${t('shell.brand')} — ${imp.id}`;
    renderStanding();
    renderSummary();
    renderTimeline();
    renderStats();
    rowsTable.columns = columns();
    renderRows();
    show('body');
  } catch (error) {
    qs('#import-error-state').setAttribute('message', error.message);
    show('error');
  }
}

// A request's link opens the review here; a decision reloads this page.
wireInPlaceApprovals({ onDecided: load });

qs('#import-retry').addEventListener('click', load);

await load();
