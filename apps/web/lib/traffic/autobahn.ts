import type {
  FindTrafficEventsOptions,
  TrafficEvent,
  TrafficEventType,
} from "./types";

const AUTOBAHN_API_BASE = "https://verkehr.autobahn.de/o/autobahn";

const REQUEST_TIMEOUT_MS = 7_000;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const DEFAULT_CORRIDOR_KM = 1.5;

const EARTH_RADIUS_KM = 6371;

type AutobahnService = "warning" | "roadworks" | "closure";

interface RawAutobahnItem {
  identifier?: unknown;
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;

  future?: unknown;
  isBlocked?: unknown;
  display_type?: unknown;
  startTimestamp?: unknown;

  coordinate?: {
    lat?: unknown;
    long?: unknown;
  };

  geometry?: {
    type?: unknown;
    coordinates?: unknown;
  };
}

interface CacheEntry {
  expiresAt: number;
  items: RawAutobahnItem[];
}

interface RoutePosition {
  routeDistanceKm: number;
  distanceToRouteKm: number;
}

const serviceCache = new Map<string, CacheEntry>();

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string",
  );
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.asin(Math.min(1, Math.sqrt(h)))
  );
}

/**
 * Bestimmt den kleinsten Abstand eines Punktes zu einem Routensegment.
 *
 * Die lokale equirektanguläre Projektion reicht für kurze Straßensegmente
 * vollkommen aus und vermeidet zusätzliche GIS-Abhängigkeiten.
 */
function pointToSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): {
  distanceKm: number;
  fraction: number;
} {
  const [pointLon, pointLat] = point;

  const cosLat = Math.cos(toRad(pointLat));

  const project = ([lon, lat]: [number, number]) => ({
    x: toRad(lon - pointLon) * EARTH_RADIUS_KM * cosLat,
    y: toRad(lat - pointLat) * EARTH_RADIUS_KM,
  });

  const a = project(start);
  const b = project(end);

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= Number.EPSILON) {
    return {
      distanceKm: Math.sqrt(a.x * a.x + a.y * a.y),
      fraction: 0,
    };
  }

  const rawFraction = -(a.x * dx + a.y * dy) / lengthSquared;
  const fraction = Math.max(0, Math.min(1, rawFraction));

  const nearestX = a.x + fraction * dx;
  const nearestY = a.y + fraction * dy;

  return {
    distanceKm: Math.sqrt(
      nearestX * nearestX + nearestY * nearestY,
    ),
    fraction,
  };
}

/**
 * Ermittelt für einen Punkt sowohl den Abstand zur Route als auch die
 * Entfernung entlang der Route ab dem Start.
 *
 * Route und Punkt verwenden GeoJSON-Reihenfolge [lon, lat].
 */
export function positionPointOnRoute(
  point: [number, number],
  route: [number, number][],
): RoutePosition | null {
  if (route.length < 2) return null;

  let cumulativeKm = 0;
  let bestDistanceKm = Number.POSITIVE_INFINITY;
  let bestRouteDistanceKm = 0;

  for (let i = 1; i < route.length; i += 1) {
    const start = route[i - 1]!;
    const end = route[i]!;

    const segmentLengthKm = haversineKm(start, end);

    const candidate = pointToSegment(point, start, end);

    if (candidate.distanceKm < bestDistanceKm) {
      bestDistanceKm = candidate.distanceKm;
      bestRouteDistanceKm =
        cumulativeKm + segmentLengthKm * candidate.fraction;
    }

    cumulativeKm += segmentLengthKm;
  }

  if (!Number.isFinite(bestDistanceKm)) return null;

  return {
    routeDistanceKm: bestRouteDistanceKm,
    distanceToRouteKm: bestDistanceKm,
  };
}

/**
 * Lange Ereignislinien erhalten zusätzliche Zwischenpunkte.
 * Dadurch verpassen wir keine Baustelle, deren Endpunkte neben der Route
 * liegen, deren Linie die Route aber schneidet.
 */
function densifyGeometry(
  geometry: [number, number][],
  maxSegmentKm = 0.5,
): [number, number][] {
  if (geometry.length < 2) return geometry;

  const result: [number, number][] = [geometry[0]!];

  for (let i = 1; i < geometry.length; i += 1) {
    const start = geometry[i - 1]!;
    const end = geometry[i]!;

    const distanceKm = haversineKm(start, end);
    const steps = Math.max(1, Math.ceil(distanceKm / maxSegmentKm));

    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;

      result.push([
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ]);
    }
  }

  return result;
}

export function positionTrafficGeometryOnRoute(
  geometry: [number, number][],
  route: [number, number][],
): RoutePosition | null {
  if (geometry.length === 0 || route.length < 2) return null;

  let best: RoutePosition | null = null;

  for (const point of densifyGeometry(geometry)) {
    const positioned = positionPointOnRoute(point, route);

    if (
      positioned &&
      (!best ||
        positioned.distanceToRouteKm < best.distanceToRouteKm)
    ) {
      best = positioned;
    }
  }

  return best;
}

function parseGeometry(
  item: RawAutobahnItem,
): [number, number][] {
  const coordinates = item.geometry?.coordinates;

  if (Array.isArray(coordinates)) {
    const parsed: [number, number][] = [];

    for (const coordinate of coordinates) {
      if (
        Array.isArray(coordinate) &&
        coordinate.length >= 2
      ) {
        const lon = asNumber(coordinate[0]);
        const lat = asNumber(coordinate[1]);

        if (lon !== null && lat !== null) {
          parsed.push([lon, lat]);
        }
      }
    }

    if (parsed.length > 0) return parsed;
  }

  const lat = asNumber(item.coordinate?.lat);
  const lon = asNumber(item.coordinate?.long);

  if (lat !== null && lon !== null) {
    return [[lon, lat]];
  }

  return [];
}

function resultKey(service: AutobahnService): string {
  if (service === "roadworks") return "roadworks";
  if (service === "warning") return "warning";
  return "closure";
}

async function fetchService(
  motorway: string,
  service: AutobahnService,
): Promise<RawAutobahnItem[]> {
  const cacheKey = `${motorway}:${service}`;

  const cached = serviceCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const url =
    `${AUTOBAHN_API_BASE}/` +
    `${encodeURIComponent(motorway)}/services/${service}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DriveChronik/0.8.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as unknown;

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return [];
    }

    const key = resultKey(service);
    const value = (body as Record<string, unknown>)[key];

    const items = Array.isArray(value)
      ? value.filter(
          (item): item is RawAutobahnItem =>
            typeof item === "object" && item !== null,
        )
      : [];

    serviceCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      items,
    });

    return items;
  } catch {
    // Verkehrsdaten dürfen niemals die eigentliche Routenplanung blockieren.
    return [];
  }
}

function serviceToType(
  service: AutobahnService,
): TrafficEventType {
  if (service === "roadworks") return "roadwork";
  return service;
}

function normalizeEvent(
  motorway: string,
  service: AutobahnService,
  item: RawAutobahnItem,
  route: [number, number][],
  corridorKm: number,
  includeFuture: boolean,
): TrafficEvent | null {
  const future = asBoolean(item.future);

  if (future && !includeFuture) {
    return null;
  }

  const geometry = parseGeometry(item);

  if (geometry.length === 0) {
    return null;
  }

  const position = positionTrafficGeometryOnRoute(
    geometry,
    route,
  );

  if (
    !position ||
    position.distanceToRouteKm > corridorKm
  ) {
    return null;
  }

  const representativePoint = geometry[0]!;
  const identifier =
    asString(item.identifier) ??
    [
      motorway,
      service,
      representativePoint[1],
      representativePoint[0],
    ].join(":");

  return {
    id: identifier,
    type: serviceToType(service),

    motorway,

    title: asString(item.title) ?? motorway,
    subtitle: asString(item.subtitle),
    description: asStringArray(item.description),

    lat: representativePoint[1],
    lon: representativePoint[0],

    routeDistanceKm: position.routeDistanceKm,
    distanceToRouteKm: position.distanceToRouteKm,

    future,
    blocked: asBoolean(item.isBlocked),

    displayType: asString(item.display_type),
    startTimestamp: asString(item.startTimestamp),

    geometry,
  };
}

export async function findAutobahnEventsAlongRoute(
  motorwayRefs: string[],
  route: [number, number][],
  options: FindTrafficEventsOptions = {},
): Promise<TrafficEvent[]> {
  if (route.length < 2 || motorwayRefs.length === 0) {
    return [];
  }

  const corridorKm =
    options.corridorKm ?? DEFAULT_CORRIDOR_KM;

  const includeFuture = options.includeFuture ?? false;

  const motorways = [
    ...new Set(
      motorwayRefs
        .map((ref) => ref.trim().toUpperCase())
        .filter((ref) => /^A\d+$/.test(ref)),
    ),
  ];

  const services: AutobahnService[] = [
    "warning",
    "roadworks",
    "closure",
  ];

  const collected = await Promise.all(
    motorways.map(async (motorway) => {
      const serviceResults = await Promise.all(
        services.map(async (service) => ({
          service,
          items: await fetchService(motorway, service),
        })),
      );

      const events: TrafficEvent[] = [];

      for (const { service, items } of serviceResults) {
        for (const item of items) {
          const event = normalizeEvent(
            motorway,
            service,
            item,
            route,
            corridorKm,
            includeFuture,
          );

          if (event) {
            events.push(event);
          }
        }
      }

      return events;
    }),
  );

  const deduplicated = new Map<string, TrafficEvent>();

  for (const event of collected.flat()) {
    const key = `${event.motorway}:${event.type}:${event.id}`;

    const previous = deduplicated.get(key);

    if (
      !previous ||
      event.distanceToRouteKm <
        previous.distanceToRouteKm
    ) {
      deduplicated.set(key, event);
    }
  }

  return [...deduplicated.values()].sort(
    (a, b) => a.routeDistanceKm - b.routeDistanceKm,
  );
}
