/**
 * reports.js — SheDrive admin revenue & commission summary
 * #1832: date range + optional zone filter, five totals, a zero state for an
 * idle period, a reconciliation proof, and CSV export.
 *
 * Kit v22-09 port (2026-10-14): the kit's revenue-summary — the filter row
 * (zone-name search, zone, date range) straight under the title, five KPI
 * widgets in the kit's tones, and our reconciliation check as a kit card.
 * The zone-name search narrows "All zones" to the zones whose name matches;
 * a selected zone always wins over the search text.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { ZONES } from './seed.js';
import { downloadCsv, formatCount, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#report-filters');
const errorBox = qs('#report-error');
const CARD_IDS = ['card-trips', 'card-gross', 'card-commission', 'card-fees', 'card-net'];

const query = { search: '', from: '', to: '', zoneId: 'all' };
let summary = null;

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: t('reports.zone'),
    placeholder: t('kitPricing.zoneSearchPlaceholder'),
    grow: true,
    maxLength: 60,
  },
  {
    type: 'select',
    key: 'zoneId',
    label: t('reports.zone'),
    value: 'all',
    options: [
      { value: 'all', label: t('reports.allZones') },
      ...ZONES.map((zone) => ({ value: String(zone.id), label: zone.name })),
    ],
  },
  { type: 'daterange', key: 'date', label: t('reports.dateRange'), fromKey: 'from', toKey: 'to' },
];

/** What the CSV and the summary say the figures cover. */
function scopeLabel() {
  if (query.zoneId !== 'all') {
    return ZONES.find((z) => String(z.id) === String(query.zoneId))?.name ?? query.zoneId;
  }
  const term = query.search.trim();
  return term ? t('kitPricing.zonesMatching', { term }) : t('reports.allZones');
}

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: () => {
      if (!summary) return;
      downloadCsv(
        `shedrive-revenue-${toDateInputValue(Date.now())}.csv`,
        [t('reports.csvMetric'), t('reports.csvValue')],
        [
          [t('reports.csvDateFrom'), query.from || t('reports.csvAllTime')],
          [t('reports.csvDateTo'), query.to || t('reports.csvAllTime')],
          [t('reports.zone'), scopeLabel()],
          [t('reports.cardTrips'), summary.completedTrips],
          [t('reports.csvGross'), summary.grossFares.toFixed(2)],
          [t('reports.csvCommission'), summary.commission.toFixed(2)],
          [t('reports.csvFees'), summary.cancellationFees.toFixed(2)],
          [t('reports.csvNet'), summary.netDriverEarnings.toFixed(2)],
        ],
      );
    },
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  load();
});

// ── Reconciliation check card (#1832 S4) ──────────────

function listRow(label, value, tone = '') {
  const row = document.createElement('div');
  row.className = 'row gx-0 list-row';
  const key = document.createElement('div');
  key.className = 'list-item col text-bold';
  key.textContent = label;
  const val = document.createElement('div');
  val.className = `list-item col-auto justify-content-md-end ad-ltr ${tone}`.trim();
  val.textContent = value;
  row.append(key, val);
  return row;
}

function renderReconciliation(data) {
  const host = qs('#recon-rows');
  const verdict = qs('#recon-verdict');
  host.textContent = '';

  const sum = Math.round((data.commission + data.netDriverEarnings) * 100) / 100;
  const gross = Math.round(data.grossFares * 100) / 100;
  const balanced = Math.abs(sum - gross) < 0.01;

  host.append(
    listRow(t('reports.cardCommission'), formatEgp(data.commission)),
    listRow(t('reports.cardNet'), formatEgp(data.netDriverEarnings)),
    listRow(t('reports.sumRow'), formatEgp(sum), 'text-bold'),
    listRow(t('reports.cardGross'), formatEgp(gross), balanced ? 'text-bold success-color' : 'text-bold danger-color'),
  );

  verdict.className = balanced ? 'small mt-3 mb-0 success-color' : 'small mt-3 mb-0 warning-color text-bold';
  verdict.textContent = balanced
    ? t('reports.balanced')
    : t('reports.unbalanced', { amount: formatEgp(Math.abs(sum - gross)) });
}

// ── Load ──────────────────────────────────────────────

const ZERO = { completedTrips: 0, grossFares: 0, commission: 0, cancellationFees: 0, netDriverEarnings: 0 };
const round2 = (n) => Math.round(n * 100) / 100;

/** One zone, all zones, or the sum over the zones whose name matches the search. */
async function fetchSummary() {
  const term = query.search.trim().toLowerCase();
  if (query.zoneId !== 'all' || !term) {
    return mockApi.getRevenueSummary({ from: query.from, to: query.to, zoneId: query.zoneId });
  }
  const zones = ZONES.filter((z) => z.name.toLowerCase().includes(term));
  const parts = await Promise.all(
    zones.map((z) => mockApi.getRevenueSummary({ from: query.from, to: query.to, zoneId: String(z.id) })),
  );
  return parts.reduce(
    (acc, part) => ({
      completedTrips: acc.completedTrips + part.completedTrips,
      grossFares: round2(acc.grossFares + part.grossFares),
      commission: round2(acc.commission + part.commission),
      cancellationFees: round2(acc.cancellationFees + part.cancellationFees),
      netDriverEarnings: round2(acc.netDriverEarnings + part.netDriverEarnings),
    }),
    { ...ZERO },
  );
}

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  errorBox.classList.remove('is-visible');
  CARD_IDS.forEach((id) => {
    qs(`#${id}`).value = '…';
  });

  try {
    const data = await fetchSummary();
    if (!isCurrent()) return;
    summary = data;

    qs('#card-trips').value = formatCount(data.completedTrips);
    qs('#card-gross').value = formatEgp(data.grossFares);
    qs('#card-commission').value = formatEgp(data.commission);
    qs('#card-fees').value = formatEgp(data.cancellationFees);
    qs('#card-net').value = formatEgp(data.netDriverEarnings);

    // #1832 S3 — an idle period shows zeros, not an error.
    const meta = data.completedTrips === 0 ? t('reports.noTrips') : '';
    CARD_IDS.forEach((id) => {
      qs(`#${id}`).meta = meta;
    });

    renderReconciliation(data);
  } catch (error) {
    if (!isCurrent()) return;
    summary = null;
    errorBox.textContent = t('reports.loadError', { message: error.message });
    errorBox.classList.add('is-visible');
    CARD_IDS.forEach((id) => {
      qs(`#${id}`).value = '—';
      qs(`#${id}`).meta = '';
    });
    qs('#recon-rows').textContent = '';
    qs('#recon-verdict').textContent = '';
  }
}

load();
