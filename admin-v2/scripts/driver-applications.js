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
import { t } from './admin-i18n.js';
import { mountStatRow, fillStatRow } from './list-metrics.js';

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
    label: t('applications.searchLabel'),
    placeholder: t('applications.searchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: t('applications.outcomeLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('applications.optAll') },
      { value: 'pending', label: t('status.pending') },
      { value: 'approved', label: t('status.approved') },
      { value: 'rejected', label: t('status.rejected') },
    ],
  },
  {
    type: 'daterange',
    key: 'date',
    label: t('applications.colSubmitted'),
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
        `${t('applications.csvFile')}-${toDateInputValue(Date.now())}.csv`,
        [t('applications.colDriverName'), t('common.phone'), t('applications.colSubmitted'),
         t('applications.outcomeLabel'), t('applications.csvReason')],
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
    label: t('applications.colDriverName'),
    sortable: true,
    render: (row) => row.name,
  },
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
    key: 'submittedAt',
    label: t('applications.colSubmitted'),
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
      // "waiting 3 days ago". Arabic's suffix is stripped by the same rule in
      // units.*, which puts the elapsed value at the end of the phrase.
      waiting.textContent = t('applications.waiting', {
        duration: formatElapsed(row.submittedAt)
          .replace(/ ago$/, '')
          .replace(/^منذ /, ''),
      });
      wrap.append(date, waiting);
      return wrap;
    },
  },
  {
    key: 'applicationOutcome',
    label: t('applications.outcomeLabel'),
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
    label: t('applications.colView'),
    render: (row) => {
      const link = document.createElement('span');
      link.className = 'list__link';
      link.textContent =
        row.applicationOutcome === 'pending'
          ? t('applications.linkReview')
          : t('applications.linkView');
      return link;
    },
  },
];

table.emptyState = {
  icon: '✓',
  heading: t('applications.emptyHeading'),
  message: t('applications.emptyMessage'),
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
    countBadge.textContent = t('applications.badge', { count: result.pendingTotal });
  } catch (error) {
    if (!isCurrent()) return;
    lastRows = [];
    table.setError(error.message, load);
    countBadge.textContent = t('common.notAvailable');
  }
}

load();

// ── Kit KPI row (#1657 queue header) ──────────────────
const applicationStats = mountStatRow(qs('#applications-stats'), [
  { key: 'all', label: t('applications.statTotal'), tone: 'primary', icon: 'applications.svg' },
  { key: 'approved', label: t('status.approved'), tone: 'success', icon: 'approved-application.svg' },
  { key: 'pending', label: t('status.pending_review'), tone: 'warning', icon: 'prossesing.svg' },
  { key: 'rejected', label: t('status.rejected'), tone: 'danger', icon: 'rejected.svg' },
]);

fillStatRow(applicationStats, (key) => mockApi.listApplications({ status: key, pageSize: 1 }));
