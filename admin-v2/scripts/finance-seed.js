/**
 * finance-seed.js — payouts, settlement imports and maker-checker seed data
 *
 * docs/superpowers/specs/2026-10-14-driver-payouts-settlement-design.md
 * Every finance action is a request one admin makes and another approves (§1);
 * earnings wait 7 calendar days, then are paid out in batches Finance runs
 * through the bank portal (§3); settlements come back as an imported sheet (§4).
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
} from './seed.js';

const { generatedAt: NOW, MINUTE, HOUR, DAY } = SEED_META;

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

export const dueAtOf = (entry) => entry.at + PAYOUT_HOLD_DAYS * DAY;

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

// Drivers approved before the payout-method step existed have none, which is
// what gives the batch preview its "no payout method" rows. Every applicant
// has one — it is required to submit onboarding (§2).
DRIVERS.forEach((driver, index) => {
  const legacy = driver.status !== 'pending' && index % 9 === 4;
  driver.payoutMethod = legacy ? null : seedPayoutMethod(driver, index);
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

let batchSeq = 0;
export function makeBatchRef(at) {
  const d = new Date(at);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  batchSeq += 1;
  return `PB-${ymd}-${String(batchSeq).padStart(2, '0')}`;
}

export function makeLine(driver, ref, n, amount, entryIds) {
  const m = driver.payoutMethod;
  return {
    lineRef: `${ref}-${String(n).padStart(4, '0')}`,
    driverId: String(driver.id),
    driverName: driver.name,
    nationalId: driver.nid,
    payoutType: m.type,
    provider: m.provider,
    number: m.number,
    holderName: m.holderName,
    amount: round2(amount),
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
  { from: 16, to: 9, maker: ADMINS[1], checker: ADMINS[2], failed: 'Wallet number not registered' },
  { from: 9, to: 2, maker: ADMINS[2], checker: ADMINS[1], failed: 'Account closed' },
].forEach(({ from, to, maker, checker, failed }) => {
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
    approvedBy: checker.email,
    approvedAt: createdAt + 2 * HOUR,
    exportedAt: createdAt + 3 * HOUR,
    exportedBy: maker.email,
    resultImportedAt: createdAt + 2 * DAY,
    resultImportedBy: maker.email,
    completedAt: createdAt + 2 * DAY + HOUR,
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
    const amount = Math.min(dueNet, driver.balance);
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
      createdBy: ADMINS[2].email,
      approvedBy: ADMINS[1].email,
      approvedAt: createdAt + HOUR,
      exportedAt: createdAt + 90 * MINUTE,
      exportedBy: ADMINS[2].email,
      resultImportedAt: null,
      resultImportedBy: null,
      completedAt: null,
      lines,
    });
  }
}
PAYOUT_BATCHES.sort((a, b) => b.createdAt - a.createdAt);

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
      createdBy: ADMINS[1].email,
      decidedAt: at + 3 * HOUR,
      decidedBy: ADMINS[0].email,
      totalRows: rows.length + 1,
      readyRows: rows.length,
      rows,
      amount: round2(rows.reduce((t, r) => t + r.amount, 0)),
    });
  }
}

// ── Approval requests (maker-checker, §1) ─────────────
export const APPROVAL_TYPES = [
  'payout_batch',
  'payout_result',
  'payout',
  'settlement',
  'settlement_import',
  'fee_waiver',
  'payout_method',
  'rate_card',
  'commission',
];

let approvalSeq = 0;
export const nextApprovalId = () => `APR-${String(++approvalSeq).padStart(4, '0')}`;
let importSeq = 1;
export const nextImportId = () => `IMP-${String(++importSeq).padStart(4, '0')}`;

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
  PAYOUT_BATCHES.filter((b) => b.status === 'completed').forEach((b) => {
    const total = round2(b.lines.reduce((t, l) => t + l.amount, 0));
    APPROVALS.push(makeApproval('payout_batch', { kind: 'batch', id: b.id, label: b.ref }, {
      after: { lines: b.lines.length, total }, amount: total, payload: { batchId: b.id },
      maker: b.createdBy, madeAt: b.createdAt, status: 'approved', checker: b.approvedBy, decidedAt: b.approvedAt,
    }));
    const paid = b.lines.filter((l) => l.status === 'paid');
    APPROVALS.push(makeApproval('payout_result', { kind: 'batch', id: b.id, label: b.ref }, {
      after: { success: paid.length, failed: b.lines.length - paid.length },
      amount: round2(paid.reduce((t, l) => t + l.amount, 0)),
      payload: { batchId: b.id }, maker: b.resultImportedBy, madeAt: b.resultImportedAt,
      status: 'approved', checker: ADMINS[0].email, decidedAt: b.completedAt,
    }));
  });

  SETTLEMENT_IMPORTS.forEach((imp) => {
    APPROVALS.push(makeApproval('settlement_import', { kind: 'import', id: imp.id, label: imp.fileName }, {
      after: { rows: imp.readyRows }, amount: imp.amount, payload: { importId: imp.id },
      maker: imp.createdBy, madeAt: imp.createdAt, status: 'approved', checker: imp.decidedBy, decidedAt: imp.decidedAt,
    }));
  });

  APPROVALS.push(makeApproval('commission', { kind: 'policy', id: 'commission', label: 'Platform commission' }, {
    before: { percentage: GLOBAL_POLICIES.commission.percentage }, after: { percentage: 20 },
    payload: { percentage: 20 },
    maker: ADMINS[2].email, madeAt: NOW - 6 * DAY, status: 'rejected', checker: ADMINS[0].email,
    decidedAt: NOW - 6 * DAY + 4 * HOUR, rejectReason: 'Commission stays at 18% until the quarterly review.',
  }));

  const open = PAYOUT_BATCHES.find((b) => b.status === 'sent_to_bank');
  if (open) {
    const total = round2(open.lines.reduce((t, l) => t + l.amount, 0));
    APPROVALS.push(makeApproval('payout_batch', { kind: 'batch', id: open.id, label: open.ref }, {
      after: { lines: open.lines.length, total }, amount: total, payload: { batchId: open.id },
      maker: open.createdBy, madeAt: open.createdAt, status: 'approved', checker: open.approvedBy, decidedAt: open.approvedAt,
    }));
  }

  // Pending — made by other admins, so the signed-in admin can check them.
  const zone = ZONES.find((z) => z.rateCard);
  if (zone) {
    const { updatedAt, ...before } = zone.rateCard;
    const after = { ...before, perKm: round2(before.perKm + 0.5), minFare: before.minFare + 5 };
    APPROVALS.push(makeApproval('rate_card', { kind: 'zone', id: String(zone.id), label: zone.name }, {
      before, after, payload: { zoneId: String(zone.id), rateCard: after },
      maker: ADMINS[2].email, madeAt: NOW - 5 * HOUR,
    }));
  }

  const feeRider = RIDERS.find((r) => r.outstanding > 0);
  const fee = feeRider && (RIDER_LEDGER_BY_RIDER.get(String(feeRider.id)) ?? []).find((e) => e.type === 'cancellation_fee');
  if (fee) {
    APPROVALS.push(makeApproval('fee_waiver', { kind: 'rider', id: String(feeRider.id), label: feeRider.name }, {
      before: { fee: -fee.amount }, after: { fee: 0 }, amount: -fee.amount,
      payload: { riderId: String(feeRider.id), entryId: fee.id, tripId: fee.tripId, reason: 'Driver waited at the wrong pickup point; the rider cancelled after 6 minutes.' },
      maker: ADMINS[3].email, madeAt: NOW - 2 * HOUR,
    }));
  }

  const owing = DRIVERS.filter((d) => d.balance < 0).sort((a, b) => a.balance - b.balance);
  if (owing[0]) {
    const d = owing[0];
    APPROVALS.push(makeApproval('settlement', { kind: 'driver', id: String(d.id), label: d.name }, {
      before: { balance: d.balance }, after: { balance: 0 }, amount: -d.balance,
      payload: { driverId: String(d.id), amount: -d.balance, method: 'Field agent', date: null, note: 'Cash collected by field agent', proof: null },
      maker: ADMINS[1].email, madeAt: NOW - 40 * MINUTE,
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
  'payout batch exported',
  'payout result imported',
  'fee waived',
  'payout method changed',
);
