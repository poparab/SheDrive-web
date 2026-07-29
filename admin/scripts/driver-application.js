/**
 * driver-application.js — SheDrive admin full driver application
 * #1658 all submitted details with the four documents inline, #1659 approve,
 * #1660 reject with a reason from the predefined list.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { REASON_LISTS } from './seed.js';
import { formatDate, formatDateTime, formatElapsed, formatPhone, maskNid } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const modal = qs('#decision-modal');
const body = qs('#app-body');
const missing = qs('#app-missing');
const approveBtn = qs('#approve-btn');
const rejectBtn = qs('#reject-btn');

const id = new URLSearchParams(window.location.search).get('id');

/** Licence or registration already expired is decision-relevant, so flag it. */
function expiryValue(timestamp) {
  const expired = timestamp < Date.now();
  const span = document.createElement('span');
  span.textContent = formatDate(timestamp);
  if (expired) {
    span.className = 'list__expired';
    span.textContent += ' — expired';
  }
  return span;
}

async function load() {
  const application = await mockApi.getApplication(id);

  // #1658 Scenario 3 — unknown or already-reviewed application.
  if (!application) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  qs('#personal').items = [
    { label: 'Full name', value: application.name },
    { label: 'Phone number', value: formatPhone(application.phone) },
    { label: 'Date of birth', value: formatDate(application.dob) },
    { label: 'National ID', value: maskNid(application.nid) },
  ];

  qs('#vehicle').items = [
    { label: 'Make', value: application.vehicle.make },
    { label: 'Model', value: application.vehicle.model },
    { label: 'Year', value: application.vehicle.year },
    { label: 'Plate number', value: application.vehicle.plate },
    { label: 'Colour', value: application.vehicle.colour },
    { label: 'Type', value: application.vehicle.type },
  ];

  qs('#licence').items = [
    { label: 'Driving licence number', value: application.licenceNumber },
    { label: 'Licence expiry', value: expiryValue(application.licenceExpiry) },
    { label: 'Registration expiry', value: expiryValue(application.registrationExpiry) },
  ];

  qs('#docs').docs = application.documents.map((doc) => ({
    label: doc.label,
    src: doc.src,
    ref: doc.ref,
    meta: `Uploaded ${formatDate(doc.uploadedAt)}`,
  }));

  qs('#photos').docs = [
    { label: 'Vehicle photo', src: application.vehiclePhoto },
    { label: 'Profile photo', src: application.profilePhoto },
  ];

  const status = document.createElement('ad-status-pill');
  status.status = application.status;

  qs('#summary').items = [
    { label: 'Status', value: status },
    { label: 'Submitted', value: formatDateTime(application.submittedAt) },
    { label: 'Waiting', value: formatElapsed(application.submittedAt) },
    { label: 'Home area', value: application.homeArea },
  ];

  return application;
}

// ── #1659 approve ─────────────────────────────────────

approveBtn.addEventListener('click', () => {
  modal.open({
    title: 'Approve this application?',
    description:
      'The driver is notified and can go online immediately. This is recorded in the audit log.',
    confirmLabel: 'Approve application',
    fields: [],
    onConfirm: async () => {
      await mockApi.approveApplication(id);
      shell.showToast('Application approved. The driver can now go online.', 'success');
      window.location.href = 'driver-applications.html';
    },
  });
});

// ── #1660 reject with reason ──────────────────────────

rejectBtn.addEventListener('click', () => {
  modal.open({
    title: 'Reject this application',
    description: 'The driver is notified with the reason you select.',
    confirmLabel: 'Reject application',
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: 'Rejection reason',
        required: true,
        options: REASON_LISTS.rejection.map((reason) => ({ value: reason, label: reason })),
        emptyError: 'Select a rejection reason',
      },
      {
        key: 'note',
        type: 'textarea',
        label: 'Note to the driver',
        maxLength: 500,
        hint: 'Optional unless the reason needs explaining.',
        lengthError: 'Too long — must be ≤ 500 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.rejectApplication(id, values.reason);
      shell.showToast('Application rejected. The driver has been notified.', 'success');
      window.location.href = 'driver-applications.html';
    },
  });
});

await load();
