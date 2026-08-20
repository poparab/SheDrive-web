/**
 * drivers.js — SheDrive admin driver list
 * #1665: 20 rows/page, newest first, columns Name / Phone / Status /
 * Onboarding submission date / Total trips, with a status dropdown covering
 * All, Pending, Approved, Rejected and Suspended.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { downloadCsv, formatCount, formatDate, formatPhone, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { mountStatRow, fillStatRow } from './list-metrics.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#drivers-filters');
const table = qs('#drivers-table');

const query = {
  search: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sort: { key: 'submittedAt', dir: 'desc' },
};

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: t('drivers.searchLabel'),
    placeholder: t('drivers.searchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      { value: 'pending', label: t('status.pending') },
      { value: 'approved', label: t('status.approved') },
      { value: 'rejected', label: t('status.rejected') },
      { value: 'suspended', label: t('status.suspended') },
      { value: 'pending_suspension', label: t('status.pending_suspension') },
    ],
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: () => {
      if (!lastRows.length) return;
      downloadCsv(
        `${t('drivers.csvFile')}-${toDateInputValue(Date.now())}.csv`,
        [t('common.name'), t('common.phone'), t('common.status'), t('drivers.colSubmitted'),
         t('drivers.colTrips'), t('drivers.csvRating'), t('drivers.csvCash')],
        lastRows.map((d) => [
          d.name,
          formatPhone(d.phone),
          statusLabel(d.status),
          formatDate(d.submittedAt),
          d.tripsCompleted,
          d.avgRating ?? '',
          d.cashBalance.toFixed(2),
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

table.pageSize = query.pageSize;
table.sort = query.sort;
table.rowHref = (row) => `driver-profile.html?id=${row.id}`;

table.columns = [
  { key: 'name', label: t('common.name'), sortable: true, render: (row) => row.name },
  {
    key: 'phone',
    label: t('common.phone'),
    sortable: true,
    className: 'ad-table__nowrap',
    // Latin data: isolated from the bidi algorithm in Arabic.
    ltr: true,
    render: (row) => {
      const phone = document.createElement('span');
      phone.className = 'ad-ltr';
      phone.textContent = formatPhone(row.phone);
      return phone;
    },
  },
  {
    key: 'status',
    label: t('common.status'),
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  {
    key: 'submittedAt',
    label: t('drivers.colSubmitted'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDate(row.submittedAt),
  },
  {
    key: 'tripsCompleted',
    label: t('drivers.colTrips'),
    sortable: true,
    numeric: true,
    render: (row) => formatCount(row.tripsCompleted),
  },
];

table.emptyState = {
  icon: '⛟',
  heading: t('drivers.emptyHeading'),
  message: t('drivers.emptyMessage'),
};

table.addEventListener('sortchange', (event) => {
  query.sort = event.detail;
  table.sort = query.sort;
  load();
});

table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

const guard = createRequestGuard();
let lastRows = [];

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listDrivers(query);
    if (!isCurrent()) return;
    lastRows = result.rows;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    lastRows = [];
    table.setError(error.message, load);
  }
}

load();

// ── Kit KPI row (#1665 list header) ───────────────────
// Each tile is the `total` of the same list query the grid runs, so the numbers
// can never disagree with the grid. "Online now" has no list filter, so it comes
// from the dashboard metrics the ops map already uses.
const driverStats = mountStatRow(qs('#drivers-stats'), [
  { key: 'all', label: t('drivers.statTotal'), tone: 'primary', icon: 'steering-wheel.svg' },
  { key: 'online', label: t('drivers.statOnline'), tone: 'blue', icon: 'signal-waves.svg' },
  { key: 'approved', label: t('status.approved'), tone: 'success', icon: 'checked-2.svg' },
  { key: 'suspended', label: t('status.suspended'), tone: 'danger', icon: 'stop-hand.svg' },
]);

fillStatRow(driverStats, async (key) => {
  if (key === 'online') {
    const metrics = await mockApi.getDashboardMetrics();
    return { total: metrics.onlineDrivers };
  }
  return mockApi.listDrivers({ status: key, pageSize: 1 });
});
