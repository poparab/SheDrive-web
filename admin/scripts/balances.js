/**
 * balances.js — SheDrive admin driver balances & settlement (#1813)
 *
 * The balance is never edited. Recording a settlement or posting an adjustment
 * appends an immutable entry to the driver's ledger (#TBD-A) and the balance is
 * recomputed from it — which is also what unblocks her go-online (#TBD-F).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#balance-filters');
const table = qs('#balance-table');
const ledgerPanel = qs('#ledger-panel');
const ledgerTable = qs('#ledger-table');
const modal = qs('#balance-modal');

const query = { search: '', filter: 'owing', page: 1, pageSize: 20, sort: { key: 'outstanding', dir: 'desc' } };
const ledgerQuery = { driverId: '', page: 1, pageSize: 20 };

let options = { settlementMethods: [], payoutMethods: [], policy: {} };
let selected = null;

const ENTRY_LABELS = {
  trip_commission: 'Trip commission',
  trip_earnings: 'Trip earnings',
  driver_cancellation_fee: 'Driver cancellation fee',
  rider_cancellation_fee_share: 'Rider cancellation fee share',
  settlement: 'Settlement received',
  withdrawal: 'Withdrawal paid',
  adjustment: 'Adjustment',
};

// ── Filters ──────────────────────────────────────────
filters.fields = [
  { type: 'search', key: 'search', label: 'Driver', placeholder: 'Search by name or phone' },
  {
    type: 'select',
    key: 'filter',
    label: 'Balance',
    value: 'owing',
    options: [
      { value: 'owing', label: 'Owing the platform' },
      { value: 'owed', label: 'Owed by the platform' },
      { value: 'settled', label: 'Settled (zero)' },
      { value: 'all', label: 'All' },
    ],
  },
];

filters.actions = [
  {
    label: 'Export CSV',
    variant: 'ghost',
    onClick: async () => {
      const all = await mockApi.listDriverBalances({ ...query, page: 1, pageSize: 1000 });
      const { downloadCsv } = await import('./format.js');
      downloadCsv(
        `shedrive-driver-balances-${toDateInputValue(Date.now())}.csv`,
        ['Driver', 'Outstanding (EGP)', 'Available (EGP)', 'Last settlement', 'Go-online blocked'],
        all.rows.map((r) => [
          r.name,
          r.outstanding.toFixed(2),
          r.available.toFixed(2),
          r.lastSettlementAt ? formatDate(r.lastSettlementAt) : '',
          r.goOnlineBlocked ? 'Yes' : 'No',
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
  { key: 'name', label: 'Driver', sortable: true, render: (row) => row.name },
  {
    key: 'outstanding',
    label: 'Outstanding (EGP)',
    sortable: true,
    numeric: true,
    render: (row) => (row.outstanding > 0 ? formatEgp(row.outstanding) : null),
  },
  {
    key: 'available',
    label: 'Available (EGP)',
    sortable: true,
    numeric: true,
    render: (row) => (row.available > 0 ? formatEgp(row.available) : null),
  },
  {
    key: 'lastSettlementAt',
    label: 'Last settlement',
    sortable: true,
    render: (row) => (row.lastSettlementAt ? formatDate(row.lastSettlementAt) : null),
  },
  {
    key: 'goOnlineBlocked',
    label: 'Go-online',
    render: (row) => {
      const pill = document.createElement('span');
      pill.className = `badge ${row.goOnlineBlocked ? 'badge--danger' : 'badge--neutral'}`;
      pill.textContent = row.goOnlineBlocked ? 'Blocked' : 'Allowed';
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
      button.textContent = 'Ledger';
      button.addEventListener('click', () => openLedger(row));
      return button;
    },
  },
];
table.emptyState = {
  icon: '⇌',
  heading: 'No drivers match',
  message: 'No driver has a balance in this category right now.',
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
  { key: 'at', label: 'Date', render: (row) => formatDate(row.at) },
  { key: 'type', label: 'Type', render: (row) => ENTRY_LABELS[row.type] ?? row.type },
  {
    key: 'amount',
    label: 'Amount (EGP)',
    numeric: true,
    render: (row) => {
      const span = document.createElement('span');
      span.className = row.amount >= 0 ? 'ledger-amount ledger-amount--credit' : 'ledger-amount ledger-amount--debit';
      span.textContent = `${row.amount >= 0 ? '+' : '−'}${formatEgp(Math.abs(row.amount))}`;
      return span;
    },
  },
  { key: 'source', label: 'Source', render: (row) => row.tripId ?? row.ref ?? null },
  { key: 'note', label: 'Note', render: (row) => row.note ?? null },
];
ledgerTable.emptyState = {
  icon: '☐',
  heading: 'No transactions',
  message: 'This driver has no balance movements yet.',
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
  ledgerQuery.driverId = row.id;
  ledgerQuery.page = 1;
  ledgerPanel.hidden = false;
  qs('#ledger-title').textContent = `Ledger — ${row.name}`;
  ledgerPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await loadLedger();
}

function renderLedgerSummary(driver) {
  const summary = qs('#ledger-summary');
  summary.textContent = '';
  const pairs = [
    ['Balance', driver.balance >= 0 ? `+${formatEgp(driver.balance)}` : `−${formatEgp(Math.abs(driver.balance))}`],
    ['Outstanding', formatEgp(driver.outstanding)],
    ['Available', formatEgp(driver.available)],
    ['Reserved for withdrawal', formatEgp(driver.reserved)],
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

  // Settling is only meaningful when there is something outstanding (#1813 S7).
  qs('#btn-settle').disabled = driver.outstanding <= 0;
}

const ledgerGuard = createRequestGuard();

async function loadLedger() {
  if (!selected) return;
  const isCurrent = ledgerGuard();
  ledgerTable.setLoading();
  try {
    const result = await mockApi.getDriverLedger(ledgerQuery);
    if (!isCurrent()) return;
    renderLedgerSummary(result.driver);
    selected = { ...selected, ...result.driver };
    ledgerTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    ledgerTable.setError(error.message, loadLedger);
  }
}

// ── Record settlement (#1813 S3–S7) ──────────────────
qs('#btn-settle').addEventListener('click', () => {
  if (!selected) return;
  const max = selected.outstanding;
  modal.open({
    title: `Record settlement — ${selected.name}`,
    description: `She owes ${formatEgp(max)}. Recording a settlement credits her ledger and reduces what she owes.`,
    confirmLabel: 'Record settlement',
    fields: [
      {
        key: 'amount',
        type: 'number',
        label: 'Settlement amount (EGP)',
        required: true,
        min: 0.01,
        max,
        step: 0.01,
        emptyError: 'Enter a settlement amount',
        invalidError: 'Enter a valid amount',
        rangeError: `Amount must be greater than 0 and not exceed ${formatEgp(max)}`,
      },
      {
        key: 'date',
        type: 'date',
        label: 'Settlement date',
        required: true,
        value: toDateInputValue(Date.now()),
        max: toDateInputValue(Date.now()),
        emptyError: 'Enter the settlement date',
        invalidError: 'Invalid date format',
        rangeError: 'Date cannot be in the future',
      },
      {
        key: 'method',
        type: 'select',
        label: 'Settlement method',
        required: true,
        value: options.settlementMethods[0] ?? '',
        options: options.settlementMethods.map((m) => ({ value: m, label: m })),
        emptyError: 'Select a settlement method',
      },
      {
        key: 'note',
        type: 'textarea',
        label: 'Note',
        maxLength: 500,
        lengthError: 'Note must be 500 characters or fewer',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.recordSettlement(selected.id, values);
      shell.showToast('Settlement recorded.', 'success');
      await Promise.all([load(), loadLedger()]);
    },
  });
});

// ── Post adjustment (#1813 S8–S9) ────────────────────
qs('#btn-adjust').addEventListener('click', () => {
  if (!selected) return;
  modal.open({
    title: `Post adjustment — ${selected.name}`,
    description:
      'A correction is posted as a new entry, never by editing an existing one. A positive amount credits the driver; a negative amount debits her.',
    confirmLabel: 'Post adjustment',
    fields: [
      {
        key: 'amount',
        type: 'number',
        label: 'Adjustment amount (EGP)',
        required: true,
        min: -100000,
        max: 100000,
        step: 0.01,
        hint: 'Positive credits the driver, negative debits her.',
        emptyError: 'Enter an adjustment amount',
        invalidError: 'Enter a valid amount',
        rangeError: 'Amount must be between −100,000 and 100,000 and not zero',
        validate: (value) => (Number(value) === 0 ? 'Amount cannot be zero' : null),
      },
      {
        key: 'reason',
        type: 'textarea',
        label: 'Reason',
        required: true,
        minLength: 10,
        maxLength: 500,
        emptyError: 'Enter a reason for this adjustment',
        lengthError: 'Reason must be between 10 and 500 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.postAdjustment(selected.id, values);
      shell.showToast('Adjustment posted.', 'success');
      await Promise.all([load(), loadLedger()]);
    },
  });
});

// ── Summary cards ────────────────────────────────────
async function loadStats() {
  const all = await mockApi.listDriverBalances({ filter: 'all', page: 1, pageSize: 1000 });
  const owing = all.rows.filter((r) => r.outstanding > 0);
  qs('#card-owing').value = String(owing.length);
  qs('#card-outstanding').value = formatEgp(owing.reduce((sum, r) => sum + r.outstanding, 0));
  qs('#card-owed').value = String(all.rows.filter((r) => r.available > 0).length);
  qs('#card-blocked').value = String(all.rows.filter((r) => r.goOnlineBlocked).length);
  qs('#card-blocked').meta = options.policy.outstandingLimit
    ? `Limit ${formatEgp(options.policy.outstandingLimit)}`
    : 'Limit disabled';
}

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listDriverBalances(query);
    if (!isCurrent()) return;
    table.setData(result);
    loadStats();
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

options = await mockApi.getFinanceOptions();
load();
