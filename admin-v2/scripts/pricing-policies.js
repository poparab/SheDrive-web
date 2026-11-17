/**
 * pricing-policies.js — SheDrive admin global pricing policies
 * #1759: the global cancellation policy (rider grace period, driver cancellation
 * fee, driver cancellation grace period, rider no-show wait) and the platform
 * commission percentage. Validation comes from the story's two Field Validation
 * tables. Operating hours (2026-10-27): the daily booking window, saved
 * immediately like the cancellation and balance settings.
 *
 * Kit v22-09 port (2026-10-14): `standard-card-theme2` cards with the kit's
 * `list-multi-column` field rows and a toast that says what applied now and
 * what went for approval.
 *
 * Tabs by owner (2026-10-29): Pricing (cancellation policy, commission),
 * Finance (balance limit, payout settings), Operations (operating hours).
 * ?tab= opens a tab; without it the first tab this role can change opens.
 *
 * One approval per tab (2026-11-15, #6565 / #6567 / new Operations story):
 * "Send for approval" sends the open tab as ONE request holding every field on
 * it, never one request per card or field. While it waits, the whole tab is
 * locked behind one banner. Pricing and Finance are a Financial lead's request,
 * decided by another Financial lead; Operations is the Operations lead's,
 * decided by another Operations lead. Every other role sees the screen
 * read-only, with no button.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { approvalHref, wireInPlaceApprovals } from './approval-review.js';
import { formatDateTime, formatEgp, formatTime } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { can } from './roles.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');

// #6210 / #6212 / #6268 — what this role may change. The Pricing and Finance
// tabs are a Financial lead's request; the Operations tab is the Operations
// lead's request. Everything else is read-only, with no button at all.
const CAN_PRICING = can('pricing.request');
const CAN_HOURS = can('hours.edit');

// ── Tabs (2026-10-29) ─────────────────────────────────
const TABS = ['pricing', 'finance', 'operations'];
const CAN_EDIT_TAB = { pricing: CAN_PRICING, finance: CAN_PRICING, operations: CAN_HOURS };
const requestedTab = new URLSearchParams(window.location.search).get('tab');
let activeTab = TABS.includes(requestedTab) ? requestedTab : TABS.find((tab) => CAN_EDIT_TAB[tab]) ?? 'pricing';

function showTab(tab, { focus = false } = {}) {
  activeTab = tab;
  TABS.forEach((name) => {
    const button = qs(`#tab-${name}`);
    const on = name === tab;
    button.classList.toggle('active', on);
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
    qs(`#pane-${name}`).hidden = !on;
  });
  if (focus) qs(`#tab-${tab}`).focus();
  // A tab this role can't change, or one already waiting for approval, has no button.
  qs('#policies-actions').hidden = !CAN_EDIT_TAB[tab] || Boolean(policies?.pending?.[tab]);
  errorBox.textContent = '';
  errorBox.classList.remove('is-visible');
  const params = new URLSearchParams(window.location.search);
  params.set('tab', tab);
  history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

TABS.forEach((name, index) => {
  const button = qs(`#tab-${name}`);
  button.addEventListener('click', () => showTab(name));
  // Arrow keys move between tabs (WAI-ARIA tabs pattern); RTL flips them.
  button.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const dir = document.documentElement.dir === 'rtl' ? -step : step;
    showTab(TABS[(index + dir + TABS.length) % TABS.length], { focus: true });
  });
});

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
    key: 'feePercent',
    label: t('policies.feePercentLabel'),
    unit: '%',
    hint: t('policies.feePercentHint'),
    integer: false,
    min: 0,
    max: 100,
    emptyError: t('policies.feePercentEmpty'),
    invalidError: t('zones.amountInvalid'),
    rangeError: t('policies.feePercentRange'),
  },
  {
    key: 'feeMin',
    label: t('policies.feeMinLabel'),
    unit: t('policies.unitEgp'),
    hint: t('policies.feeMinHint'),
    integer: false,
    min: 0,
    max: 1000,
    emptyError: t('policies.feeMinEmpty'),
    invalidError: t('zones.amountInvalid'),
    rangeError: t('policies.feeRange'),
  },
  {
    key: 'feeMax',
    label: t('policies.feeMaxLabel'),
    unit: t('policies.unitEgp'),
    hint: t('policies.feeMaxHint'),
    integer: false,
    min: 0,
    max: 1000,
    emptyError: t('policies.feeMaxEmpty'),
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

/** #7037 — pickup geofence: accepted distance for "I've Arrived" (#4093). */
const GEOFENCE_FIELDS = [
  {
    key: 'pickupGeofenceMeters',
    label: t('policies.geofenceLabel'),
    unit: t('policies.unitMeters'),
    hint: t('policies.geofenceHint'),
    integer: true,
    min: 50,
    max: 300,
    emptyError: t('policies.geofenceEmpty'),
    invalidError: t('policies.geofenceInvalid'),
    rangeError: t('policies.geofenceRange'),
  },
];

const TIME_PATTERN =/^([01]\d|2[0-3]):[0-5]\d$/;

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
let geofenceControls = [];

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

  const geofenceHost = qs('#geofence-fields');
  geofenceHost.textContent = '';
  geofenceControls = GEOFENCE_FIELDS.map((spec) => renderField(geofenceHost, spec, policies.pickupGeofence[spec.key]));
  qs('#geofence-meta').textContent = lastChanged(policies.pickupGeofence);

  qs('#cancel-meta').textContent = lastChanged(policies.cancellation);
  qs('#commission-meta').textContent = lastChanged(policies.commission);
  qs('#balance-meta').textContent = lastChanged(policies.driverBalance);

  updateCommissionExample();
  updateBalanceExample();
  updatePayoutExample();
  applyRoleLocks();
  TABS.forEach(renderTabPending);
  showTab(activeTab);
}

/** Every control on a tab. */
function tabControls(tab) {
  if (tab === 'pricing') return [...cancellationControls, commissionControl];
  if (tab === 'finance') return [...balanceControls, ...payoutControls];
  return [...hoursControls, ...geofenceControls];
}

/** A section this role cannot change is read-only (inputs read-only, never a button). */
function applyRoleLocks() {
  TABS.forEach((tab) => tabControls(tab).forEach((c) => {
    const editable = CAN_EDIT_TAB[tab];
    // A select has no read-only state; it is disabled instead.
    if (c.spec.type === 'select') c.input.disabled ||= !editable;
    else c.input.readOnly = !editable;
    if (!editable) c.input.setAttribute('aria-readonly', 'true');
  }));
}

const PENDING_TITLE = {
  pricing: 'pricingApproval.pricingTabPending',
  finance: 'pricingApproval.financeTabPending',
  operations: 'pricingApproval.operationsTabPending',
};

/**
 * 2026-11-15 — one request covers the whole tab. While it waits, one banner at
 * the top of the tab says so, every field on it is locked and its cards are
 * tinted, and the tab has no button.
 */
function renderTabPending(tab) {
  const pending = policies.pending?.[tab] ?? null;
  qs(`#${tab}-pending`).hidden = !pending;
  tabControls(tab).forEach((c) => {
    c.input.disabled = Boolean(pending) || (c.spec.type === 'select' && !CAN_EDIT_TAB[tab]);
    if (pending) c.input.title = t('pricingApproval.lockedTitle');
    else c.input.removeAttribute('title');
  });
  qs(`#pane-${tab}`).querySelectorAll('.standard-card-theme2').forEach((card) => {
    // The kit tints a card whose change is waiting on someone else.
    card.classList.toggle('warning-alert-bg', Boolean(pending));
    card.classList.toggle('warning-alert-br', Boolean(pending));
    card.classList.toggle('white-bg', !pending);
  });
  if (!pending) return;
  qs(`#${tab}-pending-title`).textContent = t(PENDING_TITLE[tab]);
  qs(`#${tab}-pending-meta`).textContent = t(tab === 'operations' ? 'pricingApproval.tabPendingMetaOps' : 'pricingApproval.tabPendingMeta', {
    who: pending.maker,
    when: formatDateTime(pending.madeAt),
  });
  qs(`#${tab}-pending-link`).href = approvalHref(pending.id);
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

/** The fee on one payout: its percentage, held between the minimum and the maximum. */
function feeOn(amount, pct, min, max) {
  return Math.round(Math.min(max, Math.max(min, (amount * pct) / 100)) * 100) / 100;
}

function updatePayoutExample() {
  const value = (key) => payoutControls.find((c) => c.spec.key === key).input.value;
  const [pct, min, max] = ['feePercent', 'feeMin', 'feeMax'].map((k) => Number(value(k)));
  const amount = 500;
  const fee = feeOn(amount, pct, min, max);
  qs('#payout-example').textContent = [pct, min, max].some(Number.isNaN)
    ? ''
    : t(value('feePaidBy') === 'driver' ? 'policies.payoutExampleDriver' : 'policies.payoutExampleShedrive', {
      amount: formatEgp(amount),
      sent: formatEgp(amount - fee),
      fee: formatEgp(fee),
    });
}

/**
 * The fee's maximum is not below its minimum; when the driver pays the fee, a
 * payout at the minimum must still be more than the fee on it.
 */
function validatePayoutOrder() {
  const [minimum, pct, feeMin, feeMax, payer] = payoutControls;
  if (Number(feeMax.input.value) < Number(feeMin.input.value)) {
    showError(feeMax, t('policies.feeMaxBelowMin'));
    return false;
  }
  const amount = Number(minimum.input.value);
  const fee = feeOn(amount, Number(pct.input.value), Number(feeMin.input.value), Number(feeMax.input.value));
  if (payer.input.value === 'driver' && amount <= fee) {
    showError(minimum, t('policies.minimumAboveFee'));
    return false;
  }
  return true;
}

// ── Send the open tab for approval (2026-11-15) ───────

const valueOf = (c) => (c.spec.type === 'select' || c.spec.type === 'time' ? c.input.value : Number(c.input.value));

/** The tab's saved values, keyed like its fields. */
function savedValues(tab) {
  if (tab === 'pricing') return { ...policies.cancellation, percentage: policies.commission.percentage };
  if (tab === 'finance') return { ...policies.driverBalance, ...policies.payout };
  return { ...policies.operatingHours, ...policies.pickupGeofence };
}

const errorBox = qs('#policies-error');

qs('#policies-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  errorBox.classList.remove('is-visible');

  const tab = activeTab;
  if (!CAN_EDIT_TAB[tab] || policies.pending?.[tab]) return;
  const controls = tabControls(tab);
  const results = controls.map(validate);
  if (!results.includes(false)) {
    if (tab === 'finance' && !validatePayoutOrder()) results[balanceControls.length] = false;
    if (tab === 'operations' && !validateHoursOrder()) results[hoursControls.length - 1] = false;
  }
  if (results.includes(false)) {
    const firstInvalid = controls.find((c) => c.input.getAttribute('aria-invalid') === 'true') ?? controls[results.indexOf(false)];
    firstInvalid.input.focus();
    return;
  }

  const saved = savedValues(tab);
  const values = Object.fromEntries(controls.map((c) => [c.spec.key, valueOf(c)]));
  if (controls.every((c) => String(values[c.spec.key]) === String(saved[c.spec.key]))) {
    shell.showToast(t('kitPricing.nothingChanged'), 'info');
    return;
  }

  const saveBtn = qs('#policies-save');
  saveBtn.disabled = true;
  try {
    const result = await mockApi.savePolicies({ tab, values });
    policies = await mockApi.getPolicies();
    // The re-render redraws every tab; keep what she typed on the tabs she didn't send.
    const kept = [...document.querySelectorAll('.policies-pane[hidden] input, .policies-pane[hidden] select')]
      .map((input) => [input.id, input.value]);
    render();
    kept.forEach(([inputId, value]) => {
      const input = document.getElementById(inputId);
      if (input && !input.disabled) input.value = value;
    });
    updateBalanceExample();
    updatePayoutExample();
    updateCommissionExample();
    // A toast, not the kit's popup-success: nothing here needs a decision.
    shell.showToast(t(tab === 'operations' ? 'pricingApproval.tabSentOps' : 'pricingApproval.tabSent', { tab: t(TAB_LABEL[tab]) }), 'success', {
      title: t('kitPricing.sentTitle'),
      action: result.request?.id ? { label: t('pricingApproval.viewRequest'), href: approvalHref(result.request.id) } : null,
    });
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('is-visible');
  } finally {
    saveBtn.disabled = false;
  }
});

const TAB_LABEL = { pricing: 'policies.tabPricing', finance: 'policies.tabFinance', operations: 'policies.tabOperations' };

// ── Revert ────────────────────────────────────────────

qs('#policies-revert').addEventListener('click', () => {
  errorBox.classList.remove('is-visible');
  // Reverts the open tab only; another tab's unsaved edits stay.
  if (activeTab === 'pricing') revertPricing();
  if (activeTab === 'finance') revertFinance();
  if (activeTab === 'operations') revertOperations();
});

function revertPricing() {
  cancellationControls.forEach((c) => {
    c.input.value = policies.cancellation[c.spec.key];
    clearError(c);
  });
  commissionControl.input.value = policies.commission.percentage;
  clearError(commissionControl);
  updateCommissionExample();
}

function revertFinance() {
  balanceControls.forEach((c) => {
    c.input.value = policies.driverBalance[c.spec.key] ?? '';
    clearError(c);
  });
  payoutControls.forEach((c) => {
    c.input.value = policies.payout[c.spec.key] ?? '';
    clearError(c);
  });
  updateBalanceExample();
  updatePayoutExample();
}

function revertOperations() {
  hoursControls.forEach((c) => {
    c.input.value = policies.operatingHours[c.spec.key];
    clearError(c);
  });
  geofenceControls.forEach((c) => {
    c.input.value = policies.pickupGeofence[c.spec.key];
    clearError(c);
  });
}

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

showTab(activeTab);

try {
  policies = await mockApi.getPolicies();
  render();
} catch (error) {
  renderLoadError(error);
}
