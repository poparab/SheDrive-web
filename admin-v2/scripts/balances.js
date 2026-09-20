/**
 * balances.js — SheDrive admin driver balances & settlement (#1813)
 *
 * Same controller as admin/, with every user-visible string routed through t()
 * — admin-v2 is bilingual (see I18N-PORT.md).
 *
 * The balance is never edited. Recording a settlement or a payout appends an
 * immutable entry to the driver's ledger (#TBD-A) and the balance is recomputed
 * from it — which is also what unblocks her go-online (#TBD-F). The Phase 1
 * ledger has no correction mechanism: the post-adjustment action was cut
 * deliberately (spec §10) to keep Phase 1 simple.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDate, formatDateTime, formatEgp, toDateInputValue, downloadCsv } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { assetUrl } from '../components/ad-styles.js';
import { bindLightbox } from './design-init.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#balance-filters');
const table = qs('#balance-table');
const ledgerPanel = qs('#ledger-panel');
const ledgerTable = qs('#ledger-table');
const modal = qs('#balance-modal');

const query = { search: '', filter: 'owing', page: 1, pageSize: 20, sort: { key: 'balance', dir: 'asc' } };
const ledgerQuery = { driverId: '', page: 1, pageSize: 20 };

let options = { settlementMethods: [], payoutMethods: [], policy: {} };
let selected = null;

/**
 * One signed balance in EGP, rendered with its sign: negative means she owes
 * the platform, positive means the platform owes her. There is no second
 * number — "outstanding" and "available" are just the two signs of this one.
 */
function signedEgp(balance) {
  if (!balance) return formatEgp(0);
  return balance > 0 ? `+${formatEgp(balance)}` : `−${formatEgp(Math.abs(balance))}`;
}

/** What she owes the platform: the magnitude of a negative balance, else 0. */
function amountOwed(driver) {
  return driver.balance < 0 ? Math.abs(driver.balance) : 0;
}

/** What the platform owes her: the magnitude of a positive balance, else 0. */
function amountOwedToHer(driver) {
  return driver.balance > 0 ? driver.balance : 0;
}

/**
 * The receipt photo or transfer slip attached to a money movement (#3982).
 * Seeded entries carry a placeholder path; one recorded in this session carries
 * the data URL of the image the admin picked. Both open in the kit's lightbox.
 */
function proofLink(proof) {
  const href = proof.dataUrl ?? assetUrl(proof.src ?? '');
  if (!href) return null;
  const link = document.createElement('a');
  link.className = 'photo-trigger ledger-proof';
  link.href = href;
  link.title = t('balances.proofAlt');
  const thumb = document.createElement('img');
  thumb.src = href;
  thumb.alt = t('balances.proofAlt');
  const label = document.createElement('span');
  label.textContent = t('balances.proofView');
  link.append(thumb, label);
  return link;
}

const ENTRY_LABEL_KEYS = {
  trip_commission: 'balances.entryTripCommission',
  trip_earnings: 'balances.entryTripEarnings',
  driver_cancellation_fee: 'balances.entryDriverCancellationFee',
  rider_cancellation_fee_credit: 'balances.entryRiderCancellationFeeCredit',
  settlement: 'balances.entrySettlement',
  payout: 'balances.entryPayout',
};

// ── Filters ──────────────────────────────────────────
filters.fields = [
  { type: 'search', key: 'search', label: t('common.name'), placeholder: t('common.search') },
  {
    type: 'select',
    key: 'filter',
    label: t('balances.filterBalance'),
    value: 'owing',
    options: [
      { value: 'owing', label: t('balances.owing') },
      { value: 'owed', label: t('balances.owed') },
      { value: 'settled', label: t('balances.settled') },
      { value: 'all', label: t('common.all') },
    ],
  },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: async () => {
      const all = await mockApi.listDriverBalances({ ...query, page: 1, pageSize: 1000 });
      downloadCsv(
        `${t('balances.csvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('common.name'),
          t('balances.colBalance'),
          t('balances.colLastSettlement'),
          t('balances.colGoOnline'),
        ],
        all.rows.map((r) => [
          r.name,
          r.balance.toFixed(2),
          r.lastSettlementAt ? formatDate(r.lastSettlementAt) : '',
          r.goOnlineBlocked ? t('balances.csvBlockedYes') : t('balances.csvBlockedNo'),
        ]),
      );
    },
  },
  {
    // The settlement day-book screen was cut (spec §10); this is the one part
    // of it worth keeping — the export Finance reconciles against the bank.
    label: t('balances.exportSettlementsCsv'),
    variant: 'ghost',
    onClick: async () => {
      const rows = await mockApi.listSettlementEntries();
      downloadCsv(
        `${t('balances.settlementsCsvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('common.name'),
          t('balances.colAmount'),
          t('balances.settleMethod'),
          t('balances.settlementsColReference'),
          t('balances.settlementsColReceipt'),
          t('balances.settlementsColAdmin'),
          t('balances.settlementsColTime'),
        ],
        rows.map((r) => [
          r.driverName,
          r.amount.toFixed(2),
          r.method ?? '',
          r.note ?? '',
          r.ref ?? '',
          r.actor ?? '',
          formatDateTime(r.at),
        ]),
      );
    },
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  closeLedger();
  load();
});

// ── Balances table ───────────────────────────────────
table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  { key: 'name', label: t('common.name'), sortable: true, render: (row) => row.name },
  {
    // One signed balance, never two columns: negative means she owes the
    // platform, positive means the platform owes her (#1813).
    key: 'balance',
    label: t('balances.colBalance'),
    sortable: true,
    numeric: true,
    render: (row) => signedEgp(row.balance),
  },
  {
    key: 'lastSettlementAt',
    label: t('balances.colLastSettlement'),
    sortable: true,
    render: (row) => (row.lastSettlementAt ? formatDate(row.lastSettlementAt) : null),
  },
  {
    key: 'goOnlineBlocked',
    label: t('balances.colGoOnline'),
    render: (row) => {
      const pill = document.createElement('span');
      pill.className = `badge ${row.goOnlineBlocked ? 'badge--danger' : 'badge--neutral'}`;
      pill.textContent = row.goOnlineBlocked ? t('balances.blocked') : t('balances.allowed');
      return pill;
    },
  },
  {
    key: 'ledger',
    label: '',
    render: (row) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--ghost btn--sm';
      button.textContent = t('balances.ledger');
      button.addEventListener('click', () => openLedger(row));
      return button;
    },
  },
];
table.emptyState = {
  icon: '⇌',
  heading: t('balances.emptyHeading'),
  message: t('balances.emptyMessage'),
};

table.addEventListener('sortchange', (event) => {
  query.sort = event.detail;
  table.sort = event.detail;
  load();
});
table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

// ── Ledger panel ─────────────────────────────────────
ledgerTable.pageSize = ledgerQuery.pageSize;
ledgerTable.columns = [
  { key: 'at', label: t('balances.colDate'), render: (row) => formatDate(row.at) },
  { key: 'type', label: t('balances.colType'), render: (row) => (ENTRY_LABEL_KEYS[row.type] ? t(ENTRY_LABEL_KEYS[row.type]) : row.type) },
  {
    key: 'amount',
    label: t('balances.colAmount'),
    numeric: true,
    render: (row) => {
      const span = document.createElement('span');
      span.className = row.amount >= 0 ? 'ledger-amount ledger-amount--credit' : 'ledger-amount ledger-amount--debit';
      span.textContent = `${row.amount >= 0 ? '+' : '−'}${formatEgp(Math.abs(row.amount))}`;
      return span;
    },
  },
  { key: 'source', label: t('balances.colSource'), render: (row) => row.tripId ?? row.ref ?? null },
  {
    // The note column was dropped (#4381) — the entry type already names the
    // cause of every row. What replaces it is the proof image attached when
    // the settlement or payout was recorded (#3982).
    key: 'proof',
    label: t('balances.colProof'),
    render: (row) => (row.proof ? proofLink(row.proof) : null),
  },
];
ledgerTable.emptyState = {
  icon: '☐',
  heading: t('balances.ledgerEmptyHeading'),
  message: t('balances.ledgerEmptyMessage'),
};
ledgerTable.addEventListener('pagechange', (event) => {
  ledgerQuery.page = event.detail.page;
  loadLedger();
});

qs('#ledger-close').addEventListener('click', closeLedger);

function closeLedger() {
  selected = null;
  ledgerPanel.hidden = true;
}

async function openLedger(row) {
  selected = row;
  ledgerQuery.driverId = row.id;
  ledgerQuery.page = 1;
  ledgerPanel.hidden = false;
  qs('#ledger-title').textContent = t('balances.ledgerFor', { name: row.name });
  ledgerPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await loadLedger();
}

function renderLedgerSummary(driver) {
  const summary = qs('#ledger-summary');
  summary.textContent = '';
  const pairs = [[t('balances.statBalance'), signedEgp(driver.balance)]];
  pairs.forEach(([label, value]) => {
    const cell = document.createElement('div');
    cell.className = 'balance-ledger__stat';
    const l = document.createElement('span');
    l.className = 'balance-ledger__stat-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'balance-ledger__stat-value';
    v.textContent = value;
    cell.append(l, v);
    summary.appendChild(cell);
  });

  // Settling is only meaningful when the balance is negative (#1813 S7).
  qs('#btn-settle').disabled = driver.balance >= 0;

  // A payout only needs money owed — the platform holds no payout destination
  // and getting the money to her is a manual, off-platform process (spec §5).
  qs('#btn-payout').disabled = !(driver.balance > 0);
}

const ledgerGuard = createRequestGuard();

async function loadLedger() {
  if (!selected) return;
  const isCurrent = ledgerGuard();
  ledgerTable.setLoading();
  try {
    const result = await mockApi.getDriverLedger(ledgerQuery);
    if (!isCurrent()) return;
    renderLedgerSummary(result.driver);
    selected = { ...selected, ...result.driver };
    ledgerTable.setData(result);
    bindLightbox(ledgerTable);
  } catch (error) {
    if (!isCurrent()) return;
    ledgerTable.setError(error.message, loadLedger);
  }
}

// ── Record settlement (#1813 S3–S7) ──────────────────
qs('#btn-settle').addEventListener('click', () => {
  if (!selected) return;
  const max = amountOwed(selected);
  modal.open({
    title: t('balances.settleTitle', { name: selected.name }),
    description: t('balances.settleDescription', { amount: formatEgp(max) }),
    confirmLabel: t('balances.recordSettlement'),
    fields: [
      {
        key: 'amount',
        type: 'number',
        // Deliberately uncapped (#3982, 2026-09-17): a driver may hand back
        // more than she owes, and the surplus becomes an available balance.
        required: true,
        label: t('balances.settleAmount'),
        min: 0.01,
        step: 0.01,
        emptyError: t('balances.errAmountEmpty'),
        invalidError: t('balances.errAmountInvalid'),
        rangeError: t('balances.errAmountRange'),
      },
      {
        key: 'date',
        type: 'date',
        label: t('balances.settleDate'),
        required: true,
        value: toDateInputValue(Date.now()),
        max: toDateInputValue(Date.now()),
        emptyError: t('balances.errDateEmpty'),
        invalidError: t('balances.errDateInvalid'),
        rangeError: t('balances.errDateFuture'),
      },
      {
        key: 'method',
        type: 'select',
        label: t('balances.settleMethod'),
        required: true,
        value: options.settlementMethods[0] ?? '',
        options: options.settlementMethods.map((m) => ({ value: m, label: m })),
        emptyError: t('balances.errMethodEmpty'),
      },
      {
        key: 'note',
        type: 'textarea',
        label: t('balances.settleNote'),
        maxLength: 500,
        lengthError: t('balances.errNoteLength'),
      },
      {
        key: 'proof',
        type: 'image',
        label: t('balances.settleProof'),
        hint: t('balances.settleProofHint'),
      },
    ],
    onConfirm: async (values) => {
      const paid = Number(values.amount);
      await mockApi.recordSettlement(selected.id, values);
      // She may pay more than she owed; say so, because her row flips from
      // outstanding to available the moment the entry posts.
      const surplus = paid > max ? paid - max : 0;
      shell.showToast(
        surplus
          ? t('balances.settleDoneSurplus', { amount: formatEgp(surplus) })
          : t('balances.settleDone'),
        'success',
      );
      await Promise.all([load(), loadLedger()]);
    },
  });
});

// ── Record payout (spec §5/§6) ───────────────────────
// The mirror of a settlement, in the opposite direction: Finance has already
// sent the money, and this only writes it down. There is no request, no
// approval and nothing for the driver to have initiated.
qs('#btn-payout').addEventListener('click', () => {
  if (!selected) return;
  const max = amountOwedToHer(selected);
  modal.open({
    title: t('balances.payoutTitle', { name: selected.name }),
    description: t('balances.payoutDescription', { amount: formatEgp(max) }),
    confirmLabel: t('balances.recordPayout'),
    fields: [
      {
        key: 'amount',
        type: 'number',
        label: t('balances.payoutAmount'),
        required: true,
        min: 0.01,
        max,
        step: 0.01,
        emptyError: t('balances.errPayoutAmountEmpty'),
        invalidError: t('balances.errPayoutAmountInvalid'),
        rangeError: t('balances.errPayoutAmountRange', { max: formatEgp(max) }),
      },
      {
        key: 'date',
        type: 'date',
        label: t('balances.payoutDate'),
        required: true,
        value: toDateInputValue(Date.now()),
        max: toDateInputValue(Date.now()),
        emptyError: t('balances.errPayoutDateEmpty'),
        invalidError: t('balances.errPayoutDateInvalid'),
        rangeError: t('balances.errPayoutDateFuture'),
      },
      {
        key: 'reference',
        type: 'text',
        label: t('balances.payoutReference'),
        required: true,
        maxLength: 60,
        emptyError: t('balances.errPayoutReferenceEmpty'),
        lengthError: t('balances.errPayoutReferenceLength'),
      },
      {
        key: 'proof',
        type: 'image',
        label: t('balances.payoutProof'),
        hint: t('balances.payoutProofHint'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.recordPayout(selected.id, values);
      shell.showToast(t('balances.payoutDone'), 'success');
      await Promise.all([load(), loadLedger()]);
    },
  });
});

// ── Summary cards ────────────────────────────────────
async function loadStats() {
  const all = await mockApi.listDriverBalances({ filter: 'all', page: 1, pageSize: 1000 });
  // The cards are fleet aggregates over the one signed balance, not a second
  // per-driver number: negative balances are what the fleet owes the platform.
  const owing = all.rows.filter((r) => r.balance < 0);
  qs('#card-owing').value = String(owing.length);
  qs('#card-outstanding').value = formatEgp(owing.reduce((sum, r) => sum + Math.abs(r.balance), 0));
  qs('#card-owed').value = String(all.rows.filter((r) => r.balance > 0).length);
  qs('#card-blocked').value = String(all.rows.filter((r) => r.goOnlineBlocked).length);
  qs('#card-blocked').meta = options.policy.outstandingLimit
    ? t('balances.limitMeta', { limit: formatEgp(options.policy.outstandingLimit) })
    : t('balances.limitDisabled');
}

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listDriverBalances(query);
    if (!isCurrent()) return;
    table.setData(result);
    loadStats();
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

options = await mockApi.getFinanceOptions();
load();
