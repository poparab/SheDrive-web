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
    { label: t('field.nid'), value: driver.nid, ltr: true },
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
  await loadPayout(driver);
  loadTrips();
}

// ── Payout method (2026-10-14 spec §2) ────────────────

const payoutEditBtn = qs('#payout-edit-btn');
const payoutHint = qs('#payout-hint');
let payoutOptions = null;
let currentDriver = null;
let currentPayout = null;

const typeLabel = (type) => t(`driverPayout.type${type}`);

/** The kit's inline alert: `.alert.<tone> > i + .details > h6 + p (+ a)`. */
function kitAlert(tone, icon, heading, text, link) {
  const box = document.createElement('div');
  box.className = `alert ${tone} mb-0`;
  box.setAttribute('role', 'status');
  const i = document.createElement('i');
  i.className = `fa-solid ${icon}`;
  i.setAttribute('aria-hidden', 'true');
  const details = document.createElement('div');
  details.className = 'details';
  const h = document.createElement('h6');
  h.textContent = heading;
  details.appendChild(h);
  if (text) {
    const p = document.createElement('p');
    p.textContent = text;
    details.appendChild(p);
  }
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    details.appendChild(a);
  }
  box.append(i, details);
  return box;
}

function updatedByText(method) {
  const when = formatDateTime(method.updatedAt);
  return method.updatedBy && method.updatedBy !== 'driver'
    ? t('driverPayout.updatedByAdmin', { when, who: method.updatedBy })
    : t('driverPayout.updatedByDriver', { when });
}

async function loadPayout(driver) {
  currentDriver = driver;
  let payout;
  try {
    [payout, payoutOptions] = await Promise.all([
      mockApi.getDriverPayout(driver.id),
      payoutOptions ? Promise.resolve(payoutOptions) : mockApi.getPayoutOptions(),
    ]);
  } catch (error) {
    qs('#payout').items = [{ label: t('driverPayout.type'), value: error.message, muted: true, wide: true }];
    payoutEditBtn.disabled = true;
    return;
  }
  currentPayout = payout;

  const method = payout.method;
  if (method) {
    const isCard = method.type === 'PREPAID_CARD';
    const numberLabel = {
      MOBILE_WALLET: t('driverPayout.walletNumber'),
      BANK_ACCOUNT: t('driverPayout.accountNumber'),
      PREPAID_CARD: t('driverPayout.cardNumber'),
    }[method.type];
    const items = [{ label: t('driverPayout.type'), value: typeLabel(method.type) }];
    if (!isCard) {
      items.push({
        label: method.type === 'MOBILE_WALLET' ? t('driverPayout.walletProvider') : t('driverPayout.bank'),
        value: method.provider,
        ltr: true,
      });
    }
    items.push(
      { label: isCard ? t('driverPayout.cardName') : t('driverPayout.holderName'), value: method.holderName },
      { label: numberLabel, value: method.masked, ltr: true },
      { label: t('driverPayout.lastUpdated'), value: updatedByText(method), wide: true },
    );
    qs('#payout').items = items;
  } else {
    qs('#payout').items = [];
  }

  const notices = qs('#payout-notices');
  notices.textContent = '';
  if (payout.lastFailure) {
    const f = payout.lastFailure;
    notices.appendChild(
      kitAlert(
        'danger',
        'fa-circle-exclamation',
        t('driverPayout.lastFailed', { reason: f.reason }),
        t('driverPayout.lastFailedMeta', { when: formatDateTime(f.at), lineRef: f.lineRef ?? '—' }),
        f.batchId
          ? { href: `payout-batch.html?id=${encodeURIComponent(f.batchId)}`, label: t('driverPayout.viewBatch') }
          : null,
      ),
    );
  }
  if (payout.pendingChange) {
    const p = payout.pendingChange;
    notices.appendChild(
      kitAlert(
        'info',
        'fa-hourglass-half',
        t('driverPayout.pendingHeading'),
        t('driverPayout.pendingMeta', { who: p.maker, when: formatDateTime(p.madeAt) }),
        { href: `approvals.html?id=${encodeURIComponent(p.id)}`, label: t('driverPayout.viewRequest') },
      ),
    );
  }

  // An admin edit is a request (§1); one pending request per driver.
  const editable = ['approved', 'suspended', 'pending_suspension', 'pending'].includes(driver.status);
  payoutEditBtn.hidden = !editable;
  payoutEditBtn.disabled = Boolean(payout.pendingChange);
  payoutHint.textContent = payout.pendingChange ? t('driverPayout.editLockedHint') : t('driverPayout.editHint');

  const pos = payout.position;
  qs('#payout-position').items = [
    { label: t('driverPayout.positionDue'), value: formatEgp(pos.due), ltr: true },
    { label: t('driverPayout.positionOnHold'), value: formatEgp(pos.onHold), ltr: true },
    { label: t('driverPayout.positionInBatch'), value: formatEgp(pos.inBatch), ltr: true },
    { label: t('driverPayout.positionSent'), value: formatEgp(pos.sent), ltr: true },
  ];
  qs('#payout-position-hint').textContent = t('driverPayout.positionHint', { days: payoutOptions.holdDays });
}

payoutEditBtn.addEventListener('click', () => {
  if (!currentDriver || currentPayout?.pendingChange) return;
  let chosen = null;
  modal.open({
    title: t('driverPayout.chooseTitle', { name: currentDriver.name }),
    description: t('driverPayout.chooseDescription'),
    confirmLabel: t('driverPayout.continue'),
    tone: 'primary',
    icon: 'fa-solid fa-wallet',
    fields: [
      {
        key: 'type',
        type: 'select',
        label: t('driverPayout.type'),
        required: true,
        value: currentPayout?.method?.type ?? '',
        options: payoutOptions.payoutTypes.map((type) => ({ value: type, label: typeLabel(type) })),
        emptyError: t('driverPayout.typeEmpty'),
      },
    ],
    onConfirm: async (values) => {
      chosen = values.type;
    },
    // The kit modal has one form per open, so the details are a second step.
    onClose: () => {
      if (chosen) window.setTimeout(() => openPayoutDetails(chosen), 0);
    },
  });
});

const digitsOnly = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

function holderField(key, label, emptyError) {
  return {
    key,
    type: 'text',
    label,
    required: true,
    value: currentDriver.name,
    minLength: 3,
    maxLength: 100,
    emptyError,
    lengthError: t('driverPayout.holderLength'),
    validate: (value) => {
      const length = String(value).trim().length;
      return length < 3 || length > 100 ? t('driverPayout.holderLength') : null;
    },
  };
}

function payoutDetailFields(type) {
  const current = currentPayout?.method?.type === type ? currentPayout.method : null;
  if (type === 'MOBILE_WALLET') {
    return [
      {
        key: 'provider',
        type: 'select',
        label: t('driverPayout.walletProvider'),
        required: true,
        value: current?.provider ?? '',
        options: payoutOptions.walletProviders.map((p) => ({ value: p, label: p })),
        emptyError: t('driverPayout.providerEmpty'),
      },
      {
        key: 'number',
        type: 'text',
        label: t('driverPayout.walletNumber'),
        required: true,
        ltr: true,
        placeholder: '01XXXXXXXXX',
        hint: t('driverPayout.walletNumberHint'),
        emptyError: t('driverPayout.walletNumberEmpty'),
        validate: (value) => (/^01[0125]\d{8}$/.test(digitsOnly(value)) ? null : t('driverPayout.walletNumberInvalid')),
      },
    ];
  }
  if (type === 'BANK_ACCOUNT') {
    return [
      {
        key: 'provider',
        type: 'select',
        label: t('driverPayout.bank'),
        required: true,
        value: current?.provider ?? '',
        options: payoutOptions.banks.map((b) => ({ value: b, label: b })),
        emptyError: t('driverPayout.bankEmpty'),
      },
      holderField('holderName', t('driverPayout.holderName'), t('driverPayout.holderEmpty')),
      {
        key: 'number',
        type: 'text',
        label: t('driverPayout.accountNumber'),
        required: true,
        ltr: true,
        hint: t('driverPayout.accountHint'),
        emptyError: t('driverPayout.accountEmpty'),
        validate: (value) => {
          const n = digitsOnly(value);
          return /^\d{10,20}$/.test(n) || /^EG\d{27}$/.test(n) ? null : t('driverPayout.accountInvalid');
        },
      },
    ];
  }
  return [
    holderField('holderName', t('driverPayout.cardName'), t('driverPayout.cardNameEmpty')),
    {
      key: 'number',
      type: 'text',
      label: t('driverPayout.cardNumber'),
      required: true,
      ltr: true,
      hint: t('driverPayout.cardNumberHint'),
      emptyError: t('driverPayout.cardNumberEmpty'),
      validate: (value) => (/^\d{16}$/.test(digitsOnly(value)) ? null : t('driverPayout.cardNumberInvalid')),
    },
  ];
}

function openPayoutDetails(type) {
  modal.open({
    title: t('driverPayout.detailsTitle', { type: typeLabel(type), name: currentDriver.name }),
    description: t('driverPayout.detailsDescription'),
    confirmLabel: t('driverPayout.sendForApproval'),
    tone: 'primary',
    icon: 'fa-solid fa-wallet',
    fields: payoutDetailFields(type),
    onConfirm: async (values) => {
      const result = await mockApi.requestPayoutMethodChange(currentDriver.id, {
        type,
        provider: values.provider ?? null,
        // A wallet carries no holder field; the data layer defaults it to her name.
        holderName: values.holderName ?? currentDriver.name,
        number: digitsOnly(values.number),
      });
      toastWithLink(t('driverPayout.toastSent'), result.request?.id);
      await loadPayout(currentDriver);
    },
  });
}

/** Toasts are plain text; the request link rides along so the maker can follow it. */
function toastWithLink(message, requestId) {
  const toast = shell.showToast(message, 'success', 6000);
  if (toast && requestId) {
    const link = document.createElement('a');
    link.href = `approvals.html?id=${encodeURIComponent(requestId)}`;
    link.className = 'text-reset text-decoration-underline';
    link.textContent = t('driverPayout.viewRequest');
    toast.append(' ', link);
  }
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
