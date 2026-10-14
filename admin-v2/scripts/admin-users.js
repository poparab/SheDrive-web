/**
 * admin-users.js — SheDrive admin user accounts (kit page: admin-accounts.html)
 * #1820 list (20/page, newest first: Email / Status / Created / Last login),
 * #4121 three summary cards, #1807 add an account, #1821 suspend and unsuspend,
 * #4122 delete (soft).
 *
 * Roles (#1821): Super admin and Admin use every screen the same way; only a
 * Super admin suspends, unsuspends and deletes OTHER admin accounts, and nobody
 * acts on her own row. The mock session is always a Super admin, so `?role=admin`
 * on the URL shows the Admin view (no row actions) to keep Scenario 3 reviewable.
 *
 * Delete: the mock API has no delete endpoint and its data layer is frozen, so
 * this screen soft-deletes through the same session patch store the mock uses
 * (`patch('admins', …)` → status 'deleted' + deletedAt/deletedBy) and writes the
 * audit entry the same way the mock's own interventions do. Deleted accounts are
 * filtered out of the grid and the cards here (#4121 Scenario 4).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { ADMINS, AUDIT_ENTRIES } from './seed.js';
import { patch, recordAuditEntry } from './mutations.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#admins-filters');
const table = qs('#admins-table');

const session = adminAuth.getSession();
const currentEmail = session?.email;

/** #1821 — only a Super admin sees row actions. `?role=admin` demos the Admin view. */
const viewerRole = (() => {
  try {
    if (new URLSearchParams(window.location.search).get('role') === 'admin') return 'admin';
  } catch {
    /* ignore */
  }
  return session?.role === 'admin' ? 'admin' : 'super_admin';
})();
const isSuperAdmin = viewerRole === 'super_admin';
qs('#role-notice').hidden = isSuperAdmin;

// The kit puts "Add new admin" at the end of the title row (#1807: any role may add).
const addButton = qs('#add-admin');
qs('#ad-page-actions')?.appendChild(addButton);

const query = {
  search: '',
  status: 'all',
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

// #1821 Scenario 3 / #4122 Scenario 4 — the Admin role gets no action column at all.
if (isSuperAdmin) {
  columns.push({
    key: 'actions',
    label: t('common.actions'),
    className: 'admin-users__actions',
    render: (row) => {
      const wrap = document.createElement('div');
      wrap.className = 'd-flex gap-1';
      // Scenario 4 / #4122 Scenario 5 — never on her own row.
      const self = row.email === currentEmail;
      const selfTitle = t('kitAdmin.cannotActOnSelf');

      const toggle =
        row.status === 'active'
          ? iconButton({
              tone: 'pause-icon',
              icon: 'fa-solid fa-ban',
              label: self ? selfTitle : t('kitAdmin.suspend'),
              disabled: self,
              onClick: () => confirmAction('suspend', row),
            })
          : iconButton({
              tone: 'approved-icon',
              icon: 'fa-solid fa-lock-open',
              label: self ? selfTitle : t('kitAdmin.unsuspend'),
              disabled: self,
              onClick: () => confirmAction('unsuspend', row),
            });

      const remove = iconButton({
        tone: 'delete-icon',
        icon: 'fa-solid fa-user-xmark',
        label: self ? selfTitle : t('kitAdmin.deleteAccount'),
        disabled: self,
        onClick: () => confirmAction('delete', row),
      });

      wrap.append(toggle, remove);
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
  success: qs('#adminSuccessModal'),
};
// <body> keeps them clear of any positioned ancestor in the shell.
Object.values(modalEls).forEach((el) => document.body.appendChild(el));

async function modal(el) {
  await loadBootstrap();
  return window.bootstrap.Modal.getOrCreateInstance(el);
}

/** Hide one dialog and only then show the next, so the backdrops never stack. */
async function swap(fromEl, toEl) {
  const from = await modal(fromEl);
  const to = await modal(toEl);
  fromEl.addEventListener('hidden.bs.modal', () => to.show(), { once: true });
  from.hide();
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
    run: (admin) => setStatus(admin, 'disabled'),
  },
  unsuspend: {
    title: 'kitAdmin.unsuspendTitle',
    text: 'kitAdmin.unsuspendText',
    confirm: 'kitAdmin.unsuspendConfirm',
    variant: 'btn-success',
    icon: 'fa-solid fa-lock-open',
    done: 'kitAdmin.unsuspendedDone',
    run: (admin) => setStatus(admin, 'active'),
  },
  delete: {
    title: 'kitAdmin.deleteTitle',
    text: 'kitAdmin.deleteText',
    confirm: 'kitAdmin.deleteConfirm',
    variant: 'btn-danger',
    icon: 'fa-solid fa-user-xmark',
    done: 'kitAdmin.deletedDone',
    run: (admin) => softDelete(admin),
  },
};

const confirmButton = qs('#adminConfirmButton');
const confirmError = qs('#adminConfirmError');
let pending = null;

async function confirmAction(kind, admin) {
  const spec = ACTIONS[kind];
  pending = { spec, admin };
  qs('#adminConfirmTitle').textContent = t(spec.title);
  qs('#adminConfirmText').textContent = t(spec.text, { email: admin.email });
  confirmButton.className = `btn ${spec.variant}`;
  confirmButton.querySelector('i').className = spec.icon;
  confirmButton.querySelector('span').textContent = t(spec.confirm);
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
  qs('#adminSuccessText').textContent = t(spec.done, { email: admin.email });
  await swap(modalEls.confirm, modalEls.success);
  await Promise.all([load(), loadCards()]);
});

/** Audit entry, written the way the mock's own interventions write one (#1821 S7, #4122 S7). */
function audit(admin, before, after) {
  const at = Date.now();
  const entry = {
    id: `AUD-admin-${admin.id}-${at}`,
    at,
    actor: mockApi.getActingAdmin().email,
    actionType: 'admin-account change',
    targetType: 'admin',
    targetId: admin.id,
    before,
    after,
  };
  AUDIT_ENTRIES.unshift(entry);
  AUDIT_ENTRIES.sort((a, b) => b.at - a.at);
  recordAuditEntry(entry);
}

async function setStatus(admin, status) {
  if (!isSuperAdmin || admin.email === currentEmail) throw new Error(t('kitAdmin.cannotActOnSelf'));
  const before = admin.status;
  await mockApi.setAdminStatus(admin.id, status);
  audit(admin, { status: before }, { status });
}

async function softDelete(admin) {
  if (!isSuperAdmin || admin.email === currentEmail) throw new Error(t('kitAdmin.cannotActOnSelf'));
  const record = ADMINS.find((a) => String(a.id) === String(admin.id));
  if (!record || isDeleted(record)) throw new Error(t('common.notAvailable'));
  const before = record.status;
  const fields = { status: 'deleted', deletedAt: Date.now(), deletedBy: mockApi.getActingAdmin().email };
  Object.assign(record, fields);
  patch('admins', record.id, fields);
  audit(record, { status: before }, { status: 'deleted' });
}

// ── #1807 add an admin account ────────────────────────

const createForm = qs('#create-admin-form');
const emailInput = qs('#create-admin-email');
const emailError = qs('#create-admin-email-error');
const createError = qs('#create-admin-error');
const createConfirm = qs('#create-admin-confirm');
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
  setFieldError(invalid);
  showError(createError, '');
  if (invalid) {
    emailInput.focus();
    return;
  }

  setBusy(createConfirm, true);
  try {
    await mockApi.createAdmin({ email });
  } catch (error) {
    setBusy(createConfirm, false);
    // Scenario 3 — the mock answers 409 for a duplicate.
    if (error.status === 409) setFieldError(t('kitAdmin.emailDuplicateError'));
    else showError(createError, error.message);
    return;
  }

  qs('#adminSuccessText').textContent = t('kitAdmin.createdDone', { email: email.toLowerCase() });
  await swap(modalEls.create, modalEls.success);
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
