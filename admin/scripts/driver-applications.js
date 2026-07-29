/**
 * driver-applications.js — SheDrive admin pending applications queue
 * #1657: 20 rows/page, default sort submission date **oldest first**, search on
 * driver name or phone, submission-date range, row action opens #1658.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatElapsed, formatPhone } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#queue-filters');
const table = qs('#queue-table');
const countBadge = qs('#queue-count');

const query = {
  search: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
  sort: { key: 'submittedAt', dir: 'asc' },
};

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: 'Driver name or phone',
    placeholder: 'e.g. Nour or 1002',
    grow: true,
  },
  { type: 'daterange', key: 'date', label: 'Submission date', fromKey: 'from', toKey: 'to' },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

table.pageSize = query.pageSize;
table.sort = query.sort;
table.rowHref = (row) => `driver-application.html?id=${row.id}`;

table.columns = [
  {
    key: 'name',
    label: 'Driver name',
    sortable: true,
    render: (row) => row.name,
  },
  {
    key: 'phone',
    label: 'Phone number',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatPhone(row.phone),
  },
  {
    key: 'submittedAt',
    label: 'Submission date',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => {
      const wrap = document.createElement('span');
      wrap.className = 'list__name';
      const date = document.createElement('span');
      date.textContent = formatDate(row.submittedAt);
      const waiting = document.createElement('span');
      waiting.className = 'list__name-secondary';
      // formatElapsed ends with "ago"; "waiting 3 days" reads better than
      // "waiting 3 days ago".
      waiting.textContent = `waiting ${formatElapsed(row.submittedAt).replace(/ ago$/, '')}`;
      wrap.append(date, waiting);
      return wrap;
    },
  },
  {
    key: 'view',
    label: 'View application',
    render: () => {
      const link = document.createElement('span');
      link.className = 'list__link';
      link.textContent = 'Open →';
      return link;
    },
  },
];

table.emptyState = {
  icon: '✓',
  heading: 'No pending applications',
  message: 'Every submitted driver application has been reviewed.',
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
    const result = await mockApi.listApplications(query);
    if (!isCurrent()) return;
    table.setData(result);
    countBadge.textContent = `${result.total} awaiting review`;
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
    countBadge.textContent = '—';
  }
}

load();
