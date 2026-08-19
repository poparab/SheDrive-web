/**
 * mutations.js — SheDrive admin session-persistent mock mutations
 *
 * Without this, every admin action is lost the moment the screen navigates:
 * approving an application would bounce back to a queue that still shows it.
 * That reads as a broken prototype even though the action "worked".
 *
 * So mutations are recorded as a small patch set in sessionStorage and replayed
 * onto the seed data when any screen loads. The result is a clickable prototype
 * where a decision on one screen is visible on the next.
 *
 * Scope is deliberately a session: closing the tab resets to the seed, and
 * "Reset demo data" in the sidebar clears it on demand.
 */

const STORE_KEY = 'shedrive.adminMockMutations';

const EMPTY = {
  drivers: {},   // id -> patched fields
  riders: {},
  reports: {},
  admins: {},
  trips: {},     // id -> patched fields (status, driver, stateHistory)
  zones: {},     // id -> patched fields (incl. rateCard)
  zonesCreated: [],
  zonesDeleted: [],
  adminsCreated: [],
  auditAdded: [],
  policies: null,
};

function read() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(EMPTY);
    return { ...structuredClone(EMPTY), ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(state) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // Private-mode or quota failure — the mockup still works, just not across
    // navigations. Not worth surfacing to the user.
  }
}

let state = read();

/** Merge `fields` into the recorded patch for one record. */
export function patch(collection, id, fields) {
  const key = String(id);
  state[collection] = state[collection] ?? {};
  state[collection][key] = { ...(state[collection][key] ?? {}), ...fields };
  write(state);
}

export function recordZoneCreate(zone) {
  state.zonesCreated.push(zone);
  write(state);
}

export function recordZoneDelete(id) {
  state.zonesDeleted.push(String(id));
  delete state.zones[String(id)];
  state.zonesCreated = state.zonesCreated.filter((z) => String(z.id) !== String(id));
  write(state);
}

export function recordAdminCreate(admin) {
  state.adminsCreated.push(admin);
  write(state);
}

/** #1816 requires trip cancel/reassign to appear in the audit log. */
export function recordAuditEntry(entry) {
  state.auditAdded.push(entry);
  write(state);
}

export function recordPolicies(policies) {
  state.policies = policies;
  write(state);
}

export function clearMutations() {
  state = structuredClone(EMPTY);
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

export function hasMutations() {
  return (
    Object.keys(state.drivers).length > 0 ||
    Object.keys(state.riders).length > 0 ||
    Object.keys(state.reports).length > 0 ||
    Object.keys(state.admins).length > 0 ||
    Object.keys(state.trips).length > 0 ||
    Object.keys(state.zones).length > 0 ||
    state.zonesCreated.length > 0 ||
    state.zonesDeleted.length > 0 ||
    state.adminsCreated.length > 0 ||
    state.auditAdded.length > 0 ||
    state.policies !== null
  );
}

/**
 * Replay the recorded patches onto the seed collections. Called once by
 * mock-api.js at import time, before any screen reads data.
 */
export function applyMutations({
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
}) {
  applyPatches(DRIVERS, state.drivers);
  applyPatches(RIDERS, state.riders);
  applyPatches(SAFETY_REPORTS, state.reports);
  applyPatches(ADMINS, state.admins);
  applyPatches(TRIPS, state.trips);

  if (AUDIT_ENTRIES && state.auditAdded.length) {
    state.auditAdded.forEach((entry) => {
      if (!AUDIT_ENTRIES.some((e) => e.id === entry.id)) AUDIT_ENTRIES.push(entry);
    });
    AUDIT_ENTRIES.sort((a, b) => b.at - a.at);
  }

  state.adminsCreated.forEach((admin) => {
    if (!ADMINS.some((a) => String(a.id) === String(admin.id))) ADMINS.unshift(admin);
  });

  // Zones need their derived `status` getter, so they are rebuilt rather than
  // spread — a plain object would lose it.
  state.zonesCreated.forEach((raw) => {
    if (ZONES.some((z) => String(z.id) === String(raw.id))) return;
    const zone = makeZone(raw);
    ZONES.push(zone);
    ZONES_BY_ID.set(String(zone.id), zone);
  });

  Object.entries(state.zones).forEach(([id, fields]) => {
    const zone = ZONES_BY_ID.get(String(id));
    if (zone) Object.assign(zone, fields);
  });

  state.zonesDeleted.forEach((id) => {
    const index = ZONES.findIndex((z) => String(z.id) === String(id));
    if (index !== -1) ZONES.splice(index, 1);
    ZONES_BY_ID.delete(String(id));
  });

  if (state.policies) {
    if (state.policies.cancellation) {
      Object.assign(GLOBAL_POLICIES.cancellation, state.policies.cancellation);
    }
    if (state.policies.commission) {
      Object.assign(GLOBAL_POLICIES.commission, state.policies.commission);
    }
  }
}

function applyPatches(collection, patches) {
  Object.entries(patches).forEach(([id, fields]) => {
    const record = collection.find((item) => String(item.id) === String(id));
    if (record) Object.assign(record, fields);
  });
}
