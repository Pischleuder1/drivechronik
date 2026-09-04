import "server-only";

import type {
  ChargingSearchOptions,
  ChargingSite,
  ChargingSiteProvider,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

interface SuperchargeCompassSite {
  id?: unknown;
  name?: unknown;
  lat?: unknown;
  lon?: unknown;
  address?: unknown;
  status?: unknown;
  openToAllEvs?: unknown;
  stallCount?: unknown;
  source?: unknown;
}

interface SuperchargeCompassResponse {
  superchargers?: unknown;
  meta?: {
    dataTimestamp?: unknown;
    source?: unknown;
    count?: unknown;
    stale?: unknown;
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function parseSite(value: unknown): ChargingSite | null {
  if (typeof value !== "object" || value === null) return null;

  const site = value as SuperchargeCompassSite;

  const lat = finiteNumber(site.lat);
  const lon = finiteNumber(site.lon);

  if (
    typeof site.id !== "string" ||
    typeof site.name !== "string" ||
    lat == null ||
    lon == null
  ) {
    return null;
  }

  if (site.status !== "open") return null;

  return {
    id: site.id,
    name: site.name,
    lat,
    lon,
    network: "tesla",

    // SuperchargeCompass liefert derzeit keine belastbare
    // Maximalleistung pro Standort.
    powerKw: null,

    stalls:
      typeof site.stallCount === "number" &&
      Number.isFinite(site.stallCount)
        ? site.stallCount
        : null,

    openToAllEvs:
      typeof site.openToAllEvs === "boolean"
        ? site.openToAllEvs
        : null,

    pricePerKwhEur: null,
    priceSource: null,
    priceUpdatedAt: null,

    source:
      typeof site.source === "string"
        ? `supercharge-compass:${site.source}`
        : "supercharge-compass",
  };
}

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const radiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

/**
 * Kleinste Luftlinienentfernung eines Ladeorts zu den
 * vorhandenen Stützpunkten der geplanten Route.
 *
 * Die endgültige Eignung eines Ladestopps wird später zusätzlich
 * über echte Straßenwege / Detour bewertet.
 */
function distanceToRouteKm(
  site: ChargingSite,
  geometry: [number, number][],
): number {
  let best = Number.POSITIVE_INFINITY;

  for (const [lat, lon] of geometry) {
    const distance = haversineKm(site.lat, site.lon, lat, lon);
    if (distance < best) best = distance;
  }

  return best;
}

export class SuperchargeCompassProvider
  implements ChargingSiteProvider
{
  readonly id = "supercharge-compass";

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async findAlongRoute(
    geometry: [number, number][],
    options: ChargingSearchOptions = {},
  ): Promise<ChargingSite[]> {
    if (geometry.length < 2) return [];

    const corridorKm = options.corridorKm ?? 15;

    const url = new URL(
      "/api/superchargers",
      this.baseUrl.replace(/\/+$/, "") + "/",
    );

    url.searchParams.set("comingSoon", "false");

    let response: Response;

    try {
      response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      return [];
    }

    if (!response.ok) return [];

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      return [];
    }

    if (typeof body !== "object" || body === null) return [];

    const parsed = body as SuperchargeCompassResponse;

    if (!Array.isArray(parsed.superchargers)) return [];

    const sites = parsed.superchargers
      .map(parseSite)
      .filter((site): site is ChargingSite => site != null);

    return sites.filter(
      (site) => distanceToRouteKm(site, geometry) <= corridorKm,
    );
  }
}

export function getSuperchargeCompassProvider():
  | SuperchargeCompassProvider
  | null {
  const baseUrl = process.env.SUPERCHARGE_COMPASS_URL?.trim();

  if (!baseUrl) return null;

  return new SuperchargeCompassProvider(baseUrl);
}
