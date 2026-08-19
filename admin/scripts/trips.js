/**
 * trips.js — SheDrive admin trip list
 * #1670: 20 rows/page, newest first, columns Trip ID / Rider / Driver /
 * Pickup area / Destination area / Status / Fare / Date. Search matches rider or
 * driver name or phone; the status filter maps onto the trip state machine.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { downloadCsv, formatDateTime, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#trips-filters');
const table = qs('#trips-table');

const query = {
  search: '',
  status: 'all',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
  sort: { key: 'createdAt', dir: 'desc' },
};

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: 'Rider or driver — name, phone, or trip ID',
    placeholder: 'e.g. Salma, 1002, TRP-24011',
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    value: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'searching', label: 'Searching' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      // #1670's spec lists four options; Cancelled is a fifth, needed once an
      // admin can cancel a trip (#1808). Flagged in admin-wireframes.md.
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'expired', label: 'Expired' },
    ],
  },
  { type: 'daterange', key: 'date', label: 'Date', fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: 'Export CSV',
    variant: 'ghost',
    onClick: () => {
      if (!lastRows.length) return;
      downloadCsv(
        `shedrive-trips-${toDateInputValue(Date.now())}.csv`,
        ['Trip ID', 'Rider', 'Rider phone', 'Driver', 'Driver phone',
         'Pickup area', 'Destination area', 'Status', 'Fare (EGP)', 'Date (UTC+2)'],
        lastRows.map((t) => [
          t.id,
          t.riderName,
          t.riderPhone,
          t.driverName ?? '',
          t.driverPhone ?? '',
          t.pickup.area,
          t.destination.area,
          statusLabel(t.status),
          // A trip without a final fare exports its estimate, marked as such.
          t.fare ? t.fare.total.toFixed(2) : `${t.estimate.fare.toFixed(2)} (est.)`,
          formatDateTime(t.createdAt),
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
table.rowHref = (row) => `trip-detail.html?id=${row.id}`;

/** Name over phone, so a row identifies a person without widening the grid. */
function person(name, phone) {
  if (!name) {
    const none = document.createElement('span');
    none.className = 'ad-muted';
    none.textContent = 'Not assigned';
    return none;
  }
  const wrap = document.createElement('span');
  wrap.className = 'list__name';
  const primary = document.createElement('span');
  primary.className = 'list__name-primary';
  primary.textContent = name;
  wrap.appendChild(primary);
  if (phone) {
    const secondary = document.createElement('span');
    secondary.className = 'list__name-secondary';
    secondary.textContent = phone;
    wrap.appendChild(secondary);
  }
  return wrap;
}

table.columns = [
  { key: 'id', label: 'Trip ID', className: 'ad-table__id', render: (t) => t.id },
  {
    key: 'riderName',
    label: 'Rider',
    sortable: true,
    render: (t) => person(t.riderName, t.riderPhone),
  },
  {
    key: 'driverName',
    label: 'Driver',
    sortable: true,
    render: (t) => person(t.driverName, t.driverPhone),
  },
  { key: 'pickup', label: 'Pickup area', render: (t) => t.pickup.area },
  { key: 'destination', label: 'Destination area', render: (t) => t.destination.area },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (t) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = t.status;
      return pill;
    },
  },
  {
    key: 'fare',
    label: 'Fare (EGP)',
    sortable: true,
    numeric: true,
    render: (t) => {
      // Only a completed trip has a final fare; others show the estimate.
      if (t.fare) return formatEgp(t.fare.total);
      const wrap = document.createElement('span');
      wrap.className = 'ad-muted';
      wrap.textContent = `${formatEgp(t.estimate.fare)} est.`;
      return wrap;
    },
  },
  {
    key: 'createdAt',
    label: 'Date',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (t) => formatDateTime(t.createdAt),
  },
];

table.emptyState = {
  icon: '⇄',
  heading: 'No trips match these filters',
  message: 'Widen the date range or clear the status filter.',
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
    const result = await mockApi.listTrips(query);
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
