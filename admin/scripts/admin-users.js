/**
 * admin-users.js — SheDrive admin user accounts
 * #1820 list (20/page, newest first: Email / Status / Created / Last login),
 * #1807 add an account, #1821 enable and disable accounts.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime } from './format.js';
import { qs } from '../../shared/scripts/utils.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#admins-filters');
const table = qs('#admins-table');
const modal = qs('#admin-modal');

const currentEmail = adminAuth.getSession()?.email;

const query = {
  search: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sort: { key: 'createdAt', dir: 'desc' },
};

filters.fields = [
  {
    type: 'search',
    key: 'search',
    label: 'Email',
    placeholder: 'e.g. finance',
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    value: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'disabled', label: 'Disabled' },
    ],
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

table.pageSize = query.pageSize;
table.sort = query.sort;

table.columns = [
  {
    key: 'email',
    label: 'Email',
    sortable: true,
    render: (row) => {
      const wrap = document.createElement('span');
      wrap.className = 'list__name';
      const primary = document.createElement('span');
      primary.className = 'list__name-primary';
      primary.textContent = row.email;
      wrap.appendChild(primary);

      const notes = [];
      if (row.email === currentEmail) notes.push('you');
      if (!row.twoFactorEnrolled) notes.push('2FA not enrolled');
      if (notes.length) {
        const secondary = document.createElement('span');
        secondary.className = 'list__name-secondary';
        secondary.textContent = notes.join(' · ');
        wrap.appendChild(secondary);
      }
      return wrap;
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
  {
    key: 'createdAt',
    label: 'Created date',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'lastLoginAt',
    label: 'Last login',
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => {
      if (!row.lastLoginAt) {
        const never = document.createElement('span');
        never.className = 'ad-muted';
        never.textContent = 'Never signed in';
        return never;
      }
      return formatDateTime(row.lastLoginAt);
    },
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (row) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const disabling = row.status === 'active';
      btn.className = `btn btn--sm ${disabling ? 'btn--danger' : 'btn--secondary'}`;
      btn.textContent = disabling ? 'Disable' : 'Enable';

      // #1821 — an admin must not be able to lock herself out.
      if (disabling && row.email === currentEmail) {
        btn.disabled = true;
        btn.title = 'You cannot disable your own account';
      }

      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleStatus(row, disabling);
      });
      return btn;
    },
  },
];

table.emptyState = {
  icon: '⚿',
  heading: 'No admin accounts match these filters',
  message: 'Clear the status filter or widen the search.',
};

table.addEventListener('sortchange', (event) => {
  query.sort = event.detail;
  table.sort = query.sort;
  load();
});

table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

// ── #1821 enable / disable ────────────────────────────

function toggleStatus(admin, disabling) {
  modal.open({
    title: disabling ? 'Disable this admin account?' : 'Enable this admin account?',
    description: disabling
      ? `${admin.email} will be signed out and unable to access the portal until re-enabled.`
      : `${admin.email} will be able to sign in again.`,
    confirmLabel: disabling ? 'Disable account' : 'Enable account',
    danger: disabling,
    fields: [],
    onConfirm: async () => {
      await mockApi.setAdminStatus(admin.id, disabling ? 'disabled' : 'active');
      shell.showToast(
        `${admin.email} ${disabling ? 'disabled' : 'enabled'}.`,
        disabling ? 'warning' : 'success',
      );
      await load();
    },
  });
}

// ── #1807 add an admin account ────────────────────────

qs('#add-admin').addEventListener('click', () => {
  modal.open({
    title: 'Add an admin user',
    description:
      'The account is created active. She must enrol 2FA and set her own password at first sign-in.',
    confirmLabel: 'Create account',
    fields: [
      {
        key: 'email',
        type: 'email',
        label: 'Email',
        required: true,
        maxLength: 254,
        placeholder: 'name@shedrive.app',
        emptyError: 'Enter an email address',
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        invalidError: 'Invalid email address',
        lengthError: 'Email must be ≤ 254 characters',
      },
      {
        key: 'role',
        type: 'readonly',
        label: 'Role',
        value: 'Super admin — the only role in this phase',
      },
    ],
    onConfirm: async (values) => {
      await mockApi.createAdmin({ email: values.email });
      shell.showToast(`Admin account created for ${values.email}.`, 'success');
      query.page = 1;
      await load();
    },
  });
});

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listAdmins(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
