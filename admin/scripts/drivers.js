/**
 * drivers.js — SheDrive admin driver list
 * #1665: 20 rows/page, newest first, columns Name / Phone / Status /
 * Onboarding submission date / Total trips, with a status dropdown covering
 * All, Pending, Approved, Rejected and Suspended.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatCount, formatDate, formatPhone } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

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
    label: 'Name or phone',
    placeholder: 'e.g. Mariam or 1102',
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    value: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'pending_suspension', label: 'Pending suspension' },
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
table.rowHref = (row) => `driver-profile.html?id=${row.id}`;

table.columns = [
  { key: 'name', label: 'Name', sortable: true, render: (row) => row.name },
  {
    key: 'phone',
    label: 'Phone number',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatPhone(row.phone),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  {
    key: 'submittedAt',
    label: 'Onboarding submission date',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDate(row.submittedAt),
  },
  {
    key: 'tripsCompleted',
    label: 'Total trips',
    sortable: true,
    numeric: true,
    render: (row) => formatCount(row.tripsCompleted),
  },
];

table.emptyState = {
  icon: '⛟',
  heading: 'No drivers match these filters',
  message: 'Clear the status filter or widen the search.',
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
    const result = await mockApi.listDrivers(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
