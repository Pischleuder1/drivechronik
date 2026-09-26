import { getOsrmUrl } from "./config";
import type { GeoPoint, RangeSamplePoint } from "./rangeMapLogic";

const OSRM_DEFAULT_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 15000;

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

interface OsrmTableResponse {
  code?: string;
  distances?: unknown;
}

/**
 * Lädt in einem OSRM-Table-Aufruf die Straßenentfernung vom Fahrzeug zu allen
 * radialen Kandidaten.
 *
 * Koordinate 0 ist der Fahrzeugstandort. Nur diese Koordinate wird als Source
 * verwendet; alle weiteren Koordinaten sind Destinations. Dadurch liefert OSRM
 * lediglich eine einzelne Distanzzeile.
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
    parsed.distances[0].length !== expectedCount
  ) {
    return null;
  }

  const result: Array<number | null> = [];

  for (const value of parsed.distances[0]) {
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

    result.push(value / 1000);
  }

  return result;
}
