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
  WITHDRAWALS,
  WITHDRAWALS_BY_ID,
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
} from './mutations.js';

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
  WITHDRAWALS,
  WITHDRAWALS_BY_ID,
  recomputeBalances,
  RIDER_LEDGER_ENTRIES,
  RIDER_LEDGER_BY_RIDER,
  recomputeRiderBalances,
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

/** Pending and approved withdrawals hold against the available balance. */
function reservedFor(driverId) {
  return round2(
    allWithdrawals()
      .filter((w) => w.driverId === String(driverId))
      .filter((w) => w.status === 'pending' || w.status === 'approved')
      .reduce((total, w) => total + w.amount, 0),
  );
}

/** #TBD-F — a limit of 0 disables the gate entirely. */
function isGoOnlineBlocked(driver) {
  const limit = GLOBAL_POLICIES.driverBalance.outstandingLimit;
  return Boolean(limit) && driver.outstanding >= limit;
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
 * Spec §3/§4 — at or above the threshold her whole balance is recovered on the next
 * ride rather than one fee at a time. A threshold of 0 disables the escalation.
 * This is NOT a booking gate: a rider is never blocked on account of what she owes.
 */
function isFullRecovery(rider) {
  const threshold = GLOBAL_POLICIES.riderFee.recoveryThreshold;
  return Boolean(threshold) && rider.outstanding >= threshold;
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

function allWithdrawals() {
  return WITHDRAWALS.slice();
}

function withdrawalById(id) {
  return WITHDRAWALS_BY_ID.get(String(id)) ?? null;
}

function applyWithdrawal(request, fields) {
  Object.assign(request, fields);
  patch('withdrawals', request.id, fields);
}

/** Build an audit entry without appending it twice — addAuditEntry does that. */
function makeAuditEntry(actionType, targetType, targetId, before, after) {
  return addAuditEntry(actionType, targetType, targetId, before, after, Date.now());
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
    return CURRENT_ADMIN;
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
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Application not found.', 404));
    driver.status = 'approved';
    driver.decisionHistory.push({
      state: 'approved',
      at: Date.now(),
      actor: CURRENT_ADMIN.email,
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
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Application not found.', 404));
    driver.status = 'rejected';
    driver.rejectionReason = reason;
    driver.decisionHistory.push({
      state: 'rejected',
      at: Date.now(),
      actor: CURRENT_ADMIN.email,
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

  /** Approved and suspended drivers only — the #1833 report's driver picker. */
  listSettleableDrivers() {
    const rows = DRIVERS.filter((d) =>
      ['approved', 'suspended', 'pending_suspension'].includes(d.status),
    ).map((d) => ({ id: d.id, name: d.name, status: d.status }));
    return respond(rows, { emptyValue: [], latency: 160 });
  },

  getDriver(id) {
    return respond(DRIVERS_BY_ID.get(String(id)) ?? null, { emptyValue: null });
  },

  suspendDriver(id, reason, note) {
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
      actor: CURRENT_ADMIN.email,
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
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const at = Date.now();
    // A reinstatement is as consequential as a suspension, so it carries its own
    // recorded reason rather than being an unexplained status flip.
    const recordedReason = reason === 'Other' && note ? note : reason;
    const previousStatus = driver.status;

    driver.status = 'approved';
    driver.suspensionReason = null;
    driver.reinstatement = { reason: recordedReason, note: note || null, by: CURRENT_ADMIN.email, at };
    driver.decisionHistory.push({
      state: 'reinstated',
      at,
      actor: CURRENT_ADMIN.email,
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
    const rider = RIDERS_BY_ID.get(String(id));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));
    const at = Date.now();
    rider.status = 'suspended';
    rider.suspensionReason = reason === 'Other' && note ? note : reason;
    rider.suspendedAt = at;
    rider.suspendedBy = CURRENT_ADMIN.email;
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
    rider.reinstatement = { reason: recordedReason, note: note || null, by: CURRENT_ADMIN.email, at };

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
      vehicle: `${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.plate}`,
      homeArea: driver.homeArea,
      rating: driver.avgRating,
    }));

    return respond(rows, { emptyValue: [], latency: 200 });
  },

  cancelTrip(id, reason, note) {
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
    trip.cancellation = { reason: recordedReason, note: note || null, by: CURRENT_ADMIN.email, at };
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
    report.resolvedBy = CURRENT_ADMIN.email;

    if (rider) {
      if (resolution === 'suspended') {
        rider.status = 'suspended';
        rider.suspensionReason = note || 'Gender-mismatch report upheld';
        rider.suspendedAt = report.resolvedAt;
        rider.suspendedBy = CURRENT_ADMIN.email;
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
      rider.suspendedBy = CURRENT_ADMIN.email;
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
      driver.suspendedBy = CURRENT_ADMIN.email;
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
    sosCase.closedBy = CURRENT_ADMIN.email;

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
    // The map needs every matching zone, not just the current page.
    return respond(
      { ...page1, allMatching: sorted.map(serialiseZone) },
      { emptyValue: { ...emptyPage(pageSize), allMatching: [] } },
    );
  },

  getZone(id) {
    const zone = ZONES_BY_ID.get(String(id));
    return respond(zone ? serialiseZone(zone) : null, { emptyValue: null });
  },

  createZone({ name, polygon }) {
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
      createdBy: CURRENT_ADMIN.email,
      createdAt: Date.now(),
    };
    const zone = makeZone(spec);
    ZONES.push(zone);
    ZONES_BY_ID.set(String(zone.id), zone);
    recordZoneCreate(spec);
    return respond({ ok: true, id: zone.id, status: zone.status });
  },

  updateZone(id, { name, polygon }) {
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
    const index = ZONES.findIndex((z) => String(z.id) === String(id));
    if (index === -1) return Promise.reject(new MockApiError('Zone not found.', 404));
    ZONES.splice(index, 1);
    ZONES_BY_ID.delete(String(id));
    recordZoneDelete(id);
    return respond({ ok: true });
  },

  /** #1757: saving a valid rate card is what makes a zone Active. */
  saveRateCard(id, rateCard) {
    const zone = ZONES_BY_ID.get(String(id));
    if (!zone) return Promise.reject(new MockApiError('Zone not found.', 404));
    if (Number(rateCard.minFare) < Number(rateCard.baseFare)) {
      return Promise.reject(
        new MockApiError('Minimum fare cannot be less than base fare.', 422),
      );
    }
    zone.rateCard = {
      baseFare: Number(rateCard.baseFare),
      perKm: Number(rateCard.perKm),
      perMin: Number(rateCard.perMin),
      minFare: Number(rateCard.minFare),
      cancellationFee: Number(rateCard.cancellationFee ?? 0),
      updatedAt: Date.now(),
    };
    patch('zones', id, { rateCard: zone.rateCard });
    return respond({ ok: true, status: zone.status });
  },

  removeRateCard(id) {
    const zone = ZONES_BY_ID.get(String(id));
    if (!zone) return Promise.reject(new MockApiError('Zone not found.', 404));
    zone.rateCard = null;
    patch('zones', id, { rateCard: null });
    return respond({ ok: true, status: zone.status });
  },

  getPolicies() {
    return respond(structuredClone(GLOBAL_POLICIES), { emptyValue: structuredClone(GLOBAL_POLICIES) });
  },

  savePolicies(next) {
    if (next.cancellation) {
      Object.assign(GLOBAL_POLICIES.cancellation, next.cancellation, {
        updatedAt: Date.now(),
        updatedBy: CURRENT_ADMIN.email,
      });
    }
    if (next.commission) {
      Object.assign(GLOBAL_POLICIES.commission, next.commission, {
        updatedAt: Date.now(),
        updatedBy: CURRENT_ADMIN.email,
      });
    }
    if (next.driverBalance) {
      Object.assign(GLOBAL_POLICIES.driverBalance, next.driverBalance, {
        updatedAt: Date.now(),
        updatedBy: CURRENT_ADMIN.email,
      });
    }
    if (next.riderFee) {
      Object.assign(GLOBAL_POLICIES.riderFee, next.riderFee, {
        updatedAt: Date.now(),
        updatedBy: CURRENT_ADMIN.email,
      });
    }
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    return respond({ ok: true });
  },

  // ── Driver balance ledger (#TBD-A / #1813 / #TBD-E) ─

  /**
   * Enum options the settlement and payout forms bind to. These are config,
   * not list rows, so ?state=empty must not null them out — every screen that
   * awaits this immediately before calling load() (balances.js, withdrawals.js,
   * rider-balances.js) would otherwise throw before its own ?state= handling
   * ever gets a chance to run.
   */
  getFinanceOptions() {
    const payload = {
      settlementMethods: SETTLEMENT_METHODS.slice(),
      payoutMethods: PAYOUT_METHODS.slice(),
      policy: structuredClone(GLOBAL_POLICIES.driverBalance),
      // The rider-fee side of the same policy surface (spec §4) — used by
      // rider-balances.html's waive/adjust forms and its recovery-mode pill.
      riderFeePolicy: structuredClone(GLOBAL_POLICIES.riderFee),
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
        if (filter === 'owing') return d.outstanding > 0;
        if (filter === 'owed') return d.available > 0;
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
          balance: d.balance,
          outstanding: d.outstanding,
          available: d.available,
          lastSettlementAt: lastSettlement ? lastSettlement.at : null,
          // The go-online gate reads the live balance (#TBD-F).
          goOnlineBlocked: isGoOnlineBlocked(d),
        };
      });

    const sorted = sortRows(rows, sort, { key: 'outstanding', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /** #1813 Scenario 2 — a driver's full, immutable transaction history. */
  getDriverLedger({ driverId, page = 1, pageSize = 20 } = {}) {
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const entries = ledgerFor(driverId);
    const payload = {
      driver: {
        id: driver.id,
        name: driver.name,
        status: driver.status,
        balance: driver.balance,
        outstanding: driver.outstanding,
        available: driver.available,
        reserved: reservedFor(driverId),
        goOnlineBlocked: isGoOnlineBlocked(driver),
      },
      ...paginate(entries, page, pageSize),
    };
    return respond(payload, { emptyValue: { ...payload, ...emptyPage(pageSize) } });
  },

  /**
   * #1813 Scenarios 3–7 — record cash received from a driver.
   * Posts a `settlement` credit; never edits the balance directly.
   */
  recordSettlement(driverId, { amount, date, method, note = '' } = {}) {
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return Promise.reject(new MockApiError('Enter a valid amount.', 422));
    }
    if (driver.outstanding <= 0) {
      return Promise.reject(new MockApiError('This driver has nothing outstanding to settle.', 409));
    }
    if (value > driver.outstanding) {
      return Promise.reject(
        new MockApiError('Amount must not exceed the outstanding balance.', 422),
      );
    }
    if (!method) return Promise.reject(new MockApiError('Select a settlement method.', 422));

    // A settlement dated today is valid at any hour, so the future check compares
    // calendar days. Today is stamped at the current time; an earlier date at local
    // noon, which keeps it on the intended day in any timezone.
    const now = Date.now();
    let at = now;
    if (date) {
      const parsed = new Date(`${date}T12:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return Promise.reject(new MockApiError('Invalid date format.', 422));
      }
      const chosenDay = new Date(parsed).setHours(0, 0, 0, 0);
      const today = new Date(now).setHours(0, 0, 0, 0);
      if (chosenDay > today) {
        return Promise.reject(new MockApiError('Date cannot be in the future.', 422));
      }
      at = chosenDay === today ? now : parsed.getTime();
    }

    const before = driver.balance;
    // Every settlement generates a receipt number, shown to the admin and
    // visible in the driver's own statement (spec §5).
    const entry = postLedgerEntry(driver, 'settlement', value, at, {
      method,
      ref: nextSettlementReceipt(),
      note: note || 'Cash received from driver',
      actor: CURRENT_ADMIN.email,
    });

    // before/after must be plain objects — audit-log.js diffs them by key with
    // `key in before`, which throws if before/after are formatted strings.
    // makeAuditEntry already persists the entry; no separate recordAuditEntry call.
    makeAuditEntry('settlement', 'driver', driver.id, { balance: before }, { balance: driver.balance });
    return respond({ ok: true, entry, balance: driver.balance, outstanding: driver.outstanding });
  },

  /**
   * #1813 Scenarios 8–9 — a manual correction. Positive credits the driver,
   * negative debits her. Never overwrites an entry: it posts a reversing one.
   */
  postAdjustment(driverId, { amount, reason } = {}) {
    const driver = DRIVERS_BY_ID.get(String(driverId));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));

    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      return Promise.reject(new MockApiError('Enter a non-zero amount.', 422));
    }
    if (!reason || String(reason).trim().length < 10) {
      return Promise.reject(
        new MockApiError('Reason must be between 10 and 500 characters.', 422),
      );
    }

    const before = driver.balance;
    const entry = postLedgerEntry(driver, 'adjustment', value, Date.now(), {
      note: String(reason).trim(),
      actor: CURRENT_ADMIN.email,
    });

    makeAuditEntry('adjustment', 'driver', driver.id, { balance: before }, { balance: driver.balance });
    return respond({ ok: true, entry, balance: driver.balance, outstanding: driver.outstanding });
  },

  // ── Rider fee ledger (financial core spec §2.2, FIN-11) ────

  /**
   * Riders with an outstanding cancellation fee.
   * filter: 'owing' (default) | 'all'
   */
  listRiderBalances({ search = '', filter = 'owing', page = 1, pageSize = 20, sort = null } = {}) {
    const term = search.trim().toLowerCase();

    const rows = RIDERS.filter((r) => (filter === 'owing' ? r.outstanding > 0 : true))
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
          lastFeeAt: lastFee ? lastFee.at : null,
          // The booking gate reads the live balance (spec §4).
          fullRecovery: isFullRecovery(r),
        };
      });

    const sorted = sortRows(rows, sort, { key: 'outstanding', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /** A rider's full, immutable fee ledger — mirrors getDriverLedger. */
  getRiderLedger({ riderId, page = 1, pageSize = 20 } = {}) {
    const rider = RIDERS_BY_ID.get(String(riderId));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));

    const entries = riderLedgerFor(riderId);
    const payload = {
      rider: {
        id: rider.id,
        name: rider.name,
        status: rider.status,
        balance: rider.balance ?? 0,
        outstanding: rider.outstanding ?? 0,
        fullRecovery: isFullRecovery(rider),
      },
      ...paginate(entries, page, pageSize),
    };
    return respond(payload, { emptyValue: { ...payload, ...emptyPage(pageSize) } });
  },

  /**
   * Write off a rider's outstanding fee with a required reason. Posts a
   * `fee_waived` credit for the full outstanding amount — never edits the
   * original `cancellation_fee` entry (spec §2.3: entries are immutable).
   */
  waiveRiderFee(riderId, { entryId, reason } = {}) {
    const rider = RIDERS_BY_ID.get(String(riderId));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));
    if (!(rider.outstanding > 0)) {
      return Promise.reject(new MockApiError('This rider has no outstanding fee to waive.', 409));
    }
    if (!reason || String(reason).trim().length < 10) {
      return Promise.reject(
        new MockApiError('Reason must be between 10 and 500 characters.', 422),
      );
    }
    const entry = entryId ? riderLedgerFor(riderId).find((e) => e.id === entryId) : null;
    if (entryId && !entry) {
      return Promise.reject(new MockApiError('Fee entry not found.', 404));
    }

    const before = rider.outstanding;
    const posted = postRiderLedgerEntry(rider, 'fee_waived', rider.outstanding, Date.now(), {
      tripId: entry?.tripId ?? null,
      note: String(reason).trim(),
      actor: CURRENT_ADMIN.email,
    });

    makeAuditEntry('adjustment', 'rider', rider.id, { outstanding: before }, { outstanding: rider.outstanding });
    return respond({ ok: true, entry: posted, balance: rider.balance, outstanding: rider.outstanding });
  },

  /**
   * A manual correction to a rider's fee balance — same sign convention as the
   * driver-side postAdjustment: the amount is added straight to her balance, so
   * positive credits her (reduces what she owes), negative debits her (adds to
   * what she owes).
   */
  postRiderAdjustment(riderId, { amount, reason } = {}) {
    const rider = RIDERS_BY_ID.get(String(riderId));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));

    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      return Promise.reject(new MockApiError('Enter a non-zero amount.', 422));
    }
    if (!reason || String(reason).trim().length < 10) {
      return Promise.reject(
        new MockApiError('Reason must be between 10 and 500 characters.', 422),
      );
    }

    const before = rider.outstanding;
    const entry = postRiderLedgerEntry(rider, 'adjustment', value, Date.now(), {
      note: String(reason).trim(),
      actor: CURRENT_ADMIN.email,
    });

    makeAuditEntry('adjustment', 'rider', rider.id, { outstanding: before }, { outstanding: rider.outstanding });
    return respond({ ok: true, entry, balance: rider.balance, outstanding: rider.outstanding });
  },

  // ── Settlement day book (financial core spec §5, FIN-12) ───

  /**
   * Every settlement recorded across every driver, for Finance to reconcile
   * against the bank. Totals are computed over the whole filtered set (every
   * matching settlement), not just the current page.
   */
  listSettlements({ from = '', to = '', method = 'all', adminId = 'all', page = 1, pageSize = 20, sort = null } = {}) {
    const filtered = LEDGER_ENTRIES.filter(
      (e) =>
        e.type === 'settlement' &&
        inDateRange(e.at, from, to) &&
        (method === 'all' || e.method === method) &&
        (adminId === 'all' || e.actor === adminId),
    ).map((e) => {
      const driver = DRIVERS_BY_ID.get(e.driverId);
      return {
        ...e,
        driverName: driver ? driver.name : e.driverId,
      };
    });

    const sorted = sortRows(filtered, sort, { key: 'at', dir: 'desc' });
    const page1 = paginate(sorted, page, pageSize);

    const byChannel = new Map();
    const byAdmin = new Map();
    let grandTotal = 0;
    filtered.forEach((e) => {
      grandTotal += e.amount;
      const channel = byChannel.get(e.method) ?? { key: e.method, count: 0, amount: 0 };
      channel.count += 1;
      channel.amount = round2(channel.amount + e.amount);
      byChannel.set(e.method, channel);

      const admin = byAdmin.get(e.actor) ?? { key: e.actor, count: 0, amount: 0 };
      admin.count += 1;
      admin.amount = round2(admin.amount + e.amount);
      byAdmin.set(e.actor, admin);
    });

    return respond(
      {
        ...page1,
        totals: {
          grandTotal: round2(grandTotal),
          count: filtered.length,
          byChannel: [...byChannel.values()].sort((a, b) => b.amount - a.amount),
          byAdmin: [...byAdmin.values()].sort((a, b) => b.amount - a.amount),
        },
      },
      {
        emptyValue: {
          ...emptyPage(pageSize),
          totals: { grandTotal: 0, count: 0, byChannel: [], byAdmin: [] },
        },
      },
    );
  },

  // ── Withdrawal requests (#TBD-E) ────────────────────

  listWithdrawals({ status = 'pending', search = '', from = '', to = '', page = 1, pageSize = 20, sort = null } = {}) {
    const term = search.trim().toLowerCase();

    const rows = allWithdrawals()
      .filter((w) => status === 'all' || w.status === status)
      .filter((w) => inDateRange(w.requestedAt, from, to))
      .filter((w) => {
        if (!term) return true;
        const driver = DRIVERS_BY_ID.get(w.driverId);
        return w.driverName.toLowerCase().includes(term) || (driver?.phone ?? '').includes(term);
      })
      .map((w) => {
        const driver = DRIVERS_BY_ID.get(w.driverId);
        return {
          ...w,
          currentBalance: driver ? driver.balance : 0,
          currentAvailable: driver ? driver.available : 0,
          // #TBD-E Scenario 9 — her balance may have moved since she asked.
          shortfall: driver ? round2(Math.max(0, w.amount - driver.available)) : w.amount,
        };
      });

    const sorted = sortRows(rows, sort, { key: 'requestedAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  /**
   * #TBD-E Scenarios 2–7 — approve, reject, or mark paid.
   * Only mark-paid moves money: it posts the `withdrawal` debit to the ledger.
   */
  decideWithdrawal(id, action, { payoutMethod = '', payoutRef = '', reason = '' } = {}) {
    const request = withdrawalById(id);
    if (!request) return Promise.reject(new MockApiError('Request not found.', 404));

    const driver = DRIVERS_BY_ID.get(request.driverId);
    const previous = request.status;

    if (action === 'approve') {
      if (previous !== 'pending') {
        return Promise.reject(new MockApiError('Only a pending request can be approved.', 409));
      }
      // Spec §5 — a payout destination is required before a request can be
      // approved, so it is on file by the time it reaches Mark paid.
      if (!driver?.payoutDestination) {
        return Promise.reject(
          new MockApiError('This driver has no payout destination on file yet.', 422),
        );
      }
      applyWithdrawal(request, { status: 'approved', decidedAt: Date.now(), decidedBy: CURRENT_ADMIN.email });
    } else if (action === 'reject') {
      if (previous !== 'pending') {
        return Promise.reject(new MockApiError('Only a pending request can be rejected.', 409));
      }
      if (!reason || String(reason).trim().length < 10) {
        return Promise.reject(
          new MockApiError('Reason must be between 10 and 500 characters.', 422),
        );
      }
      // Rejection releases the reservation and posts nothing to the ledger.
      applyWithdrawal(request, {
        status: 'rejected',
        reason: String(reason).trim(),
        decidedAt: Date.now(),
        decidedBy: CURRENT_ADMIN.email,
      });
    } else if (action === 'pay') {
      if (previous !== 'approved') {
        return Promise.reject(new MockApiError('Approve the request before marking it paid.', 409));
      }
      if (!payoutMethod) {
        return Promise.reject(new MockApiError('Select a payout method.', 422));
      }
      if (!driver || request.amount > driver.available) {
        return Promise.reject(
          new MockApiError('Her available balance no longer covers this request.', 409),
        );
      }
      // This is the money-moving step — the only one that debits the ledger.
      postLedgerEntry(driver, 'withdrawal', -request.amount, Date.now(), {
        note: `Withdrawal ${request.id} paid by ${payoutMethod}`,
        method: payoutMethod,
        ref: payoutRef || null,
        actor: CURRENT_ADMIN.email,
      });
      applyWithdrawal(request, {
        status: 'paid',
        payoutMethod,
        payoutRef: payoutRef || null,
        decidedAt: Date.now(),
        decidedBy: CURRENT_ADMIN.email,
      });
    } else {
      return Promise.reject(new MockApiError('Unknown action.', 400));
    }

    // before/after must be plain objects — see the note on recordSettlement.
    makeAuditEntry('withdrawal', 'driver', request.driverId, { status: previous }, { status: request.status });
    return respond({ ok: true, request: { ...request } });
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
      ...paginate(trips, page, pageSize),
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

  // ── Admin users (#1807, #1820, #1821) ───────────────

  listAdmins({ search = '', status = 'all', page = 1, pageSize = 20, sort } = {}) {
    const filtered = ADMINS.filter(
      (admin) =>
        matchesText(admin.email, search) && (status === 'all' || admin.status === status),
    );
    const sorted = sortRows(filtered, sort, { key: 'createdAt', dir: 'desc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  createAdmin({ email }) {
    const normalised = String(email).trim().toLowerCase();
    if (ADMINS.some((a) => a.email.toLowerCase() === normalised)) {
      return Promise.reject(new MockApiError('An admin with this email already exists.', 409));
    }
    const admin = {
      id: Date.now(),
      email: normalised,
      status: 'active',
      createdAt: Date.now(),
      lastLoginAt: null,
      twoFactorEnrolled: false,
    };
    ADMINS.unshift(admin);
    recordAdminCreate(admin);
    return respond({ ok: true, id: admin.id });
  },

  setAdminStatus(id, status) {
    const admin = ADMINS.find((a) => String(a.id) === String(id));
    if (!admin) return Promise.reject(new MockApiError('Admin not found.', 404));
    if (String(admin.id) === String(CURRENT_ADMIN.id) && status === 'disabled') {
      return Promise.reject(new MockApiError('You cannot disable your own account.', 422));
    }
    admin.status = status;
    patch('admins', id, { status });
    return respond({ ok: true, status });
  },
};

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
    actor: CURRENT_ADMIN.email,
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
