/**
 * finance-seed.js — payouts, settlement imports and maker-checker seed data
 *
 * docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md
 * Every finance action is a request one admin makes and another approves (§1),
 * except generating a payout batch (2026-10-29); earnings wait 7 calendar days,
 * then are paid out in batches — one bank file per payout method — Finance runs
 * through each channel's portal (§3); settlements come back as an imported sheet (§4).
 *
 * Kept apart from seed.js so the base seed stays as it was. It reads the base
 * collections and decorates them (a payout method per driver, paid markers on
 * historical payable entries), then builds its own collections.
 */

import {
  ADMINS,
  AUDIT_ACTION_TYPES,
  DRIVERS,
  GLOBAL_POLICIES,
  LEDGER_ENTRIES,
  LEDGER_BY_DRIVER,
  RIDERS,
  RIDER_LEDGER_BY_RIDER,
  SEED_META,
  ZONES,
  recomputeBalances,
} from './seed.js';

const { generatedAt: NOW, MINUTE, HOUR, DAY } = SEED_META;

// Who makes and decides finance requests (#6210 / #6212): Financial officers
// (Mona, finance@) and Financial leads (Hala, Nour) make them; only a lead
// decides, never on her own request.
const byEmail = (email) => ADMINS.find((a) => a.email === email);
const NOUR = byEmail('nour.hassan@shedrive.app');
const HALA = byEmail('hala.mahmoud@shedrive.app');
const MONA = byEmail('mona.adel@shedrive.app');
const FIN_OFFICER = byEmail('finance@shedrive.app');

// Own deterministic stream, so the base seed's sequence is untouched.
let s = 20261014;
const rand = () => {
  s = (s * 1664525 + 1013904223) % 4294967296;
  return s / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const intBetween = (min, max) => Math.floor(min + rand() * (max - min + 1));
const round2 = (n) => Math.round(n * 100) / 100;
const digits = (n) => Array.from({ length: n }, () => intBetween(0, 9)).join('');

/** Ledger entries that add to what SheDrive owes a driver — the ones a payout pays (§3). */
export const PAYABLE_TYPES = ['trip_earnings', 'rider_cancellation_fee_credit'];
export const PAYOUT_HOLD_DAYS = 7;
export const PAYOUT_TYPES = ['MOBILE_WALLET', 'BANK_ACCOUNT', 'PREPAID_CARD'];
export const WALLET_PROVIDERS = ['Vodafone Cash', 'Orange Cash', 'e& money', 'WE Pay'];
export const BANKS = [
  'CIB',
  'National Bank of Egypt',
  'Banque Misr',
  'QNB Al Ahli',
  'AAIB',
  'Banque du Caire',
  'HSBC Egypt',
];
export const SETTLEMENT_CHANNELS = ['Bank transfer', 'Fawry', 'Mobile wallet', 'Field agent'];

// Cairo as format.js shows every date (fixed UTC+2), so the day a cut-off is
// drawn on is the day the screens print.
const CAIRO_OFFSET = 2 * HOUR;

/** 00:00 Cairo on the calendar day of `at`, `days` days later. */
const dayStartPlus = (at, days = 0) => Math.floor((at + CAIRO_OFFSET) / DAY) * DAY - CAIRO_OFFSET + days * DAY;

// 2026-10-29 — the 7 days are calendar days, so a batch draws one clear line:
// an earning is due from 00:00 on the 7th day after the day it happened.
export const dueAtOf = (entry) => dayStartPlus(entry.at, PAYOUT_HOLD_DAYS);

/**
 * The cut-off line of a batch generated at `now`: the last calendar day whose
 * earnings it takes (7 days ago). Everything that happened on or before that day
 * is due; anything later is still on hold.
 */
export const payoutCutoffDay = (now) => dayStartPlus(now, -PAYOUT_HOLD_DAYS);

// 2026-10-29 — payout settings, a Financial lead's request like the balance
// limit: a line below the minimum waits for a later batch, and every line
// carries a transfer fee that the driver or SheDrive pays. The fee is a
// percentage of the line, held between a minimum and a maximum amount.
export const FEE_PAYERS = ['driver', 'shedrive'];
GLOBAL_POLICIES.payout ??= {
  minimumAmount: 100,
  feePercent: 1.5,
  feeMin: 3,
  feeMax: 20,
  feePaidBy: 'driver',
  updatedAt: NOW - 2 * DAY,
  updatedBy: NOUR.email,
};
const FAILURES = { MOBILE_WALLET: 'Wallet number not registered', BANK_ACCOUNT: 'Account closed', PREPAID_CARD: 'Card blocked by issuer' };

function seedPayoutMethod(driver, index) {
  const at = driver.submittedAt + HOUR;
  const kind = index % 5;
  if (kind <= 1) {
    return { type: 'MOBILE_WALLET', provider: pick(WALLET_PROVIDERS), holderName: driver.name, number: `0${driver.phone}`, updatedAt: at, updatedBy: 'driver' };
  }
  if (kind <= 3) {
    const iban = rand() < 0.5;
    return { type: 'BANK_ACCOUNT', provider: pick(BANKS), holderName: driver.name, number: iban ? `EG${digits(27)}` : digits(12), updatedAt: at, updatedBy: 'driver' };
  }
  return { type: 'PREPAID_CARD', provider: null, holderName: driver.name, number: `5078${digits(12)}`, updatedAt: at, updatedBy: 'driver' };
}

// Every driver has one — a driver can't be in the system without it (§2).
DRIVERS.forEach((driver, index) => {
  driver.payoutMethod = seedPayoutMethod(driver, index);
  driver.lastPayoutFailure = null;
});

// Historical payouts paid a driver's oldest payable entries first, so those
// are marked paid; everything after is on hold, due, or in an open batch.
for (const driver of DRIVERS) {
  const entries = (LEDGER_BY_DRIVER.get(String(driver.id)) ?? []).slice().reverse();
  let paid = entries.filter((e) => e.type === 'payout').reduce((t, e) => t - e.amount, 0);
  entries
    .filter((e) => PAYABLE_TYPES.includes(e.type))
    .forEach((e) => {
      if (paid >= e.amount - 0.005) {
        e.paidRef = 'history';
        paid = round2(paid - e.amount);
      }
    });
}

// Ids are derived from what already exists — including records replayed from
// this session after a reload — so a new one can never collide with an old one.
const maxSeq = (ids, pattern) =>
  ids.reduce((max, id) => {
    const m = pattern.exec(String(id));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

export function makeBatchRef(at) {
  const d = new Date(at);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = maxSeq(PAYOUT_BATCHES.map((b) => b.ref), /-(\d+)$/) + 1;
  return `PB-${ymd}-${String(seq).padStart(2, '0')}`;
}

/** The transfer fee on one line: its percentage, never below the minimum or above the maximum. */
export function transferFeeFor(amount, { feePercent, feeMin, feeMax }) {
  return round2(Math.min(feeMax, Math.max(feeMin, (amount * feePercent) / 100)));
}

/** One payee line, with the transfer fee in force when the batch was generated. */
export function makeLine(driver, ref, n, amount, entryIds, settings = GLOBAL_POLICIES.payout) {
  const m = driver.payoutMethod;
  return {
    lineRef: `${ref}-${String(n).padStart(4, '0')}`,
    driverId: String(driver.id),
    driverName: driver.name,
    nationalId: driver.nid,
    // Every bank file carries her phone number (2026-10-29).
    phone: driver.phone ? `0${driver.phone}` : null,
    payoutType: m.type,
    provider: m.provider,
    number: m.number,
    holderName: m.holderName,
    amount: round2(amount),
    fee: transferFeeFor(amount, settings),
    feePaidBy: settings.feePaidBy,
    entryIds,
    status: 'pending',
    bankReference: null,
    failureReason: null,
  };
}

const findDriver = (id) => DRIVERS.find((d) => String(d.id) === String(id));
const adminByEmail = (email) => ADMINS.find((a) => a.email === email);

export const PAYOUT_BATCHES = [];

// Two completed batches, built from payouts already on the ledger so a paid
// line and its `payout` entry agree.
[
  { from: 16, to: 9, maker: MONA },
  { from: 9, to: 2, maker: FIN_OFFICER },
].forEach(({ from, to, maker }) => {
  const payouts = LEDGER_ENTRIES.filter(
    (e) => e.type === 'payout' && e.at <= NOW - to * DAY && e.at > NOW - from * DAY && findDriver(e.driverId)?.payoutMethod,
  );
  if (!payouts.length) return;
  const createdAt = Math.min(...payouts.map((e) => e.at)) - 3 * HOUR;
  const ref = makeBatchRef(createdAt);
  const lines = payouts.map((e, i) => {
    const line = makeLine(findDriver(e.driverId), ref, i + 1, -e.amount, []);
    line.status = 'paid';
    line.bankReference = `BNK${digits(8)}`;
    e.ref = line.bankReference;
    e.lineRef = line.lineRef;
    e.batchId = ref;
    return line;
  });
  // One line came back FAILED — no `payout` entry was ever posted for it.
  const unlucky = DRIVERS.find(
    (d) => d.status === 'approved' && d.payoutMethod && !d.lastPayoutFailure && !lines.some((l) => l.driverId === String(d.id)),
  );
  if (unlucky) {
    // The failure reason matches the method it was sent to.
    const failed = FAILURES[unlucky.payoutMethod.type];
    const line = makeLine(unlucky, ref, lines.length + 1, intBetween(80, 260), []);
    line.status = 'failed';
    line.failureReason = failed;
    lines.push(line);
    unlucky.lastPayoutFailure = { at: createdAt + 2 * DAY, reason: failed, batchId: ref, lineRef: line.lineRef };
  }
  PAYOUT_BATCHES.push({
    id: ref,
    ref,
    status: 'completed',
    createdAt,
    createdBy: maker.email,
    exportedAt: createdAt + 3 * HOUR,
    exportedBy: maker.email,
    resultImportedAt: createdAt + 2 * DAY,
    resultImportedBy: maker.email,
    completedAt: createdAt + 2 * DAY + HOUR,
    parts: Object.fromEntries(PAYOUT_TYPES.filter((t) => lines.some((l) => l.payoutType === t)).map((t) => [t, {
      status: 'done', importedAt: createdAt + 2 * DAY, importedBy: maker.email, decidedAt: createdAt + 2 * DAY + HOUR,
    }])),
    lines,
  });
});

// One open batch, exported yesterday, waiting for Finance's result file.
{
  const createdAt = NOW - DAY - 2 * HOUR;
  const ref = makeBatchRef(createdAt);
  const lines = [];
  DRIVERS.filter((d) => d.status === 'approved' && d.payoutMethod && d.balance > 0).forEach((driver) => {
    if (lines.length >= 4) return;
    const due = (LEDGER_BY_DRIVER.get(String(driver.id)) ?? []).filter(
      (e) => PAYABLE_TYPES.includes(e.type) && !e.paidRef && dueAtOf(e) <= createdAt,
    );
    const dueNet = round2(due.reduce((t, e) => t + e.amount, 0));
    // Her whole due net — not capped by her balance (2026-10-29).
    const amount = dueNet;
    if (amount <= 0) return;
    const line = makeLine(driver, ref, lines.length + 1, amount, due.map((e) => e.id));
    line.status = 'sent';
    lines.push(line);
  });
  if (lines.length) {
    PAYOUT_BATCHES.push({
      id: ref,
      ref,
      status: 'sent_to_bank',
      createdAt,
      createdBy: MONA.email,
      exportedAt: createdAt + 90 * MINUTE,
      exportedBy: MONA.email,
      resultImportedAt: null,
      resultImportedBy: null,
      completedAt: null,
      parts: Object.fromEntries(PAYOUT_TYPES.filter((t) => lines.some((l) => l.payoutType === t)).map((t) => [t, { status: 'sent' }])),
      lines,
    });
  }
}
PAYOUT_BATCHES.sort((a, b) => b.createdAt - a.createdAt);

// A few platform-held trip earnings past their hold, so a batch generated in
// the demo has several lines (and its sample result one failed line). Drivers
// already in the open batch are left out so nothing is paid twice.
{
  const inOpen = new Set(PAYOUT_BATCHES.filter((b) => b.status !== 'completed').flatMap((b) => b.lines.map((l) => l.driverId)));
  DRIVERS.filter((d) => d.status === 'approved' && d.payoutMethod && !inOpen.has(String(d.id)) && d.balance > -150)
    .slice(0, 3)
    .forEach((driver, i) => {
      const amount = round2(Math.max(0, -driver.balance) + 140 + i * 55.25);
      const entry = {
        id: `led-demo-due-${driver.id}`,
        driverId: String(driver.id),
        type: 'trip_earnings',
        amount,
        at: NOW - (8 + i) * DAY - 3 * HOUR,
        tripId: null,
        note: 'Net earnings — card trips this week',
      };
      LEDGER_ENTRIES.push(entry);
      const list = LEDGER_BY_DRIVER.get(String(driver.id));
      if (list) list.push(entry);
      else LEDGER_BY_DRIVER.set(String(driver.id), [entry]);
    });
  LEDGER_ENTRIES.sort((a, b) => b.at - a.at);
  LEDGER_BY_DRIVER.forEach((list) => list.sort((a, b) => b.at - a.at));
  recomputeBalances();
}


// ── Settlement imports (§4) ───────────────────────────
export const SETTLEMENT_IMPORTS = [];
{
  const settled = LEDGER_ENTRIES.filter((e) => e.type === 'settlement' && e.at > NOW - 40 * DAY).slice(0, 3);
  if (settled.length) {
    const at = Math.max(...settled.map((e) => e.at)) + HOUR;
    const rows = settled.map((e, i) => {
      const driver = findDriver(e.driverId);
      e.paymentRef = `FT${digits(9)}`;
      e.importId = 'IMP-0001';
      return {
        rowNo: i + 1,
        nationalId: driver.nid,
        driverName: driver.name,
        driverId: String(driver.id),
        amount: e.amount,
        paymentDate: new Date(e.at).toISOString().slice(0, 10),
        channel: e.method,
        paymentRef: e.paymentRef,
        status: 'ready',
        receipt: e.ref,
      };
    });
    SETTLEMENT_IMPORTS.push({
      id: 'IMP-0001',
      fileName: 'finance-settlements-week-37.csv',
      status: 'approved',
      createdAt: at,
      createdBy: NOUR.email,
      decidedAt: at + 3 * HOUR,
      decidedBy: HALA.email,
      totalRows: rows.length,
      readyRows: rows.length,
      rows,
      amount: round2(rows.reduce((t, r) => t + r.amount, 0)),
    });
  }
}

// ── Review cases (2026-10-22, 2026-10-29) ─────────────
// One pending request of every type, so each version of the review can be
// checked, plus batches at real scale: two Ready to export (12 and 100 lines)
// and two whose result files are awaiting approval (1,000 and 100 lines). Batch lines are generated payees, not seeded drivers —
// the base seed has 34 drivers. They use their own random stream, so every
// value above stays exactly as it was.

let s2 = 20261022;
const rand2 = () => {
  s2 = (s2 * 1664525 + 1013904223) % 4294967296;
  return s2 / 4294967296;
};
const pick2 = (list) => list[Math.floor(rand2() * list.length)];
const int2 = (min, max) => Math.floor(min + rand2() * (max - min + 1));
const digits2 = (n) => Array.from({ length: n }, () => int2(0, 9)).join('');

const FIRSTS = [...new Set(DRIVERS.map((d) => d.name.split(' ')[0]))];
const LASTS = [...new Set(DRIVERS.map((d) => d.name.split(' ').slice(-1)[0]))];
const MIDDLES = ['Ahmed', 'Mohamed', 'Ali', 'Hussein', 'Samir', 'Khaled', 'Omar', 'Hany', 'Adel', 'Fawzy'];

/** The n-th generated payee: a unique name, a national ID and a payout method. */
function payee(n) {
  const name = `${FIRSTS[n % FIRSTS.length]} ${MIDDLES[Math.floor(n / FIRSTS.length) % MIDDLES.length]} ${
    LASTS[Math.floor(n / (FIRSTS.length * MIDDLES.length)) % LASTS.length]
  }`;
  const born = `${int2(80, 99)}${String(int2(1, 12)).padStart(2, '0')}${String(int2(1, 28)).padStart(2, '0')}`;
  const type = pick2(PAYOUT_TYPES);
  const method = type === 'MOBILE_WALLET'
    ? { type, provider: pick2(WALLET_PROVIDERS), number: `01${pick2(['0', '1', '2', '5'])}${digits2(8)}` }
    : type === 'BANK_ACCOUNT'
      ? { type, provider: pick2(BANKS), number: rand2() < 0.5 ? `EG${digits2(27)}` : digits2(12) }
      : { type, provider: null, number: `5078${digits2(12)}` };
  // Derived from n, not drawn, so the random stream stays as it was.
  const phone = `1${'0125'[n % 4]}${String(10000000 + ((n * 7919) % 90000000))}`;
  return { id: null, name, phone, nid: `2${born}${digits2(7)}`, payoutMethod: { ...method, holderName: name } };
}

/** A generated batch of `count` lines; `failEvery` > 0 adds a result file with that share failed. */
function reviewBatch({ count, createdAt, maker, status, offset, failEvery = 0 }) {
  const ref = makeBatchRef(createdAt);
  const lines = Array.from({ length: count }, (_, i) => {
    const line = makeLine(payee(offset + i), ref, i + 1, int2(8500, 145000) / 100, []);
    line.driverId = null;
    line.status = status === 'result_pending' ? 'sent' : 'pending';
    return line;
  });
  const batch = {
    id: ref,
    ref,
    status,
    createdAt,
    createdBy: maker.email,
    exportedAt: null,
    exportedBy: null,
    resultImportedAt: null,
    resultImportedBy: null,
    completedAt: null,
    parts: Object.fromEntries(PAYOUT_TYPES.filter((t) => lines.some((l) => l.payoutType === t)).map((t) => [t, {
      status: status === 'result_pending' ? 'result_pending' : 'ready',
      ...(status === 'result_pending' ? { importedAt: createdAt + DAY, importedBy: maker.email } : {}),
    }])),
    lines,
  };
  if (status === 'result_pending') {
    Object.assign(batch, {
      exportedAt: createdAt + 2 * HOUR,
      exportedBy: maker.email,
      resultImportedAt: createdAt + DAY,
      resultImportedBy: maker.email,
    });
    batch.result = lines.map((l, i) => (failEvery && i % failEvery === failEvery - 1
      ? { lineRef: l.lineRef, status: 'FAILED', bankReference: null, failureReason: FAILURES[l.payoutType] }
      : { lineRef: l.lineRef, status: 'SUCCESS', bankReference: `BNK${digits2(8)}`, failureReason: null }));
  }
  PAYOUT_BATCHES.push(batch);
  return batch;
}

const REVIEW_BATCHES = {
  small: reviewBatch({ count: 12, createdAt: NOW - 3 * HOUR, maker: MONA, status: 'ready', offset: 0 }),
  hundred: reviewBatch({ count: 100, createdAt: NOW - 2 * HOUR, maker: NOUR, status: 'ready', offset: 100 }),
  thousand: reviewBatch({ count: 1000, createdAt: NOW - DAY - 90 * MINUTE, maker: MONA, status: 'result_pending', offset: 1000, failEvery: 40 }),
  result: reviewBatch({ count: 100, createdAt: NOW - 2 * DAY, maker: NOUR, status: 'result_pending', offset: 3000, failEvery: 16 }),
};
PAYOUT_BATCHES.sort((a, b) => b.createdAt - a.createdAt);
// Every seeded batch shows the cut-off line it was generated with.
PAYOUT_BATCHES.forEach((b) => {
  b.cutoffDay ??= payoutCutoffDay(b.createdAt);
  // …and the payout settings it was generated with.
  const { updatedAt, updatedBy, ...settings } = GLOBAL_POLICIES.payout;
  b.settings ??= settings;
});

// A pending settlement sheet with every driver who owes, except the one whose
// manual settlement is already waiting (one pending request per subject).
const owingForImport = DRIVERS.filter((d) => d.balance < 0).sort((a, b) => a.balance - b.balance).slice(1);
if (owingForImport.length) {
  const at = NOW - 75 * MINUTE;
  const rows = owingForImport.map((driver, i) => ({
    rowNo: i + 2,
    nationalId: driver.nid,
    driverName: driver.name,
    driverId: String(driver.id),
    amount: -driver.balance,
    paymentDate: new Date(at - DAY).toISOString().slice(0, 10),
    channel: pick2(SETTLEMENT_CHANNELS),
    paymentRef: `FT${digits2(9)}`,
    status: 'ready',
    receipt: null,
  }));
  SETTLEMENT_IMPORTS.unshift({
    id: nextImportIdFrom(SETTLEMENT_IMPORTS),
    fileName: 'finance-settlements-week-43.csv',
    status: 'pending',
    createdAt: at,
    createdBy: FIN_OFFICER.email,
    decidedAt: null,
    decidedBy: null,
    totalRows: rows.length,
    readyRows: rows.length,
    rows,
    amount: round2(rows.reduce((t, r) => t + r.amount, 0)),
  });
}

function nextImportIdFrom(list) {
  return `IMP-${String(maxSeq(list.map((i) => i.id), /^IMP-(\d+)$/) + 1).padStart(4, '0')}`;
}

// ── Approval requests (maker-checker, §1) ─────────────
export const APPROVAL_TYPES = [
  'payout_result',
  'payout',
  'settlement',
  'settlement_import',
  'fee_waiver',
  'payout_method',
  'rate_card',
  'commission',
  'cancellation_policy',
  'balance_limit',
  'payout_settings',
];

/**
 * Which part of the business each request type belongs to. The queue filters
 * by it today; once Finance and Pricing approvers are split, a role presets it.
 */
export const APPROVAL_AREAS = {
  payouts: ['payout_result', 'payout', 'settlement', 'settlement_import', 'payout_settings'],
  fees: ['fee_waiver'],
  pricing: ['rate_card', 'commission', 'cancellation_policy', 'balance_limit'],
  drivers: ['payout_method'],
};

export const nextApprovalId = () =>
  `APR-${String(maxSeq(APPROVALS.map((a) => a.id), /^APR-(\d+)$/) + 1).padStart(4, '0')}`;
export const nextImportId = () =>
  `IMP-${String(maxSeq(SETTLEMENT_IMPORTS.map((i) => i.id), /^IMP-(\d+)$/) + 1).padStart(4, '0')}`;

/**
 * A request: `before`/`after` are plain objects the Approvals screen diffs;
 * `payload` is what the approval executes.
 */
export function makeApproval(type, subject, { before = null, after = null, amount = null, payload = {}, maker, madeAt, status = 'pending', checker = null, decidedAt = null, rejectReason = null }) {
  return {
    id: nextApprovalId(),
    type,
    status,
    subject,
    before,
    after,
    amount,
    payload,
    maker,
    madeAt,
    checker,
    decidedAt,
    rejectReason,
  };
}

export const APPROVALS = [];
{
  // A generated batch needs no approval (2026-10-29); each method's result file does.
  PAYOUT_BATCHES.filter((b) => b.status === 'completed').forEach((b) => {
    PAYOUT_TYPES.forEach((type) => {
      const lines = b.lines.filter((l) => l.payoutType === type);
      if (!lines.length) return;
      const paid = lines.filter((l) => l.status === 'paid');
      APPROVALS.push(makeApproval('payout_result', { kind: 'batch', id: b.id, label: b.ref }, {
        after: { success: paid.length, failed: lines.length - paid.length },
        amount: round2(paid.reduce((t, l) => t + l.amount, 0)),
        payload: { batchId: b.id, payoutType: type }, maker: b.resultImportedBy, madeAt: b.resultImportedAt,
        status: 'approved', checker: HALA.email, decidedAt: b.completedAt,
      }));
    });
  });

  SETTLEMENT_IMPORTS.filter((imp) => imp.status !== 'pending').forEach((imp) => {
    APPROVALS.push(makeApproval('settlement_import', { kind: 'import', id: imp.id, label: imp.fileName }, {
      after: { rows: imp.readyRows }, amount: imp.amount, payload: { importId: imp.id },
      maker: imp.createdBy, madeAt: imp.createdAt, status: 'approved', checker: imp.decidedBy, decidedAt: imp.decidedAt,
    }));
  });

  APPROVALS.push(makeApproval('commission', { kind: 'policy', id: 'commission', label: 'Platform commission' }, {
    before: { percentage: GLOBAL_POLICIES.commission.percentage }, after: { percentage: 20 },
    payload: { percentage: 20 },
    maker: NOUR.email, madeAt: NOW - 6 * DAY, status: 'rejected', checker: HALA.email,
    decidedAt: NOW - 6 * DAY + 4 * HOUR, rejectReason: 'Commission stays at 18% until the quarterly review.',
  }));

  // Pending — made by other admins, so the signed-in admin can check them.
  const zone = ZONES.find((z) => z.rateCard);
  if (zone) {
    const { updatedAt, ...before } = zone.rateCard;
    const after = { ...before, perKm: round2(before.perKm + 0.5), minFare: before.minFare + 5 };
    APPROVALS.push(makeApproval('rate_card', { kind: 'zone', id: String(zone.id), label: zone.name }, {
      before, after, payload: { zoneId: String(zone.id), rateCard: after },
      maker: NOUR.email, madeAt: NOW - 5 * HOUR,
    }));
  }

  const feeRider = RIDERS.find((r) => r.outstanding > 0);
  const fee = feeRider && (RIDER_LEDGER_BY_RIDER.get(String(feeRider.id)) ?? []).find((e) => e.type === 'cancellation_fee');
  if (fee) {
    APPROVALS.push(makeApproval('fee_waiver', { kind: 'rider', id: String(feeRider.id), label: feeRider.name }, {
      before: { fee: -fee.amount }, after: { fee: 0 }, amount: -fee.amount,
      payload: { riderId: String(feeRider.id), entryId: fee.id, tripId: fee.tripId, reason: 'Driver waited at the wrong pickup point; the rider cancelled after 6 minutes.' },
      maker: FIN_OFFICER.email, madeAt: NOW - 2 * HOUR,
    }));
  }

  const owing = DRIVERS.filter((d) => d.balance < 0).sort((a, b) => a.balance - b.balance);
  if (owing[0]) {
    const d = owing[0];
    APPROVALS.push(makeApproval('settlement', { kind: 'driver', id: String(d.id), label: d.name }, {
      before: { balance: d.balance }, after: { balance: 0 }, amount: -d.balance,
      payload: { driverId: String(d.id), amount: -d.balance, method: 'Field agent', date: null, note: 'Cash collected by field agent', proof: null },
      maker: NOUR.email, madeAt: NOW - 40 * MINUTE,
    }));
  }

  // Review cases — added after the requests above so their ids stay as they were.
  // One request per method's result file: the 1,000-line batch first, then the 100-line one.
  [REVIEW_BATCHES.thousand, REVIEW_BATCHES.result].forEach((b) => {
    PAYOUT_TYPES.forEach((type) => {
      const lines = b.lines.filter((l) => l.payoutType === type);
      if (!lines.length) return;
      const ok = new Set(b.result.filter((r) => r.status === 'SUCCESS').map((r) => r.lineRef));
      const paid = lines.filter((l) => ok.has(l.lineRef));
      APPROVALS.push(makeApproval('payout_result', { kind: 'batch', id: b.id, label: b.ref }, {
        before: { success: 0, failed: 0 },
        after: { success: paid.length, failed: lines.length - paid.length },
        amount: round2(paid.reduce((t, l) => t + l.amount, 0)),
        payload: { batchId: b.id, payoutType: type }, maker: b.resultImportedBy, madeAt: b.resultImportedAt,
      }));
    });
  });

  const pendingImport = SETTLEMENT_IMPORTS.find((i) => i.status === 'pending');
  if (pendingImport) {
    APPROVALS.push(makeApproval('settlement_import', { kind: 'import', id: pendingImport.id, label: pendingImport.fileName }, {
      after: { rows: pendingImport.readyRows }, amount: pendingImport.amount, payload: { importId: pendingImport.id },
      maker: pendingImport.createdBy, madeAt: pendingImport.createdAt,
    }));
  }

  const payoutDriver = DRIVERS.filter((d) => d.status === 'approved' && d.balance > 0).sort((a, b) => b.balance - a.balance)[0];
  if (payoutDriver) {
    const amount = round2(Math.min(payoutDriver.balance, 500));
    APPROVALS.push(makeApproval('payout', { kind: 'driver', id: String(payoutDriver.id), label: payoutDriver.name }, {
      before: { balance: payoutDriver.balance }, after: { balance: round2(payoutDriver.balance - amount) }, amount,
      payload: { driverId: String(payoutDriver.id), amount, at: NOW - 3 * HOUR, reference: `INSTAPAY-${digits2(10)}`, proof: null },
      maker: FIN_OFFICER.email, madeAt: NOW - 25 * MINUTE,
    }));
  }

  const switching = DRIVERS.find((d) => d.status === 'approved' && d.payoutMethod?.type === 'MOBILE_WALLET' && d.id !== payoutDriver?.id);
  if (switching) {
    const m = switching.payoutMethod;
    const method = { type: 'BANK_ACCOUNT', provider: 'CIB', holderName: switching.name, number: `EG${digits2(27)}` };
    APPROVALS.push(makeApproval('payout_method', { kind: 'driver', id: String(switching.id), label: switching.name }, {
      before: { type: m.type, provider: m.provider ?? '—', number: m.number, holderName: m.holderName },
      after: { type: method.type, provider: method.provider, number: method.number, holderName: method.holderName },
      payload: { driverId: String(switching.id), method },
      maker: MONA.email, madeAt: NOW - 55 * MINUTE,
    }));
  }

  APPROVALS.push(makeApproval('commission', { kind: 'policy', id: 'commission', label: 'Platform commission' }, {
    before: { percentage: GLOBAL_POLICIES.commission.percentage },
    after: { percentage: GLOBAL_POLICIES.commission.percentage + 1 },
    payload: { percentage: GLOBAL_POLICIES.commission.percentage + 1 },
    maker: HALA.email, madeAt: NOW - 4 * HOUR,
  }));

  // #6212 — the cancellation policy and the balance limit wait for approval too.
  {
    const { updatedAt, updatedBy, ...current } = GLOBAL_POLICIES.cancellation;
    const next = { ...current, driverCancellationFee: current.driverCancellationFee + 5 };
    APPROVALS.push(makeApproval('cancellation_policy', { kind: 'policy', id: 'cancellation', label: 'Cancellation policy' }, {
      before: current, after: next, payload: { cancellation: next },
      maker: NOUR.email, madeAt: NOW - 70 * MINUTE,
    }));
  }
  {
    const current = { outstandingLimit: GLOBAL_POLICIES.driverBalance.outstandingLimit };
    const next = { outstandingLimit: current.outstandingLimit + 100 };
    APPROVALS.push(makeApproval('balance_limit', { kind: 'policy', id: 'balance-limit', label: 'Driver balance limit' }, {
      before: current, after: next, payload: { driverBalance: next },
      maker: NOUR.email, madeAt: NOW - 35 * MINUTE,
    }));
  }
  // 2026-10-29 — a payout settings change: SheDrive takes over the transfer fee.
  {
    const { updatedAt, updatedBy, ...current } = GLOBAL_POLICIES.payout;
    const next = { ...current, minimumAmount: 150, feePaidBy: 'shedrive' };
    APPROVALS.push(makeApproval('payout_settings', { kind: 'policy', id: 'payout-settings', label: 'Payout settings' }, {
      before: current, after: next, payload: { payout: next },
      maker: HALA.email, madeAt: NOW - 20 * MINUTE,
    }));
  }

  APPROVALS.sort((a, b) => b.madeAt - a.madeAt);
}

export const APPROVALS_BY_ID = new Map(APPROVALS.map((a) => [a.id, a]));
export const PAYOUT_BATCHES_BY_ID = new Map(PAYOUT_BATCHES.map((b) => [b.id, b]));
export { adminByEmail };

// The audit-log action filter lists these alongside the base types.
AUDIT_ACTION_TYPES.push(
  'approval requested',
  'approval approved',
  'approval rejected',
  'payout batch generated',
  'payout batch exported',
  'payout result imported',
  'payout settings changed',
  'fee waived',
  'payout method changed',
);
