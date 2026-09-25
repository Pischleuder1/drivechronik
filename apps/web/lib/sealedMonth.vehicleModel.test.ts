import { describe, expect, it } from "vitest";

import {
  createMonthSealContent,
  type MonthSealIdentity,
} from "@drivechronik/core";

import {
  hashMonthSealContent,
  hashMonthSealPayload,
  type MonthSealPayload,
} from "./monthSeal";

import {
  verifySealedMonthRow,
  type SealedMonthRow,
} from "./sealedMonth";


function makeRow(
  identity: MonthSealIdentity,
  {
    removeVehicleModel = false,
  }: {
    removeVehicleModel?: boolean;
  } = {},
): SealedMonthRow {
  const content = createMonthSealContent(
    "2026-04",
    identity,
    [],
  );

  if (removeVehicleModel) {
    delete content.identity.vehicleModel;
  }

  const contentHash = hashMonthSealContent(content);
  const sealedAt = new Date("2026-09-25T14:41:00.000Z");

  const payload: MonthSealPayload = {
    version: 1,
    vehicleId: identity.vehicleId,
    month: "2026-04",
    revision: 1,
    driverName: identity.driverName,
    licensePlate: identity.licensePlate,
    vehicleDisplayName: identity.vehicleDisplayName,
    vehicleVin: identity.vehicleVin,
    driveCount: 0,
    distanceKm: 0,
    lastAuditHash: null,
    contentHash,
    sealedAt: sealedAt.toISOString(),
    sealedBy: "admin",
  };

  return {
    vehicleId: identity.vehicleId,
    month: "2026-04",
    revision: 1,
    driverName: identity.driverName,
    licensePlate: identity.licensePlate,
    vehicleDisplayName: identity.vehicleDisplayName,
    vehicleVin: identity.vehicleVin,
    driveCount: 0,
    distanceKm: 0,
    lastAuditHash: null,
    contentHash,
    snapshot: content,
    sealHash: hashMonthSealPayload(payload),
    signatureAlgorithm: null,
    signature: null,
    signingPublicKey: null,
    sealedAt,
    sealedBy: "admin",
  };
}


describe("sealed month vehicle model", () => {
  const identity: MonthSealIdentity = {
    vehicleId: 1,
    driverName: "Demo Fahrer Y",
    licensePlate: "HN-MY 123 E",
    vehicleDisplayName: "Demo Model Y",
    vehicleModel: "Y",
    vehicleVin: "7SAYGDEE0TF000001",
  };

  it("erhält das Fahrzeugmodell beim Verifizieren des Snapshots", () => {
    const result = verifySealedMonthRow(makeRow(identity));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.content.identity.vehicleModel).toBe("Y");
  });

  it("bleibt mit älteren Snapshots ohne Fahrzeugmodell kompatibel", () => {
    const result = verifySealedMonthRow(
      makeRow(identity, {
        removeVehicleModel: true,
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.content.identity.vehicleModel).toBeUndefined();
  });
});
