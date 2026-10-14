/**
 * safety-report.js — SheDrive admin gender-mismatch report detail & resolution
 * #1810 S3 trip snapshot + driver statement + rider account state;
 * #1811 resolve by suspending the reported rider or dismissing the report.
 *
 * The suspension note is optional: the report itself is the recorded reason
 * (#1811 S3). A report already resolved exposes no action controls (#1811 S4).
 *
 * Presentation (kit v22-09 gender-mismatch-details): the statement in an info
 * alert, four `col-lg-6` cards, Suspend (danger) / Dismiss (success) in a bottom
 * row, each opening the kit's `default-modal`, then a `popup-success`.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { formatDateTime, formatEgp, formatPhone, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, hasKey, isRtl, applyAdminTranslations } from './admin-i18n.js';
import { loadBootstrap } from './design-init.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const body = qs('#report-body');
const missing = qs('#report-missing');
const suspendBtn = qs('#suspend-btn');
const dismissBtn = qs('#dismiss-btn');
const resolveHint = qs('#resolve-hint');

const suspendModal = qs('#suspend-modal');
const dismissModal = qs('#dismiss-modal');
const successModal = qs('#success-modal');
const NOTE_MAX = 500;

// Modals live on <body> so no positioned ancestor inside the shell can trap them.
[suspendModal, dismissModal, successModal].forEach((el) => {
  document.body.appendChild(el);
  applyAdminTranslations(el);
});

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

function localizeSections() {
  const titles = {
    '#report-meta': 'kitDetails.reportDetails',
    '#rider-state': 'safetyReport.riderState',
    '#driver-info': 'safetyReport.driverInfo',
    '#trip-snapshot': 'safetyReport.tripSnapshot',
  };
  Object.entries(titles).forEach(([selector, key]) => {
    qs(selector)?.setAttribute('section-title', t(key));
  });
  const state = qs('#report-missing ad-empty-state');
  if (state) {
    state.setAttribute('heading', t('safetyReport.notFoundHeading'));
    state.setAttribute('message', t('safetyReport.notFoundMessage'));
  }
}

localizeSections();

/** Expiry reason token → its translated label (falls back to humanize). */
function expiryLabel(token) {
  const key = `tripDetail.expiry.${token}`;
  return token && hasKey(key) ? t(key) : humanize(token);
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

  // The driver's statement is optional (#1588 / #1687 S9). An empty one must read
  // as a stated absence, not a blank panel — the admin then works from the trip
  // snapshot alone and needs to know that is all there is.
  const statementEl = qs('#statement');
  const statement = (report.statement || '').trim();
  statementEl.textContent = statement || t('safetyReport.noStatement');
  statementEl.classList.toggle('detail__statement--empty', !statement);

  const trip = report.trip;
  const fare = document.createElement('span');
  fare.className = 'ad-ltr text-bold success-color';
  fare.textContent = trip ? formatEgp(trip.estimate.fare) : '';
  const expiry = document.createElement('span');
  expiry.className = 'text-bold';
  expiry.textContent = trip ? expiryLabel(trip.expiryReason) : '';

  qs('#trip-snapshot').items = trip
    ? [
        { label: t('safetyReport.tripId'), value: link(`trip-detail.html?id=${trip.id}`, trip.id) },
        { label: t('safetyReport.pickup'), value: trip.pickup.address, wide: true },
        { label: t('safetyReport.destination'), value: trip.destination.address, wide: true },
        { label: t('safetyReport.estimatedFare'), value: fare },
        { label: t('safetyReport.zone'), value: trip.zoneName },
        { label: t('safetyReport.expiryReason'), value: expiry },
      ]
    : [{ label: t('safetyReport.tripUnavailableLabel'), value: t('safetyReport.tripUnavailable'), muted: true }];

  const riderPill = document.createElement('ad-status-pill');
  riderPill.status = report.rider?.status ?? report.riderStatusAtReport;

  qs('#rider-state').items = [
    {
      label: t('common.name'),
      value: report.rider
        ? link(`rider-profile.html?id=${report.riderId}`, report.riderName)
        : report.riderName,
    },
    { label: t('common.phone'), value: formatPhone(report.riderPhone), ltr: true },
    { label: t('safetyReport.riderStatus'), value: riderPill },
    ...(report.rider?.suspensionReason
      ? [{ label: t('safetyReport.recordedReason'), value: report.rider.suspensionReason, wide: true }]
      : []),
  ];

  qs('#driver-info').items = [
    {
      label: t('common.name'),
      value: report.driver
        ? link(`driver-profile.html?id=${report.driverId}`, report.driverName)
        : report.driverName,
    },
    ...(report.driver ? [{ label: t('common.phone'), value: formatPhone(report.driver.phone), ltr: true }] : []),
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
    { label: t('safetyReport.reportId'), value: report.id, ltr: true },
    { label: t('safetyReport.reportedAt'), value: formatDateTime(report.reportedAt) },
    { label: t('common.status'), value: statusPill },
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
    : report.resolution === 'suspended'
      ? t('safetyReport.hintResolvedSuspended')
      : t('safetyReport.hintResolvedDismissed');
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

/**
 * Wire one optional-note resolution modal. The note is the only field; it may be
 * empty, but never over the 500-character limit.
 */
function wireResolution({ button, modal, resolution, successTitle, successBody }) {
  const form = modal.querySelector('form');
  const note = modal.querySelector('textarea');
  const feedback = modal.querySelector('.invalid-feedback');
  const errorBox = modal.querySelector('.sr-form-error');
  const submit = modal.querySelector('button[type="submit"]');

  const setNoteError = (message) => {
    feedback.textContent = message ?? '';
    feedback.classList.toggle('d-block', Boolean(message));
    note.classList.toggle('is-invalid', Boolean(message));
  };
  const setFormError = (message) => {
    errorBox.hidden = !message;
    errorBox.querySelector('p').textContent = message ?? '';
  };

  note.addEventListener('input', () => setNoteError(null));
  modal.addEventListener('shown.bs.modal', () => note.focus());

  button.addEventListener('click', () => {
    note.value = '';
    setNoteError(null);
    setFormError(null);
    showModal(modal);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = note.value.trim();
    if (value.length > NOTE_MAX) {
      setNoteError(t('driverProfile.noteTooLong'));
      note.focus();
      return;
    }
    submit.disabled = true;
    try {
      await mockApi.resolveSafetyReport(id, resolution, value);
      await hideModal(modal);
      await load();
      qs('#success-title', successModal).textContent = t(successTitle);
      qs('#success-body', successModal).textContent = t(successBody);
      showModal(successModal);
    } catch (error) {
      setFormError(error?.message ?? t('modal.saveFailed'));
    } finally {
      submit.disabled = false;
    }
  });
}

wireResolution({
  button: suspendBtn,
  modal: suspendModal,
  resolution: 'suspended',
  successTitle: 'kitDetails.suspendedTitle',
  successBody: 'kitDetails.suspendedBody',
});

wireResolution({
  button: dismissBtn,
  modal: dismissModal,
  resolution: 'dismissed',
  successTitle: 'kitDetails.dismissedTitle',
  successBody: 'kitDetails.dismissedBody',
});

await load();
