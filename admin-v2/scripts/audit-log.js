/**
 * audit-log.js — SheDrive admin activity audit log controller
 * #1816: 50 rows/page, newest first, with date-range, actor, event (action type)
 * and entity filters. Read-only — the only row action is View, which opens the
 * entry's before → after values in the kit's details dialog. No mutations.
 *
 * Model: the developers' build (kit demo-snapshots/audit-log.html) — filter row,
 * grid Timestamp | Actor | Event | Entity | Actions, `default-modal modal-xl`.
 *
 * This screen is also the reference implementation of the
 * filter-bar + data-table + mock-api list pattern every other grid follows.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { AUDIT_ACTION_TYPES, AUDIT_ACTOR_OPTIONS, AUDIT_ENTRIES } from './seed.js';
import { formatDateTime, humanize } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, hasKey } from './admin-i18n.js';

/**
 * The log stores machine enums (`gender-mismatch resolution`, `safety_report`,
 * `baseFare`). Where a locale names one, use its word; otherwise fall back to
 * `humanize()`, which is what every value rendered as before this pass.
 */
function enumLabel(namespace, value) {
  // The 2026-10-14 finance actions, targets and fields live in their own
  // namespace (i18n/profile-pricing.js) — `audit.action` merges one level deep.
  const financeKey = `auditFinance.${namespace}.${value}`;
  if (hasKey(financeKey)) return t(financeKey);
  const key = `audit.${namespace}.${value}`;
  return hasKey(key) ? t(key) : humanize(value);
}

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const filters = qs('#audit-filters');
const table = qs('#audit-table');

/** One object holds the whole query so filters, sort and paging compose. */
const query = {
  actor: 'all',
  actionType: 'all',
  target: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 50,
  sort: { key: 'at', dir: 'desc' },
};

// ── Event types and actors ────────────────────────────
// The seed's list predates the 2026-10-14 maker-checker / payout actions, so the
// options are the seed list plus the finance actions plus whatever the log
// actually holds this session (an action recorded on another screen included).

const FINANCE_ACTION_TYPES = [
  'payout',
  'approval requested',
  'approval approved',
  'approval rejected',
  'payout batch exported',
  'payout result imported',
  'fee waived',
  'payout method changed',
];

const unique = (list) => [...new Set(list.filter(Boolean))];

const ACTION_TYPES = unique([
  ...AUDIT_ACTION_TYPES,
  ...FINANCE_ACTION_TYPES,
  ...AUDIT_ENTRIES.map((entry) => entry.actionType),
]);

const ACTORS = unique([...AUDIT_ACTOR_OPTIONS, ...AUDIT_ENTRIES.map((entry) => entry.actor)]).sort();

/** The kit draws every event as a lamp; the tone says what kind of change it was. */
const EVENT_TONES = {
  approve: 'active',
  reinstate: 'active',
  'approval approved': 'active',
  reject: 'danger',
  suspend: 'danger',
  cancel: 'danger',
  'approval rejected': 'danger',
  'sos case closed': 'danger',
  refund: 'blue',
  settlement: 'blue',
  payout: 'blue',
  'payout batch exported': 'blue',
  'payout result imported': 'blue',
  'fee waived': 'blue',
  'payout method changed': 'primary',
  'admin-account change': 'primary',
  'approval requested': 'warning',
};

// ── Filters (#1816) ───────────────────────────────────

filters.fields = [
  {
    type: 'select',
    key: 'actionType',
    label: t('kitAdmin.eventLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('kitAdmin.eventAll') },
      ...ACTION_TYPES.map((type) => ({ value: type, label: enumLabel('action', type) })),
    ],
  },
  {
    type: 'select',
    key: 'actor',
    label: t('audit.actorLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('audit.actorAll') },
      // Actors are admin email addresses — Latin identifiers, not copy.
      ...ACTORS.map((actor) => ({ value: actor, label: actor })),
    ],
  },
  {
    type: 'search',
    key: 'target',
    label: t('kitAdmin.entityLabel'),
    placeholder: t('kitAdmin.entityPlaceholder'),
    grow: true,
  },
  {
    type: 'daterange',
    key: 'date',
    label: t('audit.timestampLabel'),
    fromKey: 'from',
    toKey: 'to',
  },
];

filters.addEventListener('change', (event) => {
  Object.assign(query, event.detail);
  query.page = 1;
  load();
});

// ── Columns (#1816) ───────────────────────────────────

function renderEvent(entry) {
  const tone = EVENT_TONES[entry.actionType] ?? 'warning';
  const wrap = document.createElement('div');
  wrap.className = `status-${tone}-lamp`;
  const dot = document.createElement('div');
  dot.className = 'lamp';
  wrap.append(dot, document.createTextNode(enumLabel('action', entry.actionType)));
  return wrap;
}

function renderTarget(entry) {
  const wrap = document.createElement('div');
  wrap.className = 'audit__target';

  const type = document.createElement('p');
  type.className = 'text-bold mb-0';
  type.textContent = enumLabel('target', entry.targetType);

  const id = document.createElement('p');
  id.className = 'ad-table__id ad-ltr mb-0';
  id.textContent = entry.targetId;

  wrap.append(type, id);
  return wrap;
}

function renderView(entry) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn grid-options-btn view-icon';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = '<i class="fa-regular fa-eye" aria-hidden="true"></i>';
  btn.appendChild(document.createTextNode(t('common.view')));
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    openEntry(entry);
  });
  return btn;
}

table.pageSize = query.pageSize;
table.sort = query.sort;
table.columns = [
  {
    key: 'at',
    label: t('audit.timestampLabel'),
    sortable: true,
    className: 'ad-table__nowrap',
    render: (entry) => formatDateTime(entry.at),
  },
  {
    key: 'actor',
    label: t('audit.actorLabel'),
    sortable: true,
    // Latin data: isolated from the bidi algorithm in Arabic.
    ltr: true,
    render: (entry) => {
      const actor = document.createElement('span');
      actor.className = 'ad-ltr';
      actor.textContent = entry.actor;
      return actor;
    },
  },
  { key: 'actionType', label: t('kitAdmin.eventLabel'), sortable: true, render: renderEvent },
  { key: 'targetId', label: t('kitAdmin.entityLabel'), render: renderTarget },
  { key: 'view', label: t('common.actions'), render: renderView },
];

table.emptyState = {
  icon: '☰',
  heading: t('audit.emptyHeading'),
  message: t('audit.emptyMessage'),
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

// ── Details: before → after ───────────────────────────

const modalEl = qs('#auditEntryModal');
document.body.appendChild(modalEl);

/**
 * The diff rows. A field is shown only if it has a value on at least one side —
 * an approval with no reason must not print "Reason: undefined".
 */
function diffRows(entry) {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const has = (obj, key) => obj[key] !== undefined && obj[key] !== null && obj[key] !== '';
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => has(before, key) || has(after, key))
    .map((key) => ({
      label: enumLabel('field', key),
      before: has(before, key) ? String(before[key]) : null,
      after: has(after, key) ? String(after[key]) : null,
    }));
}

function valueCell(value, className) {
  const td = document.createElement('td');
  if (value === null) {
    td.className = 'ad-muted';
    td.textContent = t('common.notAvailable');
    return td;
  }
  const span = document.createElement('span');
  span.className = `${className} ad-ltr`;
  span.textContent = value;
  td.appendChild(span);
  return td;
}

async function openEntry(entry) {
  qs('#audit-detail-at').textContent = formatDateTime(entry.at);
  qs('#audit-detail-actor').textContent = entry.actor;
  qs('#audit-detail-event').replaceChildren(renderEvent(entry));
  qs('#audit-detail-entity').textContent = `${enumLabel('target', entry.targetType)} · ${entry.targetId}`;

  const rows = diffRows(entry);
  const body = qs('#audit-diff-rows');
  body.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement('tr');
      const label = document.createElement('td');
      label.className = 'text-bold';
      label.textContent = row.label;
      tr.append(
        label,
        valueCell(row.before, 'audit__diff-before'),
        valueCell(row.after, 'audit__diff-after'),
      );
      return tr;
    }),
  );
  qs('#audit-diff-wrap').hidden = !rows.length;
  qs('#audit-diff-empty').hidden = rows.length > 0;

  await loadBootstrap();
  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// ── Load ──────────────────────────────────────────────

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listAuditEntries(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

load();
