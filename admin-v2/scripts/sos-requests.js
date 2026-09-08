/**
 * sos-requests.js — SheDrive admin SOS case queue
 *
 * The triage list for SOS cases raised from inside an active trip by either
 * occupant. Open cases float above closed ones in every sort, because a safety
 * queue is worked top-down and a closed case must never bury an open one.
 *
 * 20 rows/page, status filter defaulting to Open, a raised-by filter, a date
 * range, and a CSV export of the current view.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { downloadCsv, formatDateTime, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { mountStatRow, fillStatRow } from './list-metrics.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#sos-filters');
const table = qs('#sos-table');
const openCount = qs('#open-count');

const query = {
  status: 'open',
  raisedBy: 'all',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
  sort: { key: 'raisedAt', dir: 'desc' },
};

let lastRows = [];

const raiserLabel = (row) => (row.raisedBy === 'driver' ? t('sos.driver') : t('sos.rider'));
const raiserName = (row) => (row.raisedBy === 'driver' ? row.driverName : row.riderName);

/** "3 alerted" — or "3 alerted · 1 failed" when the gateway could not deliver. */
function contactsSummary(row) {
  const total = row.contactsAlerted?.length ?? 0;
  const failed = (row.contactsAlerted ?? []).filter((c) => c.delivery === 'failed').length;
  return failed
    ? t('sos.contactsFailed', { count: total, failed })
    : t('sos.contactsCount', { count: total });
}

filters.fields = [
  {
    type: 'select',
    key: 'status',
    label: t('sos.statusLabel'),
    value: 'open',
    options: [
      { value: 'open', label: t('status.open') },
      { value: 'closed', label: t('status.closed') },
      { value: 'all', label: t('common.all') },
    ],
  },
  {
    type: 'select',
    key: 'raisedBy',
    label: t('sos.raisedByLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('sos.allRaisers') },
      { value: 'rider', label: t('sos.rider') },
      { value: 'driver', label: t('sos.driver') },
    ],
  },
  {
    type: 'daterange',
    key: 'date',
    label: t('sos.timeLabel'),
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
        `${t('sos.csvFile')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('sos.csvCaseId'),
          t('sos.colRaisedBy'),
          t('sos.colRaiserName'),
          t('sos.colTripId'),
          t('sos.colTripState'),
          t('sos.csvTime'),
          t('sos.colLocation'),
          t('sos.colContacts'),
          t('sos.statusLabel'),
          t('sos.colOutcome'),
        ],
        lastRows.map((row) => [
          row.id,
          raiserLabel(row),
          raiserName(row),
          row.tripId,
          statusLabel(row.tripStateAtTrigger),
          formatDateTime(row.raisedAt),
          row.location?.address ?? '',
          contactsSummary(row),
          statusLabel(row.status),
          row.outcome ? statusLabel(row.outcome) : '',
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
table.rowHref = (row) => `sos-request.html?id=${row.id}`;

table.columns = [
  {
    key: 'raisedAt',
    label: t('sos.timeLabel'),
    sortable: true,
    className: 'ad-table__nowrap',
    // The severity stripe lives in the leading cell rather than on the row: the
    // shared data table is frozen, and a safety row must still not read like a
    // trip row at a glance.
    render: (row) => {
      const cell = document.createElement('span');
      cell.className = `sos-when sos-when--${row.status === 'open' ? 'open' : 'closed'}`;
      const stripe = document.createElement('span');
      stripe.className = 'sos-when__stripe';
      stripe.setAttribute('aria-hidden', 'true');
      const when = document.createElement('span');
      when.textContent = formatDateTime(row.raisedAt);
      cell.append(stripe, when);
      return cell;
    },
  },
  {
    key: 'raisedBy',
    label: t('sos.colRaisedBy'),
    sortable: true,
    render: (row) => {
      const wrap = document.createElement('span');
      wrap.className = 'sos-raiser';
      const pill = document.createElement('span');
      pill.className = `sos-raiser__pill sos-raiser__pill--${row.raisedBy}`;
      pill.textContent = raiserLabel(row);
      const name = document.createElement('span');
      name.className = 'sos-raiser__name';
      name.textContent = raiserName(row);
      wrap.append(pill, name);
      return wrap;
    },
  },
  {
    key: 'tripId',
    label: t('sos.colTripId'),
    className: 'ad-table__id',
    render: (row) => {
      const id = document.createElement('span');
      id.className = 'ad-ltr';
      id.textContent = row.tripId;
      return id;
    },
  },
  {
    key: 'tripStateAtTrigger',
    label: t('sos.colTripState'),
    render: (row) => statusLabel(row.tripStateAtTrigger),
  },
  {
    key: 'location',
    label: t('sos.colLocation'),
    render: (row) => row.location?.address ?? '',
  },
  {
    key: 'contactsAlerted',
    label: t('sos.colContacts'),
    className: 'ad-table__nowrap',
    render: (row) => {
      const failed = (row.contactsAlerted ?? []).some((c) => c.delivery === 'failed');
      const span = document.createElement('span');
      // A failed alert is the one thing on this row an admin may need to chase.
      span.className = failed ? 'sos-contacts sos-contacts--failed' : 'sos-contacts';
      span.textContent = contactsSummary(row);
      return span;
    },
  },
  {
    key: 'status',
    label: t('sos.statusLabel'),
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      // A closed case shows how it was closed, not merely "closed".
      pill.status = row.status === 'closed' && row.outcome ? row.outcome : row.status;
      return pill;
    },
  },
];

table.emptyState = {
  icon: '✓',
  heading: t('sos.emptyHeading'),
  message: t('sos.emptyMessage'),
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
    const result = await mockApi.listSosCases(query);
    if (!isCurrent()) return;
    lastRows = result.rows;
    table.setData(result);
    openCount.textContent =
      query.status === 'open'
        ? t('sos.badgeOpen', { count: result.total })
        : t('sos.badgeShown', { count: result.total });
  } catch (error) {
    if (!isCurrent()) return;
    lastRows = [];
    table.setError(error.message, load);
    openCount.textContent = t('common.notAvailable');
  }
}

load();

// ── Kit KPI row ───────────────────────────────────────
const sosStats = mountStatRow(qs('#sos-stats'), [
  { key: 'all', label: t('sos.statTotal'), tone: 'primary', icon: 'warning-sign.svg' },
  { key: 'open', label: t('status.open'), tone: 'danger', icon: 'prossesing.svg' },
  { key: 'closed', label: t('status.closed'), tone: 'success', icon: 'checked-2.svg' },
]);

fillStatRow(sosStats, (key) => mockApi.listSosCases({ status: key, raisedBy: 'all', pageSize: 1 }));
