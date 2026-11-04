/**
 * approval-review.js — SheDrive admin maker-checker: shared pieces (2026-10-14 spec §1)
 *
 * 2026-11-04 — the designer's kit v3-11 turns the review dialog into a page:
 * `approval-request.html?id=APR-nnnn` (scripts/approval-request.js). Every
 * request type has its own structure on that page. This module keeps what the
 * queue and the page share — kit cells, the before → after list, subject
 * links — and the links into the page:
 *
 *   approvalHref(id)          `approval-request.html?id=…&return=<this screen>`
 *   returnTarget()            the safe `return=` of the current URL
 *   wireInPlaceApprovals()    an old `approvals.html?id=…` link on a business
 *                             screen now opens the request page, with return=
 */

import { formatDateTime, formatPercent } from './format.js';
import { t, isRtl } from './admin-i18n.js';
import { iconUrl } from '../components/ad-styles.js';

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

export const backGlyph = () => (isRtl() ? 'fa-solid fa-arrow-right' : 'fa-solid fa-arrow-left');
export const forwardGlyph = () => (isRtl() ? 'fa-solid fa-arrow-left' : 'fa-solid fa-arrow-right');

/** Latin data (ids, emails, money) keeps its own direction inside Arabic text. */
export const ltr = (text, tag = 'span') => el(tag, 'ad-ltr', text);

/** "1,240.50" — two decimals, Latin digits, no unit (the column header carries it). */
export function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const typeLabel = (type) => t(`approvals.type.${type}`);
export const payoutTypeLabel = (type) => (type ? t(`approvals.payoutType.${type}`) : t('common.notAvailable'));

/** Status lamp, kit markup: pending=warning, approved=success, rejected=danger. */
const LAMPS = { pending: 'status-warning-lamp', approved: 'status-active-lamp', rejected: 'status-danger-lamp', info: 'status-blue-lamp' };
export function lamp(status, label = t(`status.${status}`)) {
  const wrap = el('div', LAMPS[status] ?? 'status-disabled-lamp');
  wrap.append(el('div', 'lamp'), document.createTextNode(label));
  return wrap;
}

/** Where the subject of a request lives. Money requests open the person's ledger. */
function subjectHref(subject, type = null, status = null) {
  const id = encodeURIComponent(subject.id);
  switch (subject.kind) {
    case 'driver':
      return type === 'settlement' || type === 'payout' ? `driver-balance-details.html?id=${id}` : `driver-profile.html?id=${id}`;
    case 'rider':
      return type === 'fee_waiver' ? `rider-balance-details.html?id=${id}` : `rider-profile.html?id=${id}`;
    case 'zone': return 'pricing-zones.html';
    case 'batch': return `payout-batch.html?id=${id}`;
    // Only an approved import has a page to open (2026-11-04).
    case 'import': return status === 'approved' ? `settlement-import.html?id=${id}` : null;
    // The Global policies tab the setting lives on (2026-10-29).
    case 'policy': return `pricing-policies.html?tab=${['balance-limit', 'payout-settings'].includes(subject.id) ? 'finance' : 'pricing'}`;
    default: return null;
  }
}

export function subjectLink(subject, type = null, status = null) {
  const href = subjectHref(subject, type, status);
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
  // Kit v3-11: a blue "You" chip above her own email.
  if (mine) wrap.prepend(el('div', 'status-blue-solid apr-who__you', t('approvals.you')));
  wrap.appendChild(el('span', 'apr-who__when', formatDateTime(at)));
  return wrap;
}

// ── Links between a screen and the queue ─────────────

/**
 * `return=` only ever names another admin-v2 screen, never an outside address.
 * `.html` is optional: the hosted preview serves pages without the extension.
 */
const RETURN_PATTERN = /^[a-z0-9-]+(\.html)?(\?[^#]*)?$/i;


/** The current screen as a `return=` value: file name plus its query. */
function currentScreen() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return `${file}${window.location.search}`;
}

/** True for the request page itself. */
const isRequestPage = (screen) => /^approval-request(\.html)?(\?|$)/i.test(screen);

/** Link to a request's page that brings the admin back here with its back button. */
export function approvalHref(id) {
  const params = new URLSearchParams({ id: String(id) });
  const back = currentScreen();
  if (!isRequestPage(back)) params.set('return', back);
  return `approval-request.html?${params}`;
}

/** The safe `return=` target of the current URL, or null. */
export function returnTarget() {
  const value = new URLSearchParams(window.location.search).get('return');
  if (!value || !RETURN_PATTERN.test(value) || isRequestPage(value)) return null;
  return value;
}

// ── Kit blocks shared by the queue and the request page ──

export function alertBox(tone, message) {
  const box = el('div', `alert ${tone} apr-alert`);
  const glyphs = { danger: 'fa-solid fa-circle-exclamation', warning: 'fa-solid fa-triangle-exclamation', success: 'fa-solid fa-circle-check' };
  box.append(icon(glyphs[tone] ?? 'fa-solid fa-circle-info'));
  if (message instanceof Node) box.appendChild(message);
  else box.appendChild(el('p', null, message));
  return box;
}

/** A kit card: header (title + icon) and body. */
export function card(titleText, iconName, ...children) {
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
export function kvList(pairs) {
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
export function grid(headers, rows) {
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

export const MONEY_KEYS = new Set(['baseFare', 'perKm', 'perMin', 'minFare', 'cancellationFee', 'balance', 'fee', 'total', 'driverCancellationFee', 'outstandingLimit', 'minimumAmount', 'feeMin', 'feeMax']);
export const COUNT_KEYS = new Set(['lines', 'rows', 'success', 'failed']);

export function fieldLabel(key) {
  const k = `approvals.field.${key}`;
  const value = t(k);
  return value === k ? key : value;
}

export function fieldValue(key, value) {
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
export function diffValue(key, b, a, changed) {
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

export function diffList(before, after) {
  const b = before ?? {};
  const a = after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return el('p', 'apr-muted', t('approvals.noChange'));
  return kvList(keys.map((key) => {
    const changed = JSON.stringify(b[key]) !== JSON.stringify(a[key]);
    return [fieldLabel(key), diffValue(key, b, a, changed), changed ? 'apr-changed' : ''];
  }));
}

export function driverCell(name, driverId, known, type) {
  if (!known) return el('span', null, name);
  const a = el('a', null, name);
  a.href = type === 'import'
    ? `driver-balance-details.html?id=${encodeURIComponent(driverId)}`
    : `driver-profile.html?id=${encodeURIComponent(driverId)}`;
  return a;
}

export function methodCell(row) {
  const stack = el('div', 'apr-method-cell');
  stack.appendChild(el('span', null, payoutTypeLabel(row.payoutType)));
  if (row.provider) stack.appendChild(el('small', 'apr-muted', row.provider));
  return stack;
}

export function resultCell(res) {
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


// ── Old queue links on a business screen ──────────────

/**
 * Before 2026-11-04 a business screen opened a request in a dialog. Links are
 * now built with approvalHref(), straight to the request page; this keeps any
 * `approvals.html?id=…` link (an older one in a note or a bookmark) working by
 * sending it to the page with `return=` set to this screen.
 */
export function wireInPlaceApprovals() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    const id = url.searchParams.get('id');
    if (!/\/approvals(\.html)?$/.test(url.pathname) || !id) return;
    event.preventDefault();
    const href = approvalHref(id);
    if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(href, '_blank');
    else window.location.assign(href);
  }, true);
}
