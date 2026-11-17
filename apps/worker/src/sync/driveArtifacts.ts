import type { SourceDrive } from "../dataSource/vehicleDataSource.js";

const MAX_ARTIFACT_DISTANCE_KM = 0.1;
const MAX_ARTIFACT_DURATION_SECONDS = 30;
const MAX_GPS_MOVEMENT_METERS = 5;

export interface StationaryDriveArtifactCandidate {
  startTime: Date;
  endTime: Date | null;
  distanceKm: number | null;
  speedMaxKmh: number | null;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function gpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusM = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

export function isStationaryDriveArtifactCandidate(
  drive: StationaryDriveArtifactCandidate,
): boolean {
  if (drive.endTime == null) return false;

  const durationSeconds =
    (drive.endTime.getTime() - drive.startTime.getTime()) / 1000;

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0 ||
    durationSeconds >= MAX_ARTIFACT_DURATION_SECONDS
  ) {
    return false;
  }

  if (
    drive.distanceKm == null ||
    !Number.isFinite(drive.distanceKm) ||
    Math.abs(drive.distanceKm) >= MAX_ARTIFACT_DISTANCE_KM
  ) {
    return false;
  }

  if (drive.speedMaxKmh == null || drive.speedMaxKmh > 0) {
    return false;
  }

  if (
    drive.startLat == null ||
    drive.startLon == null ||
    drive.endLat == null ||
    drive.endLon == null
  ) {
    return false;
  }

  return (
    gpsDistanceMeters(
      drive.startLat,
      drive.startLon,
      drive.endLat,
      drive.endLon,
    ) <= MAX_GPS_MOVEMENT_METERS
  );
}

export function isStationaryDriveArtifact(drive: SourceDrive): boolean {
  const odometerDelta =
    drive.start_km != null && drive.end_km != null
      ? drive.end_km - drive.start_km
      : null;

  return isStationaryDriveArtifactCandidate({
    startTime: drive.start_time,
    endTime: drive.end_time,
    distanceKm: drive.distance ?? odometerDelta,
    speedMaxKmh: drive.speed_max,
    startLat: drive.start_lat,
    startLon: drive.start_lon,
    endLat: drive.end_lat,
    endLon: drive.end_lon,
  });
}
