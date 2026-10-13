/**
 * finance-store.js — driver balance ledger, mock (#TBD-A / API #1781, #TBD-F)
 *
 * One signed balance per driver, in EGP:
 *   negative → she owes the platform  (outstanding — cleared by a settlement)
 *   positive → the platform owes her  (available  — what SheDrive owes her)
 *
 * The balance is always the sum of the ledger; nothing ever writes it directly.
 *
 * A driver never requests a payout (spec §5). Finance transfers the money on
 * its own cycle and then records the transfer in admin-v2, which posts a
 * `payout` debit here. There is no request, no reservation, and nothing for
 * her to initiate — she only ever reads her balance and sees the payout land
 * in her statement, the same way she sees a settlement.
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
 *   ?error        the balance request fails
 *   ?riderfee=N   (cash-collection.html only) rider fee recovered on this trip
 *   ?state=payout-failed  the last payout line failed (balance.html banner)
 */

const STORAGE_KEY = 'shedrive.driverFinance';

/** Global policy — configured by the super admin (#TBD-B). */
export const POLICY = {
  balanceLimit: 500,          // 0 disables the go-online block
  warnAtFraction: 0.8,        // warning band from 80% of the limit
};

/** Ledger entry types and their direction. Mirrors spec §2.1. */
export const ENTRY_TYPES = {
  trip_commission:              { key: 'driver.txn.tripCommission',     sign: -1 },
  trip_earnings:                { key: 'driver.txn.tripEarnings',       sign: +1 },
  driver_cancellation_fee:      { key: 'driver.txn.cancellationFee',    sign: -1 },
  rider_cancellation_fee_credit: { key: 'driver.txn.cancellationCredit', sign: +1 },
  rider_fee_recovery:           { key: 'driver.txn.riderFeeRecovery',   sign: -1 },
  settlement:                   { key: 'driver.txn.settlement',         sign: +1 },
  payout:                       { key: 'driver.txn.payout',             sign: -1 },
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
    { id: 'e4',  type: 'rider_cancellation_fee_credit', amount:  20, at: '2026-06-21', tripId: 't-898', route: { ar: 'المهندسين ← مصر الجديدة',  en: 'Mohandessin → Heliopolis' } },
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
    // A payout Finance already sent her — recorded on admin-v2/balances.html,
    // never requested by her (spec §5).
    { id: 'e22', type: 'payout',                       amount: -180, at: '2026-05-10', ref: 'PO-2201' },
  ].concat(payableSeed());
}

/**
 * Payable entries (payouts spec §3): `trip_earnings` and
 * `rider_cancellation_fee_credit` are what SheDrive owes her, so each carries
 * `dueAt` (= `at` + 7 days) and a `payoutStatus`. The demo's "today" is DEMO_TODAY.
 * The three paid trips are the 245.50 EGP batch line sent to her Vodafone Cash
 * wallet (payout PO-2245, and the "Payout sent" notification).
 */
export const DEMO_TODAY = '2026-06-23';

/** Payout status of a payable entry — label key and badge tone. */
export const PAYOUT_STATUS = {
  on_hold:     { key: 'driver.payoutStatus.onHold',     tone: 'neutral' },
  due:         { key: 'driver.payoutStatus.due',        tone: 'brand' },
  in_transfer: { key: 'driver.payoutStatus.inTransfer', tone: 'info' },
  paid:        { key: 'driver.payoutStatus.paid',       tone: 'success' },
  failed:      { key: 'driver.payoutStatus.failed',     tone: 'danger' },
};

const PAYABLE_TYPES = new Set(['trip_earnings', 'rider_cancellation_fee_credit']);

function payableSeed() {
  return [
    { id: 'p1', type: 'trip_earnings', amount: 72.5,   at: '2026-06-20', dueAt: '2026-06-27', payoutStatus: 'on_hold',     tripId: 't-896', route: { ar: 'مدينة نصر ← الزمالك',  en: 'Nasr City → Zamalek' } },
    { id: 'p2', type: 'trip_earnings', amount: 46,     at: '2026-06-15', dueAt: '2026-06-22', payoutStatus: 'due',         tripId: 't-879', route: { ar: 'المعادي ← الدقي',       en: 'Maadi → Dokki' } },
    { id: 'p3', type: 'trip_earnings', amount: 54,     at: '2026-06-12', dueAt: '2026-06-19', payoutStatus: 'in_transfer', tripId: 't-869', route: { ar: 'التجمع ← مصر الجديدة',  en: 'New Cairo → Heliopolis' } },
    { id: 'p4', type: 'payout',        amount: -245.5, at: '2026-06-16', ref: 'PO-2245' },
    { id: 'p5', type: 'trip_earnings', amount: 65,     at: '2026-06-07', dueAt: '2026-06-14', payoutStatus: 'paid',        tripId: 't-843', route: { ar: 'الهرم ← المهندسين',     en: 'Haram → Mohandessin' } },
    { id: 'p6', type: 'trip_earnings', amount: 82,     at: '2026-06-05', dueAt: '2026-06-12', payoutStatus: 'paid',        tripId: 't-832', route: { ar: 'الزمالك ← المعادي',     en: 'Zamalek → Maadi' } },
    { id: 'p7', type: 'trip_earnings', amount: 98.5,   at: '2026-06-03', dueAt: '2026-06-10', payoutStatus: 'paid',        tripId: 't-826', route: { ar: 'الشيخ زايد ← التجمع',   en: 'Sheikh Zayed → New Cairo' } },
  ];
}

/** Give a payable entry without payout fields (an older seed or saved session) its dueAt + status. */
function withPayoutFields(entry) {
  if (!PAYABLE_TYPES.has(entry.type) || entry.payoutStatus) return entry;
  const due = new Date(`${entry.at}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 7);
  const dueAt = due.toISOString().slice(0, 10);
  return { ...entry, dueAt, payoutStatus: dueAt > DEMO_TODAY ? 'on_hold' : 'due' };
}

/** Newest first, the way the statement reads (stable for same-day entries). */
function sortEntries(entries) {
  return entries
    .map(withPayoutFields)
    .map((e, i) => [e, i])
    .sort(([a, ia], [b, ib]) => (a.at < b.at ? 1 : a.at > b.at ? -1 : ia - ib))
    .map(([e]) => e);
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...saved, entries: sortEntries(saved.entries || []) };
    }
  } catch { /* fall through to a fresh seed */ }
  return { entries: sortEntries(seedEntries()) };
}

function save(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable — the session simply won't persist */ }
}

let state = load();

/**
 * Force the ledger to a target signed balance, for the demo switches. This is
 * a test-harness artifact, not a ledger entry type the app exposes anywhere —
 * the Phase 1 ledger has no correction mechanism (spec §10).
 */
function forceBalance(target) {
  const delta = round2(target - sumEntries(state.entries));
  if (delta === 0) return;
  state.entries = [
    { id: 'demo', type: 'demo_override', amount: delta, at: '2026-06-23', ref: 'DEMO' },
    ...state.entries,
  ];
}

function sumEntries(entries) {
  return round2(entries.reduce((total, e) => total + e.amount, 0));
}

// ── Demo switches ────────────────────────────────────
if (params.has('zero')) {
  state = { entries: [] };
} else if (params.has('blocked')) {
  forceBalance(-POLICY.balanceLimit);
} else if (params.has('warn')) {
  forceBalance(-Math.round(POLICY.balanceLimit * POLICY.warnAtFraction));
} else if (params.has('owed')) {
  forceBalance(-Math.abs(Number(params.get('owed')) || 0));
} else if (params.has('available')) {
  forceBalance(Math.abs(Number(params.get('available')) || 0));
}

// ?state=payout-failed — the batch line carrying p3 came back FAILED (payouts
// spec §3): its entry is due again, and balance.html shows the failed banner.
export const payoutFailed = params.get('state') === 'payout-failed';
if (payoutFailed) {
  state.entries = state.entries.map((e) => (e.payoutStatus === 'in_transfer' ? { ...e, payoutStatus: 'failed' } : e));
}

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

/** What SheDrive owes her. Zero when she owes. */
export function getAvailable() {
  const b = getBalance();
  return b > 0 ? b : 0;
}

/** The statement rows. The demo balance-forcing row is a harness artifact with no
 * cause she could read, so it never reaches the screen — the balance still counts it. */
export function getEntries() {
  return state.entries.filter((e) => e.type !== 'demo_override');
}

/** What is on hold and what is due for payout, from the payable entries (payouts spec §3). */
export function getPayoutSummary() {
  let onHold = 0;
  let due = 0;
  state.entries.forEach((e) => {
    if (e.payoutStatus === 'on_hold') onHold += e.amount;
    if (e.payoutStatus === 'due' || e.payoutStatus === 'failed') due += e.amount;
  });
  return { onHold: round2(onHold), due: round2(due) };
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
 * settlement, payout) just reads the entries it posts.
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

export function resetStore() {
  state = { entries: sortEntries(seedEntries()) };
  save(state);
}
