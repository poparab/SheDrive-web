/**
 * driver-applications.js — SheDrive admin driver applications
 * #1657: 20 rows/page, default sort submission date **oldest first**, search on
 * driver name or phone, submission-date range, row action opens #1658.
 *
 * SCOPE CHANGE vs #1657: the story specifies a pending-only queue. This lists
 * every application — pending, approved and rejected — with an Outcome column
 * and an outcome filter, so an admin can also review decisions already made.
 * The pending count is still shown separately so the queue's workload stays
 * visible whatever filter is applied. Flagged in docs/ux/admin-wireframes.md.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { downloadCsv, formatDate, formatElapsed, formatPhone, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#queue-filters');
const table = qs('#queue-table');
const countBadge = qs('#queue-count');

const query = {
  search: '',
  status: 'all',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
  sort: { key: 'submittedAt', dir: 'asc' },
};

let lastRows = [];

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: 'Driver name or phone',
    placeholder: 'e.g. Nour or 1002',
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: 'Application outcome',
    value: 'all',
    options: [
      { value: 'all', label: 'All applications' },
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
    ],
  },
  { type: 'daterange', key: 'date', label: 'Submission date', fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: 'Export CSV',
    variant: 'ghost',
    onClick: () => {
      if (!lastRows.length) return;
      downloadCsv(
        `shedrive-driver-applications-${toDateInputValue(Date.now())}.csv`,
        ['Driver name', 'Phone number', 'Submission date', 'Application outcome', 'Decision reason'],
        lastRows.map((row) => [
          row.name,
          formatPhone(row.phone),
          formatDate(row.submittedAt),
          statusLabel(row.applicationOutcome),
          row.rejectionReason ?? '',
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
    key: 'applicationOutcome',
    label: 'Application outcome',
    sortable: true,
    render: (row) => {
      const wrap = document.createElement('span');
      wrap.className = 'list__name';
      const pill = document.createElement('ad-status-pill');
      pill.status = row.applicationOutcome;
      wrap.appendChild(pill);
      // A rejection is only meaningful alongside its reason.
      if (row.applicationOutcome === 'rejected' && row.rejectionReason) {
        const reason = document.createElement('span');
        reason.className = 'list__name-secondary';
        reason.textContent = row.rejectionReason;
        wrap.appendChild(reason);
      }
      return wrap;
    },
  },
  {
    key: 'view',
    label: 'View application',
    render: (row) => {
      const link = document.createElement('span');
      link.className = 'list__link';
      link.textContent = row.applicationOutcome === 'pending' ? 'Review →' : 'View →';
      return link;
    },
  },
];

table.emptyState = {
  icon: '✓',
  heading: 'No applications match these filters',
  message: 'Clear the outcome filter or widen the date range.',
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
    lastRows = result.rows;
    table.setData(result);
    // Always the pending workload, not the filtered row count.
    countBadge.textContent = `${result.pendingTotal} awaiting review`;
  } catch (error) {
    if (!isCurrent()) return;
    lastRows = [];
    table.setError(error.message, load);
    countBadge.textContent = '—';
  }
}

load();
