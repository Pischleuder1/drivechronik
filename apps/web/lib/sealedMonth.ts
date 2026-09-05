import { z } from "zod";


import {
  monthSealContentToReportDrives,
  monthSealTotals,
  type MonthSealContent,
} from "@drivechronik/core";

import {
  verifyMonthSealContentHash,
  verifyMonthSealHash,
  type MonthSealPayload,
} from "./monthSeal";


const classificationSchema = z.enum([
  "unclassified",
  "private",
  "business",
  "commute",
]);

const nullableNumber = z.number().finite().nullable();

const monthSealDriveSchema = z.object({
  id: z.number().int().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  startPlaceName: z.string().nullable(),
  endPlaceName: z.string().nullable(),
  startAddress: z.string().nullable(),
  endAddress: z.string().nullable(),
  startLat: nullableNumber,
  startLon: nullableNumber,
  endLat: nullableNumber,
  endLon: nullableNumber,
  startOdometerKm: nullableNumber,
  endOdometerKm: nullableNumber,
  distanceKm: nullableNumber,
  durationSeconds: nullableNumber,
  classification: classificationSchema,
  purpose: z.string().nullable(),
  customer: z.string().nullable(),
  project: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
});

const monthSealContentSchema = z.object({
  schemaVersion: z.literal(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  identity: z.object({
    vehicleId: z.number().int().positive(),
    driverName: z.string().min(1),
    licensePlate: z.string().nullable(),
    vehicleDisplayName: z.string().min(1),
    vehicleVin: z.string().nullable(),
  }),
  drives: z.array(monthSealDriveSchema),
});

export type SealedMonthVerificationError =
  | "snapshot_missing"
  | "snapshot_invalid"
  | "content_hash_mismatch"
  | "identity_mismatch"
  | "totals_mismatch"
  | "seal_hash_mismatch";

export interface SealedMonthRow {
  vehicleId: number;
  month: string;
  revision: number;
  driverName: string;
  licensePlate: string | null;
  vehicleDisplayName: string;
  vehicleVin: string | null;
  driveCount: number;
  distanceKm: number;
  lastAuditHash: string | null;
  contentHash: string;
  snapshot: unknown;
  sealHash: string;
  sealedAt: Date;
  sealedBy: string;
}

export type VerifySealedMonthResult =
  | {
      ok: true;
      content: MonthSealContent;
      drives: ReturnType<typeof monthSealContentToReportDrives>;
    }
  | {
      ok: false;
      error: SealedMonthVerificationError;
    };

function sameNullableString(
  left: string | null,
  right: string | null,
): boolean {
  return left === right;
}

function sameDistance(
  left: number,
  right: number,
): boolean {
  return Math.abs(left - right) < 1e-9;
}

export function verifySealedMonthRow(
  row: SealedMonthRow,
): VerifySealedMonthResult {
  if (row.snapshot == null) {
    return {
      ok: false,
      error: "snapshot_missing",
    };
  }

  const parsed = monthSealContentSchema.safeParse(row.snapshot);

  if (!parsed.success) {
    return {
      ok: false,
      error: "snapshot_invalid",
    };
  }

  const content: MonthSealContent = parsed.data;

  if (
    content.month !== row.month ||
    content.identity.vehicleId !== row.vehicleId ||
    content.identity.driverName !== row.driverName ||
    !sameNullableString(
      content.identity.licensePlate,
      row.licensePlate,
    ) ||
    content.identity.vehicleDisplayName !==
      row.vehicleDisplayName ||
    !sameNullableString(
      content.identity.vehicleVin,
      row.vehicleVin,
    )
  ) {
    return {
      ok: false,
      error: "identity_mismatch",
    };
  }

  if (
    !verifyMonthSealContentHash(
      content,
      row.contentHash,
    )
  ) {
    return {
      ok: false,
      error: "content_hash_mismatch",
    };
  }

  const totals = monthSealTotals(content);

  if (
    totals.driveCount !== row.driveCount ||
    !sameDistance(
      totals.distanceKm,
      row.distanceKm,
    )
  ) {
    return {
      ok: false,
      error: "totals_mismatch",
    };
  }

  const payload: MonthSealPayload = {
    version: 1,
    vehicleId: row.vehicleId,
    month: row.month,
    revision: row.revision,
    driverName: row.driverName,
    licensePlate: row.licensePlate,
    vehicleDisplayName: row.vehicleDisplayName,
    vehicleVin: row.vehicleVin,
    driveCount: row.driveCount,
    distanceKm: row.distanceKm,
    lastAuditHash: row.lastAuditHash,
    contentHash: row.contentHash,
    sealedAt: row.sealedAt.toISOString(),
    sealedBy: row.sealedBy,
  };

  if (!verifyMonthSealHash(payload, row.sealHash)) {
    return {
      ok: false,
      error: "seal_hash_mismatch",
    };
  }

  return {
    ok: true,
    content,
    drives: monthSealContentToReportDrives(content),
  };
}
