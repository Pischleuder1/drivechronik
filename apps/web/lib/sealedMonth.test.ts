import { describe, expect, it } from "vitest";

import {
  createMonthSealContent,
  monthSealTotals,
  type MonthSealIdentity,
  type ReportDrive,
} from "@drivechronik/core";

import {
  hashMonthSealContent,
  hashMonthSealPayload,
} from "./monthSeal";

import {
  verifySealedMonthRow,
  type SealedMonthRow,
} from "./sealedMonth";

const identity: MonthSealIdentity = {
  vehicleId: 1,
  driverName: "Hans Mustermann",
  licensePlate: "AB-CD 9876 E",
  vehicleDisplayName: "Blitzkarre",
  vehicleVin: "DEMO-VIN",
};

function makeDrive(
  overrides: Partial<ReportDrive> = {},
): ReportDrive {
  return {
    id: 1,
    startTime: new Date("2026-08-10T08:00:00Z"),
    endTime: new Date("2026-08-10T08:30:00Z"),
    startPlaceName: "Zuhause",
    endPlaceName: "Kunde",
    startAddress: "Startstraße 1",
    endAddress: "Zielstraße 2",
    startLat: 52.1,
    startLon: 8.6,
    endLat: 52.2,
    endLon: 8.7,
    startOdometerKm: 12000,
    endOdometerKm: 12025,
    distanceKm: 25,
    durationSeconds: 1800,
    consumedEnergyKwh: 4.5,
    energyIsEstimated: false,
    avgConsumptionWhKm: 180,
    classification: "business",
    purpose: "Kundentermin",
    customer: "Musterkunde",
    project: null,
    notes: null,
    tags: ["Außendienst", "Kunde"],
    ...overrides,
  };
}

function makeValidRow(): SealedMonthRow {
  const content = createMonthSealContent(
    "2026-08",
    identity,
    [makeDrive()],
  );

  const totals = monthSealTotals(content);
  const contentHash = hashMonthSealContent(content);
  const sealedAt = new Date("2026-09-05T07:00:00.000Z");

  const base = {
    vehicleId: identity.vehicleId,
    month: "2026-08",
    revision: 3,
    driverName: identity.driverName,
    licensePlate: identity.licensePlate,
    vehicleDisplayName: identity.vehicleDisplayName,
    vehicleVin: identity.vehicleVin,
    driveCount: totals.driveCount,
    distanceKm: totals.distanceKm,
    lastAuditHash: "audit-hash",
    contentHash,
    snapshot: content,
    sealedAt,
    sealedBy: "demo",
  };

  return {
    ...base,
    sealHash: hashMonthSealPayload({
      version: 1,
      vehicleId: base.vehicleId,
      month: base.month,
      revision: base.revision,
      driverName: base.driverName,
      licensePlate: base.licensePlate,
      vehicleDisplayName: base.vehicleDisplayName,
      vehicleVin: base.vehicleVin,
      driveCount: base.driveCount,
      distanceKm: base.distanceKm,
      lastAuditHash: base.lastAuditHash,
      contentHash: base.contentHash,
      sealedAt: base.sealedAt.toISOString(),
      sealedBy: base.sealedBy,
    }),
  };
}

describe("verifySealedMonthRow", () => {
  it("verifiziert eine vollständig gültige Revision", () => {
    const result = verifySealedMonthRow(makeValidRow());

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.content.month).toBe("2026-08");
      expect(result.drives).toHaveLength(1);
      expect(result.drives[0]!.purpose).toBe("Kundentermin");
    }
  });

  it("erkennt einen fehlenden Snapshot", () => {
    const row = makeValidRow();
    row.snapshot = null;

    expect(verifySealedMonthRow(row)).toEqual({
      ok: false,
      error: "snapshot_missing",
    });
  });

  it("erkennt einen strukturell ungültigen Snapshot", () => {
    const row = makeValidRow();
    row.snapshot = {
      schemaVersion: 1,
      month: "2026-08",
    };

    expect(verifySealedMonthRow(row)).toEqual({
      ok: false,
      error: "snapshot_invalid",
    });
  });

  it("erkennt eine abweichende Identität", () => {
    const row = makeValidRow();
    row.licensePlate = "XY-Z 1234";

    expect(verifySealedMonthRow(row)).toEqual({
      ok: false,
      error: "identity_mismatch",
    });
  });

  it("erkennt einen manipulierten Fahrteninhalt", () => {
    const row = makeValidRow();
    const snapshot = structuredClone(row.snapshot) as {
      drives: Array<{ purpose: string | null }>;
    };

    snapshot.drives[0]!.purpose = "Manipuliert";
    row.snapshot = snapshot;

    expect(verifySealedMonthRow(row)).toEqual({
      ok: false,
      error: "content_hash_mismatch",
    });
  });

  it("erkennt abweichende Summen", () => {
    const row = makeValidRow();

    row.driveCount = 2;

    row.sealHash = hashMonthSealPayload({
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
    });

    expect(verifySealedMonthRow(row)).toEqual({
      ok: false,
      error: "totals_mismatch",
    });
  });

  it("erkennt einen falschen Seal-Hash", () => {
    const row = makeValidRow();
    row.sealHash = "falscher-hash";

    expect(verifySealedMonthRow(row)).toEqual({
      ok: false,
      error: "seal_hash_mismatch",
    });
  });
});
