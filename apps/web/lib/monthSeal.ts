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

  const contentHash = sha256(
    canonicalJson({
      schemaVersion: content.schemaVersion,
      month: content.month,
      vehicleId: content.identity.vehicleId,
      drives: content.drives,
    }),
  );
  const totals = monthSealTotals(content);

  return {
    content,
    contentHash,
    driveCount: totals.driveCount,
    distanceKm: totals.distanceKm,
  };
}

export function shouldCreateMonthSealRevision(
  previousContentHash: string | null | undefined,
  currentContentHash: string,
): boolean {
  return previousContentHash !== currentContentHash;
}
