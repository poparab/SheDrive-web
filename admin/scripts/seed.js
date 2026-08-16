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

  return {
    id,
    name: i === 2 ? 'Mariam Abdelrahman El-Sayed Mohamed Farouk' : fullName(i + 5),
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
    statement: pick(DRIVER_STATEMENTS),
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
  } else if (report.resolution === 'suspended') {
    rider.status = 'suspended';
    rider.suspensionReason = 'Gender-mismatch report upheld';
    rider.suspendedAt = report.resolvedAt;
  } else if (rider.status === 'pending_review') {
    // Dismissed: back to active unless a separate suspension applies.
    rider.status = 'active';
  }
});

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
  'refund', 'settlement', 'gender-mismatch resolution', 'admin-account change',
];

// ── Lookups ───────────────────────────────────────────

export const RIDERS_BY_ID = new Map(RIDERS.map((r) => [String(r.id), r]));
export const DRIVERS_BY_ID = new Map(DRIVERS.map((d) => [String(d.id), d]));
export const TRIPS_BY_ID = new Map(TRIPS.map((t) => [t.id, t]));
export const ZONES_BY_ID = new Map(ZONES.map((z) => [String(z.id), z]));
export const REPORTS_BY_ID = new Map(SAFETY_REPORTS.map((r) => [r.id, r]));

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

export const REASON_LISTS = {
  driverSuspension: SUSPENSION_REASONS,
  riderSuspension: RIDER_SUSPENSION_REASONS,
  rejection: REJECTION_REASONS,
  tripCancellation: TRIP_CANCELLATION_REASONS,
  tripReassignment: TRIP_REASSIGNMENT_REASONS,
};
