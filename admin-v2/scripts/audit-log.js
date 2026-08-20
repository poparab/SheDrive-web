/**
 * audit-log.js — SheDrive admin activity audit log controller
 * #1816: 50 rows/page, newest first, with date-range, actor, action-type and
 * target filters. Read-only — no row actions, no mutations.
 *
 * This screen is also the reference implementation of the
 * filter-bar + data-table + mock-api list pattern every other grid follows.
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { AUDIT_ACTION_TYPES, AUDIT_ACTOR_OPTIONS } from './seed.js';
import { formatDateTime, humanize } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, hasKey } from './admin-i18n.js';

/**
 * The log stores machine enums (`gender-mismatch resolution`, `safety_report`,
 * `baseFare`). Where a locale names one, use its word; otherwise fall back to
 * `humanize()`, which is what every value rendered as before this pass.
 */
function enumLabel(namespace, value) {
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

// ── Filters (#1816) ───────────────────────────────────

filters.fields = [
  {
    type: 'search',
    key: 'target',
    label: t('audit.targetLabel'),
    placeholder: t('audit.targetPlaceholder'),
    grow: true,
  },
  {
    type: 'select',
    key: 'actor',
    label: t('audit.actorLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('audit.actorAll') },
      // Actors are admin email addresses — Latin identifiers, not copy.
      ...AUDIT_ACTOR_OPTIONS.map((actor) => ({ value: actor, label: actor })),
    ],
  },
  {
    type: 'select',
    key: 'actionType',
    label: t('audit.actionLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('common.all') },
      ...AUDIT_ACTION_TYPES.map((type) => ({ value: type, label: enumLabel('action', type) })),
    ],
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

function renderTarget(entry) {
  const wrap = document.createElement('span');
  wrap.className = 'audit__target';

  const type = document.createElement('span');
  type.className = 'audit__target-type';
  type.textContent = enumLabel('target', entry.targetType);

  const id = document.createElement('span');
  id.className = 'ad-table__id ad-ltr';
  id.textContent = entry.targetId;

  wrap.append(type, id);
  return wrap;
}

function renderDiff(entry) {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  if (!keys.length) {
    const dash = document.createElement('span');
    dash.className = 'ad-muted';
    dash.textContent = t('common.notAvailable');
    return dash;
  }

  const wrap = document.createElement('span');
  wrap.className = 'audit__diff';

  keys.forEach((key) => {
    const row = document.createElement('span');
    row.className = 'audit__diff-row';

    const label = document.createElement('span');
    label.className = 'audit__diff-key';
    label.textContent = `${enumLabel('field', key)}:`;
    row.appendChild(label);

    if (key in before) {
      const beforeEl = document.createElement('span');
      beforeEl.className = 'audit__diff-before ad-ltr';
      beforeEl.textContent = String(before[key]);
      row.appendChild(beforeEl);

      const arrow = document.createElement('span');
      arrow.className = 'audit__diff-arrow';
      arrow.setAttribute('aria-label', t('audit.changedTo'));
      arrow.textContent = '→';
      row.appendChild(arrow);
    }

    if (key in after) {
      const afterEl = document.createElement('span');
      afterEl.className = 'audit__diff-after ad-ltr';
      afterEl.textContent = String(after[key]);
      row.appendChild(afterEl);
    }

    wrap.appendChild(row);
  });

  return wrap;
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
  {
    key: 'actionType',
    label: t('audit.actionLabel'),
    sortable: true,
    render: (entry) => enumLabel('action', entry.actionType),
  },
  { key: 'targetId', label: t('audit.colTarget'), render: renderTarget },
  { key: 'diff', label: t('audit.colDiff'), render: renderDiff },
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
