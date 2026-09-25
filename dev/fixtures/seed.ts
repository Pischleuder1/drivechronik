/**
 * Seed script for a fake TeslaMate database, so DriveChronik can be developed
 * without a real car / real TeslaMate instance.
 *
 * Connects via TESLAMATE_DATABASE_URL (defaults to the docker-compose.dev.yml
 * teslamate-db service). Idempotent: truncates the relevant tables (restart
 * identity) before inserting, so re-running produces the same data.
 *
 * Fixture world: two fictional Teslas in Germany with roughly
 * one year of realistic commuting, business, private and charging activity.
 *
 * Run with: pnpm db:seed:teslamate  (from repo root)
 *        or: pnpm --filter @drivechronik/fixtures seed
 */
import postgres from "postgres";
import {
  DEMO_PLACES,
  demoPlace,
} from "./demoWorld";

const DATABASE_URL =
  process.env.TESLAMATE_DATABASE_URL ??
  "postgres://teslamate:teslamate@localhost:5433/teslamate";

const sql = postgres(DATABASE_URL, { max: 1 });

// ---------------------------------------------------------------------------
// Constants / fixture world
// ---------------------------------------------------------------------------

const EFFICIENCY_KWH_PER_KM = 0.172;

// Model-Y-RWD-Demowerte. Die Werte sind bewusst plausibel,
// aber nicht an ein reales Fahrzeug gebunden.
const RANGE_DROP_FACTOR = 1.08;
const BATTERY_CAPACITY_KWH = 62.0;
const FULL_RATED_RANGE_KM = 455;

const CAR = {
  eid: 1111111111,
  vid: 2222222222,
  vin: "7SAYGDEE0TF000001",
  name: "Demo Model Y",
  model: "Y",
  trim_badging: "RWD",
  exterior_color: "PearlWhiteMultiCoat",
  wheel_type: "Gemini19",
  efficiency: EFFICIENCY_KWH_PER_KM,
};

type LatLon = {
  lat: number;
  lon: number;
};

const GEOFENCES = DEMO_PLACES.map((place) => ({
  name: place.name,
  lat: place.lat,
  lon: place.lon,
  radius: place.radiusM,
}));

const ADDRESSES = DEMO_PLACES.map((place) => ({
  key: place.key,
  display_name: place.displayName,
  name: place.name,
  road: place.road,
  house_number: place.houseNumber,
  city: place.city,
  postcode: place.postcode,
  state: place.state,
  country: place.country,
  lat: place.lat,
  lon: place.lon,
}));

// ---------------------------------------------------------------------------
// Date range: 52 weeks ending in the current week, never beyond yesterday.
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function atTime(day: Date, hh: number, mm: number): Date {
  const r = new Date(day);
  r.setHours(hh, mm, 0, 0);
  return r;
}

const now = new Date();
const yesterday = startOfDay(addDays(now, -1));

const endWeekMonday = addDays(
  yesterday,
  -((yesterday.getDay() + 6) % 7),
);

const WEEKS = 52;

const startMonday = addDays(
  endWeekMonday,
  -(WEEKS - 1) * 7,
);

const weekMondays = Array.from(
  { length: WEEKS },
  (_, i) => addDays(startMonday, i * 7),
);

// Über das Demo-Jahr verteilte Tesla-Softwareupdates.
const SOFTWARE_UPDATES = [
  {
    monday: weekMondays[1]!,
    dayOffset: 2,
    version: "2025.32.6",
    durationMin: 35,
  },
  {
    monday: weekMondays[10]!,
    dayOffset: 3,
    version: "2025.44.25.2",
    durationMin: 40,
  },
  {
    monday: weekMondays[19]!,
    dayOffset: 1,
    version: "2026.2.8",
    durationMin: 32,
  },
  {
    monday: weekMondays[29]!,
    dayOffset: 2,
    version: "2026.14.7",
    durationMin: 38,
  },
  {
    monday: weekMondays[39]!,
    dayOffset: 3,
    version: "2026.26.6",
    durationMin: 34,
  },
  {
    monday: weekMondays[50]!,
    dayOffset: 1,
    version: "2026.32.4",
    durationMin: null,
  },
] as const;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Simple seeded PRNG (mulberry32) for reproducible jitter.
function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Independent deterministic random streams.
//
// General jitter remains on the original seed. Charging point noise,
// scenario decisions and synthetic prices are deliberately separated so
// changing charge-point density cannot alter the demo-year timeline.
const rng = makeRng(42);
const chargeRng = makeRng(420042);
const scenarioRng = makeRng(420043);
const costRng = makeRng(420044);

function jitter(scale: number): number {
  return (rng() - 0.5) * 2 * scale;
}

function chargeJitter(scale: number): number {
  return (chargeRng() - 0.5) * 2 * scale;
}

// Nominal cold tire pressure for the synthetic demo vehicle (bar) — front slightly lower than
// rear is typical. Small per-reading jitter so values aren't perfectly flat.
const TPMS_FRONT_BAR = 2.9;
const TPMS_REAR_BAR = 2.9;

function tpmsReading(date: Date): Pick<
  PositionRow,
  "tpms_pressure_fl" | "tpms_pressure_fr" | "tpms_pressure_rl" | "tpms_pressure_rr"
> {
  // Kontrolliertes Demo-Szenario:
  // In den letzten rund 35 Tagen verliert nur der Reifen hinten links
  // langsam Druck. Die übrigen drei Reifen bleiben unverändert.
  //
  // Damit lässt sich die relative Schleichverlust-Erkennung reproduzierbar
  // testen, ohne normale gemeinsame Druckänderungen als Fehler zu markieren.
  const leakDurationDays = 35;
  const leakStart = addDays(yesterday, -leakDurationDays);
  const leakProgress = Math.max(
    0,
    Math.min(
      1,
      (date.getTime() - leakStart.getTime()) /
        (leakDurationDays * 24 * 60 * 60 * 1000),
    ),
  );

  const rearLeftLeakBar = 0.32 * leakProgress;

  return {
    tpms_pressure_fl: Number((TPMS_FRONT_BAR + jitter(0.05)).toFixed(2)),
    tpms_pressure_fr: Number((TPMS_FRONT_BAR + jitter(0.05)).toFixed(2)),
    tpms_pressure_rl: Number(
      (TPMS_REAR_BAR - rearLeftLeakBar + jitter(0.05)).toFixed(2),
    ),
    tpms_pressure_rr: Number((TPMS_REAR_BAR + jitter(0.05)).toFixed(2)),
  };
}

// Interpolate along a polyline made of multiple route points.
// This makes the demo GPS track follow a realistic path instead of drawing
// an almost straight line between start and destination.
function interpolateRoutePoint(route: LatLon[], t: number): LatLon {
  if (route.length < 2) return route[0];

  const segments = route.slice(0, -1).map((p, i) => {
    const q = route[i + 1];
    const dx = q.lon - p.lon;
    const dy = q.lat - p.lat;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const total = segments.reduce((sum, length) => sum + length, 0);
  if (total === 0) return route[0];

  let target = Math.max(0, Math.min(1, t)) * total;

  for (let i = 0; i < segments.length; i++) {
    const length = segments[i];

    if (target <= length || i === segments.length - 1) {
      const localT = length > 0 ? target / length : 0;
      const a = route[i];
      const b = route[i + 1];

      return {
        lat: a.lat + (b.lat - a.lat) * localT + jitter(0.000015),
        lon: a.lon + (b.lon - a.lon) * localT + jitter(0.000015),
      };
    }

    target -= length;
  }

  return route[route.length - 1];
}

// Synthetic demo road network.
//
// Production DriveChronik always uses the real GPS coordinates imported from
// TeslaMate. The demo must remain fully offline, so instead of calling an
// external routing service we model a small deterministic road network.
//
// The important property for the route heatmap is that different trips share
// plausible corridors instead of every destination being connected to
// Bielefeld by an independent mathematical curve.
const DEMO_ROUTE_NODES: Record<string, LatLon> = {
  // Ostwestfalen / local
  bielefeld: { lat: 52.0302, lon: 8.5325 },
  herford: { lat: 52.1157, lon: 8.6762 },
  oerlinghausen: { lat: 51.9600, lon: 8.6620 },
  detmold: { lat: 51.9363, lon: 8.8792 },

  // A2 corridor east: Bielefeld -> Hannover
  badOeynhausen: { lat: 52.2084, lon: 8.8007 },
  porta: { lat: 52.2400, lon: 8.9200 },
  minden: { lat: 52.2895, lon: 8.9146 },
  rinteln: { lat: 52.1908, lon: 9.0814 },
  lauenau: { lat: 52.2730, lon: 9.3730 },
  hannover: { lat: 52.3759, lon: 9.7320 },

  // A7 corridor north: Hannover -> Hamburg
  schwarmstedt: { lat: 52.6770, lon: 9.6170 },
  soltau: { lat: 52.9860, lon: 9.8430 },
  bispingen: { lat: 53.0830, lon: 9.9980 },
  hamburg: { lat: 53.5511, lon: 9.9937 },

  // West / Ruhr corridor
  guetersloh: { lat: 51.9069, lon: 8.3785 },
  rheda: { lat: 51.8490, lon: 8.3000 },
  oelde: { lat: 51.8250, lon: 8.1470 },
  hamm: { lat: 51.6800, lon: 7.8200 },
  kamen: { lat: 51.5910, lon: 7.6650 },
  dortmund: { lat: 51.5136, lon: 7.4653 },

  // North-west corridor: Bielefeld -> Osnabrück
  halle: { lat: 52.0600, lon: 8.3600 },
  borgholzhausen: { lat: 52.1030, lon: 8.3020 },
  dissen: { lat: 52.1150, lon: 8.2000 },
  osnabrueck: { lat: 52.2799, lon: 8.0472 },

  // Münster corridor
  harsewinkel: { lat: 51.9620, lon: 8.2270 },
  warendorf: { lat: 51.9520, lon: 7.9900 },
  muenster: { lat: 51.9607, lon: 7.6261 },

  // A33 / A44 corridor south-east
  schlossHolte: { lat: 51.9060, lon: 8.6180 },
  paderborn: { lat: 51.7189, lon: 8.7575 },
  bueren: { lat: 51.5510, lon: 8.5600 },
  warburg: { lat: 51.4890, lon: 9.1460 },
  kassel: { lat: 51.3127, lon: 9.4797 },
};

const DEMO_ROUTE_LINKS = [
  // Bielefeld / Herford
  ["bielefeld", "herford"],
  ["bielefeld", "oerlinghausen"],
  ["oerlinghausen", "detmold"],

  // Bielefeld -> Hannover
  ["herford", "badOeynhausen"],
  ["badOeynhausen", "porta"],
  ["porta", "rinteln"],
  ["porta", "minden"],
  ["rinteln", "lauenau"],
  ["lauenau", "hannover"],

  // Hannover -> Hamburg
  ["hannover", "schwarmstedt"],
  ["schwarmstedt", "soltau"],
  ["soltau", "bispingen"],
  ["bispingen", "hamburg"],

  // Bielefeld -> Dortmund
  ["bielefeld", "guetersloh"],
  ["guetersloh", "rheda"],
  ["rheda", "oelde"],
  ["oelde", "hamm"],
  ["hamm", "kamen"],
  ["kamen", "dortmund"],

  // Bielefeld -> Osnabrück
  ["bielefeld", "halle"],
  ["halle", "borgholzhausen"],
  ["borgholzhausen", "dissen"],
  ["dissen", "osnabrueck"],

  // Bielefeld -> Münster
  ["guetersloh", "harsewinkel"],
  ["harsewinkel", "warendorf"],
  ["warendorf", "muenster"],

  // Bielefeld -> Paderborn -> Kassel
  ["bielefeld", "schlossHolte"],
  ["schlossHolte", "paderborn"],
  ["paderborn", "bueren"],
  ["bueren", "warburg"],
  ["warburg", "kassel"],
] as const;

const DEMO_PLACE_ROUTE_NODE: Record<string, string> = {
  home: "bielefeld",
  office: "herford",

  "customer-hannover": "hannover",
  "customer-muenster": "muenster",
  "customer-osnabrueck": "osnabrueck",
  "customer-dortmund": "dortmund",
  "customer-kassel": "kassel",
  "customer-paderborn": "paderborn",

  "site-guetersloh": "guetersloh",
  "supplier-minden": "minden",

  "hotel-hannover": "hannover",
  "hotel-hamburg": "hamburg",

  "charger-porta": "porta",
  "charger-lauenau": "lauenau",
  "charger-bispingen": "bispingen",

  supermarket: "bielefeld",
  "leisure-detmold": "detmold",
  "parking-bielefeld": "bielefeld",
};

function routeNeighbours(node: string): string[] {
  const neighbours: string[] = [];

  for (const [a, b] of DEMO_ROUTE_LINKS) {
    if (a === node) neighbours.push(b);
    if (b === node) neighbours.push(a);
  }

  return neighbours;
}

function shortestDemoRouteNodes(
  startNode: string,
  endNode: string,
): string[] {
  if (startNode === endNode) {
    return [startNode];
  }

  const unvisited = new Set(
    Object.keys(DEMO_ROUTE_NODES),
  );

  const distance = new Map<string, number>();
  const previous = new Map<string, string>();

  for (const key of unvisited) {
    distance.set(key, Number.POSITIVE_INFINITY);
  }

  distance.set(startNode, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let currentDistance =
      Number.POSITIVE_INFINITY;

    for (const key of unvisited) {
      const value =
        distance.get(key) ??
        Number.POSITIVE_INFINITY;

      if (
        value < currentDistance ||
        (
          value === currentDistance &&
          current != null &&
          key.localeCompare(current) < 0
        )
      ) {
        current = key;
        currentDistance = value;
      }
    }

    if (
      current == null ||
      !Number.isFinite(currentDistance)
    ) {
      break;
    }

    if (current === endNode) {
      break;
    }

    unvisited.delete(current);

    for (const neighbour of routeNeighbours(current)) {
      if (!unvisited.has(neighbour)) {
        continue;
      }

      const from =
        DEMO_ROUTE_NODES[current];
      const to =
        DEMO_ROUTE_NODES[neighbour];

      if (!from || !to) {
        continue;
      }

      const candidate =
        currentDistance +
        haversineKm(from, to);

      const known =
        distance.get(neighbour) ??
        Number.POSITIVE_INFINITY;

      if (candidate < known) {
        distance.set(
          neighbour,
          candidate,
        );

        previous.set(
          neighbour,
          current,
        );
      }
    }
  }

  if (!previous.has(endNode)) {
    return [];
  }

  const path = [endNode];
  let cursor = endNode;

  while (cursor !== startNode) {
    const before =
      previous.get(cursor);

    if (!before) {
      return [];
    }

    path.push(before);
    cursor = before;
  }

  return path.reverse();
}

function dedupeRoutePoints(
  points: LatLon[],
): LatLon[] {
  const result: LatLon[] = [];

  for (const point of points) {
    const previous = result.at(-1);

    if (
      !previous ||
      haversineKm(previous, point) >= 0.03
    ) {
      result.push(point);
    }
  }

  return result;
}

// Fallback for local trips and unknown future demo places.
// Keeps a small natural curve without pretending to be a real road.
function curvedDemoRoute(
  from: LatLon,
  to: LatLon,
): LatLon[] {
  const directKm = haversineKm(
    from,
    to,
  );

  const segments =
    directKm >= 20 ? 6 : 4;

  const dLat = to.lat - from.lat;
  const dLon = to.lon - from.lon;

  const norm =
    Math.sqrt(
      dLat * dLat +
      dLon * dLon,
    ) || 1;

  const normalLat =
    dLon / norm;

  const normalLon =
    -dLat / norm;

  const sign =
    Math.sin(
      (
        from.lat +
        from.lon +
        to.lat +
        to.lon
      ) * 1000,
    ) >= 0
      ? 1
      : -1;

  const bend = Math.min(
    0.012,
    Math.max(
      0.0005,
      directKm / 8000,
    ),
  );

  return Array.from(
    { length: segments + 1 },
    (_, index) => {
      const t =
        index / segments;

      if (index === 0) {
        return { ...from };
      }

      if (index === segments) {
        return { ...to };
      }

      const curve =
        Math.sin(Math.PI * t) *
        bend *
        sign;

      return {
        lat:
          from.lat +
          dLat * t +
          normalLat * curve,

        lon:
          from.lon +
          dLon * t +
          normalLon * curve,
      };
    },
  );
}

function demoRoute(
  fromKey: string,
  toKey: string,
  from: LatLon,
  to: LatLon,
): LatLon[] {
  const startNode =
    DEMO_PLACE_ROUTE_NODE[fromKey];

  const endNode =
    DEMO_PLACE_ROUTE_NODE[toKey];

  /*
   * Local Bielefeld trips and any future place that has no
   * explicit road-network anchor use the lightweight fallback.
   */
  if (
    !startNode ||
    !endNode ||
    startNode === endNode
  ) {
    return curvedDemoRoute(
      from,
      to,
    );
  }

  const path =
    shortestDemoRouteNodes(
      startNode,
      endNode,
    );

  if (path.length < 2) {
    return curvedDemoRoute(
      from,
      to,
    );
  }

  return dedupeRoutePoints([
    from,

    ...path.flatMap(
      (node) => {
        const point =
          DEMO_ROUTE_NODES[node];

        return point
          ? [point]
          : [];
      },
    ),

    to,
  ]);
}

// ---------------------------------------------------------------------------
// In-memory row builders (ids assigned as we go, matching Postgres serials
// since we TRUNCATE ... RESTART IDENTITY before inserting).
// ---------------------------------------------------------------------------

interface PositionRow {
  date: Date;
  latitude: number;
  longitude: number;
  speed: number | null;
  odometer: number;
  ideal_battery_range_km: number;
  rated_battery_range_km: number;
  battery_level: number;
  usable_battery_level: number;
  car_id: number;
  drive_id: number | null;
  tpms_pressure_fl: number;
  tpms_pressure_fr: number;
  tpms_pressure_rl: number;
  tpms_pressure_rr: number;
}

interface DriveRow {
  start_date: Date;
  end_date: Date;
  start_km: number;
  end_km: number;
  distance: number;
  duration_min: number;
  car_id: number;
  start_address_id: number;
  end_address_id: number;
  start_position_id: number;
  end_position_id: number;
  start_geofence_id: number | null;
  end_geofence_id: number | null;
  start_ideal_range_km: number;
  end_ideal_range_km: number;
  start_rated_range_km: number;
  end_rated_range_km: number;
  speed_max: number;
  power_max: number;
  power_min: number;
  outside_temp_avg: number;
  inside_temp_avg: number;
  ascent: number;
  descent: number;
}

interface ChargeRow {
  date: Date;
  battery_level: number;
  usable_battery_level: number;
  charge_energy_added: number;
  charger_power: number;
  charger_phases: number | null;
  charger_voltage: number | null;
  fast_charger_present: boolean;
  ideal_battery_range_km: number;
  rated_battery_range_km: number;
  charging_process_id: number;
  outside_temp: number;
}

interface StateRow {
  state: "online" | "offline" | "asleep";
  start_date: Date;
  end_date: Date;
  car_id: number;
}

interface ChargingProcessRow {
  start_date: Date;
  end_date: Date;
  charge_energy_added: number;
  charge_energy_used: number;
  start_battery_level: number;
  end_battery_level: number;
  duration_min: number;
  car_id: number;
  position_id: number;
  address_id: number | null;
  geofence_id: number | null;
  start_ideal_range_km: number;
  end_ideal_range_km: number;
  start_rated_range_km: number;
  end_rated_range_km: number;
  cost: number | null;
}

const MONTHLY_BASE_TEMP_C = [
  3, 4, 7, 11, 15, 18,
  21, 20, 16, 11, 7, 4,
] as const;

const MONTHLY_CONSUMPTION_FACTOR = [
  1.22, 1.18, 1.10, 1.04, 0.99, 0.96,
  0.95, 0.96, 1.00, 1.06, 1.14, 1.22,
] as const;

function seasonalConsumptionFactor(date: Date): number {
  return MONTHLY_CONSUMPTION_FACTOR[date.getMonth()] ?? 1;
}

function seasonalBaseTemperature(date: Date): number {
  return MONTHLY_BASE_TEMP_C[date.getMonth()] ?? 12;
}

// Simulation state, mutated as we walk through time.
let odometer = 24500.0; // km
let batteryLevel = 78; // % SoC, integer as TeslaMate stores smallint
const usableOffset = 0; // usable_battery_level == battery_level (no LFP min-buffer modeling)

function ratedRangeForSoc(soc: number): number {
  return (soc / 100) * FULL_RATED_RANGE_KM;
}
function idealRangeForSoc(soc: number): number {
  // ideal range is typically a bit higher than rated range at the same SoC
  return ratedRangeForSoc(soc) * 1.07;
}

const positions: PositionRow[] = [];
const drives: DriveRow[] = [];
const chargingProcesses: ChargingProcessRow[] = [];
const charges: ChargeRow[] = [];

let positionIdCounter = 0; // 1-based, mirrors serial after TRUNCATE RESTART IDENTITY
let driveIdCounter = 0;
let chargingProcessIdCounter = 0;

const addressIdByKey = Object.fromEntries(
  DEMO_PLACES.map((place, index) => [
    place.key,
    index + 1,
  ]),
) as Record<string, number>;

const geofenceIdByName = Object.fromEntries(
  DEMO_PLACES.map((place, index) => [
    place.name,
    index + 1,
  ]),
) as Record<string, number>;

const CAR_ID = 1;

/**
 * Simulate one drive: builds interpolated position rows (~1 every 15s),
 * updates odometer + battery state, and returns the drive row (positions
 * pushed to the shared `positions` array as a side effect).
 */
function simulateDrive(opts: {
  start: Date;
  fromKey: keyof typeof addressIdByKey;
  toKey: keyof typeof addressIdByKey;
  from: LatLon;
  to: LatLon;
  distanceKm: number;
  durationMin: number;
  cruiseSpeedKmh: number;
  startGeofence: string | null;
  endGeofence: string | null;
}): DriveRow {
  const {
    start,
    fromKey,
    toKey,
    from,
    to,
    distanceKm,
    durationMin,
    cruiseSpeedKmh,
    startGeofence,
    endGeofence,
  } = opts;

  const durationSec = durationMin * 60;
  // TeslaMate logs a position roughly every 5-10s while actively driving; we
  // One position every ~15 seconds keeps a full demo year reasonably small
  // while still producing useful GPS tracks and maps.
  const stepSec = 15;
  const numSteps = Math.max(2, Math.round(durationSec / stepSec));

  const startOdometer = odometer;
  const startBattery = batteryLevel;
  const startIdeal = idealRangeForSoc(startBattery);
  const startRated = ratedRangeForSoc(startBattery);

  // Total rated-range km consumed by this drive.
  const rangeConsumed =
    distanceKm *
    RANGE_DROP_FACTOR *
    seasonalConsumptionFactor(start);

  const socConsumed =
    (rangeConsumed / FULL_RATED_RANGE_KM) * 100;

  const route = demoRoute(
    String(fromKey),
    String(toKey),
    from,
    to,
  );

  let speedMax = 0;
  let firstPositionId: number | null = null;
  let lastPositionId = 0;

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const point = interpolateRoutePoint(route, t);
    const date = new Date(start.getTime() + t * durationSec * 1000);
    const traveled = distanceKm * t;

    // Speed profile: ramp up, cruise, ramp down.
    let speed: number;
    const ramp = 0.08;
    if (t < ramp) {
      speed = cruiseSpeedKmh * (t / ramp);
    } else if (t > 1 - ramp) {
      speed = cruiseSpeedKmh * ((1 - t) / ramp);
    } else {
      speed = cruiseSpeedKmh;
    }
    speed = Math.max(5, speed + jitter(4));
    speedMax = Math.max(speedMax, speed);

    const soc = startBattery - socConsumed * t;
    const socRounded = Math.max(1, Math.round(soc));

    positionIdCounter += 1;
    if (firstPositionId === null) firstPositionId = positionIdCounter;
    lastPositionId = positionIdCounter;

    positions.push({
      date,
      latitude: point.lat,
      longitude: point.lon,
      speed: Math.round(speed),
      odometer: startOdometer + traveled,
      ideal_battery_range_km: idealRangeForSoc(soc),
      rated_battery_range_km: ratedRangeForSoc(soc),
      battery_level: socRounded,
      usable_battery_level: Math.max(0, socRounded - usableOffset),
      car_id: CAR_ID,
      drive_id: null, // filled in after we know the drive id
      ...tpmsReading(date),
    });
  }

  // Rated/ideal range must retain the continuous SoC used by the
  // consumption simulation. TeslaMate's battery_level itself is an integer,
  // but rounding the SoC before deriving rated range would quantize every
  // drive to whole percentage points and create artificial consumption jumps.
  const endSocExact = Math.max(1, startBattery - socConsumed);

  odometer = startOdometer + distanceKm;
  batteryLevel = Math.max(1, Math.round(endSocExact));

  const endDate = new Date(start.getTime() + durationSec * 1000);

  driveIdCounter += 1;
  const driveId = driveIdCounter;
  // Retroactively tag the positions we just generated with this drive id.
  for (let i = positions.length - (numSteps + 1); i < positions.length; i++) {
    positions[i]!.drive_id = driveId;
  }

  const outsideTemp =
    seasonalBaseTemperature(start) + jitter(3.5);

  return {
    start_date: start,
    end_date: endDate,
    start_km: startOdometer,
    end_km: odometer,
    distance: distanceKm,
    duration_min: durationMin,
    car_id: CAR_ID,
    start_address_id: addressIdByKey[fromKey],
    end_address_id: addressIdByKey[toKey],
    start_position_id: firstPositionId!,
    end_position_id: lastPositionId,
    start_geofence_id: startGeofence ? geofenceIdByName[startGeofence]! : null,
    end_geofence_id: endGeofence ? geofenceIdByName[endGeofence]! : null,
    start_ideal_range_km: startIdeal,
    end_ideal_range_km: idealRangeForSoc(endSocExact),
    start_rated_range_km: startRated,
    end_rated_range_km: ratedRangeForSoc(endSocExact),
    speed_max: Math.round(speedMax),
    power_max: Math.round(60 + jitter(20)),
    power_min: Math.round(-15 - jitter(10)),
    outside_temp_avg: outsideTemp,
    inside_temp_avg: 21 + jitter(2),
    ascent: Math.round(Math.max(0, 20 + jitter(15))),
    descent: Math.round(Math.max(0, 20 + jitter(15))),
  };
}

/** Small vampire drain while parked (percent SoC lost per hour). */
const VAMPIRE_DRAIN_PCT_PER_HOUR = 0.015;
let parkedDrainAccumulator = 0;

function applyParkedDrain(hours: number) {
  parkedDrainAccumulator += VAMPIRE_DRAIN_PCT_PER_HOUR * hours;

  const wholePercent = Math.floor(parkedDrainAccumulator);
  if (wholePercent < 1) return;

  batteryLevel = Math.max(1, batteryLevel - wholePercent);
  parkedDrainAccumulator -= wholePercent;
}

/**
 * Synthetic DC charging curve for the demo Model Y RWD.
 *
 * Values are relative to the maximum power available for the session.
 * Linear interpolation creates a smooth SoC-dependent charging curve.
 *
 * 10–80 % averages roughly 63 % of peak power. AC charging remains flat.
 */
const MODEL_Y_RWD_DC_CURVE = [
  { soc: 0, factor: 0.35 },
  { soc: 5, factor: 0.70 },
  { soc: 10, factor: 1.00 },
  { soc: 20, factor: 0.90 },
  { soc: 30, factor: 0.75 },
  { soc: 40, factor: 0.65 },
  { soc: 50, factor: 0.57 },
  { soc: 60, factor: 0.50 },
  { soc: 70, factor: 0.42 },
  { soc: 80, factor: 0.28 },
  { soc: 90, factor: 0.16 },
  { soc: 95, factor: 0.10 },
  { soc: 100, factor: 0.05 },
] as const;

function modelYRwdDcPowerFactor(soc: number): number {
  const clampedSoc = Math.max(0, Math.min(100, soc));

  for (let i = 1; i < MODEL_Y_RWD_DC_CURVE.length; i++) {
    const lower = MODEL_Y_RWD_DC_CURVE[i - 1]!;
    const upper = MODEL_Y_RWD_DC_CURVE[i]!;

    if (clampedSoc <= upper.soc) {
      const span = upper.soc - lower.soc;
      const position =
        span > 0 ? (clampedSoc - lower.soc) / span : 0;

      return lower.factor +
        (upper.factor - lower.factor) * position;
    }
  }

  return MODEL_Y_RWD_DC_CURVE[
    MODEL_Y_RWD_DC_CURVE.length - 1
  ]!.factor;
}

const CHARGING_LOSS_FACTOR = 1.08;

function simulateCharging(opts: {
  start: Date;
  addressKey: keyof typeof addressIdByKey;
  geofenceName: string | null;
  targetSoc: number;
  isDc: boolean;
  peakKw: number;
  cost: number | null;
  positionCoord: LatLon;
}): ChargingProcessRow {
  const { start, addressKey, geofenceName, targetSoc, isDc, peakKw, cost, positionCoord } =
    opts;

  const startSoc = batteryLevel;
  const startIdeal = idealRangeForSoc(startSoc);
  const startRated = ratedRangeForSoc(startSoc);
  const socToAdd = Math.max(0, targetSoc - startSoc);
  const energyAddedKwh =
    (socToAdd / 100) * BATTERY_CAPACITY_KWH;

  // `charger_power` represents input power from the charger. Around 8 %
  // charging losses mean that only power / CHARGING_LOSS_FACTOR reaches
  // the battery.
  const energyUsedKwh =
    energyAddedKwh * CHARGING_LOSS_FACTOR;

  const stepMin = 1;

  // Position row that charging_processes.position_id references (required,
  // NOT NULL). Not linked to a drive.
  positionIdCounter += 1;
  const chargePositionId = positionIdCounter;
  positions.push({
    date: start,
    latitude: positionCoord.lat,
    longitude: positionCoord.lon,
    speed: null,
    odometer,
    ideal_battery_range_km: startIdeal,
    rated_battery_range_km: startRated,
    battery_level: startSoc,
    usable_battery_level: startSoc,
    car_id: CAR_ID,
    drive_id: null,
    ...tpmsReading(start),
  });

  chargingProcessIdCounter += 1;
  const chargingProcessId = chargingProcessIdCounter;

  // Session-Basistemperatur (wie bei Fahrten: 16°C Mittel +/- Jitter), pro
  // Messpunkt zusätzlich leicht schwankend — TeslaMate loggt outside_temp
  // pro `charges`-Zeile, nicht nur als Session-Mittel.
  const sessionOutsideTemp =
    seasonalBaseTemperature(start) + chargeJitter(3.5);

  let socAcc = startSoc;
  let energyAddedAcc = 0;
  let elapsedMin = 0;
  let safetySteps = 0;

  while (energyAddedAcc < energyAddedKwh - 1e-9) {
    safetySteps += 1;

    if (safetySteps > 12 * 60) {
      throw new Error("Synthetic charging session exceeded 12 hours");
    }

    // DC power depends on the CURRENT SoC. AC remains flat.
    const power = isDc
      ? peakKw * modelYRwdDcPowerFactor(socAcc)
      : peakKw;

    if (power <= 0) {
      throw new Error("Synthetic charging power must be greater than zero");
    }

    // Charger power is input power. Convert it to energy that actually
    // reaches the battery during this time step.
    const batteryPowerKw =
      power / CHARGING_LOSS_FACTOR;

    const fullStepEnergyKwh =
      batteryPowerKw * (stepMin / 60);

    const remainingEnergyKwh =
      energyAddedKwh - energyAddedAcc;

    const stepEnergyKwh = Math.min(
      fullStepEnergyKwh,
      remainingEnergyKwh,
    );

    // The final step may be shorter than one minute.
    const actualStepMin =
      fullStepEnergyKwh > 0
        ? stepMin * (stepEnergyKwh / fullStepEnergyKwh)
        : 0;

    elapsedMin += actualStepMin;
    energyAddedAcc += stepEnergyKwh;

    socAcc = Math.min(
      targetSoc,
      startSoc +
        (energyAddedAcc / BATTERY_CAPACITY_KWH) * 100,
    );

    const date = new Date(
      start.getTime() + elapsedMin * 60 * 1000,
    );

    const socRounded = Math.round(socAcc);

    charges.push({
      date,
      battery_level: socRounded,
      usable_battery_level: socRounded,
      charge_energy_added: Number(
        energyAddedAcc.toFixed(2),
      ),
      charger_power: Math.round(power),
      charger_phases: isDc ? null : 3,
      charger_voltage: isDc
        ? Math.round(370 + chargeJitter(20))
        : 230,
      fast_charger_present: isDc,
      ideal_battery_range_km:
        idealRangeForSoc(socAcc),
      rated_battery_range_km:
        ratedRangeForSoc(socAcc),
      charging_process_id: chargingProcessId,
      outside_temp: Number(
        (
          sessionOutsideTemp +
          chargeJitter(0.8)
        ).toFixed(1),
      ),
    });
  }

  const durationMin = Math.max(
    1,
    Math.round(elapsedMin),
  );

  batteryLevel = Math.round(targetSoc);
  const endDate = new Date(
    start.getTime() + elapsedMin * 60 * 1000,
  );

  return {
    start_date: start,
    end_date: endDate,
    charge_energy_added: Number(energyAddedKwh.toFixed(2)),
    charge_energy_used: Number(energyUsedKwh.toFixed(2)),
    start_battery_level: startSoc,
    end_battery_level: batteryLevel,
    duration_min: durationMin,
    car_id: CAR_ID,
    position_id: chargePositionId,
    address_id: addressIdByKey[addressKey],
    geofence_id: geofenceName ? geofenceIdByName[geofenceName]! : null,
    start_ideal_range_km: startIdeal,
    end_ideal_range_km: idealRangeForSoc(batteryLevel),
    start_rated_range_km: startRated,
    end_rated_range_km: ratedRangeForSoc(batteryLevel),
    cost,
  };
}

// ---------------------------------------------------------------------------
// Build realistic 52-week demo timeline
// ---------------------------------------------------------------------------

const BUSINESS_TARGETS = [
  "customer-hannover",
  "customer-muenster",
  "customer-osnabrueck",
  "customer-dortmund",
  "customer-kassel",
  "customer-paderborn",
  "site-guetersloh",
  "supplier-minden",
] as const;

function pointFor(key: string): LatLon {
  const place = demoPlace(key);

  return {
    lat: place.lat,
    lon: place.lon,
  };
}

function roadDistanceKm(
  fromKey: string,
  toKey: string,
): number {
  const direct = haversineKm(
    pointFor(fromKey),
    pointFor(toKey),
  );

  const factor =
    direct < 10
      ? 1.22
      : direct < 50
        ? 1.18
        : 1.15;

  return Number(
    Math.max(1.2, direct * factor).toFixed(2),
  );
}

function durationForDistance(distanceKm: number): number {
  const averageSpeed =
    distanceKm < 10
      ? 32
      : distanceKm < 30
        ? 45
        : distanceKm < 80
          ? 65
          : distanceKm < 160
            ? 82
            : 92;

  return Math.max(
    5,
    Math.round((distanceKm / averageSpeed) * 60 + 4),
  );
}

function cruiseForDistance(distanceKm: number): number {
  if (distanceKm < 10) return 40;
  if (distanceKm < 30) return 60;
  if (distanceKm < 80) return 90;
  return 120;
}

function driveBetween(
  start: Date,
  fromKey: string,
  toKey: string,
): DriveRow {
  const distanceKm = roadDistanceKm(
    fromKey,
    toKey,
  );

  return simulateDrive({
    start,
    fromKey,
    toKey,
    from: pointFor(fromKey),
    to: pointFor(toKey),
    distanceKm,
    durationMin: durationForDistance(distanceKm),
    cruiseSpeedKmh: cruiseForDistance(distanceKm),
    startGeofence: demoPlace(fromKey).name,
    endGeofence: demoPlace(toKey).name,
  });
}

function expectedSocForDistance(
  distanceKm: number,
  date: Date,
): number {
  return (
    (
      distanceKm *
      RANGE_DROP_FACTOR *
      seasonalConsumptionFactor(date)
    ) /
    FULL_RATED_RANGE_KM
  ) * 100;
}

function homeCharge(
  start: Date,
  targetSoc = 80,
): void {
  if (batteryLevel >= targetSoc - 2) {
    return;
  }

  const cp = simulateCharging({
    start,
    addressKey: "home",
    geofenceName: demoPlace("home").name,
    targetSoc,
    isDc: false,
    peakKw: 11,
    cost: null,
    positionCoord: pointFor("home"),
  });

  chargingProcesses.push(cp);
}

function prepareForBusinessTrip(
  day: Date,
  targetKey: string,
): void {
  const roundTripKm =
    roadDistanceKm("home", targetKey) * 2;

  const expectedUse =
    expectedSocForDistance(roundTripKm, day);

  const requiredStartSoc = Math.min(
    90,
    Math.ceil(expectedUse + 13),
  );

  if (batteryLevel < requiredStartSoc) {
    const targetSoc = Math.max(
      80,
      requiredStartSoc,
    );

    homeCharge(
      atTime(day, 0, 30),
      targetSoc,
    );
  }
}

function addRoundTrip(opts: {
  day: Date;
  startHour: number;
  startMinute: number;
  fromKey: string;
  toKey: string;
  stopMinutes: number;
}): void {
  const outward = driveBetween(
    atTime(
      opts.day,
      opts.startHour,
      opts.startMinute,
    ),
    opts.fromKey,
    opts.toKey,
  );

  drives.push(outward);

  applyParkedDrain(
    opts.stopMinutes / 60,
  );

  const backStart = new Date(
    outward.end_date.getTime() +
      opts.stopMinutes * 60 * 1000,
  );

  const back = driveBetween(
    backStart,
    opts.toKey,
    opts.fromKey,
  );

  drives.push(back);
}

function addBusinessRoundTrip(
  day: Date,
  targetKey: string,
  startHour: number,
): void {
  prepareForBusinessTrip(
    day,
    targetKey,
  );

  const outward = driveBetween(
    atTime(day, startHour, 15),
    "home",
    targetKey,
  );

  drives.push(outward);

  applyParkedDrain(2);

  const back = driveBetween(
    new Date(
      outward.end_date.getTime() +
        2 * 60 * 60 * 1000,
    ),
    targetKey,
    "home",
  );

  drives.push(back);

  // Nach längeren Außendiensttagen wird am Abend geladen.
  if (batteryLevel < 38) {
    homeCharge(
      atTime(day, 20, 15),
      80,
    );
  } else {
    applyParkedDrain(10);
  }
}

const HAMBURG_TRIP_WEEKS =
  new Set([8, 25, 42]);

for (let w = 0; w < WEEKS; w++) {
  const monday = weekMondays[w]!;

  for (let d = 0; d < 7; d++) {
    const day = addDays(monday, d);

    if (day > yesterday) {
      continue;
    }

    // --------------------------------------------------------
    // Montag:
    // etwa zwei von drei Wochen klassischer Arbeitsweg.
    // --------------------------------------------------------
    if (d === 0 && w % 3 !== 2) {
      if (batteryLevel < 35) {
        homeCharge(
          atTime(day, 0, 30),
          80,
        );
      }

      const toOffice = driveBetween(
        atTime(day, 7, 35),
        "home",
        "office",
      );

      drives.push(toOffice);

      applyParkedDrain(8);

      const home = driveBetween(
        atTime(day, 16, 45),
        "office",
        "home",
      );

      drives.push(home);

      // Der Dienstag ist regelmäßig Außendiensttag.
      // Deshalb montags bei Bedarf über Nacht auffüllen.
      if (batteryLevel < 76) {
        homeCharge(
          atTime(day, 19, 30),
          80,
        );
      } else {
        applyParkedDrain(12);
      }

      continue;
    }

    // --------------------------------------------------------
    // Dienstag: regelmäßiger Außendienst.
    // --------------------------------------------------------
    if (d === 1) {
      const target =
        BUSINESS_TARGETS[
          w % BUSINESS_TARGETS.length
        ]!;

      addBusinessRoundTrip(
        day,
        target,
        8,
      );

      continue;
    }

    // --------------------------------------------------------
    // Donnerstag: zweiter Außendiensttag mit versetztem Ziel.
    // --------------------------------------------------------
    if (d === 3) {
      const target =
        BUSINESS_TARGETS[
          (w + 3) %
            BUSINESS_TARGETS.length
        ]!;

      addBusinessRoundTrip(
        day,
        target,
        8,
      );

      continue;
    }

    // --------------------------------------------------------
    // Freitag: etwa alle drei Wochen eine private Besorgung.
    // --------------------------------------------------------
    if (d === 4 && w % 3 === 0) {
      addRoundTrip({
        day,
        startHour: 17,
        startMinute: 30,
        fromKey: "home",
        toKey: "supermarket",
        stopMinutes: 35,
      });

      if (batteryLevel < 45) {
        homeCharge(
          atTime(day, 20, 30),
          80,
        );
      }

      continue;
    }

    // --------------------------------------------------------
    // Drei größere private Wochenendfahrten nach Hamburg.
    // --------------------------------------------------------
    if (
      HAMBURG_TRIP_WEEKS.has(w) &&
      d === 5
    ) {
      if (batteryLevel < 72) {
        homeCharge(
          atTime(addDays(day, -1), 21, 30),
          85,
        );
      }

      const leg1 = driveBetween(
        atTime(day, 8, 45),
        "home",
        "charger-bispingen",
      );

      drives.push(leg1);

      const dc1 = simulateCharging({
        start: new Date(
          leg1.end_date.getTime() +
            5 * 60 * 1000,
        ),
        addressKey: "charger-bispingen",
        geofenceName:
          demoPlace("charger-bispingen").name,
        targetSoc: 82,
        isDc: true,
        peakKw: 170,
        cost: Number(
          (18 + costRng() * 6).toFixed(2),
        ),
        positionCoord:
          pointFor("charger-bispingen"),
      });

      chargingProcesses.push(dc1);

      const leg2 = driveBetween(
        new Date(
          dc1.end_date.getTime() +
            8 * 60 * 1000,
        ),
        "charger-bispingen",
        "hotel-hamburg",
      );

      drives.push(leg2);

      applyParkedDrain(7);

      if (batteryLevel < 68) {
        const hotelCharge = simulateCharging({
          start: atTime(day, 21, 0),
          addressKey: "hotel-hamburg",
          geofenceName:
            demoPlace("hotel-hamburg").name,
          targetSoc: 80,
          isDc: false,
          peakKw: 11,
          cost: null,
          positionCoord:
            pointFor("hotel-hamburg"),
        });

        chargingProcesses.push(
          hotelCharge,
        );
      }

      continue;
    }

    if (
      HAMBURG_TRIP_WEEKS.has(w) &&
      d === 6
    ) {
      const leg1 = driveBetween(
        atTime(day, 14, 30),
        "hotel-hamburg",
        "charger-bispingen",
      );

      drives.push(leg1);

      const dc2 = simulateCharging({
        start: new Date(
          leg1.end_date.getTime() +
            5 * 60 * 1000,
        ),
        addressKey: "charger-bispingen",
        geofenceName:
          demoPlace("charger-bispingen").name,
        targetSoc: 82,
        isDc: true,
        peakKw: 170,
        cost: Number(
          (18 + costRng() * 6).toFixed(2),
        ),
        positionCoord:
          pointFor("charger-bispingen"),
      });

      chargingProcesses.push(dc2);

      const leg2 = driveBetween(
        new Date(
          dc2.end_date.getTime() +
            8 * 60 * 1000,
        ),
        "charger-bispingen",
        "home",
      );

      drives.push(leg2);

      if (batteryLevel < 40) {
        homeCharge(
          atTime(day, 21, 0),
          80,
        );
      }

      continue;
    }

    // In Hamburg-Wochen keine weiteren Wochenendfahrten.
    if (HAMBURG_TRIP_WEEKS.has(w)) {
      continue;
    }

    // --------------------------------------------------------
    // Samstag: etwa alle fünf Wochen Parkhaus.
    // Keine Klassifizierungsregel -> bleibt bewusst offen.
    // --------------------------------------------------------
    if (d === 5 && w % 5 === 0) {
      addRoundTrip({
        day,
        startHour: 10,
        startMinute: 30,
        fromKey: "home",
        toKey: "parking-bielefeld",
        stopMinutes: 90,
      });

      continue;
    }

    // --------------------------------------------------------
    // Sonntag: monatlich Freizeitfahrt nach Detmold,
    // sonst meist normale private Besorgung.
    // --------------------------------------------------------
    if (d === 6 && w % 4 === 1) {
      if (batteryLevel < 45) {
        homeCharge(
          atTime(day, 0, 30),
          80,
        );
      }

      addRoundTrip({
        day,
        startHour: 10,
        startMinute: 15,
        fromKey: "home",
        toKey: "leisure-detmold",
        stopMinutes: 180,
      });

      continue;
    }

    if (d === 6 && scenarioRng() < 0.90) {
      addRoundTrip({
        day,
        startHour: 11,
        startMinute: 0,
        fromKey: "home",
        toKey: "supermarket",
        stopMinutes: 40,
      });

      if (batteryLevel < 42) {
        homeCharge(
          atTime(day, 19, 30),
          80,
        );
      }

      continue;
    }

    // Ein wenig Standverbrauch an Tagen ohne Fahrt.
    applyParkedDrain(18);
  }
}


// ---------------------------------------------------------------------------
// Synthetic TeslaMate state history for the last 30 completed days.
//
// TeslaMate stores online/offline/asleep independently from drives and charging.
// DriveChronik overlays drives and charging sessions in its status timeline.
// ---------------------------------------------------------------------------

const vehicleStates: StateRow[] = [];

const STATE_HISTORY_DAYS = 30;
const firstStateDay = addDays(
  yesterday,
  -(STATE_HISTORY_DAYS - 1),
);

for (let i = 0; i < STATE_HISTORY_DAYS; i += 1) {
  const day = addDays(firstStateDay, i);
  const nextDay = addDays(day, 1);

  const middayState: StateRow["state"] =
    i % 8 === 3 ? "offline" : "online";

  vehicleStates.push(
    {
      state: "asleep",
      start_date: atTime(day, 0, 0),
      end_date: atTime(day, 6, 20),
      car_id: CAR_ID,
    },
    {
      state: "online",
      start_date: atTime(day, 6, 20),
      end_date: atTime(day, 6, 35),
      car_id: CAR_ID,
    },
    {
      state: "asleep",
      start_date: atTime(day, 6, 35),
      end_date: atTime(day, 12, 10),
      car_id: CAR_ID,
    },
    {
      state: middayState,
      start_date: atTime(day, 12, 10),
      end_date: atTime(day, 12, 20),
      car_id: CAR_ID,
    },
    {
      state: "asleep",
      start_date: atTime(day, 12, 20),
      end_date: atTime(day, 17, 15),
      car_id: CAR_ID,
    },
    {
      state: "online",
      start_date: atTime(day, 17, 15),
      end_date: atTime(day, 17, 30),
      car_id: CAR_ID,
    },
    {
      state: "asleep",
      start_date: atTime(day, 17, 30),
      end_date: atTime(nextDay, 0, 0),
      car_id: CAR_ID,
    },
  );
}

// ---------------------------------------------------------------------------
// DB writes
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  console.log(`Seeding TeslaMate fixture DB at ${DATABASE_URL}`);

  if (process.env.SEED_DRY_RUN === "true") {
    const totalKm = drives.reduce(
      (sum, drive) => sum + drive.distance,
      0,
    );

    const dcSessions = chargingProcesses.filter(
      (session) =>
        session.geofence_id ===
          geofenceIdByName[
            demoPlace("charger-bispingen").name
          ] ||
        session.geofence_id ===
          geofenceIdByName[
            demoPlace("charger-lauenau").name
          ] ||
        session.geofence_id ===
          geofenceIdByName[
            demoPlace("charger-porta").name
          ],
    ).length;

    const firstDrive = drives[0];
    const lastDrive =
      drives.length > 0
        ? drives[drives.length - 1]
        : undefined;

    console.log("");
    console.log("Demo dry-run summary");
    console.log("--------------------");
    console.log(`drives:            ${drives.length}`);
    console.log(`distance:          ${totalKm.toFixed(0)} km`);
    console.log(`charging sessions: ${chargingProcesses.length}`);
    console.log(`DC sessions:       ${dcSessions}`);
    console.log(`positions:         ${positions.length}`);
    console.log(
      `date range:        ${firstDrive?.start_date.toISOString() ?? "-"} .. ${lastDrive?.end_date.toISOString() ?? "-"}`,
    );
    console.log(
      `odometer:          ${(odometer - totalKm).toFixed(0)} km .. ${odometer.toFixed(0)} km`,
    );

    return;
  }

  await sql.begin(async (tx) => {
    // Truncate in FK-safe order, restart identity so ids match our
    // in-memory counters (which assume 1-based ids from a fresh sequence).
    await tx`
      TRUNCATE TABLE
        charges,
        charging_processes,
        drives,
        positions,
        states,
        updates,
        cars,
        car_settings,
        geofences,
        addresses
      RESTART IDENTITY CASCADE
    `;

    // car_settings (id=1) then cars (references settings_id)
    const [carSettings] = await tx`
      INSERT INTO car_settings (suspend_min, suspend_after_idle_min, req_not_unlocked, free_supercharging, use_streaming_api, enabled, lfp_battery)
      VALUES (21, 15, false, false, true, true, false)
      RETURNING id
    `;

    await tx`
      INSERT INTO cars (eid, vid, model, efficiency, vin, name, trim_badging, settings_id, exterior_color, wheel_type, display_priority, inserted_at, updated_at)
      VALUES (${CAR.eid}, ${CAR.vid}, ${CAR.model}, ${CAR.efficiency}, ${CAR.vin}, ${CAR.name}, ${CAR.trim_badging}, ${carSettings!.id}, ${CAR.exterior_color}, ${CAR.wheel_type}, 1, now(), now())
    `;

    // vehicle state history
    for (const state of vehicleStates) {
      await tx`
        INSERT INTO states (
          state,
          start_date,
          end_date,
          car_id
        )
        VALUES (
          ${state.state}::states_status,
          ${state.start_date},
          ${state.end_date},
          ${state.car_id}
        )
      `;
    }

    // updates (software update history)
    for (const u of SOFTWARE_UPDATES) {
      const startDate = atTime(addDays(u.monday, u.dayOffset), 3, 15);
      const endDate = u.durationMin != null
        ? new Date(startDate.getTime() + u.durationMin * 60 * 1000)
        : null;
      await tx`
        INSERT INTO updates (start_date, end_date, version, car_id)
        VALUES (${startDate}, ${endDate}, ${u.version}, ${CAR_ID})
      `;
    }

    // geofences
    for (const g of GEOFENCES) {
      await tx`
        INSERT INTO geofences (name, latitude, longitude, radius, inserted_at, updated_at)
        VALUES (${g.name}, ${g.lat}, ${g.lon}, ${g.radius}, now(), now())
      `;
    }

    // addresses
    for (const a of ADDRESSES) {
      await tx`
        INSERT INTO addresses (display_name, latitude, longitude, name, house_number, road, city, postcode, state, country, inserted_at, updated_at)
        VALUES (${a.display_name}, ${a.lat}, ${a.lon}, ${a.name}, ${a.house_number}, ${a.road}, ${a.city}, ${a.postcode}, ${a.state}, ${a.country}, now(), now())
      `;
    }

    // drives are inserted first, WITHOUT start/end_position_id (positions.drive_id
    // has a FK to drives, so positions must come after; but drives.*_position_id
    // has a FK to positions, so we backfill those with an UPDATE once positions
    // exist). Our in-memory ids are 1-based and match the sequences created by
    // RESTART IDENTITY above, since we insert in the same order we generated them.
    const driveRows = drives.map((d) => [
      d.start_date,
      d.end_date,
      d.start_km,
      d.end_km,
      d.distance,
      d.duration_min,
      d.car_id,
      d.start_address_id,
      d.end_address_id,
      d.start_geofence_id,
      d.end_geofence_id,
      d.start_ideal_range_km,
      d.end_ideal_range_km,
      d.start_rated_range_km,
      d.end_rated_range_km,
      d.speed_max,
      d.power_max,
      d.power_min,
      d.outside_temp_avg,
      d.inside_temp_avg,
      d.ascent,
      d.descent,
    ]);
    for (const batch of chunk(driveRows, 1000)) {
      await tx`
        INSERT INTO drives (start_date, end_date, start_km, end_km, distance, duration_min, car_id, start_address_id, end_address_id, start_geofence_id, end_geofence_id, start_ideal_range_km, end_ideal_range_km, start_rated_range_km, end_rated_range_km, speed_max, power_max, power_min, outside_temp_avg, inside_temp_avg, ascent, descent)
        VALUES ${tx(batch as never)}
      `;
    }

    // positions (bulk insert) — now safe, drives already exist for the FK.
    const positionRows = positions.map((p) => [
      p.date,
      p.latitude,
      p.longitude,
      p.speed,
      p.odometer,
      p.ideal_battery_range_km,
      p.battery_level,
      p.usable_battery_level,
      p.rated_battery_range_km,
      p.car_id,
      p.drive_id,
      p.tpms_pressure_fl,
      p.tpms_pressure_fr,
      p.tpms_pressure_rl,
      p.tpms_pressure_rr,
    ]);
    for (const batch of chunk(positionRows, 2000)) {
      await tx`
        INSERT INTO positions (date, latitude, longitude, speed, odometer, ideal_battery_range_km, battery_level, usable_battery_level, rated_battery_range_km, car_id, drive_id, tpms_pressure_fl, tpms_pressure_fr, tpms_pressure_rl, tpms_pressure_rr)
        VALUES ${tx(batch as never)}
      `;
    }

    // Backfill drives.start_position_id / end_position_id now that positions
    // exist. `drives` was built in insertion order under RESTART IDENTITY, so
    // array index + 1 == the row's serial id.
    const positionBackfill = drives.map((d, i) => [
      i + 1,
      d.start_position_id,
      d.end_position_id,
    ]);
    for (const batch of chunk(positionBackfill, 1000)) {
      const ids = batch.map((r) => r[0]);
      const startIds = batch.map((r) => r[1]);
      const endIds = batch.map((r) => r[2]);
      await tx`
        UPDATE drives AS dr
        SET start_position_id = v.start_position_id, end_position_id = v.end_position_id
        FROM (
          SELECT * FROM unnest(
            ${tx.array(ids)}::integer[],
            ${tx.array(startIds)}::integer[],
            ${tx.array(endIds)}::integer[]
          ) AS t(id, start_position_id, end_position_id)
        ) AS v
        WHERE dr.id = v.id
      `;
    }

    // charging_processes
    const cpRows = chargingProcesses.map((c) => [
      c.start_date,
      c.end_date,
      c.charge_energy_added,
      c.charge_energy_used,
      c.start_battery_level,
      c.end_battery_level,
      c.duration_min,
      c.car_id,
      c.position_id,
      c.address_id,
      c.geofence_id,
      c.start_ideal_range_km,
      c.end_ideal_range_km,
      c.start_rated_range_km,
      c.end_rated_range_km,
      c.cost,
    ]);
    for (const batch of chunk(cpRows, 1000)) {
      await tx`
        INSERT INTO charging_processes (start_date, end_date, charge_energy_added, charge_energy_used, start_battery_level, end_battery_level, duration_min, car_id, position_id, address_id, geofence_id, start_ideal_range_km, end_ideal_range_km, start_rated_range_km, end_rated_range_km, cost)
        VALUES ${tx(batch as never)}
      `;
    }

    // charges
    const chargeRows = charges.map((c) => [
      c.date,
      c.battery_level,
      c.usable_battery_level,
      c.charge_energy_added,
      c.charger_power,
      c.charger_phases,
      c.charger_voltage,
      c.fast_charger_present,
      c.ideal_battery_range_km,
      c.rated_battery_range_km,
      c.charging_process_id,
      c.outside_temp,
    ]);
    for (const batch of chunk(chargeRows, 2000)) {
      await tx`
        INSERT INTO charges (date, battery_level, usable_battery_level, charge_energy_added, charger_power, charger_phases, charger_voltage, fast_charger_present, ideal_battery_range_km, rated_battery_range_km, charging_process_id, outside_temp)
        VALUES ${tx(batch as never)}
      `;
    }

    // -----------------------------------------------------------------------
    // Second demo vehicle for multi-vehicle testing.
    //
    // The primary fixture generator intentionally remains unchanged. The
    // second car is derived from the completed first-car dataset so both cars
    // exercise the same TeslaMate relationships while still having clearly
    // distinguishable vehicle data.
    // -----------------------------------------------------------------------

    const [secondCarSettings] = await tx`
      INSERT INTO car_settings (
        suspend_min,
        suspend_after_idle_min,
        req_not_unlocked,
        free_supercharging,
        use_streaming_api,
        enabled,
        lfp_battery
      )
      VALUES (21, 15, false, false, true, true, true)
      RETURNING id
    `;

    const [secondCar] = await tx`
      INSERT INTO cars (
        eid,
        vid,
        model,
        efficiency,
        vin,
        name,
        trim_badging,
        settings_id,
        exterior_color,
        wheel_type,
        display_priority,
        inserted_at,
        updated_at
      )
      VALUES (
        1111111112,
        2222222223,
        '3',
        0.155,
        '5YJ3E1EA0TF000002',
        'Demo Model 3',
        'RWD',
        ${secondCarSettings!.id},
        'DeepBlueMetallic',
        'Aero18',
        2,
        now(),
        now()
      )
      RETURNING id
    `;

    const secondCarId = Number(secondCar!.id);

    const [offsets] = await tx`
      SELECT
        (SELECT COALESCE(MAX(id), 0)::int FROM drives) AS drive_offset,
        (SELECT COALESCE(MAX(id), 0)::int FROM positions) AS position_offset,
        (
          SELECT COALESCE(MAX(id), 0)::int
          FROM charging_processes
        ) AS charging_process_offset,
        (SELECT COALESCE(MAX(id), 0)::int FROM charges) AS charge_offset
    `;

    const driveOffset = Number(offsets!.drive_offset);
    const positionOffset = Number(offsets!.position_offset);
    const chargingProcessOffset = Number(
      offsets!.charging_process_offset,
    );
    const chargeOffset = Number(offsets!.charge_offset);

    // Drives: same realistic routes, but two hours later and with a clearly
    // different odometer/range profile.
    await tx`
      INSERT INTO drives (
        id,
        start_date,
        end_date,
        start_km,
        end_km,
        distance,
        duration_min,
        car_id,
        start_address_id,
        end_address_id,
        start_geofence_id,
        end_geofence_id,
        start_ideal_range_km,
        end_ideal_range_km,
        start_rated_range_km,
        end_rated_range_km,
        speed_max,
        power_max,
        power_min,
        outside_temp_avg,
        inside_temp_avg,
        ascent,
        descent
      )
      SELECT
        id + ${driveOffset},
        start_date + interval '1 day 2 hours',
        end_date + interval '1 day 2 hours',
        start_km + 10000,
        end_km + 10000,
        distance,
        duration_min,
        ${secondCarId},
        start_address_id,
        end_address_id,
        start_geofence_id,
        end_geofence_id,
        start_ideal_range_km * 0.92,
        end_ideal_range_km * 0.92,
        start_rated_range_km * 0.92,
        end_rated_range_km * 0.92,
        speed_max,
        power_max,
        power_min,
        outside_temp_avg,
        inside_temp_avg,
        ascent,
        descent
      FROM drives
      WHERE car_id = ${CAR_ID}
      ORDER BY id
    `;

    // Positions including GPS, odometer, SoC and TPMS.
    await tx`
      INSERT INTO positions (
        id,
        date,
        latitude,
        longitude,
        speed,
        odometer,
        ideal_battery_range_km,
        battery_level,
        usable_battery_level,
        rated_battery_range_km,
        car_id,
        drive_id,
        tpms_pressure_fl,
        tpms_pressure_fr,
        tpms_pressure_rl,
        tpms_pressure_rr
      )
      SELECT
        id + ${positionOffset},
        date + interval '1 day 2 hours',
        latitude,
        longitude,
        speed,
        odometer + 10000,
        ideal_battery_range_km * 0.92,
        GREATEST(0, battery_level - 7),
        GREATEST(0, usable_battery_level - 7),
        rated_battery_range_km * 0.92,
        ${secondCarId},
        CASE
          WHEN drive_id IS NULL THEN NULL
          ELSE drive_id + ${driveOffset}
        END,
        tpms_pressure_fl + 0.05,
        tpms_pressure_fr + 0.05,
        tpms_pressure_rl + 0.05,
        tpms_pressure_rr + 0.05
      FROM positions
      WHERE car_id = ${CAR_ID}
      ORDER BY id
    `;

    // Now that the cloned positions exist, connect cloned drives to their
    // cloned start/end positions.
    await tx`
      UPDATE drives AS target
      SET
        start_position_id =
          CASE
            WHEN source.start_position_id IS NULL THEN NULL
            ELSE source.start_position_id + ${positionOffset}
          END,
        end_position_id =
          CASE
            WHEN source.end_position_id IS NULL THEN NULL
            ELSE source.end_position_id + ${positionOffset}
          END
      FROM drives AS source
      WHERE source.car_id = ${CAR_ID}
        AND target.car_id = ${secondCarId}
        AND target.id = source.id + ${driveOffset}
    `;

    // Charging sessions.
    await tx`
      INSERT INTO charging_processes (
        id,
        start_date,
        end_date,
        charge_energy_added,
        charge_energy_used,
        start_battery_level,
        end_battery_level,
        duration_min,
        car_id,
        position_id,
        address_id,
        geofence_id,
        start_ideal_range_km,
        end_ideal_range_km,
        start_rated_range_km,
        end_rated_range_km,
        cost
      )
      SELECT
        id + ${chargingProcessOffset},
        start_date + interval '1 day 2 hours',
        end_date + interval '1 day 2 hours',
        charge_energy_added * 0.88,
        charge_energy_used * 0.94,
        GREATEST(0, start_battery_level - 7),
        GREATEST(0, end_battery_level - 7),
        duration_min,
        ${secondCarId},
        CASE
          WHEN position_id IS NULL THEN NULL
          ELSE position_id + ${positionOffset}
        END,
        address_id,
        geofence_id,
        start_ideal_range_km * 0.92,
        end_ideal_range_km * 0.92,
        start_rated_range_km * 0.92,
        end_rated_range_km * 0.92,
        CASE
          WHEN cost IS NULL THEN NULL
          ELSE cost * 1.08
        END
      FROM charging_processes
      WHERE car_id = ${CAR_ID}
      ORDER BY id
    `;

    // Individual charging measurements.
    await tx`
      INSERT INTO charges (
        id,
        date,
        battery_level,
        usable_battery_level,
        charge_energy_added,
        charger_power,
        charger_phases,
        charger_voltage,
        fast_charger_present,
        ideal_battery_range_km,
        rated_battery_range_km,
        charging_process_id,
        outside_temp
      )
      SELECT
        c.id + ${chargeOffset},
        c.date + interval '1 day 2 hours',
        GREATEST(0, c.battery_level - 7),
        GREATEST(0, c.usable_battery_level - 7),
        c.charge_energy_added * 0.88,
        c.charger_power,
        c.charger_phases,
        c.charger_voltage,
        c.fast_charger_present,
        c.ideal_battery_range_km * 0.92,
        c.rated_battery_range_km * 0.92,
        c.charging_process_id + ${chargingProcessOffset},
        c.outside_temp
      FROM charges AS c
      JOIN charging_processes AS source_cp
        ON source_cp.id = c.charging_process_id
      WHERE source_cp.car_id = ${CAR_ID}
      ORDER BY c.id
    `;

    // Vehicle online/offline/asleep history.
    await tx`
      INSERT INTO states (
        state,
        start_date,
        end_date,
        car_id
      )
      SELECT
        state,
        start_date + interval '1 day 2 hours',
        end_date + interval '1 day 2 hours',
        ${secondCarId}
      FROM states
      WHERE car_id = ${CAR_ID}
      ORDER BY id
    `;

    // Software update history.
    await tx`
      INSERT INTO updates (
        start_date,
        end_date,
        version,
        car_id
      )
      SELECT
        start_date + interval '1 day 2 hours',
        CASE
          WHEN end_date IS NULL THEN NULL
          ELSE end_date + interval '1 day 2 hours'
        END,
        version,
        ${secondCarId}
      FROM updates
      WHERE car_id = ${CAR_ID}
      ORDER BY id
    `;

    // Explicit ids were used for the large cloned tables. Keep their serial
    // sequences in sync so later inserts remain safe.
    await tx`
      SELECT setval(
        pg_get_serial_sequence('drives', 'id'),
        (SELECT MAX(id) FROM drives),
        true
      )
    `;

    await tx`
      SELECT setval(
        pg_get_serial_sequence('positions', 'id'),
        (SELECT MAX(id) FROM positions),
        true
      )
    `;

    await tx`
      SELECT setval(
        pg_get_serial_sequence('charging_processes', 'id'),
        (SELECT MAX(id) FROM charging_processes),
        true
      )
    `;

    await tx`
      SELECT setval(
        pg_get_serial_sequence('charges', 'id'),
        (SELECT MAX(id) FROM charges),
        true
      )
    `;

  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const counts = await sql`
    SELECT
      (SELECT count(*) FROM cars) AS cars,
      (SELECT count(*) FROM car_settings) AS car_settings,
      (SELECT count(*) FROM geofences) AS geofences,
      (SELECT count(*) FROM addresses) AS addresses,
      (SELECT count(*) FROM drives) AS drives,
      (SELECT count(*) FROM positions) AS positions,
      (SELECT count(*) FROM charging_processes) AS charging_processes,
      (SELECT count(*) FROM charges) AS charges,
      (SELECT count(*) FROM states) AS states,
      (SELECT count(*) FROM updates) AS updates
  `;
  const dateRange = await sql`
    SELECT min(start_date) AS min_date, max(end_date) AS max_date FROM drives
  `;
  const odoRange = await sql`
    SELECT min(start_km) AS min_km, max(end_km) AS max_km FROM drives
  `;

  const c = counts[0]!;
  const dr = dateRange[0]!;
  const or_ = odoRange[0]!;

  console.log("");
  console.log("Seed summary");
  console.log("------------");
  console.log(`cars:                ${c.cars}`);
  console.log(`car_settings:        ${c.car_settings}`);
  console.log(`geofences:           ${c.geofences}`);
  console.log(`addresses:           ${c.addresses}`);
  console.log(`drives:              ${c.drives}`);
  console.log(`positions:           ${c.positions}`);
  console.log(`charging_processes:  ${c.charging_processes}`);
  console.log(`states:              ${c.states}`);
  console.log(`charges:             ${c.charges}`);
  console.log(`updates:             ${c.updates}`);
  console.log("");
  console.log(`date range:  ${dr.min_date?.toISOString()} .. ${dr.max_date?.toISOString()}`);
  console.log(`odometer:    ${Number(or_.min_km).toFixed(1)} km .. ${Number(or_.max_km).toFixed(1)} km`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
