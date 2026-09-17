/**
 * rider-balances.js — SheDrive admin rider fee balances (FIN-11)
 *
 * The rider side of the financial core ledger model (spec §2.2): a late
 * cancellation posts a debit, recovered in full as a cash surcharge on her
 * next trip. Nobody writes it off — there is no waive here or anywhere. This
 * screen is read-only: a filterable list, a ledger drawer, and a link into
 * the existing rider-suspension flow for persistent abuse, which is the only
 * human decision that touches a rider's account (spec §3, §7.3).
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
        ],
        all.rows.map((r) => [
          r.name,
          r.phone,
          r.outstanding.toFixed(2),
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
