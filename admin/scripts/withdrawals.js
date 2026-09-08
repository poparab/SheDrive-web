/**
 * withdrawals.js — SheDrive admin driver withdrawal requests (#TBD-E)
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
    label: 'Status',
    value: 'pending',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'paid', label: 'Paid' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'all', label: 'All' },
    ],
  },
  { type: 'search', key: 'search', label: 'Driver', placeholder: 'Search by name or phone' },
  { type: 'daterange', key: 'date', label: 'Requested', fromKey: 'from', toKey: 'to' },
];

filters.actions = [
  {
    label: 'Export CSV',
    variant: 'ghost',
    onClick: async () => {
      const all = await mockApi.listWithdrawals({ ...query, page: 1, pageSize: 1000 });
      downloadCsv(
        `shedrive-withdrawals-${toDateInputValue(Date.now())}.csv`,
        ['Driver', 'Amount (EGP)', 'Status', 'Requested', 'Decided', 'Payout method', 'Reference'],
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
  { key: 'driverName', label: 'Driver', sortable: true, render: (row) => row.driverName },
  { key: 'amount', label: 'Amount (EGP)', sortable: true, numeric: true, render: (row) => formatEgp(row.amount) },
  {
    key: 'currentBalance',
    label: 'Current balance (EGP)',
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
    label: 'Status',
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  { key: 'requestedAt', label: 'Requested', sortable: true, render: (row) => formatDate(row.requestedAt) },
  {
    key: 'actions',
    label: 'Decision',
    render: (row) => renderActions(row),
  },
];
table.emptyState = {
  icon: '⇡',
  heading: 'No withdrawal requests',
  message: 'No request matches the current filter.',
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
      actionButton('Approve', 'btn--primary', () => approve(row)),
      actionButton('Reject', 'btn--ghost', () => reject(row)),
    );
  } else if (row.status === 'approved') {
    wrap.append(actionButton('Mark paid', 'btn--primary', () => markPaid(row)));
    if (row.shortfall > 0) {
      const warn = document.createElement('span');
      warn.className = 'withdrawal-shortfall';
      warn.textContent = `Short ${formatEgp(row.shortfall)}`;
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
    shell.showToast(`Approved ${formatEgp(row.amount)} for ${row.driverName}.`, 'success');
    load();
  } catch (error) {
    shell.showToast(error.message, 'danger');
  }
}

function reject(row) {
  modal.open({
    title: `Reject withdrawal — ${row.driverName}`,
    description: `${formatEgp(row.amount)}. The reservation is released and your reason is shown to the driver in her app.`,
    confirmLabel: 'Reject request',
    danger: true,
    fields: [
      {
        key: 'reason',
        type: 'textarea',
        label: 'Rejection reason',
        required: true,
        minLength: 10,
        maxLength: 500,
        emptyError: 'Enter a reason for rejecting this request',
        lengthError: 'Reason must be between 10 and 500 characters',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.decideWithdrawal(row.id, 'reject', values);
      shell.showToast('Request rejected.', 'success');
      load();
    },
  });
}

function markPaid(row) {
  modal.open({
    title: `Mark paid — ${row.driverName}`,
    description: `${formatEgp(row.amount)}. This posts the withdrawal to her ledger and reduces her available balance.`,
    confirmLabel: 'Mark paid',
    fields: [
      {
        key: 'payoutMethod',
        type: 'select',
        label: 'Payout method',
        required: true,
        value: options.payoutMethods[0] ?? '',
        options: options.payoutMethods.map((m) => ({ value: m, label: m })),
        emptyError: 'Select a payout method',
      },
      {
        key: 'payoutRef',
        type: 'text',
        label: 'Payout reference',
        maxLength: 60,
        pattern: '^[A-Za-z0-9-]*$',
        invalidError: 'Use letters, digits and hyphens only',
        lengthError: 'Reference must be 60 characters or fewer',
        hint: 'Optional — transfer or receipt number.',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.decideWithdrawal(row.id, 'pay', values);
      shell.showToast('Withdrawal marked paid.', 'success');
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
    ? `Min ${formatEgp(options.policy.minWithdrawal)}`
    : 'Withdrawals disabled';
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
