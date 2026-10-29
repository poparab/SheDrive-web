/**
 * approval-review.js — SheDrive admin maker-checker decision (2026-10-14 spec §1)
 *
 * The one review → approve / reject flow, used in two places:
 *
 *   approvals.html       the queue — `createApprovalReview({ urlParam: 'id' })`
 *   a business screen    in place  — `wireInPlaceApprovals({ onDecided })`
 *
 * On a business screen (driver balance, rider balance, driver profile, payout
 * batch, pricing, settlement imports) every link to `approvals.html?id=…` opens
 * this same dialog over the page instead of leaving it, so an admin who is
 * already looking at the subject can decide it there. Same dialog, same
 * "never the admin who made it" rule, same audit entry as the queue.
 *
 *   Approve → kit `popup-warning` confirm → success toast
 *   Reject  → kit `default-modal` with the reason (10–500) → success toast
 *
 * The review has one layout for every request type (see "The standard review"
 * below): Request → Before → after → Details → Lines.
 *
 * `approvalHref(id)` builds the queue link with `return=` set to the current
 * screen. Opened that way (a new tab), the queue sends the admin back to that
 * screen after the decision.
 */

import { mockApi } from './mock-api.js';
import { formatDateTime, formatPercent } from './format.js';
import { loadBootstrap } from './design-init.js';
import { qs } from '../../shared/scripts/utils.js';
import { t, hasKey, isRtl } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';
import { queueToast } from '../components/ad-toast.js';
import { can } from './roles.js';
import '../components/ad-data-table.js';

// ── Small helpers (the queue's grid uses them too) ────

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function icon(classes) {
  const i = el('i', classes);
  i.setAttribute('aria-hidden', 'true');
  return i;
}

/** A kit button: leading Font Awesome glyph + label. */
export function kitButton(label, className, glyph) {
  const b = el('button', `btn ${className}`);
  b.type = 'button';
  if (glyph) b.appendChild(icon(glyph));
  b.appendChild(document.createTextNode(label));
  return b;
}

const backGlyph = () => (isRtl() ? 'fa-solid fa-arrow-right' : 'fa-solid fa-arrow-left');
const forwardGlyph = () => (isRtl() ? 'fa-solid fa-arrow-left' : 'fa-solid fa-arrow-right');

/** Latin data (ids, emails, money) keeps its own direction inside Arabic text. */
export const ltr = (text, tag = 'span') => el(tag, 'ad-ltr', text);

/** "1,240.50" — two decimals, Latin digits, no unit (the column header carries it). */
export function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const typeLabel = (type) => t(`approvals.type.${type}`);
const payoutTypeLabel = (type) => (type ? t(`approvals.payoutType.${type}`) : t('common.notAvailable'));

/** Status lamp, kit markup: pending=warning, approved=success, rejected=danger. */
const LAMPS = { pending: 'status-warning-lamp', approved: 'status-active-lamp', rejected: 'status-danger-lamp' };
export function lamp(status, label = t(`status.${status}`)) {
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
    // The Global policies tab the setting lives on (2026-10-29).
    case 'policy': return `pricing-policies.html?tab=${['balance-limit', 'payout-settings'].includes(subject.id) ? 'finance' : 'pricing'}`;
    default: return null;
  }
}

export function subjectLink(subject, type = null) {
  const href = subjectHref(subject, type);
  const node = href ? el('a', 'apr-subject', subject.label) : el('span', 'apr-subject', subject.label);
  if (href) node.href = href;
  return node;
}

/** Email on one line, when on the next. */
export function who(email, at, mine = false) {
  const wrap = el('div', 'apr-who');
  const name = ltr(email, 'span');
  name.classList.add('apr-who__email');
  wrap.appendChild(name);
  if (mine) wrap.appendChild(el('span', 'apr-who__you', t('approvals.you')));
  wrap.appendChild(el('span', 'apr-who__when', formatDateTime(at)));
  return wrap;
}

// ── Links between a screen and the queue ─────────────

/**
 * `return=` only ever names another admin-v2 screen, never an outside address.
 * `.html` is optional: the hosted preview serves pages without the extension.
 */
const RETURN_PATTERN = /^[a-z0-9-]+(\.html)?(\?[^#]*)?$/i;

/** True for the queue itself, with or without `.html`. */
const isQueue = (screen) => /^approvals(\.html)?(\?|$)/i.test(screen);

/** The current screen as a `return=` value: file name plus its query. */
function currentScreen() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return `${file}${window.location.search}`;
}

/** Link to a request in the queue that brings the admin back here afterwards. */
export function approvalHref(id) {
  const params = new URLSearchParams({ id: String(id) });
  const back = currentScreen();
  if (!isQueue(back)) params.set('return', back);
  return `approvals.html?${params}`;
}

/** The safe `return=` target of the current URL, or null. */
export function returnTarget() {
  const value = new URLSearchParams(window.location.search).get('return');
  if (!value || !RETURN_PATTERN.test(value) || isQueue(value)) return null;
  return value;
}

// ── The decision flow ─────────────────────────────────

/**
 * @param {object} [options]
 * @param {string|null} [options.urlParam]  query parameter that mirrors the open request
 *                                          (the queue's `?id=` deep link); null on a business screen
 * @param {string|null} [options.returnTo]  screen to go back to after a decision
 * @param {() => void} [options.onDecided]  called after a decision when the admin stays on the page
 * @returns {{ open(id: string): Promise<void> }}
 */
export function createApprovalReview({ urlParam = null, returnTo = null, onDecided = null } = {}) {
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

  // Built on first use, so a screen that only links to a request pays nothing.
  let review = null;
  let confirmPopup = null;
  let rejectModal = null;

  function ensureModals() {
    if (review) return;
    // Wide enough for the Lines list (seven columns) without sideways scrolling, for every type.
    review = buildModal('approval-modal', 'default-modal', 'modal-xl modal-dialog-scrollable');
    confirmPopup = buildModal('approval-confirm', 'popup-warning');
    rejectModal = buildModal('approval-reject', 'default-modal');
    review.root.classList.add('apr-review');
  }

  let current = null;

  /** The flow is over: forget the request and drop its parameter from the address. */
  function endFlow() {
    current = null;
    if (!urlParam) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(urlParam)) {
      url.searchParams.delete(urlParam);
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

  const MONEY_KEYS = new Set(['baseFare', 'perKm', 'perMin', 'minFare', 'cancellationFee', 'balance', 'fee', 'total', 'driverCancellationFee', 'outstandingLimit', 'minimumAmount', 'feeMin', 'feeMax']);
  const COUNT_KEYS = new Set(['lines', 'rows', 'success', 'failed']);

  function fieldLabel(key) {
    const k = `approvals.field.${key}`;
    const value = t(k);
    return value === k ? key : value;
  }

  function fieldValue(key, value) {
    if (value === undefined || value === null) return t('common.notAvailable');
    if (key === 'removed') return value ? t('approvals.removedValue') : t('common.notAvailable');
    if (MONEY_KEYS.has(key)) return `${money(value)} ${t('common.egp')}`;
    if (COUNT_KEYS.has(key)) return Number(value).toLocaleString('en-US');
    if (key === 'percentage' || key === 'feePercent') return formatPercent(value);
    if (key === 'type') return payoutTypeLabel(value);
    if (key === 'feePaidBy') return t(`approvals.feePaidBy.${value}`);
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

  // ── The standard review ───────────────────────────────
  //
  // Every request type gets the same blocks in the same order:
  //
  //   Request → Before → after → Details → Lines
  //
  // Details appears when a type has facts of its own (a reference, a trip, a
  // reason, the batch or file); Lines appears for the three types that carry
  // many lines (payout batch, payout result, settlement import). A type only
  // decides what goes inside those blocks, never the layout, so 12 lines and
  // 1,000 lines read the same: a summary table, then a searchable list paged
  // like every grid in the portal.

  const LINES_PAGE = 10;

  const count = (n) => Number(n).toLocaleString('en-US');
  const moneyCell = (value) => el('p', 'text-bold ad-ltr', money(value));

  /** Details: the facts a type adds, as one key/value list. Empty when it has none. */
  function detailPairs(request) {
    const p = request.payload ?? {};
    switch (request.type) {
      case 'payout_result': {
        const batch = request.batch;
        if (!batch) return [];
        const link = ltr(batch.ref, 'a');
        link.href = `payout-batch.html?id=${encodeURIComponent(batch.id)}`;
        return [
          [t('approvals.kvBatch'), link],
          // 2026-10-29 — one result file per payout method.
          ...(p.payoutType ? [[t('approvals.kvFileMethod'), payoutTypeLabel(p.payoutType)]] : []),
          // Batch status copy is owned by the Payouts screen's locale; fall back to the raw value.
          [t('approvals.kvBatchStatus'), hasKey(`payouts.status_${batch.status}`) ? t(`payouts.status_${batch.status}`) : batch.status],
        ];
      }
      case 'settlement_import':
        return request.import ? [[t('approvals.kvFile'), ltr(request.import.fileName)]] : [];
      case 'fee_waiver': {
        let trip = '';
        if (p.tripId) {
          trip = ltr(p.tripId, 'a');
          trip.href = `trip-detail.html?id=${encodeURIComponent(p.tripId)}`;
        }
        return [
          [t('approvals.kvTrip'), trip],
          [t('approvals.kvReason'), p.reason ?? '', 'apr-long'],
        ];
      }
      case 'payout':
      case 'settlement':
        return [
          [t('approvals.kvMethod'), p.method || undefined],
          [t('approvals.kvReference'), p.reference ? ltr(p.reference) : undefined],
          [t('approvals.kvPaymentDate'), p.at ? formatDateTime(p.at) : undefined],
          [t('approvals.kvNote'), p.note || undefined, 'apr-long'],
        ].filter(([, value]) => value !== undefined);
      default:
        return [];
    }
  }

  function driverCell(name, driverId, known, type) {
    if (!known) return el('span', null, name);
    const a = el('a', null, name);
    a.href = type === 'import'
      ? `driver-balance-details.html?id=${encodeURIComponent(driverId)}`
      : `driver-profile.html?id=${encodeURIComponent(driverId)}`;
    return a;
  }

  function methodCell(row) {
    const stack = el('div', 'apr-method-cell');
    stack.appendChild(el('span', null, payoutTypeLabel(row.payoutType)));
    if (row.provider) stack.appendChild(el('small', 'apr-muted', row.provider));
    return stack;
  }

  function resultCell(res) {
    if (!res) return el('span', 'apr-muted', t('approvals.resultPending'));
    const wrap = el('div', 'apr-result');
    if (res.status === 'SUCCESS') {
      wrap.appendChild(lamp('approved', t('approvals.resultSuccess')));
      if (res.bankReference) wrap.appendChild(ltr(res.bankReference, 'small'));
    } else {
      wrap.appendChild(lamp('rejected', t('approvals.resultFailed')));
      if (res.failureReason) wrap.appendChild(el('small', 'danger-color', res.failureReason));
    }
    return wrap;
  }

  /**
   * What the Lines block shows for a type: its rows, how the summary groups
   * them, what the search looks through and the list's columns. Null for the
   * types without lines.
   */
  function lineSpec(request) {
    if (request.type === 'payout_result' && request.batch) {
      const withResult = true;
      const results = new Map((request.batch.result ?? []).map((r) => [r.lineRef, r]));
      // Only the lines of the method's file this result is for.
      const type = request.payload?.payoutType ?? null;
      const rows = request.batch.lines
        .filter((line) => !type || line.payoutType === type)
        .map((line) => ({ ...line, res: results.get(line.lineRef) ?? null }));
      // A checker clears failures first, so a result lists them at the top.
      if (withResult) rows.sort((a, b) => (a.res?.status === 'FAILED' ? 0 : 1) - (b.res?.status === 'FAILED' ? 0 : 1));
      const columns = [
        { key: 'lineRef', label: t('approvals.colLineRef'), ltr: true, render: (r) => ltr(r.lineRef) },
        { key: 'driverName', label: t('approvals.colDriver'), render: (r) => driverCell(r.driverName, r.driverId, r.known, 'batch') },
        { key: 'nationalId', label: t('approvals.colNationalId'), ltr: true, render: (r) => ltr(r.nationalId) },
        { key: 'payoutType', label: t('approvals.colPayoutType'), render: methodCell },
        { key: 'number', label: t('approvals.colNumber'), ltr: true, render: (r) => ltr(r.number) },
        { key: 'amount', label: t('approvals.colLineAmount'), numeric: true, render: (r) => moneyCell(r.amount) },
      ];
      if (withResult) columns.push({ key: 'result', label: t('approvals.colResult'), render: (r) => resultCell(r.res) });
      return {
        title: t('approvals.sectionLines'),
        icon: 'withdrawal-wallet.svg',
        rows,
        countLabel: t('approvals.sumLines'),
        groupLabel: withResult ? t('approvals.sumByResult') : t('approvals.sumByType'),
        groupOf: withResult
          ? (r) => (r.res?.status === 'FAILED' ? t('approvals.resultFailed') : t('approvals.resultSuccess'))
          : (r) => payoutTypeLabel(r.payoutType),
        searchIn: (r) => [r.lineRef, r.driverName, r.nationalId, r.number, r.provider, r.res?.bankReference],
        resultFilter: withResult,
        columns,
      };
    }
    if (request.type === 'settlement_import' && request.import) {
      return {
        title: t('approvals.sectionRows'),
        icon: 'file-checked.svg',
        rows: request.import.rows,
        countLabel: t('approvals.sumRows'),
        groupLabel: t('approvals.sumByChannel'),
        groupOf: (r) => r.channel || t('common.notAvailable'),
        searchIn: (r) => [r.driverName, r.nationalId, r.paymentRef, r.receipt],
        resultFilter: false,
        columns: [
          { key: 'rowNo', label: t('approvals.colRowNo'), ltr: true, render: (r) => ltr(r.rowNo) },
          { key: 'driverName', label: t('approvals.colDriver'), render: (r) => driverCell(r.driverName, r.driverId, Boolean(r.driverId), 'import') },
          { key: 'nationalId', label: t('approvals.colNationalId'), ltr: true, render: (r) => ltr(r.nationalId) },
          { key: 'amount', label: t('approvals.colLineAmount'), numeric: true, render: (r) => moneyCell(r.amount) },
          { key: 'paymentDate', label: t('approvals.colPaymentDate'), ltr: true, render: (r) => ltr(r.paymentDate) },
          { key: 'channel', label: t('approvals.colChannel'), render: (r) => r.channel },
          { key: 'paymentRef', label: t('approvals.colPaymentRef'), ltr: true, render: (r) => ltr(r.paymentRef) },
          { key: 'receipt', label: t('approvals.colReceipt'), ltr: true, render: (r) => (r.receipt ? ltr(r.receipt) : '') },
        ],
      };
    }
    return null;
  }

  /** Summary: one row per group with its count and amount, then the total. */
  function summaryTable(spec) {
    const groups = new Map();
    spec.rows.forEach((r) => {
      const key = spec.groupOf(r);
      const g = groups.get(key) ?? { n: 0, amount: 0 };
      g.n += 1;
      g.amount += Number(r.amount) || 0;
      groups.set(key, g);
    });
    const total = spec.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const rows = [...groups].map(([key, g]) => [key, ltr(count(g.n)), moneyCell(g.amount)]);
    const totalRow = [el('strong', null, t('approvals.sumTotal')), ltr(count(spec.rows.length)), moneyCell(total)];
    totalRow.className = 'apr-total';
    return grid(
      [{ label: spec.groupLabel }, { label: spec.countLabel, num: true }, { label: t('approvals.sumAmount'), num: true }],
      [...rows, totalRow],
    );
  }

  /**
   * Lines block: summary, then a search (and, for a result, a Success / Failed
   * filter) over a paged list. Returns the card and a start() to call once the
   * card is in the document, so the grid renders into a connected element.
   */
  function linesBlock(request) {
    const spec = lineSpec(request);
    if (!spec) return null;

    const toolbar = el('div', 'apr-lines-toolbar');
    const searchId = `apr-lines-search-${request.id}`;
    const searchLabel = el('label', 'visually-hidden', t('approvals.linesSearchLabel'));
    searchLabel.htmlFor = searchId;
    const searchBox = el('div', 'apr-lines-search');
    const search = el('input', 'form-control');
    search.type = 'search';
    search.id = searchId;
    search.placeholder = t('approvals.linesSearchPlaceholder');
    search.autocomplete = 'off';
    searchBox.append(icon('fa-solid fa-magnifying-glass apr-lines-search__icon'), search);
    toolbar.append(searchLabel, searchBox);

    let filter = null;
    if (spec.resultFilter) {
      const filterId = `apr-lines-result-${request.id}`;
      const filterLabel = el('label', 'visually-hidden', t('approvals.linesResultLabel'));
      filterLabel.htmlFor = filterId;
      filter = el('select', 'form-select apr-lines-filter');
      filter.id = filterId;
      [['all', t('approvals.linesAllResults')], ['FAILED', t('approvals.resultFailed')], ['SUCCESS', t('approvals.resultSuccess')]].forEach(([value, label]) => {
        const option = el('option', null, label);
        option.value = value;
        filter.appendChild(option);
      });
      toolbar.append(filterLabel, filter);
    }

    const table = document.createElement('ad-data-table');
    table.classList.add('apr-lines-table');

    const node = card(spec.title, spec.icon, summaryTable(spec), toolbar, table);

    let page = 1;
    let pageSize = LINES_PAGE;
    const matching = () => {
      const needle = search.value.trim().toLowerCase();
      const result = filter?.value ?? 'all';
      return spec.rows.filter((r) => (result === 'all' || r.res?.status === result)
        && (!needle || spec.searchIn(r).some((v) => v && String(v).toLowerCase().includes(needle))));
    };
    const draw = () => {
      const rows = matching();
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      page = Math.min(page, totalPages);
      table.setData({
        rows: rows.slice((page - 1) * pageSize, page * pageSize),
        total: rows.length,
        page,
        pageSize,
        totalPages,
      });
    };

    return {
      node,
      start() {
        table.pageSize = LINES_PAGE;
        table.columns = spec.columns;
        table.emptyState = { icon: 'not-found.svg', heading: t('approvals.linesNoMatchHeading'), message: t('approvals.linesNoMatchMessage') };
        table.addEventListener('pagechange', (event) => {
          page = event.detail.page;
          draw();
        });
        // The kit's Rows count (10 / 20 / 50), as on every grid.
        table.addEventListener('pagesizechange', (event) => {
          pageSize = event.detail.pageSize;
          table.pageSize = pageSize;
          page = 1;
          draw();
        });
        search.addEventListener('input', () => {
          page = 1;
          draw();
        });
        filter?.addEventListener('change', () => {
          page = 1;
          draw();
        });
        draw();
      },
    };
  }

  async function openReview(id) {
    ensureModals();
    if (urlParam) {
      const url = new URL(window.location.href);
      url.searchParams.set(urlParam, id);
      window.history.replaceState(null, '', url);
    }

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
    const pairs = detailPairs(request);
    const details = pairs.length ? card(t('approvals.sectionDetails'), 'transactions.svg', kvList(pairs)) : null;
    const lines = linesBlock(request);

    review.body.replaceChildren(
      el('p', 'small lh-sm apr-effect', t(`approvals.typeEffect.${request.type}`)),
      ...[summary, change, details, lines?.node].filter(Boolean),
    );
    lines?.start();
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

    // #6212 — only a Financial lead decides. A Financial officer sees her
    // request read-only: no Approve or Reject at all.
    if (!can('finance.approve')) {
      const note = alertBox('info', request.waitingForLead ? t('approvalRoles.waitingForLead') : t('approvalRoles.officerReadOnly'));
      note.classList.add('apr-own-note');
      note.removeAttribute('role');
      review.footer.append(note, closeButton(review));
      return;
    }
    // A lead's own request: disabled, decided by a different lead — or, with
    // none left, "Waiting for another Financial lead".
    if (request.madeByYou || !request.canDecide) {
      approve.disabled = true;
      reject.disabled = true;
      const note = alertBox(
        request.waitingForLead ? 'warning' : 'info',
        request.waitingForLead ? `${t('approvalRoles.waitingForLead')}. ${t('approvalRoles.waitingForLeadMeta')}` : t('approvalRoles.madeByYouLead'),
      );
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
   * admin except to close it. With `returnTo` the admin goes back to the screen
   * the request came from, and the toast is held for that page.
   */
  async function showSuccess(from, heading, text) {
    await from.hide();
    if (returnTo) {
      queueToast(text, 'success', { title: heading });
      window.location.assign(returnTo);
      return;
    }
    qs('ad-shell')?.showToast?.(text, 'success', { title: heading });
    onDecided?.();
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

  return { open: openReview };
}

// ── In place on a business screen ─────────────────────

/** Hide an open Bootstrap modal (a detail dialog the link sits in) before ours opens. */
function hideOpenModal(link) {
  const outer = link.closest('.modal.show');
  const Modal = window.bootstrap?.Modal;
  if (!outer || !Modal) return Promise.resolve();
  return new Promise((resolve) => {
    outer.addEventListener('hidden.bs.modal', () => resolve(), { once: true });
    Modal.getOrCreateInstance(outer).hide();
  });
}

/**
 * Open every `approvals.html?id=…` link on this screen in place. Listens in the
 * capture phase, so a link whose own handler stops propagation (a pending notice
 * inside a clickable row) still opens here. A modified click (new tab) keeps the
 * plain link, which returns here after the decision.
 */
export function wireInPlaceApprovals({ onDecided } = {}) {
  const review = createApprovalReview({ onDecided });
  document.addEventListener('click', async (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    const id = url.searchParams.get('id');
    if (!url.pathname.endsWith('/approvals.html') || !id) return;
    event.preventDefault();
    event.stopPropagation();
    await hideOpenModal(link);
    review.open(id);
  }, true);
  return review;
}
