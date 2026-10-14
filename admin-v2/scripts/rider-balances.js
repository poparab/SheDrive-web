/**
 * rider-balances.js — SheDrive admin rider fee balances list (FIN-11)
 *
 * Kit v22-09 `rider-balances.html`: two KPI tiles, the filter row and a grid
 * whose Actions column opens her ledger on its own page,
 * rider-balance-details.html?id=<riderId>. Waiving a fee (2026-10-14 spec §5)
 * happens there, one fee at a time.
 *
 * A late cancellation posts a debit, recovered as a cash surcharge on her
 * next trip. A waived fee she had already paid leaves a credit — shown in its
 * own column and filter, not spent, this phase.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp, formatPhone, toDateInputValue, downloadCsv } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#rider-balance-filters');
const table = qs('#rider-balance-table');

const query = { search: '', filter: 'owing', page: 1, pageSize: 20, sort: { key: 'outstanding', dir: 'desc' } };

const ledgerHref = (id) => `rider-balance-details.html?id=${encodeURIComponent(id)}`;

function para(text, className = '') {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

// ── Filters ──────────────────────────────────────────
filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: t('common.name'),
    placeholder: t('kitBalances.riderSearchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'filter',
    label: t('riderBalances.filterBalance'),
    value: 'owing',
    options: [
      { value: 'owing', label: t('kitBalances.filterRiderDue') },
      { value: 'credit', label: t('riderBalancesFinance.filterCredit') },
      { value: 'all', label: t('kitBalances.filterAll') },
    ],
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'gradient',
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
  load();
});

// ── Balances table ───────────────────────────────────
table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  {
    key: 'name',
    label: t('common.name'),
    sortable: true,
    className: 'rider-name-cell',
    render: (row) => para(row.name),
  },
  {
    // Shown in full — phone numbers are never masked.
    key: 'phone',
    label: t('kitBalances.colPhone'),
    ltr: true,
    render: (row) => para(formatPhone(row.phone)),
  },
  {
    key: 'outstanding',
    label: t('riderBalances.colOutstanding'),
    sortable: true,
    numeric: true,
    render: (row) =>
      row.outstanding > 0 ? para(formatEgp(row.outstanding), 'text-bold danger-color') : para(t('common.notAvailable')),
  },
  {
    // §5 — a waived fee she had already paid. Blank when 0.
    key: 'credit',
    label: t('riderBalancesFinance.colCredit'),
    sortable: true,
    numeric: true,
    render: (row) => (row.credit > 0 ? para(formatEgp(row.credit), 'text-bold success-color') : null),
  },
  {
    key: 'lastFeeAt',
    label: t('kitBalances.colLastFeeDate'),
    sortable: true,
    render: (row) => para(row.lastFeeAt ? formatDate(row.lastFeeAt) : t('common.notAvailable')),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    render: (row) => {
      const link = document.createElement('a');
      link.className = 'btn btn-primary-outline rider-ledger-link';
      link.href = ledgerHref(row.id);
      link.textContent = t('kitBalances.ledgerButton');
      return link;
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
    loadStats().catch(() => {});
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
