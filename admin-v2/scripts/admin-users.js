/**
 * admin-users.js — SheDrive admin user accounts (kit page: admin-accounts.html)
 * #1820 list (Email / Role / Created / Last login / Status), #4121 three summary
 * cards, #1807 add an account, #1821 suspend and unsuspend, #4122 delete (soft),
 * #6211 roles: a required Role on Add, a sortable Role column and a role
 * filter, and the row actions Change role, Reset password, Reset two-factor,
 * Suspend / Unsuspend and Delete.
 *
 * Only Admin (users & IT) opens this screen (#6210), and nobody acts on her
 * own row — it has no actions at all (#6211 Scenario 3). A role change,
 * suspension or deletion that would leave fewer than two active Financial
 * leads shows the story's warning in its confirmation; the Admin can still go
 * ahead. Every change is written to the audit log by the mock API.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { ROLES, can } from './roles.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#admins-filters');
const table = qs('#admins-table');

const session = adminAuth.getSession();
const currentEmail = session?.email;

const canManage = can('admins.manage');
const roleLabel = (role) => t(role ? `roles.${role}` : 'roles.none');

// The kit puts "Add new admin" at the end of the title row (#6211: Admin (users & IT) only).
const addButton = qs('#add-admin');
if (canManage) qs('#ad-page-actions')?.appendChild(addButton);
else addButton.remove();

const query = {
  search: '',
  status: 'all',
  role: 'all',
  page: 1,
  pageSize: 10,
  sort: { key: 'createdAt', dir: 'desc' },
};

// Everything is fetched in one page and paged here, so deleted rows can be
// removed without breaking the totals.
const ALL = 100000;
const isDeleted = (admin) => admin.status === 'deleted';

// ── #4121 summary cards ───────────────────────────────

const cards = {
  total: qs('#kpi-total'),
  active: qs('#kpi-active'),
  suspended: qs('#kpi-suspended'),
};
cards.total.setAttribute('label', t('kitAdmin.kpiTotal'));
cards.active.setAttribute('label', t('kitAdmin.kpiActive'));
cards.suspended.setAttribute('label', t('kitAdmin.kpiSuspended'));

async function loadCards() {
  try {
    const result = await mockApi.listAdmins({ pageSize: ALL });
    const rows = result.rows.filter((admin) => !isDeleted(admin));
    cards.total.setAttribute('value', String(rows.length));
    cards.active.setAttribute('value', String(rows.filter((a) => a.status === 'active').length));
    cards.suspended.setAttribute('value', String(rows.filter((a) => a.status === 'disabled').length));
  } catch {
    // Scenario 5 — a count that cannot be read shows a placeholder.
    Object.values(cards).forEach((card) => card.setAttribute('value', t('common.notAvailable')));
  }
}

// ── Filters (#1820) ───────────────────────────────────

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
      // The data keeps 'disabled'; #1821 renamed the label to Suspended.
      { value: 'disabled', label: t('status.suspended') },
    ],
  },
  {
    // #6211 — filter by role.
    type: 'select',
    key: 'role',
    label: t('adminRoles.filterRole'),
    value: 'all',
    options: [
      { value: 'all', label: t('adminRoles.allRoles') },
      ...ROLES.map((role) => ({ value: role, label: roleLabel(role) })),
    ],
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

// ── Grid ──────────────────────────────────────────────

function lamp(tone, label) {
  const wrap = document.createElement('div');
  wrap.className = `status-${tone}-lamp`;
  const dot = document.createElement('div');
  dot.className = 'lamp';
  wrap.append(dot, document.createTextNode(label));
  return wrap;
}

function iconButton({ tone, icon, label, disabled, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn grid-options-btn ${tone}`;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
  if (disabled) btn.disabled = true;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick?.();
  });
  return btn;
}

const columns = [
  {
    key: 'email',
    label: t('common.email'),
    sortable: true,
    // Latin data: isolated from the bidi algorithm in Arabic.
    ltr: true,
    render: (row) => {
      const wrap = document.createElement('div');
      wrap.className = 'list__name';
      const primary = document.createElement('p');
      primary.className = 'list__name-primary ad-ltr mb-0';
      primary.textContent = row.email;
      wrap.appendChild(primary);

      if (row.email === currentEmail) {
        const you = document.createElement('p');
        you.className = 'list__name-secondary mb-0';
        you.textContent = t('adminUsers.noteYou');
        wrap.appendChild(you);
      }
      if (!row.twoFactorEnrolled) {
        const twoFa = document.createElement('p');
        twoFa.className = 'warning-color mb-0';
        twoFa.textContent = t('adminUsers.note2fa');
        wrap.appendChild(twoFa);
      }
      return wrap;
    },
  },
  {
    // #6211 — the Role column, sortable.
    key: 'role',
    label: t('adminRoles.colRole'),
    sortable: true,
    render: (row) => roleLabel(row.role),
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
    key: 'status',
    label: t('common.status'),
    sortable: true,
    render: (row) =>
      row.status === 'active'
        ? lamp('active', t('status.active'))
        : lamp('danger', t('status.suspended')),
  },
];

// #6211 — row actions for Admin (users & IT); never on her own row.
if (canManage) {
  columns.push({
    key: 'actions',
    label: t('common.actions'),
    className: 'admin-users__actions',
    render: (row) => {
      const wrap = document.createElement('div');
      wrap.className = 'd-flex gap-1';
      // Scenario 3 — her own row has no Change role, Suspend, Delete, Reset password or Reset two-factor.
      if (row.email === currentEmail) {
        const none = document.createElement('span');
        none.className = 'ad-muted small';
        none.textContent = t('adminRoles.noActionsOnSelf');
        wrap.appendChild(none);
        return wrap;
      }
      wrap.append(
        iconButton({
          tone: 'edit-icon',
          icon: 'fa-solid fa-user-tag',
          label: t('adminRoles.changeRole'),
          onClick: () => openChangeRole(row),
        }),
        iconButton({
          tone: 'view-icon',
          icon: 'fa-solid fa-key',
          label: t('adminRoles.resetPassword'),
          onClick: () => confirmAction('resetPassword', row),
        }),
        iconButton({
          tone: 'view-icon',
          icon: 'fa-solid fa-mobile-screen-button',
          label: t('adminRoles.resetTwoFactor'),
          onClick: () => confirmAction('resetTwoFactor', row),
        }),
        row.status === 'active'
          ? iconButton({
              tone: 'pause-icon',
              icon: 'fa-solid fa-ban',
              label: t('kitAdmin.suspend'),
              onClick: () => confirmAction('suspend', row),
            })
          : iconButton({
              tone: 'approved-icon',
              icon: 'fa-solid fa-lock-open',
              label: t('kitAdmin.unsuspend'),
              onClick: () => confirmAction('unsuspend', row),
            }),
        iconButton({
          tone: 'delete-icon',
          icon: 'fa-solid fa-user-xmark',
          label: t('kitAdmin.deleteAccount'),
          onClick: () => confirmAction('delete', row),
        }),
      );
      return wrap;
    },
  });
}

table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = columns;

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

// ── Kit modals (Bootstrap) ────────────────────────────

const modalEls = {
  create: qs('#createAdminModal'),
  confirm: qs('#adminConfirmModal'),
  role: qs('#changeRoleModal'),
};
// <body> keeps them clear of any positioned ancestor in the shell.
Object.values(modalEls).forEach((el) => document.body.appendChild(el));

async function modal(el) {
  await loadBootstrap();
  return window.bootstrap.Modal.getOrCreateInstance(el);
}

/**
 * The action went through: close the dialog and say so in a toast. The kit's
 * popup-success asked nothing of the admin but to close it.
 */
async function done(fromEl, message) {
  (await modal(fromEl)).hide();
  qs('ad-shell').showToast(message, 'success', { title: t('kitAdmin.successTitle') });
}

function showError(box, message) {
  box.querySelector('p').textContent = message;
  box.hidden = !message;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

// ── #1821 suspend / unsuspend · #4122 delete ──────────

const ACTIONS = {
  suspend: {
    title: 'kitAdmin.suspendTitle',
    text: 'kitAdmin.suspendText',
    confirm: 'kitAdmin.suspendConfirm',
    variant: 'btn-warning',
    icon: 'fa-solid fa-ban',
    done: 'kitAdmin.suspendedDone',
    leadCheck: true,
    run: (admin) => mockApi.setAdminStatus(admin.id, 'disabled'),
  },
  unsuspend: {
    title: 'kitAdmin.unsuspendTitle',
    text: 'kitAdmin.unsuspendText',
    confirm: 'kitAdmin.unsuspendConfirm',
    variant: 'btn-success',
    icon: 'fa-solid fa-lock-open',
    done: 'kitAdmin.unsuspendedDone',
    run: (admin) => mockApi.setAdminStatus(admin.id, 'active'),
  },
  delete: {
    title: 'kitAdmin.deleteTitle',
    text: 'kitAdmin.deleteText',
    confirm: 'kitAdmin.deleteConfirm',
    variant: 'btn-danger',
    icon: 'fa-solid fa-user-xmark',
    done: 'kitAdmin.deletedDone',
    leadCheck: true,
    run: (admin) => mockApi.deleteAdmin(admin.id),
  },
  resetPassword: {
    title: 'adminRoles.resetPasswordTitle',
    text: 'adminRoles.resetPasswordText',
    confirm: 'adminRoles.resetPasswordConfirm',
    variant: 'btn-warning',
    icon: 'fa-solid fa-key',
    done: 'adminRoles.resetPasswordDone',
    run: (admin) => mockApi.resetAdminPassword(admin.id),
  },
  resetTwoFactor: {
    title: 'adminRoles.resetTwoFactorTitle',
    text: 'adminRoles.resetTwoFactorText',
    confirm: 'adminRoles.resetTwoFactorConfirm',
    variant: 'btn-warning',
    icon: 'fa-solid fa-mobile-screen-button',
    done: 'adminRoles.resetTwoFactorDone',
    run: (admin) => mockApi.resetAdminTwoFactor(admin.id),
  },
};

/** #6211 — the story's warning when fewer than two active Financial leads would be left. */
function leadWarningText(admin, nextRole = null) {
  const level = mockApi.financialLeadWarning(admin.id, nextRole);
  if (level === 'one') return t('adminRoles.leadOne');
  if (level === 'none') return t('adminRoles.leadNone');
  return '';
}

function showWarning(box, message) {
  box.querySelector('p').textContent = message;
  box.hidden = !message;
}

const confirmButton = qs('#adminConfirmButton');
const confirmError = qs('#adminConfirmError');
const confirmWarning = qs('#adminConfirmWarning');
let pending = null;

async function confirmAction(kind, admin) {
  const spec = ACTIONS[kind];
  pending = { spec, admin };
  qs('#adminConfirmTitle').textContent = t(spec.title);
  qs('#adminConfirmText').textContent = t(spec.text, { email: admin.email });
  confirmButton.className = `btn ${spec.variant}`;
  confirmButton.querySelector('i').className = spec.icon;
  confirmButton.querySelector('span').textContent = t(spec.confirm);
  showWarning(confirmWarning, spec.leadCheck ? leadWarningText(admin) : '');
  showError(confirmError, '');
  setBusy(confirmButton, false);
  (await modal(modalEls.confirm)).show();
}

confirmButton.addEventListener('click', async () => {
  if (!pending) return;
  const { spec, admin } = pending;
  setBusy(confirmButton, true);
  try {
    await spec.run(admin);
  } catch (error) {
    setBusy(confirmButton, false);
    showError(confirmError, error.message);
    return;
  }
  pending = null;
  await done(modalEls.confirm, t(spec.done, { email: admin.email }));
  await Promise.all([load(), loadCards()]);
});

// ── #6211 change role — one Admin decides alone, no second approval ──

const roleSelect = qs('#change-role-select');
const roleError = qs('#change-role-select-error');
const roleWarning = qs('#change-role-warning');
const roleFormError = qs('#change-role-error');
const roleConfirm = qs('#change-role-confirm');
let roleTarget = null;

ROLES.forEach((role) => {
  const option = document.createElement('option');
  option.value = role;
  option.textContent = roleLabel(role);
  roleSelect.appendChild(option);
});

function setRoleError(message) {
  roleError.textContent = message;
  roleSelect.classList.toggle('is-invalid', Boolean(message));
  roleSelect.setAttribute('aria-invalid', String(Boolean(message)));
}

async function openChangeRole(admin) {
  roleTarget = admin;
  qs('#change-role-text').textContent = t('adminRoles.changeText', { email: admin.email, role: roleLabel(admin.role) });
  roleSelect.value = '';
  setRoleError('');
  showWarning(roleWarning, '');
  showError(roleFormError, '');
  setBusy(roleConfirm, false);
  (await modal(modalEls.role)).show();
}

roleSelect.addEventListener('change', () => {
  setRoleError('');
  // The warning follows the role chosen: moving one of the last leads off Financial lead.
  showWarning(roleWarning, roleTarget && roleSelect.value ? leadWarningText(roleTarget, roleSelect.value) : '');
});

qs('#change-role-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!roleTarget) return;
  const role = roleSelect.value;
  if (!role) {
    setRoleError(t('adminRoles.roleEmpty'));
    roleSelect.focus();
    return;
  }
  if (role === roleTarget.role) {
    setRoleError(t('adminRoles.sameRoleError'));
    roleSelect.focus();
    return;
  }
  setBusy(roleConfirm, true);
  try {
    await mockApi.changeAdminRole(roleTarget.id, role);
  } catch (error) {
    setBusy(roleConfirm, false);
    showError(roleFormError, error.message);
    return;
  }
  const email = roleTarget.email;
  roleTarget = null;
  await done(modalEls.role, t('adminRoles.changedDone', { email, role: roleLabel(role) }));
  await Promise.all([load(), loadCards()]);
});

// ── #1807 add an admin account ────────────────────────

const createForm = qs('#create-admin-form');
const emailInput = qs('#create-admin-email');
const emailError = qs('#create-admin-email-error');
const createError = qs('#create-admin-error');
const createConfirm = qs('#create-admin-confirm');
const createRole = qs('#create-admin-role');
const createRoleError = qs('#create-admin-role-error');

ROLES.forEach((role) => {
  const option = document.createElement('option');
  option.value = role;
  option.textContent = roleLabel(role);
  createRole.appendChild(option);
});

function setCreateRoleError(message) {
  createRoleError.textContent = message;
  createRole.classList.toggle('is-invalid', Boolean(message));
  createRole.setAttribute('aria-invalid', String(Boolean(message)));
}

createRole.addEventListener('change', () => setCreateRoleError(''));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setFieldError(message) {
  emailError.textContent = message;
  emailInput.classList.toggle('is-invalid', Boolean(message));
  emailInput.setAttribute('aria-invalid', String(Boolean(message)));
}

function validateEmail(value) {
  if (!value) return t('adminUsers.emailEmptyError');
  if (value.length > 254) return t('adminUsers.emailLengthError');
  if (!EMAIL_PATTERN.test(value)) return t('adminUsers.emailInvalidError');
  return '';
}

addButton.addEventListener('click', async () => {
  createForm.reset();
  setFieldError('');
  setCreateRoleError('');
  showError(createError, '');
  setBusy(createConfirm, false);
  const instance = await modal(modalEls.create);
  modalEls.create.addEventListener('shown.bs.modal', () => emailInput.focus(), { once: true });
  instance.show();
});

emailInput.addEventListener('input', () => {
  if (emailInput.classList.contains('is-invalid')) setFieldError(validateEmail(emailInput.value.trim()));
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const invalid = validateEmail(email);
  const role = createRole.value;
  setFieldError(invalid);
  // #6211 — Role is required: "Choose a role".
  setCreateRoleError(role ? '' : t('adminRoles.roleEmpty'));
  showError(createError, '');
  if (invalid) {
    emailInput.focus();
    return;
  }
  if (!role) {
    createRole.focus();
    return;
  }

  setBusy(createConfirm, true);
  try {
    await mockApi.createAdmin({ email, role });
  } catch (error) {
    setBusy(createConfirm, false);
    // Scenario 3 — the mock answers 409 for a duplicate.
    if (error.status === 409) setFieldError(t('kitAdmin.emailDuplicateError'));
    else showError(createError, error.message);
    return;
  }

  await done(modalEls.create, t('kitAdmin.createdDone', { email: email.toLowerCase() }));
  query.page = 1;
  await Promise.all([load(), loadCards()]);
});

// ── Load ──────────────────────────────────────────────

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listAdmins({ ...query, page: 1, pageSize: ALL });
    if (!isCurrent()) return;
    const rows = result.rows.filter((admin) => !isDeleted(admin));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(Math.max(1, query.page), totalPages);
    const start = (page - 1) * query.pageSize;
    table.setData({
      rows: rows.slice(start, start + query.pageSize),
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
    });
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
loadCards();
