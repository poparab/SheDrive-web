/**
 * finance-store.js — driver balance ledger, mock (#TBD-A / API #1781, #TBD-C, #TBD-F)
 *
 * One signed balance per driver, in EGP:
 *   negative → she owes the platform  (outstanding — cleared by a settlement)
 *   positive → the platform owes her  (available  — drawn on by a withdrawal)
 *
 * The balance is always the sum of the ledger; nothing ever writes it directly.
 * Withdrawal requests reserve against the available balance and only post a
 * `withdrawal` entry when Finance marks them paid — same rule as the real API.
 *
 * §1 — custody decides the ledger entry, never the payment method:
 *   custody 'driver'   (Phase 1, cash)   → she holds the fare, so `trip_commission` (−)
 *   custody 'platform' (later, online)   → the platform holds it, so `trip_earnings` (+)
 * `postTripCompletion()` below is the ONLY place that branches on custody. Every
 * other screen and function in this store just reads the resulting entries.
 *
 * Demo switches (query string), honoured by every screen that reads this store:
 *   ?owed=N       set the outstanding balance to N EGP
 *   ?available=N  set the available balance to N EGP
 *   ?blocked      outstanding balance at the limit (go-online blocked)
 *   ?warn         outstanding balance in the warning band
 *   ?zero         zero balance, no transactions
 *   ?nowithdraw   withdrawals disabled platform-wide
 *   ?error        the balance request fails
 *   ?riderfee=N   (cash-collection.html only) rider fee recovered on this trip
 */

const STORAGE_KEY = 'shedrive.driverFinance';

/** Global policy — configured by the super admin (#TBD-B). */
export const POLICY = {
  balanceLimit: 500,          // 0 disables the go-online block
  warnAtFraction: 0.8,        // warning band from 80% of the limit
  withdrawalsEnabled: true,
  minWithdrawal: 50,
  maxWithdrawal: 2000,        // null = no cap
  coolingOffDays: 7,
};

/** Ledger entry types and their direction. Mirrors spec §2.1. */
export const ENTRY_TYPES = {
  trip_commission:              { key: 'driver.txn.tripCommission',     sign: -1 },
  trip_earnings:                { key: 'driver.txn.tripEarnings',       sign: +1 },
  driver_cancellation_fee:      { key: 'driver.txn.cancellationFee',    sign: -1 },
  rider_cancellation_fee_share: { key: 'driver.txn.cancellationShare',  sign: +1 },
  rider_fee_recovery:           { key: 'driver.txn.riderFeeRecovery',   sign: -1 },
  settlement:                   { key: 'driver.txn.settlement',         sign: +1 },
  withdrawal:                   { key: 'driver.txn.withdrawal',         sign: -1 },
  adjustment:                   { key: 'driver.txn.adjustment',         sign: 0  },
};

/**
 * Settlement channels (spec §5) — configurable, not hard-coded. Reference is
 * required for every channel except `office_cash`, where it is optional and
 * defaults to the generated receipt number.
 */
export const SETTLEMENT_CHANNELS = [
  { id: 'office_cash',    key: 'driver.settle.channel.officeCash',    refRequired: false },
  { id: 'bank_deposit',   key: 'driver.settle.channel.bankDeposit',   refRequired: true  },
  { id: 'mobile_wallet',  key: 'driver.settle.channel.mobileWallet',  refRequired: true  },
  { id: 'field_agent',    key: 'driver.settle.channel.fieldAgent',    refRequired: true  },
];

const params = new URLSearchParams(location.search);

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Seed ledger — the Phase 1 norm: a cash driver who owes the platform commission. */
function seedEntries() {
  return [
    { id: 'e1',  type: 'trip_commission',              amount: -13, at: '2026-06-22', tripId: 't-901', route: { ar: 'المعادي ← مدينة نصر',     en: 'Maadi → Nasr City' } },
    { id: 'e2',  type: 'driver_cancellation_fee',      amount: -10, at: '2026-06-22', tripId: 't-900', route: { ar: 'الدقي ← القطامية',        en: 'Dokki → Katameya' } },
    { id: 'e3',  type: 'trip_commission',              amount: -17, at: '2026-06-21', tripId: 't-899', route: { ar: 'الزمالك ← التجمع الخامس', en: 'Zamalek → New Cairo' } },
    { id: 'e4',  type: 'rider_cancellation_fee_share', amount:  15, at: '2026-06-21', tripId: 't-898', route: { ar: 'المهندسين ← مصر الجديدة',  en: 'Mohandessin → Heliopolis' } },
    { id: 'e4b', type: 'rider_fee_recovery',           amount: -20, at: '2026-06-21', tripId: 't-898', route: { ar: 'المهندسين ← مصر الجديدة',  en: 'Mohandessin → Heliopolis' } },
    { id: 'e5',  type: 'trip_commission',              amount: -10, at: '2026-06-20', tripId: 't-897', route: { ar: 'المهندسين ← مصر الجديدة',  en: 'Mohandessin → Heliopolis' } },
    { id: 'e6',  type: 'trip_commission',              amount: -22, at: '2026-06-19', tripId: 't-893', route: { ar: 'حلوان ← وسط البلد',        en: 'Helwan → Downtown' } },
    { id: 'e7',  type: 'trip_commission',              amount: -18, at: '2026-06-18', tripId: 't-889', route: { ar: 'الشروق ← المعادي',         en: 'Shorouk → Maadi' } },
    { id: 'e8',  type: 'trip_commission',              amount: -15, at: '2026-06-17', tripId: 't-885', route: { ar: 'الرحاب ← المعادي',         en: 'Rehab → Maadi' } },
    { id: 'e9',  type: 'settlement',                   amount: 300, at: '2026-06-15', ref: 'S-1042', channel: 'office_cash' },
    { id: 'e10', type: 'trip_commission',              amount: -30, at: '2026-06-14', tripId: 't-880', route: { ar: 'العباسية ← المهندسين',     en: 'Abbassia → Mohandessin' } },
    { id: 'e11', type: 'trip_commission',              amount: -28, at: '2026-06-13', tripId: 't-877', route: { ar: 'مدينة نصر ← الهرم',        en: 'Nasr City → Haram' } },
    { id: 'e12', type: 'trip_commission',              amount: -26, at: '2026-06-12', tripId: 't-871', route: { ar: 'التجمع ← الزمالك',         en: 'New Cairo → Zamalek' } },
    { id: 'e13', type: 'trip_commission',              amount: -24, at: '2026-06-11', tripId: 't-866', route: { ar: 'المقطم ← وسط البلد',       en: 'Mokattam → Downtown' } },
    { id: 'e14', type: 'trip_commission',              amount: -22, at: '2026-06-10', tripId: 't-861', route: { ar: 'الدقي ← مصر الجديدة',      en: 'Dokki → Heliopolis' } },
    { id: 'e15', type: 'trip_commission',              amount: -20, at: '2026-06-09', tripId: 't-855', route: { ar: 'المعادي ← الزمالك',        en: 'Maadi → Zamalek' } },
    { id: 'e16', type: 'trip_commission',              amount: -25, at: '2026-06-08', tripId: 't-850', route: { ar: 'الشيخ زايد ← المهندسين',   en: 'Sheikh Zayed → Mohandessin' } },
    { id: 'e17', type: 'trip_commission',              amount: -35, at: '2026-06-07', tripId: 't-844', route: { ar: '6 أكتوبر ← التجمع',        en: '6th October → New Cairo' } },
    { id: 'e18', type: 'trip_commission',              amount: -40, at: '2026-06-06', tripId: 't-838', route: { ar: 'العاصمة الإدارية ← المعادي', en: 'New Capital → Maadi' } },
    { id: 'e19', type: 'trip_commission',              amount: -80, at: '2026-06-05', tripId: 't-830', route: { ar: 'الإسكندرية ← القاهرة',     en: 'Alexandria → Cairo' } },
    { id: 'e20', type: 'settlement',                   amount: 200, at: '2026-05-30', ref: 'S-0987', channel: 'bank_deposit', reference: 'TRX-88213' },
    { id: 'e21', type: 'settlement',                   amount: 150, at: '2026-05-18', ref: 'S-0911', channel: 'field_agent', reference: 'AGT-4471' },
  ];
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through to a fresh seed */ }
  return { entries: seedEntries(), withdrawals: [] };
}

function save(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable — the session simply won't persist */ }
}

let state = load();

/** Force the ledger to a target signed balance, for the demo switches. */
function forceBalance(target) {
  const delta = round2(target - sumEntries(state.entries));
  if (delta === 0) return;
  state.entries = [
    { id: 'demo', type: 'adjustment', amount: delta, at: '2026-06-23', ref: 'DEMO' },
    ...state.entries,
  ];
}

function sumEntries(entries) {
  return round2(entries.reduce((total, e) => total + e.amount, 0));
}

// ── Demo switches ────────────────────────────────────
if (params.has('zero')) {
  state = { entries: [], withdrawals: [] };
} else if (params.has('blocked')) {
  forceBalance(-POLICY.balanceLimit);
} else if (params.has('warn')) {
  forceBalance(-Math.round(POLICY.balanceLimit * POLICY.warnAtFraction));
} else if (params.has('owed')) {
  forceBalance(-Math.abs(Number(params.get('owed')) || 0));
} else if (params.has('available')) {
  forceBalance(Math.abs(Number(params.get('available')) || 0));
}
if (params.has('nowithdraw')) POLICY.withdrawalsEnabled = false;

export const shouldFailRequest = params.has('error');

// ── Reads ────────────────────────────────────────────

/** Signed balance: negative = she owes, positive = the platform owes her. */
export function getBalance() {
  return sumEntries(state.entries);
}

/** What she owes the platform. Zero when the balance is positive. */
export function getOutstanding() {
  const b = getBalance();
  return b < 0 ? round2(-b) : 0;
}

/** What the platform owes her, before reservations. Zero when she owes. */
export function getAvailable() {
  const b = getBalance();
  return b > 0 ? b : 0;
}

/** Sum of pending and approved withdrawals — held against the available balance. */
export function getReserved() {
  return round2(
    state.withdrawals
      .filter((w) => w.status === 'pending' || w.status === 'approved')
      .reduce((total, w) => total + w.amount, 0),
  );
}

/** What she can actually request right now. */
export function getRequestable() {
  return Math.max(0, round2(getAvailable() - getReserved()));
}

export function getEntries() {
  return state.entries.slice();
}

export function getWithdrawals() {
  return state.withdrawals.slice();
}

export function getLastSettlement() {
  const s = state.entries.find((e) => e.type === 'settlement');
  return s ? { amount: s.amount, date: s.at } : null;
}

/** Every settlement she has been credited, newest first (settle.html history). */
export function getSettlements() {
  return state.entries
    .filter((e) => e.type === 'settlement')
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Rider fee recovered on the current trip, for the cash-collection demo (?riderfee=N). */
export function getDemoRiderFee() {
  const raw = params.get('riderfee');
  return raw ? Math.abs(round2(Number(raw))) || 0 : 0;
}

// ── Trip completion (§1, §3) ─────────────────────────

/**
 * Post the ledger entries a completed trip produces. This is the ONLY place that
 * branches on custody — everything downstream (balance, statement, gate,
 * settlement, withdrawals) just reads the entries it posts.
 *
 *   custody 'driver'   → `trip_commission` (−commission): she holds the fare.
 *   custody 'platform' → `trip_earnings` (+net): the platform holds the fare.
 *
 * When she also collected a rider's outstanding fee in cash on the platform's
 * behalf (§3), a separate `rider_fee_recovery` (−) entry is posted alongside —
 * commission is never taken from a recovered fee, so it never touches `commission`.
 */
export function postTripCompletion({ tripId, fare, commission, custody = 'driver', riderFeeRecovered = 0, route, at }) {
  const date = at || new Date().toISOString().slice(0, 10);
  const entries = [];

  if (custody === 'platform') {
    entries.push({ id: `${tripId}-earn`, type: 'trip_earnings', amount: round2(fare - commission), at: date, tripId, route });
  } else {
    entries.push({ id: `${tripId}-comm`, type: 'trip_commission', amount: -round2(commission), at: date, tripId, route });
  }

  if (riderFeeRecovered > 0) {
    entries.push({ id: `${tripId}-fee`, type: 'rider_fee_recovery', amount: -round2(riderFeeRecovered), at: date, tripId, route });
  }

  state.entries = [...entries, ...state.entries];
  save(state);
  return entries;
}

// ── Balance-limit gate (#TBD-F) ──────────────────────

/** 'ok' | 'warn' | 'blocked' — the limit of 0 disables the gate entirely. */
export function getLimitState() {
  if (!POLICY.balanceLimit) return 'ok';
  const owed = getOutstanding();
  if (owed >= POLICY.balanceLimit) return 'blocked';
  if (owed >= POLICY.balanceLimit * POLICY.warnAtFraction) return 'warn';
  return 'ok';
}

export function isGoOnlineBlocked() {
  return getLimitState() === 'blocked';
}

// ── Withdrawals (#TBD-C) ─────────────────────────────

/** The most recent request that starts the cooling-off clock. */
function lastRequestAt() {
  const dates = state.withdrawals.map((w) => new Date(w.requestedAt).getTime());
  return dates.length ? Math.max(...dates) : null;
}

/** null when she may request now, otherwise the date she may request again. */
export function getCooldownUntil() {
  if (!POLICY.coolingOffDays) return null;
  const last = lastRequestAt();
  if (!last) return null;
  const until = new Date(last + POLICY.coolingOffDays * 86400000);
  return until.getTime() > Date.now() ? until : null;
}

/**
 * Why the withdrawal form cannot be shown, or null when it can.
 * 'disabled' | 'no-balance' | 'below-minimum' | 'cooldown'
 */
export function getWithdrawalBlockReason() {
  if (!POLICY.withdrawalsEnabled) return 'disabled';
  const requestable = getRequestable();
  if (requestable <= 0) return 'no-balance';
  if (requestable < POLICY.minWithdrawal) return 'below-minimum';
  if (getCooldownUntil()) return 'cooldown';
  return null;
}

/** Upper bound for one request: the cap, or what is left unreserved. */
export function getMaxRequestable() {
  const requestable = getRequestable();
  return POLICY.maxWithdrawal ? Math.min(POLICY.maxWithdrawal, requestable) : requestable;
}

/**
 * Validate an amount against policy and the unreserved balance.
 * Returns { ok: true } or { ok: false, key, vars } for the caller to translate.
 */
export function validateAmount(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { ok: false, key: 'driver.withdraw.errEmpty' };
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, key: 'driver.withdraw.errInvalid' };
  }
  if (amount < POLICY.minWithdrawal) {
    return { ok: false, key: 'driver.withdraw.errMin', vars: { min: POLICY.minWithdrawal } };
  }
  const max = getMaxRequestable();
  if (amount > max) {
    return { ok: false, key: 'driver.withdraw.errMax', vars: { max } };
  }
  return { ok: true, amount: round2(amount) };
}

/** Create a pending request. Reserves the amount; posts no ledger entry. */
export function requestWithdrawal(amount) {
  const check = validateAmount(amount);
  if (!check.ok) return check;
  const request = {
    id: `w-${Date.now()}`,
    amount: check.amount,
    status: 'pending',
    requestedAt: new Date().toISOString().slice(0, 10),
    decidedAt: null,
    reason: null,
  };
  state.withdrawals = [request, ...state.withdrawals];
  save(state);
  return { ok: true, request };
}

/** Driver-side cancel — pending only. Releases the reservation. */
export function cancelWithdrawal(id) {
  const request = state.withdrawals.find((w) => w.id === id);
  if (!request || request.status !== 'pending') return { ok: false };
  request.status = 'cancelled';
  request.decidedAt = new Date().toISOString().slice(0, 10);
  save(state);
  return { ok: true };
}

export function resetStore() {
  state = { entries: seedEntries(), withdrawals: [] };
  save(state);
}
