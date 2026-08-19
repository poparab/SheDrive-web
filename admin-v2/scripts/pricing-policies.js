/**
 * pricing-policies.js — SheDrive admin global pricing policies
 * #1759: the global cancellation policy (rider grace period, driver cancellation
 * fee, driver cancellation grace period, rider no-show wait) and the platform
 * commission percentage. Validation comes from the story's two Field Validation
 * tables.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
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

let policies;

// ── Field rendering ───────────────────────────────────

function renderField(host, spec, value) {
  const row = document.createElement('div');
  row.className = 'pricing__form-row';

  const labels = document.createElement('div');
  labels.className = 'pricing__label-block';
  const label = document.createElement('label');
  label.className = 'pricing__label';
  label.htmlFor = `policy-${spec.key}`;
  label.textContent = `${spec.label} (${spec.unit})`;
  const hint = document.createElement('span');
  hint.className = 'pricing__label-hint';
  hint.textContent = spec.hint;
  labels.append(label, hint);

  const field = document.createElement('div');
  field.className = 'field';
  const input = document.createElement('input');
  input.className = 'input';
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

  input.addEventListener('input', () => {
    error.hidden = true;
    input.classList.remove('input--error');
  });

  field.append(input, error);
  row.append(labels, field);
  host.appendChild(row);

  return { spec, input, error };
}

function showError(control, message) {
  control.error.textContent = message;
  control.error.hidden = false;
  control.input.classList.add('input--error');
  control.input.setAttribute('aria-invalid', 'true');
  control.input.setAttribute('aria-describedby', control.error.id);
}

function clearError(control) {
  control.error.hidden = true;
  control.input.classList.remove('input--error');
  control.input.removeAttribute('aria-invalid');
}

/** Validate one control against its spec; returns true when valid. */
function validate(control) {
  clearError(control);
  const raw = control.input.value.trim();
  const spec = control.spec;

  if (!raw) {
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

// ── Wiring ────────────────────────────────────────────

let cancellationControls = [];
let commissionControl = null;

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

  qs('#cancel-meta').textContent =
    `Last changed ${formatDateTime(policies.cancellation.updatedAt)} by ${policies.cancellation.updatedBy}`;
  qs('#commission-meta').textContent =
    `Last changed ${formatDateTime(policies.commission.updatedAt)} by ${policies.commission.updatedBy}`;

  updateCommissionExample();
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
  example.textContent =
    `On a ${formatEgp(fare)} fare the platform keeps ${formatEgp(commission)} ` +
    `and the driver nets ${formatEgp(fare - commission)}.`;
}

qs('#cancel-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const box = qs('#cancel-error');
  box.classList.remove('is-visible');

  const results = cancellationControls.map(validate);
  if (results.includes(false)) return;

  const payload = {};
  cancellationControls.forEach((control) => {
    payload[control.spec.key] = Number(control.input.value);
  });

  try {
    await mockApi.savePolicies({ cancellation: payload });
    shell.showToast(t('policies.cancellationSaved'), 'success');
    policies = await mockApi.getPolicies();
    render();
  } catch (error) {
    box.textContent = error.message;
    box.classList.add('is-visible');
  }
});

qs('#commission-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const box = qs('#commission-error');
  box.classList.remove('is-visible');

  if (!validate(commissionControl)) return;

  try {
    await mockApi.savePolicies({
      commission: { percentage: Number(commissionControl.input.value) },
    });
    shell.showToast(
      `Platform commission set to ${formatPercent(commissionControl.input.value)}.`,
      'success',
    );
    policies = await mockApi.getPolicies();
    render();
  } catch (error) {
    box.textContent = error.message;
    box.classList.add('is-visible');
  }
});

qs('#cancel-reset').addEventListener('click', () => {
  cancellationControls.forEach((control) => {
    control.input.value = policies.cancellation[control.spec.key];
    clearError(control);
  });
});

qs('#commission-reset').addEventListener('click', () => {
  commissionControl.input.value = policies.commission.percentage;
  clearError(commissionControl);
  updateCommissionExample();
});

policies = await mockApi.getPolicies();
render();
