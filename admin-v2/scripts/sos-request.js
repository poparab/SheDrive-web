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
 * A closed case is never reopened — the action rail disappears for good.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { statusLabel } from '../components/ad-status-pill.js';
import { formatDateTime, formatPhone } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const modal = qs('#close-modal');
const body = qs('#case-body');
const missing = qs('#case-missing');
const fieldset = qs('#suspend-fieldset');
const suspendRider = qs('#suspend-rider');
const suspendDriver = qs('#suspend-driver');
const resolvedBtn = qs('#close-resolved-btn');
const falseBtn = qs('#close-false-btn');
const resolveHint = qs('#resolve-hint');

const id = new URLSearchParams(window.location.search).get('id');

function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'list__link';
  a.textContent = text;
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

/** Which occupant tapped the button — the first thing to read on this screen. */
function raiserLabel(sosCase) {
  return sosCase.raisedBy === 'driver' ? t('sos.driver') : t('sos.rider');
}

async function load() {
  const sosCase = await mockApi.getSosCase(id);

  if (!sosCase) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  const raiser = qs('#raiser-pill');
  raiser.className = `sos-raiser__pill sos-raiser__pill--${sosCase.raisedBy}`;
  raiser.textContent = raiserLabel(sosCase);

  qs('#case-note').textContent = sosCase.note;

  qs('#incident-facts').items = [
    { label: t('sosCase.raisedBy'), value: `${raiserLabel(sosCase)} — ${sosCase.raisedBy === 'driver' ? sosCase.driverName : sosCase.riderName}` },
    { label: t('sosCase.raisedAt'), value: formatDateTime(sosCase.raisedAt) },
    { label: t('sosCase.tripState'), value: statusLabel(sosCase.tripStateAtTrigger) },
    { label: t('sosCase.linkExpires'), value: formatDateTime(sosCase.liveLinkExpiresAt) },
  ];

  qs('#location-facts').items = [
    { label: t('sosCase.address'), value: sosCase.location.address, wide: true },
    {
      label: t('sosCase.coordinates'),
      value: ltr(`${sosCase.location.lat.toFixed(5)}, ${sosCase.location.lng.toFixed(5)}`),
    },
  ];

  qs('#rider-facts').items = [
    {
      label: t('sosCase.riderHeading'),
      value: sosCase.rider
        ? link(`rider-profile.html?id=${sosCase.riderId}`, t('sosCase.openLink', { value: sosCase.riderName }))
        : sosCase.riderName,
    },
    { label: t('sosCase.phone'), value: ltr(formatPhone(sosCase.riderPhone)) },
    { label: t('sosCase.accountStatus'), value: pill(sosCase.rider?.status ?? 'active') },
  ];

  qs('#driver-facts').items = [
    {
      label: t('sosCase.driverHeading'),
      value: sosCase.driver
        ? link(`driver-profile.html?id=${sosCase.driverId}`, t('sosCase.openLink', { value: sosCase.driverName }))
        : sosCase.driverName,
    },
    { label: t('sosCase.phone'), value: ltr(formatPhone(sosCase.driverPhone)) },
    { label: t('sosCase.accountStatus'), value: pill(sosCase.driver?.status ?? 'approved') },
  ];

  qs('#vehicle-facts').items = sosCase.vehicle
    ? [
        { label: t('sosCase.vehicleHeading'), value: `${sosCase.vehicle.make} ${sosCase.vehicle.model}` },
        { label: t('sosCase.plate'), value: ltr(sosCase.vehicle.plate) },
      ]
    : [{ label: t('sosCase.vehicleHeading'), value: t('sosCase.vehicleUnavailable'), muted: true }];

  qs('#trip-facts').items = sosCase.trip
    ? [
        { label: t('sosCase.tripId'), value: link(`trip-detail.html?id=${sosCase.tripId}`, t('sosCase.openLink', { value: sosCase.tripId })) },
        { label: t('sosCase.pickup'), value: sosCase.pickupAddress, wide: true },
        { label: t('sosCase.destination'), value: sosCase.destinationAddress, wide: true },
        { label: t('sosCase.zone'), value: sosCase.zoneName },
      ]
    : [{ label: t('sosCase.tripUnavailableLabel'), value: t('sosCase.tripUnavailable'), muted: true }];

  renderContacts(sosCase);
  renderMeta(sosCase);
  renderActions(sosCase);
  mountLocationMap(sosCase);
}

/** One row per contact, carrying what the gateway actually reported. */
function renderContacts(sosCase) {
  const list = qs('#contact-list');
  const empty = qs('#contacts-empty');
  list.replaceChildren();

  const contacts = sosCase.contactsAlerted ?? [];
  empty.hidden = contacts.length > 0;
  list.hidden = contacts.length === 0;

  contacts.forEach((contact) => {
    const li = document.createElement('li');
    li.className = 'sos-contact';

    const who = document.createElement('div');
    who.className = 'sos-contact__who';
    const name = document.createElement('span');
    name.className = 'sos-contact__name';
    name.textContent = contact.name;
    const rel = document.createElement('span');
    rel.className = 'sos-contact__rel';
    rel.textContent = contact.relationship;
    who.append(name, rel);

    const phone = ltr(formatPhone(contact.phone));
    phone.classList.add('sos-contact__phone');

    const delivered = contact.delivery === 'delivered';
    const state = document.createElement('span');
    state.className = `sos-contact__state sos-contact__state--${delivered ? 'ok' : 'failed'}`;
    state.textContent = delivered ? t('sosCase.delivered') : t('sosCase.failed');

    li.append(who, phone, state);
    list.appendChild(li);
  });
}

function renderMeta(sosCase) {
  const items = [
    { label: t('sosCase.caseId'), value: ltr(sosCase.id) },
    { label: t('sos.statusLabel'), value: pill(sosCase.status === 'closed' && sosCase.outcome ? sosCase.outcome : sosCase.status) },
    { label: t('sosCase.raisedAt'), value: formatDateTime(sosCase.raisedAt) },
  ];

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
  resolvedBtn.hidden = !open;
  falseBtn.hidden = !open;
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

function confirmClose(outcome) {
  modal.open({
    title: t('sosCase.confirmTitle'),
    description: t('sosCase.confirmDescription'),
    confirmLabel: t('sosCase.confirmBtn'),
    danger: suspendRider.checked || suspendDriver.checked,
    fields: [
      { key: 'effect', type: 'readonly', label: t('sosCase.outcome'), value: suspensionSummary() },
      {
        key: 'note',
        type: 'textarea',
        label: t('sosCase.noteLabel'),
        // Closing is final and may suspend an account, so the reason is never
        // optional here — unlike the gender-mismatch note, where the report
        // itself is already the record.
        required: true,
        maxLength: 500,
        hint: t('sosCase.noteHint'),
        emptyError: t('sosCase.noteRequired'),
        lengthError: t('sosCase.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.actionSosCase(id, {
        suspendRider: suspendRider.checked,
        suspendDriver: suspendDriver.checked,
        outcome,
        note: values.note,
      });
      shell.showToast(t('sosCase.toastClosed'), 'success');
      await load();
    },
  });
}

resolvedBtn.addEventListener('click', () => confirmClose('resolved'));
falseBtn.addEventListener('click', () => confirmClose('false_alarm'));

async function mountLocationMap(sosCase) {
  const panel = qs('#case-map');
  // The map runs last and degrades to its own message: a missing map must never
  // hold up the facts an admin needs to act.
  const map = await panel.mount({ center: [sosCase.location.lng, sosCase.location.lat], zoom: 13 });
  if (!map) return;
  panel.setMarkers([
    { id: sosCase.id, kind: 'request', position: [sosCase.location.lng, sosCase.location.lat] },
  ]);
}

await load();
