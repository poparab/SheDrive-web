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
  TRIPS,
  TRIPS_BY_ID,
  ZONES,
  ZONES_BY_ID,
  makeZone,
} from './seed.js';
import {
  applyMutations,
  patch,
  recordAdminCreate,
  recordAuditEntry,
  recordPolicies,
  recordZoneCreate,
  recordZoneDelete,
} from './mutations.js';

// Replay this session's recorded actions onto the seed before any screen reads
// it, so a decision made on one screen is visible on the next.
applyMutations({
  DRIVERS,
  RIDERS,
  SAFETY_REPORTS,
  ADMINS,
  TRIPS,
  AUDIT_ENTRIES,
  ZONES,
  ZONES_BY_ID,
  GLOBAL_POLICIES,
  makeZone,
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

  listApplications({ search = '', from = '', to = '', page = 1, pageSize = 20, sort } = {}) {
    const filtered = APPLICATIONS.filter(
      (app) =>
        (matchesText(app.name, search) || matchesText(app.phone, search)) &&
        inDateRange(app.submittedAt, from, to),
    );
    // #1657: default sort is submission date, oldest first.
    const sorted = sortRows(filtered, sort, { key: 'submittedAt', dir: 'asc' });
    return respond(paginate(sorted, page, pageSize), { emptyValue: emptyPage(pageSize) });
  },

  getApplication(id) {
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver || driver.status !== 'pending') {
      return respond(null, { emptyValue: null });
    }
    return respond(driver, { emptyValue: null });
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

  reinstateDriver(id) {
    const driver = DRIVERS_BY_ID.get(String(id));
    if (!driver) return Promise.reject(new MockApiError('Driver not found.', 404));
    driver.status = 'approved';
    driver.suspensionReason = null;
    driver.decisionHistory.push({
      state: 'reinstated',
      at: Date.now(),
      actor: CURRENT_ADMIN.email,
      note: null,
    });
    patch('drivers', id, {
      status: driver.status,
      suspensionReason: null,
      decisionHistory: driver.decisionHistory,
    });
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
    rider.status = 'suspended';
    rider.suspensionReason = reason === 'Other' && note ? note : reason;
    rider.suspendedAt = Date.now();
    patch('riders', id, {
      status: rider.status,
      suspensionReason: rider.suspensionReason,
      suspendedAt: rider.suspendedAt,
    });
    return respond({ ok: true, status: rider.status });
  },

  reinstateRider(id) {
    const rider = RIDERS_BY_ID.get(String(id));
    if (!rider) return Promise.reject(new MockApiError('Rider not found.', 404));
    rider.status = 'active';
    rider.suspensionReason = null;
    rider.suspendedAt = null;
    patch('riders', id, { status: 'active', suspensionReason: null, suspendedAt: null });
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
        rider.suspendedAt = Date.now();
      } else {
        rider.status = 'active';
        rider.suspensionReason = null;
      }
      patch('riders', rider.id, {
        status: rider.status,
        suspensionReason: rider.suspensionReason,
        suspendedAt: rider.suspendedAt ?? null,
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
    recordPolicies(structuredClone(GLOBAL_POLICIES));
    return respond({ ok: true });
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

    const summary = {
      completedTrips: completed.length,
      grossFares,
      commission,
      cancellationFees,
      netDriverEarnings,
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
    const cashPortion = round2(
      trips.filter((t) => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.fare.total, 0),
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
