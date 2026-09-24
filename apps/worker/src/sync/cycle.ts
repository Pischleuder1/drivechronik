import type { Db } from "@drivechronik/db";
import type { VehicleDataSource } from "../dataSource/vehicleDataSource.js";
import { syncVehicles } from "./vehicles.js";
import { syncVehicleStatus } from "./vehicleStatus.js";
import { syncVehicleMetrics } from "./vehicleMetrics.js";
import { syncVehicleStatePeriods } from "./vehicleStatePeriods.js";
import { syncGeofenceImport } from "./geofences.js";
import { syncDrives } from "./drives.js";
import { syncRoutePoints } from "./routePoints.js";
import { syncCharges } from "./charges.js";
import { syncChargePoints } from "./chargePoints.js";
import { syncParks } from "./parks.js";
import { syncSoftwareUpdates } from "./softwareUpdates.js";
import { loadMatchablePlaces } from "./places.js";
import { syncElevations } from "./elevation.js";
import { syncDriveWeather } from "./driveWeather.js";
import { applyClassificationRules } from "./classifyRules.js";
import { applyAutoChargeCosts } from "./chargeCosts.js";

// Opt-out für die Open-Meteo Elevation-Anreicherung (z.B. offline-Setups).
const ELEVATION_ENABLED = process.env.ELEVATION_ENABLED !== "false";
// Für Verifikation lokal hochsetzbar; im Normalbetrieb bleibt der Default
// (polite, siehe elevation.ts) unangetastet.
const ELEVATION_MAX_POINTS_PER_CYCLE = process.env.ELEVATION_MAX_POINTS_PER_CYCLE
  ? Number(process.env.ELEVATION_MAX_POINTS_PER_CYCLE)
  : undefined;

/** Ein kompletter Sync-Zyklus — genutzt vom Loop (index.ts) und der CLI. */
export async function runSyncCycle(
  db: Db,
  dataSource: VehicleDataSource,
): Promise<void> {
  const vehicleMap = await syncVehicles(db, dataSource);
  await syncVehicleStatus(db, dataSource, vehicleMap);
  const vehicleMetricsResult = await syncVehicleMetrics(db, dataSource, vehicleMap);
  const vehicleStatePeriodsResult =
    await syncVehicleStatePeriods(
      db,
      dataSource,
      vehicleMap,
    );
  const geofenceResult = await syncGeofenceImport(db, dataSource);
  const matchablePlaces = await loadMatchablePlaces(db);
  const driveResult = await syncDrives(db, dataSource, vehicleMap, matchablePlaces);
  const routePointsResult = await syncRoutePoints(db, dataSource, driveResult.upsertedRefs);
  const chargeResult = await syncCharges(db, dataSource, vehicleMap, matchablePlaces);
  const chargePointsResult = await syncChargePoints(db, dataSource, chargeResult.upsertedRefs);
  const parkResult = await syncParks(db, matchablePlaces);
  const rulesResult = await applyClassificationRules(db);
  const chargeCostsResult = await applyAutoChargeCosts(db);
  const softwareUpdatesResult = await syncSoftwareUpdates(db, dataSource, vehicleMap);
  const elevationResult = ELEVATION_ENABLED
    ? await syncElevations(db, ELEVATION_MAX_POINTS_PER_CYCLE)
    : { pointsFilled: 0 };
  const driveWeatherResult = await syncDriveWeather(db);

  console.log(
    `[drivechronik-worker] sync ok: ${vehicleMap.size} vehicle(s), ` +
      `${vehicleMetricsResult.inserted} vehicle metric(s), ` +
      `${vehicleStatePeriodsResult.upserted} vehicle state period(s), ` +
      `${driveResult.upserted} drive(s) upserted` +
      (driveResult.deletedZombies > 0
        ? `, ${driveResult.deletedZombies} zombie(s) entfernt`
        : "") +
      `, ${routePointsResult.pointsInserted} route point(s) (${routePointsResult.drivesProcessed} drive(s))` +
      `, ${chargeResult.upserted} charge session(s)` +
      (chargePointsResult.pointsInserted > 0
        ? `, ${chargePointsResult.pointsInserted} charge point(s) (${chargePointsResult.sessionsProcessed} session(s))`
        : "") +
      `, ${parkResult.upserted} park session(s) upserted` +
      (parkResult.deleted > 0 ? `, ${parkResult.deleted} verwaiste(n) Park(s) entfernt` : "") +
      (geofenceResult.imported > 0 ? `, ${geofenceResult.imported} Geofence(s) importiert` : "") +
      (softwareUpdatesResult.upserted > 0
        ? `, ${softwareUpdatesResult.upserted} software update(s) upserted`
        : "") +
      (elevationResult.pointsFilled > 0
        ? `, ${elevationResult.pointsFilled} elevation(s) befüllt`
        : "") +
      (driveWeatherResult.drivesFilled > 0
        ? `, ${driveWeatherResult.drivesFilled} drive weather(s) befüllt`
        : "") +
      (rulesResult.applied > 0
        ? `, ${rulesResult.applied} drive(s) per Regel klassifiziert`
        : "") +
      (chargeCostsResult.updated > 0
        ? `, ${chargeCostsResult.updated} Ladekosten automatisch gesetzt`
        : ""),
  );
}
