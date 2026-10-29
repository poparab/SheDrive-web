/**
 * pricing-policies.js — SheDrive admin global pricing policies
 * #1759: the global cancellation policy (rider grace period, driver cancellation
 * fee, driver cancellation grace period, rider no-show wait) and the platform
 * commission percentage. Validation comes from the story's two Field Validation
 * tables. Operating hours (2026-10-27): the daily booking window, saved
 * immediately like the cancellation and balance settings.
 *
 * Kit v22-09 port (2026-10-14): three `standard-card-theme2` cards with the
 * kit's `list-multi-column` field rows, ONE global Save / Revert, and a
 * toast that says what applied now and what went for approval.
 *
 * Roles (2026-10-29, #6210 / #6212 / #6268): commission, the cancellation
 * policy, the balance limit and the payout settings (minimum payout, transfer
 * fee and who pays it, 2026-10-29) are requests a Financial lead makes and another
 * approves; operating hours are the Operations lead's and apply on save. Every
 * other role sees the screen read-only, with no Save.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { formatDateTime, formatEgp, formatPercent, formatTime } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { can } from './roles.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');

// #6210 / #6212 / #6268 — what this role may change. Commission, the
// cancellation policy and the balance limit are a Financial lead's request;
// operating hours are the Operations lead's and save at once. Everything else
// is read-only, and with nothing to change there is no Save at all.
const CAN_PRICING = can('pricing.request');
const CAN_HOURS = can('hours.edit');
qs('#policies-actions').hidden = !CAN_PRICING && !CAN_HOURS;

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

/** 2026-10-29 — payout settings: the minimum payout and the transfer fee, and who pays it. */
const PAYOUT_FIELDS = [
  {
    key: 'minimumAmount',
    label: t('policies.minimumLabel'),
    unit: t('policies.unitEgp'),
    hint: t('policies.minimumHint'),
    integer: false,
    min: 0,
    max: 100000,
    emptyError: t('policies.minimumEmpty'),
    invalidError: t('zones.amountInvalid'),
    rangeError: t('policies.minimumRange'),
  },
  {
    key: 'transferFee',
    label: t('policies.feeLabel'),
    unit: t('policies.unitEgp'),
    hint: t('policies.feeHint'),
    integer: false,
    min: 0,
    max: 1000,
    emptyError: t('policies.feeEmpty'),
    invalidError: t('zones.amountInvalid'),
    rangeError: t('policies.feeRange'),
  },
  {
    key: 'feePaidBy',
    type: 'select',
    label: t('policies.feePayerLabel'),
    unit: '',
    hint: t('policies.feePayerHint'),
    options: [
      { value: 'driver', label: t('policies.feePayerDriver') },
      { value: 'shedrive', label: t('policies.feePayerShedrive') },
    ],
  },
];

/** Operating hours (#1785 / #1791): one same-day window, Cairo time. */
const HOURS_FIELDS = [
  {
    key: 'opensAt',
    type: 'time',
    label: t('policies.opensAt'),
    unit: t('policies.unitCairo'),
    hint: t('policies.opensAtHint'),
    emptyError: t('policies.opensAtEmpty'),
    invalidError: t('policies.timeInvalid'),
  },
  {
    key: 'closesAt',
    type: 'time',
    label: t('policies.closesAt'),
    unit: t('policies.unitCairo'),
    hint: t('policies.closesAtHint'),
    emptyError: t('policies.closesAtEmpty'),
    invalidError: t('policies.timeInvalid'),
    rangeError: t('policies.closesAfterOpens'),
  },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

let policies;

// ── Field rendering — the kit's list-multi-column row ─

function renderField(host, spec, value) {
  const wrap = document.createElement('div');
  wrap.className = 'list-multi-column light-bg mb-2';
  const row = document.createElement('div');
  row.className = 'row gy-2 list-row';

  const labels = document.createElement('div');
  // A select needs room for its option labels.
  labels.className = `list-item-grid ${spec.type === 'select' ? 'col-sm-7' : 'col-sm-9'}`;
  // The kit's p.text-bold, holding the real <label> so the input keeps its name.
  const title = document.createElement('p');
  title.className = 'text-bold';
  const label = document.createElement('label');
  label.className = 'pricing__label';
  label.htmlFor = `policy-${spec.key}`;
  label.textContent = spec.unit ? t('policies.fieldLabel', { label: spec.label, unit: spec.unit }) : spec.label;
  title.appendChild(label);
  const hint = document.createElement('span');
  hint.textContent = spec.hint;
  labels.append(title, hint);

  const field = document.createElement('div');
  field.className = `list-item ${spec.type === 'select' ? 'col-sm-5' : 'col-sm-3'} pricing__input`;
  const input = document.createElement(spec.type === 'select' ? 'select' : 'input');
  input.className = spec.type === 'select' ? 'form-select' : 'form-control ad-ltr';
  input.id = `policy-${spec.key}`;
  input.name = spec.key;
  if (spec.type === 'select') {
    spec.options.forEach((o) => {
      const option = document.createElement('option');
      option.value = o.value;
      option.textContent = o.label;
      input.appendChild(option);
    });
  } else if (spec.type === 'time') {
    input.type = 'time';
    input.step = '60';
  } else {
    input.type = 'number';
    input.step = spec.integer ? '1' : '0.01';
    input.min = String(spec.min);
    if (spec.max !== undefined) input.max = String(spec.max);
  }
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
  input.addEventListener(spec.type === 'select' ? 'change' : 'input', () => clearError(control));
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
  if (spec.type === 'select') return true;

  if (!raw) {
    if (isBlankAndOptional(control)) return true;
    showError(control, spec.emptyError);
    return false;
  }
  if (spec.type === 'time') {
    if (!TIME_PATTERN.test(raw)) {
      showError(control, spec.invalidError);
      return false;
    }
    return true;
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
let payoutControls = [];
let hoursControls = [];

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

  const payoutHost = qs('#payout-fields');
  payoutHost.textContent = '';
  payoutControls = PAYOUT_FIELDS.map((spec) => renderField(payoutHost, spec, policies.payout[spec.key] ?? ''));
  payoutControls.forEach((c) => c.input.addEventListener(c.spec.type === 'select' ? 'change' : 'input', updatePayoutExample));
  qs('#payout-meta').textContent = lastChanged(policies.payout);

  const hoursHost = qs('#hours-fields');
  hoursHost.textContent = '';
  hoursControls = HOURS_FIELDS.map((spec) => renderField(hoursHost, spec, policies.operatingHours[spec.key]));
  qs('#hours-meta').textContent = lastChanged(policies.operatingHours);
  renderHoursStatus();

  qs('#cancel-meta').textContent = lastChanged(policies.cancellation);
  qs('#commission-meta').textContent = lastChanged(policies.commission);
  qs('#balance-meta').textContent = lastChanged(policies.driverBalance);

  updateCommissionExample();
  updateBalanceExample();
  updatePayoutExample();
  renderCommissionPending();
  renderSettingPending('cancel', policies.pendingCancellation, cancellationControls, t('pricingApproval.cancellationPending'));
  renderSettingPending('balance', policies.pendingBalanceLimit, balanceControls,
    t('pricingApproval.balancePending', { limit: formatEgp(policies.pendingBalanceLimit?.after?.outstandingLimit ?? 0) }));
  renderSettingPending('payout', policies.pendingPayoutSettings, payoutControls, t('pricingApproval.payoutPending'));
  applyRoleLocks();
}

/** A section this role cannot change is read-only (inputs read-only, never a button). */
function applyRoleLocks() {
  const lock = (controls, editable) => controls.forEach((c) => {
    // A select has no read-only state; it is disabled instead.
    if (c.spec.type === 'select') c.input.disabled ||= !editable;
    else c.input.readOnly = !editable;
    if (!editable) c.input.setAttribute('aria-readonly', 'true');
  });
  lock(cancellationControls, CAN_PRICING);
  lock([commissionControl], CAN_PRICING);
  lock(balanceControls, CAN_PRICING);
  lock(payoutControls, CAN_PRICING);
  lock(hoursControls, CAN_HOURS);
  qs('#commission-approval-hint').hidden = !CAN_PRICING;
}

/** #6212 — a cancellation-policy or balance-limit change waiting for another Financial lead locks its card. */
function renderSettingPending(key, pending, controls, title) {
  const card = qs(`#${key}-card`);
  qs(`#${key}-pending`).hidden = !pending;
  controls.forEach((c) => {
    c.input.disabled = Boolean(pending);
    if (pending) c.input.title = t('pricingApproval.lockedTitle');
  });
  card.classList.toggle('warning-alert-bg', Boolean(pending));
  card.classList.toggle('warning-alert-br', Boolean(pending));
  card.classList.toggle('white-bg', !pending);
  if (!pending) return;
  qs(`#${key}-pending-title`).textContent = title;
  qs(`#${key}-pending-meta`).textContent = t('pricingApproval.settingPendingMeta', {
    who: pending.maker,
    when: formatDateTime(pending.madeAt),
  });
  qs(`#${key}-pending-link`).href = approvalHref(pending.id);
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

/** Says whether booking is open right now, from the saved hours (not the unsaved inputs). */
function renderHoursStatus() {
  const { opensAt, closesAt } = policies.operatingHours;
  const now = formatTime(Date.now());
  let text;
  if (now >= opensAt && now < closesAt) text = t('policies.statusOpen', { time: closesAt });
  else if (now < opensAt) text = t('policies.statusClosedToday', { time: opensAt });
  else text = t('policies.statusClosedTomorrow', { time: opensAt });
  qs('#hours-status').textContent = text;
}

/** Closing must come after opening on the same day; runs once both times are valid. */
function validateHoursOrder() {
  const [opens, closes] = hoursControls;
  if (closes.input.value <= opens.input.value) {
    showError(closes, closes.spec.rangeError);
    return false;
  }
  return true;
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

function updatePayoutExample() {
  const value = (key) => payoutControls.find((c) => c.spec.key === key).input.value;
  const fee = Number(value('transferFee'));
  const amount = 500;
  qs('#payout-example').textContent = Number.isNaN(fee)
    ? ''
    : t(value('feePaidBy') === 'driver' ? 'policies.payoutExampleDriver' : 'policies.payoutExampleShedrive', {
      amount: formatEgp(amount),
      sent: formatEgp(amount - fee),
      fee: formatEgp(fee),
    });
}

/** When the driver pays the fee, a payout at the minimum must still be more than the fee. */
function validatePayoutOrder() {
  const [minimum, fee, payer] = payoutControls;
  if (payer.input.value === 'driver' && Number(minimum.input.value) <= Number(fee.input.value)) {
    showError(minimum, t('policies.minimumAboveFee'));
    return false;
  }
  return true;
}

// ── One global Save ───────────────────────────────────

const valueOf = (c) => (c.spec.type === 'select' ? c.input.value : Number(c.input.value));

function changed(controls, current) {
  return controls.some((c) => String(valueOf(c)) !== String(current[c.spec.key]));
}

function readValues(controls) {
  const out = {};
  controls.forEach((c) => {
    out[c.spec.key] = valueOf(c);
  });
  return out;
}

const errorBox = qs('#policies-error');

qs('#policies-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  errorBox.classList.remove('is-visible');

  const commissionLocked = Boolean(policies.pendingCommission) || !CAN_PRICING;
  const cancelLocked = Boolean(policies.pendingCancellation) || !CAN_PRICING;
  const balanceLocked = Boolean(policies.pendingBalanceLimit) || !CAN_PRICING;
  const payoutLocked = Boolean(policies.pendingPayoutSettings) || !CAN_PRICING;
  const hoursEditable = CAN_HOURS;
  const controls = [
    ...(cancelLocked ? [] : cancellationControls),
    ...(commissionLocked ? [] : [commissionControl]),
    ...(balanceLocked ? [] : balanceControls),
    ...(payoutLocked ? [] : payoutControls),
    ...(hoursEditable ? hoursControls : []),
  ];
  const results = controls.map(validate);
  if (!payoutLocked) {
    const at = controls.indexOf(payoutControls[0]);
    if (!results.slice(at, at + payoutControls.length).includes(false) && !validatePayoutOrder()) results[at] = false;
  }
  if (hoursEditable && !results.slice(-hoursControls.length).includes(false) && !validateHoursOrder()) {
    results[results.length - 1] = false;
  }
  if (results.includes(false)) {
    controls[results.indexOf(false)].input.focus();
    return;
  }

  // #6212 — commission, cancellation policy and balance limit become requests;
  // only operating hours apply on save (#6268).
  const payload = {};
  const applied = [];
  const sent = [];
  if (!cancelLocked && changed(cancellationControls, policies.cancellation)) {
    payload.cancellation = readValues(cancellationControls);
    sent.push(t('kitPricing.cancellationChange'));
  }
  if (!balanceLocked && changed(balanceControls, policies.driverBalance)) {
    payload.driverBalance = readValues(balanceControls);
    sent.push(t('kitPricing.balanceLimitChange', {
      from: formatEgp(policies.driverBalance.outstandingLimit),
      to: formatEgp(payload.driverBalance.outstandingLimit),
    }));
  }
  if (!payoutLocked && changed(payoutControls, policies.payout)) {
    payload.payout = readValues(payoutControls);
    sent.push(t('kitPricing.payoutSettingsChange'));
  }
  if (hoursEditable && hoursControls.some((c) => c.input.value !== policies.operatingHours[c.spec.key])) {
    payload.operatingHours = Object.fromEntries(hoursControls.map((c) => [c.spec.key, c.input.value]));
    applied.push(t('policies.hoursHeading'));
  }
  const before = Number(policies.commission.percentage);
  const percentage = Number(commissionControl.input.value);
  const commissionChanged = !commissionLocked && percentage !== before;
  if (commissionChanged) {
    payload.commission = { percentage };
    sent.unshift(t('kitPricing.commissionChange', { from: formatPercent(before), to: formatPercent(percentage) }));
  }

  if (!applied.length && !sent.length) {
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
      sent: result.pending ? sent.join(t('kitPricing.listSeparator')) : '',
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
  payoutControls.forEach((c) => {
    c.input.value = policies.payout[c.spec.key] ?? '';
    clearError(c);
  });
  hoursControls.forEach((c) => {
    c.input.value = policies.operatingHours[c.spec.key];
    clearError(c);
  });
  if (!policies.pendingCommission) {
    commissionControl.input.value = policies.commission.percentage;
    clearError(commissionControl);
  }
  updateCommissionExample();
  updateBalanceExample();
  updatePayoutExample();
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
