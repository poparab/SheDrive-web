/**
 * safety-report.js — SheDrive admin gender-mismatch report detail & resolution
 * #1810 S3 trip snapshot + driver statement + rider account state;
 * #1811 resolve by suspending the reported rider or dismissing the report.
 *
 * The suspension note is optional: the report itself is the recorded reason
 * (#1811 S3). A report already resolved exposes no action controls (#1811 S4).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { formatDateTime, formatEgp, formatPhone, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const modal = qs('#resolve-modal');
const body = qs('#report-body');
const missing = qs('#report-missing');
const suspendBtn = qs('#suspend-btn');
const dismissBtn = qs('#dismiss-btn');
const resolveHint = qs('#resolve-hint');

const id = new URLSearchParams(window.location.search).get('id');

function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'list__link';
  a.textContent = text;
  return a;
}

async function load() {
  const report = await mockApi.getSafetyReport(id);

  if (!report) {
    missing.hidden = false;
    body.hidden = true;
    return;
  }

  missing.hidden = true;
  body.hidden = false;

  qs('#statement').textContent = report.statement;

  const trip = report.trip;
  qs('#trip-snapshot').items = trip
    ? [
        { label: t('safetyReport.tripId'), value: link(`trip-detail.html?id=${trip.id}`, `${trip.id} →`) },
        { label: t('safetyReport.pickup'), value: trip.pickup.address, wide: true },
        { label: t('safetyReport.destination'), value: trip.destination.address, wide: true },
        { label: t('safetyReport.estimatedFare'), value: formatEgp(trip.estimate.fare) },
        { label: t('safetyReport.zone'), value: trip.zoneName },
        { label: t('safetyReport.expiryReason'), value: humanize(trip.expiryReason) },
      ]
    : [{ label: t('safetyReport.tripUnavailableLabel'), value: t('safetyReport.tripUnavailable'), muted: true }];

  const riderPill = document.createElement('ad-status-pill');
  riderPill.status = report.rider?.status ?? report.riderStatusAtReport;

  qs('#rider-state').items = [
    {
      label: t('common.name'),
      value: report.rider
        ? link(`rider-profile.html?id=${report.riderId}`, `${report.riderName} →`)
        : report.riderName,
    },
    { label: 'Phone', value: formatPhone(report.riderPhone) },
    { label: t('safetyReport.riderStatus'), value: riderPill },
    ...(report.rider?.suspensionReason
      ? [{ label: t('safetyReport.recordedReason'), value: report.rider.suspensionReason, wide: true }]
      : []),
  ];

  qs('#driver-info').items = [
    {
      label: t('common.name'),
      value: report.driver
        ? link(`driver-profile.html?id=${report.driverId}`, `${report.driverName} →`)
        : report.driverName,
    },
    ...(report.driver ? [{ label: 'Phone', value: formatPhone(report.driver.phone) }] : []),
    ...(report.driver
      ? [
          {
            label: t('field.vehicle'),
            value: `${report.driver.vehicle.make} ${report.driver.vehicle.model} · ${report.driver.vehicle.plate}`,
          },
        ]
      : []),
  ];

  const statusPill = document.createElement('ad-status-pill');
  statusPill.status = report.status === 'resolved' ? `resolved_${report.resolution}` : report.status;

  const metaItems = [
    { label: t('safetyReport.reportId'), value: report.id },
    { label: t('common.status'), value: statusPill },
    { label: t('safetyReport.reportedAt'), value: formatDateTime(report.reportedAt) },
  ];

  if (report.status === 'resolved') {
    metaItems.push(
      { label: t('safetyReport.resolvedAt'), value: formatDateTime(report.resolvedAt) },
      { label: t('safetyReport.resolvedBy'), value: report.resolvedBy },
    );
    if (report.resolutionNote) {
      metaItems.push({ label: t('safetyReport.resolutionNote'), value: report.resolutionNote, wide: true });
    }
  }

  qs('#report-meta').items = metaItems;

  renderActions(report);
}

function renderActions(report) {
  // #1811 S4 — a resolved report cannot be actioned again.
  const open = report.status === 'open';
  suspendBtn.hidden = !open;
  dismissBtn.hidden = !open;

  resolveHint.textContent = open
    ? t('safetyReport.hintOpen')
    : `Already resolved — ${report.resolution === 'suspended' ? 'the rider was suspended' : 'the report was dismissed'}. No further action is available.`;
}

suspendBtn.addEventListener('click', () => {
  modal.open({
    title: t('safetyReport.suspendBtn'),
    description:
      t('safetyReport.suspendDescription'),
    confirmLabel: t('riderProfile.suspendBtn'),
    danger: true,
    fields: [
      {
        key: 'note',
        type: 'textarea',
        label: t('safetyReport.noteLabel'),
        maxLength: 500,
        hint: t('safetyReport.suspendNoteHint'),
        lengthError: t('driverProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.resolveSafetyReport(id, 'suspended', values.note);
      shell.showToast(t('safetyReport.toastUpheld'), 'success');
      await load();
    },
  });
});

dismissBtn.addEventListener('click', () => {
  modal.open({
    title: t('safetyReport.dismissTitle'),
    description:
      t('safetyReport.dismissDescription'),
    confirmLabel: t('safetyReport.dismissConfirm'),
    fields: [
      {
        key: 'note',
        type: 'textarea',
        label: t('safetyReport.noteLabel'),
        maxLength: 500,
        lengthError: t('driverProfile.noteTooLong'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.resolveSafetyReport(id, 'dismissed', values.note);
      shell.showToast(t('safetyReport.toastDismissed'), 'success');
      await load();
    },
  });
});

await load();
