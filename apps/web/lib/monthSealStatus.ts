import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { monthSeals } from "@drivechronik/db";

import { db } from "./db";
import { loadMonthReportData } from "./exports/data";
import { buildMonthSealHash } from "./monthSeal";

export type MonthSealState =
  | "unsealed"
  | "sealed_unchanged"
  | "sealed_changed";

export interface MonthSealStatus {
  state: MonthSealState;
  vehicleId: number;
  month: string;
  revision: number | null;
  sealedAt: Date | null;
  sealedBy: string | null;
  sealHash: string | null;
  sealedContentHash: string | null;
  currentContentHash: string | null;
  driverName: string | null;
  licensePlate: string | null;
  vehicleDisplayName: string | null;
  vehicleVin: string | null;
  driveCount: number | null;
  distanceKm: number | null;
}

export async function getMonthSealStatus(
  month: string,
  vehicleId?: number,
): Promise<MonthSealStatus> {
  const data = await loadMonthReportData(
    month,
    undefined,
    vehicleId,
  );

  const latestRows = await db
    .select()
    .from(monthSeals)
    .where(
      and(
        eq(monthSeals.vehicleId, data.meta.vehicleId),
        eq(monthSeals.month, month),
      ),
    )
    .orderBy(desc(monthSeals.revision))
    .limit(1);

  const latest = latestRows[0];

  if (!latest) {
    return {
      state: "unsealed",
      vehicleId: data.meta.vehicleId,
      month,
      revision: null,
      sealedAt: null,
      sealedBy: null,
      sealHash: null,
      sealedContentHash: null,
      currentContentHash: null,
      driverName: null,
      licensePlate: null,
      vehicleDisplayName: null,
      vehicleVin: null,
      driveCount: null,
      distanceKm: null,
    };
  }

  const current = buildMonthSealHash(
    month,
    {
      vehicleId: latest.vehicleId,
      driverName: latest.driverName,
      licensePlate: latest.licensePlate,
      vehicleDisplayName: latest.vehicleDisplayName,
      vehicleVin: latest.vehicleVin,
    },
    data.drives,
  );

  return {
    state:
      current.contentHash === latest.contentHash
        ? "sealed_unchanged"
        : "sealed_changed",
    vehicleId: latest.vehicleId,
    month,
    revision: latest.revision,
    sealedAt: latest.sealedAt,
    sealedBy: latest.sealedBy,
    sealHash: latest.sealHash,
    sealedContentHash: latest.contentHash,
    currentContentHash: current.contentHash,
    driverName: latest.driverName,
    licensePlate: latest.licensePlate,
    vehicleDisplayName: latest.vehicleDisplayName,
    vehicleVin: latest.vehicleVin,
    driveCount: latest.driveCount,
    distanceKm: latest.distanceKm,
  };
}
