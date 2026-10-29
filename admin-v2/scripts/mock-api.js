/**
 * mock-api.js — SheDrive admin portal mock backend
 * Promise-based fake API over the canonical seed data. Method signatures mirror
 * shared/scripts/api.js so wiring the real backend later is a file swap, not a
 * rewrite. Artificial latency is deliberate: it makes loading states real.
 *
 * Every screen honours a ?state= override so the designer can inspect states
 * without duplicated files:
 *   ?state=empty    — resources resolve with zero rows
 *   ?state=loading  — resources never resolve (skeletons stay up)
 *   ?state=error    — resources reject
 *   ?state=long     — string fields are stretched to test overflow
 */

import {
  ADMINS,
  APPLICATIONS,
  AUDIT_ENTRIES,
  CURRENT_ADMIN,
  DRIVERS,
  DRIVERS_BY_ID,
  GLOBAL_POLICIES,
  REPORTS_BY_ID,
  RIDERS,
  RIDERS_BY_ID,
  SAFETY_REPORTS,
  SOS_CASES,
  SOS_CASES_BY_ID,
  TRIPS,
  TRIPS_BY_ID,
  ZONES,
  ZONES_BY_ID,
  LEDGER_ENTRIES,
  LEDGER_BY_DRIVER,
  PAYOUT_METHODS,
  SETTLEMENT_METHODS,
  makeZone,
  recomputeBalances,
  RIDER_LEDGER_ENTRIES,
  RIDER_LEDGER_BY_RIDER,
  recomputeRiderBalances,
  nextSettlementReceipt,
} from './seed.js';
import {
  applyMutations,
  patch,
  recordAdminCreate,
  recordAuditEntry,
  recordLedgerEntry,
  recordPolicies,
  recordZoneCreate,
  recordZoneDelete,
  recordRiderLedgerEntry,
  recordAdded,
  applyFinanceMutations,
} from './mutations.js';
import {
  APPROVALS,
  APPROVALS_BY_ID,
  APPROVAL_TYPES,
  APPROVAL_AREAS,
  BANKS,
  PAYABLE_TYPES,
  PAYOUT_BATCHES,
  PAYOUT_BATCHES_BY_ID,
  PAYOUT_HOLD_DAYS,
  PAYOUT_TYPES,
  SETTLEMENT_CHANNELS,
  SETTLEMENT_IMPORTS,
  WALLET_PROVIDERS,
  dueAtOf,
  payoutCutoffDay,
  makeApproval,
  makeBatchRef,
  makeLine,
  nextImportId,
} from './finance-seed.js';
import { can, AUDIT_SCOPE } from './roles.js';
import { adminAuth } from './admin-auth.js';

// Replay this session's recorded actions onto the seed before any screen reads
// it, so a decision made on one screen is visible on the next.
applyMutations({
  DRIVERS,
  RIDERS,
  SAFETY_REPORTS,
  SOS_CASES,
  ADMINS,
  TRIPS,
  AUDIT_ENTRIES,
  ZONES,
  ZONES_BY_ID,
  GLOBAL_POLICIES,
  makeZone,
  LEDGER_ENTRIES,
  LEDGER_BY_DRIVER,
  recomputeBalances,
  RIDER_LEDGER_ENTRIES,
  RIDER_LEDGER_BY_RIDER,
  recomputeRiderBalances,
});
applyFinanceMutations({
  APPROVALS,
  APPROVALS_BY_ID,
  PAYOUT_BATCHES,
  PAYOUT_BATCHES_BY_ID,
  SETTLEMENT_IMPORTS,
  LEDGER_ENTRIES,
});

const LATENCY_MS = 380;
const LONG_SUFFIX =
  ' — El-Sayed Mohamed Abou El-Naga Ibrahim Abdelrahman Extended Overflow Sample';
const STRETCHABLE_KEYS = [
  'name', 'riderName', 'driverName', 'email', 'zoneName', 'reason',
  'suspensionReason', 'rejectionReason', 'statement', 'targetId', 'actor',
];

export class MockApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'MockApiError';
    this.status = status;
  }
}

/** The ?state= override for the current page, or null. */
export function stateOverride() {
  const value = new URLSearchParams(window.location.search).get('state');
  return ['empty', 'loading', 'error', 'long'].includes(value) ? value : null;
}

function stretch(row) {
  if (!row || typeof row !== 'object') return row;
  const clone = Array.isArray(row) ? [...row] : { ...row };
  STRETCHABLE_KEYS.forEach((key) => {
    if (typeof clone[key] === 'string' && clone[key].length) {
      clone[key] = clone[key] + LONG_SUFFIX;
    }
  });
  if (clone.pickup?.address) {
    clone.pickup = { ...clone.pickup, address: clone.pickup.address + LONG_SUFFIX };
  }
  if (clone.destination?.address) {
    clone.destination = { ...clone.destination, address: clone.destination.address + LONG_SUFFIX };
  }
  return clone;
}

/**
 * Resolve a value through the state override and artificial latency.
 * `shape` describes how to satisfy ?state=empty for this payload.
 */
function respond(value, { emptyValue = null, latency = LATENCY_MS } = {}) {
  const mode = stateOverride();

  if (mode === 'loading') {
    return new Promise(() => {});
  }

  if (mode === 'error') {
    return new Promise((_resolve, reject) => {
      window.setTimeout(
        () => reject(new MockApiError('The service is temporarily unavailable.', 503)),
        latency,
      );
    });
  }

  let payload = value;
  if (mode === 'empty') {
    payload = emptyValue;
  } else if (mode === 'long') {
    if (Array.isArray(payload?.rows)) {
      payload = { ...payload, rows: payload.rows.map(stretch) };
    } else {
      payload = stretch(payload);
    }
  }

  return new Promise((resolve) => {
    window.setTimeout(() => resolve(payload), latency);
  });
}

// APPLICATIONS is a derived view over DRIVERS, so replayed status changes have
// to be reflected in it before any screen queries the queue.
reindexApplications();

const emptyPage = (pageSize = 20) => ({
  rows: [],
  total: 0,
  page: 1,
  pageSize,
  totalPages: 1,
});

// ── Driver balance helpers (#TBD-A) ───────────────────

/** A driver's ledger, newest first. Never mutated by callers. */
function ledgerFor(driverId) {
  return (LEDGER_BY_DRIVER.get(String(driverId)) ?? []).slice();
}

/** #TBD-F — a limit of 0 disables the gate entirely. */
function isGoOnlineBlocked(driver) {
  const limit = GLOBAL_POLICIES.driverBalance.outstandingLimit;
  // One signed balance: only a negative one is a debt, and the limit compares
  // against how far below zero she is (#1813).
  return Boolean(limit) && driver.balance < 0 && Math.abs(driver.balance) >= limit;
}

/**
 * Post an immutable entry and recompute the driver's position from the ledger.
 * This is the only way a balance ever changes.
 */
function postLedgerEntry(driver, type, amount, at, extra = {}) {
  const entry = {
    id: `led-${type}-${driver.id}-${at}`,
    driverId: String(driver.id),
    type,
    amount: round2(amount),
    at,
    ...extra,
  };

  // Idempotent: the same event never posts twice (#TBD-A Scenario 11).
  if (LEDGER_ENTRIES.some((e) => e.id === entry.id)) return entry;

  LEDGER_ENTRIES.unshift(entry);
  LEDGER_ENTRIES.sort((a, b) => b.at - a.at);
  const list = LEDGER_BY_DRIVER.get(entry.driverId);
  if (list) list.unshift(entry);
  else LEDGER_BY_DRIVER.set(entry.driverId, [entry]);

  recordLedgerEntry(entry);
  recomputeBalances();
  patch('drivers', driver.id, {
    balance: driver.balance,
    outstanding: driver.outstanding,
    available: driver.available,
    cashBalance: driver.cashBalance,
  });
  return entry;
}

// ── Rider fee ledger helpers (financial core spec §2.2) ───

/** A rider's ledger, newest first. Never mutated by callers. */
function riderLedgerFor(riderId) {
  return (RIDER_LEDGER_BY_RIDER.get(String(riderId)) ?? []).slice();
}

/**
 * Post an immutable rider ledger entry and recompute her position — the only
 * way a rider balance ever changes (spec §2.3).
 */
function postRiderLedgerEntry(rider, type, amount, at, extra = {}) {
  const entry = {
    id: `rled-${type}-${rider.id}-${at}`,
    riderId: String(rider.id),
    type,
    amount: round2(amount),
    at,
    ...extra,
  };

  // Idempotent: the same event never posts twice (spec §2.3).
  if (RIDER_LEDGER_ENTRIES.some((e) => e.id === entry.id)) return entry;

  RIDER_LEDGER_ENTRIES.unshift(entry);
  RIDER_LEDGER_ENTRIES.sort((a, b) => b.at - a.at);
  const list = RIDER_LEDGER_BY_RIDER.get(entry.riderId);
  if (list) list.unshift(entry);
  else RIDER_LEDGER_BY_RIDER.set(entry.riderId, [entry]);

  recordRiderLedgerEntry(entry);
  recomputeRiderBalances();
  patch('riders', rider.id, {
    balance: rider.balance,
    outstanding: rider.outstanding,
  });
  return entry;
}

/** Build an audit entry without appending it twice — addAuditEntry does that. */
function makeAuditEntry(actionType, targetType, targetId, before, after) {
  return addAuditEntry(actionType, targetType, targetId, before, after, Date.now());
}

// ── Maker-checker, payouts, settlement imports (2026-10-14 spec) ──

/**
 * Who is acting: the signed-in admin's account (#6210). The role is read from
 * the account on every request, so a role change applies at once. The demo
 * role switch (`?as=`, the top bar) changes the session, and so who this is.
 */
function actingAdmin() {
  const email = adminAuth.getSession()?.email;
  const admin = email && ADMINS.find((a) => a.email === email && a.status === 'active');
  return admin ?? CURRENT_ADMIN;
}

/** The server-side role check (#6210 Rule 4): refused, and nothing changes. */
function refusedFor(capability) {
  if (can(capability, actingAdmin().role)) return null;
  return Promise.reject(new MockApiError("Your role can't do this. Nothing was changed.", 403));
}

const isOpenBatch = (b) => ['ready', 'sent_to_bank', 'result_pending'].includes(b.status);

/** The open-batch line an entry is in, if any. */
function openLineFor(entryId) {
  for (const batch of PAYOUT_BATCHES) {
    if (!isOpenBatch(batch)) continue;
    const line = batch.lines.find((l) => l.entryIds.includes(entryId));
    if (line) return { batch, line };
  }
  return null;
}

/** §3 — on_hold → due → in_batch → sent → paid. Null for non-payable entries. */
function entryPayoutStatus(entry, now = Date.now()) {
  if (!PAYABLE_TYPES.includes(entry.type)) return null;
  // A credit reversed by a fee waiver (§5) is no longer owed to her.
  if (LEDGER_ENTRIES.some((e) => e.type === 'fee_credit_reversed' && e.reversesEntryId === entry.id)) return 'reversed';
  if (entry.paidRef) return 'paid';
  const open = openLineFor(entry.id);
  if (open) return open.line.status === 'sent' ? 'sent' : 'in_batch';
  return dueAtOf(entry) <= now ? 'due' : 'on_hold';
}

function payoutPosition(driver) {
  const entries = ledgerFor(driver.id).filter((e) => PAYABLE_TYPES.includes(e.type));
  const sum = (status) => round2(entries.filter((e) => entryPayoutStatus(e) === status).reduce((t, e) => t + e.amount, 0));
  return { due: sum('due'), onHold: sum('on_hold'), inBatch: sum('in_batch'), sent: sum('sent') };
}

function pendingFor(kind, id, type = null) {
  return APPROVALS.find(
    (a) => a.status === 'pending' && a.subject.kind === kind && a.subject.id === String(id) && (!type || a.type === type),
  ) ?? null;
}

const pendingSummary = (request) =>
  request ? { id: request.id, type: request.type, maker: request.maker, madeAt: request.madeAt, after: request.after } : null;

/** Create a pending request. Nothing changes until another admin approves it (§1). */
function createRequest(type, subject, { before = {}, after = {}, amount = null, payload = {} } = {}) {
  const request = makeApproval(type, subject, {
    before,
    after,
    amount,
    payload,
    maker: actingAdmin().email,
    madeAt: Date.now(),
  });
  APPROVALS.unshift(request);
  APPROVALS_BY_ID.set(request.id, request);
  recordAdded('approvalsAdded', request);
  addAuditEntry('approval requested', subject.kind, subject.id, {}, { request: request.id, type }, request.madeAt);
  return request;
}

function patchApproval(request, fields) {
  Object.assign(request, fields);
  patch('approvals', request.id, fields);
}

function patchBatch(batch, fields) {
  Object.assign(batch, fields);
  patch('batches', batch.id, { ...fields, lines: batch.lines });
}

function markEntryPaid(entry, ref) {
  entry.paidRef = ref;
  patch('entryMeta', entry.id, { paidRef: ref });
}

/** Today-or-earlier date rule shared by settlement and payout (unchanged). */
function resolveDate(date) {
  const now = Date.now();
  if (!date) return { at: now };
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return { error: 'Invalid date format.' };
  const chosenDay = new Date(parsed).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  if (chosenDay > today) return { error: 'Date cannot be in the future.' };
  return { at: chosenDay === today ? now : parsed.getTime() };
}

function postSettlement(driver, { amount, at, method, note, proof = null, paymentRef = null, importId = null }) {
  const before = driver.balance;
  const entry = postLedgerEntry(driver, 'settlement', amount, at, {
    method,
    ref: nextSettlementReceipt(),
    note: note || 'Cash received from driver',
    proof,
    paymentRef,
    importId,
    actor: actingAdmin().email,
  });
  makeAuditEntry('settlement', 'driver', driver.id, { balance: before }, { balance: driver.balance });
  return entry;
}

function postPayout(driver, { amount, at, ref, note, proof = null, lineRef = null, batchId = null, fee = 0 }) {
  const before = driver.balance;
  const entry = postLedgerEntry(driver, 'payout', -amount, at, {
    ref,
    // 2026-10-29 — when she pays the transfer fee, it is part of this payout.
    note: note || (fee ? `Payout sent by Finance — includes the ${fee.toFixed(2)} EGP transfer fee` : 'Payout sent by Finance'),
    proof,
    lineRef,
    batchId,
    transferFee: fee || null,
    actor: actingAdmin().email,
  });
  makeAuditEntry('payout', 'driver', driver.id, { balance: before }, { balance: driver.balance });
  return entry;
}

/** YYYY-MM-DD in the viewer's local day (Cairo), not UTC. */
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** §2 field rules. Returns an error string or null. */
function validatePayoutMethod(m) {
  if (!m || !PAYOUT_TYPES.includes(m.type)) return 'Choose a payout method.';
  const holder = String(m.holderName ?? '').trim();
  const number = String(m.number ?? '').replace(/\s+/g, '');
  // #5624 Field Validation, exactly: wallet = 01 + 9 digits; holder / name on
  // card = letters and spaces, 3–100 (bank and card); account = 10–20 digits or
  // EG + 27 digits; card = 16 digits.
  const holderError = () => {
    if (!holder) return 'Enter the name.';
    if (holder.length < 3 || holder.length > 100) return 'Name must be 3–100 characters.';
    if (!/^[\p{L} ]+$/u.test(holder)) return 'Use letters and spaces only.';
    return null;
  };
  if (m.type === 'MOBILE_WALLET') {
    if (!WALLET_PROVIDERS.includes(m.provider)) return 'Choose the wallet provider.';
    if (!number) return 'Enter the wallet number.';
    if (!/^01\d{9}$/.test(number)) return 'Enter a valid Egyptian mobile number.';
  } else if (m.type === 'BANK_ACCOUNT') {
    if (!BANKS.includes(m.provider)) return 'Choose the bank.';
    const error = holderError();
    if (error) return error;
    if (!number) return 'Enter the account number.';
    if (!/^\d{10,20}$/.test(number) && !/^EG\d{27}$/i.test(number)) return 'Enter a valid account number or IBAN.';
  } else {
    const error = holderError();
    if (error) return error;
    if (!number) return 'Enter the card number.';
    if (!/^\d{16}$/.test(number)) return 'Enter the 16-digit card number.';
  }
  return null;
}

// CSV — the three Finance files (§3, §4).
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers, rows) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\r\n');
}
function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); records.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); records.push(row); }
  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  // Cells per data row, so a sheet check can tell a row that lost or gained a cell.
  const widths = nonEmpty.slice(1).map((r) => r.length);
  return { headers, rows, widths };
}

/**
 * 2026-10-29 — one bank file per payout method, each with its own template.
 * Every file carries the driver's phone number and the transfer fee: `amount_egp`
 * is what the channel sends; `earnings_egp` is what leaves her balance.
 */
const FILE_HEAD = ['batch_ref', 'line_ref', 'national_id', 'driver_name', 'phone'];
const FILE_AMOUNTS = ['earnings_egp', 'transfer_fee_egp', 'fee_paid_by', 'amount_egp'];
const FILE_HEADERS = {
  MOBILE_WALLET: [...FILE_HEAD, 'wallet_provider', 'wallet_number', 'account_holder', ...FILE_AMOUNTS],
  BANK_ACCOUNT: [...FILE_HEAD, 'bank_name', 'account_number', 'account_holder', ...FILE_AMOUNTS],
  PREPAID_CARD: [...FILE_HEAD, 'card_number', 'card_holder', ...FILE_AMOUNTS],
};
const RESULT_COLUMNS = ['status', 'bank_reference', 'failure_reason'];
const FILE_SLUG = { MOBILE_WALLET: 'mobile-wallet', BANK_ACCOUNT: 'bank-account', PREPAID_CARD: 'prepaid-card' };
const SETTLEMENT_HEADERS = ['national_id', 'driver_name', 'phone_number', 'amount_egp', 'payment_date', 'payment_channel', 'payment_reference'];
/** The column an errors file adds (#5620 step 2); a re-uploaded errors file may keep it — it is ignored. */
const SETTLEMENT_ERRORS_COLUMN = 'errors';
const SETTLEMENT_MAX_ROWS = 1000;

/** A real calendar day written YYYY-MM-DD. */
function isIsoDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * #5620 step 2 — template and format. Nothing about drivers or the ledger is
 * read here: only whether the file is the template and every cell is written
 * the way the template says. Returns the problems found, each
 * `{ code, rowNo?, column?, value? }`; none means the sheet goes to step 3.
 * A header problem stops the check before any row is read. `headers` and
 * `rows` are the sheet as read, so the screen can hand the file back with an
 * errors column.
 */
function settlementFormatIssues(csvText) {
  const { headers, rows, widths } = parseCsv(csvText);
  const issues = [];
  SETTLEMENT_HEADERS.filter((h) => !headers.includes(h)).forEach((column) => issues.push({ code: 'missing_column', column }));
  headers.filter((h) => h && h !== SETTLEMENT_ERRORS_COLUMN && !SETTLEMENT_HEADERS.includes(h)).forEach((column) => issues.push({ code: 'unknown_column', column }));
  headers.filter((h, i) => h && headers.indexOf(h) !== i).forEach((column) => issues.push({ code: 'duplicate_column', column }));
  if (issues.length) return { headers, rows, issues };
  if (!rows.length) return { headers, rows, issues: [{ code: 'empty' }] };
  if (rows.length > SETTLEMENT_MAX_ROWS) return { headers, rows, issues: [{ code: 'too_many_rows', value: rows.length }] };

  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const add = (code, column) => issues.push({ code, rowNo, column, value: column ? row[column] : undefined });
    if (widths[i] !== headers.length) {
      add('cell_count');
      return;
    }
    const required = ['national_id', 'phone_number', 'amount_egp', 'payment_date', 'payment_channel', 'payment_reference'];
    required.filter((c) => !row[c]).forEach((c) => add('required', c));
    if (row.national_id && !/^\d{14}$/.test(row.national_id)) add('nid_format', 'national_id');
    if (row.driver_name && row.driver_name.length > 100) add('name_length', 'driver_name');
    // Egyptian mobile: 01 + 0/1/2/5 + 8 digits (#5624).
    if (row.phone_number && !/^01[0125]\d{8}$/.test(row.phone_number)) add('phone_format', 'phone_number');
    if (row.amount_egp) {
      if (!/^\d+(\.\d{1,2})?$/.test(row.amount_egp)) add('amount_format', 'amount_egp');
      else if (Number(row.amount_egp) <= 0) add('amount_zero', 'amount_egp');
    }
    if (row.payment_date && !isIsoDay(row.payment_date)) add('date_format', 'payment_date');
    if (row.payment_channel && !SETTLEMENT_CHANNELS.includes(row.payment_channel)) add('channel_value', 'payment_channel');
    if (row.payment_reference && !/^[A-Za-z0-9-]{1,60}$/.test(row.payment_reference)) add('ref_format', 'payment_reference');
  });
  return { headers, rows, issues };
}

const FAILURE_REASONS = { MOBILE_WALLET: 'Wallet number not registered', BANK_ACCOUNT: 'Account closed', PREPAID_CARD: 'Card blocked by issuer' };

/** The payout settings in force now (2026-10-29): minimum payout, transfer fee, who pays it. */
function payoutSettings() {
  const { minimumAmount, transferFee, feePaidBy } = GLOBAL_POLICIES.payout;
  return { minimumAmount, transferFee, feePaidBy };
}

/** What the channel sends: her line, less the transfer fee when she pays it. */
const transferAmountOf = (l) => round2(l.feePaidBy === 'driver' ? l.amount - (l.fee ?? 0) : l.amount);

function exportRow(batch, l) {
  const row = { batch_ref: batch.ref, line_ref: l.lineRef, national_id: l.nationalId, driver_name: l.driverName, phone: l.phone ?? '' };
  if (l.payoutType === 'MOBILE_WALLET') Object.assign(row, { wallet_provider: l.provider ?? '', wallet_number: l.number, account_holder: l.holderName });
  else if (l.payoutType === 'BANK_ACCOUNT') Object.assign(row, { bank_name: l.provider ?? '', account_number: l.number, account_holder: l.holderName });
  else Object.assign(row, { card_number: l.number, card_holder: l.holderName });
  return Object.assign(row, {
    earnings_egp: l.amount.toFixed(2),
    transfer_fee_egp: (l.fee ?? 0).toFixed(2),
    fee_paid_by: l.feePaidBy === 'driver' ? 'DRIVER' : 'SHEDRIVE',
    amount_egp: transferAmountOf(l).toFixed(2),
  });
}

/** The payout methods a batch has lines for, in the fixed order. */
const batchTypes = (batch) => PAYOUT_TYPES.filter((type) => batch.lines.some((l) => l.payoutType === type));

/** Where one method's file is: ready, sent, result_pending or done. */
function partStatus(batch, type) {
  const part = batch.parts?.[type];
  if (part) return part.status;
  return { ready: 'ready', completed: 'done', result_pending: 'result_pending' }[batch.status] ?? 'sent';
}

/**
 * Each method's result comes back on its own file. The batch is Completed once
 * every file's result is approved, Result pending approval once none is still
 * awaited, and Sent to bank while any file's result is still to come.
 */
function settleBatchStatus(batch, now) {
  const states = batchTypes(batch).map((type) => partStatus(batch, type));
  const status = states.every((s) => s === 'done') ? 'completed' : states.every((s) => s !== 'sent') ? 'result_pending' : 'sent_to_bank';
  patchBatch(batch, { status, parts: batch.parts, result: batch.result ?? null, completedAt: status === 'completed' ? now : null });
}

function validationError(message, details) {
  const err = new MockApiError(message, 422);
  err.details = details;
  return Promise.reject(err);
}

/** What approving each request type does (§1). */
const EXECUTE = {
  payout_result(request) {
    const batch = PAYOUT_BATCHES_BY_ID.get(request.payload.batchId);
    if (!batch || !batch.result) return;
    const now = Date.now();
    // One method's file (2026-10-29); a request without one covers the whole batch.
    const type = request.payload.payoutType ?? null;
    batch.lines.forEach((line, i) => {
      if (type && line.payoutType !== type) return;
      const res = batch.result.find((r) => r.lineRef === line.lineRef);
      const driver = DRIVERS_BY_ID.get(line.driverId);
      if (!res) return;
      if (!driver) {
        // A generated review-case payee (finance-seed.js): no ledger to post to.
        Object.assign(line, res.status === 'SUCCESS'
          ? { status: 'paid', bankReference: res.bankReference || null }
          : { status: 'failed', failureReason: res.failureReason || 'Transfer failed' });
        return;
      }
      if (res.status === 'SUCCESS') {
        // Keyed on the line: importing the same result twice posts nothing new.
        if (!LEDGER_ENTRIES.some((e) => e.lineRef === line.lineRef)) {
          postPayout(driver, {
            amount: line.amount,
            at: now + i,
            ref: res.bankReference || line.lineRef,
            lineRef: line.lineRef,
            batchId: batch.id,
            fee: line.feePaidBy === 'driver' ? line.fee ?? 0 : 0,
          });
        }
        line.entryIds.forEach((id) => {
          const entry = LEDGER_ENTRIES.find((e) => e.id === id);
          if (entry) markEntryPaid(entry, line.lineRef);
        });
        line.status = 'paid';
        line.bankReference = res.bankReference || null;
        if (driver.lastPayoutFailure) patch('drivers', driver.id, { lastPayoutFailure: null });
        driver.lastPayoutFailure = null;
      } else {
        // FAILED — her entries go back to Due and join the next batch.
        line.status = 'failed';
        line.failureReason = res.failureReason || 'Transfer failed';
        driver.lastPayoutFailure = { at: now, reason: line.failureReason, batchId: batch.id, lineRef: line.lineRef };
        patch('drivers', driver.id, { lastPayoutFailure: driver.lastPayoutFailure });
      }
    });
    batch.parts ??= {};
    (type ? [type] : batchTypes(batch)).forEach((t) => {
      batch.parts[t] = { ...(batch.parts[t] ?? {}), status: 'done', decidedAt: now };
    });
    settleBatchStatus(batch, now);
  },
  payout(request) {
    const { driverId, amount, at, reference, proof } = request.payload;
    const driver = DRIVERS_BY_ID.get(driverId);
    if (!driver) return;
    postPayout(driver, { amount, at, ref: reference, proof });
    // A manual payout pays her oldest due entries first, up to the amount (§3).
    let left = amount;
    ledgerFor(driver.id)
      .filter((e) => entryPayoutStatus(e) === 'due')
      .reverse()
      .forEach((e) => {
        if (left >= e.amount - 0.005) {
          markEntryPaid(e, reference);
          left = round2(left - e.amount);
        }
      });
  },
  settlement(request) {
    const { driverId, amount, at, method, note, proof } = request.payload;
    const driver = DRIVERS_BY_ID.get(driverId);
    if (driver) postSettlement(driver, { amount, at: at ?? Date.now(), method, note, proof });
  },
  settlement_import(request) {
    const imp = SETTLEMENT_IMPORTS.find((i) => i.id === request.payload.importId);
    if (!imp) return;
    const now = Date.now();
    imp.rows.forEach((row, i) => {
      const driver = DRIVERS_BY_ID.get(row.driverId);
      if (!driver) return;
      const at = row.paymentDate ? new Date(`${row.paymentDate}T12:00:00`).getTime() + i : now + i;
      const entry = postSettlement(driver, {
        amount: row.amount,
        at,
        method: row.channel,
        note: `Imported from ${imp.fileName}`,
        paymentRef: row.paymentRef,
        importId: imp.id,
      });
      row.receipt = entry.ref;
    });
    Object.assign(imp, { status: 'approved', decidedAt: now, decidedBy: actingAdmin().email });
    patch('imports', imp.id, { status: imp.status, decidedAt: imp.decidedAt, decidedBy: imp.decidedBy, rows: imp.rows });
  },
  fee_waiver(request) {
    const { riderId, entryId } = request.payload;
    const rider = RIDERS_BY_ID.get(riderId);
    const fee = RIDER_LEDGER_ENTRIES.find((e) => e.id === entryId);
    if (!rider || !fee) return;
    const now = Date.now();
    postRiderLedgerEntry(rider, 'fee_waived', -fee.amount, now, {
      tripId: fee.tripId,
      reversesEntryId: fee.id,
      note: `Fee waived — ${request.payload.reason}`,
      actor: actingAdmin().email,
    });
    // §5 — the driver's share of that fee is removed too.
    const credit = LEDGER_ENTRIES.find(
      (e) => e.type === 'rider_cancellation_fee_credit' && e.tripId === fee.tripId && e.riderId === String(riderId),
    );
    const driver = credit && DRIVERS_BY_ID.get(credit.driverId);
    if (driver) {
      postLedgerEntry(driver, 'fee_credit_reversed', -credit.amount, now, {
        tripId: fee.tripId,
        riderId: String(riderId),
        reversesEntryId: credit.id,
        note: `${rider.name}'s cancellation fee was waived`,
        actor: actingAdmin().email,
      });
    }
    makeAuditEntry('fee waived', 'rider', rider.id, { fee: -fee.amount }, { fee: 0, entry: fee.id });
  },
  payout_method(request) {
    const driver = DRIVERS_BY_ID.get(request.payload.driverId);
    if (!driver) return;
    driver.payoutMethod = { ...request.payload.method, updatedAt: Date.now(), updatedBy: request.maker };
    // A new method answers the failed-payout warning (§3).
    driver.lastPayoutFailure = null;
    patch('drivers', driver.id, { payoutMethod: driver.payoutMethod, lastPayoutFailure: null });
    makeAuditEntry('payout method changed', 'driver', driver.id, { type: request.before.type ?? '—' }, { type: driver.payoutMethod.type });
  },
  rate_card(request) {
    const zone = ZONES_BY_ID.get(request.payload.zoneId);
    if (!zone) return;
    const card = request.payload.rateCard;
    zone.rateCard = card ? { ...card, updatedAt: Date.now() } : null;
    patch('zones', zone.id, { rateCard: zone.rateCard });
    pricingAudit(request);
  },
  commission(request) {
    Object.assign(GLOBAL_POLICIES.commission, {
      percentage: request.payload.percentage,
      updatedAt: Date.now(),
      updatedBy: request.maker,
    });
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    pricingAudit(request);
  },
  cancellation_policy(request) {
    Object.assign(GLOBAL_POLICIES.cancellation, request.payload.cancellation, {
      updatedAt: Date.now(),
      updatedBy: request.maker,
    });
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    pricingAudit(request);
  },
  balance_limit(request) {
    Object.assign(GLOBAL_POLICIES.driverBalance, request.payload.driverBalance, {
      updatedAt: Date.now(),
      updatedBy: request.maker,
    });
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    pricingAudit(request);
  },
  // 2026-10-29 — applies to the next batch generated; batches already made keep theirs.
  payout_settings(request) {
    Object.assign(GLOBAL_POLICIES.payout, request.payload.payout, {
      updatedAt: Date.now(),
      updatedBy: request.maker,
    });
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    makeAuditEntry('payout settings changed', 'policy', 'payout-settings', request.before, { ...request.after, request: request.id, requestedBy: request.maker });
  },
};

/** #5623 / #1760 — an approved pricing change is written to the pricing audit log, before → after. */
function pricingAudit(request) {
  const before = { ...(request.before ?? {}) };
  const after = { ...(request.after ?? {}), request: request.id, requestedBy: request.maker };
  makeAuditEntry('pricing change', request.subject.kind, request.subject.id, before, after);
}

/** What rejecting a request undoes (§1). */
const ON_REJECT = {
  payout_result(request) {
    const batch = PAYOUT_BATCHES_BY_ID.get(request.payload.batchId);
    if (!batch) return;
    // Only that method's file goes back to Sent to bank; a corrected file can be imported.
    const types = request.payload.payoutType ? [request.payload.payoutType] : batchTypes(batch);
    const refs = new Set(batch.lines.filter((l) => types.includes(l.payoutType)).map((l) => l.lineRef));
    batch.result = (batch.result ?? []).filter((r) => !refs.has(r.lineRef));
    batch.parts ??= {};
    types.forEach((t) => { batch.parts[t] = { status: 'sent' }; });
    settleBatchStatus(batch, Date.now());
  },
  settlement_import(request) {
    const imp = SETTLEMENT_IMPORTS.find((i) => i.id === request.payload.importId);
    if (!imp) return;
    Object.assign(imp, { status: 'rejected', decidedAt: Date.now(), decidedBy: actingAdmin().email });
    patch('imports', imp.id, { status: imp.status, decidedAt: imp.decidedAt, decidedBy: imp.decidedBy });
  },
};

/** True when an active Financial lead other than `email` exists to decide her request (#6212). */
function otherLeadExists(email) {
  return ADMINS.some((a) => a.status === 'active' && a.role === 'fin_lead' && a.email !== email);
}

function decorateRequest(r) {
  const me = actingAdmin();
  const pending = r.status === 'pending';
  return {
    ...r,
    madeByYou: r.maker === me.email,
    // #6212 — only a Financial lead decides, and never her own request.
    canDecide: pending && r.maker !== me.email && can('finance.approve', me.role),
    // No other active Financial lead can decide it: it stays pending.
    waitingForLead: pending && !otherLeadExists(r.maker),
  };
}

// ── Generic query helpers ─────────────────────────────

function matchesText(haystack, needle) {
  if (!needle) return true;
  return String(haystack ?? '').toLowerCase().includes(String(needle).toLowerCase());
}

/** Inclusive date-range test against a millisecond timestamp. */
function inDateRange(timestamp, from, to) {
  if (from) {
    const start = Date.parse(`${from}T00:00:00+02:00`);
    if (!Number.isNaN(start) && timestamp < start) return false;
  }
  if (to) {
    const end = Date.parse(`${to}T23:59:59+02:00`);
    if (!Number.isNaN(end) && timestamp > end) return false;
  }
  return true;
}

function sortRows(rows, sort, fallback) {
  const spec = sort ?? fallback;
  if (!spec?.key) return rows;
  const dir = spec.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = spec.get ? spec.get(a) : a[spec.key];
    const bv = spec.get ? spec.get(b) : b[spec.key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir;
    }
    return (av < bv ? -1 : 1) * dir;
  });
}

function paginate(rows, page = 1, pageSize = 20) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/** Column key → the comparable value used for sorting. */
const SORT_ACCESSORS = {
  trips: {
    riderName: (t) => t.riderName,
    driverName: (t) => t.driverName,
    status: (t) => t.status,
    fare: (t) => t.fare?.total ?? t.estimate.fare,
    createdAt: (t) => t.createdAt,
  },
};

// ── Auth (#1656, #1806, #1822) ────────────────────────

const AUTH = {
  // Mockup credentials — no real secret material. Any registered admin email
  // works with this password; the 2FA step accepts the fixed demo code.
  password: 'shedrive2026',
  totpCode: '123456',
  recoveryCode: 'SD-RECOVERY-01',
  maxTotpAttempts: 3,
};

export const mockAuth = {
  credentials: AUTH,

  /** Step 1 — email + password. Resolves with the 2FA challenge. */
  login(email, password) {
    const admin = ADMINS.find((a) => a.email.toLowerCase() === String(email).toLowerCase());
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (!admin || password !== AUTH.password) {
          reject(new MockApiError('Email or password is incorrect.', 401));
          return;
        }
        if (admin.status === 'disabled') {
          reject(new MockApiError('This admin account is disabled.', 403));
          return;
        }
        resolve({
          email: admin.email,
          requiresEnrolment: !admin.twoFactorEnrolled,
          mustChangePassword: admin.lastLoginAt === null,
        });
      }, LATENCY_MS);
    });
  },

  /** Step 2 — TOTP or recovery code. */
  verifySecondFactor(code) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        const value = String(code ?? '').trim();
        if (value === AUTH.totpCode || value.toUpperCase() === AUTH.recoveryCode) {
          resolve({ ok: true, usedRecoveryCode: value.toUpperCase() === AUTH.recoveryCode });
        } else {
          reject(new MockApiError('Invalid or expired code.', 401));
        }
      }, LATENCY_MS);
    });
  },

  requestPasswordReset(email) {
    return respond({ ok: true, email }, { latency: LATENCY_MS });
  },

  changePassword() {
    return respond({ ok: true });
  },

  /** One-time recovery codes shown once at enrolment (#1806 Scenario 1). */
  recoveryCodes() {
    return Array.from({ length: 8 }, (_, i) => `SD-RECOVERY-${String(i + 1).padStart(2, '0')}`);
  },
};

// ── Dashboard (#1669) ─────────────────────────────────

function isToday(timestamp) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return timestamp >= start.getTime();
}

export const mockApi = {
  stateOverride,

  getCurrentAdmin() {
    return actingAdmin();
  },

  getDashboardMetrics() {
    const metrics = {
      activeTrips: TRIPS.filter((t) => t.status === 'active').length,
      onlineDrivers: DRIVERS.filter((d) => d.online).length,
      tripsToday: TRIPS.filter((t) => isToday(t.createdAt)).length,
      registeredRiders: RIDERS.length,
      approvedDrivers: DRIVERS.filter(
        (d) => d.status === 'approved' || d.status === 'pending_suspension',
      ).length,
      refreshedAt: Date.now(),
    };

    return respond(metrics, {
      emptyValue: {
        activeTrips: 0,
        onlineDrivers: 0,
        tripsToday: 0,
        registeredRiders: RIDERS.length,
        approvedDrivers: DRIVERS.filter((d) => d.status === 'approved').length,
        refreshedAt: Date.now(),
      },
      latency: 220,
    });
  },

  /** Live map payload (#1823–#1826). `layer` is all | drivers | requests. */
  getLiveMapData({ layer = 'all' } = {}) {
    const activeByDriver = new Map(
      TRIPS.filter((t) => t.status === 'active' && t.driverId).map((t) => [t.driverId, t]),
    );

    const drivers = DRIVERS.filter((d) => d.online && d.position).map((driver) => {
      const trip = activeByDriver.get(driver.id) ?? null;
      return {
        kind: trip ? 'driver-on-trip' : 'driver-idle',
        id: `DRV-${driver.id}`,
        driverId: driver.id,
        name: driver.name,
        vehicle: driver.vehicle,
        position: driver.position,
        trip: trip
          ? {
              id: trip.id,
              riderName: trip.riderName,
              pickup: trip.pickup.area,
              destination: trip.destination.area,
              status: trip.stateHistory[trip.stateHistory.length - 1].state,
            }
          : null,
      };
    });

    const requests = TRIPS.filter((t) => t.status === 'searching').map((trip) => ({
      kind: 'ride-request',
      id: trip.id,
      position: trip.pickup.point,
      riderName: trip.riderName,
      pickup: trip.pickup.address,
      destination: trip.destination.address,
      estimatedFare: trip.estimate.fare,
      requestedAt: trip.createdAt,
    }));

    const markers =
      layer === 'drivers' ? drivers : layer === 'requests' ? requests : [...drivers, ...requests];

    return respond({ markers, refreshedAt: Date.now() }, {
      emptyValue: { markers: [], refreshedAt: Date.now() },
      latency: 200,
    });
  },

  // ── Driver applications (#1657–#1660) ───────────────

  /**
   * The outcome of a driver's APPLICATION, which is not the same as her current
   * account status: a suspended driver's application was still approved.
   */
  applicationOutcome(driver) {
    if (driver.status === 'pending') return 'pending';
    if (driver.status === 'rejected') return 'rejected';
    return 'approved';
  },

  /**
   * #1657 specifies a pending-only queue. This lists every application with an
   * outcome filter instead, so an admin can also review what was already decided.
   * Flagged as a scope change in docs/ux/admin-wireframes.md.
   */
  listApplications({ search = '', status = 'all', from = '', to = '', page = 1, pageSize = 20, sort } = {}) {
    const rows = DRIVERS.map((driver) => ({
      ...driver,
      applicationOutcome: this.applicationOutcome(driver),
    }));

    const filtered = rows.filter(
      (app) =>
        (matchesText(app.name, search) || matchesText(app.phone, search)) &&
        (status === 'all' || app.applicationOutcome === status) &&
        inDateRange(app.submittedAt, from, to),
    );

    // #1657: default sort is submission date, oldest first — it is a work queue.
    const sorted = sortRows(filtered, sort, { key: 'submittedAt', dir: 'asc' });
    const page1 = paginate(sorted, page, pageSize);

    // The "awaiting review" badge counts pending regardless of the active filter.
    return respond(
      { ...page1, pendingTotal: rows.filter((r) => r.applicationOutcome === 'pending').length },
      { emptyValue: { ...emptyPage(pageSize), pendingTotal: 0 } },
    );
  },

  getApplication(id) {
    // Any application is viewable, not just a pending one — an admin needs to be
    // able to open a decision that has already been made.
    const driver = DRIVERS_BY_ID.get(String(id));
    return respond(driver ?? null, { emptyValue: null });
  },

  approveApplication(id) {
    const refused = refusedFor('applications.decide');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Application not found.', 404));
    driver.status = 'approved';
    driver.decisionHistory.push({
      state: 'approved',
      at: Date.now(),
      actor: actingAdmin().email,
      note: null,
    });
    reindexApplications();
    patch('drivers', id, {
      status: driver.status,
      decisionHistory: driver.decisionHistory,
    });
    return respond({ ok: true, status: driver.status });
  },

  rejectApplication(id, reason) {
    const refused = refusedFor('applications.decide');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Application not found.', 404));
    driver.status = 'rejected';
    driver.rejectionReason = reason;
    driver.decisionHistory.push({
      state: 'rejected',
      at: Date.now(),
      actor: actingAdmin().email,
      note: reason,
    });
    reindexApplications();
    patch('drivers', id, {
      status: driver.status,
      rejectionReason: driver.rejectionReason,
      decisionHistory: driver.decisionHistory,
    });
    return respond({ ok: true, status: driver.status });
  },

  // ── Drivers (#1665, #1666, #1742, #1743) ────────────

  listDrivers({ search = '', status = 'all', page = 1, pageSize = 20, sort } = {}) {
    const filtered = DRIVERS.filter(
      (driver) =>
        (matchesText(driver.name, search) || matchesText(driver.phone, search)) &&
        (status === 'all' || driver.status === status),
    );
    const sorted = sortRows(filtered, sort, { key: 'submittedAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /**
   * Approved and suspended drivers only — the #1833 report's driver picker.
   * The phone rides along because the picker is searchable on name *or* phone
   * (#4382): a driver calling about her money gives her number, not a spelling.
   */
  listSettleableDrivers() {
    const rows = DRIVERS.filter((d) =>
      ['approved', 'suspended', 'pending_suspension'].includes(d.status),
    ).map((d) => ({ id: d.id, name: d.name, phone: d.phone, status: d.status }));
    return respond(rows, { emptyValue: [], latency: 160 });
  },

  getDriver(id) {
    return respond(DRIVERS_BY_ID.get(String(id)) ?? null, { emptyValue: null });
  },

  suspendDriver(id, reason, note) {
    const refused = refusedFor('drivers.suspend');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));
    // #1742: a driver mid-trip goes to Pending Suspension until the trip ends.
    const hasActiveTrip = TRIPS.some((t) => t.status === 'active' && t.driverId === driver.id);
    driver.status = hasActiveTrip ? 'pending_suspension' : 'suspended';
    driver.suspensionReason = reason === 'Other' && note ? note : reason;
    driver.online = false;
    driver.position = null;
    driver.decisionHistory.push({
      state: driver.status,
      at: Date.now(),
      actor: actingAdmin().email,
      note: driver.suspensionReason,
    });
    patch('drivers', id, {
      status: driver.status,
      suspensionReason: driver.suspensionReason,
      online: false,
      position: null,
      decisionHistory: driver.decisionHistory,
    });
    return respond({ ok: true, status: driver.status, pending: hasActiveTrip });
  },

  reinstateDriver(id, reason, note) {
    const refused = refusedFor('drivers.suspend');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const at = Date.now();
    // A reinstatement is as consequential as a suspension, so it carries its own
    // recorded reason rather than being an unexplained status flip.
    const recordedReason = reason === 'Other' && note ? note : reason;
    const previousStatus = driver.status;

    driver.status = 'approved';
    driver.suspensionReason = null;
    driver.reinstatement = { reason: recordedReason, note: note || null, by: actingAdmin().email, at };
    driver.decisionHistory.push({
      state: 'reinstated',
      at,
      actor: actingAdmin().email,
      note: recordedReason,
    });
    patch('drivers', id, {
      status: driver.status,
      suspensionReason: null,
      reinstatement: driver.reinstatement,
      decisionHistory: driver.decisionHistory,
    });
    addAuditEntry(
      'reinstate',
      'driver',
      driver.id,
      { status: previousStatus },
      { status: 'approved', reason: recordedReason },
      at,
    );
    return respond({ ok: true, status: driver.status });
  },

  /** #1666: driver trip history — 10 rows/page. */
  listDriverTrips(id, { page = 1, pageSize = 10 } = {}) {
    const rows = TRIPS.filter(
      (t) => String(t.driverId) === String(id) && t.status === 'completed',
    ).sort((a, b) => b.createdAt - a.createdAt);
    return respond(paginate(rows, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  // ── Riders (#1661, #1662, #1740, #1741) ─────────────

  listRiders({ search = '', status = 'all', page = 1, pageSize = 20, sort } = {}) {
    const filtered = RIDERS.filter(
      (rider) =>
        (matchesText(rider.name, search) || matchesText(rider.phone, search)) &&
        (status === 'all' || rider.status === status),
    );
    const sorted = sortRows(filtered, sort, { key: 'registeredAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  getRider(id) {
    return respond(RIDERS_BY_ID.get(String(id)) ?? null, { emptyValue: null });
  },

  suspendRider(id, reason, note) {
    const refused = refusedFor('riders.suspend');
    if (refused) return refused;
    const rider = RIDERS_BY_ID.get(String(id));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));
    const at = Date.now();
    rider.status = 'suspended';
    rider.suspensionReason = reason === 'Other' && note ? note : reason;
    rider.suspendedAt = at;
    rider.suspendedBy = actingAdmin().email;
    rider.reinstatement = null;
    patch('riders', id, {
      status: rider.status,
      suspensionReason: rider.suspensionReason,
      suspendedAt: rider.suspendedAt,
      suspendedBy: rider.suspendedBy,
      reinstatement: null,
    });
    addAuditEntry('suspend', 'rider', rider.id, { status: 'active' }, {
      status: 'suspended',
      reason: rider.suspensionReason,
    }, at);
    return respond({ ok: true, status: rider.status });
  },

  reinstateRider(id, reason, note) {
    const refused = refusedFor('riders.suspend');
    if (refused) return refused;
    const rider = RIDERS_BY_ID.get(String(id));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));

    const at = Date.now();
    // Same principle as a driver reinstatement: as consequential as the
    // suspension it reverses, so it carries its own recorded reason.
    const recordedReason = reason === 'Other' && note ? note : reason;
    const previousStatus = rider.status;

    rider.status = 'active';
    rider.suspensionReason = null;
    rider.suspendedAt = null;
    rider.suspendedBy = null;
    rider.reinstatement = { reason: recordedReason, note: note || null, by: actingAdmin().email, at };

    patch('riders', id, {
      status: 'active',
      suspensionReason: null,
      suspendedAt: null,
      suspendedBy: null,
      reinstatement: rider.reinstatement,
    });
    addAuditEntry(
      'reinstate',
      'rider',
      rider.id,
      { status: previousStatus },
      { status: 'active', reason: recordedReason },
      at,
    );
    return respond({ ok: true, status: rider.status });
  },

  /** #1662: rider trip history — 10 rows/page. */
  listRiderTrips(id, { page = 1, pageSize = 10 } = {}) {
    const rows = TRIPS.filter((t) => String(t.riderId) === String(id)).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    return respond(paginate(rows, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  // ── Trips (#1670–#1672) ─────────────────────────────

  listTrips({ search = '', status = 'all', from = '', to = '', page = 1, pageSize = 20, sort } = {}) {
    const filtered = TRIPS.filter((trip) => {
      const textMatch =
        !search ||
        matchesText(trip.riderName, search) ||
        matchesText(trip.riderPhone, search) ||
        matchesText(trip.driverName, search) ||
        matchesText(trip.driverPhone, search) ||
        matchesText(trip.id, search);
      return textMatch && (status === 'all' || trip.status === status) &&
        inDateRange(trip.createdAt, from, to);
    });
    const spec = sort
      ? { ...sort, get: SORT_ACCESSORS.trips[sort.key] }
      : { key: 'createdAt', dir: 'desc' };
    return respond(paginate(sortRows(filtered, spec, spec), page, pageSize), {
      emptyValue: emptyPage(pageSize),
    });
  },

  getTrip(id) {
    return respond(TRIPS_BY_ID.get(String(id)) ?? null, { emptyValue: null });
  },

  // ── Admin trip interventions (#1808, #1809) ─────────
  //
  // Both stories are UNWRITTEN. The behaviour below is a proposal, chosen to fit
  // what the rest of the backlog already states rather than invented freely:
  //   • Cancelling yields a distinct `cancelled` status, not an `expired` one.
  //     #1671 Scenario 2 lists "in progress, cancelled, or expired" as three
  //     separate cases, so `cancelled` is already part of the domain vocabulary.
  //     Consequence: #1670's status filter needs a fifth option — flagged in
  //     docs/ux/admin-wireframes.md.
  //   • Reassigning keeps the trip live and returns it to `accepted`, since the
  //     incoming driver has taken the job but has not started travelling yet.
  //   • Both are recorded in the audit log, which #1816 explicitly requires.

  /** Only a trip that has not reached a terminal state can be intervened on. */
  isInterveneable(trip) {
    return trip?.status === 'active' || trip?.status === 'searching';
  },

  /** Drivers eligible to take over a trip: approved, online, and not already busy. */
  listReassignableDrivers(tripId) {
    const trip = TRIPS_BY_ID.get(String(tripId));
    const busy = new Set(
      TRIPS.filter((t) => t.status === 'active' && t.driverId).map((t) => String(t.driverId)),
    );

    const rows = DRIVERS.filter(
      (driver) =>
        driver.status === 'approved' &&
        driver.online &&
        String(driver.id) !== String(trip?.driverId) &&
        !busy.has(String(driver.id)),
    ).map((driver) => ({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicle: `${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.plate}`,
      homeArea: driver.homeArea,
      rating: driver.avgRating,
    }));

    return respond(rows, { emptyValue: [], latency: 200 });
  },

  cancelTrip(id, reason, note) {
    const refused = refusedFor('trips.intervene');
    if (refused) return refused;
    const trip = TRIPS_BY_ID.get(String(id));
    if (!trip) return Promise.reject(new MockApiError('Trip not found.', 404));
    if (!this.isInterveneable(trip)) {
      return Promise.reject(
        new MockApiError('Only a trip that is still in progress can be cancelled.', 409),
      );
    }

    const at = Date.now();
    const recordedReason = reason === 'Other' && note ? note : reason;

    trip.status = 'cancelled';
    trip.cancellation = { reason: recordedReason, note: note || null, by: actingAdmin().email, at };
    trip.stateHistory = [
      ...trip.stateHistory,
      { state: 'cancelled_by_admin', at, note: recordedReason },
    ];
    trip.updatedAt = at;

    patch('trips', id, {
      status: trip.status,
      cancellation: trip.cancellation,
      stateHistory: trip.stateHistory,
      updatedAt: at,
    });

    addAuditEntry('cancel', 'trip', trip.id, { status: 'active' }, {
      status: 'cancelled',
      reason: recordedReason,
    }, at);

    return respond({ ok: true, status: trip.status });
  },

  reassignTrip(id, driverId, reason, note) {
    const refused = refusedFor('trips.intervene');
    if (refused) return refused;
    const trip = TRIPS_BY_ID.get(String(id));
    if (!trip) return Promise.reject(new MockApiError('Trip not found.', 404));
    if (!this.isInterveneable(trip)) {
      return Promise.reject(
        new MockApiError('Only a trip that is still in progress can be reassigned.', 409),
      );
    }

    const next = DRIVERS_BY_ID.get(String(driverId));
    if (!next) return Promise.reject(new MockApiError('Driver not found.', 404));
    if (next.status !== 'approved' || !next.online) {
      return Promise.reject(
        new MockApiError('That driver is no longer available to take this trip.', 409),
      );
    }
    if (String(next.id) === String(trip.driverId)) {
      return Promise.reject(
        new MockApiError('That driver is already assigned to this trip.', 422),
      );
    }

    const at = Date.now();
    const previous = { id: trip.driverId, name: trip.driverName };
    const recordedReason = reason === 'Other' && note ? note : reason;

    trip.driverId = next.id;
    trip.driverName = next.name;
    trip.driverPhone = next.phone;
    trip.vehicle = next.vehicle;
    // The incoming driver has accepted but has not started travelling yet.
    trip.status = 'active';
    trip.stateHistory = [
      ...trip.stateHistory,
      {
        state: 'reassigned_by_admin',
        at,
        note: `${previous.name ?? 'Unassigned'} → ${next.name} · ${recordedReason}`,
      },
      { state: 'accepted', at: at + 1000, note: null },
    ];
    trip.updatedAt = at + 1000;

    patch('trips', id, {
      driverId: trip.driverId,
      driverName: trip.driverName,
      driverPhone: trip.driverPhone,
      vehicle: trip.vehicle,
      status: trip.status,
      stateHistory: trip.stateHistory,
      updatedAt: trip.updatedAt,
    });

    addAuditEntry(
      'reassign',
      'trip',
      trip.id,
      { driver: previous.name ?? 'Unassigned' },
      { driver: next.name, reason: recordedReason },
      at,
    );

    return respond({ ok: true, driverName: next.name });
  },

  // ── Safety reports (#1810, #1811) ───────────────────

  listSafetyReports({ status = 'open', from = '', to = '', page = 1, pageSize = 20, sort } = {}) {
    const filtered = SAFETY_REPORTS.filter(
      (report) =>
        (status === 'all' || report.status === status) &&
        inDateRange(report.reportedAt, from, to),
    );
    // #1810: default sort is report time, oldest first.
    const sorted = sortRows(filtered, sort, { key: 'reportedAt', dir: 'asc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  getSafetyReport(id) {
    const report = REPORTS_BY_ID.get(String(id)) ?? null;
    if (!report) return respond(null, { emptyValue: null });
    return respond(
      {
        ...report,
        trip: TRIPS_BY_ID.get(report.tripId) ?? null,
        rider: RIDERS_BY_ID.get(String(report.riderId)) ?? null,
        driver: DRIVERS_BY_ID.get(String(report.driverId)) ?? null,
      },
      { emptyValue: null },
    );
  },

  /** #1811: resolution is 'suspended' or 'dismissed'. */
  resolveSafetyReport(id, resolution, note) {
    const refused = refusedFor('safety.handle');
    if (refused) return refused;
    // Acting against the rider (suspending her) is the Operations lead's (#6210).
    if (resolution === 'suspended') {
      const refusedAct = refusedFor('safety.actAgainst');
      if (refusedAct) return refusedAct;
    }
    const report = REPORTS_BY_ID.get(String(id));
    if (!report) return Promise.reject(new MockApiError('Report not found.', 404));
    if (report.status === 'resolved') {
      return Promise.reject(new MockApiError('This report is already resolved.', 409));
    }

    const rider = RIDERS_BY_ID.get(String(report.riderId));
    report.status = 'resolved';
    report.resolution = resolution;
    report.resolutionNote = note || null;
    report.resolvedAt = Date.now();
    report.resolvedBy = actingAdmin().email;

    if (rider) {
      if (resolution === 'suspended') {
        rider.status = 'suspended';
        rider.suspensionReason = note || 'Gender-mismatch report upheld';
        rider.suspendedAt = report.resolvedAt;
        rider.suspendedBy = actingAdmin().email;
      } else {
        // A dismissal is not a manual reinstatement: the resolved report is the
        // record, and the profile links to it.
        rider.status = 'active';
        rider.suspensionReason = null;
        rider.suspendedAt = null;
        rider.suspendedBy = null;
      }
      patch('riders', rider.id, {
        status: rider.status,
        suspensionReason: rider.suspensionReason,
        suspendedAt: rider.suspendedAt ?? null,
        suspendedBy: rider.suspendedBy ?? null,
      });
    }

    patch('reports', id, {
      status: report.status,
      resolution: report.resolution,
      resolutionNote: report.resolutionNote,
      resolvedAt: report.resolvedAt,
      resolvedBy: report.resolvedBy,
    });

    return respond({ ok: true, resolution, riderStatus: rider?.status ?? null });
  },

  // ── SOS cases ──────────────────────────────────────

  listSosCases({ status = 'open', raisedBy = 'all', from = '', to = '', page = 1, pageSize = 20, sort } = {}) {
    const filtered = SOS_CASES.filter(
      (sosCase) =>
        (status === 'all' || sosCase.status === status) &&
        (raisedBy === 'all' || sosCase.raisedBy === raisedBy) &&
        inDateRange(sosCase.raisedAt, from, to),
    );
    const sorted = sortRows(filtered, sort, { key: 'raisedAt', dir: 'desc' });
    // Open cases float to the top of every sort: a safety queue is worked
    // top-down, and a closed case must never bury an open one.
    const ordered = [...sorted].sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === 'open' ? -1 : 1;
    });
    return respond(paginate(ordered, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /**
   * Open SOS cases, read synchronously for the sidebar count. It ignores
   * `?state=`: an empty or erroring queue preview must not hide a live emergency
   * from the menu on every other screen.
   */
  openSosCount() {
    return SOS_CASES.filter((sosCase) => sosCase.status === 'open').length;
  },

  getSosCase(id) {
    const sosCase = SOS_CASES_BY_ID.get(String(id)) ?? null;
    if (!sosCase) return respond(null, { emptyValue: null });
    return respond(
      {
        ...sosCase,
        trip: TRIPS_BY_ID.get(sosCase.tripId) ?? null,
        rider: RIDERS_BY_ID.get(String(sosCase.riderId)) ?? null,
        driver: DRIVERS_BY_ID.get(String(sosCase.driverId)) ?? null,
      },
      { emptyValue: null },
    );
  },

  /**
   * Close a case. Either party, both, or neither may be suspended in the same
   * action; a suspension always wins the recorded outcome, because "resolved"
   * would understate what was actually done. Suspension goes through the same
   * fields as a manual one, so the profile screen and the audit log show it
   * identically however it was raised.
   */
  actionSosCase(id, { suspendRider = false, suspendDriver = false, outcome = 'resolved', note } = {}) {
    const refused = refusedFor('sos.act');
    if (refused) return refused;
    const sosCase = SOS_CASES_BY_ID.get(String(id));
    if (!sosCase) return Promise.reject(new MockApiError('SOS case not found.', 404));
    if (sosCase.status === 'closed') {
      return Promise.reject(new MockApiError('This case is already closed.', 409));
    }

    const now = Date.now();
    const rider = RIDERS_BY_ID.get(String(sosCase.riderId));
    const driver = DRIVERS_BY_ID.get(String(sosCase.driverId));
    const reason = note || `Suspended from SOS case ${sosCase.id}`;

    if (suspendRider && rider) {
      rider.status = 'suspended';
      rider.suspensionReason = reason;
      rider.suspendedAt = now;
      rider.suspendedBy = actingAdmin().email;
      patch('riders', rider.id, {
        status: rider.status,
        suspensionReason: rider.suspensionReason,
        suspendedAt: rider.suspendedAt,
        suspendedBy: rider.suspendedBy,
      });
    }

    if (suspendDriver && driver) {
      driver.status = 'suspended';
      driver.suspensionReason = reason;
      driver.suspendedAt = now;
      driver.suspendedBy = actingAdmin().email;
      patch('drivers', driver.id, {
        status: driver.status,
        suspensionReason: driver.suspensionReason,
        suspendedAt: driver.suspendedAt,
        suspendedBy: driver.suspendedBy,
      });
    }

    const recorded =
      suspendRider && suspendDriver
        ? 'both_suspended'
        : suspendRider
          ? 'rider_suspended'
          : suspendDriver
            ? 'driver_suspended'
            : outcome;

    sosCase.status = 'closed';
    sosCase.outcome = recorded;
    sosCase.resolutionNote = note || null;
    sosCase.closedAt = now;
    sosCase.closedBy = actingAdmin().email;

    patch('sosCases', id, {
      status: sosCase.status,
      outcome: sosCase.outcome,
      resolutionNote: sosCase.resolutionNote,
      closedAt: sosCase.closedAt,
      closedBy: sosCase.closedBy,
    });

    // before/after are keyed field maps, not strings — the audit log diffs them
    // per key. makeAuditEntry already records the entry for session replay.
    makeAuditEntry(
      'sos case closed',
      'SOS case',
      sosCase.id,
      { status: 'open' },
      { status: 'closed', outcome: recorded },
    );

    return respond({
      ok: true,
      outcome: recorded,
      riderStatus: rider?.status ?? null,
      driverStatus: driver?.status ?? null,
    });
  },

  // ── Pricing & zones (#1756, #1757, #1759, #1830, #1831) ──

  listZones({ search = '', status = 'all', from = '', to = '', page = 1, pageSize = 50, sort } = {}) {
    const filtered = ZONES.filter(
      (zone) =>
        matchesText(zone.name, search) &&
        (status === 'all' || zone.status === status) &&
        inDateRange(zone.createdAt, from, to),
    );
    const sorted = sortRows(filtered, sort, { key: 'name', dir: 'asc' });
    const page1 = paginate(sorted, page, pageSize);
    // The map needs every matching zone, not just the current page. Rows are
    // serialised too, so they carry `pendingChange` (maker-checker §1).
    return respond(
      { ...page1, rows: page1.rows.map(serialiseZone), allMatching: sorted.map(serialiseZone) },
      { emptyValue: { ...emptyPage(pageSize), allMatching: [] } },
    );
  },

  getZone(id) {
    const zone = ZONES_BY_ID.get(String(id));
    return respond(zone ? serialiseZone(zone) : null, { emptyValue: null });
  },

  createZone({ name, polygon }) {
    const refused = refusedFor('zones.edit');
    if (refused) return refused;
    const clash = ZONES.some((z) => z.name.toLowerCase() === String(name).trim().toLowerCase());
    if (clash) {
      return Promise.reject(new MockApiError('A zone with this name already exists.', 409));
    }
    const spec = {
      id: Date.now(),
      name: String(name).trim(),
      rateCard: null,
      polygon,
      centre: polygonCentre(polygon),
      createdBy: actingAdmin().email,
      createdAt: Date.now(),
    };
    const zone = makeZone(spec);
    ZONES.push(zone);
    ZONES_BY_ID.set(String(zone.id), zone);
    recordZoneCreate(spec);
    return respond({ ok: true, id: zone.id, status: zone.status });
  },

  updateZone(id, { name, polygon }) {
    const refused = refusedFor('zones.edit');
    if (refused) return refused;
    const zone = ZONES_BY_ID.get(String(id));
    if (!zone) return Promise.reject(new MockApiError('Zone not found.', 404));
    const clash = ZONES.some(
      (z) => z.id !== zone.id && z.name.toLowerCase() === String(name).trim().toLowerCase(),
    );
    if (clash) {
      return Promise.reject(new MockApiError('A zone with this name already exists.', 409));
    }
    zone.name = String(name).trim();
    if (polygon) {
      zone.polygon = polygon;
      zone.centre = polygonCentre(polygon);
    }
    patch('zones', id, { name: zone.name, polygon: zone.polygon, centre: zone.centre });
    return respond({ ok: true });
  },

  deleteZone(id) {
    const refused = refusedFor('zones.edit');
    if (refused) return refused;
    const index = ZONES.findIndex((z) => String(z.id) === String(id));
    if (index === -1) return Promise.reject(new MockApiError('Zone not found.', 404));
    ZONES.splice(index, 1);
    ZONES_BY_ID.delete(String(id));
    recordZoneDelete(id);
    return respond({ ok: true });
  },

  /** #1757: saving a valid rate card is what makes a zone Active. */
  saveRateCard(id, rateCard) {
    const refused = refusedFor('pricing.request');
    if (refused) return refused;
    const zone = ZONES_BY_ID.get(String(id));
    if (!zone) return Promise.reject(new MockApiError('Zone not found.', 404));
    if (Number(rateCard.minFare) < Number(rateCard.baseFare)) {
      return Promise.reject(
        new MockApiError('Minimum fare cannot be less than base fare.', 422),
      );
    }
    if (pendingFor('zone', zone.id, 'rate_card')) {
      return Promise.reject(new MockApiError('A rate card change for this zone is already awaiting approval.', 409));
    }
    const card = {
      baseFare: Number(rateCard.baseFare),
      perKm: Number(rateCard.perKm),
      perMin: Number(rateCard.perMin),
      minFare: Number(rateCard.minFare),
      cancellationFee: Number(rateCard.cancellationFee ?? 0),
    };
    // Maker-checker (§1): the card applies only once another admin approves.
    const { updatedAt, ...current } = zone.rateCard ?? {};
    const request = createRequest('rate_card', { kind: 'zone', id: String(zone.id), label: zone.name }, {
      before: zone.rateCard ? current : {},
      after: card,
      payload: { zoneId: String(zone.id), rateCard: card },
    });
    return respond({ ok: true, pending: true, request: decorateRequest(request), status: zone.status });
  },

  removeRateCard(id) {
    const refused = refusedFor('pricing.request');
    if (refused) return refused;
    const zone = ZONES_BY_ID.get(String(id));
    if (!zone) return Promise.reject(new MockApiError('Zone not found.', 404));
    if (pendingFor('zone', zone.id, 'rate_card')) {
      return Promise.reject(new MockApiError('A rate card change for this zone is already awaiting approval.', 409));
    }
    const { updatedAt, ...current } = zone.rateCard ?? {};
    const request = createRequest('rate_card', { kind: 'zone', id: String(zone.id), label: zone.name }, {
      before: current,
      after: { removed: true },
      payload: { zoneId: String(zone.id), rateCard: null },
    });
    return respond({ ok: true, pending: true, request: decorateRequest(request), status: zone.status });
  },

  getPolicies() {
    const payload = {
      ...structuredClone(GLOBAL_POLICIES),
      // A commission change waits for approval (§1); the screen shows it as pending.
      pendingCommission: pendingSummary(pendingFor('policy', 'commission', 'commission')),
      pendingCancellation: pendingSummary(pendingFor('policy', 'cancellation', 'cancellation_policy')),
      pendingBalanceLimit: pendingSummary(pendingFor('policy', 'balance-limit', 'balance_limit')),
      pendingPayoutSettings: pendingSummary(pendingFor('policy', 'payout-settings', 'payout_settings')),
    };
    return respond(payload, { emptyValue: payload });
  },

  /**
   * #5623 / #6212: commission, the cancellation policy and the driver balance
   * limit each become a request a Financial lead makes and another approves —
   * nothing changes until then. Operating hours (#6268) save immediately and
   * are the Operations lead's. Every part is checked against the role first, so
   * a mixed save never half-applies.
   */
  savePolicies(next) {
    const role = actingAdmin().role;
    const wantsPricing = Boolean(next.commission || next.cancellation || next.driverBalance || next.payout);
    if ((wantsPricing && !can('pricing.request', role)) || (next.operatingHours && !can('hours.edit', role))) {
      return Promise.reject(new MockApiError("Your role can't do this. Nothing was changed.", 403));
    }

    const strip = ({ updatedAt, updatedBy, ...rest }) => rest;
    const changes = [];
    if (next.commission && Number(next.commission.percentage) !== Number(GLOBAL_POLICIES.commission.percentage)) {
      const percentage = Number(next.commission.percentage);
      changes.push(['commission', 'commission', 'Platform commission',
        { percentage: GLOBAL_POLICIES.commission.percentage }, { percentage }, { percentage }]);
    }
    if (next.cancellation) {
      const before = strip(GLOBAL_POLICIES.cancellation);
      const after = { ...before, ...next.cancellation };
      if (Object.keys(after).some((k) => Number(after[k]) !== Number(before[k]))) {
        changes.push(['cancellation_policy', 'cancellation', 'Cancellation policy', before, after, { cancellation: after }]);
      }
    }
    if (next.driverBalance && Number(next.driverBalance.outstandingLimit) !== Number(GLOBAL_POLICIES.driverBalance.outstandingLimit)) {
      const before = { outstandingLimit: GLOBAL_POLICIES.driverBalance.outstandingLimit };
      const after = { outstandingLimit: Number(next.driverBalance.outstandingLimit) };
      changes.push(['balance_limit', 'balance-limit', 'Driver balance limit', before, after, { driverBalance: after }]);
    }
    if (next.payout) {
      // 2026-10-29 — minimum payout, transfer fee and who pays it, one request.
      const before = strip(GLOBAL_POLICIES.payout);
      const after = {
        minimumAmount: Number(next.payout.minimumAmount),
        transferFee: Number(next.payout.transferFee),
        feePaidBy: next.payout.feePaidBy,
      };
      if (!(after.minimumAmount >= 0) || !(after.transferFee >= 0) || !['driver', 'shedrive'].includes(after.feePaidBy)) {
        return Promise.reject(new MockApiError('Check the payout settings.', 422));
      }
      if (after.feePaidBy === 'driver' && after.minimumAmount <= after.transferFee) {
        return Promise.reject(new MockApiError('When the driver pays the fee, the minimum payout must be more than the fee.', 422));
      }
      if (Object.keys(after).some((k) => String(after[k]) !== String(before[k]))) {
        changes.push(['payout_settings', 'payout-settings', 'Payout settings', before, after, { payout: after }]);
      }
    }
    const busy = changes.find(([type, id]) => pendingFor('policy', id, type));
    if (busy) {
      return Promise.reject(new MockApiError('A change to this setting is already awaiting approval.', 409));
    }
    const requests = changes.map(([type, id, label, before, after, payload]) =>
      createRequest(type, { kind: 'policy', id, label }, { before, after, payload }),
    );

    // Operating hours apply on save, with no approval (#6268), and are audited.
    if (next.operatingHours) {
      const before = { opensAt: GLOBAL_POLICIES.operatingHours.opensAt, closesAt: GLOBAL_POLICIES.operatingHours.closesAt };
      const after = { opensAt: next.operatingHours.opensAt, closesAt: next.operatingHours.closesAt };
      if (before.opensAt !== after.opensAt || before.closesAt !== after.closesAt) {
        Object.assign(GLOBAL_POLICIES.operatingHours, after, {
          updatedAt: Date.now(),
          updatedBy: actingAdmin().email,
        });
        makeAuditEntry('operating hours changed', 'policy', 'operating-hours', before, after);
      }
    }
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    const decorated = requests.map(decorateRequest);
    return respond({
      ok: true,
      pending: decorated.length > 0,
      requests: decorated,
      request: decorated[0] ?? null,
    });
  },

  // ── Driver balance ledger (#TBD-A / #1813) ──────────

  /**
   * Enum options the settlement and payout forms bind to. These are config,
   * not list rows, so ?state=empty must not null them out — every screen that
   * awaits this immediately before calling load() (balances.js,
   * rider-balances.js) would otherwise throw before its own ?state= handling
   * ever gets a chance to run.
   */
  getFinanceOptions() {
    const payload = {
      settlementMethods: SETTLEMENT_METHODS.slice(),
      payoutMethods: PAYOUT_METHODS.slice(),
      policy: structuredClone(GLOBAL_POLICIES.driverBalance),
    };
    return respond(payload, { emptyValue: payload, latency: 120 });
  },


  /**
   * #1813 list: drivers by balance position.
   * filter: 'owing' (default) | 'owed' | 'settled' | 'all'
   */
  listDriverBalances({ search = '', filter = 'owing', page = 1, pageSize = 20, sort = null } = {}) {
    const term = search.trim().toLowerCase();

    const rows = DRIVERS.filter((d) =>
      ['approved', 'suspended', 'pending_suspension'].includes(d.status),
    )
      .filter((d) => {
        if (filter === 'owing') return d.balance < 0;
        if (filter === 'owed') return d.balance > 0;
        if (filter === 'settled') return d.balance === 0;
        return true;
      })
      .filter((d) => !term || d.name.toLowerCase().includes(term) || d.phone.includes(term))
      .map((d) => {
        const entries = ledgerFor(d.id);
        const lastSettlement = entries.find((e) => e.type === 'settlement');
        return {
          id: d.id,
          name: d.name,
          phone: d.phone,
          status: d.status,
          // One signed balance per driver, never a pair (#1813).
          balance: d.balance,
          lastSettlementAt: lastSettlement ? lastSettlement.at : null,
          // The go-online gate reads the live balance (#TBD-F).
          goOnlineBlocked: isGoOnlineBlocked(d),
          // A settlement or payout awaiting another admin (maker-checker §1).
          pendingSettlement: Boolean(pendingFor('driver', d.id, 'settlement')),
          pendingPayout: Boolean(pendingFor('driver', d.id, 'payout')),
          hasPayoutMethod: Boolean(d.payoutMethod),
        };
      });

    // Most negative first — the drivers who owe the platform most.
    const sorted = sortRows(rows, sort, { key: 'balance', dir: 'asc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /** #1813 Scenario 2 — a driver's full, immutable transaction history. */
  getDriverLedger({ driverId, page = 1, pageSize = 20 } = {}) {
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    // Each payable entry carries its payout status and due date (§3).
    const entries = ledgerFor(driverId).map((e) => {
      const payoutStatus = entryPayoutStatus(e);
      return payoutStatus ? { ...e, payoutStatus, dueAt: dueAtOf(e) } : e;
    });
    const payload = {
      driver: {
        id: driver.id,
        name: driver.name,
        status: driver.status,
        balance: driver.balance,
        goOnlineBlocked: isGoOnlineBlocked(driver),
        payoutMethod: driver.payoutMethod
          ? { type: driver.payoutMethod.type, provider: driver.payoutMethod.provider, number: driver.payoutMethod.number, holderName: driver.payoutMethod.holderName }
          : null,
        lastPayoutFailure: driver.lastPayoutFailure ?? null,
        position: payoutPosition(driver),
        pendingSettlement: pendingSummary(pendingFor('driver', driver.id, 'settlement')),
        pendingPayout: pendingSummary(pendingFor('driver', driver.id, 'payout')),
      },
      ...paginate(entries, page, pageSize),
    };
    return respond(payload, { emptyValue: { ...payload, ...emptyPage(pageSize) } });
  },

  /**
   * #1813 Scenarios 3–7 — record cash received from a driver.
   * Posts a `settlement` credit; never edits the balance directly.
   */
  recordSettlement(driverId, { amount, date, method, note = '', proof = null } = {}) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return Promise.reject(new MockApiError('Enter a valid amount.', 422));
    }
    if (driver.balance >= 0) {
      return Promise.reject(new MockApiError('This driver has nothing outstanding to settle.', 409));
    }
    // A driver may hand back MORE than she owes (#3982, 2026-09-17) — the surplus
    // crosses zero and becomes an available balance. The sheet import (§4) is stricter.
    if (!method) return Promise.reject(new MockApiError('Select a settlement method.', 422));
    const { at, error } = resolveDate(date);
    if (error) return Promise.reject(new MockApiError(error, 422));
    if (pendingFor('driver', driver.id, 'settlement')) {
      return Promise.reject(new MockApiError('A settlement for this driver is already awaiting approval.', 409));
    }

    // Maker-checker (§1): nothing posts until another admin approves.
    const request = createRequest('settlement', { kind: 'driver', id: String(driver.id), label: driver.name }, {
      before: { balance: driver.balance },
      after: { balance: round2(driver.balance + value) },
      amount: value,
      payload: { driverId: String(driver.id), amount: value, at, method, note: note || 'Cash received from driver', proof: proof ?? null },
    });
    return respond({ ok: true, pending: true, request: decorateRequest(request), balance: driver.balance });
  },

  /**
   * Manual payout for one-off cases (§3) — Finance has already sent the money.
   * Becomes a `payout` request; on approval it posts the debit and pays her
   * oldest due entries first, up to the amount.
   */
  recordPayout(driverId, { amount, date, reference, proof = null } = {}) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    if (driver.balance <= 0) {
      return Promise.reject(new MockApiError('This driver has nothing available to pay out.', 409));
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return Promise.reject(new MockApiError('Enter a valid amount.', 422));
    }
    if (value > driver.balance) {
      return Promise.reject(new MockApiError('Amount must not exceed what the platform owes the driver.', 422));
    }
    if (!reference || !String(reference).trim()) {
      return Promise.reject(new MockApiError('Enter a payout reference.', 422));
    }
    const { at, error } = resolveDate(date);
    if (error) return Promise.reject(new MockApiError(error, 422));
    if (pendingFor('driver', driver.id, 'payout')) {
      return Promise.reject(new MockApiError('A payout for this driver is already awaiting approval.', 409));
    }

    const request = createRequest('payout', { kind: 'driver', id: String(driver.id), label: driver.name }, {
      before: { balance: driver.balance },
      after: { balance: round2(driver.balance - value) },
      amount: value,
      payload: { driverId: String(driver.id), amount: value, at, reference: String(reference).trim(), proof: proof ?? null },
    });
    return respond({ ok: true, pending: true, request: decorateRequest(request), balance: driver.balance });
  },

  // ── Rider fee ledger (financial core spec §2.2, FIN-11) ────

  /**
   * Riders with an outstanding cancellation fee.
   * filter: 'owing' (default) | 'all'
   */
  listRiderBalances({ search = '', filter = 'owing', page = 1, pageSize = 20, sort = null } = {}) {
    const term = search.trim().toLowerCase();

    const rows = RIDERS.filter((r) => {
      if (filter === 'owing') return r.outstanding > 0;
      if (filter === 'credit') return (r.balance ?? 0) > 0;
      return true;
    })
      .filter((r) => !term || r.name.toLowerCase().includes(term) || r.phone.includes(term))
      .map((r) => {
        const entries = riderLedgerFor(r.id);
        const lastFee = entries.find((e) => e.type === 'cancellation_fee');
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          status: r.status,
          balance: r.balance ?? 0,
          outstanding: r.outstanding ?? 0,
          credit: (r.balance ?? 0) > 0 ? r.balance : 0,
          lastFeeAt: lastFee ? lastFee.at : null,
        };
      });

    const sorted = sortRows(rows, sort, { key: 'outstanding', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /** A rider's full, immutable fee ledger — mirrors getDriverLedger. */
  getRiderLedger({ riderId, page = 1, pageSize = 20 } = {}) {
    const rider = RIDERS_BY_ID.get(String(riderId));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));

    // §5 — each fee says whether it was waived or has a waiver awaiting approval.
    const all = riderLedgerFor(riderId);
    const entries = all.map((e) => {
      if (e.type !== 'cancellation_fee') return e;
      const waived = all.some((w) => w.type === 'fee_waived' && w.reversesEntryId === e.id);
      const pending = APPROVALS.find((a) => a.status === 'pending' && a.type === 'fee_waiver' && a.payload.entryId === e.id);
      return { ...e, waived, waiverPending: pendingSummary(pending ?? null) };
    });
    const payload = {
      rider: {
        id: rider.id,
        name: rider.name,
        status: rider.status,
        balance: rider.balance ?? 0,
        outstanding: rider.outstanding ?? 0,
        // A waived fee she had already paid leaves a credit — shown, not spent, this phase.
        credit: (rider.balance ?? 0) > 0 ? rider.balance : 0,
      },
      ...paginate(entries, page, pageSize),
    };
    return respond(payload, { emptyValue: { ...payload, ...emptyPage(pageSize) } });
  },

  // ── Maker-checker (2026-10-14 spec §1) ──────────────

  /** The admin account behind the session, with its role (#6210). Sync. */
  getActingAdmin() {
    const admin = actingAdmin();
    return { email: admin.email, role: admin.role ?? null };
  },

  /** Sync lookup for the demo role switch: an account by email. */
  adminByEmail(email) {
    const admin = ADMINS.find((a) => a.email.toLowerCase() === String(email ?? '').toLowerCase());
    return admin ? { ...admin } : null;
  },

  /** Sync: active accounts, for the demo role switch in the top bar. */
  listActiveAdmins() {
    return ADMINS.filter((a) => a.status === 'active').map((a) => ({ email: a.email, role: a.role ?? null }));
  },

  /** Sync — the sidebar badge reads it on every render (ad-shell NAV_COUNTS). */
  pendingApprovalCount() {
    const me = actingAdmin();
    // #6212 — a Financial officer's count is her own pending requests.
    const ownOnly = me.role === 'fin_officer';
    return APPROVALS.filter((a) => a.status === 'pending' && (!ownOnly || a.maker === me.email)).length;
  },

  /**
   * status: 'pending' (default) | 'decided'. type: an APPROVAL_TYPES value or 'all'.
   * madeBy: 'all' | 'mine' (made by the acting admin) | 'others' (hers to decide).
   * area: an APPROVAL_AREAS key or 'all'.
   */
  listApprovals({ status = 'pending', madeBy = 'all', area = 'all', type = 'all', page = 1, pageSize = 20, sort = null } = {}) {
    const me = actingAdmin().email;
    // #6212 — a Financial officer sees only her own requests.
    if (actingAdmin().role === 'fin_officer') madeBy = 'mine';
    const areaTypes = APPROVAL_AREAS[area] ?? null;
    const rows = APPROVALS.filter((a) => (status === 'pending' ? a.status === 'pending' : a.status !== 'pending'))
      .filter((a) => madeBy === 'all' || (madeBy === 'mine' ? a.maker === me : a.maker !== me))
      .filter((a) => !areaTypes || areaTypes.includes(a.type))
      .filter((a) => type === 'all' || a.type === type)
      .map(decorateRequest);
    const key = status === 'pending' ? 'madeAt' : 'decidedAt';
    const sorted = sortRows(rows, sort, { key, dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  approvalTypes() {
    return APPROVAL_TYPES.slice();
  },

  approvalAreas() {
    return Object.keys(APPROVAL_AREAS);
  },

  getApproval(id) {
    const request = APPROVALS_BY_ID.get(String(id));
    if (!request) return respond(null, { emptyValue: null });
    const out = decorateRequest(request);
    // Enough context for the checker to decide without leaving the screen.
    if (request.subject.kind === 'batch') {
      const batch = PAYOUT_BATCHES_BY_ID.get(request.subject.id);
      if (batch) {
        out.batch = {
          id: batch.id,
          ref: batch.ref,
          status: batch.status,
          // `known`: the payee is a driver on file, so the review can link to her.
          lines: batch.lines.map((l) => ({ ...l, known: DRIVERS_BY_ID.has(String(l.driverId)) })),
          result: batch.result ?? null,
        };
      }
    }
    if (request.type === 'settlement_import') {
      const imp = SETTLEMENT_IMPORTS.find((i) => i.id === request.payload.importId);
      if (imp) out.import = structuredClone(imp);
    }
    return respond(out, { emptyValue: null });
  },

  approveRequest(id) {
    const refused = refusedFor('finance.approve');
    if (refused) return refused;
    const request = APPROVALS_BY_ID.get(String(id));
    if (!request) return Promise.reject(new MockApiError('Request not found.', 404));
    if (request.status !== 'pending') {
      return Promise.reject(new MockApiError('This request has already been decided.', 409));
    }
    const actor = actingAdmin();
    if (request.maker === actor.email) {
      return Promise.reject(new MockApiError('You made this request, so another Financial lead must approve it.', 403));
    }
    EXECUTE[request.type]?.(request);
    patchApproval(request, { status: 'approved', checker: actor.email, decidedAt: Date.now() });
    addAuditEntry('approval approved', request.subject.kind, request.subject.id, { status: 'pending' }, { request: request.id, status: 'approved' }, Date.now());
    return respond({ ok: true, request: decorateRequest(request) });
  },

  rejectRequest(id, reason) {
    const refused = refusedFor('finance.approve');
    if (refused) return refused;
    const request = APPROVALS_BY_ID.get(String(id));
    if (!request) return Promise.reject(new MockApiError('Request not found.', 404));
    if (request.status !== 'pending') {
      return Promise.reject(new MockApiError('This request has already been decided.', 409));
    }
    const actor = actingAdmin();
    if (request.maker === actor.email) {
      return Promise.reject(new MockApiError('You made this request, so another Financial lead must decide it.', 403));
    }
    const text = String(reason ?? '').trim();
    if (text.length < 10 || text.length > 500) {
      return Promise.reject(new MockApiError('Give a reason of 10–500 characters.', 422));
    }
    ON_REJECT[request.type]?.(request);
    patchApproval(request, { status: 'rejected', checker: actor.email, decidedAt: Date.now(), rejectReason: text });
    addAuditEntry('approval rejected', request.subject.kind, request.subject.id, { status: 'pending' }, { request: request.id, status: 'rejected', reason: text }, Date.now());
    return respond({ ok: true, request: decorateRequest(request) });
  },

  // ── Driver payout method (§2) ───────────────────────

  getPayoutOptions() {
    const payload = {
      payoutTypes: PAYOUT_TYPES.slice(),
      walletProviders: WALLET_PROVIDERS.slice(),
      banks: BANKS.slice(),
      settlementChannels: SETTLEMENT_CHANNELS.slice(),
      holdDays: PAYOUT_HOLD_DAYS,
    };
    return respond(payload, { emptyValue: payload, latency: 120 });
  },

  /** The driver's payout method (number in full), last failure, and any pending admin edit. */
  getDriverPayout(driverId) {
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));
    const m = driver.payoutMethod;
    return respond({
      method: m ? { type: m.type, provider: m.provider, holderName: m.holderName, number: m.number, updatedAt: m.updatedAt, updatedBy: m.updatedBy } : null,
      lastFailure: driver.lastPayoutFailure ?? null,
      pendingChange: pendingSummary(pendingFor('driver', driver.id, 'payout_method')),
      position: payoutPosition(driver),
    }, { emptyValue: { method: null, lastFailure: null, pendingChange: null, position: { due: 0, onHold: 0, inBatch: 0, sent: 0 } } });
  },

  /** An admin editing it on her behalf is a request (§2); her own change in the app is not. */
  requestPayoutMethodChange(driverId, method) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));
    const clean = {
      type: method?.type,
      provider: method?.type === 'PREPAID_CARD' ? null : method?.provider ?? null,
      holderName: String(method?.holderName ?? driver.name).trim(),
      number: String(method?.number ?? '').replace(/\s+/g, '').toUpperCase(),
    };
    const error = validatePayoutMethod(clean);
    if (error) return Promise.reject(new MockApiError(error, 422));
    if (pendingFor('driver', driver.id, 'payout_method')) {
      return Promise.reject(new MockApiError('A payout method change for this driver is already awaiting approval.', 409));
    }
    const m = driver.payoutMethod;
    const request = createRequest('payout_method', { kind: 'driver', id: String(driver.id), label: driver.name }, {
      // The review diffs every field of the method, so both sides carry all four.
      before: m ? { type: m.type, provider: m.provider ?? '—', number: m.number, holderName: m.holderName } : {},
      after: { type: clean.type, provider: clean.provider ?? '—', number: clean.number, holderName: clean.holderName },
      payload: { driverId: String(driver.id), method: clean },
    });
    return respond({ ok: true, pending: true, request: decorateRequest(request) });
  },

  // ── Payout batches (§3) ─────────────────────────────

  /**
   * Who a batch generated now would pay. Drivers who owe SheDrive are left out —
   * they settle instead — and so is a line below the minimum payout, whose
   * earnings stay Due for a later batch (2026-10-29).
   */
  previewPayoutBatch() {
    const now = Date.now();
    const settings = payoutSettings();
    const lines = [];
    const below = [];
    DRIVERS.filter((d) => ['approved', 'suspended', 'pending_suspension'].includes(d.status)).forEach((driver) => {
      const due = ledgerFor(driver.id).filter((e) => entryPayoutStatus(e, now) === 'due');
      const dueNet = round2(due.reduce((t, e) => t + e.amount, 0));
      if (dueNet <= 0) return;
      if (driver.balance <= 0 || !driver.payoutMethod) return;
      // Her whole due net up to the cut-off — not capped by her balance (2026-10-29).
      const amount = dueNet;
      if (amount < settings.minimumAmount) {
        below.push(amount);
        return;
      }
      const fee = settings.transferFee;
      lines.push({
        driverId: String(driver.id),
        driverName: driver.name,
        nationalId: driver.nid,
        phone: `0${driver.phone}`,
        dueNet,
        balance: driver.balance,
        payoutType: driver.payoutMethod.type,
        provider: driver.payoutMethod.provider,
        number: driver.payoutMethod.number,
        amount,
        fee,
        feePaidBy: settings.feePaidBy,
        transferAmount: round2(settings.feePaidBy === 'driver' ? amount - fee : amount),
        entryIds: due.map((e) => e.id),
      });
    });
    lines.sort((a, b) => b.amount - a.amount);
    const sum = (list, key) => round2(list.reduce((t, l) => t + l[key], 0));
    const payload = {
      lines,
      count: lines.length,
      total: sum(lines, 'amount'),
      feeTotal: sum(lines, 'fee'),
      transferTotal: sum(lines, 'transferAmount'),
      byType: PAYOUT_TYPES.map((type) => ({ type, count: lines.filter((l) => l.payoutType === type).length })).filter((g) => g.count),
      belowMinimum: { count: below.length, total: round2(below.reduce((t, a) => t + a, 0)) },
      settings,
      cutoffDay: payoutCutoffDay(now),
    };
    return respond(payload, {
      emptyValue: { lines: [], count: 0, total: 0, feeTotal: 0, transferTotal: 0, byType: [], belowMinimum: { count: 0, total: 0 }, settings, cutoffDay: payoutCutoffDay(now) },
    });
  },

  /** 2026-10-29 — no approval: the batch is Ready to export as soon as it is generated. */
  createPayoutBatch() {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const now = Date.now();
    const settings = payoutSettings();
    const drivers = DRIVERS.filter((d) => ['approved', 'suspended', 'pending_suspension'].includes(d.status));
    const ref = makeBatchRef(now);
    const lines = [];
    drivers.forEach((driver) => {
      const due = ledgerFor(driver.id).filter((e) => entryPayoutStatus(e, now) === 'due');
      const dueNet = round2(due.reduce((t, e) => t + e.amount, 0));
      if (dueNet <= 0 || driver.balance <= 0 || !driver.payoutMethod) return;
      const amount = dueNet;
      if (amount < settings.minimumAmount) return;
      lines.push(makeLine(driver, ref, lines.length + 1, amount, due.map((e) => e.id), settings));
    });
    if (!lines.length) {
      return Promise.reject(new MockApiError('No driver is due a payout right now.', 409));
    }
    const total = round2(lines.reduce((t, l) => t + l.amount, 0));
    const batch = {
      id: ref,
      ref,
      status: 'ready',
      createdAt: now,
      createdBy: actingAdmin().email,
      exportedAt: null,
      exportedBy: null,
      resultImportedAt: null,
      resultImportedBy: null,
      completedAt: null,
      // The settings it was generated under; a later change doesn't touch it.
      settings,
      // Its cut-off line: earnings up to the end of this day (7 days before it was generated).
      cutoffDay: payoutCutoffDay(now),
      parts: Object.fromEntries(PAYOUT_TYPES.filter((type) => lines.some((l) => l.payoutType === type)).map((type) => [type, { status: 'ready' }])),
      lines,
    };
    PAYOUT_BATCHES.unshift(batch);
    PAYOUT_BATCHES_BY_ID.set(batch.id, batch);
    recordAdded('batchesAdded', batch);
    addAuditEntry('payout batch generated', 'batch', batch.id, null, { status: 'ready', lines: lines.length, total }, now);
    return respond({ ok: true, batch: { id: batch.id, ref: batch.ref } });
  },

  /** status: 'all' | a batch status. */
  listPayoutBatches({ status = 'all', page = 1, pageSize = 20, sort = null } = {}) {
    const rows = PAYOUT_BATCHES.filter((b) => status === 'all' || b.status === status).map((b) => ({
      id: b.id,
      ref: b.ref,
      status: b.status,
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      lineCount: b.lines.length,
      total: round2(b.lines.reduce((t, l) => t + l.amount, 0)),
      paidCount: b.lines.filter((l) => l.status === 'paid').length,
      failedCount: b.lines.filter((l) => l.status === 'failed').length,
      exportedAt: b.exportedAt,
      completedAt: b.completedAt,
    }));
    const sorted = sortRows(rows, sort, { key: 'createdAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  getPayoutBatch(id) {
    const batch = PAYOUT_BATCHES_BY_ID.get(String(id));
    if (!batch) return respond(null, { emptyValue: null });
    const requests = APPROVALS.filter((a) => a.subject.kind === 'batch' && a.subject.id === batch.id).map(decorateRequest);
    const sum = (list, fn) => round2(list.reduce((t, l) => t + fn(l), 0));
    // One file per payout method, each with its own result (2026-10-29).
    const files = batchTypes(batch).map((type) => {
      const lines = batch.lines.filter((l) => l.payoutType === type);
      const part = batch.parts?.[type] ?? {};
      const forType = requests.filter((r) => r.type === 'payout_result' && (r.payload?.payoutType ?? type) === type)
        .sort((a, b) => (b.madeAt ?? 0) - (a.madeAt ?? 0));
      return {
        type,
        fileName: `${batch.ref}-${FILE_SLUG[type]}.csv`,
        status: partStatus(batch, type),
        lineCount: lines.length,
        total: sum(lines, (l) => l.amount),
        feeTotal: sum(lines, (l) => l.fee ?? 0),
        transferTotal: sum(lines, transferAmountOf),
        paidCount: lines.filter((l) => l.status === 'paid').length,
        failedCount: lines.filter((l) => l.status === 'failed').length,
        importedAt: part.importedAt ?? null,
        importedBy: part.importedBy ?? null,
        request: forType[0] ?? null,
      };
    });
    return respond({
      ...structuredClone(batch),
      lines: batch.lines.map((l) => ({ ...l, transferAmount: transferAmountOf(l) })),
      total: round2(batch.lines.reduce((t, l) => t + l.amount, 0)),
      paidTotal: round2(batch.lines.filter((l) => l.status === 'paid').reduce((t, l) => t + l.amount, 0)),
      files,
      requests,
    }, { emptyValue: null });
  },

  /**
   * The bank files (§3, 2026-10-29): one per payout method. The first export of
   * a Ready to export batch moves it to Sent to bank; later downloads are copies.
   * `type` downloads one method's file only.
   */
  exportPayoutBatch(id, type = null) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const batch = PAYOUT_BATCHES_BY_ID.get(String(id));
    if (!batch) return Promise.reject(new MockApiError('Batch not found.', 404));
    if (batch.status === 'ready') {
      const now = Date.now();
      batch.lines.forEach((l) => { l.status = 'sent'; });
      batch.parts = Object.fromEntries(batchTypes(batch).map((t) => [t, { status: 'sent' }]));
      patchBatch(batch, { status: 'sent_to_bank', parts: batch.parts, exportedAt: now, exportedBy: actingAdmin().email });
      addAuditEntry('payout batch exported', 'batch', batch.id, { status: 'ready' }, { status: 'sent_to_bank', lines: batch.lines.length, files: batchTypes(batch).length }, now);
    }
    const files = batchTypes(batch).filter((t) => !type || t === type).map((t) => ({
      payoutType: t,
      fileName: `${batch.ref}-${FILE_SLUG[t]}.csv`,
      csv: toCsv(FILE_HEADERS[t], batch.lines.filter((l) => l.payoutType === t).map((l) => exportRow(batch, l))),
    }));
    return respond({ ok: true, files, status: batch.status });
  },

  /**
   * Demo helper: one method's result file as its channel would return it —
   * every line SUCCESS but the last. Without `type`, the first file still awaited.
   */
  buildSampleResult(id, type = null) {
    const batch = PAYOUT_BATCHES_BY_ID.get(String(id));
    if (!batch) return Promise.reject(new MockApiError('Batch not found.', 404));
    const forType = type ?? batchTypes(batch).find((t) => partStatus(batch, t) === 'sent');
    if (!forType) return Promise.reject(new MockApiError('Every file of this batch already has a result.', 409));
    const lines = batch.lines.filter((l) => l.payoutType === forType);
    const rows = lines.map((l, i) => {
      const failed = lines.length > 1 && i === lines.length - 1;
      return {
        ...exportRow(batch, l),
        status: failed ? 'FAILED' : 'SUCCESS',
        bank_reference: failed ? '' : `BNK${String(10000000 + Math.floor(Math.random() * 89999999))}`,
        failure_reason: failed ? FAILURE_REASONS[forType] : '',
      };
    });
    return respond({ csv: toCsv([...FILE_HEADERS[forType], ...RESULT_COLUMNS], rows), fileName: `${batch.ref}-${FILE_SLUG[forType]}-result.csv`, payoutType: forType });
  },

  /**
   * A result file returned for one method's bank file (§3, 2026-10-29). Its
   * lines must all belong to that one file, and every line of that file must
   * appear exactly once with SUCCESS or FAILED. A valid file becomes a
   * `payout_result` request for that method.
   */
  importPayoutResult(id, csvText) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const batch = PAYOUT_BATCHES_BY_ID.get(String(id));
    if (!batch) return Promise.reject(new MockApiError('Batch not found.', 404));
    if (!['sent_to_bank', 'result_pending'].includes(batch.status)) {
      return Promise.reject(new MockApiError('A result can only be imported for a batch that was sent to the bank.', 409));
    }
    const { headers, rows } = parseCsv(csvText);
    const missingCols = ['line_ref', 'status'].filter((h) => !headers.includes(h));
    if (missingCols.length) {
      return validationError('The file is missing required columns.', missingCols.map((c) => ({ code: 'missing_column', column: c })));
    }
    // The file's method is the method of its first known line.
    const type = rows.map((r) => batch.lines.find((l) => l.lineRef === r.line_ref)).find(Boolean)?.payoutType ?? null;
    if (type && partStatus(batch, type) !== 'sent') {
      return Promise.reject(new MockApiError('This file already has a result. Import the result of a file still waiting for one.', 409));
    }
    const errors = [];
    const seen = new Set();
    const result = [];
    rows.forEach((row, i) => {
      const rowNo = i + 2;
      const line = batch.lines.find((l) => l.lineRef === row.line_ref);
      const status = String(row.status).toUpperCase();
      if (!line) errors.push({ code: 'unknown_line', rowNo, lineRef: row.line_ref });
      else if (line.payoutType !== type) errors.push({ code: 'other_file', rowNo, lineRef: row.line_ref });
      else if (seen.has(row.line_ref)) errors.push({ code: 'duplicate_line', rowNo, lineRef: row.line_ref });
      else if (!['SUCCESS', 'FAILED'].includes(status)) errors.push({ code: 'bad_status', rowNo, lineRef: row.line_ref, value: row.status });
      else {
        seen.add(row.line_ref);
        result.push({ lineRef: row.line_ref, status, bankReference: row.bank_reference || null, failureReason: row.failure_reason || null });
      }
    });
    batch.lines.filter((l) => l.payoutType === type && !seen.has(l.lineRef) && !errors.some((e) => e.lineRef === l.lineRef)).forEach((l) => {
      errors.push({ code: 'missing_line', lineRef: l.lineRef });
    });
    if (!type && !errors.length) errors.push({ code: 'unknown_line', rowNo: 2, lineRef: '' });
    if (errors.length) return validationError('The result file does not match this batch.', errors);

    const now = Date.now();
    const success = result.filter((r) => r.status === 'SUCCESS');
    const amount = round2(success.reduce((t, r) => t + batch.lines.find((l) => l.lineRef === r.lineRef).amount, 0));
    batch.result = [...(batch.result ?? []), ...result];
    batch.parts = { ...(batch.parts ?? {}), [type]: { status: 'result_pending', importedAt: now, importedBy: actingAdmin().email } };
    patchBatch(batch, { resultImportedAt: now, resultImportedBy: actingAdmin().email });
    settleBatchStatus(batch, now);
    addAuditEntry('payout result imported', 'batch', batch.id, { file: type, status: 'sent' }, { file: type, status: 'result_pending', success: success.length, failed: result.length - success.length }, now);
    const request = createRequest('payout_result', { kind: 'batch', id: batch.id, label: batch.ref }, {
      after: { success: success.length, failed: result.length - success.length },
      amount,
      payload: { batchId: batch.id, payoutType: type },
    });
    return respond({ ok: true, request: decorateRequest(request), payoutType: type, success: success.length, failed: result.length - success.length });
  },

  // ── Settlement import (§4) ──────────────────────────

  getSettlementTemplate() {
    const example = {
      national_id: '29801011234567',
      driver_name: 'Mona Adel',
      phone_number: '01012345678',
      amount_egp: '245.50',
      payment_date: localDay(),
      payment_channel: 'Bank transfer',
      payment_reference: 'FT123456789',
    };
    return respond({ csv: toCsv(SETTLEMENT_HEADERS, [example]), fileName: 'shedrive-settlement-template.csv', headers: SETTLEMENT_HEADERS.slice() });
  },

  /**
   * Demo helper: Finance's sheet lists only payments that already went
   * through. One paid in full, one paid part, one paid more, one paid while
   * owing nothing. `kind`:
   *   'clean'    — just those four rows: passes both checks and can be sent;
   *   'format'   — the same rows with one of each format mistake (fails step 2);
   *   'business' — well formed, plus an unknown national ID, a reference
   *                already imported, a future date and a phone that is not
   *                the driver's (fails step 3).
   */
  buildSampleSettlementSheet(kind = 'business') {
    const today = localDay();
    const ref = () => `FT${String(100000000 + Math.floor(Math.random() * 899999999))}`;
    const owing = DRIVERS.filter((d) => d.balance < 0).slice(0, 3);
    const clear = DRIVERS.find((d) => ['approved', 'suspended'].includes(d.status) && d.balance >= 0);
    const row = (d, amount, channel) => ({
      national_id: d.nid,
      driver_name: d.name,
      phone_number: `0${d.phone}`,
      amount_egp: amount.toFixed(2),
      payment_date: today,
      payment_channel: channel,
      payment_reference: ref(),
    });
    const rows = [];
    if (owing[0]) rows.push(row(owing[0], -owing[0].balance, 'Bank transfer'));
    if (owing[1]) rows.push(row(owing[1], Math.floor(-owing[1].balance / 2), 'Fawry'));
    if (owing[2]) rows.push(row(owing[2], -owing[2].balance + 50, 'Mobile wallet'));
    if (clear) rows.push(row(clear, 75, 'Field agent'));
    if (kind === 'format' && rows.length >= 4) {
      rows[0].amount_egp = `${rows[0].amount_egp} EGP`;
      rows[0].phone_number = rows[0].phone_number.slice(1);
      rows[1].payment_date = today.split('-').reverse().join('/');
      rows[2].national_id = rows[2].national_id.slice(0, 12);
      rows[3].payment_channel = 'Cash';
    } else if (kind === 'business') {
      rows.push({ national_id: '29912319999999', driver_name: 'Unknown driver', phone_number: '01098765432', amount_egp: '120.00', payment_date: today, payment_channel: 'Bank transfer', payment_reference: ref() });
      const used = LEDGER_ENTRIES.find((e) => e.type === 'settlement' && e.paymentRef);
      if (used && owing[0]) {
        rows.push({ ...row(owing[0], 60, 'Bank transfer'), payment_reference: used.paymentRef });
      }
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (owing[1]) rows.push({ ...row(owing[1], 20, 'Fawry'), payment_date: localDay(tomorrow) });
      if (owing[2]) rows.push({ ...row(owing[2], 30, 'Mobile wallet'), phone_number: '01000000000' });
    }
    return respond({ csv: toCsv(SETTLEMENT_HEADERS, rows), fileName: `finance-settlements-${today}.csv` });
  },

  /**
   * #5620 step 2 — is the file the template, and is every cell written as the
   * template says? Rejects (422) with every problem in `details`; otherwise
   * returns the row count. Reads nothing about drivers; nothing is stored.
   */
  validateSettlementSheet(csvText) {
    const { headers, rows, issues } = settlementFormatIssues(csvText);
    if (issues.length) {
      return validationError('The sheet does not match the template.', issues).catch((err) => {
        err.sheet = { headers: headers.filter((h) => h !== SETTLEMENT_ERRORS_COLUMN), rows };
        throw err;
      });
    }
    return respond({ total: rows.length });
  },

  /**
   * #5620 step 3 — the business check, run on a sheet that passed step 2
   * (re-checked here so a bad file never gets this far). Every row is a
   * payment that already went through, so any amount is applied: less than
   * she owes settles part of it, more than she owes leaves the extra on her
   * balance. A row fails when its national ID matches no driver, its payment
   * phone number is not the driver's registered phone, its payment reference
   * was already imported or repeats in this file, or its payment date is in
   * the future. **One failed row rejects the whole file**
   * (`accepted: false`): nothing from it can be sent, and Finance uploads the
   * corrected file again. Nothing is stored here.
   */
  checkSettlementSheet(csvText) {
    const { rows, issues } = settlementFormatIssues(csvText);
    if (issues.length) return validationError('The sheet does not match the template.', issues);

    const usedRefs = new Set(LEDGER_ENTRIES.filter((e) => e.paymentRef).map((e) => e.paymentRef));
    SETTLEMENT_IMPORTS.filter((i) => i.status === 'pending').forEach((i) => i.rows.forEach((r) => usedRefs.add(r.paymentRef)));
    const fileRefs = new Set();
    // Two rows for the same driver in one sheet both apply, one after the other.
    const running = new Map();

    const checked = rows.map((row, i) => {
      const driver = DRIVERS.find((d) => d.nid === row.national_id);
      const amount = round2(Number(row.amount_egp));
      const out = {
        rowNo: i + 1,
        nationalId: row.national_id,
        driverName: row.driver_name,
        phone: row.phone_number,
        driverId: driver ? String(driver.id) : null,
        systemName: driver ? driver.name : null,
        amount: Number.isFinite(amount) ? amount : null,
        balanceBefore: null,
        balanceAfter: null,
        outcome: null,
        paymentDate: row.payment_date,
        channel: row.payment_channel,
        paymentRef: row.payment_reference,
        status: 'ready',
      };
      // #5620 business rules, first failure wins.
      if (!driver) out.status = 'unknown_driver';
      // Driver phones are stored without the leading 0 (seed), written 01… in files.
      else if (row.phone_number !== `0${driver.phone}`) out.status = 'phone_mismatch';
      else if (usedRefs.has(row.payment_reference)) out.status = 'duplicate';
      else if (fileRefs.has(row.payment_reference)) out.status = 'repeated_in_file';
      else if (row.payment_date > localDay()) out.status = 'future_date';
      fileRefs.add(row.payment_reference);
      if (driver) {
        const before = running.has(driver.id) ? running.get(driver.id) : driver.balance;
        out.balanceBefore = before;
        if (out.status === 'ready') {
          const after = round2(before + (out.amount ?? 0));
          out.balanceAfter = after;
          // full: she owed and now owes nothing · partial: she still owes · credit: the extra sits on her balance
          out.outcome = Math.abs(after) < 0.005 ? 'full' : after < 0 ? 'partial' : 'credit';
          running.set(driver.id, after);
        }
      }
      return out;
    });
    const ready = checked.filter((r) => r.status === 'ready');
    return respond({
      rows: checked,
      total: checked.length,
      readyCount: ready.length,
      failedCount: checked.length - ready.length,
      accepted: ready.length === checked.length,
      // What the file would apply once approved; meaningful only when accepted.
      amount: round2(checked.reduce((t, r) => t + (r.amount ?? 0), 0)),
    });
  },

  /** Submit a whole accepted file as one `settlement_import` request. */
  submitSettlementImport({ fileName = 'settlements.csv', rows = [] } = {}) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    if (!rows.length) return Promise.reject(new MockApiError('The file has no rows to import.', 422));
    // All or nothing (#5620): a file with any failed row is never sent.
    if (rows.some((r) => r.status !== 'ready')) {
      return Promise.reject(new MockApiError('The file was rejected by the business check. Fix it and upload the whole file again.', 422));
    }
    const ready = rows;
    const imp = {
      id: nextImportId(),
      fileName,
      status: 'pending',
      createdAt: Date.now(),
      createdBy: actingAdmin().email,
      decidedAt: null,
      decidedBy: null,
      totalRows: rows.length,
      readyRows: ready.length,
      rows: ready.map((r) => ({ ...r, receipt: null })),
      amount: round2(ready.reduce((t, r) => t + r.amount, 0)),
    };
    SETTLEMENT_IMPORTS.unshift(imp);
    recordAdded('importsAdded', imp);
    const request = createRequest('settlement_import', { kind: 'import', id: imp.id, label: fileName }, {
      after: { rows: ready.length },
      amount: imp.amount,
      payload: { importId: imp.id },
    });
    return respond({ ok: true, import: { id: imp.id }, request: decorateRequest(request) });
  },

  listSettlementImports({ page = 1, pageSize = 20, sort = null } = {}) {
    const rows = SETTLEMENT_IMPORTS.map((i) => ({
      id: i.id,
      fileName: i.fileName,
      status: i.status,
      createdAt: i.createdAt,
      createdBy: i.createdBy,
      decidedAt: i.decidedAt,
      decidedBy: i.decidedBy,
      totalRows: i.totalRows,
      readyRows: i.readyRows,
      amount: i.amount,
    }));
    const sorted = sortRows(rows, sort, { key: 'createdAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /** The approval request behind a subject (batch / import / driver …), newest first, or null. */
  findRequestFor(kind, id, type = null) {
    const r = APPROVALS.find((a) => a.subject.kind === kind && a.subject.id === String(id) && (!type || a.type === type));
    return r ? decorateRequest(r) : null;
  },

  getSettlementImport(id) {
    const imp = SETTLEMENT_IMPORTS.find((i) => i.id === String(id));
    return respond(imp ? structuredClone(imp) : null, { emptyValue: null });
  },

  // ── Fee waiver (§5) ─────────────────────────────────

  requestFeeWaiver(riderId, entryId, reason) {
    const refused = refusedFor('finance.request');
    if (refused) return refused;
    const rider = RIDERS_BY_ID.get(String(riderId));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));
    const fee = RIDER_LEDGER_ENTRIES.find((e) => e.id === entryId && e.riderId === String(riderId));
    if (!fee || fee.type !== 'cancellation_fee') {
      return Promise.reject(new MockApiError('Only a cancellation fee can be waived.', 422));
    }
    if (RIDER_LEDGER_ENTRIES.some((e) => e.type === 'fee_waived' && e.reversesEntryId === fee.id)) {
      return Promise.reject(new MockApiError('This fee has already been waived.', 409));
    }
    if (APPROVALS.some((a) => a.status === 'pending' && a.type === 'fee_waiver' && a.payload.entryId === fee.id)) {
      return Promise.reject(new MockApiError('A waiver for this fee is already awaiting approval.', 409));
    }
    const text = String(reason ?? '').trim();
    if (text.length < 10 || text.length > 500) {
      return Promise.reject(new MockApiError('Give a reason of 10–500 characters.', 422));
    }
    const request = createRequest('fee_waiver', { kind: 'rider', id: String(rider.id), label: rider.name }, {
      before: { fee: -fee.amount },
      after: { fee: 0 },
      amount: -fee.amount,
      payload: { riderId: String(rider.id), entryId: fee.id, tripId: fee.tripId, reason: text },
    });
    return respond({ ok: true, pending: true, request: decorateRequest(request) });
  },

  // ── Settlement export (financial core spec §5, §10) ───
  // The settlement day-book screen was cut deliberately to keep Phase 1
  // simple (spec §10) — a CSV export on balances.html is the one part of it
  // worth keeping. This returns every settlement entry, unpaginated, for
  // that export; it is not a list-screen endpoint.

  listSettlementEntries() {
    const rows = LEDGER_ENTRIES.filter((e) => e.type === 'settlement')
      .map((e) => {
        const driver = DRIVERS_BY_ID.get(e.driverId);
        return { ...e, driverName: driver ? driver.name : e.driverId };
      })
      .sort((a, b) => b.at - a.at);
    return respond(rows, { emptyValue: [] });
  },

  // ── Reports (#1832, #1833) ──────────────────────────

  getRevenueSummary({ from = '', to = '', zoneId = 'all' } = {}) {
    const completed = TRIPS.filter(
      (t) =>
        t.status === 'completed' &&
        inDateRange(t.createdAt, from, to) &&
        (zoneId === 'all' || String(t.zoneId) === String(zoneId)),
    );

    const grossFares = round2(completed.reduce((sum, t) => sum + t.fare.total, 0));
    const commission = round2(completed.reduce((sum, t) => sum + t.fare.commission, 0));
    const netDriverEarnings = round2(grossFares - commission);

    // Cancellation fees are charged per the originating zone's rate card.
    const cancellationFees = round2(
      TRIPS.filter(
        (t) =>
          t.status === 'expired' &&
          t.expiryReason === 'system_timeout' &&
          inDateRange(t.createdAt, from, to) &&
          (zoneId === 'all' || String(t.zoneId) === String(zoneId)),
      ).reduce((sum, t) => {
        const zone = ZONES_BY_ID.get(String(t.zoneId));
        return sum + (zone?.rateCard?.cancellationFee ?? 0);
      }, 0),
    );

    // Financial core spec §7.3 — collected vs. owed. Commission is earned the
    // moment a trip completes regardless of custody; "settled" is the portion
    // Finance has actually recovered via a settlement in this period; the
    // outstanding figure is the live, platform-wide snapshot of what every
    // driver still owes right now (a balance is a position, not a period).
    const commissionSettled = round2(
      LEDGER_ENTRIES.filter((e) => e.type === 'settlement' && inDateRange(e.at, from, to)).reduce(
        (sum, e) => sum + e.amount,
        0,
      ),
    );
    const outstandingCommission = round2(DRIVERS.reduce((sum, d) => sum + (d.outstanding ?? 0), 0));

    const summary = {
      completedTrips: completed.length,
      grossFares,
      commission,
      cancellationFees,
      netDriverEarnings,
      commissionEarned: commission,
      commissionSettled,
      outstandingCommission,
      zoneId,
      from,
      to,
    };

    return respond(summary, {
      emptyValue: {
        completedTrips: 0,
        grossFares: 0,
        commission: 0,
        cancellationFees: 0,
        netDriverEarnings: 0,
        commissionEarned: 0,
        commissionSettled: 0,
        outstandingCommission,
        zoneId,
        from,
        to,
      },
    });
  },

  getDriverSettlement({ driverId, from = '', to = '', page = 1, pageSize = 20 } = {}) {
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const trips = TRIPS.filter(
      (t) =>
        t.status === 'completed' &&
        String(t.driverId) === String(driverId) &&
        inDateRange(t.createdAt, from, to),
    ).sort((a, b) => b.createdAt - a.createdAt);

    const grossFares = round2(trips.reduce((sum, t) => sum + t.fare.total, 0));
    const commission = round2(trips.reduce((sum, t) => sum + t.fare.commission, 0));
    // Custody decides the ledger entry — never paymentMethod (spec §1).
    const cashPortion = round2(
      trips.filter((t) => t.custody === 'driver').reduce((sum, t) => sum + t.fare.total, 0),
    );

    // Who holds the fare decides what a trip means for her balance (spec §1):
    // driver-held — she has the fare and owes the commission; platform-held —
    // SheDrive has it and owes her the net, paid out after the 7-day hold.
    const entries = ledgerFor(driverId);
    const earningFor = (tripId) => entries.find((e) => e.type === 'trip_earnings' && e.tripId === tripId);
    const driverHeld = trips.filter((t) => t.custody === 'driver');
    const platformHeld = trips.filter((t) => t.custody !== 'driver');
    const owedByStatus = {};
    platformHeld.forEach((t) => {
      const e = earningFor(t.id);
      const status = (e && entryPayoutStatus(e)) || 'on_hold';
      owedByStatus[status] = round2((owedByStatus[status] ?? 0) + t.fare.netEarnings);
    });
    const custody = {
      driver: {
        trips: driverHeld.length,
        fares: round2(driverHeld.reduce((s, t) => s + t.fare.total, 0)),
        commissionOwed: round2(driverHeld.reduce((s, t) => s + t.fare.commission, 0)),
      },
      platform: {
        trips: platformHeld.length,
        fares: round2(platformHeld.reduce((s, t) => s + t.fare.total, 0)),
        netOwed: round2(platformHeld.reduce((s, t) => s + t.fare.netEarnings, 0)),
        byPayoutStatus: owedByStatus,
      },
    };

    // Her balance for the period, from the ledger: opening + every movement = closing.
    // The closing balance is what her ledger shows at the end of the period.
    const before = from ? entries.filter((e) => !inDateRange(e.at, from, '') ) : [];
    const within = entries.filter((e) => inDateRange(e.at, from, to));
    const opening = round2(before.reduce((s, e) => s + e.amount, 0));
    const byType = new Map();
    within.forEach((e) => {
      const m = byType.get(e.type) ?? { type: e.type, count: 0, amount: 0 };
      m.count += 1;
      m.amount = round2(m.amount + e.amount);
      byType.set(e.type, m);
    });
    const ORDER = ['trip_commission', 'trip_earnings', 'driver_cancellation_fee', 'rider_cancellation_fee_credit', 'rider_fee_recovery', 'fee_credit_reversed', 'settlement', 'payout'];
    const movements = [...byType.values()].sort((x, y) => ORDER.indexOf(x.type) - ORDER.indexOf(y.type));
    const closing = round2(opening + within.reduce((s, e) => s + e.amount, 0));
    const balance = { opening, movements, closing, toNow: !to, current: driver.balance };

    const rows = trips.map((t) => {
      const e = t.custody === 'driver' ? null : earningFor(t.id);
      return { ...t, heldBy: t.custody === 'driver' ? 'driver' : 'platform', payoutStatus: e ? entryPayoutStatus(e) : null };
    });

    const payload = {
      driver: { id: driver.id, name: driver.name, status: driver.status },
      totals: {
        completedTrips: trips.length,
        grossFares,
        commission,
        netEarnings: round2(grossFares - commission),
        cashPortion,
        digitalPortion: round2(grossFares - cashPortion),
        outstandingCashBalance: driver.cashBalance,
      },
      custody,
      balance,
      ...paginate(rows, page, pageSize),
    };

    return respond(payload, {
      emptyValue: {
        driver: { id: driver.id, name: driver.name, status: driver.status },
        totals: {
          completedTrips: 0,
          grossFares: 0,
          commission: 0,
          netEarnings: 0,
          cashPortion: 0,
          digitalPortion: 0,
          outstandingCashBalance: driver.cashBalance,
        },
        custody: { driver: { trips: 0, fares: 0, commissionOwed: 0 }, platform: { trips: 0, fares: 0, netOwed: 0, byPayoutStatus: {} } },
        balance: { opening: 0, movements: [], closing: 0, toNow: true, current: driver.balance },
        ...emptyPage(pageSize),
      },
    });
  },

  // ── Audit log (#1816) ───────────────────────────────

  listAuditEntries({
    actor = 'all',
    actionType = 'all',
    target = '',
    from = '',
    to = '',
    page = 1,
    pageSize = 50,
    sort,
  } = {}) {
    const filtered = AUDIT_ENTRIES.filter(
      (entry) =>
        auditVisible(entry) &&
        (actor === 'all' || entry.actor === actor) &&
        (actionType === 'all' || entry.actionType === actionType) &&
        (!target ||
          matchesText(entry.targetId, target) ||
          matchesText(entry.targetType, target)) &&
        inDateRange(entry.at, from, to),
    );
    const sorted = sortRows(filtered, sort, { key: 'at', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /** Sync — #6210: whether the signed-in role may read this audit entry, and its scope name. */
  auditEntryVisible(entry) {
    return auditVisible(entry);
  },

  auditScope() {
    return AUDIT_SCOPE[actingAdmin().role] ?? null;
  },

  // ── Admin users (#1807, #1820, #1821) ───────────────

  listAdmins({ search = '', status = 'all', role = 'all', page = 1, pageSize = 20, sort } = {}) {
    const filtered = ADMINS.filter(
      (admin) =>
        matchesText(admin.email, search) &&
        (status === 'all' || admin.status === status) &&
        (role === 'all' || (admin.role ?? 'none') === role),
    );
    const sorted = sortRows(filtered, sort, { key: 'createdAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  createAdmin({ email, role }) {
    const refused = refusedFor('admins.manage');
    if (refused) return refused;
    const normalised = String(email).trim().toLowerCase();
    if (!ROLE_VALUES.includes(role)) {
      return Promise.reject(new MockApiError('Choose a role.', 422));
    }
    if (ADMINS.some((a) => a.email.toLowerCase() === normalised)) {
      return Promise.reject(new MockApiError('An admin with this email already exists.', 409));
    }
    const admin = {
      id: Date.now(),
      email: normalised,
      role,
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: null,
      twoFactorEnrolled: false,
    };
    ADMINS.unshift(admin);
    recordAdminCreate(admin);
    makeAuditEntry('admin-account change', 'admin', admin.id, { exists: false }, { email: admin.email, role, status: 'active' });
    return respond({ ok: true, id: admin.id });
  },

  setAdminStatus(id, status) {
    const target = adminForChange(id);
    if (target instanceof Promise) return target;
    const before = target.status;
    target.status = status;
    patch('admins', id, { status });
    makeAuditEntry('admin-account change', 'admin', target.id, { status: before }, { status });
    return respond({ ok: true, status });
  },

  /** #6211 — one Admin (users & IT) decides alone; no second approval. */
  changeAdminRole(id, role) {
    const target = adminForChange(id);
    if (target instanceof Promise) return target;
    if (!ROLE_VALUES.includes(role)) return Promise.reject(new MockApiError('Choose a role.', 422));
    const before = target.role ?? null;
    if (before === role) return Promise.reject(new MockApiError('The account already has this role.', 422));
    target.role = role;
    patch('admins', target.id, { role });
    // Finance requests she already made stay pending as they are.
    makeAuditEntry('role changed', 'admin', target.id, { role: before }, { role });
    return respond({ ok: true, role });
  },

  /** #4122 — soft delete: the account is gone from the list, its history stays. */
  deleteAdmin(id) {
    const target = adminForChange(id);
    if (target instanceof Promise) return target;
    const before = target.status;
    const fields = { status: 'deleted', deletedAt: Date.now(), deletedBy: actingAdmin().email };
    Object.assign(target, fields);
    patch('admins', target.id, fields);
    makeAuditEntry('admin-account change', 'admin', target.id, { status: before }, { status: 'deleted' });
    return respond({ ok: true });
  },

  /** #1822 — she sets a new password at her next sign-in. */
  resetAdminPassword(id) {
    const target = adminForChange(id);
    if (target instanceof Promise) return target;
    makeAuditEntry('password reset', 'admin', target.id, {}, { email: target.email });
    return respond({ ok: true });
  },

  /** #6211 — authenticator and recovery codes removed, sessions ended; she enrols again at next sign-in. */
  resetAdminTwoFactor(id) {
    const target = adminForChange(id);
    if (target instanceof Promise) return target;
    target.twoFactorEnrolled = false;
    patch('admins', target.id, { twoFactorEnrolled: false });
    makeAuditEntry('two-factor reset', 'admin', target.id, { twoFactor: 'enrolled' }, { twoFactor: 'removed' });
    return respond({ ok: true });
  },

  /**
   * #6211 — what a role change, suspension or deletion of this account would
   * leave: 'one' active Financial lead, 'none', or null when two or more remain
   * (or the account is not an active Financial lead). Sync.
   */
  financialLeadWarning(id, nextRole = null) {
    const target = ADMINS.find((a) => String(a.id) === String(id));
    if (!target || target.role !== 'fin_lead' || target.status !== 'active' || nextRole === 'fin_lead') return null;
    const left = ADMINS.filter((a) => a.status === 'active' && a.role === 'fin_lead' && a !== target).length;
    if (left === 0) return 'none';
    if (left === 1) return 'one';
    return null;
  },
};

const ROLE_VALUES = ['admin_it', 'ops_officer', 'ops_lead', 'fin_officer', 'fin_lead'];

/** #6211 — only Admin (users & IT), never on her own account. Returns the record or a rejection. */
function adminForChange(id) {
  const refused = refusedFor('admins.manage');
  if (refused) return refused;
  const target = ADMINS.find((a) => String(a.id) === String(id));
  if (!target || target.status === 'deleted') return Promise.reject(new MockApiError('Admin not found.', 404));
  if (target.email === actingAdmin().email) {
    return Promise.reject(new MockApiError('You cannot change your own account.', 422));
  }
  return target;
}

// ── Audit log scope (#6210) ───────────────────────────
// Admin (users & IT) reads every entry. The Operations lead reads driver
// applications, rider and driver suspensions, safety reports, zones, the
// dispatch setting and operating hours. The Financial lead reads finance
// requests and their decisions, settlements, payouts, settlement imports, fee
// waivers, payout methods and pricing.

const FINANCE_AUDIT_ACTIONS = new Set([
  'approval requested', 'approval approved', 'approval rejected', 'settlement', 'payout',
  'payout batch exported', 'payout result imported', 'fee waived', 'payout method changed', 'pricing change',
]);
const OPS_POLICY_IDS = new Set(['operating-hours', 'dispatch']);

function isOperationsEntry(e) {
  if (e.targetType === 'driver') return ['approve', 'reject', 'suspend', 'reinstate'].includes(e.actionType);
  if (e.targetType === 'rider') return ['suspend', 'reinstate'].includes(e.actionType);
  if (e.targetType === 'safety_report') return true;
  if (e.targetType === 'zone') return !FINANCE_AUDIT_ACTIONS.has(e.actionType);
  if (e.targetType === 'policy') return OPS_POLICY_IDS.has(String(e.targetId));
  return false;
}

function isFinanceEntry(e) {
  if (e.targetType === 'policy' && OPS_POLICY_IDS.has(String(e.targetId))) return false;
  return FINANCE_AUDIT_ACTIONS.has(e.actionType);
}

function auditVisible(entry) {
  const scope = AUDIT_SCOPE[actingAdmin().role];
  if (scope === 'all') return true;
  if (scope === 'operations') return isOperationsEntry(entry);
  if (scope === 'finance') return isFinanceEntry(entry);
  return false;
}

// ── Internals ─────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Zones carry a derived `status` getter; flatten it for consumers. */
function serialiseZone(zone) {
  return {
    id: zone.id,
    name: zone.name,
    status: zone.status,
    rateCard: zone.rateCard ? { ...zone.rateCard } : null,
    polygon: zone.polygon,
    centre: zone.centre,
    createdBy: zone.createdBy,
    createdAt: zone.createdAt,
    // A rate card change awaiting another admin's approval (§1), or null.
    pendingChange: pendingSummary(pendingFor('zone', zone.id, 'rate_card')),
  };
}

function polygonCentre(polygon) {
  const points = polygon.slice(0, -1);
  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return [lng, lat];
}

/**
 * Append an entry to the audit log and persist it, so an intervention shows up
 * on the audit-log screen as #1816 requires.
 */
function addAuditEntry(actionType, targetType, targetId, before, after, at) {
  const entry = {
    id: `AUD-${targetType}-${targetId}-${at}`,
    at,
    // The demo "act as another admin" switch (maker-checker) changes who acts.
    actor: actingAdmin().email,
    actionType,
    targetType,
    targetId,
    before,
    after,
  };
  AUDIT_ENTRIES.unshift(entry);
  AUDIT_ENTRIES.sort((a, b) => b.at - a.at);
  recordAuditEntry(entry);
  return entry;
}

/** APPLICATIONS is a derived view; keep it in step after an approve/reject. */
function reindexApplications() {
  const pending = DRIVERS.filter((d) => d.status === 'pending');
  APPLICATIONS.length = 0;
  APPLICATIONS.push(...pending);
}
