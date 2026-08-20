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
import { withKitArt } from './doc-images.js';
import { t, hasKey } from './admin-i18n.js';

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
    label: t('field.tripDate'),
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  { key: 'destination', label: t('driverProfile.colDestinationArea'), render: (trip) => trip.destination.area },
  {
    key: 'fare',
    label: t('driverProfile.colFare'),
    numeric: true,
    render: (trip) => formatEgp(trip.fare?.total),
  },
  {
    key: 'rating',
    label: t('driverProfile.colRating'),
    render: (trip) => {
      if (!trip.rating) {
        const none = document.createElement('span');
        none.className = 'ad-muted';
        none.textContent = t('field.noRating');
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
  heading: t('driverProfile.emptyTripsHeading'),
  message: t('driverProfile.emptyTripsMessage'),
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
    { label: t('field.fullName'), value: driver.name },
    { label: t('common.phone'), value: formatPhone(driver.phone), ltr: true },
    { label: t('field.dob'), value: formatDate(driver.dob) },
    { label: t('field.nid'), value: maskNid(driver.nid), ltr: true },
    { label: t('field.homeArea'), value: driver.homeArea },
    { label: t('field.licence'), value: driver.licenceNumber, ltr: true },
    { label: t('field.licenceExpiry'), value: formatDate(driver.licenceExpiry) },
    { label: t('field.registrationExpiry'), value: formatDate(driver.registrationExpiry) },
  ];

  qs('#vehicle').items = [
    { label: t('field.make'), value: driver.vehicle.make },
    { label: t('field.model'), value: driver.vehicle.model },
    { label: t('field.year'), value: driver.vehicle.year },
    { label: t('field.plate'), value: driver.vehicle.plate, ltr: true },
    { label: t('field.colour'), value: driver.vehicle.colour },
    { label: t('field.type'), value: driver.vehicle.type },
  ];

  // Kit artwork stands in for the seed's flat placeholders (presentation only).
  qs('#docs').docs = withKitArt([
    ...driver.documents.map((doc) => ({
      // The seed is the frozen data layer, so the label is translated here.
      label: hasKey(`docs.${doc.key}`) ? t(`docs.${doc.key}`) : doc.label,
      src: doc.src,
      ref: doc.ref,
      meta: `Uploaded ${formatDate(doc.uploadedAt)}`,
    })),
    { label: t('docs.profilePhoto'), src: driver.profilePhoto },
    { label: t('docs.vehiclePhoto'), src: driver.vehiclePhoto },
  ]);

  const pill = document.createElement('ad-status-pill');
  pill.status = driver.status;

  const statusItems = [
    { label: t('common.status'), value: pill },
    { label: t('field.onlineNow'), value: driver.online ? t('common.yes') : t('common.no') },
    { label: t('field.submitted'), value: formatDate(driver.submittedAt) },
  ];

  // #1666 S3 — a suspended driver shows the recorded reason, plus who suspended
  // her and when. Derived from the decision history rather than stored twice, so
  // it works for both seeded and live suspensions.
  if (driver.suspensionReason) {
    const suspension = [...driver.decisionHistory]
      .reverse()
      .find((entry) => entry.state === 'suspended' || entry.state === 'pending_suspension');

    statusItems.push({
      label: driver.status === 'pending_suspension' ? t('driverProfile.pendingSuspensionReason') : t('driverProfile.suspensionReason'),
      value: driver.suspensionReason,
      wide: true,
    });
    if (suspension?.actor) {
      statusItems.push({ label: t('driverProfile.suspendedBy'), value: suspension.actor });
    }
    if (suspension?.at) {
      statusItems.push({ label: t('driverProfile.suspendedAt'), value: formatDateTime(suspension.at) });
    }
  }
  if (driver.rejectionReason) {
    statusItems.push({ label: t('driverProfile.rejectionReason'), value: driver.rejectionReason, wide: true });
  }
  // Once reinstated, show why — otherwise the account reads as if it were never suspended.
  if (driver.reinstatement) {
    statusItems.push(
      { label: t('driverProfile.reinstatementReason'), value: driver.reinstatement.reason, wide: true },
      { label: t('driverProfile.reinstatedBy'), value: driver.reinstatement.by },
      { label: t('driverProfile.reinstatedAt'), value: formatDateTime(driver.reinstatement.at) },
    );
  }

  qs('#status-card').items = statusItems;

  qs('#stats').items = [
    { label: t('field.totalTrips'), value: formatCount(driver.tripsCompleted) },
    {
      label: t('driverProfile.avgRating'),
      value: driver.avgRating ? `${driver.avgRating} ★` : t('driverProfile.noRatingsYet'),
    },
    { label: t('driverProfile.cashBalance'), value: formatEgp(driver.cashBalance) },
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
      t('driverProfile.hintSuspend');
  } else if (reinstatable) {
    actionHint.textContent = t('driverProfile.hintReinstate');
  } else {
    actionHint.textContent =
      driver.status === 'pending'
        ? t('driverProfile.hintPending')
        : t('driverProfile.hintRejected');
  }
}

suspendBtn.addEventListener('click', () => {
  modal.open({
    title: t('driverProfile.suspendTitle'),
    description:
      t('driverProfile.suspendDescription'),
    confirmLabel: t('driverProfile.suspendBtn'),
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('driverProfile.suspensionReason'),
        required: true,
        options: REASON_LISTS.driverSuspension.map((r) => ({ value: r, label: r })),
        emptyError: t('driverProfile.suspendReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('driverProfile.noteLabel'),
        maxLength: 500,
        // The story requires a note only when t('reason.other') is the reason.
        requiredWhen: (values) => values.reason === t('reason.other'),
        emptyError: t('driverProfile.noteEmptyOther'),
        lengthError: t('driverProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      const result = await mockApi.suspendDriver(id, values.reason, values.note);
      shell.showToast(
        result.pending
          ? t('driverProfile.toastPendingSuspension')
          : t('driverProfile.toastSuspended'),
        result.pending ? 'warning' : 'success',
      );
      await load();
    },
  });
});

reinstateBtn.addEventListener('click', () => {
  modal.open({
    title: t('driverProfile.reinstateTitle'),
    description:
      t('driverProfile.reinstateDescription'),
    confirmLabel: t('driverProfile.reinstateBtn'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('driverProfile.reinstatementReason'),
        required: true,
        options: REASON_LISTS.driverReinstatement.map((r) => ({ value: r, label: r })),
        emptyError: t('driverProfile.reinstateReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('driverProfile.noteLabel'),
        maxLength: 500,
        requiredWhen: (values) => values.reason === t('reason.other'),
        emptyError: t('driverProfile.noteEmptyOther'),
        lengthError: t('driverProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.reinstateDriver(id, values.reason, values.note);
      shell.showToast(`Driver reinstated — ${values.reason}.`, 'success');
      await load();
    },
  });
});

await load();
