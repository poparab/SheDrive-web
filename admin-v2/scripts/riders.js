/**
 * riders.js — SheDrive admin rider list
 * #1661: 20 rows/page, newest first, columns Name / Phone / Account status /
 * Registration date / Total trips completed.
 *
 * The story's status filter is All / Active / Suspended. Pending review is also
 * offered because #1662 introduces it as a real third state that operations
 * needs to find — it is a superset of the story, not a contradiction of it.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatCount, formatDate, formatPhone } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { mountStatRow, fillStatRow } from './list-metrics.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#riders-filters');
const table = qs('#riders-table');

const query = {
  search: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sort: { key: 'registeredAt', dir: 'desc' },
};

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: t('riders.searchLabel'),
    placeholder: t('riders.searchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: t('riders.accountStatus'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      { value: 'active', label: t('status.active') },
      { value: 'pending_review', label: t('status.pending_review') },
      { value: 'suspended', label: t('status.suspended') },
    ],
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

table.pageSize = query.pageSize;
table.sort = query.sort;
table.rowHref = (row) => `rider-profile.html?id=${row.id}`;

table.columns = [
  { key: 'name', label: t('common.name'), sortable: true, render: (row) => row.name },
  {
    key: 'phone',
    label: t('common.phone'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => {
      const phone = document.createElement('span');
      phone.className = 'ad-ltr';
      phone.textContent = formatPhone(row.phone);
      return phone;
    },
  },
  {
    key: 'status',
    label: t('riders.accountStatus'),
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  {
    key: 'registeredAt',
    label: t('riders.colRegistered'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDate(row.registeredAt),
  },
  {
    key: 'tripsCompleted',
    label: t('riders.colTrips'),
    sortable: true,
    numeric: true,
    render: (row) => formatCount(row.tripsCompleted),
  },
];

table.emptyState = {
  icon: '☺',
  heading: t('riders.emptyHeading'),
  message: t('riders.emptyMessage'),
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
    const result = await mockApi.listRiders(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();

// ── Kit KPI row (#1661 list header) ───────────────────
const riderStats = mountStatRow(qs('#riders-stats'), [
  { key: 'all', label: t('riders.statTotal'), tone: 'primary', icon: 'user-star.svg' },
  { key: 'active', label: t('status.active'), tone: 'success', icon: 'checked-2.svg' },
  { key: 'pending_review', label: t('status.pending_review'), tone: 'warning', icon: 'prossesing.svg' },
  { key: 'suspended', label: t('status.suspended'), tone: 'danger', icon: 'stop-hand.svg' },
]);

fillStatRow(riderStats, (key) => mockApi.listRiders({ status: key, pageSize: 1 }));
