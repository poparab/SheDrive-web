/**
 * rider-profile.js — SheDrive admin rider profile
 * #1662 profile + paginated trip history; #1740 suspend; #1741 reinstate.
 * A rider in Pending review was flagged automatically by a gender-mismatch
 * report (API #1687), so that state links through to the report (#1810).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { REASON_LISTS, SAFETY_REPORTS } from './seed.js';
import { formatCount, formatDate, formatDateTime, formatEgp, formatPhone, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const modal = qs('#action-modal');
const body = qs('#profile-body');
const missing = qs('#profile-missing');
const suspendBtn = qs('#suspend-btn');
const reinstateBtn = qs('#reinstate-btn');
const actionHint = qs('#action-hint');
const tripsTable = qs('#trips-table');

const id = new URLSearchParams(window.location.search).get('id');

// ── Trip history (#1662 S2) — 10 rows/page ────────────

const tripQuery = { page: 1, pageSize: 10 };

tripsTable.pageSize = tripQuery.pageSize;
tripsTable.columns = [
  {
    key: 'createdAt',
    label: t('field.tripDate'),
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  {
    key: 'destination',
    label: t('riderProfile.colDestination'),
    className: 'ad-table__truncate',
    render: (trip) => trip.destination.address,
  },
  {
    key: 'fare',
    label: t('riderProfile.colFare'),
    numeric: true,
    render: (trip) => formatEgp(trip.fare?.total ?? trip.estimate.fare),
  },
  {
    key: 'status',
    label: t('riderProfile.colStatus'),
    render: (trip) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = trip.status;
      return pill;
    },
  },
];

tripsTable.emptyState = {
  icon: '☐',
  heading: t('riderProfile.emptyTripsHeading'),
  message: t('riderProfile.emptyTripsMessage'),
};

tripsTable.addEventListener('pagechange', (event) => {
  tripQuery.page = event.detail.page;
  loadTrips();
});

const tripGuard = createRequestGuard();

async function loadTrips() {
  const isCurrent = tripGuard();
  tripsTable.setLoading();
  try {
    const result = await mockApi.listRiderTrips(id, tripQuery);
    if (!isCurrent()) return;
    tripsTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    tripsTable.setError(error.message, loadTrips);
  }
}

// ── Profile ───────────────────────────────────────────

async function load() {
  const rider = await mockApi.getRider(id);

  if (!rider) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  qs('#personal').items = [
    { label: t('field.fullName'), value: rider.name },
    { label: t('common.phone'), value: formatPhone(rider.phone) },
    { label: t('riderProfile.registeredAt'), value: formatDate(rider.registeredAt) },
    { label: t('field.totalTrips'), value: formatCount(rider.tripsCompleted) },
    {
      label: t('riderProfile.lastTrip'),
      value: rider.lastTripAt ? formatDate(rider.lastTripAt) : t('riderProfile.emptyTripsHeading'),
    },
  ];

  const pill = document.createElement('ad-status-pill');
  pill.status = rider.status;

  const statusItems = [{ label: t('common.status'), value: pill }];

  if (rider.suspensionReason) {
    statusItems.push({ label: t('riderProfile.suspensionReason'), value: rider.suspensionReason, wide: true });
  }
  if (rider.suspendedBy) {
    statusItems.push({ label: t('riderProfile.suspendedBy'), value: rider.suspendedBy });
  }
  if (rider.suspendedAt) {
    statusItems.push({ label: t('riderProfile.suspendedOn'), value: formatDateTime(rider.suspendedAt) });
  }
  // Once reinstated, show why — otherwise the account reads as if it were never
  // suspended, and the reversal has no recorded justification.
  if (rider.reinstatement) {
    statusItems.push(
      { label: t('riderProfile.reinstatementReason'), value: rider.reinstatement.reason, wide: true },
      { label: t('riderProfile.reinstatedBy'), value: rider.reinstatement.by },
      { label: t('riderProfile.reinstatedAt'), value: formatDateTime(rider.reinstatement.at) },
    );
  }

  // #1662 S3 — a Pending review rider links to the report that flagged her.
  if (rider.status === 'pending_review') {
    const report = SAFETY_REPORTS.find((r) => String(r.riderId) === String(rider.id));
    if (report) {
      const link = document.createElement('a');
      link.href = `safety-report.html?id=${report.id}`;
      link.className = 'list__link';
      link.textContent = `${report.id} — open report →`;
      statusItems.push({ label: t('riderProfile.reportLabel'), value: link, wide: true });
    } else {
      statusItems.push({
        label: t('riderProfile.reportLabel'),
        value: t('riderProfile.reportUnavailable'),
        muted: true,
        wide: true,
      });
    }
  }

  qs('#status-card').items = statusItems;

  renderActions(rider);
  loadTrips();
}

// ── #1740 suspend / #1741 reinstate ───────────────────

function renderActions(rider) {
  // A Pending review rider is resolved from the safety report, not from here,
  // so this screen only offers the two plain account actions.
  const suspendable = rider.status === 'active';
  const reinstatable = rider.status === 'suspended';

  suspendBtn.hidden = !suspendable;
  reinstateBtn.hidden = !reinstatable;

  if (suspendable) {
    actionHint.textContent =
      t('riderProfile.hintSuspend');
  } else if (reinstatable) {
    actionHint.textContent = t('riderProfile.hintReinstate');
  } else {
    actionHint.textContent =
      t('riderProfile.hintUnderReview');
  }
}

suspendBtn.addEventListener('click', () => {
  modal.open({
    title: t('riderProfile.suspendTitle'),
    description: t('riderProfile.suspendDescription'),
    confirmLabel: t('riderProfile.suspendBtn'),
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('riderProfile.suspensionReason'),
        required: true,
        options: REASON_LISTS.riderSuspension.map((r) => ({ value: r, label: r })),
        emptyError: t('riderProfile.suspendReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('riderProfile.noteLabel'),
        maxLength: 500,
        requiredWhen: (values) => values.reason === t('reason.other'),
        emptyError: t('riderProfile.noteEmptyOther'),
        lengthError: t('riderProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.suspendRider(id, values.reason, values.note);
      shell.showToast(t('riderProfile.toastSuspended'), 'success');
      await load();
    },
  });
});

reinstateBtn.addEventListener('click', () => {
  modal.open({
    title: t('riderProfile.reinstateTitle'),
    description:
      t('riderProfile.reinstateDescription'),
    confirmLabel: t('riderProfile.reinstateBtn'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('riderProfile.reinstatementReason'),
        required: true,
        options: REASON_LISTS.riderReinstatement.map((r) => ({ value: r, label: r })),
        emptyError: t('riderProfile.reinstateReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('riderProfile.noteLabel'),
        maxLength: 500,
        requiredWhen: (values) => values.reason === t('reason.other'),
        emptyError: t('riderProfile.noteEmptyOther'),
        lengthError: t('riderProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.reinstateRider(id, values.reason, values.note);
      shell.showToast(`Rider reinstated — ${values.reason}.`, 'success');
      await load();
    },
  });
});

await load();
