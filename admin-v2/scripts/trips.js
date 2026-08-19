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
import { t } from './admin-i18n.js';
import { mountStatRow, fillStatRow } from './list-metrics.js';

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
    label: t('trips.searchLabel'),
    placeholder: t('trips.searchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      { value: 'searching', label: t('status.searching') },
      { value: 'active', label: t('status.active') },
      { value: 'completed', label: t('status.completed') },
      // #1670's spec lists four options; Cancelled is a fifth, needed once an
      // admin can cancel a trip (#1808). Flagged in admin-wireframes.md.
      { value: 'cancelled', label: t('status.cancelled') },
      { value: 'expired', label: t('status.expired') },
    ],
  },
  { type: 'daterange', key: 'date', label: t('common.date'), fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: () => {
      if (!lastRows.length) return;
      downloadCsv(
        `${t('trips.csvFile')}-${toDateInputValue(Date.now())}.csv`,
        [t('trips.colTripId'), t('trips.colRider'), t('trips.csvRiderPhone'),
         t('trips.colDriver'), t('trips.csvDriverPhone'), t('trips.colPickup'),
         t('trips.colDestination'), t('common.status'), t('trips.colFare'),
         t('trips.csvDate')],
        lastRows.map((trip) => [
          trip.id,
          trip.riderName,
          trip.riderPhone,
          trip.driverName ?? '',
          trip.driverPhone ?? '',
          trip.pickup.area,
          trip.destination.area,
          statusLabel(trip.status),
          // A trip without a final fare exports its estimate, marked as such.
          trip.fare ? trip.fare.total.toFixed(2) : `${trip.estimate.fare.toFixed(2)} (est.)`,
          formatDateTime(trip.createdAt),
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
    none.textContent = t('trips.notAssigned');
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
    // A phone number is a Latin run inside an Arabic-aligned cell.
    secondary.className = 'list__name-secondary ad-ltr';
    secondary.textContent = phone;
    wrap.appendChild(secondary);
  }
  return wrap;
}

table.columns = [
  {
    key: 'id',
    label: t('trips.colTripId'),
    className: 'ad-table__id',
    render: (trip) => {
      const id = document.createElement('span');
      id.className = 'ad-ltr';
      id.textContent = trip.id;
      return id;
    },
  },
  {
    key: 'riderName',
    label: t('trips.colRider'),
    sortable: true,
    render: (trip) => person(trip.riderName, trip.riderPhone),
  },
  {
    key: 'driverName',
    label: t('trips.colDriver'),
    sortable: true,
    render: (trip) => person(trip.driverName, trip.driverPhone),
  },
  { key: 'pickup', label: t('trips.colPickup'), render: (trip) => trip.pickup.area },
  {
    key: 'destination',
    label: t('trips.colDestination'),
    render: (trip) => trip.destination.area,
  },
  {
    key: 'status',
    label: t('common.status'),
    sortable: true,
    render: (trip) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = trip.status;
      return pill;
    },
  },
  {
    key: 'fare',
    label: t('trips.colFare'),
    sortable: true,
    numeric: true,
    render: (trip) => {
      // Only a completed trip has a final fare; others show the estimate.
      if (trip.fare) {
        const total = document.createElement('span');
        total.className = 'ad-ltr';
        total.textContent = formatEgp(trip.fare.total);
        return total;
      }
      const wrap = document.createElement('span');
      wrap.className = 'ad-muted ad-ltr';
      wrap.textContent = t('trips.estimate', { value: formatEgp(trip.estimate.fare) });
      return wrap;
    },
  },
  {
    key: 'createdAt',
    label: t('common.date'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (trip) => formatDateTime(trip.createdAt),
  },
];

table.emptyState = {
  icon: '⇄',
  heading: t('trips.emptyHeading'),
  message: t('trips.emptyMessage'),
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

// ── Kit KPI row (#1670 list header) ───────────────────
// "Active now" comes from the dashboard metrics; the rest are list totals.
const tripStats = mountStatRow(qs('#trips-stats'), [
  { key: 'all', label: t('trips.statTotal'), tone: 'primary', icon: 'trips.svg' },
  { key: 'active', label: t('trips.statActive'), tone: 'blue', icon: 'location-checked.svg' },
  { key: 'completed', label: t('status.completed'), tone: 'success', icon: 'checked-2.svg' },
  { key: 'expired', label: t('status.expired'), tone: 'danger', icon: 'time-expired.svg' },
]);

fillStatRow(tripStats, async (key) => {
  if (key === 'active') {
    const metrics = await mockApi.getDashboardMetrics();
    return { total: metrics.activeTrips };
  }
  return mockApi.listTrips({ status: key, pageSize: 1 });
});
