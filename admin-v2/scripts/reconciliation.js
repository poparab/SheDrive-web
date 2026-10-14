/**
 * reconciliation.js — SheDrive admin per-driver earnings & settlement
 * #1833: driver select (required) + date range, totals, cash-vs-digital split,
 * outstanding cash balance, per-trip rows at 20/page, empty state, CSV export.
 *
 * Recording a settlement, recording a payout and the full ledger live on
 * balances.html (#1813); this screen links across to it and reports the
 * resulting position.
 *
 * Kit v22-09 port (2026-10-14): the kit's reconciliation page — filter row
 * under the title, four KPI widgets, a "Per-trip breakdown" heading with
 * "Open driver balance" (→ driver-balance-details.html?id=<driverId>), and the
 * kit's coloured money columns and Cash / Digital chips.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { downloadCsv, formatCount, formatDate, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, isRtl } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#recon-filters');
const table = qs('#trip-table');
const report = qs('#report');
const noDriver = qs('#no-driver');
const errorBox = qs('#recon-error');

const query = { driverId: '', from: '', to: '', page: 1, pageSize: 20 };
let latest = null;

// ?state=error (or an outage) must render, not throw before the filter exists.
let drivers = [];
let driversError = null;
try {
  drivers = await mockApi.listSettleableDrivers();
} catch (error) {
  driversError = error;
}

// #4382: one searchable picker, matched on name *or* phone, replacing the
// kit's free-text box beside a name-only dropdown. An admin answering a
// payment query has the driver's number in front of her, not her spelling.
filters.fields = [
  {
    type: 'combobox',
    key: 'driverId',
    label: t('reconciliation.driver'),
    placeholder: t('reconciliation.driverPlaceholder'),
    value: '',
    grow: true,
    options: drivers.map((d) => ({
      value: String(d.id),
      label: d.name,
      meta: d.phone,
      note: d.status === 'approved' ? '' : t(`status.${d.status}`),
    })),
  },
  { type: 'daterange', key: 'date', label: t('reports.dateRange'), fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: () => {
      if (!latest) return;
      downloadCsv(
        `shedrive-settlement-${latest.driver.name.replace(/\s+/g, '-').toLowerCase()}-${toDateInputValue(Date.now())}.csv`,
        [
          t('reconciliation.colTripDate'),
          t('reconciliation.colPaymentMethod'),
          t('reconciliation.colFare'),
          t('reconciliation.colCommission'),
          t('reconciliation.colNet'),
        ],
        latest.rows.map((trip) => [
          formatDate(trip.createdAt),
          t(`status.${trip.paymentMethod ?? 'cash'}`),
          trip.fare.total.toFixed(2),
          trip.fare.commission.toFixed(2),
          trip.fare.netEarnings.toFixed(2),
        ]),
      );
    },
  },
];

filters.addEventListener('change', (event) => {
  const previousDriver = query.driverId;
  Object.assign(query, event.detail);
  if (query.driverId !== previousDriver) query.page = 1;
  load();
});

// ── Per-trip rows (#1833) ─────────────────────────────

table.pageSize = query.pageSize;
/** A money cell in the kit's colours: fare tertiary, commission −danger, net +success. */
function moneyCell(value, tone, sign = '') {
  const p = document.createElement('p');
  p.className = `text-bold ad-ltr ${tone}`;
  p.textContent = `${sign}${formatEgp(value)}`;
  return p;
}

table.columns = [
  {
    key: 'createdAt',
    label: t('reconciliation.colTripDate'),
    className: 'ad-table__nowrap',
    render: (trip) => formatDate(trip.createdAt),
  },
  { key: 'fare', label: t('reconciliation.colFare'), numeric: true, render: (trip) => moneyCell(trip.fare.total, 'tertiary-color') },
  {
    key: 'commission',
    label: t('reconciliation.colCommission'),
    numeric: true,
    render: (trip) => moneyCell(trip.fare.commission, 'danger-color', trip.fare.commission ? '-' : ''),
  },
  {
    key: 'net',
    label: t('reconciliation.colNet'),
    numeric: true,
    render: (trip) => moneyCell(trip.fare.netEarnings, 'success-color', trip.fare.netEarnings ? '+' : ''),
  },
  {
    // How the fare was taken decides who is holding the money, and so whether
    // the net on this row is cash she already has or a payout still owed.
    key: 'paymentMethod',
    label: t('reconciliation.colPaymentMethod'),
    className: 'ad-table__nowrap',
    render: (trip) => {
      const method = trip.paymentMethod ?? 'cash';
      const chip = document.createElement('span');
      chip.className = method === 'cash' ? 'status-blue-solid' : 'status-primary-solid';
      chip.textContent = t(`status.${method}`);
      return chip;
    },
  },
];

// The kit's forward arrow points the reading direction.
qs('#settle-link-icon').className = `fa-solid ${isRtl() ? 'fa-arrow-left' : 'fa-arrow-right'}`;

table.emptyState = {
  icon: '☐',
  heading: t('reports.noTrips'),
  message: t('reconciliation.tableEmptyMessage'),
};

table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

/** The kit's key/value list row. */
function moneyRow(label, value, total = false) {
  const row = document.createElement('div');
  row.className = 'row gx-0 list-row';
  const key = document.createElement('div');
  key.className = 'list-item col text-bold';
  key.textContent = label;
  const val = document.createElement('div');
  val.className = `list-item col-auto justify-content-md-end ad-ltr${total ? ' text-bold primary-color' : ''}`;
  val.textContent = value;
  row.append(key, val);
  return row;
}

const guard = createRequestGuard();

async function load() {
  errorBox.classList.remove('is-visible');

  if (driversError) {
    // The kit's danger result in place of "Select a driver".
    const state = noDriver.querySelector('ad-empty-state');
    state.removeAttribute('data-i18n-heading');
    state.removeAttribute('data-i18n-message');
    state.setAttribute('tone', 'danger');
    state.setAttribute('icon', 'cloud-connection-off.svg');
    state.setAttribute('heading', t('kitPricing.driversLoadError'));
    state.setAttribute('message', t('state.errorMessage'));
    noDriver.hidden = false;
    report.hidden = true;
    return;
  }

  // #1833 S2 — no driver selected means no report.
  if (!query.driverId) {
    noDriver.hidden = false;
    report.hidden = true;
    latest = null;
    return;
  }

  noDriver.hidden = true;
  report.hidden = false;
  qs('#settle-link').href = `driver-balance-details.html?id=${encodeURIComponent(query.driverId)}`;

  const isCurrent = guard();
  table.setLoading();

  try {
    const data = await mockApi.getDriverSettlement(query);
    if (!isCurrent()) return;
    latest = data;

    const totals = data.totals;
    qs('#card-trips').value = formatCount(totals.completedTrips);
    qs('#card-gross').value = formatEgp(totals.grossFares);
    qs('#card-commission').value = formatEgp(totals.commission);
    qs('#card-net').value = formatEgp(totals.netEarnings);

    const split = qs('#split-rows');
    split.textContent = '';
    split.append(
      moneyRow(t('reconciliation.splitCash'), formatEgp(totals.cashPortion)),
      moneyRow(t('reconciliation.splitDigital'), formatEgp(totals.digitalPortion)),
      moneyRow(t('reports.cardGross'), formatEgp(totals.grossFares), true),
      moneyRow(t('reconciliation.cardBalance'), formatEgp(totals.outstandingCashBalance)),
    );

    table.setData(data);
  } catch (error) {
    if (!isCurrent()) return;
    latest = null;
    errorBox.textContent = t('reconciliation.loadError', { message: error.message });
    errorBox.classList.add('is-visible');
    table.setError(error.message, load);
  }
}

load();
