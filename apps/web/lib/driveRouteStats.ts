import { haversineDistanceM } from "@drivechronik/core";

export interface RouteStatsPoint {
  lat: number;
  lon: number;
  ts: Date;
  speedKmh: number | null;
  soc: number | null;
}

export interface RouteStats {
  gpsDistanceKm: number | null;
  recordingDurationSeconds: number | null;
  avgIntervalSeconds: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  startSoc: number | null;
  endSoc: number | null;
}

export function computeRouteStats(points: RouteStatsPoint[]): RouteStats {
  let startSoc: number | null = null;
  let endSoc: number | null = null;

  for (const point of points) {
    if (point.soc != null) {
      startSoc = point.soc;
      break;
    }
  }

  for (let i = points.length - 1; i >= 0; i--) {
    const soc = points[i]?.soc;
    if (soc != null) {
      endSoc = soc;
      break;
    }
  }

  const speeds = points
    .map((point) => point.speedKmh)
    .filter((speed): speed is number => speed != null);

  const maxSpeedKmh = speeds.length > 0 ? Math.max(...speeds) : null;

  if (points.length < 2) {
    return {
      gpsDistanceKm: null,
      recordingDurationSeconds: null,
      avgIntervalSeconds: null,
      avgSpeedKmh: null,
      maxSpeedKmh,
      startSoc,
      endSoc,
    };
  }

  let distanceM = 0;

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    const current = points[i]!;

    distanceM += haversineDistanceM(
      previous.lat,
      previous.lon,
      current.lat,
      current.lon,
    );
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;

  const recordingDurationSeconds = Math.max(
    0,
    (last.ts.getTime() - first.ts.getTime()) / 1000,
  );

  const gpsDistanceKm = distanceM / 1000;

  const avgIntervalSeconds =
    recordingDurationSeconds > 0
      ? recordingDurationSeconds / (points.length - 1)
      : null;

  const avgSpeedKmh =
    recordingDurationSeconds > 0
      ? gpsDistanceKm / (recordingDurationSeconds / 3600)
      : null;

  return {
    gpsDistanceKm,
    recordingDurationSeconds,
    avgIntervalSeconds,
    avgSpeedKmh,
    maxSpeedKmh,
    startSoc,
    endSoc,
  };
}
