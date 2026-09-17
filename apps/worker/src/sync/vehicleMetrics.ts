import { vehicleMetrics, type Db } from "@drivechronik/db";
import type { VehicleDataSource } from "../dataSource/vehicleDataSource.js";
import { getWatermark, recordSyncRun } from "./state.js";
import type { VehicleRef } from "./vehicles.js";

const ENTITY = "vehicle_metrics";
const EPOCH = new Date(0);
const OVERLAP_MS = 30 * 60 * 1000;
const FETCH_LIMIT = 2000;
const CHUNK_SIZE = 500;

export interface VehicleMetricsSyncResult {
  inserted: number;
}

export async function syncVehicleMetrics(
  db: Db,
  dataSource: VehicleDataSource,
  vehicleMap: Map<number, VehicleRef>,
): Promise<VehicleMetricsSyncResult> {
  const source = dataSource.source;

  try {
    const watermark = (await getWatermark(db, source, ENTITY)) ?? EPOCH;
    const since =
      watermark === EPOCH
        ? EPOCH
        : new Date(Math.max(0, watermark.getTime() - OVERLAP_MS));

    const rows = await dataSource.fetchVehicleMetricsSince(since, FETCH_LIMIT);

    let inserted = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      const values = chunk
        .map((row) => {
          const vehicle = vehicleMap.get(row.car_id);
          if (!vehicle) return null;

          return {
            vehicleId: vehicle.id,
            ts: row.bucket_ts,
            soc: row.soc,
            ratedRangeKm: row.rated_range_km,
            odometerKm: row.odometer,
            source,
          };
        })
        .filter((row) => row !== null);

      if (values.length === 0) continue;

      const result = await db
        .insert(vehicleMetrics)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: vehicleMetrics.id });

      inserted += result.length;
    }

    const newest =
      rows.length > 0
        ? new Date(Math.max(...rows.map((row) => row.source_date.getTime())))
        : watermark === EPOCH
          ? null
          : watermark;

    await recordSyncRun(db, source, ENTITY, {
      status: "ok",
      watermarkTs: newest,
      rowsUpserted: inserted,
    });

    return { inserted };
  } catch (err) {
    await recordSyncRun(db, source, ENTITY, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      rowsUpserted: 0,
    });

    throw err;
  }
}
