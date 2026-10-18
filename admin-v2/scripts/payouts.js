/**
 * payouts.js — SheDrive admin payout batches (2026-10-14 spec §3)
 *
 * Lists payout batches and generates a new one. Generating is a two-step act:
 * the preview lists only the drivers a batch made now would pay, then
 * confirming creates the batch as a `payout_batch` request that a different
 * admin must approve (§1). Nothing is paid from this screen.
 *
 * The preview needs a table of lines, which the field-driven
 * ad-form-modal cannot render, so it is a kit `default-modal` built here.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp, formatCount } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';

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
  { key: 'total', label: t('payouts.colTotal'), sortable: true, numeric: true, render: (row) => el('p', 'text-bold ad-ltr', formatEgp(row.total)) },
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
  {
    key: 'actions',
    label: t('common.actions'),
    render: (row) => {
      const a = el('a', 'btn btn-primary-outline', t('common.view'));
      a.href = `payout-batch.html?id=${encodeURIComponent(row.id)}`;
      a.setAttribute('aria-label', `${t('common.view')} ${row.ref}`);
      return a;
    },
  },
];
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

// ── Generate: preview modal (kit default-modal) ──────
let modal = null;

function buildModal() {
  const root = el('div', 'modal fade default-modal payouts-preview');
  root.id = 'preview-modal';
  root.tabIndex = -1;
  root.dataset.bsBackdrop = 'static';
  root.setAttribute('aria-labelledby', 'preview-title');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <img class="icon" alt="" />
          <h3 id="preview-title"></h3>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body payouts-preview__body" id="preview-body"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-success" id="preview-confirm"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span></span></button>
          <button type="button" class="btn btn-primary-outline" data-bs-dismiss="modal" id="preview-cancel"><i class="fa-solid fa-xmark" aria-hidden="true"></i><span></span></button>
        </div>
      </div>
    </div>`;
  qs('img.icon', root).src = iconUrl('wallet-plus.svg');
  qs('#preview-title', root).textContent = t('payouts.previewTitle');
  qs('.btn-close', root).setAttribute('aria-label', t('aria.closeDialog'));
  qs('#preview-confirm span', root).textContent = t('payouts.confirm');
  qs('#preview-cancel span', root).textContent = t('common.cancel');
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

function alertBox(tone, text) {
  const box = el('div', `alert ${tone}`);
  const glyph = el('i', tone === 'warning' ? 'fa-solid fa-triangle-exclamation' : tone === 'danger' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-info');
  glyph.setAttribute('aria-hidden', 'true');
  box.append(glyph, el('p', '', text));
  return box;
}

function cell(className, node) {
  const td = el('td', className);
  td.appendChild(node);
  return td;
}

function renderPreview(body, preview, openBatch) {
  body.textContent = '';

  if (!preview.lines.length) {
    const empty = el('div', 'result-message info payouts-preview__empty');
    const iconWrap = el('span', 'icon');
    const img = el('img');
    img.src = iconUrl('wallet.svg');
    img.alt = '';
    iconWrap.appendChild(img);
    empty.append(iconWrap, el('h3', '', t('payouts.previewEmpty')));
    body.appendChild(empty);
    if (openBatch) body.appendChild(alertBox('warning', t('payouts.previewOpenNote', { ref: openBatch.ref })));
    return;
  }

  body.append(
    el('p', 'payouts-preview__summary', t('payouts.previewSummary', { n: formatCount(preview.count), total: formatEgp(preview.total) })),
    alertBox('info', t('payouts.previewApprovalNote')),
  );
  if (openBatch) body.appendChild(alertBox('warning', t('payouts.previewOpenNote', { ref: openBatch.ref })));

  // Only the drivers this batch pays — nobody left out is listed (2026-10-14).
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
    tr.append(
      el('td', '', line.driverName),
      el('td', '', typeLabel(line.payoutType)),
      el('td', '', line.provider || '—'),
      cell('', ltr(line.number)),
      cell('text-end', ltr(formatEgp(line.dueNet))),
      cell('text-end', ltr(formatEgp(line.balance))),
      cell('text-end', el('p', 'text-bold success-color ad-ltr', formatEgp(line.amount))),
    );
    tbody.appendChild(tr);
  });
  grid.appendChild(tbody);
  const tfoot = el('tfoot');
  const totalRow = el('tr', 'payouts-preview__total');
  const totalLabel = el('td', '', t('payouts.previewTotal'));
  totalLabel.colSpan = 6;
  totalRow.append(totalLabel, cell('text-end', el('p', 'text-bold ad-ltr', formatEgp(preview.total))));
  tfoot.appendChild(totalRow);
  grid.appendChild(tfoot);
  wrap.appendChild(grid);
  body.append(wrap, el('p', 'small lh-sm payouts-preview__hint', t('payouts.previewAmountHint')));
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
    body.appendChild(alertBox('danger', error.message));
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
    body.prepend(alertBox('danger', error.message));
    confirm.disabled = false;
  }
}

// "Generate payout batch" sits on the title row's end side, as the kit's create actions do.
(() => {
  const host = qs('#ad-page-actions');
  if (!host) return;
  const btn = el('button', 'btn btn-success d-flex gap-2');
  btn.type = 'button';
  btn.id = 'btn-generate';
  const glyph = el('i', 'fa-solid fa-plus');
  glyph.setAttribute('aria-hidden', 'true');
  btn.append(glyph, el('span', '', t('payouts.generate')));
  host.appendChild(btn);
})();

qs('#btn-generate').addEventListener('click', openPreview);

load();
loadStats();
