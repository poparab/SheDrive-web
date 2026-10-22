/**
 * pricing-policies.js — SheDrive admin global pricing policies
 * #1759: the global cancellation policy (rider grace period, driver cancellation
 * fee, driver cancellation grace period, rider no-show wait) and the platform
 * commission percentage. Validation comes from the story's two Field Validation
 * tables.
 *
 * Kit v22-09 port (2026-10-14): three `standard-card-theme2` cards with the
 * kit's `list-multi-column` field rows, ONE global Save / Revert, and a
 * toast that says what applied now and what went for approval —
 * a commission change is still a maker-checker request (§1), every other
 * field applies on save.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { formatDateTime, formatEgp, formatPercent } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');

/** Field spec straight from the #1759 Field Validation tables. */
const CANCELLATION_FIELDS = [
  {
    key: 'riderGracePeriodMin',
    label: t('policies.riderGrace'),
    unit: t('policies.unitMinutes'),
    hint: t('policies.riderGraceHint'),
    integer: true,
    min: 0,
    emptyError: t('policies.riderGraceEmpty'),
    invalidError: t('policies.wholeMinutes'),
    rangeError: t('policies.notNegative'),
  },
  {
    key: 'driverCancellationFee',
    label: t('policies.driverFee'),
    unit: t('common.egp'),
    hint: t('policies.driverFeeHint'),
    integer: false,
    min: 0,
    emptyError: t('policies.driverFeeEmpty'),
    invalidError: t('zones.amountInvalid'),
    rangeError: t('policies.notNegative'),
  },
  {
    key: 'driverCancellationGracePeriodMin',
    label: t('policies.driverGrace'),
    unit: t('policies.unitMinutes'),
    hint: t('policies.driverGraceHint'),
    integer: true,
    min: 0,
    emptyError: t('policies.driverGraceEmpty'),
    invalidError: t('policies.wholeMinutes'),
    rangeError: t('policies.notNegative'),
  },
  {
    key: 'riderNoShowWaitMin',
    label: t('policies.noShow'),
    unit: t('policies.unitMinutes'),
    hint: t('policies.noShowHint'),
    integer: true,
    min: 0,
    emptyError: t('policies.noShowEmpty'),
    invalidError: t('policies.wholeMinutes'),
    rangeError: t('policies.notNegative'),
  },
];

const COMMISSION_FIELD = {
  key: 'percentage',
  label: t('policies.commissionLabel'),
  unit: '%',
  hint: t('policies.commissionHint'),
  integer: false,
  min: 0.01,
  max: 50,
  emptyError: t('policies.commissionEmpty'),
  invalidError: t('policies.commissionInvalid'),
  rangeError: t('policies.commissionRange'),
};

/** #TBD-B — driver balance limit. */
const BALANCE_FIELDS = [
  {
    key: 'outstandingLimit',
    label: t('policies.limitLabel'),
    unit: t('policies.unitEgp'),
    hint: t('policies.limitHint'),
    integer: false,
    min: 0,
    max: 100000,
    emptyError: t('policies.limitEmpty'),
    invalidError: t('zones.amountInvalid'),
    rangeError: t('policies.limitRange'),
  },
];

let policies;

// ── Field rendering — the kit's list-multi-column row ─

function renderField(host, spec, value) {
  const wrap = document.createElement('div');
  wrap.className = 'list-multi-column light-bg mb-2';
  const row = document.createElement('div');
  row.className = 'row gy-2 list-row';

  const labels = document.createElement('div');
  labels.className = 'list-item-grid col-sm-9';
  // The kit's p.text-bold, holding the real <label> so the input keeps its name.
  const title = document.createElement('p');
  title.className = 'text-bold';
  const label = document.createElement('label');
  label.className = 'pricing__label';
  label.htmlFor = `policy-${spec.key}`;
  label.textContent = t('policies.fieldLabel', { label: spec.label, unit: spec.unit });
  title.appendChild(label);
  const hint = document.createElement('span');
  hint.textContent = spec.hint;
  labels.append(title, hint);

  const field = document.createElement('div');
  field.className = 'list-item col-sm-3 pricing__input';
  const input = document.createElement('input');
  input.className = 'form-control ad-ltr';
  input.id = `policy-${spec.key}`;
  input.name = spec.key;
  input.type = 'number';
  input.step = spec.integer ? '1' : '0.01';
  input.min = String(spec.min);
  if (spec.max !== undefined) input.max = String(spec.max);
  input.value = value ?? '';

  const error = document.createElement('span');
  error.className = 'field__error';
  error.id = `policy-${spec.key}-error`;
  error.hidden = true;

  field.append(input, error);
  row.append(labels, field);
  wrap.appendChild(row);
  host.appendChild(wrap);

  const control = { spec, input, error };
  input.addEventListener('input', () => clearError(control));
  return control;
}

/** An optional field accepts an empty value; every other rule still applies. */
function isBlankAndOptional(control) {
  return Boolean(control.spec.optional) && String(control.input.value).trim() === '';
}

function showError(control, message) {
  control.error.textContent = message;
  control.error.hidden = false;
  control.input.classList.add('is-invalid');
  control.input.setAttribute('aria-invalid', 'true');
  control.input.setAttribute('aria-describedby', control.error.id);
}

function clearError(control) {
  control.error.hidden = true;
  control.input.classList.remove('is-invalid');
  control.input.removeAttribute('aria-invalid');
}

/** Validate one control against its spec; returns true when valid. */
function validate(control) {
  clearError(control);
  const raw = control.input.value.trim();
  const spec = control.spec;

  if (!raw) {
    if (isBlankAndOptional(control)) return true;
    showError(control, spec.emptyError);
    return false;
  }
  const numeric = Number(raw);
  if (Number.isNaN(numeric)) {
    showError(control, spec.invalidError);
    return false;
  }
  if (spec.integer && !Number.isInteger(numeric)) {
    showError(control, spec.invalidError);
    return false;
  }
  if (numeric < spec.min) {
    showError(control, spec.rangeError);
    return false;
  }
  if (spec.max !== undefined && numeric > spec.max) {
    showError(control, spec.rangeError);
    return false;
  }
  return true;
}

// ── Render ────────────────────────────────────────────

let cancellationControls = [];
let commissionControl = null;
let balanceControls = [];

function lastChanged(section) {
  return t('policies.lastChanged', { when: formatDateTime(section.updatedAt), who: section.updatedBy });
}

function render() {
  const cancelHost = qs('#cancel-fields');
  cancelHost.textContent = '';
  cancellationControls = CANCELLATION_FIELDS.map((spec) =>
    renderField(cancelHost, spec, policies.cancellation[spec.key]),
  );

  const commissionHost = qs('#commission-fields');
  commissionHost.textContent = '';
  commissionControl = renderField(commissionHost, COMMISSION_FIELD, policies.commission.percentage);
  commissionControl.input.addEventListener('input', updateCommissionExample);

  const balanceHost = qs('#balance-fields');
  balanceHost.textContent = '';
  balanceControls = BALANCE_FIELDS.map((spec) =>
    renderField(balanceHost, spec, policies.driverBalance[spec.key] ?? ''),
  );
  balanceControls.forEach((c) => c.input.addEventListener('input', updateBalanceExample));

  qs('#cancel-meta').textContent = lastChanged(policies.cancellation);
  qs('#commission-meta').textContent = lastChanged(policies.commission);
  qs('#balance-meta').textContent = lastChanged(policies.driverBalance);

  updateCommissionExample();
  updateBalanceExample();
  renderCommissionPending();
}

// ── Commission maker-checker (2026-10-14 §1) ──────────

/** While a change waits for a second admin, the field is locked and the proposal shown. */
function renderCommissionPending() {
  const pending = policies.pendingCommission;
  const card = qs('#commission-card');
  qs('#commission-pending').hidden = !pending;
  commissionControl.input.disabled = Boolean(pending);
  // The kit tints a card whose change is waiting on someone else.
  card.classList.toggle('warning-alert-bg', Boolean(pending));
  card.classList.toggle('warning-alert-br', Boolean(pending));
  card.classList.toggle('white-bg', !pending);
  if (!pending) return;
  commissionControl.input.title = t('pricingApproval.lockedTitle');
  qs('#commission-pending-title').textContent = t('pricingApproval.commissionPending', {
    pct: formatPercent(pending.after?.percentage),
  });
  qs('#commission-pending-meta').textContent = t('pricingApproval.commissionPendingMeta', {
    who: pending.maker,
    when: formatDateTime(pending.madeAt),
    current: formatPercent(policies.commission.percentage),
  });
  qs('#commission-pending-link').href = approvalHref(pending.id);
}

/** A worked example makes the percentage concrete for whoever sets it. */
function updateCommissionExample() {
  const value = Number(commissionControl.input.value);
  const example = qs('#commission-example');
  if (Number.isNaN(value) || value <= 0) {
    example.textContent = '';
    return;
  }
  const fare = 100;
  const commission = (fare * value) / 100;
  example.textContent = t('policies.commissionExample', {
    fare: formatEgp(fare),
    commission: formatEgp(commission),
    net: formatEgp(fare - commission),
  });
}

function updateBalanceExample() {
  const limit = Number(balanceControls.find((c) => c.spec.key === 'outstandingLimit').input.value);
  qs('#balance-example').textContent =
    limit > 0
      ? t('policies.balanceExample', { warn: formatEgp(limit * 0.8), limit: formatEgp(limit) })
      : t('policies.balanceExampleOff');
}

// ── One global Save ───────────────────────────────────

function changed(controls, current) {
  return controls.some((c) => Number(c.input.value) !== Number(current[c.spec.key]));
}

function readValues(controls) {
  const out = {};
  controls.forEach((c) => {
    out[c.spec.key] = Number(c.input.value);
  });
  return out;
}

const errorBox = qs('#policies-error');

qs('#policies-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  errorBox.classList.remove('is-visible');

  const commissionLocked = Boolean(policies.pendingCommission);
  const controls = [...cancellationControls, ...(commissionLocked ? [] : [commissionControl]), ...balanceControls];
  const results = controls.map(validate);
  if (results.includes(false)) {
    controls[results.indexOf(false)].input.focus();
    return;
  }

  const payload = {};
  const applied = [];
  if (changed(cancellationControls, policies.cancellation)) {
    payload.cancellation = readValues(cancellationControls);
    applied.push(t('policies.cancelHeading'));
  }
  if (changed(balanceControls, policies.driverBalance)) {
    payload.driverBalance = readValues(balanceControls);
    applied.push(t('policies.balanceHeading'));
  }
  const before = Number(policies.commission.percentage);
  const percentage = Number(commissionControl.input.value);
  const commissionChanged = !commissionLocked && percentage !== before;
  // A commission change never applies on save — savePolicies turns it into a request (§1).
  if (commissionChanged) payload.commission = { percentage };

  if (!applied.length && !commissionChanged) {
    shell.showToast(t('kitPricing.nothingChanged'), 'info');
    return;
  }

  const saveBtn = qs('#policies-save');
  saveBtn.disabled = true;
  try {
    const result = await mockApi.savePolicies(payload);
    policies = await mockApi.getPolicies();
    render();
    openSaved({
      applied,
      sent: result.pending
        ? t('kitPricing.commissionChange', { from: formatPercent(before), to: formatPercent(percentage) })
        : '',
      requestId: result.request?.id,
    });
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('is-visible');
  } finally {
    saveBtn.disabled = false;
  }
});

/**
 * Says what applied now and what went for approval. A toast, not the kit's
 * popup-success: nothing here needs a decision. The approval link rides along
 * as the toast's action.
 */
function openSaved({ applied, sent, requestId }) {
  const lines = [];
  if (applied.length) {
    lines.push(t('kitPricing.appliedNow', { list: applied.join(t('kitPricing.listSeparator')) }));
  }
  if (sent) lines.push(t('kitPricing.sentForApproval', { list: sent }));
  shell.showToast(lines.join(' '), 'success', {
    title: applied.length ? t('kitPricing.savedTitle') : t('kitPricing.sentTitle'),
    action:
      sent && requestId
        ? { label: t('pricingApproval.viewRequest'), href: approvalHref(requestId) }
        : null,
  });
}

// ── Revert ────────────────────────────────────────────

qs('#policies-revert').addEventListener('click', () => {
  errorBox.classList.remove('is-visible');
  cancellationControls.forEach((c) => {
    c.input.value = policies.cancellation[c.spec.key];
    clearError(c);
  });
  balanceControls.forEach((c) => {
    c.input.value = policies.driverBalance[c.spec.key] ?? '';
    clearError(c);
  });
  if (!policies.pendingCommission) {
    commissionControl.input.value = policies.commission.percentage;
    clearError(commissionControl);
  }
  updateCommissionExample();
  updateBalanceExample();
});

// ?state=error (or a real outage): the kit's error result instead of an uncaught throw.
function renderLoadError(error) {
  qs('#policies-form').hidden = true;
  const box = document.createElement('div');
  box.className = 'result-message danger mt-3';
  const icon = document.createElement('span');
  icon.className = 'icon';
  const img = document.createElement('img');
  img.src = 'vendor/icons/cloud-connection-off.svg';
  img.alt = '';
  icon.appendChild(img);
  const heading = document.createElement('h3');
  heading.textContent = t('kitPricing.policiesLoadError');
  const message = document.createElement('p');
  message.textContent = t('state.errorMessage');
  console.warn('getPolicies failed:', error?.message);
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn-primary-rounded-outline';
  retry.textContent = t('common.tryAgain');
  retry.addEventListener('click', () => window.location.reload());
  box.append(icon, heading, message, retry);
  qs('#policies-form').after(box);
}

// A request's link opens the review here; a decision reloads this screen.
wireInPlaceApprovals({
  onDecided: async () => {
    policies = await mockApi.getPolicies();
    render();
  },
});

try {
  policies = await mockApi.getPolicies();
  render();
} catch (error) {
  renderLoadError(error);
}
