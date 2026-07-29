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
        { label: 'Trip ID', value: link(`trip-detail.html?id=${trip.id}`, `${trip.id} →`) },
        { label: 'Pickup', value: trip.pickup.address, wide: true },
        { label: 'Destination', value: trip.destination.address, wide: true },
        { label: 'Estimated fare', value: formatEgp(trip.estimate.fare) },
        { label: 'Zone', value: trip.zoneName },
        { label: 'Expiry reason', value: humanize(trip.expiryReason) },
      ]
    : [{ label: 'Trip', value: 'Trip record not available', muted: true }];

  const riderPill = document.createElement('ad-status-pill');
  riderPill.status = report.rider?.status ?? report.riderStatusAtReport;

  qs('#rider-state').items = [
    {
      label: 'Name',
      value: report.rider
        ? link(`rider-profile.html?id=${report.riderId}`, `${report.riderName} →`)
        : report.riderName,
    },
    { label: 'Phone', value: formatPhone(report.riderPhone) },
    { label: 'Current account status', value: riderPill },
    ...(report.rider?.suspensionReason
      ? [{ label: 'Recorded reason', value: report.rider.suspensionReason, wide: true }]
      : []),
  ];

  qs('#driver-info').items = [
    {
      label: 'Name',
      value: report.driver
        ? link(`driver-profile.html?id=${report.driverId}`, `${report.driverName} →`)
        : report.driverName,
    },
    ...(report.driver ? [{ label: 'Phone', value: formatPhone(report.driver.phone) }] : []),
    ...(report.driver
      ? [
          {
            label: 'Vehicle',
            value: `${report.driver.vehicle.make} ${report.driver.vehicle.model} · ${report.driver.vehicle.plate}`,
          },
        ]
      : []),
  ];

  const statusPill = document.createElement('ad-status-pill');
  statusPill.status = report.status === 'resolved' ? `resolved_${report.resolution}` : report.status;

  const metaItems = [
    { label: 'Report ID', value: report.id },
    { label: 'Status', value: statusPill },
    { label: 'Reported at', value: formatDateTime(report.reportedAt) },
  ];

  if (report.status === 'resolved') {
    metaItems.push(
      { label: 'Resolved at', value: formatDateTime(report.resolvedAt) },
      { label: 'Resolved by', value: report.resolvedBy },
    );
    if (report.resolutionNote) {
      metaItems.push({ label: 'Resolution note', value: report.resolutionNote, wide: true });
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
    ? 'Suspending applies the same suspension as a manual rider suspension. Dismissing returns her from Pending review to Active. Either way the decision is written to the audit log.'
    : `Already resolved — ${report.resolution === 'suspended' ? 'the rider was suspended' : 'the report was dismissed'}. No further action is available.`;
}

suspendBtn.addEventListener('click', () => {
  modal.open({
    title: 'Suspend the reported rider',
    description:
      'This upholds the report. Her sessions are invalidated and she cannot book until reinstated.',
    confirmLabel: 'Suspend rider',
    danger: true,
    fields: [
      {
        key: 'note',
        type: 'textarea',
        label: 'Note (optional)',
        maxLength: 500,
        hint: 'The gender-mismatch report is already the recorded reason, so a note is optional.',
        lengthError: 'Too long — must be ≤ 500 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.resolveSafetyReport(id, 'suspended', values.note);
      shell.showToast('Report upheld. The rider has been suspended.', 'success');
      await load();
    },
  });
});

dismissBtn.addEventListener('click', () => {
  modal.open({
    title: 'Dismiss this report?',
    description:
      'The report is marked unfounded and the rider returns from Pending review to Active.',
    confirmLabel: 'Dismiss report',
    fields: [
      {
        key: 'note',
        type: 'textarea',
        label: 'Note (optional)',
        maxLength: 500,
        lengthError: 'Too long — must be ≤ 500 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.resolveSafetyReport(id, 'dismissed', values.note);
      shell.showToast('Report dismissed. The rider is active again.', 'success');
      await load();
    },
  });
});

await load();
