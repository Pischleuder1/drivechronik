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
  hasSnapshot: boolean;
}

export interface MonthSealHistoryEntry {
  revision: number;
  sealedAt: Date;
  sealedBy: string;
  driveCount: number;
  distanceKm: number;
  hasSnapshot: boolean;
}

export async function getMonthSealHistory(
  month: string,
  vehicleId: number,
): Promise<MonthSealHistoryEntry[]> {
  const rows = await db
    .select({
      revision: monthSeals.revision,
      sealedAt: monthSeals.sealedAt,
      sealedBy: monthSeals.sealedBy,
      driveCount: monthSeals.driveCount,
      distanceKm: monthSeals.distanceKm,
      snapshot: monthSeals.snapshot,
    })
    .from(monthSeals)
    .where(
      and(
        eq(monthSeals.vehicleId, vehicleId),
        eq(monthSeals.month, month),
      ),
    )
    .orderBy(desc(monthSeals.revision));

  return rows.map((row) => ({
    revision: row.revision,
    sealedAt: row.sealedAt,
    sealedBy: row.sealedBy,
    driveCount: row.driveCount,
    distanceKm: row.distanceKm,
    hasSnapshot: row.snapshot != null,
  }));
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
      hasSnapshot: false,
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
    hasSnapshot: latest.snapshot != null,
  };
}
