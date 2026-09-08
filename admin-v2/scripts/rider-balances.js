/**
 * rider-balances.js — SheDrive admin rider fee balances (FIN-11)
 *
 * The rider side of the financial core ledger model (spec §2.2): a late
 * cancellation posts a debit; it is recovered as a cash surcharge on her next
 * trip, or written off here with a reason. Same shape as balances.js (the
 * driver side): a filterable list, a ledger drawer, and two actions — waive and
 * post an adjustment — each posting an immutable entry, never editing one.
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
const filters = qs('#rider-balance-filters');
const table = qs('#rider-balance-table');
const ledgerPanel = qs('#ledger-panel');
const ledgerTable = qs('#ledger-table');
const modal = qs('#rider-balance-modal');

const query = { search: '', filter: 'owing', page: 1, pageSize: 20, sort: { key: 'outstanding', dir: 'desc' } };
const ledgerQuery = { riderId: '', page: 1, pageSize: 20 };

let riderFeePolicy = {};
let selected = null;

const ENTRY_LABEL_KEYS = {
  cancellation_fee: 'riderBalances.entryCancellationFee',
  fee_collected: 'riderBalances.entryFeeCollected',
  fee_waived: 'riderBalances.entryFeeWaived',
  adjustment: 'riderBalances.entryAdjustment',
};

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
          t('riderBalances.colLastFee'),
          t('riderBalances.colRecovery'),
        ],
        all.rows.map((r) => [
          r.name,
          r.phone,
          r.outstanding.toFixed(2),
          r.lastFeeAt ? formatDate(r.lastFeeAt) : '',
          r.fullRecovery ? t('riderBalances.csvFullYes') : t('riderBalances.csvFullNo'),
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
    key: 'lastFeeAt',
    label: t('riderBalances.colLastFee'),
    sortable: true,
    render: (row) => (row.lastFeeAt ? formatDate(row.lastFeeAt) : null),
  },
  {
    key: 'fullRecovery',
    label: t('riderBalances.colRecovery'),
    render: (row) => {
      const pill = document.createElement('span');
      pill.className = `badge ${row.fullRecovery ? 'badge--warning' : 'badge--neutral'}`;
      pill.textContent = row.fullRecovery ? t('riderBalances.fullRecovery') : t('riderBalances.singleFee');
      return pill;
    },
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
  ledgerPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await loadLedger();
}

function renderLedgerSummary(rider) {
  const summary = qs('#ledger-summary');
  summary.textContent = '';
  const pairs = [
    [t('riderBalances.statOutstanding'), formatEgp(rider.outstanding)],
    [t('riderBalances.statRecovery'), rider.fullRecovery ? t('riderBalances.fullRecovery') : t('riderBalances.singleFee')],
  ];
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

  // Waiving is only meaningful when there is something outstanding.
  qs('#btn-waive').disabled = rider.outstanding <= 0;
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

// ── Waive fee ─────────────────────────────────────────
qs('#btn-waive').addEventListener('click', () => {
  if (!selected) return;
  modal.open({
    title: t('riderBalances.waiveTitle', { name: selected.name }),
    description: t('riderBalances.waiveDescription', { amount: formatEgp(selected.outstanding) }),
    confirmLabel: t('riderBalances.waiveFee'),
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'textarea',
        label: t('riderBalances.waiveReason'),
        required: true,
        minLength: 10,
        maxLength: 500,
        emptyError: t('riderBalances.errReasonEmpty'),
        lengthError: t('riderBalances.errReasonLength'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.waiveRiderFee(selected.id, values);
      shell.showToast(t('riderBalances.waiveDone'), 'success');
      await Promise.all([load(), loadLedger()]);
    },
  });
});

// ── Post adjustment ──────────────────────────────────
qs('#btn-adjust').addEventListener('click', () => {
  if (!selected) return;
  modal.open({
    title: t('riderBalances.adjustTitle', { name: selected.name }),
    description: t('riderBalances.adjustDescription'),
    confirmLabel: t('riderBalances.postAdjustment'),
    fields: [
      {
        key: 'amount',
        type: 'number',
        label: t('riderBalances.adjustAmount'),
        required: true,
        min: -100000,
        max: 100000,
        step: 0.01,
        hint: t('riderBalances.adjustHint'),
        emptyError: t('riderBalances.errAdjustEmpty'),
        invalidError: t('riderBalances.errAdjustInvalid'),
        rangeError: t('riderBalances.errAdjustRange'),
        validate: (value) => (Number(value) === 0 ? t('riderBalances.errAdjustZero') : null),
      },
      {
        key: 'reason',
        type: 'textarea',
        label: t('riderBalances.adjustReason'),
        required: true,
        minLength: 10,
        maxLength: 500,
        emptyError: t('riderBalances.errReasonEmpty'),
        lengthError: t('riderBalances.errReasonLength'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.postRiderAdjustment(selected.id, values);
      shell.showToast(t('riderBalances.adjustDone'), 'success');
      await Promise.all([load(), loadLedger()]);
    },
  });
});

// ── Summary cards ────────────────────────────────────
async function loadStats() {
  const all = await mockApi.listRiderBalances({ filter: 'all', page: 1, pageSize: 1000 });
  const owing = all.rows.filter((r) => r.outstanding > 0);
  qs('#card-owing').value = String(owing.length);
  qs('#card-outstanding').value = formatEgp(owing.reduce((sum, r) => sum + r.outstanding, 0));
  qs('#card-blocked').value = String(all.rows.filter((r) => r.fullRecovery).length);
  qs('#card-blocked').meta = riderFeePolicy.recoveryThreshold
    ? t('riderBalances.thresholdMeta', { limit: formatEgp(riderFeePolicy.recoveryThreshold) })
    : t('riderBalances.thresholdDisabled');
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

// The policy fetch is a nice-to-have (the limit shown on the stat card); it
// must never block the grid itself from loading or reporting ?state=error.
try {
  const options = await mockApi.getFinanceOptions();
  riderFeePolicy = options?.riderFeePolicy ?? {};
} catch {
  riderFeePolicy = {};
}
load();
