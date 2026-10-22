/**
 * approvals.js — SheDrive admin maker-checker queue (2026-10-14 spec §1)
 *
 * Every finance action is a request. One admin makes it, a different admin
 * approves or rejects it, and only an approval changes data. This screen lists
 * requests (Pending / Decided, picked in the filter row — the kit has no tabs),
 * opens one in the shared review dialog (scripts/approval-review.js — the same
 * one a business screen opens in place) and records the decision.
 *
 * Filters: status, who made the request (me → waiting for others; other
 * admins → mine to decide), area (the hook for scoping the queue by role once
 * Finance and Pricing approvers are split) and type.
 *
 * Deep link: approvals.html?id=APR-0004 opens that request on load; with
 * `&return=<screen>` the admin goes back to that screen after deciding.
 * Demo only: the switch at the top acts as another admin (spec §7).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { toDateInputValue } from './format.js';
import { qs } from '../../shared/scripts/utils.js';
import { t } from './admin-i18n.js';
import { mountStatRow } from './list-metrics.js';
import {
  createApprovalReview,
  returnTarget,
  el,
  icon,
  kitButton,
  ltr,
  money,
  typeLabel,
  lamp,
  subjectLink,
  who,
} from './approval-review.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const filters = qs('#approvals-filters');
const table = qs('#approvals-table');

const query = {
  status: 'pending',
  madeBy: 'all',
  area: 'all',
  type: 'all',
  page: 1,
  pageSize: 20,
  sort: { key: 'madeAt', dir: 'desc' },
};



// ── Demo switch (mockup only) ─────────────────────────

function renderDemo() {
  const host = qs('#approvals-demo');
  const acting = mockApi.getActingAdmin();
  const checkers = mockApi.listCheckers();

  const text = el('div', 'details apr-demo__text');
  const title = el('h6', 'apr-demo__title');
  title.appendChild(el('span', 'apr-demo__badge', t('approvals.demoBadge')));
  const [before, after] = t('approvals.demoTitle').split('{email}');
  title.append(document.createTextNode(before ?? ''), ltr(acting.email, 'strong'), document.createTextNode(after ?? ''));
  text.appendChild(title);
  if (!acting.isSignedInAdmin) {
    const signed = el('p', 'apr-demo__sub');
    const [b2, a2] = t('approvals.demoSignedIn').split('{email}');
    signed.append(document.createTextNode(b2 ?? ''), ltr(acting.signedIn), document.createTextNode(a2 ?? ''));
    text.appendChild(signed);
  }
  text.appendChild(el('p', 'apr-demo__sub', t('approvals.demoHint')));

  const controls = el('div', 'apr-demo__controls');
  const selectId = 'approvals-demo-select';
  const label = el('label', 'visually-hidden', t('approvals.demoSelectLabel'));
  label.htmlFor = selectId;
  const select = el('select', 'form-select apr-demo__select');
  select.id = selectId;
  checkers.forEach((email) => {
    const option = el('option', null, email);
    option.value = email;
    if (email === acting.email) option.selected = true;
    select.appendChild(option);
  });
  const actAs = kitButton(t('approvals.demoActAs'), 'btn-warning', 'fa-solid fa-user-group');
  actAs.addEventListener('click', () => {
    mockApi.setActingAdmin(select.value);
    window.location.reload();
  });
  controls.append(label, select, actAs);
  if (!acting.isSignedInAdmin) {
    const back = kitButton(t('approvals.demoBack'), 'btn-warning-outline', 'fa-solid fa-rotate-left');
    back.addEventListener('click', () => {
      mockApi.setActingAdmin(null);
      window.location.reload();
    });
    controls.appendChild(back);
  }

  host.replaceChildren(icon('fa-solid fa-user-secret'), text, controls);
  host.classList.toggle('apr-demo--acting', !acting.isSignedInAdmin);
}

renderDemo();

// ── KPI row ───────────────────────────────────────────

const stats = mountStatRow(qs('#approvals-stats'), [
  { key: 'pending', label: t('approvals.statPending'), tone: 'warning', icon: 'prossesing.svg' },
  { key: 'oldest', label: t('approvals.statOldest'), tone: 'primary', icon: 'stopwatch.svg' },
  { key: 'today', label: t('approvals.statDecidedToday'), tone: 'success', icon: 'checked-2.svg' },
]);

const HOUR = 60 * 60 * 1000;

/** Arabic counts take a different noun form for 1, 2, 3–10 and 11+; English reuses the same text. */
const plural = (n) => (n === 1 ? 'one' : n === 2 ? 'two' : n <= 10 ? 'few' : 'many');

/** "Under an hour" / "5 hours" / "2 days" since `since`; "None" when nothing is pending. */
function waitingFor(since) {
  if (!Number.isFinite(since)) return t('approvals.waitingNone');
  const hours = Math.floor((Date.now() - since) / HOUR);
  if (hours < 1) return t('approvals.waitingUnderHour');
  if (hours < 24) return t(`approvals.waitingHour_${plural(hours)}`, { n: hours });
  const days = Math.floor(hours / 24);
  return t(`approvals.waitingDay_${plural(days)}`, { n: days });
}

async function loadStats() {
  const dash = t('common.notAvailable');
  try {
    const [pending, decided] = await Promise.all([
      mockApi.listApprovals({ status: 'pending', pageSize: 1000 }),
      mockApi.listApprovals({ status: 'decided', pageSize: 1000 }),
    ]);
    // Requests never expire (spec §1), so the checker's cue is how long the
    // oldest one has been waiting — it is the one to clear first.
    const oldest = pending.rows.reduce((min, r) => Math.min(min, r.madeAt), Infinity);
    const today = toDateInputValue(Date.now());
    const decidedToday = decided.rows.filter((r) => r.decidedAt && toDateInputValue(r.decidedAt) === today).length;
    stats.get('pending')?.setAttribute('value', String(pending.total));
    stats.get('oldest')?.setAttribute('value', waitingFor(oldest));
    stats.get('today')?.setAttribute('value', String(decidedToday));
  } catch {
    stats.forEach((card) => card.setAttribute('value', dash));
  }
}

// ── Filter: status, made by, area, type ───────────────

filters.fields = [
  {
    type: 'select',
    key: 'status',
    label: t('common.status'),
    value: 'pending',
    options: [
      { value: 'pending', label: t('approvals.tabPending') },
      { value: 'decided', label: t('approvals.tabDecided') },
    ],
  },
  {
    type: 'select',
    key: 'madeBy',
    label: t('approvals.madeByLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('approvals.madeByAll') },
      { value: 'others', label: t('approvals.madeByOthers') },
      { value: 'mine', label: t('approvals.madeByMine') },
    ],
  },
  {
    type: 'select',
    key: 'area',
    label: t('approvals.areaLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('approvals.allAreas') },
      ...mockApi.approvalAreas().map((area) => ({ value: area, label: t(`approvals.area.${area}`) })),
    ],
  },
  {
    type: 'select',
    key: 'type',
    label: t('approvals.typeLabel'),
    value: 'all',
    options: [
      { value: 'all', label: t('approvals.allTypes') },
      ...mockApi.approvalTypes().map((type) => ({ value: type, label: typeLabel(type) })),
    ],
  },
];

filters.addEventListener('change', (event) => {
  const next = event.detail ?? {};
  const status = next.status === 'decided' ? 'decided' : 'pending';
  const statusChanged = status !== query.status;
  query.status = status;
  query.madeBy = next.madeBy ?? 'all';
  query.area = next.area ?? 'all';
  query.type = next.type ?? 'all';
  query.page = 1;
  if (statusChanged) {
    query.sort = { key: status === 'pending' ? 'madeAt' : 'decidedAt', dir: 'desc' };
    table.sort = query.sort;
    configureColumns();
  }
  load();
});

// ── Grid ──────────────────────────────────────────────

function configureColumns() {
  const columns = [
    {
      key: 'id',
      label: t('approvals.colId'),
      sortable: true,
      className: 'ad-table__id',
      render: (row) => ltr(row.id),
    },
    { key: 'type', label: t('approvals.colType'), sortable: true, render: (row) => typeLabel(row.type) },
    { key: 'subject', label: t('approvals.colSubject'), render: (row) => subjectLink(row.subject, row.type) },
    {
      key: 'amount',
      label: t('approvals.colAmount'),
      sortable: true,
      headerClass: 'apr-amount',
      className: 'apr-amount',
      render: (row) => (row.amount === null || row.amount === undefined ? '' : el('p', 'text-bold ad-ltr', money(Math.abs(row.amount)))),
    },
    { key: 'madeAt', label: t('approvals.colMadeBy'), sortable: true, render: (row) => who(row.maker, row.madeAt, row.madeByYou) },
    { key: 'status', label: t('approvals.colStatus'), render: (row) => lamp(row.status) },
  ];
  if (query.status === 'decided') {
    columns.push({
      key: 'decidedAt',
      label: t('approvals.colCheckedBy'),
      sortable: true,
      render: (row) => (row.checker ? who(row.checker, row.decidedAt) : ''),
    });
  }
  columns.push({
    key: 'actions',
    label: t('common.actions'),
    headerClass: 'apr-actions',
    className: 'apr-actions',
    render: (row) => {
      const btn = kitButton(` ${t('approvals.review')}`, 'grid-options-btn view-icon', 'fa-regular fa-eye');
      btn.setAttribute('aria-label', t('approvals.reviewAria', { id: row.id }));
      btn.addEventListener('click', () => review.open(row.id));
      return btn;
    },
  });
  table.columns = columns;
  table.emptyState = query.status === 'pending'
    ? { icon: 'checked-2.svg', heading: t('approvals.emptyPendingHeading'), message: t('approvals.emptyPendingMessage') }
    : { icon: 'review-list.svg', heading: t('approvals.emptyDecidedHeading'), message: t('approvals.emptyDecidedMessage') };
}

table.pageSize = query.pageSize;
table.sort = query.sort;
configureColumns();

table.addEventListener('sortchange', (event) => {
  query.sort = event.detail;
  table.sort = query.sort;
  load();
});

table.addEventListener('pagechange', (event) => {
  query.page = event.detail.page;
  load();
});

const guard = createRequestGuard();

async function load() {
  const isCurrent = guard();
  table.setLoading();
  try {
    const result = await mockApi.listApprovals(query);
    if (!isCurrent()) return;
    table.setData(result);
  } catch (error) {
    if (!isCurrent()) return;
    table.setError(error.message, load);
  }
}

function refreshAll() {
  load();
  loadStats();
  shell.refreshNavCounts?.();
}

// ── Review dialog (shared with the business screens) ──

// Opened from a business screen's link (`&return=`), a decision goes back there.
const review = createApprovalReview({ urlParam: 'id', returnTo: returnTarget(), onDecided: refreshAll });

// ── Boot ──────────────────────────────────────────────

load();
loadStats();

const deepLink = new URLSearchParams(window.location.search).get('id');
if (deepLink) review.open(deepLink);
