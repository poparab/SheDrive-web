/**
 * driver-profile.js — SheDrive admin driver profile
 * #1666 profile with documents, decision history and completed-trip history;
 * #1742 suspend (Pending suspension when the driver is mid-trip); #1743 reinstate.
 * Approve/reject deliberately live on the queue screens, not here.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { REASON_LISTS } from './seed.js';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatEgp,
  formatPhone,
  humanize,
  maskNid,
} from './format.js';
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

const TONE_BY_STATE = {
  submitted: 'muted',
  approved: 'success',
  reinstated: 'success',
  rejected: 'danger',
  suspended: 'danger',
  pending_suspension: 'default',
};

// ── Trip history (#1666 S5) — 10 rows/page ────────────

const tripQuery = { page: 1, pageSize: 10 };

tripsTable.pageSize = tripQuery.pageSize;
tripsTable.columns = [
  {
    key: 'createdAt',
    label: 'Trip date',
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  { key: 'destination', label: 'Destination area', render: (trip) => trip.destination.area },
  {
    key: 'fare',
    label: 'Fare collected',
    numeric: true,
    render: (trip) => formatEgp(trip.fare?.total),
  },
  {
    key: 'rating',
    label: 'Rider rating received',
    render: (trip) => {
      if (!trip.rating) {
        const none = document.createElement('span');
        none.className = 'ad-muted';
        none.textContent = 'No rating given';
        return none;
      }
      const wrap = document.createElement('span');
      wrap.className = 'list__rating';
      const star = document.createElement('span');
      star.className = 'list__rating-star';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '★';
      wrap.append(star, document.createTextNode(String(trip.rating.stars)));
      return wrap;
    },
  },
];

tripsTable.emptyState = {
  icon: '☐',
  heading: 'No completed trips',
  message: 'This driver has not completed a trip yet.',
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
    const result = await mockApi.listDriverTrips(id, tripQuery);
    if (!isCurrent()) return;
    tripsTable.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    tripsTable.setError(error.message, loadTrips);
  }
}

// ── Profile ───────────────────────────────────────────

async function load() {
  const driver = await mockApi.getDriver(id);

  if (!driver) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  qs('#personal').items = [
    { label: 'Full name', value: driver.name },
    { label: 'Phone number', value: formatPhone(driver.phone) },
    { label: 'Date of birth', value: formatDate(driver.dob) },
    { label: 'National ID', value: maskNid(driver.nid) },
    { label: 'Home area', value: driver.homeArea },
    { label: 'Driving licence', value: driver.licenceNumber },
    { label: 'Licence expiry', value: formatDate(driver.licenceExpiry) },
    { label: 'Registration expiry', value: formatDate(driver.registrationExpiry) },
  ];

  qs('#vehicle').items = [
    { label: 'Make', value: driver.vehicle.make },
    { label: 'Model', value: driver.vehicle.model },
    { label: 'Year', value: driver.vehicle.year },
    { label: 'Plate number', value: driver.vehicle.plate },
    { label: 'Colour', value: driver.vehicle.colour },
    { label: 'Type', value: driver.vehicle.type },
  ];

  qs('#docs').docs = [
    ...driver.documents.map((doc) => ({
      label: doc.label,
      src: doc.src,
      ref: doc.ref,
      meta: `Uploaded ${formatDate(doc.uploadedAt)}`,
    })),
    { label: 'Vehicle photo', src: driver.vehiclePhoto },
    { label: 'Profile photo', src: driver.profilePhoto },
  ];

  const pill = document.createElement('ad-status-pill');
  pill.status = driver.status;

  const statusItems = [
    { label: 'Status', value: pill },
    { label: 'Online now', value: driver.online ? 'Yes' : 'No' },
    { label: 'Submitted', value: formatDate(driver.submittedAt) },
  ];

  // #1666 S3 — a suspended driver shows the recorded reason.
  if (driver.suspensionReason) {
    statusItems.push({ label: 'Suspension reason', value: driver.suspensionReason, wide: true });
  }
  if (driver.rejectionReason) {
    statusItems.push({ label: 'Rejection reason', value: driver.rejectionReason, wide: true });
  }

  qs('#status-card').items = statusItems;

  qs('#stats').items = [
    { label: 'Total trips completed', value: formatCount(driver.tripsCompleted) },
    {
      label: 'Average rider rating',
      value: driver.avgRating ? `${driver.avgRating} ★` : 'No ratings yet',
    },
    { label: 'Outstanding cash balance', value: formatEgp(driver.cashBalance) },
  ];

  // Decision history for anything past submission (#1666 S2/S3).
  if (driver.decisionHistory.length > 1) {
    qs('#history-section').hidden = false;
    qs('#history').items = driver.decisionHistory.map((entry) => ({
      label: humanize(entry.state),
      meta: [formatDateTime(entry.at), entry.actor].filter(Boolean).join(' · '),
      note: entry.note,
      tone: TONE_BY_STATE[entry.state] ?? 'default',
    }));
  } else {
    qs('#history-section').hidden = true;
  }

  renderActions(driver);
  loadTrips();
}

// ── #1742 suspend / #1743 reinstate ───────────────────

function renderActions(driver) {
  const suspendable = driver.status === 'approved';
  const reinstatable = driver.status === 'suspended' || driver.status === 'pending_suspension';

  suspendBtn.hidden = !suspendable;
  reinstateBtn.hidden = !reinstatable;

  if (suspendable) {
    actionHint.textContent =
      'Suspending sets the driver offline and invalidates her sessions. If she is on a trip, the suspension applies as soon as that trip ends.';
  } else if (reinstatable) {
    actionHint.textContent = 'Reinstating lets the driver log in and go online again.';
  } else {
    actionHint.textContent =
      driver.status === 'pending'
        ? 'This application is still pending — approve or reject it from the applications queue.'
        : 'No account actions are available for a rejected driver.';
  }
}

suspendBtn.addEventListener('click', () => {
  modal.open({
    title: 'Suspend this driver',
    description:
      'The driver goes offline and cannot accept trips until reinstated. Recorded in the audit log.',
    confirmLabel: 'Suspend driver',
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: 'Suspension reason',
        required: true,
        options: REASON_LISTS.driverSuspension.map((r) => ({ value: r, label: r })),
        emptyError: 'Select a suspension reason',
      },
      {
        key: 'note',
        type: 'textarea',
        label: 'Explanatory note',
        maxLength: 500,
        // The story requires a note only when "Other" is the reason.
        requiredWhen: (values) => values.reason === 'Other',
        emptyError: 'A note is required when the reason is "Other"',
        lengthError: 'Too long — must be ≤ 500 characters',
      },
    ],
    onConfirm: async (values) => {
      const result = await mockApi.suspendDriver(id, values.reason, values.note);
      shell.showToast(
        result.pending
          ? 'Driver marked Pending suspension — it applies when her active trip ends.'
          : 'Driver suspended and set offline.',
        result.pending ? 'warning' : 'success',
      );
      await load();
    },
  });
});

reinstateBtn.addEventListener('click', () => {
  modal.open({
    title: 'Reinstate this driver?',
    description: 'She will be able to log in and go online again immediately.',
    confirmLabel: 'Reinstate driver',
    fields: [],
    onConfirm: async () => {
      await mockApi.reinstateDriver(id);
      shell.showToast('Driver reinstated.', 'success');
      await load();
    },
  });
});

await load();
