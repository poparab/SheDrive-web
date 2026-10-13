/**
 * approvals.js — SheDrive admin maker-checker queue (2026-10-14 spec §1)
 *
 * Every finance action is a request. One admin makes it, a different admin
 * approves or rejects it, and only an approval changes data. This screen lists
 * requests (Pending / Decided), opens one in a review modal with a before → after
 * table and its type context, and records the decision.
 *
 * Deep link: approvals.html?id=APR-0004 opens that request on load.
 * Demo only: the switch at the top acts as another admin (spec §7).
 */

import { adminAuth } from './admin-auth.js';
import { mockApi } from './mock-api.js';
import { createRequestGuard } from './request-guard.js';
import { formatDateTime, formatPercent, toDateInputValue } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, hasKey } from './admin-i18n.js';
import { mountStatRow } from './list-metrics.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
const tabs = qs('#approvals-tabs');
const filters = qs('#approvals-filters');
const table = qs('#approvals-table');

const query = {
  status: 'pending',
  type: 'all',
  page: 1,
  pageSize: 20,
  sort: { key: 'madeAt', dir: 'desc' },
};

// ── Small helpers ─────────────────────────────────────

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** Latin data (ids, emails, money) keeps its own direction inside Arabic text. */
const ltr = (text, tag = 'span') => el(tag, 'ad-ltr', text);

/** "1,240.50" — two decimals, Latin digits, no unit (the column header carries it). */
function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const typeLabel = (type) => t(`approvals.type.${type}`);
const payoutTypeLabel = (type) => (type ? t(`approvals.payoutType.${type}`) : t('common.notAvailable'));

/** Status lamp, kit markup: pending=warning, approved=success, rejected=danger. */
const LAMPS = { pending: 'status-warning-lamp', approved: 'status-active-lamp', rejected: 'status-danger-lamp' };
function lamp(status) {
  const wrap = el('div', LAMPS[status] ?? 'status-disabled-lamp');
  wrap.append(el('div', 'lamp'), document.createTextNode(t(`status.${status}`)));
  return wrap;
}

/** Where the subject of a request lives. */
function subjectHref(subject) {
  const id = encodeURIComponent(subject.id);
  switch (subject.kind) {
    case 'driver': return `driver-profile.html?id=${id}`;
    case 'rider': return `rider-profile.html?id=${id}`;
    case 'zone': return 'pricing-zones.html';
    case 'batch': return `payout-batch.html?id=${id}`;
    case 'import': return `settlement-imports.html?id=${id}`;
    case 'policy': return 'pricing-policies.html';
    default: return null;
  }
}

function subjectLink(subject) {
  const href = subjectHref(subject);
  const node = href ? el('a', 'apr-subject', subject.label) : el('span', 'apr-subject', subject.label);
  if (href) node.href = href;
  return node;
}

/** Email on one line, when on the next. */
function who(email, at, mine = false) {
  const wrap = el('div', 'apr-who');
  const name = ltr(email, 'span');
  name.classList.add('apr-who__email');
  wrap.appendChild(name);
  if (mine) wrap.appendChild(el('span', 'apr-who__you', t('approvals.you')));
  wrap.appendChild(el('span', 'apr-who__when', formatDateTime(at)));
  return wrap;
}

// ── Demo switch (mockup only) ─────────────────────────

function renderDemo() {
  const host = qs('#approvals-demo');
  const acting = mockApi.getActingAdmin();
  const checkers = mockApi.listCheckers();

  const badge = el('span', 'apr-demo__badge', t('approvals.demoBadge'));
  const text = el('div', 'apr-demo__text');
  const title = el('p', 'apr-demo__title');
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
  const actAs = el('button', 'btn btn-primary btn--sm', t('approvals.demoActAs'));
  actAs.type = 'button';
  actAs.addEventListener('click', () => {
    mockApi.setActingAdmin(select.value);
    window.location.reload();
  });
  controls.append(label, select, actAs);
  if (!acting.isSignedInAdmin) {
    const back = el('button', 'btn btn-primary-outline btn--sm', t('approvals.demoBack'));
    back.type = 'button';
    back.addEventListener('click', () => {
      mockApi.setActingAdmin(null);
      window.location.reload();
    });
    controls.appendChild(back);
  }

  host.replaceChildren(badge, text, controls);
  host.classList.toggle('apr-demo--acting', !acting.isSignedInAdmin);
}

renderDemo();

// ── KPI row ───────────────────────────────────────────

const stats = mountStatRow(qs('#approvals-stats'), [
  { key: 'pending', label: t('approvals.statPending'), tone: 'warning', icon: 'prossesing.svg' },
  { key: 'amount', label: t('approvals.statPendingAmount'), tone: 'primary', icon: 'wallet.svg' },
  { key: 'today', label: t('approvals.statDecidedToday'), tone: 'success', icon: 'checked-2.svg' },
]);

async function loadStats() {
  const dash = t('common.notAvailable');
  try {
    const [pending, decided] = await Promise.all([
      mockApi.listApprovals({ status: 'pending', pageSize: 1000 }),
      mockApi.listApprovals({ status: 'decided', pageSize: 1000 }),
    ]);
    // Money at stake: a fee waiver carries the fee as a negative amount.
    const amount = pending.rows.reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0);
    const today = toDateInputValue(Date.now());
    const decidedToday = decided.rows.filter((r) => r.decidedAt && toDateInputValue(r.decidedAt) === today).length;
    stats.get('pending')?.setAttribute('value', String(pending.total));
    stats.get('amount')?.setAttribute('value', `${money(amount)} ${t('common.egp')}`);
    stats.get('today')?.setAttribute('value', String(decidedToday));
  } catch {
    stats.forEach((card) => card.setAttribute('value', dash));
  }
}

// ── Tabs + filter ─────────────────────────────────────

tabs.tabs = [
  { key: 'pending', label: t('approvals.tabPending') },
  { key: 'decided', label: t('approvals.tabDecided') },
];
tabs.active = 'pending';

tabs.addEventListener('tabchange', (event) => {
  query.status = event.detail.key;
  query.page = 1;
  query.sort = { key: query.status === 'pending' ? 'madeAt' : 'decidedAt', dir: 'desc' };
  table.sort = query.sort;
  configureColumns();
  load();
});

filters.fields = [
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
  Object.assign(query, event.detail);
  query.page = 1;
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
    { key: 'subject', label: t('approvals.colSubject'), render: (row) => subjectLink(row.subject) },
    {
      key: 'amount',
      label: t('approvals.colAmount'),
      sortable: true,
      headerClass: 'apr-amount',
      className: 'apr-amount',
      render: (row) => {
        const cell = ltr(row.amount === null || row.amount === undefined ? '' : money(Math.abs(row.amount)));
        return cell;
      },
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
      const btn = el('button', 'btn btn-primary-outline btn--sm', t('approvals.review'));
      btn.type = 'button';
      btn.setAttribute('aria-label', t('approvals.reviewAria', { id: row.id }));
      btn.addEventListener('click', () => openReview(row.id));
      return btn;
    },
  });
  table.columns = columns;
  table.emptyState = query.status === 'pending'
    ? { icon: '✓', heading: t('approvals.emptyPendingHeading'), message: t('approvals.emptyPendingMessage') }
    : { icon: '☐', heading: t('approvals.emptyDecidedHeading'), message: t('approvals.emptyDecidedMessage') };
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

// ── Review modal ──────────────────────────────────────

const modal = buildModal();
let current = null;

function buildModal() {
  const root = el('div', 'modal fade popup-primary apr-modal');
  root.id = 'approval-modal';
  root.tabIndex = -1;
  root.setAttribute('aria-labelledby', 'approval-modal-title');
  root.setAttribute('aria-hidden', 'true');

  const dialog = el('div', 'modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable');
  const content = el('div', 'modal-content');

  const header = el('div', 'modal-header');
  const title = el('h4', 'apr-modal__title');
  title.id = 'approval-modal-title';
  const close = el('button', 'btn-close');
  close.type = 'button';
  close.setAttribute('data-bs-dismiss', 'modal');
  close.setAttribute('aria-label', t('aria.closeDialog'));
  header.append(title, close);

  const body = el('div', 'modal-body apr-modal__body');
  const footer = el('div', 'modal-footer apr-modal__footer');

  content.append(header, body, footer);
  dialog.appendChild(content);
  root.appendChild(dialog);
  document.body.appendChild(root);

  root.addEventListener('hidden.bs.modal', () => {
    current = null;
    const url = new URL(window.location.href);
    if (url.searchParams.has('id')) {
      url.searchParams.delete('id');
      window.history.replaceState(null, '', url);
    }
  });

  return { root, title, body, footer, instance: null };
}

async function showModal() {
  try {
    await loadBootstrap();
  } catch {
    /* handled below */
  }
  if (window.bootstrap?.Modal) {
    modal.instance = window.bootstrap.Modal.getOrCreateInstance(modal.root);
    modal.instance.show();
  } else {
    modal.root.classList.add('show');
    modal.root.style.display = 'block';
  }
}

function hideModal() {
  if (modal.instance) modal.instance.hide();
  else {
    modal.root.classList.remove('show');
    modal.root.style.display = 'none';
  }
}

async function openReview(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('id', id);
  window.history.replaceState(null, '', url);

  modal.title.textContent = id;
  modal.body.replaceChildren(el('p', 'apr-muted', t('approvals.modalLoading')));
  modal.footer.replaceChildren();
  showModal();

  try {
    const request = await mockApi.getApproval(id);
    if (!request) {
      modal.body.replaceChildren(errorBox(t('approvals.notFound')));
      modal.footer.replaceChildren(closeButton());
      return;
    }
    current = request;
    renderReview(request);
  } catch (error) {
    modal.body.replaceChildren(errorBox(error?.message || t('approvals.loadFailed')));
    modal.footer.replaceChildren(closeButton());
  }
}

function errorBox(message) {
  const box = el('div', 'ad-form-error is-visible', message);
  box.setAttribute('role', 'alert');
  return box;
}

function closeButton() {
  const btn = el('button', 'btn btn-primary-outline', t('common.close'));
  btn.type = 'button';
  btn.addEventListener('click', hideModal);
  return btn;
}

function section(titleText, ...children) {
  const wrap = el('section', 'apr-section');
  wrap.appendChild(el('h5', 'apr-section__title', titleText));
  wrap.append(...children.filter(Boolean));
  return wrap;
}

/** Key/value list: [[label, value(Node|string)], …]. */
function kvList(pairs) {
  const dl = el('dl', 'apr-kv');
  pairs.forEach(([label, value]) => {
    if (value === undefined) return;
    dl.appendChild(el('dt', null, label));
    const dd = el('dd');
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = value === null || value === '' ? t('common.notAvailable') : String(value);
    dl.appendChild(dd);
  });
  return dl;
}

/** A plain kit grid. headers: [{label, num}], rows: [[cell…]]. */
function grid(headers, rows) {
  const wrap = el('div', 'table-responsive apr-grid');
  const tableEl = el('table', 'table custom-grid-list');
  const thead = el('thead');
  const hr = el('tr');
  headers.forEach((h) => {
    const th = el('th', h.num ? 'apr-amount' : null, h.label);
    th.scope = 'col';
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  const tbody = el('tbody');
  rows.forEach((cells) => {
    const tr = el('tr', cells.className);
    cells.forEach((cell, i) => {
      const td = el('td', headers[i]?.num ? 'apr-amount' : null);
      if (cell instanceof Node) td.appendChild(cell);
      else td.textContent = cell === null || cell === undefined || cell === '' ? t('common.notAvailable') : String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.append(thead, tbody);
  wrap.appendChild(tableEl);
  return wrap;
}

const MONEY_KEYS = new Set(['baseFare', 'perKm', 'perMin', 'minFare', 'cancellationFee', 'balance', 'fee', 'total']);

function fieldLabel(key) {
  const k = `approvals.field.${key}`;
  const value = t(k);
  return value === k ? key : value;
}

function fieldValue(key, value) {
  if (value === undefined || value === null) return t('common.notAvailable');
  if (key === 'removed') return value ? t('approvals.removedValue') : t('common.notAvailable');
  if (MONEY_KEYS.has(key)) return ltr(`${money(value)} ${t('common.egp')}`);
  if (key === 'percentage') return ltr(formatPercent(value));
  if (key === 'type') return payoutTypeLabel(value);
  if (key === 'number' || key === 'provider') return ltr(value);
  return ltr(String(value));
}

function diffTable(before, after) {
  const b = before ?? {};
  const a = after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return el('p', 'apr-muted', t('approvals.noChange'));
  const rows = keys.map((key) => {
    const row = [
      fieldLabel(key),
      key in b ? fieldValue(key, b[key]) : t('common.notAvailable'),
      key in a ? fieldValue(key, a[key]) : t('common.notAvailable'),
    ];
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) row.className = 'apr-changed';
    return row;
  });
  return grid(
    [{ label: t('approvals.colField') }, { label: t('approvals.colBefore') }, { label: t('approvals.colAfter') }],
    rows,
  );
}

function resultCell(line, result) {
  const res = result?.find((r) => r.lineRef === line.lineRef);
  const status = res?.status ?? (line.status === 'paid' ? 'SUCCESS' : line.status === 'failed' ? 'FAILED' : null);
  if (status === 'SUCCESS') {
    const wrap = el('div', 'apr-result');
    wrap.appendChild(lamp('approved'));
    wrap.firstChild.lastChild.textContent = t('approvals.resultSuccess');
    const ref = res?.bankReference ?? line.bankReference;
    if (ref) wrap.appendChild(ltr(ref, 'small'));
    return wrap;
  }
  if (status === 'FAILED') {
    const wrap = el('div', 'apr-result');
    wrap.appendChild(lamp('rejected'));
    wrap.firstChild.lastChild.textContent = t('approvals.resultFailed');
    const reason = res?.failureReason ?? line.failureReason;
    if (reason) wrap.appendChild(el('small', 'apr-muted', reason));
    return wrap;
  }
  return el('span', 'apr-muted', t('approvals.resultPending'));
}

function batchContext(request) {
  const batch = request.batch;
  if (!batch) return null;
  const withResult = request.type === 'payout_result';
  const headers = [
    { label: t('approvals.colDriver') },
    { label: t('approvals.colPayoutType') },
    { label: t('approvals.colNumber') },
    { label: t('approvals.colLineAmount'), num: true },
  ];
  if (withResult) headers.push({ label: t('approvals.colResult') });
  const rows = batch.lines.map((line) => {
    const driver = el('a', null, line.driverName);
    driver.href = `driver-profile.html?id=${encodeURIComponent(line.driverId)}`;
    const cells = [driver, payoutTypeLabel(line.payoutType), ltr(line.number), ltr(money(line.amount))];
    if (withResult) cells.push(resultCell(line, batch.result));
    return cells;
  });
  return section(
    t('approvals.sectionLines'),
    kvList([
      [t('approvals.kvBatch'), ltr(batch.ref)],
      // Batch status copy is owned by the Payouts screen's locale; fall back to the raw value.
      [t('approvals.kvBatchStatus'), hasKey(`payouts.status_${batch.status}`) ? t(`payouts.status_${batch.status}`) : batch.status],
    ]),
    grid(headers, rows),
  );
}

function importContext(request) {
  const imp = request.import;
  if (!imp) return null;
  const rows = imp.rows.map((row) => [
    ltr(row.rowNo),
    row.driverName,
    ltr(row.nationalId),
    ltr(money(row.amount)),
    ltr(row.paymentDate),
    row.channel,
    ltr(row.paymentRef),
    row.receipt ? ltr(row.receipt) : '',
  ]);
  return section(
    t('approvals.sectionRows'),
    kvList([[t('approvals.kvFile'), ltr(imp.fileName)]]),
    grid(
      [
        { label: t('approvals.colRowNo') },
        { label: t('approvals.colDriver') },
        { label: t('approvals.colNationalId') },
        { label: t('approvals.colLineAmount'), num: true },
        { label: t('approvals.colPaymentDate') },
        { label: t('approvals.colChannel') },
        { label: t('approvals.colPaymentRef') },
        { label: t('approvals.colReceipt') },
      ],
      rows,
    ),
  );
}

function waiverContext(request) {
  const p = request.payload ?? {};
  let trip = null;
  if (p.tripId) {
    trip = ltr(p.tripId, 'a');
    trip.href = `trip-detail.html?id=${encodeURIComponent(p.tripId)}`;
  }
  return section(t('approvals.sectionWaiver'), kvList([[t('approvals.kvReason'), p.reason ?? ''], [t('approvals.kvTrip'), trip ?? '']]));
}

function methodCard(titleText, m) {
  const card = el('div', 'apr-method');
  card.appendChild(el('h6', 'apr-method__title', titleText));
  if (!m) {
    card.appendChild(el('p', 'apr-muted', t('approvals.methodNone')));
    return card;
  }
  card.appendChild(kvList([
    [t('approvals.field.type'), payoutTypeLabel(m.type)],
    [t('approvals.field.provider'), m.provider && m.provider !== '—' ? ltr(m.provider) : ''],
    [t('approvals.field.number'), ltr(m.masked ?? '')],
    [t('approvals.holder'), m.holderName ? ltr(m.holderName) : undefined],
  ]));
  return card;
}

function methodContext(request) {
  const wrap = el('div', 'apr-method-pair');
  wrap.append(methodCard(t('approvals.methodBefore'), request.methodBefore), methodCard(t('approvals.methodAfter'), request.methodAfter));
  return section(t('approvals.sectionMethod'), wrap);
}

function ledgerContext(request) {
  const p = request.payload ?? {};
  const pairs = [];
  if (p.method) pairs.push([t('approvals.kvMethod'), p.method]);
  if (p.reference) pairs.push([t('approvals.kvReference'), ltr(p.reference)]);
  if (p.at) pairs.push([t('approvals.kvPaymentDate'), formatDateTime(p.at)]);
  if (p.note) pairs.push([t('approvals.kvNote'), p.note]);
  return pairs.length ? section(t('approvals.sectionDetails'), kvList(pairs)) : null;
}

function typeContext(request) {
  switch (request.type) {
    case 'payout_batch':
    case 'payout_result':
      return batchContext(request);
    case 'settlement_import':
      return importContext(request);
    case 'fee_waiver':
      return waiverContext(request);
    case 'payout_method':
      return methodContext(request);
    case 'payout':
    case 'settlement':
      return ledgerContext(request);
    default:
      return null;
  }
}

function renderReview(request) {
  modal.title.textContent = t('approvals.modalTitle', { type: typeLabel(request.type), id: request.id });

  const summary = section(
    t('approvals.sectionRequest'),
    el('p', 'apr-effect', t(`approvals.typeEffect.${request.type}`)),
    kvList([
      [t('approvals.kvSubject'), subjectLink(request.subject)],
      [t('approvals.kvAmount'), request.amount === null || request.amount === undefined ? undefined : ltr(`${money(Math.abs(request.amount))} ${t('common.egp')}`)],
      [t('approvals.kvMadeBy'), who(request.maker, request.madeAt, request.madeByYou)],
      [t('approvals.kvStatus'), lamp(request.status)],
    ]),
  );

  const change = section(t('approvals.sectionChange'), diffTable(request.before, request.after));
  const context = typeContext(request);

  let decision = null;
  if (request.status !== 'pending') {
    decision = section(
      t('approvals.sectionDecision'),
      kvList([
        [t('approvals.kvCheckedBy'), request.checker ? ltr(request.checker) : ''],
        [t('approvals.kvDecidedAt'), formatDateTime(request.decidedAt)],
        [t('approvals.kvRejectReason'), request.status === 'rejected' ? request.rejectReason ?? '' : undefined],
      ]),
    );
  }

  const error = el('div', 'ad-form-error');
  error.setAttribute('role', 'alert');
  error.id = 'approval-error';

  modal.body.replaceChildren(...[summary, change, context, decision].filter(Boolean), error);
  renderFooter(request, error);
}

function renderFooter(request, errorHost) {
  modal.footer.replaceChildren();
  if (request.status !== 'pending') {
    modal.footer.appendChild(closeButton());
    return;
  }

  const showError = (message) => {
    errorHost.textContent = message;
    errorHost.classList.toggle('is-visible', Boolean(message));
  };

  const approve = el('button', 'btn btn-success', t('approvals.approve'));
  approve.type = 'button';
  const reject = el('button', 'btn btn-danger-outline', t('approvals.reject'));
  reject.type = 'button';

  if (request.madeByYou || !request.canDecide) {
    approve.disabled = true;
    reject.disabled = true;
    const note = el('p', 'apr-own-note');
    note.append(el('i', 'fa-solid fa-circle-info'), document.createTextNode(` ${t('approvals.madeByYouNote')}`));
    modal.footer.append(note, approve, reject);
    return;
  }

  // Inline reject form: reason 10–500 chars.
  const form = el('form', 'apr-reject');
  form.noValidate = true;
  form.hidden = true;
  const field = el('div', 'field');
  const label = el('label', 'field__label', t('approvals.rejectReasonLabel'));
  label.htmlFor = 'approval-reject-reason';
  const textarea = el('textarea', 'form-control');
  textarea.id = 'approval-reject-reason';
  textarea.rows = 3;
  textarea.maxLength = 600;
  textarea.setAttribute('aria-describedby', 'approval-reject-hint approval-reject-error');
  const hint = el('p', 'field__hint', t('approvals.rejectReasonHint'));
  hint.id = 'approval-reject-hint';
  const fieldError = el('p', 'field__error apr-field-error');
  fieldError.id = 'approval-reject-error';
  fieldError.setAttribute('role', 'alert');
  field.append(label, textarea, hint, fieldError);

  const confirmReject = el('button', 'btn btn-danger', t('approvals.confirmReject'));
  confirmReject.type = 'submit';
  const back = el('button', 'btn btn-primary-outline', t('approvals.cancelReject'));
  back.type = 'button';
  const formActions = el('div', 'apr-reject__actions');
  formActions.append(confirmReject, back);
  form.append(field, formActions);

  const validateReason = () => {
    const text = textarea.value.trim();
    if (!text) return t('approvals.rejectReasonEmpty');
    if (text.length < 10) return t('approvals.rejectReasonShort');
    if (text.length > 500) return t('approvals.rejectReasonLong');
    return null;
  };
  const setFieldError = (message) => {
    fieldError.textContent = message ?? '';
    textarea.classList.toggle('is-invalid', Boolean(message));
    textarea.setAttribute('aria-invalid', message ? 'true' : 'false');
  };
  textarea.addEventListener('input', () => {
    if (fieldError.textContent) setFieldError(validateReason());
  });

  const decisionButtons = el('div', 'apr-decide');
  decisionButtons.append(approve, reject);

  const setBusy = (busy, btn) => {
    [approve, reject, confirmReject, back, textarea].forEach((n) => { n.disabled = busy; });
    if (btn) btn.textContent = busy ? t('approvals.busy') : btn.dataset.label;
  };
  approve.dataset.label = approve.textContent;
  confirmReject.dataset.label = confirmReject.textContent;

  approve.addEventListener('click', async () => {
    showError('');
    setBusy(true, approve);
    try {
      await mockApi.approveRequest(request.id);
      shell.showToast?.(t('approvals.toastApproved', { id: request.id }), 'success');
      hideModal();
      refreshAll();
    } catch (error) {
      setBusy(false, approve);
      showError(error?.message || t('approvals.loadFailed'));
    }
  });

  reject.addEventListener('click', () => {
    showError('');
    decisionButtons.hidden = true;
    form.hidden = false;
    textarea.focus();
  });

  back.addEventListener('click', () => {
    setFieldError(null);
    showError('');
    form.hidden = true;
    decisionButtons.hidden = false;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    const problem = validateReason();
    setFieldError(problem);
    if (problem) {
      textarea.focus();
      return;
    }
    setBusy(true, confirmReject);
    try {
      await mockApi.rejectRequest(request.id, textarea.value.trim());
      shell.showToast?.(t('approvals.toastRejected', { id: request.id }), 'success');
      hideModal();
      refreshAll();
    } catch (error) {
      setBusy(false, confirmReject);
      showError(error?.message || t('approvals.loadFailed'));
    }
  });

  modal.footer.append(decisionButtons, form);
}

// ── Boot ──────────────────────────────────────────────

load();
loadStats();

const deepLink = new URLSearchParams(window.location.search).get('id');
if (deepLink) openReview(deepLink);
