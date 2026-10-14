/**
 * sos-request.js — SheDrive admin SOS case detail and resolution
 *
 * Everything an admin needs to decide what happened, then close the case one of
 * four ways. Either party, both, or neither may be suspended in the same action;
 * a suspension always wins the recorded outcome, because "resolved" would
 * understate what was actually done.
 *
 * Suspension goes through the same mutation a manual one uses, so it lands on
 * the person's profile and in the audit log identically however it was raised.
 * A closed case is never reopened — the action row disappears for good.
 *
 * Presentation (kit v22-09 sos-request-details): standing alerts under the title,
 * a card grid (Case, Trip, Rider, Driver, Location, Contacts alerted), and a
 * full-width Resolution card whose two buttons open the kit's `default-modal`
 * (retitled by what is being recorded), followed by a `popup-success`.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { formatDateTime, formatPhone } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, isRtl, applyAdminTranslations } from './admin-i18n.js';
import { loadBootstrap } from './design-init.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const body = qs('#case-body');
const missing = qs('#case-missing');
const fieldset = qs('#suspend-fieldset');
const suspendRider = qs('#suspend-rider');
const suspendDriver = qs('#suspend-driver');
const actionsRow = qs('#resolve-actions');
const resolvedBtn = qs('#close-resolved-btn');
const falseBtn = qs('#close-false-btn');
const resolveHint = qs('#resolve-hint');

const closeModal = qs('#close-modal');
const successModal = qs('#success-modal');
const NOTE_MAX = 500;

// Modals live on <body> so no positioned ancestor inside the shell can trap them.
[closeModal, successModal].forEach((el) => {
  document.body.appendChild(el);
  applyAdminTranslations(el);
});

const closeForm = qs('#close-form', closeModal);
const closeNote = qs('#close-note', closeModal);
const closeNoteError = qs('#close-note-error', closeModal);
const closeSubmit = qs('#close-submit', closeModal);
const closeError = qs('.sos-form-error', closeModal);

const id = new URLSearchParams(window.location.search).get('id');

/** Kit link: label plus a chevron that points the reading direction. */
function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'link list__link';
  a.append(text);
  const icon = document.createElement('i');
  icon.className = `fa-solid ${isRtl() ? 'fa-angle-left' : 'fa-angle-right'}`;
  icon.setAttribute('aria-hidden', 'true');
  a.appendChild(icon);
  return a;
}

function ltr(text) {
  const span = document.createElement('span');
  span.className = 'ad-ltr';
  span.textContent = text;
  return span;
}

function pill(status) {
  const el = document.createElement('ad-status-pill');
  el.status = status;
  return el;
}

/** Kit key/value row for the static cards. */
function listRow(label, value) {
  const row = document.createElement('div');
  row.className = 'row gx-0 list-row';
  const key = document.createElement('div');
  key.className = 'list-item col text-bold';
  key.textContent = label;
  const val = document.createElement('div');
  val.className = 'list-item col-auto justify-content-md-end';
  if (value instanceof Node) val.appendChild(value);
  else val.textContent = value ?? t('common.notAvailable');
  row.append(key, val);
  return row;
}

/** Which occupant tapped the button — the first thing to read on this screen. */
function raiserLabel(sosCase) {
  return sosCase.raisedBy === 'driver' ? t('sos.driver') : t('sos.rider');
}

function localizeSections() {
  const titles = {
    '#case-meta': 'sosCase.caseMeta',
    '#trip-facts': 'sosCase.tripHeading',
    '#rider-facts': 'sosCase.riderHeading',
    '#driver-facts': 'sosCase.driverHeading',
  };
  Object.entries(titles).forEach(([selector, key]) => {
    qs(selector)?.setAttribute('section-title', t(key));
  });
  const state = qs('#case-missing ad-empty-state');
  if (state) {
    state.setAttribute('heading', t('sosCase.notFoundHeading'));
    state.setAttribute('message', t('sosCase.notFoundMessage'));
  }
}

localizeSections();

async function load() {
  const sosCase = await mockApi.getSosCase(id);

  if (!sosCase) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  renderMeta(sosCase);

  // Trip card — the kit adds the trip's own status and creation time.
  qs('#trip-facts').items = sosCase.trip
    ? [
        { label: t('sosCase.tripId'), value: link(`trip-detail.html?id=${sosCase.tripId}`, ltr(sosCase.tripId)) },
        { label: t('common.status'), value: pill(sosCase.trip.status) },
        { label: t('tripDetail.created'), value: formatDateTime(sosCase.trip.createdAt) },
        { label: t('sosCase.pickup'), value: sosCase.pickupAddress, wide: true },
        { label: t('sosCase.destination'), value: sosCase.destinationAddress, wide: true },
        { label: t('sosCase.zone'), value: sosCase.zoneName },
      ]
    : [{ label: t('sosCase.tripUnavailableLabel'), value: t('sosCase.tripUnavailable'), muted: true }];

  qs('#rider-facts').items = [
    {
      label: t('tripDetail.rider'),
      value: sosCase.rider
        ? link(`rider-profile.html?id=${sosCase.riderId}`, sosCase.riderName)
        : sosCase.riderName,
    },
    { label: t('sosCase.accountStatus'), value: pill(sosCase.rider?.status ?? 'active') },
    { label: t('sosCase.phone'), value: ltr(formatPhone(sosCase.riderPhone)) },
  ];

  // Driver card carries the vehicle facts, as the kit draws it.
  qs('#driver-facts').items = [
    {
      label: t('tripDetail.driver'),
      value: sosCase.driver
        ? link(`driver-profile.html?id=${sosCase.driverId}`, sosCase.driverName)
        : sosCase.driverName,
    },
    { label: t('sosCase.accountStatus'), value: pill(sosCase.driver?.status ?? 'approved') },
    { label: t('sosCase.phone'), value: ltr(formatPhone(sosCase.driverPhone)) },
    ...(sosCase.vehicle
      ? [
          { label: t('sosCase.vehicleHeading'), value: `${sosCase.vehicle.make} ${sosCase.vehicle.model}` },
          { label: t('sosCase.plate'), value: ltr(sosCase.vehicle.plate) },
        ]
      : [{ label: t('sosCase.vehicleHeading'), value: t('sosCase.vehicleUnavailable'), muted: true }]),
  ];

  const location = qs('#location-rows');
  location.replaceChildren(
    listRow(t('sosCase.address'), sosCase.location.address),
    listRow(
      t('sosCase.coordinates'),
      ltr(`${sosCase.location.lat.toFixed(5)}, ${sosCase.location.lng.toFixed(5)}`),
    ),
  );

  renderContacts(sosCase);
  renderActions(sosCase);
  mountLocationMap(sosCase);
}

/** One nested kit card per contact, tinted by what the gateway reported. */
function renderContacts(sosCase) {
  const list = qs('#contact-list');
  const empty = qs('#contacts-empty');
  list.replaceChildren();

  const contacts = sosCase.contactsAlerted ?? [];
  empty.hidden = contacts.length > 0;
  list.hidden = contacts.length === 0;
  qs('#contacts-count').textContent = contacts.length
    ? contacts.length === 1
      ? t('kitDetails.contactsOne')
      : t('kitDetails.contactsMany', { count: contacts.length })
    : '';

  contacts.forEach((contact) => {
    const delivered = contact.delivery === 'delivered';
    const tone = delivered ? 'success' : 'danger';

    const card = document.createElement('div');
    card.className = `standard-card ${tone}-alert-bg ${tone}-alert-br sos-contact`;

    const header = document.createElement('div');
    header.className = 'card-header mb-0';
    const title = document.createElement('div');
    title.className = 'card-title';
    const icon = document.createElement('img');
    icon.className = 'icon';
    icon.src = `vendor/icons/${delivered ? 'user-active' : 'user-slash'}.svg`;
    icon.alt = '';
    const name = document.createElement('h5');
    name.className = 'sos-contact__name';
    name.textContent = contact.name;
    const rel = document.createElement('span');
    rel.className = 'tertiary-color sos-contact__rel';
    rel.textContent = contact.relationship;
    title.append(icon, name, document.createTextNode(' • '), rel);
    header.appendChild(title);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body m-0';
    const listWrap = document.createElement('div');
    listWrap.className = 'list-multi-column no-border p-0';
    const row = document.createElement('div');
    row.className = 'row gx-4';
    const col = document.createElement('div');
    col.className = 'col';

    const phone = ltr(formatPhone(contact.phone));
    phone.classList.add('sos-contact__phone');

    const state = document.createElement('div');
    state.className = `${delivered ? 'status-approved' : 'status-rejected'} sos-contact__state sos-contact__state--${delivered ? 'ok' : 'failed'}`;
    const stateIcon = document.createElement('div');
    stateIcon.className = 'icon';
    stateIcon.innerHTML = `<i class="fa-solid ${delivered ? 'fa-check' : 'fa-xmark'}" aria-hidden="true"></i>`;
    state.append(stateIcon, delivered ? t('sosCase.delivered') : t('sosCase.failed'));

    col.append(listRow(t('sosCase.phone'), phone), listRow(t('common.status'), state));
    row.appendChild(col);
    listWrap.appendChild(row);
    cardBody.appendChild(listWrap);
    card.append(header, cardBody);
    list.appendChild(card);
  });
}

function renderMeta(sosCase) {
  const raiserName = sosCase.raisedBy === 'driver' ? sosCase.driverName : sosCase.riderName;
  const items = [
    { label: t('sosCase.caseId'), value: ltr(sosCase.id) },
    {
      label: t('sos.statusLabel'),
      value: pill(sosCase.status === 'closed' && sosCase.outcome ? sosCase.outcome : sosCase.status),
    },
    { label: t('sosCase.raisedAt'), value: formatDateTime(sosCase.raisedAt) },
    { label: t('sosCase.raisedBy'), value: `${raiserLabel(sosCase)} — ${raiserName}` },
    { label: t('sosCase.tripState'), value: statusLabel(sosCase.tripStateAtTrigger) },
    { label: t('sosCase.linkExpires'), value: formatDateTime(sosCase.liveLinkExpiresAt) },
  ];

  if (sosCase.note) {
    items.push({ label: t('sosCase.note'), value: sosCase.note, wide: true });
  }

  if (sosCase.status === 'closed') {
    items.push(
      { label: t('sosCase.outcome'), value: statusLabel(sosCase.outcome) },
      { label: t('sosCase.closedAt'), value: formatDateTime(sosCase.closedAt) },
      { label: t('sosCase.closedBy'), value: sosCase.closedBy },
    );
    if (sosCase.resolutionNote) {
      items.push({ label: t('sosCase.resolutionNote'), value: sosCase.resolutionNote, wide: true });
    }
  }

  qs('#case-meta').items = items;
}

function renderActions(sosCase) {
  const open = sosCase.status === 'open';

  fieldset.hidden = !open;
  actionsRow.hidden = !open;
  resolveHint.textContent = open ? t('sosCase.hintOpen') : t('sosCase.hintClosed');

  if (!open) return;

  // A party already suspended for another reason cannot be suspended again.
  if (sosCase.rider?.status === 'suspended') {
    suspendRider.checked = false;
    suspendRider.disabled = true;
  }
  if (sosCase.driver?.status === 'suspended') {
    suspendDriver.checked = false;
    suspendDriver.disabled = true;
  }
}

/** Summarise the account effect in the words the admin is confirming. */
function suspensionSummary() {
  const rider = suspendRider.checked;
  const driver = suspendDriver.checked;
  if (rider && driver) return t('sosCase.summaryBoth');
  if (rider) return t('sosCase.summaryRider');
  if (driver) return t('sosCase.summaryDriver');
  return t('sosCase.summaryNone');
}

// ── Modal plumbing ───────────────────────────────────

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
    if (instance._isTransitioning) el.addEventListener('shown.bs.modal', hide, { once: true });
    else hide();
    window.setTimeout(finish, 1500);
  });
}

function setNoteError(message) {
  closeNoteError.textContent = message ?? '';
  closeNoteError.classList.toggle('d-block', Boolean(message));
  closeNote.classList.toggle('is-invalid', Boolean(message));
  if (message) closeNote.setAttribute('aria-invalid', 'true');
  else closeNote.removeAttribute('aria-invalid');
}

function setFormError(message) {
  closeError.hidden = !message;
  closeError.querySelector('p').textContent = message ?? '';
}

closeNote.addEventListener('input', () => setNoteError(null));

let pendingOutcome = null;

function confirmClose(outcome) {
  pendingOutcome = outcome;
  const suspending = suspendRider.checked || suspendDriver.checked;

  const titleKey = suspending
    ? 'kitDetails.suspendCloseTitle'
    : outcome === 'false_alarm'
      ? 'kitDetails.falseAlarmTitle'
      : 'sosCase.confirmTitle';
  qs('#close-modal-title', closeModal).textContent = t(titleKey);
  qs('#close-modal-icon', closeModal).src = `vendor/icons/${suspending ? 'stop-women' : 'checked-women'}.svg`;
  qs('#close-effect', closeModal).textContent = suspensionSummary();

  closeSubmit.className = `btn ${suspending ? 'btn-danger' : 'btn-success'}`;
  closeSubmit.querySelector('i').className = `fa-solid ${
    suspending ? 'fa-pause' : outcome === 'false_alarm' ? 'fa-bell-slash' : 'fa-check'
  }`;
  qs('#close-submit-label', closeModal).textContent = suspending
    ? t('kitDetails.suspendCloseBtn')
    : t('sosCase.confirmBtn');

  closeNote.value = '';
  setNoteError(null);
  setFormError(null);
  showModal(closeModal);
}

closeModal.addEventListener('shown.bs.modal', () => closeNote.focus());

closeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const note = closeNote.value.trim();
  // Closing is final and may suspend an account, so the reason is never
  // optional here — unlike the gender-mismatch note, where the report itself is
  // already the record.
  if (!note) {
    setNoteError(t('sosCase.noteRequired'));
    closeNote.focus();
    return;
  }
  if (note.length > NOTE_MAX) {
    setNoteError(t('sosCase.noteTooLong'));
    closeNote.focus();
    return;
  }

  closeSubmit.disabled = true;
  try {
    await mockApi.actionSosCase(id, {
      suspendRider: suspendRider.checked,
      suspendDriver: suspendDriver.checked,
      outcome: pendingOutcome,
      note,
    });
    await hideModal(closeModal);
    shell.refreshNavCounts();
    await load();
    showModal(successModal);
  } catch (error) {
    setFormError(error?.message ?? t('modal.saveFailed'));
  } finally {
    closeSubmit.disabled = false;
  }
});

resolvedBtn.addEventListener('click', () => confirmClose('resolved'));
falseBtn.addEventListener('click', () => confirmClose('false_alarm'));

async function mountLocationMap(sosCase) {
  const panel = qs('#case-map');
  if (panel.dataset.mounted) return;
  panel.dataset.mounted = '1';
  // The map runs last and degrades to its own message: a missing map must never
  // hold up the facts an admin needs to act.
  const map = await panel.mount({ center: [sosCase.location.lng, sosCase.location.lat], zoom: 13 });
  if (!map) return;
  panel.setMarkers([
    { id: sosCase.id, kind: 'request', position: [sosCase.location.lng, sosCase.location.lat] },
  ]);
}

await load();
