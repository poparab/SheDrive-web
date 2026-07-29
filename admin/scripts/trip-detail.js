/**
 * trip-detail.js — SheDrive admin trip detail
 * #1671 rider/driver info, addresses, state timeline, original estimate for any
 * incomplete trip, expiry-reason note, and intervention actions for a trip still
 * in progress. #1672 adds the recorded route, fare breakdown and rider rating
 * once the trip completes. Read-only throughout.
 *
 * Cancel (#1808) and Reassign (#1809) are unwritten stories, so the markup shows
 * them disabled with an explanation — see the stub block in the HTML.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
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
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#trip-body');
const missing = qs('#trip-missing');
const id = new URLSearchParams(window.location.search).get('id');

const TERMINAL_TONE = { trip_ended: 'success', expired: 'danger' };

function moneyRow(label, value, total = false) {
  const row = document.createElement('div');
  row.className = total ? 'detail__money-row detail__money-row--total' : 'detail__money-row';
  const key = document.createElement('span');
  key.className = 'detail__money-label';
  key.textContent = label;
  const val = document.createElement('span');
  val.className = 'detail__money-value';
  val.textContent = value;
  row.append(key, val);
  return row;
}

const trip = await mockApi.getTrip(id);

if (!trip) {
  missing.hidden = false;
} else {
  body.hidden = false;
  render(trip);
}

function render(trip) {
  const isCompleted = trip.status === 'completed';
  const isInProgress = trip.status === 'active' || trip.status === 'searching';

  // ── Parties ──
  qs('#parties').items = [
    { label: 'Rider', value: trip.riderName },
    { label: 'Rider phone', value: formatPhone(trip.riderPhone) },
    { label: 'Driver', value: trip.driverName ?? 'Not assigned' },
    { label: 'Driver phone', value: trip.driverPhone ? formatPhone(trip.driverPhone) : '—' },
    {
      label: 'Vehicle',
      value: trip.vehicle
        ? `${trip.vehicle.make} ${trip.vehicle.model} · ${trip.vehicle.colour} · ${trip.vehicle.plate}`
        : '—',
      wide: true,
    },
  ];

  // ── Addresses ──
  qs('#route').items = [
    { label: 'Pickup', value: trip.pickup.address, wide: true },
    { label: 'Destination', value: trip.destination.address, wide: true },
    { label: 'Pickup area', value: trip.pickup.area },
    { label: 'Destination area', value: trip.destination.area },
    { label: 'Service zone', value: trip.zoneName },
  ];

  // ── Summary ──
  const pill = document.createElement('ad-status-pill');
  pill.status = trip.status;

  const summaryItems = [
    { label: 'Trip ID', value: trip.id },
    { label: 'Status', value: pill },
    { label: 'Created', value: formatDateTime(trip.createdAt) },
    { label: 'Last update', value: formatDateTime(trip.updatedAt) },
  ];

  // #1671 S4 — an expired trip states why.
  if (trip.status === 'expired') {
    summaryItems.push({
      label: 'Expiry reason',
      value: humanize(trip.expiryReason),
      wide: true,
    });
  }
  if (trip.paymentMethod) {
    const payPill = document.createElement('ad-status-pill');
    payPill.status = trip.paymentMethod;
    summaryItems.push({ label: 'Payment method', value: payPill });
  }

  qs('#summary').items = summaryItems;

  // ── Timeline (#1671 S1) ──
  qs('#timeline').items = trip.stateHistory.map((entry, index) => {
    const isLast = index === trip.stateHistory.length - 1;
    return {
      label: humanize(entry.state),
      meta: `${formatDate(entry.at)} · ${formatTime(entry.at)}`,
      note: entry.note ? `Reason: ${humanize(entry.note)}` : null,
      tone: TERMINAL_TONE[entry.state] ?? (isLast ? 'default' : 'muted'),
    };
  });

  // ── Original estimate (#1671 S2) — incomplete trips only ──
  const estimateSection = qs('#estimate');
  if (!isCompleted) {
    estimateSection.hidden = false;
    estimateSection.items = [
      { label: 'Estimated fare', value: formatEgp(trip.estimate.fare) },
      { label: 'Estimated trip time', value: formatDuration(trip.estimate.durationMin) },
      { label: 'Estimated distance', value: formatDistance(trip.estimate.distanceKm) },
      { label: 'Destination', value: trip.destination.area },
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
      moneyRow('Base fare', formatEgp(trip.fare.baseFare)),
      moneyRow('Distance charge', formatEgp(trip.fare.distanceCharge)),
      moneyRow('Time charge', formatEgp(trip.fare.timeCharge)),
      moneyRow('Total fare', formatEgp(trip.fare.total), true),
      moneyRow('Cash collected', formatEgp(trip.fare.cashCollected)),
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
      none.textContent = 'No rating given';
      host.appendChild(none);
    } else {
      const stars = document.createElement('div');
      stars.className = 'detail__stars';
      stars.setAttribute('aria-label', `${trip.rating.stars} out of 5 stars`);
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

  // ── Recorded route (#1672 S4) — completed only ──
  if (isCompleted && trip.route) {
    mountRouteMap(trip);
  }
}

async function mountRouteMap(trip) {
  const section = qs('#route-section');
  section.hidden = false;

  qs('#route-summary').textContent =
    `${formatDistance(trip.fare.actualDistanceKm)} travelled in ` +
    `${formatDuration(trip.fare.actualDurationMin)} — the recorded GPS path from pickup to drop-off.`;

  const panel = qs('#route-map');
  // The map must never block the rest of the screen, so this runs last and
  // handles an unavailable map with a visible message.
  const map = await panel.mount({ center: trip.pickup.point, zoom: 12 });
  if (!map) return;
  panel.setRoute(trip.route);
}
