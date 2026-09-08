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

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');

/** Field spec straight from the #1759 Field Validation tables. */
const CANCELLATION_FIELDS = [
  {
    key: 'riderGracePeriodMin',
    label: 'Rider grace period',
    unit: 'minutes',
    hint: 'A rider who cancels within this window is not charged a cancellation fee.',
    integer: true,
    min: 0,
    emptyError: 'Enter the rider grace period',
    invalidError: 'Enter a whole number of minutes',
    rangeError: 'Cannot be negative',
  },
  {
    key: 'driverCancellationFee',
    label: 'Driver cancellation fee',
    unit: 'EGP',
    hint: 'Charged to a driver who cancels after the grace period below.',
    integer: false,
    min: 0,
    emptyError: 'Enter the driver cancellation fee',
    invalidError: 'Enter a valid amount',
    rangeError: 'Cannot be negative',
  },
  {
    key: 'driverCancellationGracePeriodMin',
    label: 'Driver cancellation grace period',
    unit: 'minutes',
    hint: 'A driver who cancels within this window is not charged.',
    integer: true,
    min: 0,
    emptyError: 'Enter the driver cancellation grace period',
    invalidError: 'Enter a whole number of minutes',
    rangeError: 'Cannot be negative',
  },
  {
    key: 'riderNoShowWaitMin',
    label: 'Rider no-show wait time',
    unit: 'minutes',
    hint: 'How long a driver must wait at pickup before a no-show can be declared.',
    integer: true,
    min: 0,
    emptyError: 'Enter the rider no-show wait time',
    invalidError: 'Enter a whole number of minutes',
    rangeError: 'Cannot be negative',
  },
];

const COMMISSION_FIELD = {
  key: 'percentage',
  label: 'Commission percentage',
  unit: '%',
  hint: 'The platform share of every completed fare. Must be greater than 0% and at most 50%.',
  integer: false,
  min: 0.01,
  max: 50,
  emptyError: 'Enter the commission percentage',
  invalidError: 'Enter a valid percentage',
  rangeError: 'Commission must be greater than 0% and at most 50%',
};

/** #TBD-B — driver balance limit and withdrawal rules. */
const BALANCE_FIELDS = [
  {
    key: 'outstandingLimit',
    label: 'Outstanding balance limit',
    unit: 'EGP',
    hint: 'How much a driver may owe before she is stopped from going online. Set to 0 to disable the block.',
    integer: false,
    min: 0,
    max: 100000,
    emptyError: 'Enter the outstanding balance limit',
    invalidError: 'Enter a valid amount',
    rangeError: 'Must be between 0 and 100,000 EGP',
  },
  {
    key: 'minWithdrawal',
    label: 'Minimum withdrawal amount',
    unit: 'EGP',
    hint: 'The smallest amount a driver may request in one withdrawal.',
    integer: false,
    min: 0.01,
    max: 100000,
    emptyError: 'Enter the minimum withdrawal amount',
    invalidError: 'Enter a valid amount',
    rangeError: 'Must be greater than 0 and at most 100,000 EGP',
  },
  {
    key: 'maxWithdrawal',
    label: 'Maximum withdrawal per request',
    unit: 'EGP',
    hint: 'Leave empty for no cap. Must not be less than the minimum.',
    integer: false,
    min: 0.01,
    max: 100000,
    optional: true,
    invalidError: 'Enter a valid amount',
    rangeError: 'Must be greater than 0 and at most 100,000 EGP',
  },
  {
    key: 'coolingOffDays',
    label: 'Cooling-off period between requests',
    unit: 'days',
    hint: 'How long a driver must wait before requesting again. 0 allows same-day repeats.',
    integer: true,
    min: 0,
    max: 30,
    emptyError: 'Enter the cooling-off period',
    invalidError: 'Enter a whole number of days',
    rangeError: 'Must be between 0 and 30 days',
  },
];

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

/** An optional field accepts an empty value; every other rule still applies. */
function isBlankAndOptional(control) {
  return Boolean(control.spec.optional) && String(control.input.value).trim() === '';
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
  renderBalanceSection();
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
    shell.showToast('Cancellation policy saved — live for new trips.', 'success');
    policies = await mockApi.getPolicies();
    render();
  } catch (error) {
    box.textContent = error.message;
    box.classList.add('is-visible');
  }
});

// ── Driver balance & withdrawals (#TBD-B) ─────────────

let balanceControls = [];
const withdrawalsToggle = qs('#policy-withdrawalsEnabled');
withdrawalsToggle.addEventListener('change', () => updateBalanceExample());

function renderBalanceSection() {
  const host = qs('#balance-fields');
  host.textContent = '';
  balanceControls = BALANCE_FIELDS.map((spec) =>
    renderField(host, spec, policies.driverBalance[spec.key] ?? ''),
  );
  withdrawalsToggle.value = String(Boolean(policies.driverBalance.withdrawalsEnabled));
  qs('#balance-meta').textContent =
    `Last changed ${formatDateTime(policies.driverBalance.updatedAt)} by ${policies.driverBalance.updatedBy}`;
  balanceControls.forEach((balanceControl) =>
    balanceControl.input.addEventListener('input', updateBalanceExample),
  );
  updateBalanceExample();
}

function updateBalanceExample() {
  const limit = Number(control('outstandingLimit').input.value);
  const example = qs('#balance-example');
  const enabled = withdrawalsToggle.value === 'true';
  const gate = limit > 0
    ? `A driver is warned from ${formatEgp(limit * 0.8)} and blocked from going online at ${formatEgp(limit)}.`
    : 'The go-online balance block is disabled — a driver can work whatever she owes.';
  example.textContent = enabled ? `${gate} Withdrawals are open to drivers in credit.` : `${gate} Withdrawals are closed.`;
}

function control(key) {
  return balanceControls.find((c) => c.spec.key === key);
}

qs('#balance-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const box = qs('#balance-error');
  box.textContent = '';
  box.classList.remove('is-visible');

  if (!balanceControls.map(validate).every(Boolean)) return;

  // The cap is meaningless below the floor (#TBD-B Scenario 6).
  const min = Number(control('minWithdrawal').input.value);
  const maxRaw = control('maxWithdrawal').input.value.trim();
  if (maxRaw !== '' && Number(maxRaw) < min) {
    showError(control('maxWithdrawal'), 'Maximum must not be less than the minimum');
    return;
  }

  try {
    await mockApi.savePolicies({
      driverBalance: {
        outstandingLimit: Number(control('outstandingLimit').input.value),
        withdrawalsEnabled: withdrawalsToggle.value === 'true',
        minWithdrawal: min,
        maxWithdrawal: maxRaw === '' ? null : Number(maxRaw),
        coolingOffDays: Number(control('coolingOffDays').input.value),
      },
    });
    policies = await mockApi.getPolicies();
    renderBalanceSection();
    qs('ad-shell').showToast('Driver balance and withdrawal policy saved.', 'success');
  } catch (error) {
    box.textContent = error.message;
    box.classList.add('is-visible');
  }
});

qs('#balance-reset').addEventListener('click', () => {
  renderBalanceSection();
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
