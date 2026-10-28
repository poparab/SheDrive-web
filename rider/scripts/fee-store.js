/**
 * fee-store.js — rider outstanding-fee ledger, mock (spec §2.2 / API #1775, #4000, #4002, #5913, #5632)
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
 * Recovery is unconditional (spec §3): her *entire* outstanding balance is recovered on
 * her next completed trip, every time — no drip, no oldest-fee-first ordering, no
 * threshold to escalate past. She always leaves that ride owing nothing.
 *
 * She is never blocked from booking. A block would deadlock — taking a ride is the only
 * way a cash rider can clear a fee. Abuse is handled by suspending the rider (#1740).
 *
 * Each fee carries one status (API #5913, "Fee status"):
 *   unsettled → she owes it; her whole outstanding balance is added to her next ride
 *   settled   → recovered on a later trip (`recoveredOnTripId` names it)
 *   waived    → SheDrive waived it (admin fee waive). A fee waived after she had
 *               already paid it still carries `recoveredOnTripId` and becomes a
 *               credit (API #5632).
 *
 * Demo switches (query string), honoured by every screen that reads this store:
 *   ?fees=N        seed a fee history of N fees, newest first: the newest is unsettled,
 *                  the third (N ≥ 3) was waived, the rest were settled. ?fees=2 is
 *                  API #5913 Scenario 1; ?fees=25 shows the 20-per-page paging.
 *   ?zero          zero balance, no fees ever
 *   ?error         the request fails
 *   ?state=credit  adds a fee she paid and SheDrive later waived — her credit (#5632)
 */

const STORAGE_KEY = 'shedrive.riderFees';

/** Fee-ledger entry types and their direction. Mirrors the spec §2.2 table. */
export const FEE_TYPES = {
  cancellation_fee: { key: 'fees.type.cancellation', sign: -1 },
  fee_collected: { key: 'fees.type.collected', sign: +1 },
};

/** Fee status — label key and badge tone (API #5913 "Fee status"). */
export const FEE_STATUS = {
  unsettled: { key: 'fees.status.unsettled', tone: 'brand' },
  settled: { key: 'fees.status.settled', tone: 'success' },
  waived: { key: 'fees.status.waived', tone: 'neutral' },
};

const params = new URLSearchParams(location.search);

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** A small pool of routes/amounts/times to seed demo fees from — mirrors finance-store.js's style. */
const ROUTE_POOL = [
  { ar: 'مدينة الشيخ زايد ← مطار القاهرة', en: 'Sheikh Zayed City → Cairo Airport' },
  { ar: 'الدقي ← القطامية', en: 'Dokki → Katameya' },
  { ar: 'المهندسين ← مصر الجديدة', en: 'Mohandessin → Heliopolis' },
  { ar: 'حلوان ← وسط البلد', en: 'Helwan → Downtown' },
  { ar: 'الشروق ← المعادي', en: 'Shorouk → Maadi' },
  { ar: 'التجمع الخامس ← الزمالك', en: 'New Cairo → Zamalek' },
];
const AMOUNT_POOL = [20, 20, 15, 25, 30, 20];
const TIME_POOL = ['18:38', '09:12', '21:05', '13:47', '07:30', '16:20'];

/** Cairo local date-time `YYYY-MM-DDTHH:MM`, 6·i days before Sep 10, 2026. */
function chargedAtFor(i) {
  const day = new Date(Date.UTC(2026, 8, 10 - i * 6));
  return `${day.toISOString().slice(0, 10)}T${TIME_POOL[i % TIME_POOL.length]}`;
}

function seedFees(n) {
  const count = Math.max(0, n);
  const fees = [];
  for (let i = 0; i < count; i++) {
    const status = i === 0 ? 'unsettled' : i === 2 ? 'waived' : 'settled';
    const chargedAt = chargedAtFor(i);
    fees.push({
      id: `f-${i + 1}`,
      amount: AMOUNT_POOL[i % AMOUNT_POOL.length],
      tripId: `rt-${900 - 2 * i}`,
      route: ROUTE_POOL[i % ROUTE_POOL.length],
      chargedAt,
      date: chargedAt.slice(0, 10),
      status,
      // A settled fee was recovered on the ride she took next.
      recoveredOnTripId: status === 'settled' ? `rt-${901 - 2 * i}` : null,
    });
  }
  return fees;
}

/** The fee behind the ?state=credit demo: she paid it, then SheDrive waived it (#5632). */
const CREDIT_FEE = {
  id: 'f-credit',
  amount: 20,
  tripId: 'rt-861',
  route: { ar: 'الزمالك ← التجمع الخامس', en: 'Zamalek → New Cairo' },
  chargedAt: '2026-08-18T20:15',
  date: '2026-08-18',
  status: 'waived',
  recoveredOnTripId: 'rt-862',
};

/** Fees saved by an older session used `outstanding` / `collected`; read them as today's statuses. */
function normalise(fee) {
  const status = { outstanding: 'unsettled', collected: 'settled' }[fee.status] || fee.status;
  const chargedAt = fee.chargedAt || `${fee.date || '2026-09-01'}T12:00`;
  return {
    ...fee,
    status,
    chargedAt,
    date: chargedAt.slice(0, 10),
    recoveredOnTripId: fee.recoveredOnTripId ?? fee.collectedOnTripId ?? null,
  };
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { fees: (saved.fees || []).map(normalise) };
    }
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
} else if (params.has('fees')) {
  const n = Math.max(0, parseInt(params.get('fees'), 10) || 0);
  state = { fees: seedFees(n) };
  save(state);
}

// Kept in memory only, so the credit never leaks into a later screen's session.
if (params.get('state') === 'credit' && !params.has('zero') && !state.fees.some((f) => f.id === CREDIT_FEE.id)) {
  state = { fees: [...state.fees, { ...CREDIT_FEE }] };
}

export const shouldFailRequest = params.has('error');

const newestFirst = (a, b) => (a.chargedAt < b.chargedAt ? 1 : a.chargedAt > b.chargedAt ? -1 : 0);

// ── Reads ────────────────────────────────────────────

export function getFees() {
  return state.fees.slice();
}

/** Every fee she has been charged, newest first (API #5913 fee history). */
export function getFeeHistory() {
  return state.fees.slice().sort(newestFirst);
}

/** Unsettled fees only, oldest first — the order recovery reads them in. */
export function getOutstandingFees() {
  return state.fees.filter((f) => f.status === 'unsettled').sort((a, b) => newestFirst(b, a));
}

/** What she currently owes: the sum of her unsettled fees. */
export function getOutstandingTotal() {
  return round2(getOutstandingFees().reduce((sum, f) => sum + f.amount, 0));
}

/**
 * Her credit (API #5632): fees she had already paid that SheDrive then waived.
 * Returns the amount and the fees it came from, newest first. Shown, never spent.
 */
export function getCredit() {
  const fees = state.fees.filter((f) => f.status === 'waived' && f.recoveredOnTripId).sort(newestFirst);
  return { amount: round2(fees.reduce((sum, f) => sum + f.amount, 0)), fees };
}

// ── Recovery (spec §3 / #4000, #4002) ───────────────

/** Every unsettled fee — her next completed trip recovers all of them, always. */
export function getRecoverableFees() {
  return getOutstandingFees();
}

/** What her next completed trip will add to the fare — her entire outstanding total. */
export function getRecoveryAmount() {
  return getOutstandingTotal();
}

/** The oldest unsettled fee, or null. Kept for screens that show a single fee. */
export function getNextRecoverableFee() {
  const [next] = getOutstandingFees();
  return next || null;
}

/**
 * Mark a fee as settled on a trip. Posts no separate ledger entry in this mock —
 * the fee record itself carries its own status, same effect as the spec's
 * `fee_collected` entry cancelling the `cancellation_fee` entry out.
 */
export function recoverFee(id, tripId) {
  const fee = state.fees.find((f) => f.id === id && f.status === 'unsettled');
  if (!fee) return null;
  fee.status = 'settled';
  fee.recoveredOnTripId = tripId || null;
  save(state);
  return fee;
}

/**
 * Recover everything she owes on this trip — her whole outstanding balance, every
 * time. Returns the recovered fees; their total is what was added to the fare.
 */
export function recoverDueFees(tripId) {
  const due = getRecoverableFees();
  due.forEach((f) => recoverFee(f.id, tripId));
  return due;
}

/** The fee (if any) recovered on a given trip — used by trip-detail for historic trips. */
export function getFeeRecoveredOnTrip(tripId) {
  if (!tripId) return null;
  return state.fees.find((f) => f.status === 'settled' && f.recoveredOnTripId === tripId) || null;
}

/** Total recovered on a given trip — more than one fee when several were owed at once. */
export function getAmountRecoveredOnTrip(tripId) {
  if (!tripId) return 0;
  return round2(
    state.fees
      .filter((f) => f.status === 'settled' && f.recoveredOnTripId === tripId)
      .reduce((sum, f) => sum + f.amount, 0),
  );
}

export function resetStore() {
  state = { fees: [] };
  save(state);
}
