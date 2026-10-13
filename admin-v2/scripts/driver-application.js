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
import { withKitArt, kitVehiclePhotos } from './doc-images.js';
import { t, hasKey } from './admin-i18n.js';

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
    span.textContent += t('field.expiredSuffix');
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
    { label: t('field.fullName'), value: application.name },
    { label: t('common.phone'), value: formatPhone(application.phone), ltr: true },
    { label: t('field.dob'), value: formatDate(application.dob) },
    { label: t('field.nid'), value: maskNid(application.nid), ltr: true },
  ];

  qs('#vehicle').items = [
    { label: t('field.make'), value: application.vehicle.make },
    { label: t('field.model'), value: application.vehicle.model },
    { label: t('field.year'), value: application.vehicle.year },
    { label: t('field.plate'), value: application.vehicle.plate, ltr: true },
    { label: t('field.colour'), value: application.vehicle.colour },
    { label: t('field.type'), value: application.vehicle.type },
  ];

  qs('#licence').items = [
    { label: t('field.licenceNumber'), value: application.licenceNumber },
    { label: t('field.licenceExpiry'), value: expiryValue(application.licenceExpiry) },
    { label: t('field.registrationExpiry'), value: expiryValue(application.registrationExpiry) },
  ];

  renderPayoutMethod(application);

  // Kit artwork stands in for the seed's flat placeholders (presentation only).
  qs('#docs').docs = withKitArt(
    application.documents.map((doc) => ({
      // The seed is the frozen data layer, so the label is translated here.
      label: hasKey(`docs.${doc.key}`) ? t(`docs.${doc.key}`) : doc.label,
      src: doc.src,
      ref: doc.ref,
      meta: `Uploaded ${formatDate(doc.uploadedAt)}`,
    })),
  );

  qs('#photos').docs = [
    ...withKitArt([{ label: t('docs.profilePhoto'), src: application.profilePhoto }]),
    ...kitVehiclePhotos(`Submitted ${formatDate(application.submittedAt)}`),
  ];

  const status = document.createElement('ad-status-pill');
  status.status = application.status;

  qs('#summary').items = [
    { label: t('common.status'), value: status },
    { label: t('field.submitted'), value: formatDateTime(application.submittedAt) },
    { label: t('application.waiting'), value: formatElapsed(application.submittedAt) },
    { label: t('field.homeArea'), value: application.homeArea },
  ];

  return application;
}

// ── Payout method (2026-10-14 spec §2) — read-only, number masked ──

const maskNumber = (number) => (number ? `•••• ${String(number).slice(-4)}` : '—');

function renderPayoutMethod(application) {
  const section = qs('#payout');
  section.setAttribute('hint', t('driverPayout.applicationHint'));
  const method = application.payoutMethod;
  if (!method) {
    section.items = [{ label: t('driverPayout.type'), value: t('driverPayout.none'), muted: true, wide: true }];
    return;
  }
  const items = [{ label: t('driverPayout.type'), value: t(`driverPayout.type${method.type}`) }];
  if (method.type === 'MOBILE_WALLET') {
    items.push({ label: t('driverPayout.walletProvider'), value: method.provider, ltr: true });
  } else if (method.type === 'BANK_ACCOUNT') {
    items.push({ label: t('driverPayout.bank'), value: method.provider, ltr: true });
  }
  const isCard = method.type === 'PREPAID_CARD';
  items.push(
    { label: isCard ? t('driverPayout.cardName') : t('driverPayout.holderName'), value: method.holderName },
    {
      label: {
        MOBILE_WALLET: t('driverPayout.walletNumber'),
        BANK_ACCOUNT: t('driverPayout.accountNumber'),
        PREPAID_CARD: t('driverPayout.cardNumber'),
      }[method.type],
      value: maskNumber(method.number),
      ltr: true,
    },
  );
  section.items = items;
}

// ── #1659 approve ─────────────────────────────────────

approveBtn.addEventListener('click', () => {
  modal.open({
    title: t('application.approveTitle'),
    description:
      t('application.approveDescription'),
    confirmLabel: t('application.approveBtn'),
    fields: [],
    onConfirm: async () => {
      await mockApi.approveApplication(id);
      shell.showToast(t('application.toastApproved'), 'success');
      window.location.href = 'driver-applications.html';
    },
  });
});

// ── #1660 reject with reason ──────────────────────────

rejectBtn.addEventListener('click', () => {
  modal.open({
    title: t('application.rejectTitle'),
    description: t('application.rejectDescription'),
    confirmLabel: t('application.rejectBtn'),
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'select',
        label: t('driverProfile.rejectionReason'),
        required: true,
        options: REASON_LISTS.rejection.map((reason) => ({ value: reason, label: reason })),
        emptyError: t('application.rejectReasonEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('application.rejectNoteLabel'),
        maxLength: 500,
        hint: t('application.rejectNoteHint'),
        lengthError: t('driverProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.rejectApplication(id, values.reason);
      shell.showToast(t('application.toastRejected'), 'success');
      window.location.href = 'driver-applications.html';
    },
  });
});

await load();
