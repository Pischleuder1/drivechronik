import { getOsrmUrl } from "./config";
import type { GeoPoint, RangeSamplePoint } from "./rangeMapLogic";

const OSRM_DEFAULT_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 15000;

/**
 * Kandidaten, die OSRM mehr als 5 km zum nächsten Straßensegment verschieben
 * müsste, sind für eine Reichweiten-Isochrone nicht mehr repräsentativ.
 *
 * Typischer Fall: Ein radial erzeugter Testpunkt liegt in Nord- oder Ostsee
 * und OSRM snappt ihn viele Kilometer weit an eine Küste oder Insel.
 */
export const MAX_OSRM_SNAP_DISTANCE_M = 5000;

export type RangeRoadDistancesResult =
  | {
      ok: true;
      distancesKm: Array<number | null>;
      osrmIsDefault: boolean;
    }
  | {
      ok: false;
      reason:
        | "invalid_request"
        | "unavailable"
        | "rate_limited"
        | "http_error"
        | "bad_response";
      osrmIsDefault: boolean;
    };

interface OsrmWaypointShape {
  distance?: unknown;
}

interface OsrmTableResponse {
  code?: string;
  distances?: unknown;
  destinations?: unknown;
}

/**
 * Lädt in einem OSRM-Table-Aufruf die Straßenentfernung vom Fahrzeug zu allen
 * radialen Kandidaten.
 *
 * Koordinate 0 ist der Fahrzeugstandort. Nur diese Koordinate wird als Source
 * verwendet; alle weiteren Koordinaten sind Destinations.
 *
 * Stark gesnappte Zielpunkte werden anschließend als nicht verwendbar (`null`)
 * behandelt. So können Wasserflächen oder straßenlose Gebiete das Polygon
 * nicht künstlich verzerren.
 */
export async function fetchRangeRoadDistances(
  origin: GeoPoint,
  samples: readonly RangeSamplePoint[],
): Promise<RangeRoadDistancesResult> {
  const configuredOsrmUrl = getOsrmUrl();
  const baseUrl = (configuredOsrmUrl ?? OSRM_DEFAULT_URL).replace(/\/+$/, "");
  const osrmIsDefault = configuredOsrmUrl == null;

  if (samples.length === 0 || samples.length > 99) {
    return {
      ok: false,
      reason: "invalid_request",
      osrmIsDefault,
    };
  }

  const points: GeoPoint[] = [origin, ...samples];

  const coordinates = points
    .map((point) => `${point.lon},${point.lat}`)
    .join(";");

  const destinations = samples
    .map((_, index) => String(index + 1))
    .join(";");

  const url = new URL(`${baseUrl}/table/v1/driving/${coordinates}`);
  url.searchParams.set("sources", "0");
  url.searchParams.set("destinations", destinations);
  url.searchParams.set("annotations", "distance");

  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      osrmIsDefault,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      reason: "rate_limited",
      osrmIsDefault,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "http_error",
      osrmIsDefault,
    };
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      reason: "bad_response",
      osrmIsDefault,
    };
  }

  const distancesKm = parseOsrmTableDistances(body, samples.length);

  if (!distancesKm) {
    return {
      ok: false,
      reason: "bad_response",
      osrmIsDefault,
    };
  }

  return {
    ok: true,
    distancesKm,
    osrmIsDefault,
  };
}

export function parseOsrmTableDistances(
  body: unknown,
  expectedCount: number,
): Array<number | null> | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !Number.isInteger(expectedCount) ||
    expectedCount < 1
  ) {
    return null;
  }

  const parsed = body as OsrmTableResponse;

  if (
    parsed.code !== "Ok" ||
    !Array.isArray(parsed.distances) ||
    parsed.distances.length !== 1 ||
    !Array.isArray(parsed.distances[0]) ||
    parsed.distances[0].length !== expectedCount ||
    !Array.isArray(parsed.destinations) ||
    parsed.destinations.length !== expectedCount
  ) {
    return null;
  }

  const result: Array<number | null> = [];

  for (let index = 0; index < expectedCount; index += 1) {
    const value = parsed.distances[0][index];
    const destination = parsed.destinations[index];

    if (value === null) {
      result.push(null);
      continue;
    }

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      return null;
    }

    if (
      typeof destination !== "object" ||
      destination === null
    ) {
      result.push(null);
      continue;
    }

    const snapDistance = (destination as OsrmWaypointShape).distance;

    if (
      typeof snapDistance !== "number" ||
      !Number.isFinite(snapDistance) ||
      snapDistance < 0
    ) {
      result.push(null);
      continue;
    }

    if (snapDistance > MAX_OSRM_SNAP_DISTANCE_M) {
      result.push(null);
      continue;
    }

    result.push(value / 1000);
  }

  return result;
}
