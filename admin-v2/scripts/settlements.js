/**
 * settlements.js — SheDrive admin settlement day book (FIN-12)
 *
 * A read-only report over the driver-balance ledger's `settlement` entries —
 * every cash handover recorded from balances.html, in one place, totalled by
 * channel and by admin so Finance can reconcile against the bank (spec §5).
 * Recording a settlement itself still happens on balances.html; this screen
 * only lists and totals what has already been posted.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatEgp, formatCount, toDateInputValue, downloadCsv } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { SETTLEMENT_METHODS, ADMINS } from './seed.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#settlements-filters');
const table = qs('#settlements-table');
const byChannelSection = qs('#by-channel');
const byAdminSection = qs('#by-admin');
const statsHost = qs('#settlements-stats');

const query = {
  from: '',
  to: '',
  method: 'all',
  adminId: 'all',
  page: 1,
  pageSize: 20,
  sort: { key: 'at', dir: 'desc' },
};

let lastTotals = { grandTotal: 0, count: 0, byChannel: [], byAdmin: [] };

// ── Stat tiles ───────────────────────────────────────
function mountStats() {
  statsHost.textContent = '';
  statsHost.classList.add('ad-stats');
  const specs = [
    { key: 'count', label: t('settlements.statCount') },
    { key: 'total', label: t('settlements.statTotal') },
    { key: 'channels', label: t('settlements.statChannels') },
  ];
  const cards = new Map();
  specs.forEach((spec) => {
    const card = document.createElement('ad-stat-card');
    card.setAttribute('label', spec.label);
    card.setAttribute('value', t('common.notAvailable'));
    statsHost.appendChild(card);
    cards.set(spec.key, card);
  });
  return cards;
}

const statCards = mountStats();

function renderStats(totals) {
  statCards.get('count').setAttribute('value', formatCount(totals.count));
  statCards.get('total').setAttribute('value', formatEgp(totals.grandTotal));
  statCards.get('channels').setAttribute('value', formatCount(totals.byChannel.length));
}

function renderBreakdown(totals) {
  byChannelSection.items = totals.byChannel.length
    ? totals.byChannel.map((row) => ({
        label: row.key || t('common.notAvailable'),
        value: `${formatEgp(row.amount)} — ${t('settlements.entriesSuffix', { count: row.count })}`,
        ltr: true,
      }))
    : [{ label: t('settlements.byChannel'), value: t('common.notAvailable'), muted: true }];

  byAdminSection.items = totals.byAdmin.length
    ? totals.byAdmin.map((row) => ({
        label: row.key || t('common.notAvailable'),
        value: `${formatEgp(row.amount)} — ${t('settlements.entriesSuffix', { count: row.count })}`,
        ltr: true,
      }))
    : [{ label: t('settlements.byAdmin'), value: t('common.notAvailable'), muted: true }];
}

// ── Filters ──────────────────────────────────────────
const adminOptions = [
  { value: 'all', label: t('common.all') },
  ...ADMINS.filter((a) => a.status === 'active').map((a) => ({ value: a.email, label: a.email })),
];

filters.fields = [
  { type: 'daterange', key: 'date', label: t('settlements.dateLabel'), fromKey: 'from', toKey: 'to' },
  {
    type: 'select',
    key: 'method',
    label: t('settlements.channelLabel'),
    value: 'all',
    options: [{ value: 'all', label: t('common.all') }, ...SETTLEMENT_METHODS.map((m) => ({ value: m, label: m }))],
  },
  {
    type: 'select',
    key: 'adminId',
    label: t('settlements.adminLabel'),
    value: 'all',
    options: adminOptions,
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: async () => {
      const all = await mockApi.listSettlements({ ...query, page: 1, pageSize: 1000 });
      downloadCsv(
        `${t('settlements.csvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('settlements.colDate'),
          t('settlements.colDriver'),
          t('settlements.colAmount'),
          t('settlements.colChannel'),
          t('settlements.colReceipt'),
          t('settlements.colAdmin'),
        ],
        all.rows.map((r) => [
          formatDate(r.at),
          r.driverName,
          r.amount.toFixed(2),
          r.method ?? '',
          r.ref ?? '',
          r.actor ?? '',
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

// ── Table ────────────────────────────────────────────
table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  { key: 'at', label: t('settlements.colDate'), sortable: true, render: (row) => formatDate(row.at) },
  { key: 'driverName', label: t('settlements.colDriver'), sortable: true, render: (row) => row.driverName },
  {
    key: 'amount',
    label: t('settlements.colAmount'),
    sortable: true,
    numeric: true,
    render: (row) => formatEgp(row.amount),
  },
  { key: 'method', label: t('settlements.colChannel'), sortable: true, render: (row) => row.method ?? null },
  {
    key: 'ref',
    label: t('settlements.colReceipt'),
    render: (row) => {
      if (!row.ref) return null;
      const span = document.createElement('span');
      span.className = 'ad-ltr';
      span.textContent = row.ref;
      return span;
    },
  },
  {
    key: 'actor',
    label: t('settlements.colAdmin'),
    sortable: true,
    render: (row) => {
      if (!row.actor) return null;
      const span = document.createElement('span');
      span.className = 'ad-ltr';
      span.textContent = row.actor;
      return span;
    },
  },
];
table.emptyState = {
  icon: '☐',
  heading: t('settlements.emptyHeading'),
  message: t('settlements.emptyMessage'),
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

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listSettlements(query);
    if (!isCurrent()) return;
    table.setData(result);
    lastTotals = result.totals ?? lastTotals;
    renderStats(lastTotals);
    renderBreakdown(lastTotals);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
    renderStats({ grandTotal: 0, count: 0, byChannel: [], byAdmin: [] });
  }
}

load();
