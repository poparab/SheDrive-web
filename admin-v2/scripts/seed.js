/**
 * seed.js — SheDrive admin portal canonical mock dataset
 * The single shared data source for every admin mockup screen. Generated from a
 * fixed PRNG seed so the data shape is stable across reloads, while timestamps
 * are relative to load time so "today" and "x min ago" always read as live.
 *
 * FROZEN after the foundation wave: screen tracks read from this file, never
 * write to it. Screen-specific extras belong in admin/mock/.
 */

const NOW = Date.now();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Deterministic PRNG (mulberry32) so the mockup looks identical every reload. */
function makeRandom(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = makeRandom(20260729);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + rand() * (max - min);
const intBetween = (min, max) => Math.floor(between(min, max + 1));
const round2 = (n) => Math.round(n * 100) / 100;

// ── Name pools ────────────────────────────────────────
// SheDrive is women-only; riders and drivers are all women.

const FIRST_NAMES = [
  'Nour', 'Salma', 'Mariam', 'Habiba', 'Farida', 'Yasmin', 'Dina', 'Rana',
  'Hala', 'Menna', 'Aya', 'Sara', 'Nada', 'Malak', 'Jana', 'Laila',
  'Reem', 'Heba', 'Amira', 'Ghada', 'Shaimaa', 'Doaa', 'Esraa', 'Noha',
  'Rowan', 'Toqa', 'Alaa', 'Basma', 'Injy', 'Kholoud', 'Passant', 'Radwa',
];

const LAST_NAMES = [
  'Hassan', 'Ibrahim', 'Mahmoud', 'Abdelrahman', 'El-Sayed', 'Fathy',
  'Kamal', 'Mostafa', 'Shawky', 'Zaki', 'Farouk', 'Gamal', 'Nabil',
  'Ramadan', 'Sobhy', 'Tarek', 'Wagdy', 'Youssef', 'Adel', 'Bakr',
];

const LONG_NAME = 'Abdelrahman El-Sayed Mohamed Abou El-Naga Ibrahim';

const AREAS = [
  { name: 'Maadi', lng: 31.2599, lat: 29.9603 },
  { name: 'Zamalek', lng: 31.2197, lat: 30.0614 },
  { name: 'Nasr City', lng: 31.3437, lat: 30.0566 },
  { name: 'Heliopolis', lng: 31.3244, lat: 30.0885 },
  { name: 'Dokki', lng: 31.2107, lat: 30.0384 },
  { name: 'Mohandessin', lng: 31.2003, lat: 30.0554 },
  { name: 'New Cairo', lng: 31.4913, lat: 30.0074 },
  { name: 'Sheikh Zayed', lng: 30.9716, lat: 30.0405 },
  { name: '6th of October', lng: 31.2001, lat: 30.0301 },
  { name: 'Haram', lng: 31.1656, lat: 29.9866 },
  { name: 'Faisal', lng: 31.1793, lat: 29.9942 },
  { name: 'Downtown', lng: 31.2456, lat: 30.0459 },
  { name: 'Garden City', lng: 31.2312, lat: 30.0345 },
  { name: 'Agouza', lng: 31.2085, lat: 30.0668 },
  { name: 'Rehab', lng: 31.4913, lat: 30.0611 },
  { name: 'Giza', lng: 31.2089, lat: 30.0131 },
];

const STREETS = [
  'Road 9', 'Road 216', 'Abbas El-Akkad St', 'El-Nasr Rd', 'Tahrir St',
  'Gameat El-Dowal St', 'El-Merghany St', 'Makram Ebeid St', 'Shehab St',
  'El-Batal Ahmed Abdelaziz St', '90th St', 'Mossadak St', 'Kasr El-Aini St',
];

const VEHICLE_MAKES = [
  { make: 'Hyundai', models: ['Accent', 'Elantra', 'i10'] },
  { make: 'Kia', models: ['Cerato', 'Picanto', 'Rio'] },
  { make: 'Nissan', models: ['Sunny', 'Sentra'] },
  { make: 'Chevrolet', models: ['Optra', 'Aveo'] },
  { make: 'Toyota', models: ['Corolla', 'Yaris'] },
  { make: 'Renault', models: ['Logan', 'Sandero'] },
];

const VEHICLE_COLOURS = ['White', 'Silver', 'Black', 'Dark grey', 'Navy blue', 'Beige'];
const VEHICLE_TYPES = ['Sedan', 'Hatchback'];

const PLATE_LETTERS = ['ا ب ج', 'د ه و', 'ر س ص', 'ط ع ف', 'ق ل م', 'ن ه ي'];

const SUSPENSION_REASONS = [
  'Unsafe driving reported by riders',
  'Repeated trip cancellations',
  'Document expired and not renewed',
  'Policy violation — unauthorised passenger',
  'Other',
];

const RIDER_SUSPENSION_REASONS = [
  'Gender-mismatch report upheld',
  'Abusive behaviour towards a driver',
  'Repeated no-shows',
  'Fraudulent payment activity',
  'Other',
];

const REJECTION_REASONS = [
  'Driving licence expired',
  'Vehicle registration does not match the applicant',
  'National ID document illegible',
  'Vehicle older than the platform minimum',
  'Applicant did not meet the minimum age requirement',
];

const DRIVER_STATEMENTS = [
  'The passenger who came to the car was a man, not the registered rider. I did not start the trip.',
  'A male passenger tried to board saying the account belonged to his sister. I refused and reported it.',
  'Two men approached the car for this booking. I cancelled immediately and stayed in the vehicle.',
  'The rider who arrived was clearly not the account holder and was male. I reported before pickup.',
];

// ── Helpers ───────────────────────────────────────────

let idCounter = 1000;
const nextId = () => ++idCounter;

function fullName(index) {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${
    LAST_NAMES[(index * 7) % LAST_NAMES.length]
  }`;
}

function phone() {
  return `1${pick(['0', '1', '2', '5'])}${String(intBetween(10000000, 99999999)).slice(0, 8)}`;
}

function jitter(area, spread = 0.012) {
  return [
    round6(area.lng + between(-spread, spread)),
    round6(area.lat + between(-spread, spread)),
  ];
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function address(area) {
  return `${intBetween(1, 180)} ${pick(STREETS)}, ${area.name}`;
}

function plate() {
  return `${pick(PLATE_LETTERS)} ${intBetween(100, 999)}`;
}

// ── Payout destination (financial core spec §6) ───────
// Required before a payout can be recorded. Deliberately absent for a handful
// of drivers so the refused-without-a-destination case is demonstrable.

const PAYOUT_DESTINATION_TYPES = ['bank_transfer', 'mobile_wallet'];

function payoutDestinationFor(driverName) {
  const type = pick(PAYOUT_DESTINATION_TYPES);
  const number =
    type === 'bank_transfer'
      ? `EG${intBetween(10, 99)}${String(intBetween(100000000000, 999999999999))}`
      : `01${pick(['0', '1', '2', '5'])}${String(intBetween(10000000, 99999999))}`;
  return {
    type,
    number,
    holderName: driverName,
    updatedAt: NOW - intBetween(5, 200) * DAY,
  };
}

function vehicle() {
  const brand = pick(VEHICLE_MAKES);
  return {
    make: brand.make,
    model: pick(brand.models),
    year: intBetween(2016, 2024),
    plate: plate(),
    colour: pick(VEHICLE_COLOURS),
    type: pick(VEHICLE_TYPES),
  };
}

function documents(driverId) {
  return [
    { key: 'national_id', label: 'National ID', file: 'national-id.svg' },
    { key: 'driving_licence', label: 'Driving licence', file: 'driving-licence.svg' },
    { key: 'vehicle_registration', label: 'Vehicle registration', file: 'vehicle-registration.svg' },
    { key: 'criminal_record', label: 'Criminal record certificate', file: 'criminal-record.svg' },
  ].map((doc) => ({
    ...doc,
    src: `assets/${doc.file}`,
    uploadedAt: NOW - intBetween(3, 40) * DAY,
    ref: `DOC-${driverId}-${doc.key.slice(0, 3).toUpperCase()}`,
  }));
}

// ── Admin accounts ────────────────────────────────────

export const ADMINS = [
  {
    id: nextId(),
    email: 'ops.lead@shedrive.app',
    status: 'active',
    createdAt: NOW - 210 * DAY,
    lastLoginAt: NOW - 42 * MINUTE,
    twoFactorEnrolled: true,
  },
  {
    id: nextId(),
    email: 'nour.hassan@shedrive.app',
    status: 'active',
    createdAt: NOW - 168 * DAY,
    lastLoginAt: NOW - 3 * HOUR,
    twoFactorEnrolled: true,
  },
  {
    id: nextId(),
    email: 'compliance@shedrive.app',
    status: 'active',
    createdAt: NOW - 121 * DAY,
    lastLoginAt: NOW - 1 * DAY - 2 * HOUR,
    twoFactorEnrolled: true,
  },
  {
    id: nextId(),
    email: 'finance@shedrive.app',
    status: 'active',
    createdAt: NOW - 96 * DAY,
    lastLoginAt: NOW - 5 * DAY,
    twoFactorEnrolled: true,
  },
  {
    id: nextId(),
    email: 'onboarding.desk@shedrive.app',
    status: 'active',
    createdAt: NOW - 61 * DAY,
    lastLoginAt: NOW - 26 * MINUTE,
    twoFactorEnrolled: true,
  },
  {
    id: nextId(),
    email: 'temp.auditor@shedrive.app',
    status: 'disabled',
    createdAt: NOW - 54 * DAY,
    lastLoginAt: NOW - 31 * DAY,
    twoFactorEnrolled: false,
  },
  {
    id: nextId(),
    email: 'former.supervisor@shedrive.app',
    status: 'disabled',
    createdAt: NOW - 188 * DAY,
    lastLoginAt: NOW - 74 * DAY,
    twoFactorEnrolled: true,
  },
  {
    id: nextId(),
    email: 'night.desk@shedrive.app',
    status: 'active',
    createdAt: NOW - 17 * DAY,
    lastLoginAt: null,
    twoFactorEnrolled: false,
  },
];

/** The signed-in admin for the mockup session. */
export const CURRENT_ADMIN = ADMINS[0];

// ── Service zones ─────────────────────────────────────

/** Rough rectangular polygons around each area — enough to read as coverage. */
function polygonAround(lng, lat, w, h) {
  return [
    [round6(lng - w), round6(lat - h)],
    [round6(lng + w), round6(lat - h)],
    [round6(lng + w), round6(lat + h)],
    [round6(lng - w), round6(lat + h)],
    [round6(lng - w), round6(lat - h)],
  ];
}

const ZONE_DEFS = [
  { name: 'Cairo Central', lng: 31.2404, lat: 30.0459, w: 0.032, h: 0.026, rate: [18, 5.5, 0.9, 28, 12] },
  { name: 'Maadi & Kornish', lng: 31.2599, lat: 29.9603, w: 0.034, h: 0.03, rate: [20, 6, 1, 32, 15] },
  { name: 'Nasr City & Heliopolis', lng: 31.3341, lat: 30.0726, w: 0.045, h: 0.036, rate: [20, 5.75, 1, 30, 15] },
  { name: 'Mohandessin & Dokki', lng: 31.2055, lat: 30.047, w: 0.03, h: 0.028, rate: [19, 5.75, 0.95, 30, 12] },
  { name: 'New Cairo & Rehab', lng: 31.4913, lat: 30.0343, w: 0.06, h: 0.045, rate: [26, 6.75, 1.15, 45, 20] },
  { name: 'Giza & Haram', lng: 31.1872, lat: 29.9999, w: 0.042, h: 0.034, rate: [18, 5.25, 0.85, 26, 12] },
  { name: 'Sheikh Zayed & 6 October', lng: 30.9716, lat: 30.0405, w: 0.058, h: 0.042, rate: [26, 7, 1.2, 48, 20] },
  { name: 'Shorouk & Obour', lng: 31.6084, lat: 30.1421, w: 0.05, h: 0.04, rate: null },
  { name: 'Helwan South', lng: 31.3341, lat: 29.8419, w: 0.04, h: 0.035, rate: null },
];

/**
 * Build a zone with its derived `status` getter. Exported because replayed
 * session mutations need to recreate zones without losing that getter.
 */
export function makeZone({ id, name, rateCard = null, polygon, centre, createdBy, createdAt }) {
  return {
    id,
    name,
    // Status is derived from the rate card, never set by hand (#1757 Scenario 6).
    get status() {
      return this.rateCard ? 'active' : 'inactive';
    },
    rateCard,
    polygon,
    centre,
    createdBy,
    createdAt,
  };
}

export const ZONES = ZONE_DEFS.map((def, index) => {
  const rateCard = def.rate
    ? {
        baseFare: def.rate[0],
        perKm: def.rate[1],
        perMin: def.rate[2],
        minFare: def.rate[3],
        cancellationFee: def.rate[4],
        updatedAt: NOW - intBetween(2, 60) * DAY,
      }
    : null;

  return makeZone({
    id: nextId(),
    name: def.name,
    rateCard,
    polygon: polygonAround(def.lng, def.lat, def.w, def.h),
    centre: [def.lng, def.lat],
    createdBy: ADMINS[index % 4].email,
    createdAt: NOW - (150 - index * 11) * DAY,
  });
});

export const GLOBAL_POLICIES = {
  cancellation: {
    riderGracePeriodMin: 2,
    driverCancellationFee: 10,
    driverCancellationGracePeriodMin: 3,
    riderNoShowWaitMin: 5,
    updatedAt: NOW - 23 * DAY,
    updatedBy: ADMINS[0].email,
  },
  commission: {
    percentage: 18,
    updatedAt: NOW - 9 * DAY,
    updatedBy: ADMINS[0].email,
  },
  driverBalance: {
    // 0 disables the go-online block entirely (#TBD-F)
    outstandingLimit: 500,
    // Warns her in-app from this fraction of the limit (financial core spec §4).
    warningBandPct: 80,
    updatedAt: NOW - 5 * DAY,
    updatedBy: ADMINS[0].email,
  },
  // Financial core spec §4 — the rider side of the same fee-recovery model.
  riderFee: {
    // At or above this, her WHOLE outstanding balance is recovered on the next ride
    // instead of one fee at a time. 0 disables the escalation. It never blocks booking —
    // a block would deadlock, since taking a ride is the only way a cash rider can pay.
    recoveryThreshold: 60,
    // The rest is the platform's — posted as `rider_cancellation_fee_share` on the
    // driver ledger when the fee is charged, per spec §3.
    driverSharePct: 75,
    updatedAt: NOW - 12 * DAY,
    updatedBy: ADMINS[0].email,
  },
};

// ── Riders ────────────────────────────────────────────

const RIDER_COUNT = 42;

export const RIDERS = Array.from({ length: RIDER_COUNT }, (_, i) => {
  const registeredAt = NOW - intBetween(4, 320) * DAY;
  const tripsCompleted = intBetween(0, 74);
  let status = 'active';
  if (i % 13 === 5) status = 'suspended';
  else if (i % 17 === 9) status = 'pending_review';

  return {
    id: nextId(),
    name: i === 3 ? LONG_NAME : fullName(i),
    phone: phone(),
    status,
    registeredAt,
    tripsCompleted,
    lastTripAt: tripsCompleted ? NOW - intBetween(0, 40) * DAY : null,
    suspensionReason: status === 'suspended' ? pick(RIDER_SUSPENSION_REASONS) : null,
    suspendedAt: status === 'suspended' ? NOW - intBetween(1, 30) * DAY : null,
    // Riders have no decision-history timeline, so the acting admin is stored.
    suspendedBy: status === 'suspended' ? ADMINS[i % 3].email : null,
  };
});

// ── Drivers ───────────────────────────────────────────

const DRIVER_COUNT = 34;

export const DRIVERS = Array.from({ length: DRIVER_COUNT }, (_, i) => {
  const submittedAt = NOW - intBetween(1, 240) * DAY;
  let status = 'approved';
  if (i < 7) status = 'pending';
  else if (i === 8 || i === 19) status = 'rejected';
  else if (i === 11) status = 'suspended';
  else if (i === 24) status = 'pending_suspension';

  const isApproved = status === 'approved' || status === 'pending_suspension';
  const tripsCompleted = isApproved ? intBetween(3, 480) : 0;
  const homeArea = AREAS[i % AREAS.length];
  const online = isApproved && i % 3 === 0;

  const decisionHistory = [
    { state: 'submitted', at: submittedAt, actor: null, note: null },
  ];
  if (status !== 'pending') {
    const reviewedAt = submittedAt + intBetween(1, 5) * DAY;
    if (status === 'rejected') {
      decisionHistory.push({
        state: 'rejected',
        at: reviewedAt,
        actor: ADMINS[4].email,
        note: pick(REJECTION_REASONS),
      });
    } else {
      decisionHistory.push({ state: 'approved', at: reviewedAt, actor: ADMINS[4].email, note: null });
      if (status === 'suspended') {
        decisionHistory.push({
          state: 'suspended',
          at: reviewedAt + intBetween(10, 90) * DAY,
          actor: ADMINS[0].email,
          note: pick(SUSPENSION_REASONS),
        });
      }
      if (status === 'pending_suspension') {
        decisionHistory.push({
          state: 'pending_suspension',
          at: NOW - 18 * MINUTE,
          actor: ADMINS[0].email,
          note: 'Unsafe driving reported by riders — applies when the active trip ends',
        });
      }
    }
  }

  const id = nextId();
  const licenceExpiry = NOW + intBetween(-40, 900) * DAY;
  const driverName = i === 2 ? 'Mariam Abdelrahman El-Sayed Mohamed Farouk' : fullName(i + 5);
  // Deliberately absent for roughly 1 in 9 drivers — spec §6/§5: a payout
  // cannot be recorded without one, so this is what makes that refusal demonstrable.
  const hasPayoutDestination = i % 9 !== 3;

  return {
    id,
    name: driverName,
    phone: phone(),
    dob: NOW - intBetween(19, 48) * 365 * DAY,
    nid: String(intBetween(28000000000000, 30999999999999)),
    status,
    submittedAt,
    tripsCompleted,
    avgRating: tripsCompleted ? round2(between(4.1, 5)) : null,
    vehicle: vehicle(),
    licenceNumber: `DL-${intBetween(1000000, 9999999)}`,
    licenceExpiry,
    licenceExpired: licenceExpiry < NOW,
    registrationExpiry: NOW + intBetween(30, 800) * DAY,
    documents: documents(id),
    vehiclePhoto: 'assets/vehicle-photo.svg',
    profilePhoto: 'assets/profile-photo.svg',
    decisionHistory,
    rejectionReason:
      status === 'rejected'
        ? decisionHistory[decisionHistory.length - 1].note
        : null,
    suspensionReason:
      status === 'suspended' || status === 'pending_suspension'
        ? decisionHistory[decisionHistory.length - 1].note
        : null,
    homeArea: homeArea.name,
    online,
    position: online ? jitter(homeArea) : null,
    cashBalance: isApproved ? round2(between(0, 1400)) : 0,
    // Financial core spec §6 — required before a payout can be recorded.
    payoutDestination: hasPayoutDestination ? payoutDestinationFor(driverName) : null,
  };
});

/** #1657 pending queue is a derived view over DRIVERS — same people, one source. */
export const APPLICATIONS = DRIVERS.filter((d) => d.status === 'pending');

const APPROVED_DRIVERS = DRIVERS.filter(
  (d) => d.status === 'approved' || d.status === 'pending_suspension',
);

// ── Trips ─────────────────────────────────────────────

const TRIP_STATES = {
  searching: ['created', 'searching'],
  active: ['created', 'searching', 'matched', 'accepted', 'en_route_pickup', 'arrived_pickup', 'trip_started'],
  completed: [
    'created', 'searching', 'matched', 'accepted', 'en_route_pickup',
    'arrived_pickup', 'trip_started', 'trip_ended',
  ],
  expired: ['created', 'searching', 'expired'],
};

const EXPIRY_REASONS = ['no_driver', 'system_timeout', 'gender_mismatch_report'];

const RATING_TAGS = [
  'Safe driving', 'Clean car', 'Friendly', 'On time', 'Great conversation',
  'Helped with luggage', 'Knew the route',
];

function buildStateHistory(status, createdAt, expiryReason) {
  const states = TRIP_STATES[status];
  let cursor = createdAt;
  return states.map((state, index) => {
    if (index > 0) cursor += intBetween(20, 260) * 1000;
    return {
      state,
      at: cursor,
      note: state === 'expired' ? expiryReason : null,
    };
  });
}

function zoneForPoint(lng, lat) {
  const found = ZONES.find(
    (zone) =>
      lng >= zone.polygon[0][0] &&
      lng <= zone.polygon[1][0] &&
      lat >= zone.polygon[0][1] &&
      lat <= zone.polygon[2][1],
  );
  return found ?? ZONES[0];
}

function buildTrip(index) {
  const roll = rand();
  let status;
  if (index < 6) status = 'active';
  else if (index < 10) status = 'searching';
  else if (roll < 0.82) status = 'completed';
  else status = 'expired';

  // Live trips are minutes old; history spreads across the last 45 days,
  // with a deliberate cluster inside today for the dashboard's "trips today".
  let createdAt;
  if (status === 'active' || status === 'searching') {
    createdAt = NOW - intBetween(2, 40) * MINUTE;
  } else if (index < 34) {
    createdAt = NOW - intBetween(1, 15) * HOUR;
  } else {
    createdAt = NOW - intBetween(1, 45) * DAY - intBetween(0, 20) * HOUR;
  }

  const pickupArea = AREAS[index % AREAS.length];
  const destArea = AREAS[(index * 5 + 3) % AREAS.length];
  const pickupPoint = jitter(pickupArea);
  const destPoint = jitter(destArea);
  const zone = zoneForPoint(pickupPoint[0], pickupPoint[1]);
  const rateCard = zone.rateCard ?? ZONES[0].rateCard;

  const distanceKm = round2(between(2.4, 26));
  const durationMin = Math.round(distanceKm * between(2.1, 3.6));
  const estimatedFare = round2(
    Math.max(rateCard.minFare, rateCard.baseFare + distanceKm * rateCard.perKm + durationMin * rateCard.perMin),
  );

  const rider = RIDERS[index % RIDERS.length];
  const driver =
    status === 'searching' ? null : APPROVED_DRIVERS[index % APPROVED_DRIVERS.length];

  const expiryReason = status === 'expired' ? pick(EXPIRY_REASONS) : null;
  const stateHistory = buildStateHistory(status, createdAt, expiryReason);

  const trip = {
    id: `TRP-${24000 + index}`,
    riderId: rider.id,
    riderName: rider.name,
    riderPhone: rider.phone,
    driverId: driver?.id ?? null,
    driverName: driver?.name ?? null,
    driverPhone: driver?.phone ?? null,
    vehicle: driver?.vehicle ?? null,
    status,
    zoneId: zone.id,
    zoneName: zone.name,
    createdAt,
    pickup: { area: pickupArea.name, address: address(pickupArea), point: pickupPoint },
    destination: { area: destArea.name, address: address(destArea), point: destPoint },
    estimate: { fare: estimatedFare, durationMin, distanceKm },
    expiryReason,
    stateHistory,
    updatedAt: stateHistory[stateHistory.length - 1].at,
    fare: null,
    rating: null,
    route: null,
    paymentMethod: null,
    // Financial core spec §1: custody decides the ledger entry, and the payment
    // method only decides custody. `driver` in Phase 1 cash, `platform` once a
    // payment provider lands — never branch ledger logic on paymentMethod itself.
    custody: null,
  };

  if (status === 'completed') {
    const actualDistanceKm = round2(distanceKm * between(0.92, 1.14));
    const actualDurationMin = Math.round(durationMin * between(0.9, 1.25));
    const baseFare = rateCard.baseFare;
    const distanceCharge = round2(actualDistanceKm * rateCard.perKm);
    const timeCharge = round2(actualDurationMin * rateCard.perMin);
    const total = round2(Math.max(rateCard.minFare, baseFare + distanceCharge + timeCharge));
    const commissionRate = GLOBAL_POLICIES.commission.percentage;
    const commission = round2((total * commissionRate) / 100);

    trip.paymentMethod = rand() < 0.72 ? 'cash' : 'digital';
    // The only place paymentMethod is allowed to decide anything — everything
    // downstream (ledger, balances, go-online, settlement) reads custody instead.
    trip.custody = trip.paymentMethod === 'cash' ? 'driver' : 'platform';
    trip.fare = {
      baseFare,
      distanceCharge,
      timeCharge,
      total,
      cashCollected: trip.paymentMethod === 'cash' ? total : 0,
      commissionRate,
      commission,
      netEarnings: round2(total - commission),
      actualDistanceKm,
      actualDurationMin,
    };

    // Roughly one in six completed trips is left unrated (#1672 Scenario 3).
    if (rand() > 0.17) {
      const tagCount = intBetween(0, 3);
      trip.rating = {
        stars: intBetween(3, 5),
        tags: Array.from({ length: tagCount }, () => pick(RATING_TAGS)).filter(
          (tag, i, arr) => arr.indexOf(tag) === i,
        ),
        comment: null,
      };
    }

    // A coarse recorded GPS path — enough to draw the actual route travelled.
    const steps = 7;
    trip.route = Array.from({ length: steps }, (_, s) => {
      const t = s / (steps - 1);
      return [
        round6(pickupPoint[0] + (destPoint[0] - pickupPoint[0]) * t + between(-0.004, 0.004)),
        round6(pickupPoint[1] + (destPoint[1] - pickupPoint[1]) * t + between(-0.004, 0.004)),
      ];
    });
  }

  return trip;
}

export const TRIPS = Array.from({ length: 148 }, (_, i) => buildTrip(i)).sort(
  (a, b) => b.createdAt - a.createdAt,
);

/** Live trips keep their driver's marker in sync on the operations map. */
export const ACTIVE_TRIPS = TRIPS.filter((t) => t.status === 'active');
export const SEARCHING_TRIPS = TRIPS.filter((t) => t.status === 'searching');

// ── Safety reports (gender mismatch, #1810/#1811) ─────

const MISMATCH_TRIPS = TRIPS.filter(
  (t) => t.status === 'expired' && t.expiryReason === 'gender_mismatch_report',
).slice(0, 9);

export const SAFETY_REPORTS = MISMATCH_TRIPS.map((trip, index) => {
  const rider = RIDERS.find((r) => r.id === trip.riderId);
  const driver = DRIVERS.find((d) => d.id === trip.driverId) ?? APPROVED_DRIVERS[index];
  const resolved = index >= 4;
  const resolution = resolved ? (index % 2 === 0 ? 'suspended' : 'dismissed') : null;

  return {
    id: `GMR-${4100 + index}`,
    tripId: trip.id,
    riderId: rider.id,
    riderName: rider.name,
    riderPhone: rider.phone,
    driverId: driver.id,
    driverName: driver.name,
    reportedAt: trip.updatedAt,
    // Index 2 is deliberately left without a statement: it is optional on the
    // driver side (#1588), so the admin detail must have that case to show.
    statement: index === 2 ? '' : pick(DRIVER_STATEMENTS),
    status: resolved ? 'resolved' : 'open',
    resolution,
    resolutionNote:
      resolution === 'suspended'
        ? 'Driver statement consistent with trip record; rider account suspended.'
        : resolution === 'dismissed'
          ? 'Rider provided ID confirming the account holder was present. Report unfounded.'
          : null,
    resolvedAt: resolved ? trip.updatedAt + intBetween(2, 30) * HOUR : null,
    resolvedBy: resolved ? ADMINS[2].email : null,
    // Open reports hold the rider in pending_review (API #1687).
    riderStatusAtReport: resolved ? (resolution === 'suspended' ? 'suspended' : 'active') : 'pending_review',
  };
}).sort((a, b) => a.reportedAt - b.reportedAt);

// Reconcile the reported riders' actual account state with their reports. An
// open report must genuinely hold the rider in pending_review (API #1687),
// otherwise the queue and the rider profile contradict each other.
SAFETY_REPORTS.forEach((report) => {
  const rider = RIDERS.find((r) => r.id === report.riderId);
  if (!rider) return;

  if (report.status === 'open') {
    rider.status = 'pending_review';
    rider.suspensionReason = null;
    rider.suspendedAt = null;
    rider.suspendedBy = null;
  } else if (report.resolution === 'suspended') {
    rider.status = 'suspended';
    rider.suspensionReason = 'Gender-mismatch report upheld';
    rider.suspendedAt = report.resolvedAt;
    rider.suspendedBy = report.resolvedBy;
  } else if (rider.status === 'pending_review') {
    // Dismissed: back to active unless a separate suspension applies.
    rider.status = 'active';
  }
});

// ── SOS cases (raised by #1780/#1952, triaged by the admin) ─────
//
// An SOS is a parallel record, not a trip state: the trip runs on, settles and is
// rated exactly as normal, and the other occupant is never told. Only an admin
// closes a case. Source trips therefore span every status that has both parties.

// Kept separate so the note always matches who actually tapped the button — a
// rider-raised case reading "the driver reported…" undermines the whole record.
const SOS_NOTES_RIDER = [
  'Rider reported feeling unwell and asked to stop.',
  'Rider raised the alarm during a prolonged stop in traffic.',
  'Rider raised the alarm after the route deviated unexpectedly.',
  'Rider reported the driver refusing to stop at the agreed drop-off.',
];

const SOS_NOTES_DRIVER = [
  'Driver reported being followed by another vehicle.',
  'Driver reported an argument escalating inside the vehicle.',
  'Driver reported a passenger refusing to leave at the destination.',
];

const SOS_TRIP_STATES = ['en_route_pickup', 'arrived_pickup', 'trip_started'];
const SOS_OUTCOMES = ['rider_suspended', 'driver_suspended', 'resolved', 'false_alarm', 'both_suspended'];
const SOS_CONTACT_NAMES = ['Mona Adel', 'Hoda Samir', 'Nour Hassan', 'Yasmin Fouad'];
const SOS_RELATIONSHIPS = ['Sister', 'Mother', 'Friend', 'Husband'];

// Both parties must exist — an SOS is always raised from inside an occupied car.
const SOS_SOURCE_TRIPS = TRIPS.filter((t) => t.driverId && t.riderId).slice(0, 11);

export const SOS_CASES = SOS_SOURCE_TRIPS.map((trip, index) => {
  const raisedBy = index % 3 === 0 ? 'driver' : 'rider';
  const closed = index >= 5;
  const outcome = closed ? SOS_OUTCOMES[index % SOS_OUTCOMES.length] : null;
  const raisedAt = trip.createdAt + intBetween(3, 25) * MINUTE;

  return {
    id: `SOS-${7200 + index}`,
    tripId: trip.id,
    raisedBy,
    raisedAt,
    tripStateAtTrigger: SOS_TRIP_STATES[index % SOS_TRIP_STATES.length],

    riderId: trip.riderId,
    riderName: trip.riderName,
    riderPhone: trip.riderPhone,
    driverId: trip.driverId,
    driverName: trip.driverName,
    driverPhone: trip.driverPhone,
    vehicle: trip.vehicle,

    // A snapshot at the moment of the tap — never a live feed (out of scope
    // until an operations desk is staffed).
    location: {
      lat: 30.0444 + (index % 7) * 0.004,
      lng: 31.2357 + (index % 5) * 0.004,
      address: trip.pickup.address,
    },
    pickupAddress: trip.pickup.address,
    destinationAddress: trip.destination.address,
    zoneName: trip.zoneName,
    note:
      raisedBy === 'driver'
        ? SOS_NOTES_DRIVER[index % SOS_NOTES_DRIVER.length]
        : SOS_NOTES_RIDER[index % SOS_NOTES_RIDER.length],

    // Contacts alerted, each carrying the result the SMS gateway reported.
    contactsAlerted: Array.from({ length: (index % 3) + 1 }, (_, c) => ({
      name: SOS_CONTACT_NAMES[(index + c) % SOS_CONTACT_NAMES.length],
      phone: `+2010${String(20000000 + index * 137 + c * 11).slice(0, 8)}`,
      relationship: SOS_RELATIONSHIPS[(index + c) % SOS_RELATIONSHIPS.length],
      delivery: c === 0 && index % 4 === 3 ? 'failed' : 'delivered',
    })),
    liveLinkExpiresAt: raisedAt + 90 * MINUTE,

    status: closed ? 'closed' : 'open',
    outcome,
    resolutionNote: closed ? 'Reviewed against the trip record and both statements.' : null,
    closedAt: closed ? raisedAt + intBetween(1, 20) * HOUR : null,
    closedBy: closed ? ADMINS[1].email : null,
  };
}).sort((a, b) => b.raisedAt - a.raisedAt);

// ── Audit log (#1816) ─────────────────────────────────

const AUDIT_ACTORS = ADMINS.filter((a) => a.status === 'active').map((a) => a.email);

function auditEntry(actionType, targetType, targetId, before, after, at, actor) {
  return {
    id: `AUD-${nextId()}`,
    at,
    actor: actor ?? pick(AUDIT_ACTORS),
    actionType,
    targetType,
    targetId,
    before,
    after,
  };
}

const auditEntries = [];

DRIVERS.filter((d) => d.status !== 'pending').forEach((driver) => {
  const decision = driver.decisionHistory[driver.decisionHistory.length - 1];
  auditEntries.push(
    auditEntry(
      decision.state === 'rejected' ? 'reject' : decision.state === 'approved' ? 'approve' : 'suspend',
      'driver',
      driver.id,
      { status: 'pending' },
      { status: driver.status, reason: decision.note ?? undefined },
      decision.at,
      decision.actor,
    ),
  );
});

RIDERS.filter((r) => r.status === 'suspended').forEach((rider) => {
  auditEntries.push(
    auditEntry(
      'suspend',
      'rider',
      rider.id,
      { status: 'active' },
      { status: 'suspended', reason: rider.suspensionReason },
      rider.suspendedAt,
    ),
  );
});

SAFETY_REPORTS.filter((r) => r.status === 'resolved').forEach((report) => {
  auditEntries.push(
    auditEntry(
      'gender-mismatch resolution',
      'safety_report',
      report.id,
      { status: 'open' },
      { status: 'resolved', resolution: report.resolution },
      report.resolvedAt,
      report.resolvedBy,
    ),
  );
});

ZONES.filter((z) => z.rateCard).forEach((zone) => {
  auditEntries.push(
    auditEntry(
      'settlement',
      'zone',
      zone.id,
      { baseFare: round2(zone.rateCard.baseFare - between(1, 4)) },
      { baseFare: zone.rateCard.baseFare },
      zone.rateCard.updatedAt,
    ),
  );
});

ADMINS.slice(1).forEach((admin) => {
  auditEntries.push(
    auditEntry(
      'admin-account change',
      'admin',
      admin.id,
      { exists: false },
      { email: admin.email, status: admin.status },
      admin.createdAt,
    ),
  );
});

TRIPS.filter((t) => t.status === 'expired').slice(0, 6).forEach((trip) => {
  auditEntries.push(
    auditEntry('cancel', 'trip', trip.id, { status: 'searching' }, { status: 'expired' }, trip.updatedAt),
  );
});

auditEntries.push(
  auditEntry(
    'refund',
    'trip',
    TRIPS.find((t) => t.status === 'completed').id,
    { refunded: 0 },
    { refunded: 45, reason: 'Rider charged for a trip that ended early' },
    NOW - 4 * DAY,
    ADMINS[3].email,
  ),
);

export const AUDIT_ENTRIES = auditEntries.sort((a, b) => b.at - a.at);

/** Distinct actor list for the audit-log actor filter. */
export const AUDIT_ACTOR_OPTIONS = [...new Set(AUDIT_ENTRIES.map((e) => e.actor))].sort();

export const AUDIT_ACTION_TYPES = [
  'approve', 'reject', 'suspend', 'reinstate', 'cancel', 'reassign',
  'refund', 'settlement', 'payout', 'waive', 'gender-mismatch resolution',
  'sos case closed', 'admin-account change',
];

// ── Lookups ───────────────────────────────────────────

// ── Driver balance ledger (#TBD-A) ────────────────────
// One signed balance per driver, in EGP. Negative means she owes the platform
// (the Phase 1 cash norm: she keeps the fare, the commission is a debt);
// positive means the platform owes her — cleared when Finance records a payout.
//
// The balance is the sum of the ledger — nothing writes it directly. Every
// entry is immutable and nothing edits or deletes one — ever. Phase 1 has no
// correction mechanism at all (spec §10's open item): the post-adjustment
// action was cut deliberately to keep Phase 1 simple.

export const LEDGER_ENTRY_TYPES = [
  'trip_commission',
  'trip_earnings',
  'driver_cancellation_fee',
  'rider_cancellation_fee_share',
  'rider_fee_recovery',
  'settlement',
  'payout',
];

// Settlement channels — a configurable list, not hard-coded per screen (spec §5).
export const SETTLEMENT_METHODS = [
  'Cash at office',
  'Bank transfer',
  'Mobile wallet',
  'Field agent',
];
// The channel a past payout was sent through — kept only for the historical
// seed data below; a recorded payout itself reads its destination from the
// driver's payoutDestination (spec §6), not from a picked method.
export const PAYOUT_METHODS = ['Cash at office', 'Bank transfer', 'Mobile wallet'];

let ledgerSeq = 0;
const ledgerId = () => `led-${String(++ledgerSeq).padStart(5, '0')}`;

// Every settlement entry carries a receipt number shown to the admin and visible
// in the driver's own statement (spec §5). Shared by the seed generator below and
// by mock-api.js's recordSettlement, so numbering never collides within a session.
let settlementReceiptSeq = 0;
export const nextSettlementReceipt = () =>
  `S-${String(++settlementReceiptSeq).padStart(5, '0')}`;

function ledgerEntry(driverId, type, amount, at, extra = {}) {
  return {
    id: ledgerId(),
    driverId: String(driverId),
    type,
    amount: round2(amount),
    at,
    ...extra,
  };
}

const LEDGER = [];

for (const driver of DRIVERS) {
  if (!['approved', 'suspended', 'pending_suspension'].includes(driver.status)) continue;

  const trips = TRIPS.filter(
    (t) => t.status === 'completed' && String(t.driverId) === String(driver.id),
  ).sort((a, b) => a.createdAt - b.createdAt);

  trips.forEach((trip) => {
    // Custody decides the ledger entry — never paymentMethod (spec §1).
    if (trip.custody === 'driver') {
      // She holds the fare, so the platform's commission is a debt she owes.
      LEDGER.push(ledgerEntry(driver.id, 'trip_commission', -trip.fare.commission, trip.createdAt, {
        tripId: trip.id,
        note: `Commission on trip ${trip.id}`,
      }));
    } else {
      // The platform holds the fare, so her net earnings are a debt it owes her.
      LEDGER.push(ledgerEntry(driver.id, 'trip_earnings', trip.fare.netEarnings, trip.createdAt, {
        tripId: trip.id,
        note: `Net earnings on trip ${trip.id}`,
      }));
    }
  });

  // A late driver cancellation or two, and the odd rider-cancellation share.
  if (trips.length > 4 && rand() < 0.45) {
    const trip = pick(trips);
    LEDGER.push(
      ledgerEntry(
        driver.id,
        'driver_cancellation_fee',
        -GLOBAL_POLICIES.cancellation.driverCancellationFee,
        trip.createdAt + HOUR,
        { tripId: trip.id, note: 'Late cancellation after the grace period' },
      ),
    );
  }
  if (trips.length > 4 && rand() < 0.35) {
    const trip = pick(trips);
    LEDGER.push(
      ledgerEntry(driver.id, 'rider_cancellation_fee_share', intBetween(10, 18), trip.createdAt + HOUR, {
        tripId: trip.id,
        note: 'Driver share of a rider cancellation fee',
      }),
    );
  }

  // Past payouts — digital earnings do not sit on the ledger forever; Finance
  // sends them out on its own cycle and then records the transfer here, which
  // is what keeps most drivers at or below zero on cash. A payout can only be
  // recorded against a destination on file (spec §6), so this never posts one
  // for a driver who lacks one — that gap has to survive into the ledger too.
  const earned = LEDGER.filter(
    (e) => e.driverId === String(driver.id) && e.type === 'trip_earnings',
  ).reduce((total, e) => total + e.amount, 0);

  if (earned > 0 && driver.payoutDestination) {
    // Most drivers have been paid out in full; the rest still carry an
    // available balance, which is what gives balances.html's "we owe" filter
    // and the refused-without-a-destination case anything to show.
    let toDraw = round2(earned * (rand() < 0.55 ? 1 : between(0.2, 0.6)));
    const payouts = intBetween(1, 2);
    for (let i = 0; i < payouts && toDraw > 0; i += 1) {
      const slice = i === payouts - 1 ? toDraw : round2(toDraw * between(0.4, 0.6));
      LEDGER.push(
        ledgerEntry(driver.id, 'payout', -slice, NOW - intBetween(2, 50) * DAY, {
          method: pick(PAYOUT_METHODS),
          ref: `P-${intBetween(10000, 99999)}`,
          destination: driver.payoutDestination,
          note: 'Payout sent by Finance',
          actor: pick(ADMINS).email,
        }),
      );
      toDraw = round2(toDraw - slice);
    }
  }

  // Past settlements — the operational counterpart that clears what she owes.
  const settlements = rand() < 0.5 ? intBetween(0, 1) : 0;
  for (let i = 0; i < settlements; i += 1) {
    LEDGER.push(
      ledgerEntry(driver.id, 'settlement', intBetween(60, 240), NOW - intBetween(3, 60) * DAY, {
        method: pick(SETTLEMENT_METHODS),
        ref: nextSettlementReceipt(),
        note: 'Cash received from driver',
        actor: pick(ADMINS).email,
      }),
    );
  }
}

// ── Rider fee ledger (financial core spec §2.2, §3) ───
// One signed balance per rider, in EGP — zero for almost every rider, almost
// always. A late cancellation posts a debit here and (via the driver's share)
// on the driver ledger at the same moment; when the fee is recovered as a cash
// surcharge on her next trip, the SAME event posts a credit here and a matching
// `rider_fee_recovery` debit on the driver ledger — the worked example in §3.
// Built here, before LEDGER_ENTRIES/LEDGER_BY_DRIVER are finalised, so the
// driver-side entries this generates are already included in her balance.

export const RIDER_LEDGER_ENTRY_TYPES = ['cancellation_fee', 'fee_collected', 'fee_waived'];

let riderLedgerSeq = 0;
const riderLedgerId = () => `rled-${String(++riderLedgerSeq).padStart(5, '0')}`;

function riderLedgerEntry(riderId, type, amount, at, extra = {}) {
  return {
    id: riderLedgerId(),
    riderId: String(riderId),
    type,
    amount: round2(amount),
    at,
    ...extra,
  };
}

const RIDER_LEDGER = [];

// Local lookups — ZONES_BY_ID/DRIVERS_BY_ID are built further down, after this
// block runs, so this reads directly off the already-complete ZONES/DRIVERS.
const zoneByIdForFees = new Map(ZONES.map((z) => [String(z.id), z]));
const driverByIdForFees = new Map(DRIVERS.map((d) => [String(d.id), d]));

RIDERS.filter((r) => r.tripsCompleted >= 1).forEach((rider) => {
  // Roughly 1 in 5 eligible riders gets a late-cancellation fee this seed — a
  // realistic minority, never a majority (spec §2.2).
  if (rand() >= 0.2) return;

  const riderTrips = TRIPS.filter(
    (t) => String(t.riderId) === String(rider.id) && t.status === 'completed',
  ).sort((a, b) => a.createdAt - b.createdAt);
  if (!riderTrips.length) return;

  const anchor = pick(riderTrips);
  const zone = zoneByIdForFees.get(String(anchor.zoneId));
  const fee = round2(zone?.rateCard?.cancellationFee ?? 20);
  const cancelledAt = anchor.createdAt - HOUR;

  RIDER_LEDGER.push(
    riderLedgerEntry(rider.id, 'cancellation_fee', -fee, cancelledAt, {
      tripId: anchor.id,
      note: `Late cancellation after the grace period — trip ${anchor.id}`,
    }),
  );

  // The driver's share of that same fee, posted on her ledger at the same
  // moment (spec §3 step 1) — independent of whether the fee is ever recovered.
  const anchorDriver = anchor.driverId ? driverByIdForFees.get(String(anchor.driverId)) : null;
  if (anchorDriver) {
    LEDGER.push(
      ledgerEntry(
        anchorDriver.id,
        'rider_cancellation_fee_share',
        round2((fee * GLOBAL_POLICIES.riderFee.driverSharePct) / 100),
        cancelledAt,
        {
          tripId: anchor.id,
          riderId: String(rider.id),
          note: `Driver share of ${rider.name}'s cancellation fee`,
        },
      ),
    );
  }

  // About two-thirds are recovered on her next cash trip; the rest stay
  // outstanding, which is what gives rider-balances.html real rows to show.
  const recoveryTrip = riderTrips.find((t) => t.createdAt > anchor.createdAt && t.custody === 'driver');
  if (recoveryTrip && rand() < 0.65) {
    RIDER_LEDGER.push(
      riderLedgerEntry(rider.id, 'fee_collected', fee, recoveryTrip.createdAt, {
        tripId: recoveryTrip.id,
        note: `Recovered as a surcharge on trip ${recoveryTrip.id}`,
      }),
    );

    const recoveryDriver = recoveryTrip.driverId ? driverByIdForFees.get(String(recoveryTrip.driverId)) : null;
    if (recoveryDriver) {
      // The platform already holds its share via the surcharge, so this never
      // touches commission — it only reduces what the driver is owed, because
      // she collected the cash but must still hand the fee itself back.
      LEDGER.push(
        ledgerEntry(recoveryDriver.id, 'rider_fee_recovery', -fee, recoveryTrip.createdAt, {
          tripId: recoveryTrip.id,
          riderId: String(rider.id),
          note: `Collected ${rider.name}'s outstanding fee in cash on trip ${recoveryTrip.id}`,
        }),
      );
    }
  }
});

// Two deliberate repeat offenders, so the **full-recovery** state is demonstrable.
// Above the recovery threshold a rider's whole outstanding balance comes off her next
// ride at once instead of one fee at a time (spec §3). Without a rider who is actually
// over the threshold, that state can never be seen on rider-balances.html or reviewed
// by a designer. She is never blocked from booking — only her recovery escalates.
(() => {
  const threshold = GLOBAL_POLICIES.riderFee.recoveryThreshold;
  if (!threshold) return;

  const alreadyOwing = new Set(
    RIDER_LEDGER.filter((e) => e.type === 'cancellation_fee').map((e) => String(e.riderId)),
  );
  // Pick the busiest eligible riders — a repeat offender needs enough distinct trips
  // to hang several separate late cancellations off, one fee per trip.
  const tripCountByRider = TRIPS.reduce((map, t) => {
    if (['cancelled', 'completed'].includes(t.status)) {
      map.set(String(t.riderId), (map.get(String(t.riderId)) ?? 0) + 1);
    }
    return map;
  }, new Map());

  const candidates = RIDERS.filter((r) => !alreadyOwing.has(String(r.id)))
    .sort((a, b) => (tripCountByRider.get(String(b.id)) ?? 0) - (tripCountByRider.get(String(a.id)) ?? 0))
    .slice(0, 2);

  candidates.forEach((rider) => {
    // A cancellation fee belongs to a *cancelled* trip, so draw from those first and
    // fall back to completed ones only to make up the numbers.
    const riderTrips = TRIPS.filter(
      (t) => String(t.riderId) === String(rider.id) && ['cancelled', 'completed'].includes(t.status),
    ).sort((a, b) => (a.status === b.status ? a.createdAt - b.createdAt : a.status === 'cancelled' ? -1 : 1));
    if (riderTrips.length < 3) return;

    let owed = 0;
    riderTrips.slice(0, 10).forEach((trip) => {
      if (owed >= threshold + 5) return;
      const zone = zoneByIdForFees.get(String(trip.zoneId));
      const fee = round2(zone?.rateCard?.cancellationFee ?? 20);
      const cancelledAt = trip.createdAt - HOUR;
      owed = round2(owed + fee);

      RIDER_LEDGER.push(
        riderLedgerEntry(rider.id, 'cancellation_fee', -fee, cancelledAt, {
          tripId: trip.id,
          note: `Late cancellation after the grace period — trip ${trip.id}`,
        }),
      );

      const feeDriver = trip.driverId ? driverByIdForFees.get(String(trip.driverId)) : null;
      if (feeDriver) {
        LEDGER.push(
          ledgerEntry(
            feeDriver.id,
            'rider_cancellation_fee_share',
            round2((fee * GLOBAL_POLICIES.riderFee.driverSharePct) / 100),
            cancelledAt,
            {
              tripId: trip.id,
              riderId: String(rider.id),
              note: `Driver share of ${rider.name}'s cancellation fee`,
            },
          ),
        );
      }
    });

    // Guarantee the state exists. How many trips a seeded rider happens to have is
    // random, so without this top-up the full-recovery state can silently vanish from
    // the demo data on a reshuffle — and a state nobody can see is a state nobody
    // reviews. One more fee on her most recent trip puts her clearly over.
    if (owed > 0 && owed <= threshold) {
      const lastTrip = riderTrips[riderTrips.length - 1];
      const topUp = round2(threshold - owed + 5);
      RIDER_LEDGER.push(
        riderLedgerEntry(rider.id, 'cancellation_fee', -topUp, lastTrip.createdAt - HOUR, {
          tripId: lastTrip.id,
          note: `Late cancellation after the grace period — trip ${lastTrip.id}`,
        }),
      );
      const lastDriver = lastTrip.driverId ? driverByIdForFees.get(String(lastTrip.driverId)) : null;
      if (lastDriver) {
        LEDGER.push(
          ledgerEntry(
            lastDriver.id,
            'rider_cancellation_fee_share',
            round2((topUp * GLOBAL_POLICIES.riderFee.driverSharePct) / 100),
            lastTrip.createdAt - HOUR,
            {
              tripId: lastTrip.id,
              riderId: String(rider.id),
              note: `Driver share of ${rider.name}'s cancellation fee`,
            },
          ),
        );
      }
    }
  });
})();

export const RIDER_LEDGER_ENTRIES = RIDER_LEDGER.sort((a, b) => b.at - a.at);

/** riderId -> entries, newest first. */
export const RIDER_LEDGER_BY_RIDER = RIDER_LEDGER_ENTRIES.reduce((map, entry) => {
  const list = map.get(entry.riderId);
  if (list) list.push(entry);
  else map.set(entry.riderId, [entry]);
  return map;
}, new Map());

/**
 * Recompute every rider's fee position from her ledger — same rule as the
 * driver side (spec §2.3): the balance is always the sum of the entries.
 * Negative means she owes the platform (spec §2.2's `outstanding`).
 */
export function recomputeRiderBalances() {
  for (const rider of RIDERS) {
    const balance = balanceFromEntries(RIDER_LEDGER_BY_RIDER.get(String(rider.id)));
    rider.balance = balance;
    rider.outstanding = balance < 0 ? round2(-balance) : 0;
  }
}

recomputeRiderBalances();

export const LEDGER_ENTRIES = LEDGER.sort((a, b) => b.at - a.at);

/** driverId -> entries, newest first. */
export const LEDGER_BY_DRIVER = LEDGER_ENTRIES.reduce((map, entry) => {
  const list = map.get(entry.driverId);
  if (list) list.push(entry);
  else map.set(entry.driverId, [entry]);
  return map;
}, new Map());

/** The balance is always the sum of the ledger — never a stored figure. */
export function balanceFromEntries(entries = []) {
  return round2(entries.reduce((total, e) => total + e.amount, 0));
}

/**
 * Recompute every driver's position from her ledger. Called once at seed time and
 * again after session mutations replay, so a settlement recorded on one screen is
 * already reflected in the balance shown on the next.
 */
export function recomputeBalances() {
  for (const driver of DRIVERS) {
    const balance = balanceFromEntries(LEDGER_BY_DRIVER.get(String(driver.id)));
    driver.balance = balance;
    driver.outstanding = balance < 0 ? round2(-balance) : 0;
    driver.available = balance > 0 ? balance : 0;
    // Kept for #1833, which reports the outstanding cash position.
    driver.cashBalance = driver.outstanding;
  }
}

recomputeBalances();

export const RIDERS_BY_ID = new Map(RIDERS.map((r) => [String(r.id), r]));
export const DRIVERS_BY_ID = new Map(DRIVERS.map((d) => [String(d.id), d]));
export const TRIPS_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));
export const ZONES_BY_ID = new Map(ZONES.map((z) => [String(z.id), z]));
export const REPORTS_BY_ID = new Map(SAFETY_REPORTS.map((r) => [r.id, r]));
export const SOS_CASES_BY_ID = new Map(SOS_CASES.map((c) => [c.id, c]));

export const SEED_META = { generatedAt: NOW, MINUTE, HOUR, DAY };

/**
 * Reason lists for the two admin trip interventions. Stories #1808 (cancel) and
 * #1809 (reassign) are unwritten, so these lists are a proposal drawn from the
 * situations the rest of the backlog already describes — they need BA sign-off.
 */
const TRIP_CANCELLATION_REASONS = [
  'Rider requested cancellation',
  'Driver unresponsive',
  'Safety concern raised',
  'Vehicle breakdown',
  'Duplicate or test trip',
  'Other',
];

const TRIP_REASSIGNMENT_REASONS = [
  'Driver unresponsive',
  'Vehicle breakdown',
  'Driver too far from pickup',
  'Driver requested handover',
  'Other',
];

/** Why a suspended driver is being let back on the platform. */
const DRIVER_REINSTATEMENT_REASONS = [
  'Suspension lifted after review',
  'Documents renewed and verified',
  'Policy violation resolved',
  'Suspended in error',
  'Other',
];

/** Why a suspended rider is being let back on the platform. */
const RIDER_REINSTATEMENT_REASONS = [
  'Suspension lifted after review',
  'Gender-mismatch report overturned',
  'Payment issue resolved',
  'Suspended in error',
  'Other',
];

export const REASON_LISTS = {
  driverSuspension: SUSPENSION_REASONS,
  driverReinstatement: DRIVER_REINSTATEMENT_REASONS,
  riderReinstatement: RIDER_REINSTATEMENT_REASONS,
  riderSuspension: RIDER_SUSPENSION_REASONS,
  rejection: REJECTION_REASONS,
  tripCancellation: TRIP_CANCELLATION_REASONS,
  tripReassignment: TRIP_REASSIGNMENT_REASONS,
};
