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
    label: 'Name or phone',
    placeholder: 'e.g. Salma or 1005',
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: 'Account status',
    value: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'pending_review', label: 'Pending review' },
      { value: 'suspended', label: 'Suspended' },
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
    label: 'Account status',
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  {
    key: 'registeredAt',
    label: 'Registration date',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDate(row.registeredAt),
  },
  {
    key: 'tripsCompleted',
    label: 'Total trips completed',
    sortable: true,
    numeric: true,
    render: (row) => formatCount(row.tripsCompleted),
  },
];

table.emptyState = {
  icon: '☺',
  heading: 'No riders match these filters',
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
    const result = await mockApi.listRiders(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
