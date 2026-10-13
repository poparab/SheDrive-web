/**
 * rider-balances.js — SheDrive admin rider fee balances (FIN-11)
 *
 * The rider side of the financial core ledger model (spec §2.2): a late
 * cancellation posts a debit, recovered as a cash surcharge on her next trip.
 *
 * One cancellation fee at a time can be waived (2026-10-14 spec §5). Waiving
 * is a maker-checker request (§1): nothing changes until a different admin
 * approves it, and then the rider ledger posts `fee_waived` and the credited
 * driver's ledger posts `fee_credit_reversed`. A waived fee she had already
 * paid leaves her a credit — shown, not spent, this phase. Persistent abuse
 * stays a human decision, handled from her profile.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp, toDateInputValue, downloadCsv } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const waiveModal = qs('#waive-modal');
const filters = qs('#rider-balance-filters');
const table = qs('#rider-balance-table');
const ledgerPanel = qs('#ledger-panel');
const ledgerTable = qs('#ledger-table');

const query = { search: '', filter: 'owing', page: 1, pageSize: 20, sort: { key: 'outstanding', dir: 'desc' } };
const ledgerQuery = { riderId: '', page: 1, pageSize: 20 };

let selected = null;

const ENTRY_LABEL_KEYS = {
  cancellation_fee: 'riderBalances.entryCancellationFee',
  fee_collected: 'riderBalances.entryFeeCollected',
  fee_waived: 'riderBalancesFinance.entryFeeWaived',
};

const approvalHref = (id) => `approvals.html?id=${encodeURIComponent(id)}`;

function chip(text, tone) {
  const span = document.createElement('span');
  span.className = `badge badge--${tone}`;
  span.textContent = text;
  return span;
}

/** The maker-checker toast: what happened, plus a link to the request. */
function toastSentForApproval(request) {
  const toast = shell.showToast(t('riderBalancesFinance.sentForApproval'), 'success', 8000);
  if (!toast || !request?.id) return;
  const link = document.createElement('a');
  link.className = 'toast__link';
  link.href = approvalHref(request.id);
  link.textContent = t('riderBalancesFinance.openRequest');
  toast.append(' ', link);
}

// ── Filters ──────────────────────────────────────────
filters.fields = [
  { type: 'search', key: 'search', label: t('common.name'), placeholder: t('common.search') },
  {
    type: 'select',
    key: 'filter',
    label: t('riderBalances.filterBalance'),
    value: 'owing',
    options: [
      { value: 'owing', label: t('riderBalances.owing') },
      { value: 'credit', label: t('riderBalancesFinance.filterCredit') },
      { value: 'all', label: t('common.all') },
    ],
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: async () => {
      const all = await mockApi.listRiderBalances({ ...query, page: 1, pageSize: 1000 });
      downloadCsv(
        `${t('riderBalances.csvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('common.name'),
          t('common.phone'),
          t('riderBalances.colOutstanding'),
          t('riderBalancesFinance.colCredit'),
          t('riderBalances.colLastFee'),
        ],
        all.rows.map((r) => [
          r.name,
          r.phone,
          r.outstanding.toFixed(2),
          (r.credit ?? 0).toFixed(2),
          r.lastFeeAt ? formatDate(r.lastFeeAt) : '',
        ]),
      );
    },
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  closeLedger();
  load();
});

// ── Balances table ───────────────────────────────────
table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  { key: 'name', label: t('common.name'), sortable: true, render: (row) => row.name },
  {
    key: 'phone',
    label: t('common.phone'),
    render: (row) => {
      const span = document.createElement('span');
      span.className = 'ad-ltr';
      span.textContent = row.phone;
      return span;
    },
  },
  {
    key: 'outstanding',
    label: t('riderBalances.colOutstanding'),
    sortable: true,
    numeric: true,
    render: (row) => (row.outstanding > 0 ? formatEgp(row.outstanding) : null),
  },
  {
    // §5 — a waived fee she had already paid. Blank when 0.
    key: 'credit',
    label: t('riderBalancesFinance.colCredit'),
    sortable: true,
    numeric: true,
    render: (row) => (row.credit > 0 ? formatEgp(row.credit) : null),
  },
  {
    key: 'lastFeeAt',
    label: t('riderBalances.colLastFee'),
    sortable: true,
    render: (row) => (row.lastFeeAt ? formatDate(row.lastFeeAt) : null),
  },
  {
    key: 'ledger',
    label: '',
    render: (row) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--ghost btn--sm';
      button.textContent = t('riderBalances.ledger');
      button.addEventListener('click', () => openLedger(row));
      return button;
    },
  },
];
table.emptyState = {
  icon: '⇌',
  heading: t('riderBalances.emptyHeading'),
  message: t('riderBalances.emptyMessage'),
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

// ── Ledger panel ─────────────────────────────────────
ledgerTable.pageSize = ledgerQuery.pageSize;
ledgerTable.columns = [
  { key: 'at', label: t('riderBalances.colDate'), render: (row) => formatDate(row.at) },
  {
    key: 'type',
    label: t('riderBalances.colType'),
    render: (row) => (ENTRY_LABEL_KEYS[row.type] ? t(ENTRY_LABEL_KEYS[row.type]) : row.type),
  },
  {
    key: 'amount',
    label: t('riderBalances.colAmount'),
    numeric: true,
    render: (row) => {
      const span = document.createElement('span');
      span.className =
        row.amount >= 0 ? 'ledger-amount ledger-amount--credit' : 'ledger-amount ledger-amount--debit';
      span.textContent = `${row.amount >= 0 ? '+' : '−'}${formatEgp(Math.abs(row.amount))}`;
      return span;
    },
  },
  {
    key: 'source',
    label: t('riderBalances.colSource'),
    render: (row) => {
      if (!row.tripId) return null;
      const span = document.createElement('span');
      span.className = 'ad-ltr';
      span.textContent = row.tripId;
      return span;
    },
  },
  { key: 'note', label: t('riderBalances.colNote'), render: (row) => row.note ?? null },
  {
    // §5 — one fee at a time, never twice: a waived fee says so, a fee with a
    // waiver awaiting approval links to it, every other fee can be waived.
    key: 'action',
    label: t('riderBalancesFinance.colAction'),
    render: (row) => {
      if (row.type !== 'cancellation_fee') return null;
      if (row.waived) return chip(t('riderBalancesFinance.waived'), 'success');
      if (row.waiverPending) {
        const link = document.createElement('a');
        link.className = 'badge badge--warning rider-waiver-pending';
        link.href = approvalHref(row.waiverPending.id);
        link.textContent = t('riderBalancesFinance.waiverPending');
        return link;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--ghost btn--sm';
      button.textContent = t('riderBalancesFinance.waive');
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
  loadLedger();
});

qs('#ledger-close').addEventListener('click', closeLedger);

function closeLedger() {
  selected = null;
  ledgerPanel.hidden = true;
}

async function openLedger(row) {
  selected = row;
  ledgerQuery.riderId = row.id;
  ledgerQuery.page = 1;
  ledgerPanel.hidden = false;
  qs('#ledger-title').textContent = t('riderBalances.ledgerFor', { name: row.name });
  qs('#btn-view-profile').href = `rider-profile.html?id=${encodeURIComponent(row.id)}`;
  ledgerPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await loadLedger();
}

function renderLedgerSummary(rider) {
  const summary = qs('#ledger-summary');
  summary.textContent = '';
  const pairs = [[t('riderBalances.statOutstanding'), formatEgp(rider.outstanding)]];
  if (rider.credit > 0) pairs.push([t('riderBalancesFinance.statCredit'), formatEgp(rider.credit)]);
  pairs.forEach(([label, value]) => {
    const cell = document.createElement('div');
    cell.className = 'balance-ledger__stat';
    const l = document.createElement('span');
    l.className = 'balance-ledger__stat-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'balance-ledger__stat-value';
    v.textContent = value;
    cell.append(l, v);
    summary.appendChild(cell);
  });

  // §5 — the credit is shown, not spent, in this phase.
  const credit = qs('#ledger-credit');
  credit.hidden = !(rider.credit > 0);
  credit.textContent = rider.credit > 0
    ? t('riderBalancesFinance.creditNote', { amount: formatEgp(rider.credit) })
    : '';
}

// ── Waive fee (2026-10-14 spec §5) ───────────────────
function openWaiver(entry) {
  if (!selected) return;
  const rider = selected;
  waiveModal.open({
    title: t('riderBalancesFinance.waiveTitle', { name: rider.name }),
    description: t('riderBalancesFinance.waiveDescription'),
    confirmLabel: t('riderBalancesFinance.waiveConfirm'),
    fields: [
      {
        key: 'amount',
        type: 'readonly',
        label: t('riderBalancesFinance.waiveAmount'),
        value: formatEgp(Math.abs(entry.amount)),
        ltr: true,
      },
      {
        key: 'trip',
        type: 'readonly',
        label: t('riderBalancesFinance.waiveTrip'),
        value: entry.tripId ?? '—',
        ltr: true,
      },
      {
        key: 'reason',
        type: 'textarea',
        label: t('riderBalancesFinance.waiveReason'),
        hint: t('riderBalancesFinance.waiveReasonHint'),
        required: true,
        minLength: 10,
        maxLength: 500,
        emptyError: t('riderBalancesFinance.errReasonEmpty'),
        lengthError: t('riderBalancesFinance.errReasonLength'),
      },
    ],
    onConfirm: async (values) => {
      const result = await mockApi.requestFeeWaiver(rider.id, entry.id, values.reason);
      toastSentForApproval(result.request);
      await Promise.all([load(), loadLedger()]);
    },
  });
}

const ledgerGuard = createRequestGuard();

async function loadLedger() {
  if (!selected) return;
  const isCurrent = ledgerGuard();
  ledgerTable.setLoading();
  try {
    const result = await mockApi.getRiderLedger(ledgerQuery);
    if (!isCurrent()) return;
    renderLedgerSummary(result.rider);
    selected = { ...selected, ...result.rider };
    ledgerTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    ledgerTable.setError(error.message, loadLedger);
  }
}

// ── Summary cards ────────────────────────────────────
async function loadStats() {
  const all = await mockApi.listRiderBalances({ filter: 'all', page: 1, pageSize: 1000 });
  const owing = all.rows.filter((r) => r.outstanding > 0);
  qs('#card-owing').value = String(owing.length);
  qs('#card-outstanding').value = formatEgp(owing.reduce((sum, r) => sum + r.outstanding, 0));
}

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listRiderBalances(query);
    if (!isCurrent()) return;
    table.setData(result);
    loadStats();
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
