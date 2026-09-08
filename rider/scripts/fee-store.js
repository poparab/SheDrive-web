/**
 * fee-store.js — rider outstanding-fee ledger, mock (spec §2.2 / API #1775, #4000, #4002)
 *
 * One signed balance per rider, in EGP — zero for almost every rider, almost always:
 *   negative → she owes an outstanding cancellation fee (outstanding)
 *   zero     → nothing owed (the common case)
 *
 * The balance is always the sum of the ledger; nothing ever writes it directly. A fee
 * is recovered as a cash surcharge on her *next* completed trip (spec §3) — collected
 * by the driver and passed through the driver ledger. Commission is never taken from a
 * recovered fee; the platform already holds its share on that trip.
 *
 * Recovery escalates rather than blocking (spec §3):
 *   below the threshold  → the oldest fee only, one per ride
 *   at/above  threshold  → her WHOLE outstanding balance, in one payment
 *
 * She is never blocked from booking. A block would deadlock — taking a ride is the only
 * way a cash rider can clear a fee. Abuse is handled by suspending the rider (#1740).
 *
 * Demo switches (query string), honoured by every screen that reads this store:
 *   ?fees=N   seed N outstanding cancellation fees
 *   ?full     outstanding total at/above the threshold (whole balance recovered)
 *   ?zero     zero balance, nothing owed
 *   ?error    the request fails
 */

const STORAGE_KEY = 'shedrive.riderFees';

/** Global policy — configured by the super admin (spec §4). */
export const POLICY = {
  // At or above this, her whole balance is recovered on the next ride instead of one
  // fee at a time. 0 disables the escalation — it never blocks a booking.
  recoveryThreshold: 60,
};

/** Fee-ledger entry types and their direction. Mirrors the spec §2.2 table. */
export const FEE_TYPES = {
  cancellation_fee: { key: 'fees.type.cancellation', sign: -1 },
  fee_collected: { key: 'fees.type.collected', sign: +1 },
  fee_waived: { key: 'fees.type.waived', sign: +1 },
};

const params = new URLSearchParams(location.search);

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** A small pool of routes/dates to seed demo fees from — mirrors finance-store.js's style. */
const ROUTE_POOL = [
  { ar: 'الدقي ← القطامية', en: 'Dokki → Katameya' },
  { ar: 'المهندسين ← مصر الجديدة', en: 'Mohandessin → Heliopolis' },
  { ar: 'حلوان ← وسط البلد', en: 'Helwan → Downtown' },
  { ar: 'الشروق ← المعادي', en: 'Shorouk → Maadi' },
  { ar: 'التجمع الخامس ← الزمالك', en: 'New Cairo → Zamalek' },
];
const AMOUNT_POOL = [20, 15, 25, 30, 20];
const DATE_POOL = ['2026-09-01', '2026-08-28', '2026-08-22', '2026-08-15', '2026-08-09'];

function seedFees(n, { forceOver = false } = {}) {
  const count = Math.max(0, n);
  const fees = [];
  for (let i = 0; i < count; i++) {
    fees.push({
      id: `f-${i + 1}`,
      amount: AMOUNT_POOL[i % AMOUNT_POOL.length],
      tripId: `rt-${900 - i}`,
      route: ROUTE_POOL[i % ROUTE_POOL.length],
      date: DATE_POOL[i % DATE_POOL.length],
      status: 'outstanding',
      collectedOnTripId: null,
    });
  }
  if (forceOver && POLICY.recoveryThreshold) {
    const total = round2(fees.reduce((sum, f) => sum + f.amount, 0));
    if (total < POLICY.recoveryThreshold) {
      fees.push({
        id: `f-${count + 1}`,
        amount: round2(POLICY.recoveryThreshold - total + 10),
        tripId: `rt-${900 - count}`,
        route: ROUTE_POOL[count % ROUTE_POOL.length],
        date: DATE_POOL[count % DATE_POOL.length],
        status: 'outstanding',
        collectedOnTripId: null,
      });
    }
  }
  return fees;
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to a fresh, empty ledger */
  }
  return { fees: [] };
}

function save(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the session simply won't persist */
  }
}

let state = load();

// ── Demo switches ────────────────────────────────────
if (params.has('zero')) {
  state = { fees: [] };
  save(state);
} else if (params.has('full') || params.has('blocked')) {
  // `?blocked` is kept as a legacy alias so old demo links still resolve somewhere sane.
  state = { fees: seedFees(2, { forceOver: true }) };
  save(state);
} else if (params.has('fees')) {
  const n = Math.max(0, parseInt(params.get('fees'), 10) || 0);
  state = { fees: seedFees(n) };
  save(state);
}

export const shouldFailRequest = params.has('error');

// ── Reads ────────────────────────────────────────────

export function getFees() {
  return state.fees.slice();
}

/** Unpaid fees only, oldest first — the order they are recovered in (spec §3). */
export function getOutstandingFees() {
  return state.fees
    .filter((f) => f.status === 'outstanding')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** What she currently owes across every outstanding fee. */
export function getOutstandingTotal() {
  return round2(getOutstandingFees().reduce((sum, f) => sum + f.amount, 0));
}

// ── Recovery escalation (spec §3 / #4002) ───────────

/**
 * 'ok'   → below the threshold: her oldest fee alone is recovered next ride
 * 'full' → at/above it: her whole outstanding balance is recovered in one payment
 * A threshold of 0 disables the escalation entirely.
 */
export function getRecoveryState() {
  if (!POLICY.recoveryThreshold) return 'ok';
  return getOutstandingTotal() >= POLICY.recoveryThreshold ? 'full' : 'ok';
}

export function isFullRecovery() {
  return getRecoveryState() === 'full';
}

// ── Recovery (spec §3 / #4000, #4002) ───────────────

/** Every fee her next completed trip will recover — all of them above the threshold. */
export function getRecoverableFees() {
  const outstanding = getOutstandingFees();
  if (!outstanding.length) return [];
  return isFullRecovery() ? outstanding : [outstanding[0]];
}

/** What her next completed trip will add to the fare. */
export function getRecoveryAmount() {
  return round2(getRecoverableFees().reduce((sum, f) => sum + f.amount, 0));
}

/** The oldest outstanding fee, or null. Kept for screens that show a single fee. */
export function getNextRecoverableFee() {
  const [next] = getOutstandingFees();
  return next || null;
}

/**
 * Mark a fee as recovered on a trip. Posts no separate ledger entry in this mock —
 * the fee record itself carries its own status, same effect as the spec's
 * `fee_collected` entry cancelling the `cancellation_fee` entry out.
 */
export function recoverFee(id, tripId) {
  const fee = state.fees.find((f) => f.id === id && f.status === 'outstanding');
  if (!fee) return null;
  fee.status = 'collected';
  fee.collectedOnTripId = tripId || null;
  save(state);
  return fee;
}

/**
 * Recover everything this trip is due to take — one fee below the threshold, all of
 * them above it. Returns the recovered fees; their total is what was added to the fare.
 */
export function recoverDueFees(tripId) {
  const due = getRecoverableFees();
  due.forEach((f) => recoverFee(f.id, tripId));
  return due;
}

/** The fee (if any) recovered on a given trip — used by trip-detail for historic trips. */
export function getFeeRecoveredOnTrip(tripId) {
  if (!tripId) return null;
  return state.fees.find((f) => f.status === 'collected' && f.collectedOnTripId === tripId) || null;
}

/** Total recovered on a given trip — more than one fee when it cleared a full balance. */
export function getAmountRecoveredOnTrip(tripId) {
  if (!tripId) return 0;
  return round2(
    state.fees
      .filter((f) => f.status === 'collected' && f.collectedOnTripId === tripId)
      .reduce((sum, f) => sum + f.amount, 0),
  );
}

export function resetStore() {
  state = { fees: [] };
  save(state);
}
