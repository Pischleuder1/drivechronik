import "server-only";

import { and, eq } from "drizzle-orm";

import {
  monthSeals,
} from "@drivechronik/db";

import type {
  MonthSealContent,
} from "@drivechronik/core";

import {
  verifySealedMonthRow,
  type SealedMonthRow,
  type SealedMonthVerificationError,
} from "./sealedMonth";

import { db } from "./db";

export type LoadSealedMonthResult =
  | {
      ok: true;
      row: SealedMonthRow;
      content: MonthSealContent;
      drives: ReturnType<
        typeof import("@drivechronik/core")["monthSealContentToReportDrives"]
      >;
    }
  | {
      ok: false;
      error:
        | "not_found"
        | SealedMonthVerificationError;
    };

export async function loadSealedMonth(
  vehicleId: number,
  month: string,
  revision: number,
): Promise<LoadSealedMonthResult> {
  const rows = await db
    .select({
      vehicleId: monthSeals.vehicleId,
      month: monthSeals.month,
      revision: monthSeals.revision,
      driverName: monthSeals.driverName,
      licensePlate: monthSeals.licensePlate,
      vehicleDisplayName: monthSeals.vehicleDisplayName,
      vehicleVin: monthSeals.vehicleVin,
      driveCount: monthSeals.driveCount,
      distanceKm: monthSeals.distanceKm,
      lastAuditHash: monthSeals.lastAuditHash,
      contentHash: monthSeals.contentHash,
      snapshot: monthSeals.snapshot,
      sealHash: monthSeals.sealHash,
      sealedAt: monthSeals.sealedAt,
      sealedBy: monthSeals.sealedBy,
    })
    .from(monthSeals)
    .where(
      and(
        eq(monthSeals.vehicleId, vehicleId),
        eq(monthSeals.month, month),
        eq(monthSeals.revision, revision),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    return {
      ok: false,
      error: "not_found",
    };
  }

  const verification = verifySealedMonthRow(row);

  if (!verification.ok) {
    return verification;
  }

  return {
    ok: true,
    row,
    content: verification.content,
    drives: verification.drives,
  };
}
