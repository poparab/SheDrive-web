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
    label: 'Trip date',
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  {
    key: 'destination',
    label: 'Destination address',
    className: 'ad-table__truncate',
    render: (trip) => trip.destination.address,
  },
  {
    key: 'fare',
    label: 'Fare (EGP)',
    numeric: true,
    render: (trip) => formatEgp(trip.fare?.total ?? trip.estimate.fare),
  },
  {
    key: 'status',
    label: 'Trip status',
    render: (trip) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = trip.status;
      return pill;
    },
  },
];

tripsTable.emptyState = {
  icon: '☐',
  heading: 'No trips yet',
  message: 'This rider has never completed a trip.',
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
    { label: 'Full name', value: rider.name },
    { label: 'Phone number', value: formatPhone(rider.phone) },
    { label: 'Registration date', value: formatDate(rider.registeredAt) },
    { label: 'Total trips completed', value: formatCount(rider.tripsCompleted) },
    {
      label: 'Date of last trip',
      value: rider.lastTripAt ? formatDate(rider.lastTripAt) : 'No trips yet',
    },
  ];

  const pill = document.createElement('ad-status-pill');
  pill.status = rider.status;

  const statusItems = [{ label: 'Status', value: pill }];

  if (rider.suspensionReason) {
    statusItems.push({ label: 'Suspension reason', value: rider.suspensionReason, wide: true });
  }
  if (rider.suspendedBy) {
    statusItems.push({ label: 'Suspended by', value: rider.suspendedBy });
  }
  if (rider.suspendedAt) {
    statusItems.push({ label: 'Suspended on', value: formatDateTime(rider.suspendedAt) });
  }
  // Once reinstated, show why — otherwise the account reads as if it were never
  // suspended, and the reversal has no recorded justification.
  if (rider.reinstatement) {
    statusItems.push(
      { label: 'Reinstatement reason', value: rider.reinstatement.reason, wide: true },
      { label: 'Reinstated by', value: rider.reinstatement.by },
      { label: 'Reinstated at', value: formatDateTime(rider.reinstatement.at) },
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
      statusItems.push({ label: 'Gender-mismatch report', value: link, wide: true });
    } else {
      statusItems.push({
        label: 'Gender-mismatch report',
        value: 'Flagged automatically — report record not available',
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
      'Suspending invalidates her sessions and blocks new bookings until reinstated.';
  } else if (reinstatable) {
    actionHint.textContent = 'Reinstating lets her book rides again immediately.';
  } else {
    actionHint.textContent =
      'This rider is under review from a gender-mismatch report — resolve it from the linked report.';
  }
}

suspendBtn.addEventListener('click', () => {
  modal.open({
    title: 'Suspend this rider',
    description: 'She will be unable to book rides until reinstated. Recorded in the audit log.',
    confirmLabel: 'Suspend rider',
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: 'Suspension reason',
        required: true,
        options: REASON_LISTS.riderSuspension.map((r) => ({ value: r, label: r })),
        emptyError: 'Select a suspension reason',
      },
      {
        key: 'note',
        type: 'textarea',
        label: 'Explanatory note',
        maxLength: 500,
        requiredWhen: (values) => values.reason === 'Other',
        emptyError: 'A note is required when the reason is "Other"',
        lengthError: 'Too long — must be ≤ 500 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.suspendRider(id, values.reason, values.note);
      shell.showToast('Rider suspended.', 'success');
      await load();
    },
  });
});

reinstateBtn.addEventListener('click', () => {
  modal.open({
    title: 'Reinstate this rider?',
    description:
      'She will be able to book rides again immediately. Reinstating is as consequential as suspending, so it carries its own recorded reason and is written to the audit log.',
    confirmLabel: 'Reinstate rider',
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: 'Reinstatement reason',
        required: true,
        options: REASON_LISTS.riderReinstatement.map((r) => ({ value: r, label: r })),
        emptyError: 'Select a reinstatement reason',
      },
      {
        key: 'note',
        type: 'textarea',
        label: 'Explanatory note',
        maxLength: 500,
        requiredWhen: (values) => values.reason === 'Other',
        emptyError: 'A note is required when the reason is "Other"',
        lengthError: 'Too long — must be ≤ 500 characters',
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
