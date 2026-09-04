"use server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import {
  downsample,
  predictConsumption,
  summarizeElevation,
  type ConsumptionBreakdown,
} from "@drivechronik/core";
import { validateSession } from "../auth/session";
import { getOsrmUrl } from "../config";
import { findChargingSitesAlongRoute } from "../charging/providers";
import { selectChargingStop } from "../charging/planner";
import {
  resolveBaseConsumption,
  type BaseConsumptionSource,
} from "../planner";

/**
 * Server Action des Routenplaner-MVP („Reichweiten-Check"). Orchestriert
 * server-seitig (nie im Browser): OSRM-Routing → Höhenprofil via Open-Meteo →
 * reines Verbrauchsmodell (@drivechronik/core) → Ankunfts-SoC. Alle externen
 * Aufrufe mit Timeout und Failure-soft-Verhalten; das Höhenprofil ist optional
 * (fällt es aus, rechnet das Modell ohne Höhenterm und die UI weist es aus).
 */

// Basis-URL des OSRM-Routing-Servers. Default ist der öffentliche Demo-Server;
// eine eigene Instanz wird über OSRM_URL gesetzt (in der UI klein ausgewiesen).
const OSRM_DEFAULT_URL = "https://router.project-osrm.org";

const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";

// Timeouts: der Demo-OSRM kann träge sein, Open-Meteo ist meist flott.
const OSRM_TIMEOUT_MS = 15000;
const ELEVATION_TIMEOUT_MS = 10000;

// Open-Meteo erlaubt bis zu 100 Koordinaten je Elevation-Request → Route auf
// höchstens so viele Stützpunkte downsampeln (ein Batch-Request).
const ELEVATION_MAX_POINTS = 100;
// Karten-Polyline: server-seitig ausdünnen, damit der Client-Payload/DOM leicht
// bleibt (lange Routen haben leicht mehrere tausend OSRM-Koordinaten).
const MAP_MAX_POINTS = 400;

const planRouteInputSchema = z.object({
  vehicleId: z.number().int().positive(),
  startLat: z.number().gte(-90).lte(90),
  startLon: z.number().gte(-180).lte(180),
  destLat: z.number().gte(-90).lte(90),
  destLon: z.number().gte(-180).lte(180),
  startSoc: z.number().min(0).max(100),
  tempC: z.number().min(-40).max(55),
  capacityKwh: z.number().min(5).max(250),
  routeOptionId: z.string().min(1).optional(),
});

export type PlanRouteInput = z.infer<typeof planRouteInputSchema>;

export interface PlanResult {
  distanceKm: number;
  durationSeconds: number;
  avgSpeedKmh: number;

  energyKwh: number;
  whPerKm: number;
  breakdown: ConsumptionBreakdown;

  ascentM: number;
  descentM: number;
  /** Ob das Höhenprofil geladen werden konnte (sonst ohne Höhenterm gerechnet). */
  elevationOk: boolean;

  baseWhPerKm: number;
  baseSource: BaseConsumptionSource;
  referenceSpeedKmh: number;
  tempBinCenterC: number | null;
  historyDriveCount: number;

  tempC: number;
  startSoc: number;
  capacityKwh: number;
  /** Ankunfts-SoC in % (kann < 0 sein → Reichweite reicht nicht). */
  arrivalSoc: number;
  plannedArrivalSoc: number | null;

  /** true = öffentlicher OSRM-Demo-Server, false = eigener via OSRM_URL. */
  osrmIsDefault: boolean;
  /** [lat, lon]-Tupel für die Karten-Polyline (ausgedünnt). */
  geometry: [number, number][];

  /** Vom Routing angebotene Varianten. Noch ohne eigene Ladeplanung. */
  routeOptions: Array<{
    id: string;
    label: string;
    distanceKm: number;
    durationSeconds: number;
    drivingDistanceKm: number;
    hasFerry: boolean;
    ferryDistanceKm: number;
    ferryDurationSeconds: number;
    geometry: [number, number][];
  }>;

  /** Anzahl gefundener Schnellladeorte im Suchkorridor. */
  chargingSiteCount: number;

  /** Gefundene Tesla-Supercharger im Suchkorridor. */
  chargingSites: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    stalls: number | null;
  }>;

  recommendedChargingStop: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    stalls: number | null;
    routeDistanceKm: number;
    arrivalSoc: number;
    departureSoc: number;
    energyAddedKwh: number;
    chargingMinutes: number;
  } | null;

  recommendedChargingStops: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    stalls: number | null;
    routeDistanceKm: number;
    arrivalSoc: number;
    departureSoc: number;
    energyAddedKwh: number;
    chargingMinutes: number;
  }>;

  chargingPlanComplete: boolean;
}

export type PlanRouteResponse =
  | { ok: true; plan: PlanResult }
  | { ok: false; error: string };

interface OsrmRoute {
  /** Gesamtdistanz der Route inklusive möglicher Fährpassagen. */
  distanceM: number;
  /** Gesamtreisezeit inklusive möglicher Fährpassagen. */
  durationS: number;
  /** Tatsächlich mit dem Fahrzeug zurückgelegte Distanz. */
  drivingDistanceM: number;
  /** Tatsächliche Fahrzeit ohne Fährpassagen. */
  drivingDurationS: number;
  ferryDistanceM: number;
  ferryDurationS: number;
  hasFerry: boolean;
  /** OSRM liefert [lon, lat] — hier bereits so belassen. */
  coordinates: [number, number][];
}

/**
 * Plant eine Route und prognostiziert Verbrauch + Ankunfts-SoC. Reihenfolge:
 * OSRM-Route holen → Höhenprofil batchen → Basisverbrauch aus Historie →
 * core-Modell → SoC-Rechnung.
 */
export async function planRoute(
  input: PlanRouteInput,
): Promise<PlanRouteResponse> {
  const t = await getTranslations("planner");
  const user = await validateSession();
  if (!user) return { ok: false, error: t("errors.notAuthenticated") };

  const parsed = planRouteInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? t("errors.invalidInput"),
    };
  }
  const {
    vehicleId,
    startLat,
    startLon,
    destLat,
    destLon,
    startSoc,
    tempC,
    capacityKwh,
    routeOptionId,
  } = parsed.data;

  // 1) Routing (OSRM) — server-seitig, mit Timeout und freundlicher Fehlermeldung.
  const configuredOsrmUrl = getOsrmUrl();
  const osrmBaseUrl = configuredOsrmUrl ?? OSRM_DEFAULT_URL;
  const osrmIsDefault = configuredOsrmUrl == null;

  const routeResult = await fetchOsrmRoute(
    startLat,
    startLon,
    destLat,
    destLon,
    osrmBaseUrl,
    t,
  );
  if (!routeResult.ok) return { ok: false, error: routeResult.error };
  const route = routeResult.routes[0];

  const distanceSquared = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const dLat = lat1 - lat2;
    const dLon = lon1 - lon2;
    return dLat * dLat + dLon * dLon;
  };

  const startCloserToPuttgarden =
    distanceSquared(
      startLat,
      startLon,
      PUTTGARDEN_RODBY_FERRY.puttgarden.lat,
      PUTTGARDEN_RODBY_FERRY.puttgarden.lon,
    ) <=
    distanceSquared(
      startLat,
      startLon,
      PUTTGARDEN_RODBY_FERRY.rodby.lat,
      PUTTGARDEN_RODBY_FERRY.rodby.lon,
    );

  const ferryViaPoints = startCloserToPuttgarden
    ? [
        PUTTGARDEN_RODBY_FERRY.puttgarden,
        PUTTGARDEN_RODBY_FERRY.rodby,
      ]
    : [
        PUTTGARDEN_RODBY_FERRY.rodby,
        PUTTGARDEN_RODBY_FERRY.puttgarden,
      ];

  const ferryRouteResult = await fetchOsrmRoute(
    startLat,
    startLon,
    destLat,
    destLon,
    osrmBaseUrl,
    t,
    ferryViaPoints,
  );

  const routeOptions = routeResult.routes.map((candidate, index) => ({
    id: index === 0 ? "fastest" : "alternative-" + index,
    label: index === 0 ? "Schnellste Route" : "Alternative Route " + index,
    distanceKm: candidate.distanceM / 1000,
    durationSeconds: candidate.durationS,
    drivingDistanceKm: candidate.drivingDistanceM / 1000,
    hasFerry: candidate.hasFerry,
    ferryDistanceKm: candidate.ferryDistanceM / 1000,
    ferryDurationSeconds: candidate.ferryDurationS,
    geometry: downsample(
      candidate.coordinates,
      Math.min(400, candidate.coordinates.length),
    ).map(([lon, lat]) => [lat, lon] as [number, number]),
  }));

  if (ferryRouteResult.ok) {
    const ferryRoute = ferryRouteResult.routes.find(
      (candidate) => candidate.hasFerry,
    );

    const ferryIsReasonable =
      ferryRoute != null &&
      ferryRoute.durationS <= route.durationS + 90 * 60 &&
      ferryRoute.distanceM <= route.distanceM * 1.25;

    if (ferryRoute && ferryIsReasonable) {
      routeOptions.push({
        id: PUTTGARDEN_RODBY_FERRY.id,
        label: PUTTGARDEN_RODBY_FERRY.label,
        distanceKm: ferryRoute.distanceM / 1000,
        durationSeconds: ferryRoute.durationS,
        drivingDistanceKm: ferryRoute.drivingDistanceM / 1000,
        hasFerry: ferryRoute.hasFerry,
        ferryDistanceKm: ferryRoute.ferryDistanceM / 1000,
        ferryDurationSeconds: ferryRoute.ferryDurationS,
        geometry: downsample(
          ferryRoute.coordinates,
          Math.min(400, ferryRoute.coordinates.length),
        ).map(([lon, lat]) => [lat, lon] as [number, number]),
      });
    }
  }


  let selectedRoute = route;

  if (routeOptionId === PUTTGARDEN_RODBY_FERRY.id) {
    const ferryOptionExists = routeOptions.some(
      (option) => option.id === PUTTGARDEN_RODBY_FERRY.id,
    );

    if (ferryOptionExists && ferryRouteResult.ok) {
      const ferryRoute = ferryRouteResult.routes.find(
        (candidate) => candidate.hasFerry,
      );

      if (ferryRoute) selectedRoute = ferryRoute;
    }
  } else if (routeOptionId?.startsWith("alternative-")) {
    const alternativeIndex = Number(
      routeOptionId.slice("alternative-".length),
    );

    if (
      Number.isInteger(alternativeIndex) &&
      alternativeIndex > 0 &&
      routeResult.routes[alternativeIndex]
    ) {
      selectedRoute = routeResult.routes[alternativeIndex];
    }
  }

  const distanceKm = selectedRoute.distanceM / 1000;
  const durationSeconds = selectedRoute.durationS;

  const drivingDistanceKm = selectedRoute.drivingDistanceM / 1000;
  const drivingDurationSeconds = selectedRoute.drivingDurationS;

  const avgSpeedKmh =
    drivingDurationSeconds > 0
      ? drivingDistanceKm / (drivingDurationSeconds / 3600)
      : 0;

  // 2) Höhenprofil (Open-Meteo, ein Batch-Request) — optional/failure-soft.
  const elevationSample = downsample(
    selectedRoute.coordinates,
    Math.min(ELEVATION_MAX_POINTS, selectedRoute.coordinates.length),
  );
  const elevations = await fetchElevations(elevationSample);
  const elevationOk = elevations != null;
  const { ascentM, descentM } = elevationOk
    ? summarizeElevation(elevations)
    : { ascentM: 0, descentM: 0 };

  // 3) Persönlicher Basisverbrauch aus der Historie (Fallback-Kette in lib/planner).
  const base = await resolveBaseConsumption(vehicleId, tempC);

  // 4) Reines Verbrauchsmodell.
  const prediction = predictConsumption({
    distanceKm: drivingDistanceKm,
    avgSpeedKmh,
    tempC,
    ascentM,
    descentM,
    baseWhPerKm: base.baseWhPerKm,
    referenceSpeedKmh: base.referenceSpeedKmh,
  });

  // 5) Ankunfts-SoC.
  const arrivalSoc = startSoc - (prediction.energyKwh / capacityKwh) * 100;

  // Karten-Geometrie ausdünnen und auf [lat, lon] drehen.
  const geometry: [number, number][] = downsample(
    selectedRoute.coordinates,
    Math.min(MAP_MAX_POINTS, selectedRoute.coordinates.length),
  ).map(([lon, lat]) => [lat, lon]);

  const chargingSites = await findChargingSitesAlongRoute(
    geometry,
    {
      corridorKm: 15,
      minPowerKw: 150,
    },
  );

  const chargingSelection = selectChargingStop(
    chargingSites,
    geometry,
    {
      startSoc,
      capacityKwh,
      routeDistanceKm: distanceKm,
      energyKwh: prediction.energyKwh,
      targetArrivalSoc: 20,
      minimumStopArrivalSoc: 10,
    },
  );

  const recommendedStop = chargingSelection.stop;
  const recommendedStops = chargingSelection.stops;

  return {
    ok: true,
    plan: {
      distanceKm,
      durationSeconds,
      avgSpeedKmh,
      energyKwh: prediction.energyKwh,
      whPerKm: prediction.whPerKm,
      breakdown: prediction.breakdown,
      ascentM,
      descentM,
      elevationOk,
      baseWhPerKm: base.baseWhPerKm,
      baseSource: base.source,
      referenceSpeedKmh: base.referenceSpeedKmh,
      tempBinCenterC: base.tempBinCenterC,
      historyDriveCount: base.historyDriveCount,
      tempC,
      startSoc,
      capacityKwh,
      arrivalSoc,
      plannedArrivalSoc: chargingSelection.plannedArrivalSoc,
      osrmIsDefault,
      geometry,
      routeOptions,
      chargingSiteCount: chargingSites.length,
      chargingSites: chargingSites
        .filter((site) => site.network === "tesla")
        .map((site) => ({
          id: site.id,
          name: site.name,
          lat: site.lat,
          lon: site.lon,
          stalls: site.stalls,
        })),
      recommendedChargingStop: recommendedStop
        ? {
            id: recommendedStop.site.id,
            name: recommendedStop.site.name,
            lat: recommendedStop.site.lat,
            lon: recommendedStop.site.lon,
            stalls: recommendedStop.site.stalls,
            routeDistanceKm: recommendedStop.routeDistanceKm,
            arrivalSoc: recommendedStop.arrivalSoc,
            departureSoc: recommendedStop.departureSoc,
            energyAddedKwh: recommendedStop.energyAddedKwh,
            chargingMinutes: recommendedStop.chargingMinutes,
          }
        : null,
        recommendedChargingStops: recommendedStops.map((stop) => ({
          id: stop.site.id,
          name: stop.site.name,
          lat: stop.site.lat,
          lon: stop.site.lon,
          stalls: stop.site.stalls,
          routeDistanceKm: stop.routeDistanceKm,
          arrivalSoc: stop.arrivalSoc,
          departureSoc: stop.departureSoc,
          energyAddedKwh: stop.energyAddedKwh,
          chargingMinutes: stop.chargingMinutes,
        })),
        chargingPlanComplete: chargingSelection.planningComplete,
    },
  };
}

const PUTTGARDEN_RODBY_FERRY = {
  id: "ferry-puttgarden-rodby",
  label: "Via Fähre Puttgarden–Rødby",
  puttgarden: { lat: 54.49878, lon: 11.22362 },
  rodby: { lat: 54.654306, lon: 11.35399 },
} as const;

type OsrmResult =
  | { ok: true; routes: OsrmRoute[] }
  | { ok: false; error: string };

/** OSRM route API: profile driving, overview=full, geometries=geojson. */
async function fetchOsrmRoute(
  startLat: number,
  startLon: number,
  destLat: number,
  destLon: number,
  osrmBaseUrl: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
  viaPoints: Array<{ lat: number; lon: number }> = [],
): Promise<OsrmResult> {
  const base = osrmBaseUrl.replace(/\/+$/, "");
  const routePoints = [
    { lat: startLat, lon: startLon },
    ...viaPoints,
    { lat: destLat, lon: destLon },
  ];

  const coords = routePoints
    .map((point) => String(point.lon) + "," + String(point.lat))
    .join(";");

  const url = new URL(base + "/route/v1/driving/" + coords);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");
  url.searchParams.set("alternatives", "true");

  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      error: t("errors.routingUnreachable"),
    };
  }

  if (res.status === 429) {
    return {
      ok: false,
      error: t("errors.routingRateLimited"),
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: t("errors.routingHttpError", { status: res.status }),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: t("errors.routingBadResponse") };
  }

  const parsed = parseOsrmBody(body);
  if (!parsed) {
    return {
      ok: false,
      error: t("errors.routingNoRoute"),
    };
  }
  return { ok: true, routes: parsed };
}

interface OsrmResponseShape {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: unknown };
    legs?: Array<{
      steps?: Array<{
        mode?: string;
        distance?: number;
        duration?: number;
      }>;
    }>;
  }>;
}

/** Validiert die OSRM-Antwort und extrahiert alle gültigen Routen. */
function parseOsrmBody(body: unknown): OsrmRoute[] | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as OsrmResponseShape;
  if (b.code !== "Ok" || !Array.isArray(b.routes)) return null;

  const routes: OsrmRoute[] = [];

  for (const route of b.routes) {
    if (
      typeof route.distance !== "number" ||
      typeof route.duration !== "number" ||
      !Array.isArray(route.geometry?.coordinates)
    ) {
      continue;
    }

    const coordinates: [number, number][] = [];
    for (const c of route.geometry.coordinates as unknown[]) {
      if (
        Array.isArray(c) &&
        typeof c[0] === "number" &&
        typeof c[1] === "number"
      ) {
        coordinates.push([c[0], c[1]]); // [lon, lat]
      }
    }

    if (coordinates.length < 2) continue;

    let ferryDistanceM = 0;
    let ferryDurationS = 0;

    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        if (step.mode !== "ferry") continue;
        if (typeof step.distance === "number") ferryDistanceM += step.distance;
        if (typeof step.duration === "number") ferryDurationS += step.duration;
      }
    }

    const drivingDistanceM = Math.max(0, route.distance - ferryDistanceM);
    const drivingDurationS = Math.max(0, route.duration - ferryDurationS);

    routes.push({
      distanceM: route.distance,
      durationS: route.duration,
      drivingDistanceM,
      drivingDurationS,
      ferryDistanceM,
      ferryDurationS,
      hasFerry: ferryDistanceM > 0,
      coordinates,
    });
  }

  return routes.length > 0 ? routes : null;
}

/**
 * Ein Batch-Request an die Open-Meteo Elevation API für die ausgewählten
 * Stützpunkte ([lon, lat]-Tupel). Liefert die Höhen in Punkt-Reihenfolge oder
 * null bei Fehler (Aufrufer rechnet dann ohne Höhenterm). Höflichkeitsregeln
 * wie apps/worker/src/sync/elevation.ts (ein Request, kommaseparierte Koords).
 */
async function fetchElevations(
  points: [number, number][],
): Promise<number[] | null> {
  if (points.length === 0) return null;
  try {
    const url = new URL(OPEN_METEO_ELEVATION_URL);
    url.searchParams.set("latitude", points.map((p) => p[1]).join(","));
    url.searchParams.set("longitude", points.map((p) => p[0]).join(","));

    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(ELEVATION_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { elevation?: unknown };
    if (!Array.isArray(body.elevation)) return null;
    return body.elevation.map((e) => (typeof e === "number" ? e : NaN));
  } catch {
    return null;
  }
}
