/**
 * approvals.js — SheDrive admin maker-checker queue (2026-10-14 spec §1)
 *
 * Every finance action is a request. One admin makes it, a different admin
 * approves or rejects it, and only an approval changes data. This screen lists
 * requests (Pending / Decided, picked in the filter row — the kit has no tabs),
 * opens one in a kit `default-modal` with who made it, the before → after
 * change and its type context, and records the decision:
 *
 *   Approve → kit `popup-warning` confirm → success toast
 *   Reject  → kit `default-modal` with the reason (10–500) → success toast
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
import { t, hasKey, isRtl } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';
import { mountStatRow } from './list-metrics.js';

if (!adminAuth.requireAdmin()) {
  throw new Error('Redirecting to sign-in');
}

const shell = qs('ad-shell');
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

function icon(classes) {
  const i = el('i', classes);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/** A kit button: leading Font Awesome glyph + label. */
function kitButton(label, className, glyph) {
  const b = el('button', `btn ${className}`);
  b.type = 'button';
  if (glyph) b.appendChild(icon(glyph));
  b.appendChild(document.createTextNode(label));
  return b;
}

const backGlyph = () => (isRtl() ? 'fa-solid fa-arrow-right' : 'fa-solid fa-arrow-left');
const forwardGlyph = () => (isRtl() ? 'fa-solid fa-arrow-left' : 'fa-solid fa-arrow-right');

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
function lamp(status, label = t(`status.${status}`)) {
  const wrap = el('div', LAMPS[status] ?? 'status-disabled-lamp');
  wrap.append(el('div', 'lamp'), document.createTextNode(label));
  return wrap;
}

/** Where the subject of a request lives. Money requests open the person's ledger. */
function subjectHref(subject, type = null) {
  const id = encodeURIComponent(subject.id);
  switch (subject.kind) {
    case 'driver':
      return type === 'settlement' || type === 'payout' ? `driver-balance-details.html?id=${id}` : `driver-profile.html?id=${id}`;
    case 'rider':
      return type === 'fee_waiver' ? `rider-balance-details.html?id=${id}` : `rider-profile.html?id=${id}`;
    case 'zone': return 'pricing-zones.html';
    case 'batch': return `payout-batch.html?id=${id}`;
    case 'import': return `settlement-imports.html?id=${id}`;
    case 'policy': return 'pricing-policies.html';
    default: return null;
  }
}

function subjectLink(subject, type = null) {
  const href = subjectHref(subject, type);
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

// ── Filter: status (Pending / Decided) + type ─────────

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
      btn.addEventListener('click', () => openReview(row.id));
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

// ── Kit modals ────────────────────────────────────────
//
// Bootstrap cannot stack modals, so the flow review → confirm → success hides
// one before showing the next. `moving` tells a modal's hidden handler that the
// flow continues, so the `?id=` deep link survives until the flow really ends.

let moving = false;

async function bootstrapModal() {
  try {
    await loadBootstrap();
  } catch {
    /* fall back to class toggling */
  }
  return window.bootstrap?.Modal ?? null;
}

/**
 * Build a kit modal on <body>.
 * variant: 'default-modal' | 'popup-warning' | 'popup-success'
 */
function buildModal(id, variant, dialogClass = '') {
  const root = el('div', `modal fade ${variant} apr-modal`);
  root.id = id;
  root.tabIndex = -1;
  root.setAttribute('aria-labelledby', `${id}-title`);
  root.setAttribute('aria-hidden', 'true');
  root.dataset.bsBackdrop = 'static';

  const dialog = el('div', `modal-dialog modal-dialog-centered ${dialogClass}`.trim());
  const content = el('div', 'modal-content');
  const header = el('div', 'modal-header');
  const close = el('button', 'btn-close');
  close.type = 'button';
  close.setAttribute('data-bs-dismiss', 'modal');
  close.setAttribute('aria-label', t('aria.closeDialog'));
  header.appendChild(close);
  const body = el('div', 'modal-body');
  const footer = el('div', 'modal-footer');
  content.append(header, body, footer);
  dialog.appendChild(content);
  root.appendChild(dialog);
  document.body.appendChild(root);

  root.addEventListener('hidden.bs.modal', () => {
    if (!moving) endFlow();
  });

  const api = {
    root,
    header,
    body,
    footer,
    close,
    async show() {
      const Modal = await bootstrapModal();
      if (Modal) Modal.getOrCreateInstance(root).show();
      else {
        root.classList.add('show');
        root.style.display = 'block';
      }
    },
    hide() {
      return new Promise((resolve) => {
        const Modal = window.bootstrap?.Modal;
        if (Modal && root.classList.contains('show')) {
          root.addEventListener('hidden.bs.modal', () => resolve(), { once: true });
          Modal.getOrCreateInstance(root).hide();
        } else {
          root.classList.remove('show');
          root.style.display = 'none';
          if (!moving) endFlow();
          resolve();
        }
      });
    },
    /** Kit modal header: icon + title + a bold tertiary sub-title. */
    setHeader(iconName, titleText, subText) {
      const nodes = [];
      if (iconName) {
        const img = el('img', 'icon');
        img.src = iconUrl(iconName);
        img.alt = '';
        nodes.push(img);
      }
      const h = el('h3', null, titleText);
      h.id = `${id}-title`;
      nodes.push(h);
      if (subText) nodes.push(el('span', 'tertiary-color text-bold ad-ltr', subText));
      header.replaceChildren(...nodes, close);
    },
  };
  return api;
}

/** Popup body: status sign, heading, text. */
function popupBody(modal, tone, heading, text) {
  const sign = el('div', `status-sign ${tone}`);
  sign.appendChild(icon(tone === 'success' ? 'fa-solid fa-check' : 'fa-solid fa-warning'));
  const h = el('h4', null, heading);
  h.id = `${modal.root.id}-title`;
  const nodes = [sign, h];
  if (text) nodes.push(el('p', null, text));
  modal.body.replaceChildren(...nodes);
}

async function transition(from, to) {
  moving = true;
  await from.hide();
  moving = false;
  await to.show();
}

const review = buildModal('approval-modal', 'default-modal', 'modal-lg modal-dialog-scrollable');
const confirmPopup = buildModal('approval-confirm', 'popup-warning');
const rejectModal = buildModal('approval-reject', 'default-modal');
review.root.classList.add('apr-review');

let current = null;

/** The flow is over: forget the request and drop `?id=` from the address. */
function endFlow() {
  current = null;
  const url = new URL(window.location.href);
  if (url.searchParams.has('id')) {
    url.searchParams.delete('id');
    window.history.replaceState(null, '', url);
  }
}

function alertBox(tone, message) {
  const box = el('div', `alert ${tone} apr-alert`);
  box.setAttribute('role', 'alert');
  box.append(icon(tone === 'danger' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-info'), el('p', null, message));
  return box;
}

function closeButton(modal) {
  const btn = kitButton(t('common.close'), 'btn-primary-outline', 'fa-solid fa-xmark');
  btn.addEventListener('click', () => modal.hide());
  return btn;
}

// ── Review modal content ──────────────────────────────

/** A kit card: header (title + icon) and body. */
function card(titleText, iconName, ...children) {
  const wrap = el('section', 'standard-card-theme2 white-bg apr-card');
  const header = el('div', 'card-header');
  const title = el('div', 'card-title');
  title.appendChild(el('h5', null, titleText));
  const iconBox = el('div', 'icon');
  const img = el('img');
  img.src = iconUrl(iconName);
  img.alt = '';
  iconBox.appendChild(img);
  header.append(title, iconBox);
  const body = el('div', 'card-body');
  body.append(...children.filter(Boolean));
  wrap.append(header, body);
  return wrap;
}

/** Kit key/value list: [[label, value(Node|string)], …]. Undefined values are skipped. */
function kvList(pairs) {
  const list = el('div', 'list-multi-column no-border p-0');
  const row = el('div', 'row gx-4');
  const col = el('div', 'col');
  pairs.forEach(([label, value, className]) => {
    if (value === undefined) return;
    const line = el('div', `row gx-0 list-row${className ? ` ${className}` : ''}`);
    const key = el('div', 'list-item col text-bold', label);
    const val = el('div', 'list-item col-auto justify-content-md-end');
    if (value instanceof Node) val.appendChild(value);
    else val.textContent = value === null || value === '' ? t('common.notAvailable') : String(value);
    line.append(key, val);
    col.appendChild(line);
  });
  row.appendChild(col);
  list.appendChild(row);
  return list;
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
  if (MONEY_KEYS.has(key)) return `${money(value)} ${t('common.egp')}`;
  if (key === 'percentage') return formatPercent(value);
  if (key === 'type') return payoutTypeLabel(value);
  return String(value);
}

/** One before → after line: the old value muted, an arrow, the new value bold. */
function diffValue(key, b, a, changed) {
  const wrap = el('div', 'apr-diff');
  const after = el('span', 'apr-diff__after ad-ltr', key in a ? fieldValue(key, a[key]) : t('common.notAvailable'));
  if (!changed) {
    wrap.appendChild(after);
    return wrap;
  }
  const before = el('span', 'apr-diff__before ad-ltr', key in b ? fieldValue(key, b[key]) : t('common.notAvailable'));
  const arrow = icon(`${forwardGlyph()} apr-diff__arrow`);
  wrap.append(before, arrow, after);
  wrap.setAttribute('aria-label', `${before.textContent} → ${after.textContent}`);
  return wrap;
}

function diffList(before, after) {
  const b = before ?? {};
  const a = after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return el('p', 'apr-muted', t('approvals.noChange'));
  return kvList(keys.map((key) => {
    const changed = JSON.stringify(b[key]) !== JSON.stringify(a[key]);
    return [fieldLabel(key), diffValue(key, b, a, changed), changed ? 'apr-changed' : ''];
  }));
}

function resultCell(line, result) {
  const res = result?.find((r) => r.lineRef === line.lineRef);
  const status = res?.status ?? (line.status === 'paid' ? 'SUCCESS' : line.status === 'failed' ? 'FAILED' : null);
  if (status === 'SUCCESS') {
    const wrap = el('div', 'apr-result');
    wrap.appendChild(lamp('approved', t('approvals.resultSuccess')));
    const ref = res?.bankReference ?? line.bankReference;
    if (ref) wrap.appendChild(ltr(ref, 'small'));
    return wrap;
  }
  if (status === 'FAILED') {
    const wrap = el('div', 'apr-result');
    wrap.appendChild(lamp('rejected', t('approvals.resultFailed')));
    const reason = res?.failureReason ?? line.failureReason;
    if (reason) wrap.appendChild(el('small', 'danger-color', reason));
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
    const cells = [driver, payoutTypeLabel(line.payoutType), ltr(line.number), el('p', 'text-bold ad-ltr', money(line.amount))];
    if (withResult) cells.push(resultCell(line, batch.result));
    return cells;
  });
  const batchLink = ltr(batch.ref, 'a');
  batchLink.href = `payout-batch.html?id=${encodeURIComponent(request.subject?.id ?? batch.id ?? '')}`;
  return card(
    t('approvals.sectionLines'),
    'withdrawal-wallet.svg',
    kvList([
      [t('approvals.kvBatch'), batchLink],
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
    el('p', 'text-bold ad-ltr', money(row.amount)),
    ltr(row.paymentDate),
    row.channel,
    ltr(row.paymentRef),
    row.receipt ? ltr(row.receipt) : '',
  ]);
  return card(
    t('approvals.sectionRows'),
    'file-checked.svg',
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
  const reason = el('p', 'apr-reason', p.reason ?? t('common.notAvailable'));
  return card(
    t('approvals.sectionWaiver'),
    'money-slash.svg',
    kvList([[t('approvals.kvTrip'), trip ?? '']]),
    el('p', 'text-bold apr-reason-label', t('approvals.kvReason')),
    reason,
  );
}

function methodColumn(titleText, m, tone) {
  const col = el('div', 'col-md-6');
  const box = el('div', `apr-method apr-method--${tone}`);
  box.appendChild(el('h6', 'apr-method__title', titleText));
  if (!m) {
    box.appendChild(el('p', 'apr-muted', t('approvals.methodNone')));
  } else {
    box.appendChild(kvList([
      [t('approvals.field.type'), payoutTypeLabel(m.type)],
      [t('approvals.field.provider'), m.provider && m.provider !== '—' ? ltr(m.provider) : ''],
      [t('approvals.field.number'), ltr(m.number ?? '')],
      [t('approvals.holder'), m.holderName ? ltr(m.holderName) : undefined],
    ]));
  }
  col.appendChild(box);
  return col;
}

function methodContext(request) {
  const row = el('div', 'row g-3');
  row.append(
    methodColumn(t('approvals.methodBefore'), request.methodBefore, 'before'),
    methodColumn(t('approvals.methodAfter'), request.methodAfter, 'after'),
  );
  return card(t('approvals.sectionMethod'), 'wallet.svg', row);
}

function ledgerContext(request) {
  const p = request.payload ?? {};
  const pairs = [];
  if (p.method) pairs.push([t('approvals.kvMethod'), p.method]);
  if (p.reference) pairs.push([t('approvals.kvReference'), ltr(p.reference)]);
  if (p.at) pairs.push([t('approvals.kvPaymentDate'), formatDateTime(p.at)]);
  if (p.note) pairs.push([t('approvals.kvNote'), p.note]);
  return pairs.length ? card(t('approvals.sectionDetails'), 'transactions.svg', kvList(pairs)) : null;
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

async function openReview(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('id', id);
  window.history.replaceState(null, '', url);

  review.setHeader('checked-2.svg', t('approvals.review'), id);
  review.body.replaceChildren(el('p', 'apr-muted', t('approvals.modalLoading')));
  review.footer.replaceChildren();
  review.show();

  try {
    const request = await mockApi.getApproval(id);
    if (!request) {
      review.body.replaceChildren(alertBox('danger', t('approvals.notFound')));
      review.footer.replaceChildren(closeButton(review));
      return;
    }
    current = request;
    renderReview(request);
  } catch (error) {
    review.body.replaceChildren(alertBox('danger', error?.message || t('approvals.loadFailed')));
    review.footer.replaceChildren(closeButton(review));
  }
}

function renderReview(request) {
  review.setHeader('checked-2.svg', typeLabel(request.type), request.id);

  const summary = card(
    t('approvals.sectionRequest'),
    'review-list.svg',
    kvList([
      [t('approvals.kvSubject'), subjectLink(request.subject, request.type)],
      [t('approvals.kvAmount'), request.amount === null || request.amount === undefined ? undefined : ltr(`${money(Math.abs(request.amount))} ${t('common.egp')}`)],
      [t('approvals.kvMadeBy'), who(request.maker, request.madeAt, request.madeByYou)],
      [t('approvals.kvStatus'), lamp(request.status)],
      [t('approvals.kvCheckedBy'), request.status !== 'pending' ? (request.checker ? ltr(request.checker) : '') : undefined],
      [t('approvals.kvDecidedAt'), request.status !== 'pending' ? formatDateTime(request.decidedAt) : undefined],
      [t('approvals.kvRejectReason'), request.status === 'rejected' ? request.rejectReason ?? '' : undefined],
    ]),
  );

  const change = card(t('approvals.sectionChange'), 'edit-file.svg', diffList(request.before, request.after));
  const context = typeContext(request);

  review.body.replaceChildren(
    el('p', 'small lh-sm apr-effect', t(`approvals.typeEffect.${request.type}`)),
    ...[summary, change, context].filter(Boolean),
  );
  renderReviewFooter(request);
}

function renderReviewFooter(request) {
  review.footer.replaceChildren();
  if (request.status !== 'pending') {
    review.footer.appendChild(closeButton(review));
    return;
  }

  const approve = kitButton(t('approvals.approve'), 'btn-success', 'fa-solid fa-check');
  const reject = kitButton(t('approvals.reject'), 'btn-danger', 'fa-solid fa-xmark');
  approve.id = 'approval-approve';
  reject.id = 'approval-reject-open';

  if (request.madeByYou || !request.canDecide) {
    approve.disabled = true;
    reject.disabled = true;
    const note = alertBox('info', t('approvals.madeByYouNote'));
    note.classList.add('apr-own-note');
    note.removeAttribute('role');
    review.footer.append(note, approve, reject);
    return;
  }

  approve.addEventListener('click', () => openConfirm(request));
  reject.addEventListener('click', () => openReject(request));
  review.footer.append(approve, reject);
}

/** Back from a confirm / reject step to the review it came from. */
async function backToReview(from) {
  const request = current;
  await transition(from, review);
  if (request) {
    current = request;
    renderReview(request);
  }
}

// ── Approve: popup-warning confirm → success toast ────

async function openConfirm(request) {
  popupBody(confirmPopup, 'warning', t('kitFinance.aprConfirmTitle', { id: request.id }), t(`approvals.typeEffect.${request.type}`));
  confirmPopup.body.appendChild(el('p', 'apr-popup-note', t('kitFinance.aprConfirmNote')));
  const error = el('div', 'apr-popup-error');
  confirmPopup.body.appendChild(error);

  const confirm = kitButton(t('kitFinance.aprConfirmApprove'), 'btn-success', 'fa-solid fa-check');
  confirm.id = 'approval-confirm-btn';
  const back = kitButton(t('kitFinance.aprBackToReview'), 'btn-warning-outline', backGlyph());
  confirmPopup.footer.replaceChildren(confirm, back);

  back.addEventListener('click', () => backToReview(confirmPopup));
  confirm.addEventListener('click', async () => {
    error.replaceChildren();
    confirm.disabled = true;
    back.disabled = true;
    try {
      await mockApi.approveRequest(request.id);
      showSuccess(confirmPopup, t('kitFinance.aprApprovedTitle'), t('kitFinance.aprApprovedBody', { id: request.id }));
      refreshAll();
    } catch (err) {
      confirm.disabled = false;
      back.disabled = false;
      error.replaceChildren(alertBox('danger', err?.message || t('approvals.loadFailed')));
    }
  });

  await transition(review, confirmPopup);
}

/**
 * The decision went through: close the dialog (which ends the flow) and say so
 * in a toast. This was the kit's popup-success, but it asked nothing of the
 * admin except to close it.
 */
function showSuccess(from, heading, text) {
  from.hide();
  shell.showToast(text, 'success', { title: heading });
}

// ── Reject: default-modal with the reason → success toast ──

async function openReject(request) {
  rejectModal.setHeader('rejected-file.svg', t('kitFinance.aprRejectTitle'), request.id);

  const lead = el('p', 'small lh-sm', `${typeLabel(request.type)} — ${request.subject?.label ?? ''}`);
  const form = el('form', 'row apr-reject');
  form.noValidate = true;
  const col = el('div', 'col-12');
  const label = el('label', null, t('approvals.rejectReasonLabel'));
  label.htmlFor = 'approval-reject-reason';
  label.append(' ', el('span', 'danger-color', '*'));
  const textarea = el('textarea', 'form-control');
  textarea.id = 'approval-reject-reason';
  textarea.rows = 3;
  textarea.maxLength = 600;
  textarea.setAttribute('aria-describedby', 'approval-reject-hint approval-reject-error');
  const hint = el('p', 'small apr-muted apr-reject__hint', t('approvals.rejectReasonHint'));
  hint.id = 'approval-reject-hint';
  const fieldError = el('p', 'apr-field-error');
  fieldError.id = 'approval-reject-error';
  fieldError.setAttribute('role', 'alert');
  col.append(label, textarea, hint, fieldError);
  form.appendChild(col);
  const error = el('div', 'apr-popup-error');
  rejectModal.body.replaceChildren(lead, form, error);

  const submit = kitButton(t('approvals.confirmReject'), 'btn-danger', 'fa-solid fa-xmark');
  submit.id = 'approval-reject-submit';
  const back = kitButton(t('kitFinance.aprBackToReview'), 'btn-primary-outline', backGlyph());
  rejectModal.footer.replaceChildren(submit, back);

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

  const doReject = async () => {
    error.replaceChildren();
    const problem = validateReason();
    setFieldError(problem);
    if (problem) {
      textarea.focus();
      return;
    }
    submit.disabled = true;
    back.disabled = true;
    try {
      await mockApi.rejectRequest(request.id, textarea.value.trim());
      showSuccess(rejectModal, t('kitFinance.aprRejectedTitle'), t('kitFinance.aprRejectedBody', { id: request.id }));
      refreshAll();
    } catch (err) {
      submit.disabled = false;
      back.disabled = false;
      error.replaceChildren(alertBox('danger', err?.message || t('approvals.loadFailed')));
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    doReject();
  });
  submit.addEventListener('click', doReject);
  back.addEventListener('click', () => backToReview(rejectModal));

  await transition(review, rejectModal);
  textarea.focus();
}

// ── Boot ──────────────────────────────────────────────

load();
loadStats();

const deepLink = new URLSearchParams(window.location.search).get('id');
if (deepLink) openReview(deepLink);
