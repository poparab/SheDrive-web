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
 * Presentation (kit v22-09): one `.row.g-3` card grid whose cards appear by trip
 * state, the actions in a bottom row, and the kit's own modals — a
 * `default-modal` for the reason form, a `popup-danger` final confirmation for
 * cancelling, and a toast result. The modals are static markup in the
 * page, moved to <body> so no positioned ancestor can trap them.
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
import { t, hasKey, applyAdminTranslations } from './admin-i18n.js';
import { can } from './roles.js';
import { loadWithBanner } from './page-banner.js';
import { loadBootstrap } from './design-init.js';
import { reasonKey } from '../i18n/details.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#trip-body');
const missing = qs('#trip-missing');
const banner = qs('#status-banner');
const id = new URLSearchParams(window.location.search).get('id');

const TERMINAL_TONE = {
  trip_ended: 'success',
  expired: 'danger',
  cancelled_by_admin: 'danger',
  reassigned_by_admin: 'default',
};

const NOTE_MAX = 500;

/** Translated label for a stored reason string; unknown text passes through. */
function reasonLabel(text) {
  if (!text) return text;
  const key = `reason.${reasonKey(text)}`;
  return hasKey(key) ? t(key) : text;
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
    '#summary': 'kitDetails.tripDetails',
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

/** One kit key/value row: `.row.gx-0.list-row > .list-item.col + .list-item.col-auto`. */
function listRow(label, value, extraClass = '') {
  const row = document.createElement('div');
  row.className = `row gx-0 list-row detail__money-row ${extraClass}`.trim();
  const key = document.createElement('div');
  key.className = 'list-item col text-bold detail__money-label';
  key.textContent = label;
  const val = document.createElement('div');
  val.className = 'list-item col-auto justify-content-md-end detail__money-value ad-ltr';
  val.textContent = value;
  row.append(key, val);
  return row;
}

localizeSections();

// ── Kit modals ────────────────────────────────────────

const modals = {
  reassign: qs('#reassign-modal'),
  noDriver: qs('#no-driver-modal'),
  cancel: qs('#cancel-modal'),
  cancelWarning: qs('#cancel-warning-modal'),
};

// <ad-shell> re-parents its children into the content area; a Bootstrap modal
// must sit on <body> so no transformed or positioned ancestor can trap it.
Object.values(modals).forEach((el) => {
  document.body.appendChild(el);
  applyAdminTranslations(el);
});

async function showModal(el) {
  try {
    await loadBootstrap();
  } catch {
    /* fall back below */
  }
  if (window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(el).show();
    return;
  }
  el.style.display = 'block';
  el.classList.add('show');
  el.removeAttribute('aria-hidden');
}

/** Resolves once the modal has finished hiding, so the next one can open cleanly. */
function hideModal(el) {
  return new Promise((resolve) => {
    const instance = window.bootstrap?.Modal?.getInstance(el);
    if (!instance) {
      el.classList.remove('show');
      el.style.display = '';
      el.setAttribute('aria-hidden', 'true');
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    el.addEventListener('hidden.bs.modal', finish, { once: true });
    const hide = () => {
      if (!el.classList.contains('show')) finish();
      else instance.hide();
    };
    // Bootstrap ignores hide() while a show is still animating — wait it out.
    if (instance._isTransitioning) el.addEventListener('shown.bs.modal', hide, { once: true });
    else hide();
    // Never leave the flow hanging on an animation event that does not arrive.
    window.setTimeout(finish, 1500);
  });
}

/** The action went through. A toast — the kit's popup-success asked nothing of the admin. */
function showSuccess(title, message) {
  qs('ad-shell').showToast(message, 'success', { title });
}

function setFormError(modal, message) {
  const box = modal.querySelector('.td-form-error');
  if (!box) return;
  box.hidden = !message;
  box.querySelector('p').textContent = message ?? '';
}

function fillReasonSelect(select, list) {
  select.textContent = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('modal.selectPlaceholder');
  select.appendChild(placeholder);
  list.forEach((reason) => {
    const opt = document.createElement('option');
    opt.value = reason;
    opt.textContent = reasonLabel(reason);
    select.appendChild(opt);
  });
  select.value = '';
}

function fieldError(form, key, control, message) {
  const feedback = form.querySelector(`[data-error-for="${key}"]`);
  const target = control.tagName === 'AD-COMBOBOX' ? control.querySelector('input') ?? control : control;
  if (message) {
    if (feedback) {
      feedback.textContent = message;
      feedback.classList.add('d-block');
    }
    target.classList.add('is-invalid');
    target.setAttribute('aria-invalid', 'true');
  } else {
    feedback?.classList.remove('d-block');
    target.classList.remove('is-invalid');
    target.removeAttribute('aria-invalid');
  }
}

/** Reason + note rules shared by both forms (Field Validation tables of #1808/#1809). */
function validateReasonNote(form, reasonSelect, noteInput, reasonEmptyKey) {
  let firstInvalid = null;
  const reason = reasonSelect.value;
  const note = noteInput.value.trim();

  if (!reason) {
    fieldError(form, 'reason', reasonSelect, t(reasonEmptyKey));
    firstInvalid = firstInvalid ?? reasonSelect;
  } else {
    fieldError(form, 'reason', reasonSelect, null);
  }

  if (reason === 'Other' && !note) {
    fieldError(form, 'note', noteInput, t('tripDetail.noteEmptyOther'));
    firstInvalid = firstInvalid ?? noteInput;
  } else if (note.length > NOTE_MAX) {
    fieldError(form, 'note', noteInput, t('tripDetail.noteTooLong'));
    firstInvalid = firstInvalid ?? noteInput;
  } else {
    fieldError(form, 'note', noteInput, null);
  }

  return firstInvalid;
}

function clearOnEdit(form, key, control) {
  ['input', 'change'].forEach((type) =>
    control.addEventListener(type, () => fieldError(form, key, control, null)),
  );
}

async function load() {
  const trip = await mockApi.getTrip(id);
  if (!trip) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }
  missing.hidden = true;
  body.hidden = false;
  renderStatusBanner(trip);
  render(trip);
}

await loadWithBanner(load, { banner, hide: [body, missing] });

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
  // Kit: earlier states plain, the last one toned — success/danger when the trip
  // ended, `active` while it is still running.
  qs('#timeline').items = trip.stateHistory.map((entry, index) => {
    const isLast = index === trip.stateHistory.length - 1;
    let tone = TERMINAL_TONE[entry.state] ?? 'default';
    if (isLast && !TERMINAL_TONE[entry.state] && isInProgress) tone = 'active';
    return {
      label: stateLabel(entry.state),
      meta: `${formatDate(entry.at)} · ${formatTime(entry.at)}`,
      note: entry.note ? t('tripDetail.reasonNote', { reason: noteText(entry.note) }) : null,
      tone,
    };
  });

  // ── Original estimate (#1671 S2) — incomplete trips only ──
  qs('#estimate-col').hidden = isCompleted;
  if (!isCompleted) {
    qs('#estimate').items = [
      { label: t('tripDetail.estimatedFare'), value: ltr(formatEgp(trip.estimate.fare)) },
      { label: t('tripDetail.estimatedTime'), value: formatDuration(trip.estimate.durationMin) },
      { label: t('tripDetail.estimatedDistance'), value: formatDistance(trip.estimate.distanceKm) },
      { label: t('tripDetail.destination'), value: trip.destination.area },
    ];
  }

  // ── Fare breakdown (#1672 S1) — completed only ──
  qs('#fare-section').hidden = !isCompleted;
  if (isCompleted) {
    const rows = qs('#fare-rows');
    rows.textContent = '';
    rows.append(
      listRow(t('tripDetail.baseFare'), formatEgp(trip.fare.baseFare), 'no-border'),
      listRow(t('tripDetail.distanceCharge'), formatEgp(trip.fare.distanceCharge), 'no-border'),
      listRow(t('tripDetail.timeCharge'), formatEgp(trip.fare.timeCharge)),
      listRow(
        t('tripDetail.totalFare'),
        formatEgp(trip.fare.total),
        'no-border danger-color text-bold detail__money-row--total',
      ),
      listRow(t('tripDetail.cashCollected'), formatEgp(trip.fare.cashCollected)),
    );
  }

  // ── Rating (#1672 S2/S3) — completed only ──
  qs('#rating-section').hidden = !isCompleted;
  if (isCompleted) {
    const host = qs('#rating-body');
    host.textContent = '';

    if (!trip.rating) {
      const none = document.createElement('p');
      none.className = 'ad-muted td-no-rating';
      none.textContent = t('tripDetail.noRating');
      host.appendChild(none);
    } else {
      const container = document.createElement('div');
      container.className = 'rating-container';

      const stars = document.createElement('div');
      stars.className = 'stars detail__stars';
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', t('tripDetail.starsAria', { stars: trip.rating.stars }));
      stars.textContent = '★'.repeat(trip.rating.stars) + '☆'.repeat(5 - trip.rating.stars);
      container.appendChild(stars);

      if (trip.rating.tags.length) {
        const tags = document.createElement('div');
        tags.className = 'feedback detail__tags';
        trip.rating.tags.forEach((tag) => {
          const chip = document.createElement('div');
          chip.className = 'item';
          chip.textContent = tag;
          tags.appendChild(chip);
        });
        container.appendChild(tags);
      }
      host.appendChild(container);
    }
  }

  // ── Intervention actions (#1671 S5) — in-progress only ──
  // #6210 — trip detail is View for every role, so the actions are not rendered.
  const canIntervene = isInProgress && can('trips.intervene');
  qs('#actions-section').hidden = !canIntervene;
  if (canIntervene) {
    qs('#intervention-hint').textContent = trip.driverId
      ? t('tripDetail.interventionHint')
      : t('tripDetail.interventionHintNoDriver');
    // Nothing to hand over until a driver has actually been matched.
    qs('#reassign-trip').disabled = !trip.driverId;
  }

  // ── Recorded cancellation, once it has happened ──
  qs('#cancellation-col').hidden = !trip.cancellation;
  if (trip.cancellation) {
    qs('#cancellation').items = [
      { label: t('common.reason'), value: reasonLabel(trip.cancellation.reason), wide: true },
      ...(trip.cancellation.note && trip.cancellation.note !== trip.cancellation.reason
        ? [{ label: t('common.note'), value: trip.cancellation.note, wide: true }]
        : []),
      { label: t('tripDetail.cancelledBy'), value: ltr(trip.cancellation.by) },
      { label: t('tripDetail.cancelledAt'), value: formatDateTime(trip.cancellation.at) },
    ];
  }

  // ── Recorded route (#1672 S4) — completed only ──
  if (isCompleted && trip.route) {
    mountRouteMap(trip);
  } else {
    qs('#route-section').hidden = true;
  }
}

// ── Status banner ─────────────────────────────────────
// A finished-but-not-completed trip says so up front, because the actions an
// admin would look for are gone.

function renderStatusBanner(trip) {
  if (trip.status === 'cancelled') {
    banner.show({
      tone: 'warning',
      heading: t('banner.tripCancelledHeading'),
      message: t('banner.tripCancelledMessage'),
    });
  } else if (trip.status === 'expired') {
    banner.show({
      tone: 'info',
      heading: t('banner.tripExpiredHeading'),
      message: t('banner.tripExpiredMessage', {
        reason: trip.expiryReason ? noteText(trip.expiryReason) : t('common.notAvailable'),
      }),
    });
  } else {
    banner.hide();
  }
}

// ── #1808 cancel an in-progress trip ──────────────────
// Reason form (default-modal) → final confirmation (popup-danger) → result
// (toast). "Back to review" returns to the form with its values intact.

const cancelForm = qs('#cancel-form', modals.cancel);
const cancelReason = qs('#cancel-reason', modals.cancel);
const cancelNote = qs('#cancel-note', modals.cancel);
const cancelConfirm = qs('#cancel-confirm', modals.cancelWarning);
const cancelBack = qs('#cancel-back', modals.cancelWarning);
let pendingCancel = null;

clearOnEdit(cancelForm, 'reason', cancelReason);
clearOnEdit(cancelForm, 'note', cancelNote);

qs('#cancel-trip').addEventListener('click', () => {
  fillReasonSelect(cancelReason, REASON_LISTS.tripCancellation);
  cancelNote.value = '';
  fieldError(cancelForm, 'reason', cancelReason, null);
  fieldError(cancelForm, 'note', cancelNote, null);
  pendingCancel = null;
  showModal(modals.cancel);
});

modals.cancel.addEventListener('shown.bs.modal', () => cancelReason.focus());

cancelForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const invalid = validateReasonNote(cancelForm, cancelReason, cancelNote, 'tripDetail.cancelReasonEmpty');
  if (invalid) {
    invalid.focus();
    return;
  }
  pendingCancel = { reason: cancelReason.value, note: cancelNote.value.trim() };
  setFormError(modals.cancelWarning, null);
  await hideModal(modals.cancel);
  showModal(modals.cancelWarning);
});

cancelBack.addEventListener('click', async () => {
  await hideModal(modals.cancelWarning);
  showModal(modals.cancel);
});

cancelConfirm.addEventListener('click', async () => {
  if (!pendingCancel) return;
  cancelConfirm.disabled = true;
  cancelBack.disabled = true;
  try {
    await mockApi.cancelTrip(id, pendingCancel.reason, pendingCancel.note);
    pendingCancel = null;
    await hideModal(modals.cancelWarning);
    await load();
    showSuccess(t('kitDetails.cancelledTitle'), t('kitDetails.cancelledBody'));
  } catch (error) {
    setFormError(modals.cancelWarning, error?.message ?? t('modal.saveFailed'));
  } finally {
    cancelConfirm.disabled = false;
    cancelBack.disabled = false;
  }
});

// ── #1809 reassign to another driver ──────────────────

const reassignForm = qs('#reassign-form', modals.reassign);
const reassignDriver = qs('#reassign-driver', modals.reassign);
const reassignReason = qs('#reassign-reason', modals.reassign);
const reassignNote = qs('#reassign-note', modals.reassign);
const reassignSubmit = modals.reassign.querySelector('button[type="submit"]');

clearOnEdit(reassignForm, 'driverId', reassignDriver);
clearOnEdit(reassignForm, 'reason', reassignReason);
clearOnEdit(reassignForm, 'note', reassignNote);

qs('#reassign-trip').addEventListener('click', async () => {
  const candidates = await mockApi.listReassignableDrivers(id);

  // Nothing to reassign to is a real operational state, not an error.
  if (!candidates.length) {
    showModal(modals.noDriver);
    return;
  }

  // #4382: searchable on name or phone — dispatch is reassigning a live trip and
  // is usually already on the phone to the driver she wants.
  reassignDriver.placeholder = t('tripDetail.newDriverPlaceholder');
  reassignDriver.options = candidates.map((d) => ({
    value: String(d.id),
    label: d.name,
    meta: d.phone,
    note: `${d.vehicle}${d.rating ? ` · ${d.rating}★` : ''} · ${d.homeArea}`,
  }));
  reassignDriver.value = '';
  fillReasonSelect(reassignReason, REASON_LISTS.tripReassignment);
  reassignNote.value = '';
  ['driverId', 'reason', 'note'].forEach((key) =>
    fieldError(reassignForm, key, { driverId: reassignDriver, reason: reassignReason, note: reassignNote }[key], null),
  );
  setFormError(modals.reassign, null);
  showModal(modals.reassign);
});

modals.reassign.addEventListener('shown.bs.modal', () => reassignDriver.focus());

reassignForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  let invalid = null;
  if (!reassignDriver.value) {
    fieldError(reassignForm, 'driverId', reassignDriver, t('tripDetail.newDriverEmpty'));
    invalid = reassignDriver;
  } else {
    fieldError(reassignForm, 'driverId', reassignDriver, null);
  }
  invalid = validateReasonNote(reassignForm, reassignReason, reassignNote, 'tripDetail.reassignReasonEmpty') ?? invalid;
  if (!reassignDriver.value) invalid = reassignDriver;
  if (invalid) {
    invalid.focus();
    return;
  }

  setFormError(modals.reassign, null);
  reassignSubmit.disabled = true;
  try {
    const result = await mockApi.reassignTrip(
      id,
      reassignDriver.value,
      reassignReason.value,
      reassignNote.value.trim(),
    );
    await hideModal(modals.reassign);
    await load();
    showSuccess(t('kitDetails.reassignedTitle'), t('kitDetails.reassignedBody', { name: result.driverName }));
  } catch (error) {
    setFormError(modals.reassign, error?.message ?? t('modal.saveFailed'));
  } finally {
    reassignSubmit.disabled = false;
  }
});

async function mountRouteMap(trip) {
  const section = qs('#route-section');
  section.hidden = false;

  qs('#route-summary').textContent = t('tripDetail.routeSummary', {
    distance: formatDistance(trip.fare.actualDistanceKm),
    duration: formatDuration(trip.fare.actualDurationMin),
  });

  const panel = qs('#route-map');
  if (panel.dataset.mounted) return;
  panel.dataset.mounted = '1';
  // The map must never block the rest of the screen, so this runs last and
  // handles an unavailable map with a visible message.
  const map = await panel.mount({ center: trip.pickup.point, zoom: 12 });
  if (!map) return;
  panel.setRoute(trip.route);
}
