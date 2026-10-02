import "server-only";

import { getOsrmUrl } from "../config";
import { findAutobahnEventsAlongRoute } from "./autobahn";
import { extractMotorwayRefsFromOsrmBody } from "./recordedDriveTrafficCore";
import type { TrafficEvent } from "./types";

const OSRM_DEFAULT_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 7_000;

/**
 * Für die OSRM-Straßenerkennung reichen einige repräsentative Punkte des
 * aufgezeichneten Tracks. So vermeiden wir sehr lange URLs bei Fahrten mit
 * hunderten oder tausenden GPS-Punkten.
 */
const MAX_OSRM_TRACK_POINTS = 20;

export interface RecordedDriveTraffic {
  motorwayRefs: string[];
  events: TrafficEvent[];
}

type RecordedTrackPoint = readonly [number, number];

function sampleTrack(
  points: RecordedTrackPoint[],
  maxPoints = MAX_OSRM_TRACK_POINTS,
): RecordedTrackPoint[] {
  if (points.length <= maxPoints) return points;

  const indexes = new Set<number>();

  for (let i = 0; i < maxPoints; i += 1) {
    const fraction = i / (maxPoints - 1);
    indexes.add(
      Math.round(fraction * (points.length - 1)),
    );
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => points[index]!)
    .filter(Boolean);
}

/**
 * Ermittelt mit OSRM, welche deutschen Autobahnen der aufgezeichnete Track
 * benutzt hat.
 *
 * Fail-open: Ein Ausfall des externen Routingdienstes darf die Fahrtdetailseite
 * nicht blockieren.
 */
async function detectMotorwayRefs(
  points: RecordedTrackPoint[],
): Promise<string[]> {
  if (points.length < 2) return [];

  const sampled = sampleTrack(points);

  const coordinates = sampled
    .map(([lat, lon]) => `${lon},${lat}`)
    .join(";");

  const configuredOsrmUrl = getOsrmUrl();
  const base = (configuredOsrmUrl ?? OSRM_DEFAULT_URL).replace(/\/+$/, "");

  const url = new URL(
    `${base}/route/v1/driving/${coordinates}`,
  );

  url.searchParams.set("overview", "false");
  url.searchParams.set("steps", "true");
  url.searchParams.set("alternatives", "false");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const body = (await response.json()) as unknown;

    return extractMotorwayRefsFromOsrmBody(body);
  } catch {
    return [];
  }
}

/**
 * Aktuelle Verkehrslage entlang einer bereits aufgezeichneten Fahrt.
 *
 * OSRM dient ausschließlich der Erkennung der verwendeten Autobahnen.
 * Die Positionierung der Verkehrsmeldungen erfolgt anschließend gegen den
 * ORIGINALEN gespeicherten GPS-Track.
 *
 * Die zurückgegebenen Ereignisse sind aktuelle Meldungen und ausdrücklich
 * keine historischen Ereignisse zum damaligen Fahrtzeitpunkt.
 */
export async function getRecordedDriveTraffic(
  points: RecordedTrackPoint[],
): Promise<RecordedDriveTraffic> {
  if (points.length < 2) {
    return {
      motorwayRefs: [],
      events: [],
    };
  }

  const motorwayRefs = await detectMotorwayRefs(points);

  if (motorwayRefs.length === 0) {
    return {
      motorwayRefs,
      events: [],
    };
  }

  // Traffic-Matcher erwartet GeoJSON-Reihenfolge [lon, lat].
  const route: [number, number][] = points.map(
    ([lat, lon]) => [lon, lat],
  );

  const events = await findAutobahnEventsAlongRoute(
    motorwayRefs,
    route,
    {
      corridorKm: 1.5,
      includeFuture: false,
    },
  );

  return {
    motorwayRefs,
    events,
  };
}
