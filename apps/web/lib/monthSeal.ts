import {
  canonicalJson,
  sha256,
} from "@drivechronik/db";
import {
  createMonthSealContent,
  monthSealTotals,
  type MonthSealContent,
  type MonthSealIdentity,
  type ReportDrive,
} from "@drivechronik/core";

export interface MonthSealHashResult {
  content: MonthSealContent;
  contentHash: string;
  driveCount: number;
  distanceKm: number;
}

export function hashMonthSealContent(
  content: MonthSealContent,
): string {
  return sha256(
    canonicalJson({
      schemaVersion: content.schemaVersion,
      month: content.month,
      vehicleId: content.identity.vehicleId,
      drives: content.drives,
    }),
  );
}

export function verifyMonthSealContentHash(
  content: MonthSealContent,
  expectedContentHash: string,
): boolean {
  return hashMonthSealContent(content) === expectedContentHash;
}

export function buildMonthSealHash(
  month: string,
  identity: MonthSealIdentity,
  drives: ReportDrive[],
): MonthSealHashResult {
  const content = createMonthSealContent(
    month,
    identity,
    drives,
  );

  const contentHash = hashMonthSealContent(content);
  const totals = monthSealTotals(content);

  return {
    content,
    contentHash,
    driveCount: totals.driveCount,
    distanceKm: totals.distanceKm,
  };
}

export interface MonthSealPayload {
  version: 1;
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
  sealedAt: string;
  sealedBy: string;
}

export function hashMonthSealPayload(
  payload: MonthSealPayload,
): string {
  return sha256(canonicalJson(payload));
}

export function verifyMonthSealHash(
  payload: MonthSealPayload,
  expectedSealHash: string,
): boolean {
  return hashMonthSealPayload(payload) === expectedSealHash;
}

export function shouldCreateMonthSealRevision(
  previousContentHash: string | null | undefined,
  currentContentHash: string,
): boolean {
  return previousContentHash !== currentContentHash;
}
