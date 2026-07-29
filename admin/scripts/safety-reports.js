/**
 * safety-reports.js — SheDrive admin gender-mismatch report queue
 * #1810: 20 rows/page, default sort report time **oldest first**, status filter
 * defaulting to Open, date range, CSV export of the current view.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { downloadCsv, formatDateTime, formatPhone, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#reports-filters');
const table = qs('#reports-table');
const openCount = qs('#open-count');

const query = {
  status: 'open',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
  sort: { key: 'reportedAt', dir: 'asc' },
};

let lastRows = [];

filters.fields = [
  {
    type: 'select',
    key: 'status',
    label: 'Report status',
    value: 'open',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'all', label: 'All' },
    ],
  },
  { type: 'daterange', key: 'date', label: 'Report time', fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: 'Export CSV',
    variant: 'ghost',
    onClick: () => {
      if (!lastRows.length) return;
      downloadCsv(
        `shedrive-gender-mismatch-reports-${toDateInputValue(Date.now())}.csv`,
        [
          'Report id',
          'Reported rider',
          'Reported rider phone',
          'Reporting driver',
          'Trip id',
          'Report time (UTC+2)',
          'Report status',
          'Rider account status',
        ],
        lastRows.map((row) => [
          row.id,
          row.riderName,
          formatPhone(row.riderPhone),
          row.driverName,
          row.tripId,
          formatDateTime(row.reportedAt),
          statusLabel(row.status),
          statusLabel(row.riderStatusAtReport),
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
table.rowHref = (row) => `safety-report.html?id=${row.id}`;

table.columns = [
  { key: 'riderName', label: 'Reported rider', sortable: true, render: (row) => row.riderName },
  {
    key: 'riderPhone',
    label: 'Reported rider phone',
    className: 'ad-table__nowrap',
    render: (row) => formatPhone(row.riderPhone),
  },
  { key: 'driverName', label: 'Reporting driver', render: (row) => row.driverName },
  {
    key: 'tripId',
    label: 'Trip ID',
    className: 'ad-table__id',
    render: (row) => row.tripId,
  },
  {
    key: 'reportedAt',
    label: 'Report time',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDateTime(row.reportedAt),
  },
  {
    key: 'status',
    label: 'Report status',
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      // A resolved report shows how it was resolved, not just "resolved".
      pill.status = row.status === 'resolved' ? `resolved_${row.resolution}` : row.status;
      return pill;
    },
  },
  {
    key: 'riderStatusAtReport',
    label: 'Rider account status',
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.riderStatusAtReport;
      return pill;
    },
  },
];

table.emptyState = {
  icon: '✓',
  heading: 'No reports need triage',
  message: 'There are no gender-mismatch reports matching these filters.',
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

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listSafetyReports(query);
    if (!isCurrent()) return;
    lastRows = result.rows;
    table.setData(result);
    openCount.textContent =
      query.status === 'open' ? `${result.total} open` : `${result.total} shown`;
  } catch (error) {
    if (!isCurrent()) return;
    lastRows = [];
    table.setError(error.message, load);
    openCount.textContent = '—';
  }
}

load();
