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
import { t } from './admin-i18n.js';

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
    label: t('common.email'),
    placeholder: t('adminUsers.searchPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      { value: 'active', label: t('status.active') },
      { value: 'disabled', label: t('status.disabled') },
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
    label: t('common.email'),
    sortable: true,
    // Latin data: isolated from the bidi algorithm in Arabic.
    ltr: true,
    render: (row) => {
      const wrap = document.createElement('span');
      wrap.className = 'list__name';
      const primary = document.createElement('span');
      // An address is a Latin run inside an Arabic-aligned cell.
      primary.className = 'list__name-primary ad-ltr';
      primary.textContent = row.email;
      wrap.appendChild(primary);

      const notes = [];
      if (row.email === currentEmail) notes.push(t('adminUsers.noteYou'));
      if (!row.twoFactorEnrolled) notes.push(t('adminUsers.note2fa'));
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
    label: t('common.status'),
    sortable: true,
    render: (row) => {
      const pill = document.createElement('ad-status-pill');
      pill.status = row.status;
      return pill;
    },
  },
  {
    key: 'createdAt',
    label: t('adminUsers.colCreated'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'lastLoginAt',
    label: t('adminUsers.colLastLogin'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (row) => {
      if (!row.lastLoginAt) {
        const never = document.createElement('span');
        never.className = 'ad-muted';
        never.textContent = t('adminUsers.neverSignedIn');
        return never;
      }
      return formatDateTime(row.lastLoginAt);
    },
  },
  {
    key: 'actions',
    label: t('common.actions'),
    render: (row) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const disabling = row.status === 'active';
      btn.className = `btn btn--sm ${disabling ? 'btn-danger' : 'btn-primary-outline'}`;
      btn.textContent = disabling ? t('adminUsers.disable') : t('adminUsers.enable');

      // #1821 — an admin must not be able to lock herself out.
      if (disabling && row.email === currentEmail) {
        btn.disabled = true;
        btn.title = t('adminUsers.cannotDisableSelf');
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
  heading: t('adminUsers.emptyHeading'),
  message: t('adminUsers.emptyMessage'),
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
    title: disabling ? t('adminUsers.disableTitle') : t('adminUsers.enableTitle'),
    description: disabling
      ? t('adminUsers.disableDescription', { email: admin.email })
      : t('adminUsers.enableDescription', { email: admin.email }),
    confirmLabel: disabling ? t('adminUsers.disableConfirm') : t('adminUsers.enableConfirm'),
    danger: disabling,
    fields: [],
    onConfirm: async () => {
      await mockApi.setAdminStatus(admin.id, disabling ? 'disabled' : 'active');
      shell.showToast(
        disabling
          ? t('adminUsers.disabledToast', { email: admin.email })
          : t('adminUsers.enabledToast', { email: admin.email }),
        disabling ? 'warning' : 'success',
      );
      await load();
    },
  });
}

// ── #1807 add an admin account ────────────────────────

qs('#add-admin').addEventListener('click', () => {
  modal.open({
    title: t('adminUsers.addTitle'),
    description: t('adminUsers.addDescription'),
    confirmLabel: t('adminUsers.addConfirm'),
    fields: [
      {
        key: 'email',
        type: 'email',
        label: t('common.email'),
        required: true,
        maxLength: 254,
        placeholder: t('adminUsers.emailPlaceholder'),
        emptyError: t('adminUsers.emailEmptyError'),
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        invalidError: t('adminUsers.emailInvalidError'),
        lengthError: t('adminUsers.emailLengthError'),
      },
      {
        key: 'role',
        type: 'readonly',
        label: t('common.role'),
        value: t('adminUsers.roleValue'),
      },
    ],
    onConfirm: async (values) => {
      await mockApi.createAdmin({ email: values.email });
      shell.showToast(t('adminUsers.createdToast', { email: values.email }), 'success');
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
