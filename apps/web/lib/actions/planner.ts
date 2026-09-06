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
import { mergeRouteWaypoints } from "../charging/routeWaypoints";
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
  waypoints: z.array(
    z.object({
      lat: z.number().gte(-90).lte(90),
      lon: z.number().gte(-180).lte(180),
    }),
  ).max(10).optional(),
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
    ferrySegments: Array<{
      name: string;
      distanceKm: number;
      durationSeconds: number;
    }>;
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
  ferrySegments: Array<{
    name: string;
    distanceM: number;
    durationS: number;
  }>;
  /** Abschnitte ohne Fahrenergieverbrauch, gemessen entlang der Gesamtroute. */
  nonDrivingSegmentsM: Array<{
    startM: number;
    endM: number;
  }>;
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
    waypoints = [],
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
    waypoints,
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

  const ferryRouteResult =
    waypoints.length === 0
      ? await fetchOsrmRoute(
          startLat,
          startLon,
          destLat,
          destLon,
          osrmBaseUrl,
          t,
          ferryViaPoints,
        )
      : null;

  const routeOptions = routeResult.routes.map((candidate, index) => ({
    id: index === 0 ? "fastest" : "alternative-" + index,
    label: index === 0 ? "Schnellste Route" : "Alternative Route " + index,
    distanceKm: candidate.distanceM / 1000,
    durationSeconds: candidate.durationS,
    drivingDistanceKm: candidate.drivingDistanceM / 1000,
    hasFerry: candidate.hasFerry,
    ferryDistanceKm: candidate.ferryDistanceM / 1000,
    ferryDurationSeconds: candidate.ferryDurationS,
    ferrySegments: candidate.ferrySegments.map((segment) => ({
      name: segment.name,
      distanceKm: segment.distanceM / 1000,
      durationSeconds: segment.durationS,
    })),
    geometry: downsample(
      candidate.coordinates,
      Math.min(400, candidate.coordinates.length),
    ).map(([lon, lat]) => [lat, lon] as [number, number]),
  }));

  if (ferryRouteResult?.ok) {
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
        ferrySegments: ferryRoute.ferrySegments.map((segment) => ({
          name: segment.name,
          distanceKm: segment.distanceM / 1000,
          durationSeconds: segment.durationS,
        })),
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

    if (ferryOptionExists && ferryRouteResult?.ok) {
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

  // Karten-Geometrie ausdünnen und auf [lat, lon] drehen.
  const geometry: [number, number][] = downsample(
    selectedRoute.coordinates,
    Math.min(MAP_MAX_POINTS, selectedRoute.coordinates.length),
  ).map(([lon, lat]) => [lat, lon]);

  // Ladeplanung und tatsächliche Route aufeinander abstimmen.
  //
  // Ablauf:
  // 1. Schnelllader entlang der ursprünglichen Referenzroute suchen.
  // 2. Sinnvolle Ladestopps bestimmen.
  // 3. Falls diese Stopps noch nicht Bestandteil der Route sind, OSRM erneut
  //    über die manuellen Zwischenziele und die Ladestopps routen.
  // 4. Verbrauch und Ladeplanung auf der tatsächlich gerouteten Strecke
  //    erneut berechnen, ohne den Suchkorridor für Ladeorte zu verschieben.
  //
  // Die Schleife ist bewusst begrenzt, damit externe Routing-Daten niemals
  // zu einer Endlosschleife führen können.
  let finalRoute = selectedRoute;
  let finalDistanceKm = distanceKm;
  let finalDurationSeconds = selectedRoute.durationS;
  let finalDrivingDistanceKm = drivingDistanceKm;
  let finalDrivingDurationSeconds = drivingDurationSeconds;
  let finalAvgSpeedKmh = avgSpeedKmh;
  let finalAscentM = ascentM;
  let finalDescentM = descentM;
  let finalElevationOk = elevationOk;
  let finalPrediction = prediction;
  let routedGeometry = geometry;

  // Ladeorte immer entlang der ursprünglichen Route suchen.
  // Die durch Ladestopps neu geroutete Strecke darf nicht selbst
  // wieder neue Ladeorte in die Suche hineinziehen.
  const chargingSearchGeometry = geometry;

  let chargingSites = await findChargingSitesAlongRoute(
    chargingSearchGeometry,
    {
      corridorKm: 15,
      minPowerKw: 150,
    },
  );

  let finalChargingSelection = selectChargingStop(
    chargingSites,
    routedGeometry,
    {
      startSoc,
      capacityKwh,
      routeDistanceKm: finalDistanceKm,
      energyKwh: finalPrediction.energyKwh,
      nonDrivingSegmentsKm: finalRoute.nonDrivingSegmentsM.map(
        (segment) => ({
          startKm: segment.startM / 1000,
          endKm: segment.endM / 1000,
        }),
      ),
      targetArrivalSoc: 20,
      minimumStopArrivalSoc: 10,
    },
  );

  let routedChargingStopIds: string[] = [];

  const sameStopIds = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const selectedChargingStopIds =
      finalChargingSelection.stops.map((stop) => stop.site.id);

    // Die aktuelle Route enthält bereits genau die aktuell empfohlenen
    // Ladestopps. Damit sind Route und Ladeplanung stabil.
    if (sameStopIds(selectedChargingStopIds, routedChargingStopIds)) {
      break;
    }

    if (finalChargingSelection.stops.length === 0) {
      break;
    }

    const chargingRouteWaypoints = mergeRouteWaypoints(
      waypoints,
      finalChargingSelection.stops.map((stop) => ({
        lat: stop.site.lat,
        lon: stop.site.lon,
        routeDistanceKm: stop.routeDistanceKm,
      })),
      routedGeometry,
    );

    const chargingRouteResult = await fetchOsrmRoute(
      startLat,
      startLon,
      destLat,
      destLon,
      osrmBaseUrl,
      t,
      chargingRouteWaypoints,
    );

    if (!chargingRouteResult.ok || !chargingRouteResult.routes[0]) {
      break;
    }

    finalRoute = chargingRouteResult.routes[0];
    routedChargingStopIds = selectedChargingStopIds;

    finalDistanceKm = finalRoute.distanceM / 1000;
    finalDurationSeconds = finalRoute.durationS;

    finalDrivingDistanceKm = finalRoute.drivingDistanceM / 1000;
    finalDrivingDurationSeconds = finalRoute.drivingDurationS;

    finalAvgSpeedKmh =
      finalDrivingDurationSeconds > 0
        ? finalDrivingDistanceKm / (finalDrivingDurationSeconds / 3600)
        : 0;

    const finalElevationSample = downsample(
      finalRoute.coordinates,
      Math.min(ELEVATION_MAX_POINTS, finalRoute.coordinates.length),
    );

    const finalElevations = await fetchElevations(finalElevationSample);
    finalElevationOk = finalElevations != null;

    const finalElevationSummary = finalElevations
      ? summarizeElevation(finalElevations)
      : { ascentM: 0, descentM: 0 };

    finalAscentM = finalElevationSummary.ascentM;
    finalDescentM = finalElevationSummary.descentM;

    finalPrediction = predictConsumption({
      distanceKm: finalDrivingDistanceKm,
      avgSpeedKmh: finalAvgSpeedKmh,
      tempC,
      ascentM: finalAscentM,
      descentM: finalDescentM,
      baseWhPerKm: base.baseWhPerKm,
      referenceSpeedKmh: base.referenceSpeedKmh,
    });

    routedGeometry = downsample(
      finalRoute.coordinates,
      Math.min(MAP_MAX_POINTS, finalRoute.coordinates.length),
    ).map(([lon, lat]) => [lat, lon]);

    // Verbrauch und SoC werden auf der tatsächlich gerouteten Strecke
    // neu berechnet. Neue Ladeorte werden dagegen weiterhin nur entlang
    // der ursprünglichen Referenzroute gesucht.
    chargingSites = await findChargingSitesAlongRoute(
      chargingSearchGeometry,
      {
        corridorKm: 15,
        minPowerKw: 150,
      },
    );

    finalChargingSelection = selectChargingStop(
      chargingSites,
      routedGeometry,
      {
        startSoc,
        capacityKwh,
        routeDistanceKm: finalDistanceKm,
        energyKwh: finalPrediction.energyKwh,
        nonDrivingSegmentsKm: finalRoute.nonDrivingSegmentsM.map(
          (segment) => ({
            startKm: segment.startM / 1000,
            endKm: segment.endM / 1000,
          }),
        ),
        targetArrivalSoc: 20,
        minimumStopArrivalSoc: 10,
      },
    );
  }

  const finalArrivalSoc =
    startSoc -
    (finalPrediction.energyKwh / capacityKwh) * 100;

  const finalRecommendedStop = finalChargingSelection.stop;
  const finalRecommendedStops = finalChargingSelection.stops;

  return {
    ok: true,
    plan: {
      distanceKm: finalDistanceKm,
      durationSeconds: finalDurationSeconds,
      avgSpeedKmh: finalAvgSpeedKmh,
      energyKwh: finalPrediction.energyKwh,
      whPerKm: finalPrediction.whPerKm,
      breakdown: finalPrediction.breakdown,
      ascentM: finalAscentM,
      descentM: finalDescentM,
      elevationOk: finalElevationOk,
      baseWhPerKm: base.baseWhPerKm,
      baseSource: base.source,
      referenceSpeedKmh: base.referenceSpeedKmh,
      tempBinCenterC: base.tempBinCenterC,
      historyDriveCount: base.historyDriveCount,
      tempC,
      startSoc,
      capacityKwh,
      arrivalSoc: finalArrivalSoc,
      plannedArrivalSoc: finalChargingSelection.plannedArrivalSoc,
      osrmIsDefault,
      geometry: routedGeometry,
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
      recommendedChargingStop: finalRecommendedStop
        ? {
            id: finalRecommendedStop.site.id,
            name: finalRecommendedStop.site.name,
            lat: finalRecommendedStop.site.lat,
            lon: finalRecommendedStop.site.lon,
            stalls: finalRecommendedStop.site.stalls,
            routeDistanceKm: finalRecommendedStop.routeDistanceKm,
            arrivalSoc: finalRecommendedStop.arrivalSoc,
            departureSoc: finalRecommendedStop.departureSoc,
            energyAddedKwh: finalRecommendedStop.energyAddedKwh,
            chargingMinutes: finalRecommendedStop.chargingMinutes,
          }
        : null,
        recommendedChargingStops: finalRecommendedStops.map((stop) => ({
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
        chargingPlanComplete: finalChargingSelection.planningComplete,
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
        name?: string;
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

    const ferrySegments: Array<{
      name: string;
      distanceM: number;
      durationS: number;
    }> = [];

    let routeProgressM = 0;
    let previousStepWasFerry = false;

    const nonDrivingSegmentsM: Array<{
      startM: number;
      endM: number;
    }> = [];

    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const stepDistanceM =
          typeof step.distance === "number" ? step.distance : 0;

        if (step.mode === "ferry") {
          ferryDistanceM += stepDistanceM;

          const stepDurationS =
            typeof step.duration === "number" ? step.duration : 0;

          ferryDurationS += stepDurationS;

          const ferryName = step.name?.trim() || "Fährpassage";
          const previousFerry = ferrySegments[ferrySegments.length - 1];

          if (
            previousStepWasFerry &&
            previousFerry &&
            previousFerry.name === ferryName
          ) {
            previousFerry.distanceM += stepDistanceM;
            previousFerry.durationS += stepDurationS;
          } else {
            ferrySegments.push({
              name: ferryName,
              distanceM: stepDistanceM,
              durationS: stepDurationS,
            });
          }

          nonDrivingSegmentsM.push({
            startM: routeProgressM,
            endM: routeProgressM + stepDistanceM,
          });
        }

        previousStepWasFerry = step.mode === "ferry";
        routeProgressM += stepDistanceM;
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
      ferrySegments,
      nonDrivingSegmentsM,
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
