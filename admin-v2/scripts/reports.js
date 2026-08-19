/**
 * reports.js — SheDrive admin revenue & commission summary
 * #1832: date range + optional zone filter, five totals, a zero state for an
 * idle period, a reconciliation proof, and CSV export.
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

const query = { from: '', to: '', zoneId: 'all' };
let summary = null;

filters.fields = [
  { type: 'daterange', key: 'date', label: t('reports.dateRange'), fromKey: 'from', toKey: t('common.to') },
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
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: () => {
      if (!summary) return;
      const zoneLabel =
        query.zoneId === 'all'
          ? t('reports.allZones')
          : (ZONES.find((z) => String(z.id) === String(query.zoneId))?.name ?? query.zoneId);
      downloadCsv(
        `shedrive-revenue-${toDateInputValue(Date.now())}.csv`,
        [t('reports.csvMetric'), t('reports.csvValue')],
        [
          [t('reports.csvDateFrom'), query.from || t('reports.csvAllTime')],
          [t('reports.csvDateTo'), query.to || t('reports.csvAllTime')],
          [t('reports.zone'), zoneLabel],
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

function moneyRow(label, value, total = false) {
  const row = document.createElement('div');
  row.className = total ? 'detail__money-row detail__money-row--total' : 'detail__money-row';
  const key = document.createElement('span');
  key.className = 'detail__money-label';
  key.textContent = label;
  const val = document.createElement('span');
  val.className = 'detail__money-value';
  val.textContent = value;
  row.append(key, val);
  return row;
}

function renderReconciliation(data) {
  const host = qs('#recon-rows');
  host.textContent = '';

  const sum = Math.round((data.commission + data.netDriverEarnings) * 100) / 100;
  const gross = Math.round(data.grossFares * 100) / 100;
  const balanced = Math.abs(sum - gross) < 0.01;

  host.append(
    moneyRow(t('policies.commissionHeading'), formatEgp(data.commission)),
    moneyRow(t('reports.cardNet'), formatEgp(data.netDriverEarnings)),
    moneyRow(t('reports.sumRow'), formatEgp(sum), true),
    moneyRow(t('reports.cardGross'), formatEgp(gross)),
  );

  const verdict = document.createElement('p');
  verdict.className = balanced ? 'pricing__meta' : 'pricing__warning';
  verdict.style.marginBlockStart = 'var(--space-3)';
  verdict.textContent = balanced
    ? t('reports.balanced')
    : `⚠ Out by ${formatEgp(Math.abs(sum - gross))} — this would be a data problem, not a rounding one.`;
  host.appendChild(verdict);
}

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  errorBox.classList.remove('is-visible');
  ['card-trips', 'card-gross', 'card-commission', 'card-fees', 'card-net'].forEach((id) => {
    qs(`#${id}`).value = '…';
  });

  try {
    const data = await mockApi.getRevenueSummary(query);
    if (!isCurrent()) return;
    summary = data;

    qs('#card-trips').value = formatCount(data.completedTrips);
    qs('#card-gross').value = formatEgp(data.grossFares);
    qs('#card-commission').value = formatEgp(data.commission);
    qs('#card-fees').value = formatEgp(data.cancellationFees);
    qs('#card-net').value = formatEgp(data.netDriverEarnings);

    // #1832 S3 — an idle period shows zeros, not an error.
    const meta = data.completedTrips === 0 ? t('reports.noTrips') : '';
    ['card-trips', 'card-gross', 'card-commission', 'card-fees', 'card-net'].forEach((id) => {
      qs(`#${id}`).meta = meta;
    });

    renderReconciliation(data);
  } catch (error) {
    if (!isCurrent()) return;
    summary = null;
    errorBox.textContent = `Could not load the summary: ${error.message}`;
    errorBox.classList.add('is-visible');
    ['card-trips', 'card-gross', 'card-commission', 'card-fees', 'card-net'].forEach((id) => {
      qs(`#${id}`).value = '—';
    });
    qs('#recon-rows').textContent = '';
  }
}

load();
