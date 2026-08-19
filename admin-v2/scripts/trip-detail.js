/**
 * trip-detail.js — SheDrive admin trip detail
 * #1671 rider/driver info, addresses, state timeline, original estimate for any
 * incomplete trip, expiry-reason note, and intervention actions for a trip still
 * in progress. #1672 adds the recorded route, fare breakdown and rider rating
 * once the trip completes. Read-only throughout.
 *
 * Cancel (#1808) and Reassign (#1809) are implemented here, but both stories are
 * unwritten — the flows are a proposal and the screen says so. Behaviour chosen:
 * cancelling yields a distinct `cancelled` status (#1671 S2 already treats
 * cancelled and expired as separate cases); reassigning keeps the trip live and
 * returns it to `accepted`; both are written to the audit log per #1816.
 *
 * Bilingual: every generated string goes through `t()`. Reason values stay
 * English in the data (they are what the audit log and `values.reason ===
 * 'Other'` compare against) — only their labels are translated.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { REASON_LISTS } from './seed.js';
import {
  formatDate,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatEgp,
  formatPhone,
  formatTime,
  humanize,
} from './format.js';
import { t, hasKey } from './admin-i18n.js';
import { reasonKey } from '../i18n/details.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const modal = qs('#intervention-modal');
const body = qs('#trip-body');
const missing = qs('#trip-missing');
const id = new URLSearchParams(window.location.search).get('id');

const TERMINAL_TONE = {
  trip_ended: 'success',
  expired: 'danger',
  cancelled_by_admin: 'danger',
  reassigned_by_admin: 'default',
};

/** Translated label for a stored reason string; unknown text passes through. */
function reasonLabel(text) {
  if (!text) return text;
  const key = `reason.${reasonKey(text)}`;
  return hasKey(key) ? t(key) : text;
}

/** A reason list as modal options — English value, translated label. */
function reasonOptions(list) {
  return list.map((reason) => ({ value: reason, label: reasonLabel(reason) }));
}

/** Translated label for a trip state token from the state machine. */
function stateLabel(state) {
  return hasKey(`status.${state}`) ? t(`status.${state}`) : humanize(state);
}

/** Latin data (ids, phones, plates, money) kept LTR inside Arabic copy. */
function ltr(text) {
  const span = document.createElement('span');
  span.className = 'ad-ltr';
  span.textContent = text ?? '—';
  return span;
}

/** Static section headings that live on <ad-detail-section> attributes. */
function localizeSections() {
  const titles = {
    '#parties': 'tripDetail.parties',
    '#route': 'tripDetail.route',
    '#summary': 'tripDetail.summary',
    '#estimate': 'tripDetail.estimate',
    '#cancellation': 'tripDetail.cancellation',
  };
  Object.entries(titles).forEach(([selector, key]) => {
    qs(selector)?.setAttribute('section-title', t(key));
  });

  const state = qs('#trip-missing ad-empty-state');
  if (state) {
    state.setAttribute('heading', t('tripDetail.notFoundHeading'));
    state.setAttribute('message', t('tripDetail.notFoundMessage'));
  }
}

/**
 * Timeline notes carry two different kinds of value: machine tokens from the
 * trip state machine (`no_driver`) and free text an admin typed or picked
 * ("Driver unresponsive"). Only the former should be humanised — running it over
 * prose title-cases every word.
 */
function noteText(note) {
  const isToken = /^[a-z0-9]+(_[a-z0-9]+)*$/.test(note);
  if (!isToken) return reasonLabel(note);
  const key = `tripDetail.expiry.${note}`;
  return hasKey(key) ? t(key) : humanize(note);
}

function moneyRow(label, value, total = false) {
  const row = document.createElement('div');
  row.className = total ? 'detail__money-row detail__money-row--total' : 'detail__money-row';
  const key = document.createElement('span');
  key.className = 'detail__money-label';
  key.textContent = label;
  const val = document.createElement('span');
  val.className = 'detail__money-value ad-ltr';
  val.textContent = value;
  row.append(key, val);
  return row;
}

localizeSections();

async function load() {
  const trip = await mockApi.getTrip(id);
  if (!trip) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }
  missing.hidden = true;
  body.hidden = false;
  render(trip);
}

await load();

function render(trip) {
  const isCompleted = trip.status === 'completed';
  const isInProgress = trip.status === 'active' || trip.status === 'searching';

  // ── Parties ──
  qs('#parties').items = [
    { label: t('tripDetail.rider'), value: trip.riderName },
    { label: t('tripDetail.riderPhone'), value: ltr(formatPhone(trip.riderPhone)) },
    { label: t('tripDetail.driver'), value: trip.driverName ?? t('tripDetail.notAssigned') },
    {
      label: t('tripDetail.driverPhone'),
      value: trip.driverPhone ? ltr(formatPhone(trip.driverPhone)) : t('common.notAvailable'),
    },
    {
      label: t('field.vehicle'),
      value: trip.vehicle
        ? `${trip.vehicle.make} ${trip.vehicle.model} · ${trip.vehicle.colour} · ${trip.vehicle.plate}`
        : t('common.notAvailable'),
      wide: true,
    },
  ];

  // ── Addresses ──
  qs('#route').items = [
    { label: t('tripDetail.pickup'), value: trip.pickup.address, wide: true },
    { label: t('tripDetail.destination'), value: trip.destination.address, wide: true },
    { label: t('tripDetail.pickupArea'), value: trip.pickup.area },
    { label: t('tripDetail.destinationArea'), value: trip.destination.area },
    { label: t('tripDetail.serviceZone'), value: trip.zoneName },
  ];

  // ── Summary ──
  const pill = document.createElement('ad-status-pill');
  pill.status = trip.status;

  const summaryItems = [
    { label: t('tripDetail.tripId'), value: ltr(trip.id) },
    { label: t('common.status'), value: pill },
    { label: t('tripDetail.created'), value: formatDateTime(trip.createdAt) },
    { label: t('tripDetail.lastUpdate'), value: formatDateTime(trip.updatedAt) },
  ];

  // #1671 S4 — an expired trip states why.
  if (trip.status === 'expired') {
    summaryItems.push({
      label: t('tripDetail.expiryReason'),
      value: noteText(trip.expiryReason),
      wide: true,
    });
  }
  if (trip.status === 'cancelled') {
    summaryItems.push({
      label: t('tripDetail.cancelledBy'),
      value: t('tripDetail.adminActor'),
      wide: true,
    });
  }
  if (trip.paymentMethod) {
    const payPill = document.createElement('ad-status-pill');
    payPill.status = trip.paymentMethod;
    summaryItems.push({ label: t('tripDetail.paymentMethod'), value: payPill });
  }

  qs('#summary').items = summaryItems;

  // ── Timeline (#1671 S1) ──
  qs('#timeline').items = trip.stateHistory.map((entry, index) => {
    const isLast = index === trip.stateHistory.length - 1;
    return {
      label: stateLabel(entry.state),
      meta: `${formatDate(entry.at)} · ${formatTime(entry.at)}`,
      note: entry.note ? t('tripDetail.reasonNote', { reason: noteText(entry.note) }) : null,
      tone: TERMINAL_TONE[entry.state] ?? (isLast ? 'default' : 'muted'),
    };
  });

  // ── Original estimate (#1671 S2) — incomplete trips only ──
  const estimateSection = qs('#estimate');
  if (!isCompleted) {
    estimateSection.hidden = false;
    estimateSection.items = [
      { label: t('tripDetail.estimatedFare'), value: ltr(formatEgp(trip.estimate.fare)) },
      { label: t('tripDetail.estimatedTime'), value: formatDuration(trip.estimate.durationMin) },
      { label: t('tripDetail.estimatedDistance'), value: formatDistance(trip.estimate.distanceKm) },
      { label: t('tripDetail.destination'), value: trip.destination.area },
    ];
  } else {
    estimateSection.hidden = true;
  }

  // ── Fare breakdown (#1672 S1) — completed only ──
  if (isCompleted) {
    qs('#fare-section').hidden = false;
    const rows = qs('#fare-rows');
    rows.textContent = '';
    rows.append(
      moneyRow(t('tripDetail.baseFare'), formatEgp(trip.fare.baseFare)),
      moneyRow(t('tripDetail.distanceCharge'), formatEgp(trip.fare.distanceCharge)),
      moneyRow(t('tripDetail.timeCharge'), formatEgp(trip.fare.timeCharge)),
      moneyRow(t('tripDetail.totalFare'), formatEgp(trip.fare.total), true),
      moneyRow(t('tripDetail.cashCollected'), formatEgp(trip.fare.cashCollected)),
    );
  }

  // ── Rating (#1672 S2/S3) — completed only ──
  if (isCompleted) {
    qs('#rating-section').hidden = false;
    const host = qs('#rating-body');
    host.textContent = '';

    if (!trip.rating) {
      const none = document.createElement('p');
      none.className = 'ad-muted';
      none.style.margin = '0';
      none.textContent = t('tripDetail.noRating');
      host.appendChild(none);
    } else {
      const stars = document.createElement('div');
      stars.className = 'detail__stars';
      stars.setAttribute('aria-label', t('tripDetail.starsAria', { stars: trip.rating.stars }));
      stars.textContent = '★'.repeat(trip.rating.stars) + '☆'.repeat(5 - trip.rating.stars);
      host.appendChild(stars);

      if (trip.rating.tags.length) {
        const tags = document.createElement('div');
        tags.className = 'detail__tags';
        trip.rating.tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = tag;
          tags.appendChild(chip);
        });
        host.appendChild(tags);
      }
    }
  }

  // ── Intervention actions (#1671 S5) — in-progress only ──
  qs('#actions-section').hidden = !isInProgress;
  if (isInProgress) {
    qs('#intervention-hint').textContent = trip.driverId
      ? t('tripDetail.interventionHint')
      : t('tripDetail.interventionHintNoDriver');
    // Nothing to hand over until a driver has actually been matched.
    qs('#reassign-trip').disabled = !trip.driverId;
  }

  // ── Recorded cancellation, once it has happened ──
  const cancellationSection = qs('#cancellation');
  if (trip.cancellation) {
    cancellationSection.hidden = false;
    cancellationSection.items = [
      { label: t('common.reason'), value: reasonLabel(trip.cancellation.reason), wide: true },
      ...(trip.cancellation.note && trip.cancellation.note !== trip.cancellation.reason
        ? [{ label: t('common.note'), value: trip.cancellation.note, wide: true }]
        : []),
      { label: t('tripDetail.cancelledBy'), value: ltr(trip.cancellation.by) },
      { label: t('tripDetail.cancelledAt'), value: formatDateTime(trip.cancellation.at) },
    ];
  } else {
    cancellationSection.hidden = true;
  }

  // ── Recorded route (#1672 S4) — completed only ──
  if (isCompleted && trip.route) {
    mountRouteMap(trip);
  }
}

// ── #1808 cancel an in-progress trip ──────────────────

qs('#cancel-trip').addEventListener('click', () => {
  modal.open({
    title: t('tripDetail.cancelTitle'),
    description: t('tripDetail.cancelDescription'),
    confirmLabel: t('tripDetail.cancelConfirm'),
    danger: true,
    cancelLabel: t('tripDetail.cancelKeep'),
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('tripDetail.cancelReasonLabel'),
        required: true,
        options: reasonOptions(REASON_LISTS.tripCancellation),
        emptyError: t('tripDetail.cancelReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('tripDetail.noteLabel'),
        maxLength: 500,
        requiredWhen: (values) => values.reason === 'Other',
        emptyError: t('tripDetail.noteEmptyOther'),
        lengthError: t('tripDetail.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.cancelTrip(id, values.reason, values.note);
      shell.showToast(t('tripDetail.toastCancelled'), 'warning');
      await load();
    },
  });
});

// ── #1809 reassign to another driver ──────────────────

qs('#reassign-trip').addEventListener('click', async () => {
  const candidates = await mockApi.listReassignableDrivers(id);

  // Nothing to reassign to is a real operational state, not an error.
  if (!candidates.length) {
    modal.open({
      title: t('tripDetail.noDriverTitle'),
      description: t('tripDetail.noDriverDescription'),
      confirmLabel: t('common.close'),
      cancelLabel: t('tripDetail.noDriverBack'),
      fields: [],
      onConfirm: async () => {},
    });
    return;
  }

  modal.open({
    title: t('tripDetail.reassignTitle'),
    description: t('tripDetail.reassignDescription'),
    confirmLabel: t('tripDetail.reassignConfirm'),
    fields: [
      {
        key: 'driverId',
        type: 'select',
        label: t('tripDetail.newDriverLabel'),
        required: true,
        placeholder: t('tripDetail.newDriverPlaceholder'),
        options: candidates.map((d) => ({
          value: String(d.id),
          label: `${d.name} — ${d.vehicle}${d.rating ? ` · ${d.rating}★` : ''} · ${d.homeArea}`,
        })),
        emptyError: t('tripDetail.newDriverEmpty'),
      },
      {
        key: 'reason',
        type: 'select',
        label: t('tripDetail.reassignReasonLabel'),
        required: true,
        options: reasonOptions(REASON_LISTS.tripReassignment),
        emptyError: t('tripDetail.reassignReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('tripDetail.noteLabel'),
        maxLength: 500,
        requiredWhen: (values) => values.reason === 'Other',
        emptyError: t('tripDetail.noteEmptyOther'),
        lengthError: t('tripDetail.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      const result = await mockApi.reassignTrip(id, values.driverId, values.reason, values.note);
      shell.showToast(t('tripDetail.toastReassigned', { name: result.driverName }), 'success');
      await load();
    },
  });
});

async function mountRouteMap(trip) {
  const section = qs('#route-section');
  section.hidden = false;

  qs('#route-summary').textContent = t('tripDetail.routeSummary', {
    distance: formatDistance(trip.fare.actualDistanceKm),
    duration: formatDuration(trip.fare.actualDurationMin),
  });

  const panel = qs('#route-map');
  // The map must never block the rest of the screen, so this runs last and
  // handles an unavailable map with a visible message.
  const map = await panel.mount({ center: trip.pickup.point, zoom: 12 });
  if (!map) return;
  panel.setRoute(trip.route);
}
