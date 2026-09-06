import "server-only";

import type {
  ChargingNetwork,
  ChargingSearchOptions,
  ChargingSite,
  ChargingSiteProvider,
} from "./types";

const NDW_GEOJSON_URL =
  "https://dotnl.ndw.nu/api/rest/geojson/dynamic-road-status/charge-point-data/v1/features";

const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

// NDW erlaubt maximal 10 Requests/s.
// Etwas Reserve verhindert unnötige HTTP-429-Antworten.
const MIN_REQUEST_INTERVAL_MS = 125;

// Große Bereiche werden vorsorglich zerlegt.
// Die NDW-Grenze selbst liegt bei 1,0 Grad².
const INITIAL_MAX_AREA_DEG2 = 0.65;
const MAX_SPLIT_DEPTH = 7;

interface NdwAvailability {
  total?: number | null;
  available?: number | null;
  power_max?: number | null;
  power_type?: string | null;
  connector_type?: string | null;
}

interface NdwProperties {
  country?: string | null;
  address?: string | null;
  owner_name?: string | null;
  operator_name?: string | null;
  suboperator_name?: string | null;
  availabilities?: NdwAvailability[] | null;
}

interface NdwFeature {
  id?: string;
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
  properties?: NdwProperties;
}

interface NdwFeatureCollection {
  features?: NdwFeature[];
}

interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface CacheEntry {
  loadedAt: number;
  features: NdwFeature[];
}

const bboxCache = new Map<string, CacheEntry>();

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const remaining = MIN_REQUEST_INTERVAL_MS - elapsed;

  if (remaining > 0) {
    await sleep(remaining);
  }

  lastRequestAt = Date.now();
}

function networkFromOperator(operator: string): ChargingNetwork {
  const normalized = operator.toLowerCase();

  if (normalized.includes("ionity")) return "ionity";
  if (normalized.includes("fastned")) return "fastned";
  if (normalized.includes("enbw")) return "enbw";

  return "other";
}

function isTeslaOperator(operator: string): boolean {
  return operator.toLowerCase().includes("tesla");
}

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const radiusKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

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

function distanceToRouteKm(
  site: ChargingSite,
  geometry: [number, number][],
): number {
  let best = Number.POSITIVE_INFINITY;

  for (const [lat, lon] of geometry) {
    const distance = haversineKm(
      site.lat,
      site.lon,
      lat,
      lon,
    );

    if (distance < best) {
      best = distance;
    }
  }

  return best;
}

function boundingBoxArea(box: BoundingBox): number {
  return (
    Math.max(0, box.maxLon - box.minLon) *
    Math.max(0, box.maxLat - box.minLat)
  );
}

function splitBoundingBox(
  box: BoundingBox,
): [BoundingBox, BoundingBox] {
  const lonSpan = box.maxLon - box.minLon;
  const latSpan = box.maxLat - box.minLat;

  if (lonSpan >= latSpan) {
    const middle = (box.minLon + box.maxLon) / 2;

    return [
      {
        ...box,
        maxLon: middle,
      },
      {
        ...box,
        minLon: middle,
      },
    ];
  }

  const middle = (box.minLat + box.maxLat) / 2;

  return [
    {
      ...box,
      maxLat: middle,
    },
    {
      ...box,
      minLat: middle,
    },
  ];
}

function splitForInitialArea(
  box: BoundingBox,
): BoundingBox[] {
  if (boundingBoxArea(box) <= INITIAL_MAX_AREA_DEG2) {
    return [box];
  }

  const [a, b] = splitBoundingBox(box);

  return [
    ...splitForInitialArea(a),
    ...splitForInitialArea(b),
  ];
}

function bboxKey(box: BoundingBox): string {
  return [
    box.minLon.toFixed(5),
    box.minLat.toFixed(5),
    box.maxLon.toFixed(5),
    box.maxLat.toFixed(5),
  ].join(",");
}

function routeBoundingBox(
  geometry: [number, number][],
  corridorKm: number,
): BoundingBox | null {
  // Grober Bereich Niederlande plus etwas Rand für Grenzregionen.
  // So beeinflussen deutsche Routenteile die NDW-Abfrage nicht.
  const dutchRoutePoints = geometry.filter(
    ([lat, lon]) =>
      lat >= 50.5 &&
      lat <= 53.8 &&
      lon >= 3.0 &&
      lon <= 7.7,
  );

  if (dutchRoutePoints.length === 0) {
    return null;
  }

  const latitudes = dutchRoutePoints.map(([lat]) => lat);
  const longitudes = dutchRoutePoints.map(([, lon]) => lon);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  const middleLat = (minLat + maxLat) / 2;

  const latMargin = corridorKm / 111;
  const lonFactor = Math.max(
    0.2,
    Math.cos((middleLat * Math.PI) / 180),
  );
  const lonMargin = corridorKm / (111 * lonFactor);

  return {
    minLon: minLon - lonMargin,
    minLat: minLat - latMargin,
    maxLon: maxLon + lonMargin,
    maxLat: maxLat + latMargin,
  };
}

function bboxUrl(box: BoundingBox): string {
  const url = new URL(NDW_GEOJSON_URL);

  // NDW erwartet: minLon,minLat,maxLon,maxLat
  url.searchParams.set(
    "bbox",
    [
      box.minLon,
      box.minLat,
      box.maxLon,
      box.maxLat,
    ].join(","),
  );

  return url.toString();
}

async function fetchBoundingBox(
  box: BoundingBox,
  depth = 0,
): Promise<NdwFeature[]> {
  const key = bboxKey(box);
  const cached = bboxCache.get(key);

  if (
    cached &&
    Date.now() - cached.loadedAt < CACHE_TTL_MS
  ) {
    return cached.features;
  }

  await respectRateLimit();

  let response: Response;

  try {
    response = await fetch(bboxUrl(box), {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "user-agent": "DriveChronik/0.3",
        accept: "application/geo+json, application/json",
      },
    });
  } catch {
    return [];
  }

  // Ein zu dichter Bereich wird automatisch geteilt.
  if (
    (response.status === 400 ||
      response.status === 413) &&
    depth < MAX_SPLIT_DEPTH
  ) {
    const [a, b] = splitBoundingBox(box);

    const first = await fetchBoundingBox(a, depth + 1);
    const second = await fetchBoundingBox(b, depth + 1);

    return [...first, ...second];
  }

  if (response.status === 429) {
    await sleep(1000);

    if (depth < MAX_SPLIT_DEPTH) {
      return fetchBoundingBox(box, depth + 1);
    }

    return [];
  }

  if (!response.ok) {
    return [];
  }

  let data: NdwFeatureCollection;

  try {
    data = (await response.json()) as NdwFeatureCollection;
  } catch {
    return [];
  }

  const features = Array.isArray(data.features)
    ? data.features
    : [];

  // 1000 ist das dokumentierte Maximum. Ist es erreicht,
  // teilen wir den Bereich, damit keine Standorte fehlen.
  if (
    features.length >= 1000 &&
    depth < MAX_SPLIT_DEPTH
  ) {
    const [a, b] = splitBoundingBox(box);

    const first = await fetchBoundingBox(a, depth + 1);
    const second = await fetchBoundingBox(b, depth + 1);

    return [...first, ...second];
  }

  bboxCache.set(key, {
    loadedAt: Date.now(),
    features,
  });

  return features;
}

function featureToChargingSite(
  feature: NdwFeature,
  minimumPowerKw: number,
): ChargingSite | null {
  const coordinates = feature.geometry?.coordinates;

  if (
    !coordinates ||
    coordinates.length < 2
  ) {
    return null;
  }

  const [lon, lat] = coordinates;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  const properties = feature.properties ?? {};

  if (
    properties.country &&
    properties.country !== "NLD"
  ) {
    return null;
  }

  const operator =
    properties.operator_name?.trim() ||
    properties.owner_name?.trim() ||
    properties.suboperator_name?.trim() ||
    "Schnelllader";

  // Tesla wird bereits über SuperchargeCompass geliefert.
  if (isTeslaOperator(operator)) {
    return null;
  }

  const qualifying =
    properties.availabilities?.filter((availability) => {
      const powerType =
        availability.power_type?.toUpperCase() ?? "";

      const connectorType =
        availability.connector_type?.toUpperCase() ?? "";

      const powerW = availability.power_max;

      return (
        powerType.startsWith("DC") &&
        connectorType === "IEC_62196_T2_COMBO" &&
        typeof powerW === "number" &&
        Number.isFinite(powerW) &&
        powerW >= minimumPowerKw * 1000
      );
    }) ?? [];

  if (qualifying.length === 0) {
    return null;
  }

  const powerKw =
    Math.max(
      ...qualifying.map(
        (availability) => availability.power_max ?? 0,
      ),
    ) / 1000;

  const stallCount = qualifying.reduce(
    (sum, availability) =>
      sum +
      (typeof availability.total === "number"
        ? availability.total
        : 0),
    0,
  );

  const address = properties.address?.trim() ?? "";

  const id =
    feature.id ??
    `${lat.toFixed(6)}-${lon.toFixed(6)}`;

  return {
    id: `ndw-${id}`,
    name:
      address !== ""
        ? `${operator} – ${address}`
        : operator,
    lat,
    lon,
    network: networkFromOperator(operator),
    powerKw,
    stalls: stallCount > 0 ? stallCount : null,
    openToAllEvs: true,
    pricePerKwhEur: null,
    priceSource: null,
    priceUpdatedAt: null,
    source: "ndw-dot-nl",
  };
}

export class NetherlandsNdwProvider
  implements ChargingSiteProvider
{
  readonly id = "netherlands-ndw";

  async findAlongRoute(
    geometry: [number, number][],
    options: ChargingSearchOptions = {},
  ): Promise<ChargingSite[]> {
    if (geometry.length < 2) {
      return [];
    }

    const corridorKm = options.corridorKm ?? 15;
    const minimumPowerKw = options.minPowerKw ?? 150;

    const routeBox = routeBoundingBox(
      geometry,
      corridorKm,
    );

    if (!routeBox) {
      return [];
    }

    const boxes = splitForInitialArea(routeBox);

    const allFeatures: NdwFeature[] = [];

    // Bewusst sequenziell: NDW begrenzt die Abfragerate.
    for (const box of boxes) {
      const features = await fetchBoundingBox(box);
      allFeatures.push(...features);
    }

    const uniqueFeatures = new Map<string, NdwFeature>();

    for (const feature of allFeatures) {
      const coordinates = feature.geometry?.coordinates;

      const key =
        feature.id ??
        (coordinates
          ? `${coordinates[0]}:${coordinates[1]}`
          : "");

      if (key !== "") {
        uniqueFeatures.set(key, feature);
      }
    }

    const sites: ChargingSite[] = [];

    for (const feature of uniqueFeatures.values()) {
      const site = featureToChargingSite(
        feature,
        minimumPowerKw,
      );

      if (!site) {
        continue;
      }

      if (
        distanceToRouteKm(site, geometry) >
        corridorKm
      ) {
        continue;
      }

      sites.push(site);
    }

    return sites;
  }
}

export function getNetherlandsNdwProvider():
  NetherlandsNdwProvider {
  return new NetherlandsNdwProvider();
}
