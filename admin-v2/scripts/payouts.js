/**
 * payouts.js — SheDrive admin payout batches (2026-10-14 spec §3)
 *
 * Lists payout batches and generates a new one. Generating is a two-step act:
 * the preview shows who a batch made now would pay (and who it leaves out and
 * why), then confirming creates the batch as a `payout_batch` request that a
 * different admin must approve (§1). Nothing is paid from this screen.
 *
 * The preview needs two tables and a skipped list, which the field-driven
 * ad-form-modal cannot render, so it is a kit Bootstrap modal built here.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp, formatCount } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#batch-filters');
const table = qs('#batches-table');

const query = { status: 'all', page: 1, pageSize: 20, sort: { key: 'createdAt', dir: 'desc' } };

const STATUSES = ['pending_approval', 'ready', 'sent_to_bank', 'result_pending', 'completed', 'rejected'];
const OPEN_STATUSES = ['pending_approval', 'ready', 'sent_to_bank', 'result_pending'];

/** Batch status → the kit's lamp class. */
const LAMP = {
  pending_approval: 'status-warning-lamp',
  ready: 'status-blue-lamp',
  sent_to_bank: 'status-primary-lamp',
  result_pending: 'status-warning-lamp',
  completed: 'status-active-lamp',
  rejected: 'status-danger-lamp',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function statusLamp(status) {
  const wrap = el('div', LAMP[status] ?? 'status-blue-lamp');
  wrap.append(el('div', 'lamp'), document.createTextNode(t(`payouts.status_${status}`)));
  return wrap;
}

function ltr(text) {
  return el('span', 'ad-ltr', text);
}

const typeLabel = (type) => t(`payouts.type_${type}`);

// ── Filters ──────────────────────────────────────────
filters.fields = [
  {
    type: 'select',
    key: 'status',
    label: t('payouts.filterStatus'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      ...STATUSES.map((s) => ({ value: s, label: t(`payouts.status_${s}`) })),
    ],
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

// ── Grid ─────────────────────────────────────────────
table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  {
    key: 'ref',
    label: t('payouts.colRef'),
    sortable: true,
    render: (row) => {
      const a = el('a', 'list__link ad-ltr', row.ref);
      a.href = `payout-batch.html?id=${encodeURIComponent(row.id)}`;
      return a;
    },
  },
  {
    key: 'createdAt',
    label: t('payouts.colCreated'),
    sortable: true,
    render: (row) => {
      const stack = el('div', 'list__name');
      stack.append(
        el('span', 'list__name-primary', formatDate(row.createdAt)),
        el('span', 'list__name-secondary', t('payouts.createdBy', { name: row.createdBy })),
      );
      return stack;
    },
  },
  { key: 'lineCount', label: t('payouts.colLines'), sortable: true, numeric: true, render: (row) => formatCount(row.lineCount) },
  { key: 'total', label: t('payouts.colTotal'), sortable: true, numeric: true, render: (row) => formatEgp(row.total) },
  {
    key: 'paidFailed',
    label: t('payouts.colPaidFailed'),
    numeric: true,
    render: (row) => {
      const span = el('span', 'payouts-counts');
      span.append(
        el('span', 'payouts-counts__paid', formatCount(row.paidCount)),
        document.createTextNode(' / '),
        el('span', row.failedCount ? 'payouts-counts__failed' : '', formatCount(row.failedCount)),
      );
      return span;
    },
  },
  { key: 'status', label: t('payouts.colStatus'), sortable: true, render: (row) => statusLamp(row.status) },
];
table.rowHref = (row) => `payout-batch.html?id=${encodeURIComponent(row.id)}`;
table.emptyState = {
  icon: 'wallet.svg',
  heading: t('payouts.emptyHeading'),
  message: t('payouts.emptyMessage'),
};

table.addEventListener('sortchange', (event) => {
  query.sort = event.detail;
  table.sort = event.detail;
  load();
});
table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

// ── KPI row ──────────────────────────────────────────
async function loadStats() {
  const cardDue = qs('#card-due');
  const cardOpen = qs('#card-open');
  const cardPaid = qs('#card-paid');
  try {
    const [preview, all] = await Promise.all([
      mockApi.previewPayoutBatch(),
      mockApi.listPayoutBatches({ status: 'all', page: 1, pageSize: 1000 }),
    ]);
    cardDue.value = formatEgp(preview.total);
    cardDue.meta = t('payouts.kpiDueMeta', { n: formatCount(preview.count) });

    const rows = all.rows ?? [];
    const inBank = rows.filter((b) => ['sent_to_bank', 'result_pending'].includes(b.status));
    cardOpen.value = formatEgp(inBank.reduce((sum, b) => sum + b.total, 0));
    cardOpen.meta = t('payouts.kpiOpenMeta');

    // Paid this month: paid lines of batches completed this calendar month.
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const done = rows.filter((b) => b.status === 'completed' && b.completedAt >= start.getTime());
    const details = await Promise.all(done.map((b) => mockApi.getPayoutBatch(b.id)));
    const paid = details.filter(Boolean);
    cardPaid.value = formatEgp(paid.reduce((sum, b) => sum + (b.paidTotal ?? 0), 0));
    cardPaid.meta = t('payouts.kpiPaidMeta', {
      n: formatCount(paid.reduce((sum, b) => sum + b.lines.filter((l) => l.status === 'paid').length, 0)),
    });
  } catch {
    [cardDue, cardOpen, cardPaid].forEach((card) => {
      card.value = t('common.notAvailable');
    });
  }
}

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listPayoutBatches(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

// ── Generate: preview modal ──────────────────────────
let modal = null;

function buildModal() {
  const root = el('div', 'modal fade payouts-preview');
  root.id = 'preview-modal';
  root.tabIndex = -1;
  root.setAttribute('aria-labelledby', 'preview-title');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title" id="preview-title"></h4>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body payouts-preview__body" id="preview-body"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" id="preview-confirm"></button>
          <button type="button" class="btn btn-primary-outline" data-bs-dismiss="modal" id="preview-cancel"></button>
        </div>
      </div>
    </div>`;
  qs('#preview-title', root).textContent = t('payouts.previewTitle');
  const close = qs('.btn-close', root);
  close.setAttribute('aria-label', t('aria.closeDialog'));
  qs('#preview-confirm', root).textContent = t('payouts.confirm');
  qs('#preview-cancel', root).textContent = t('common.cancel');
  qs('#preview-confirm', root).addEventListener('click', confirmBatch);
  document.body.appendChild(root);
  return root;
}

function headerRow(labels) {
  const thead = el('thead');
  const tr = el('tr');
  labels.forEach(([label, numeric]) => tr.appendChild(el('th', numeric ? 'text-end' : '', label)));
  thead.appendChild(tr);
  return thead;
}

function renderPreview(body, preview, openBatch) {
  body.textContent = '';

  if (!preview.lines.length) {
    const empty = el('div', 'result-message info payouts-preview__empty');
    empty.append(el('h3', '', t('payouts.previewEmpty')));
    body.appendChild(empty);
  } else {
    body.append(
      el('p', 'payouts-preview__summary', t('payouts.previewSummary', { n: formatCount(preview.count), total: formatEgp(preview.total) })),
      el('p', 'payouts-notice', t('payouts.previewApprovalNote')),
    );
    if (openBatch) {
      body.appendChild(el('p', 'payouts-notice payouts-notice--warning', t('payouts.previewOpenNote', { ref: openBatch.ref })));
    }

    const wrap = el('div', 'table-responsive');
    const grid = el('table', 'table custom-grid-list payouts-preview__table');
    grid.appendChild(
      headerRow([
        [t('payouts.previewColDriver')],
        [t('payouts.previewColType')],
        [t('payouts.previewColProvider')],
        [t('payouts.previewColNumber')],
        [t('payouts.previewColDue'), true],
        [t('payouts.previewColBalance'), true],
        [t('payouts.previewColAmount'), true],
      ]),
    );
    const tbody = el('tbody');
    preview.lines.forEach((line) => {
      const tr = el('tr');
      const amount = el('td', 'text-end payouts-preview__amount', formatEgp(line.amount));
      [
        el('td', '', line.driverName),
        el('td', '', typeLabel(line.payoutType)),
        el('td', '', line.provider || '—'),
        (() => { const td = el('td'); td.appendChild(ltr(line.masked)); return td; })(),
        el('td', 'text-end', formatEgp(line.dueNet)),
        el('td', 'text-end', formatEgp(line.balance)),
        amount,
      ].forEach((td) => tr.appendChild(td));
      tbody.appendChild(tr);
    });
    grid.appendChild(tbody);
    const tfoot = el('tfoot');
    const totalRow = el('tr', 'payouts-preview__total');
    const totalLabel = el('td', '', t('payouts.previewTotal'));
    totalLabel.colSpan = 6;
    totalRow.append(totalLabel, el('td', 'text-end', formatEgp(preview.total)));
    tfoot.appendChild(totalRow);
    grid.appendChild(tfoot);
    wrap.appendChild(grid);
    body.append(wrap, el('p', 'ad-section__hint', t('payouts.previewAmountHint')));
  }

  if (preview.skipped.length) {
    const section = el('div', 'payouts-skipped');
    section.appendChild(el('h5', 'payouts-skipped__title', t('payouts.skippedHeading', { n: formatCount(preview.skipped.length) })));
    const list = el('ul', 'payouts-skipped__list');
    preview.skipped.forEach((s) => {
      const li = el('li', 'payouts-skipped__item');
      const who = el('span', 'payouts-skipped__who');
      who.append(el('strong', '', s.driverName), el('span', 'payouts-skipped__due', t('payouts.skippedDue', { amount: formatEgp(s.dueNet) })));
      li.append(
        who,
        el(
          'span',
          `payouts-skipped__reason payouts-skipped__reason--${s.reason}`,
          s.reason === 'owes' ? t('payouts.reasonOwes') : t('payouts.reasonNoMethod'),
        ),
      );
      list.appendChild(li);
    });
    section.appendChild(list);
    body.appendChild(section);
  }
}

async function openPreview() {
  if (!modal) modal = buildModal();
  const body = qs('#preview-body', modal);
  const confirm = qs('#preview-confirm', modal);
  confirm.disabled = true;
  body.textContent = '';
  const loading = el('p', 'payouts-preview__loading');
  loading.append(el('span', 'spinner'), document.createTextNode(` ${t('payouts.previewLoading')}`));
  body.appendChild(loading);

  try {
    await loadBootstrap();
  } catch {
    /* fall back below */
  }
  if (window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(modal).show();
  } else {
    modal.classList.add('show');
    modal.style.display = 'block';
  }

  try {
    const [preview, all] = await Promise.all([
      mockApi.previewPayoutBatch(),
      mockApi.listPayoutBatches({ status: 'all', page: 1, pageSize: 1000 }),
    ]);
    const openBatch = (all.rows ?? []).find((b) => OPEN_STATUSES.includes(b.status)) ?? null;
    renderPreview(body, preview, openBatch);
    confirm.disabled = preview.lines.length === 0;
  } catch (error) {
    body.textContent = '';
    body.appendChild(el('p', 'ad-form-error is-visible', error.message));
  }
}

function hideModal() {
  if (window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(modal).hide();
  } else {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

async function confirmBatch() {
  const confirm = qs('#preview-confirm', modal);
  confirm.disabled = true;
  try {
    const result = await mockApi.createPayoutBatch();
    const ref = result?.batch?.ref;
    if (!ref) throw new Error(t('common.notAvailable'));
    shell.showToast(t('payouts.sentForApproval', { ref }), 'success');
    hideModal();
    // The detail page repeats the toast, since this one is lost on navigation.
    window.location.href = `payout-batch.html?id=${encodeURIComponent(result.batch.id)}&created=1`;
  } catch (error) {
    const body = qs('#preview-body', modal);
    body.prepend(el('p', 'ad-form-error is-visible', error.message));
    confirm.disabled = false;
  }
}

qs('#btn-generate').addEventListener('click', openPreview);

load();
loadStats();
