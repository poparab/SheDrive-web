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
import { t } from './admin-i18n.js';
import { mountStatRow, fillStatRow } from './list-metrics.js';

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
    label: t('safety.statusLabel'),
    value: 'open',
    options: [
      { value: 'open', label: t('status.open') },
      { value: 'resolved', label: t('status.resolved') },
      { value: 'all', label: t('common.all') },
    ],
  },
  {
    type: 'daterange',
    key: 'date',
    label: t('safety.timeLabel'),
    fromKey: 'from',
    toKey: 'to',
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: () => {
      if (!lastRows.length) return;
      downloadCsv(
        `${t('safety.csvFile')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('safety.csvReportId'),
          t('safety.colReportedRider'),
          t('safety.colReportedRiderPhone'),
          t('safety.colReportingDriver'),
          t('safety.colTripId'),
          t('safety.csvTime'),
          t('safety.statusLabel'),
          t('safety.colRiderStatus'),
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
  {
    key: 'riderName',
    label: t('safety.colReportedRider'),
    sortable: true,
    render: (row) => row.riderName,
  },
  {
    key: 'riderPhone',
    label: t('safety.colReportedRiderPhone'),
    className: 'ad-table__nowrap',
    render: (row) => {
      const phone = document.createElement('span');
      phone.className = 'ad-ltr';
      phone.textContent = formatPhone(row.riderPhone);
      return phone;
    },
  },
  { key: 'driverName', label: t('safety.colReportingDriver'), render: (row) => row.driverName },
  {
    key: 'tripId',
    label: t('safety.colTripId'),
    className: 'ad-table__id',
    render: (row) => {
      const id = document.createElement('span');
      id.className = 'ad-ltr';
      id.textContent = row.tripId;
      return id;
    },
  },
  {
    key: 'reportedAt',
    label: t('safety.timeLabel'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDateTime(row.reportedAt),
  },
  {
    key: 'status',
    label: t('safety.statusLabel'),
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
    label: t('safety.colRiderStatus'),
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.riderStatusAtReport;
      return pill;
    },
  },
];

table.emptyState = {
  icon: '✓',
  heading: t('safety.emptyHeading'),
  message: t('safety.emptyMessage'),
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
      query.status === 'open'
        ? t('safety.badgeOpen', { count: result.total })
        : t('safety.badgeShown', { count: result.total });
  } catch (error) {
    if (!isCurrent()) return;
    lastRows = [];
    table.setError(error.message, load);
    openCount.textContent = t('common.notAvailable');
  }
}

load();

// ── Kit KPI row (#1673 queue header) ──────────────────
const safetyStats = mountStatRow(qs('#safety-stats'), [
  { key: 'all', label: t('safety.statTotal'), tone: 'primary', icon: 'shield.svg' },
  { key: 'open', label: t('status.open'), tone: 'warning', icon: 'prossesing.svg' },
  { key: 'resolved', label: t('status.resolved'), tone: 'success', icon: 'checked-2.svg' },
]);

fillStatRow(safetyStats, (key) => mockApi.listSafetyReports({ status: key, pageSize: 1 }));
