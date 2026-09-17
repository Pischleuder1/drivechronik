import { sql } from "drizzle-orm";
import { softwareUpdates, type Db } from "@drivechronik/db";
import type {
  SourceSoftwareUpdate,
  VehicleDataSource,
} from "../dataSource/vehicleDataSource.js";
import { recordSyncRun } from "./state.js";
import type { VehicleRef } from "./vehicles.js";

const ENTITY = "software_updates";

export interface SoftwareUpdatesSyncResult {
  upserted: number;
}

/**
 * Synct die Software-Update-Historie aus TeslaMate `updates`. Winzige
 * Tabelle — kompletter Fetch jeden Zyklus, kein Watermark nötig.
 */
export async function syncSoftwareUpdates(
  db: Db,
  dataSource: VehicleDataSource,
  vehicleMap: Map<number, VehicleRef>,
): Promise<SoftwareUpdatesSyncResult> {
  const source = dataSource.source;

  try {
    const rows = await dataSource.fetchSoftwareUpdates();
    const values = rows
      .map((u) => toSoftwareUpdateValues(u, vehicleMap, source))
      .filter((v) => v !== null);

    if (values.length > 0) {
      await db
        .insert(softwareUpdates)
        .values(values)
        .onConflictDoUpdate({
          target: [softwareUpdates.source, softwareUpdates.sourceId],
          set: {
            vehicleId: sql`excluded.vehicle_id`,
            version: sql`excluded.version`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    await recordSyncRun(db, source, ENTITY, {
      status: "ok",
      rowsUpserted: values.length,
    });
    return { upserted: values.length };
  } catch (err) {
    await recordSyncRun(db, source, ENTITY, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      rowsUpserted: 0,
    });
    throw err;
  }
}

function toSoftwareUpdateValues(
  u: SourceSoftwareUpdate,
  vehicleMap: Map<number, VehicleRef>,
  source: string,
) {
  const vehicle = vehicleMap.get(u.car_id);
  if (!vehicle) {
    console.warn(
      `[sync:softwareUpdates] unbekannte car_id ${u.car_id}, Update ${u.id} übersprungen`,
    );
    return null;
  }

  return {
    vehicleId: vehicle.id,
    version: u.version,
    startTime: u.start_time,
    endTime: u.end_time,
    source,
    sourceId: String(u.id),
    syncedAt: new Date(),
  };
}
