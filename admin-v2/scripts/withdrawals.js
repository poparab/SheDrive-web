/**
 * withdrawals.js — SheDrive admin driver withdrawal requests (#TBD-E)
 *
 * Same controller as admin/, with every user-visible string routed through t()
 * — admin-v2 is bilingual (see I18N-PORT.md).
 *
 * Approve and reject are decisions; only "Mark paid" moves money, and it is the
 * step that posts the withdrawal debit to the driver's ledger (#TBD-A). A rejected
 * or cancelled request releases its reservation and posts nothing.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { downloadCsv, formatDate, formatEgp, toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#withdrawal-filters');
const table = qs('#withdrawal-table');
const modal = qs('#withdrawal-modal');

const query = {
  status: 'pending',
  search: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
  sort: { key: 'requestedAt', dir: 'desc' },
};

let options = { payoutMethods: [], settlementMethods: [], policy: {} };

// ── Filters ──────────────────────────────────────────
filters.fields = [
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'pending',
    options: [
      { value: 'pending', label: t('status.pending') },
      { value: 'approved', label: t('status.approved') },
      { value: 'paid', label: t('status.paid') },
      { value: 'rejected', label: t('status.rejected') },
      { value: 'cancelled', label: t('status.cancelled') },
      { value: 'all', label: t('common.all') },
    ],
  },
  { type: 'search', key: 'search', label: t('common.name'), placeholder: t('common.search') },
  { type: 'daterange', key: 'date', label: t('withdrawals.requested'), fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: t('common.exportCsv'),
    variant: 'ghost',
    onClick: async () => {
      const all = await mockApi.listWithdrawals({ ...query, page: 1, pageSize: 1000 });
      downloadCsv(
        `${t('withdrawals.csvName')}-${toDateInputValue(Date.now())}.csv`,
        [
          t('common.name'),
          t('withdrawals.colAmount'),
          t('common.status'),
          t('withdrawals.colRequested'),
          t('withdrawals.csvDecided'),
          t('withdrawals.csvPayoutMethod'),
          t('withdrawals.csvReference'),
        ],
        all.rows.map((r) => [
          r.driverName,
          r.amount.toFixed(2),
          r.status,
          formatDate(r.requestedAt),
          r.decidedAt ? formatDate(r.decidedAt) : '',
          r.payoutMethod ?? '',
          r.payoutRef ?? '',
        ]),
      );
    },
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

// ── Table ────────────────────────────────────────────
table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  { key: 'driverName', label: t('common.name'), sortable: true, render: (row) => row.driverName },
  { key: 'amount', label: t('withdrawals.colAmount'), sortable: true, numeric: true, render: (row) => formatEgp(row.amount) },
  {
    key: 'currentBalance',
    label: t('withdrawals.colCurrentBalance'),
    sortable: true,
    numeric: true,
    render: (row) => {
      const span = document.createElement('span');
      // A shortfall means her balance moved after she asked (#TBD-E Scenario 9).
      span.className = row.shortfall > 0 ? 'ledger-amount ledger-amount--debit' : '';
      span.textContent = row.currentBalance >= 0
        ? `+${formatEgp(row.currentBalance)}`
        : `−${formatEgp(Math.abs(row.currentBalance))}`;
      return span;
    },
  },
  {
    key: 'status',
    label: t('common.status'),
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  { key: 'requestedAt', label: t('withdrawals.colRequested'), sortable: true, render: (row) => formatDate(row.requestedAt) },
  {
    key: 'actions',
    label: t('withdrawals.colDecision'),
    render: (row) => renderActions(row),
  },
];
table.emptyState = {
  icon: '⇡',
  heading: t('withdrawals.emptyHeading'),
  message: t('withdrawals.emptyMessage'),
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

/** Decision controls depend on status — a decided request offers none. */
function renderActions(row) {
  const wrap = document.createElement('div');
  wrap.className = 'withdrawal-actions';

  if (row.status === 'pending') {
    wrap.append(
      actionButton(t('withdrawals.approve'), 'btn--primary', () => approve(row)),
      actionButton(t('withdrawals.reject'), 'btn--ghost', () => reject(row)),
    );
  } else if (row.status === 'approved') {
    wrap.append(actionButton(t('withdrawals.markPaid'), 'btn--primary', () => markPaid(row)));
    if (row.shortfall > 0) {
      const warn = document.createElement('span');
      warn.className = 'withdrawal-shortfall';
      warn.textContent = t('withdrawals.short', { amount: formatEgp(row.shortfall) });
      wrap.appendChild(warn);
    }
  } else {
    const done = document.createElement('span');
    done.className = 'withdrawal-decided';
    done.textContent = row.decidedAt ? formatDate(row.decidedAt) : '—';
    wrap.appendChild(done);
  }
  return wrap;
}

function actionButton(label, variant, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn ${variant} btn--sm`;
  button.textContent = label;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

// ── Decisions ────────────────────────────────────────
async function approve(row) {
  try {
    await mockApi.decideWithdrawal(row.id, 'approve');
    shell.showToast(t('withdrawals.approved', { amount: formatEgp(row.amount), name: row.driverName }), 'success');
    load();
  } catch (error) {
    shell.showToast(error.message, 'danger');
  }
}

function reject(row) {
  modal.open({
    title: t('withdrawals.rejectTitle', { name: row.driverName }),
    description: t('withdrawals.rejectDescription', { amount: formatEgp(row.amount) }),
    confirmLabel: t('withdrawals.rejectConfirm'),
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'textarea',
        label: t('withdrawals.rejectReason'),
        required: true,
        minLength: 10,
        maxLength: 500,
        emptyError: t('withdrawals.errRejectEmpty'),
        lengthError: t('withdrawals.errRejectLength'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.decideWithdrawal(row.id, 'reject', values);
      shell.showToast(t('withdrawals.rejectDone'), 'success');
      load();
    },
  });
}

function markPaid(row) {
  modal.open({
    title: t('withdrawals.payTitle', { name: row.driverName }),
    description: t('withdrawals.payDescription', { amount: formatEgp(row.amount) }),
    confirmLabel: t('withdrawals.markPaid'),
    fields: [
      {
        key: 'payoutMethod',
        type: 'select',
        label: t('withdrawals.payMethod'),
        required: true,
        value: options.payoutMethods[0] ?? '',
        options: options.payoutMethods.map((m) => ({ value: m, label: m })),
        emptyError: t('withdrawals.errPayMethod'),
      },
      {
        key: 'payoutRef',
        type: 'text',
        label: t('withdrawals.payRef'),
        maxLength: 60,
        pattern: '^[A-Za-z0-9-]*$',
        invalidError: t('withdrawals.errPayRefInvalid'),
        lengthError: t('withdrawals.errPayRefLength'),
        hint: t('withdrawals.payRefHint'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.decideWithdrawal(row.id, 'pay', values);
      shell.showToast(t('withdrawals.payDone'), 'success');
      load();
    },
  });
}

// ── Summary cards ────────────────────────────────────
async function loadStats() {
  const all = await mockApi.listWithdrawals({ status: 'all', page: 1, pageSize: 1000 });
  const by = (status) => all.rows.filter((r) => r.status === status);
  const pending = by('pending');
  const approved = by('approved');
  qs('#card-pending').value = String(pending.length);
  qs('#card-approved').value = String(approved.length);
  qs('#card-reserved').value = formatEgp(
    [...pending, ...approved].reduce((sum, r) => sum + r.amount, 0),
  );
  qs('#card-paid').value = formatEgp(by('paid').reduce((sum, r) => sum + r.amount, 0));
  qs('#card-pending').meta = options.policy.withdrawalsEnabled
    ? t('withdrawals.minMeta', { amount: formatEgp(options.policy.minWithdrawal) })
    : t('withdrawals.disabledMeta');
}

// ── Load ─────────────────────────────────────────────
const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listWithdrawals(query);
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
