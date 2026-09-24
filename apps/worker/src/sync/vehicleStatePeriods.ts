import { sql } from "drizzle-orm";
import { vehicleStatePeriods, type Db } from "@drivechronik/db";
import type { VehicleDataSource } from "../dataSource/vehicleDataSource.js";
import { getWatermark, recordSyncRun } from "./state.js";
import type { VehicleRef } from "./vehicles.js";

const ENTITY = "vehicle_state_periods";
const EPOCH = new Date(0);

// Kleine Überlappung: Eine zunächst offene TeslaMate-State-Periode
// kann beim nächsten Zyklus inzwischen ein end_date erhalten haben.
const OVERLAP_MS = 5 * 60 * 1000;

const FETCH_LIMIT = 5000;
const CHUNK_SIZE = 500;

export interface VehicleStatePeriodsSyncResult {
  upserted: number;
}

export async function syncVehicleStatePeriods(
  db: Db,
  dataSource: VehicleDataSource,
  vehicleMap: Map<number, VehicleRef>,
): Promise<VehicleStatePeriodsSyncResult> {
  const source = dataSource.source;

  try {
    const watermark =
      (await getWatermark(db, source, ENTITY)) ?? EPOCH;

    const since =
      watermark === EPOCH
        ? EPOCH
        : new Date(
            Math.max(
              0,
              watermark.getTime() - OVERLAP_MS,
            ),
          );

    const rows =
      await dataSource.fetchVehicleStatePeriodsSince(
        since,
        FETCH_LIMIT,
      );

    let upserted = 0;
    const syncedAt = new Date();

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      const values = chunk
        .map((row) => {
          const vehicle = vehicleMap.get(row.car_id);

          if (!vehicle) {
            console.warn(
              `[sync:vehicleStatePeriods] unbekannte car_id ${row.car_id}, State ${row.id} übersprungen`,
            );
            return null;
          }

          return {
            vehicleId: vehicle.id,
            state: row.state,
            startTime: row.start_time,
            endTime: row.end_time,
            source,
            sourceId: String(row.id),
            syncedAt,
          };
        })
        .filter((row) => row !== null);

      if (values.length === 0) continue;

      const result = await db
        .insert(vehicleStatePeriods)
        .values(values)
        .onConflictDoUpdate({
          target: [
            vehicleStatePeriods.source,
            vehicleStatePeriods.sourceId,
          ],
          set: {
            vehicleId: sql`excluded.vehicle_id`,
            state: sql`excluded.state`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            syncedAt: sql`excluded.synced_at`,
          },
        })
        .returning({
          id: vehicleStatePeriods.id,
        });

      upserted += result.length;
    }

    const newest =
      rows.length > 0
        ? new Date(
            Math.max(
              watermark.getTime(),
              ...rows.map((row) =>
                row.source_date.getTime(),
              ),
            ),
          )
        : watermark === EPOCH
          ? null
          : watermark;

    await recordSyncRun(db, source, ENTITY, {
      status: "ok",
      watermarkTs: newest,
      rowsUpserted: upserted,
    });

    return { upserted };
  } catch (err) {
    await recordSyncRun(db, source, ENTITY, {
      status: "error",
      error:
        err instanceof Error
          ? err.message
          : String(err),
      rowsUpserted: 0,
    });

    throw err;
  }
}
