/**
 * balances.js — SheDrive admin driver balances list (#1813)
 *
 * Kit v22-09 `driver-balances.html`: four KPI tiles, the filter row and a grid
 * whose Actions column opens her ledger on its own page,
 * driver-balance-details.html?id=<driverId>. Recording a settlement or a
 * payout, the payout position and the ledger itself all live there now.
 *
 * The balance is never edited. A settlement or a payout is a maker-checker
 * request (2026-10-14 spec §1); a driver with one waiting carries an
 * "Awaiting approval" chip here.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatDateTime, formatEgp, toDateInputValue, downloadCsv } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#balance-filters');
const table = qs('#balance-table');

const query = { search: '', filter: 'owing', page: 1, pageSize: 20, sort: { key: 'balance', dir: 'asc' } };

let options = { settlementMethods: [], payoutMethods: [], policy: {} };

/**
 * One signed balance in EGP, rendered with its sign: negative means she owes
 * the platform, positive means the platform owes her.
 */
function signedEgp(balance) {
  if (!balance) return formatEgp(0);
  return balance > 0 ? `+${formatEgp(balance)}` : `−${formatEgp(Math.abs(balance))}`;
}

const ledgerHref = (id) => `driver-balance-details.html?id=${encodeURIComponent(id)}`;

// ── Filters ──────────────────────────────────────────
filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: t('common.name'),
    placeholder: t('kitBalances.driverSearchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'filter',
    label: t('balances.filterBalance'),
    value: 'owing',
    options: [
      { value: 'owing', label: t('kitBalances.filterDebtors') },
      { value: 'owed', label: t('kitBalances.filterPayables') },
      { value: 'settled', label: t('kitBalances.filterSettled') },
      { value: 'all', label: t('kitBalances.filterAll') },
    ],
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'gradient',
    onClick: async () => {
      const all = await mockApi.listDriverBalances({ ...query, page: 1, pageSize: 1000 });
      downloadCsv(
        `${t('balances.csvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('common.name'),
          t('balances.colBalance'),
          t('balances.colLastSettlement'),
          t('balances.colGoOnline'),
        ],
        all.rows.map((r) => [
          r.name,
          r.balance.toFixed(2),
          r.lastSettlementAt ? formatDate(r.lastSettlementAt) : '',
          r.goOnlineBlocked ? t('balances.csvBlockedYes') : t('balances.csvBlockedNo'),
        ]),
      );
    },
  },
  {
    // The settlement day-book screen was cut (spec §10); this is the one part
    // of it worth keeping — the export Finance reconciles against the bank.
    label: t('balances.exportSettlementsCsv'),
    variant: 'gradient',
    onClick: async () => {
      const rows = await mockApi.listSettlementEntries();
      downloadCsv(
        `${t('balances.settlementsCsvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('common.name'),
          t('balances.colAmount'),
          t('balances.settleMethod'),
          t('balances.settlementsColReference'),
          t('balances.settlementsColReceipt'),
          t('balances.settlementsColAdmin'),
          t('balances.settlementsColTime'),
        ],
        rows.map((r) => [
          r.driverName,
          r.amount.toFixed(2),
          r.method ?? '',
          r.note ?? '',
          r.ref ?? '',
          r.actor ?? '',
          formatDateTime(r.at),
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
function para(text, className = '') {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function lamp(tone, text) {
  const wrap = document.createElement('div');
  wrap.className = `status-${tone}-lamp`;
  const dot = document.createElement('span');
  dot.className = 'lamp';
  wrap.append(dot, text);
  return wrap;
}

table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  {
    key: 'name',
    label: t('common.name'),
    sortable: true,
    className: 'balance-name-cell',
    render: (row) => {
      const wrap = document.createElement('div');
      wrap.className = 'balance-name';
      wrap.appendChild(para(row.name));
      // A settlement or payout waiting on a second admin (§1).
      if (row.pendingSettlement || row.pendingPayout) {
        const chip = document.createElement('span');
        chip.className = 'status-warning-solid balance-chip';
        chip.textContent = t('balancesFinance.chipAwaitingApproval');
        wrap.appendChild(chip);
      }
      return wrap;
    },
  },
  {
    // One signed balance, never two columns (#1813).
    key: 'balance',
    label: t('balances.colBalance'),
    sortable: true,
    numeric: true,
    render: (row) => {
      const tone = row.balance > 0 ? 'success-color' : row.balance < 0 ? 'danger-color' : '';
      return para(signedEgp(row.balance), `text-bold ${tone}`.trim());
    },
  },
  {
    key: 'lastSettlementAt',
    label: t('balances.colLastSettlement'),
    sortable: true,
    render: (row) => para(row.lastSettlementAt ? formatDate(row.lastSettlementAt) : t('common.notAvailable')),
  },
  {
    key: 'goOnlineBlocked',
    label: t('balances.colGoOnline'),
    render: (row) =>
      row.goOnlineBlocked
        ? lamp('danger', t('kitBalances.goBlocked'))
        : lamp('active', t('kitBalances.goActive')),
  },
  {
    key: 'actions',
    label: t('common.actions'),
    render: (row) => {
      const link = document.createElement('a');
      link.className = 'btn btn-primary-outline balance-ledger-link';
      link.href = ledgerHref(row.id);
      link.textContent = t('kitBalances.ledgerButton');
      return link;
    },
  },
];
table.emptyState = {
  icon: '⇌',
  heading: t('balances.emptyHeading'),
  message: t('balances.emptyMessage'),
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
  const all = await mockApi.listDriverBalances({ filter: 'all', page: 1, pageSize: 1000 });
  // Fleet aggregates over the one signed balance, not a second per-driver number.
  const owing = all.rows.filter((r) => r.balance < 0);
  qs('#card-owing').value = String(owing.length);
  qs('#card-outstanding').value = formatEgp(owing.reduce((sum, r) => sum + Math.abs(r.balance), 0));
  qs('#card-owed').value = String(all.rows.filter((r) => r.balance > 0).length);
  qs('#card-blocked').value = String(all.rows.filter((r) => r.goOnlineBlocked).length);
  qs('#card-blocked').meta = options.policy?.outstandingLimit
    ? t('balances.limitMeta', { limit: formatEgp(options.policy.outstandingLimit) })
    : t('balances.limitDisabled');
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
    loadStats().catch(() => {});
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
mockApi
  .getFinanceOptions()
  .then((result) => {
    options = result ?? options;
    loadStats().catch(() => {});
  })
  .catch(() => {});
