import { describe, expect, it } from "vitest";

import type {
  MonthSealIdentity,
  ReportDrive,
} from "@drivechronik/core";

import {
  buildMonthSealHash,
  hashMonthSealContent,
  hashMonthSealPayload,
  shouldCreateMonthSealRevision,
  verifyMonthSealContentHash,
  verifyMonthSealHash,
} from "./monthSeal";

const identity: MonthSealIdentity = {
  vehicleId: 1,
  driverName: "Hans Mustermann",
  licensePlate: "AB-ES 2345 E",
  vehicleDisplayName: "Blitzkarre",
  vehicleVin: "DEMO-VIN",
};

function makeDrive(overrides: Partial<ReportDrive> = {}): ReportDrive {
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

describe("buildMonthSealHash", () => {
  it("liefert für denselben Inhalt denselben Hash", () => {
    const first = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    const second = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    expect(first.contentHash).toBe(second.contentHash);
  });

  it("ist unabhängig von der Reihenfolge der Fahrten", () => {
    const early = makeDrive({
      id: 2,
      startTime: new Date("2026-08-01T08:00:00Z"),
    });

    const late = makeDrive({
      id: 1,
      startTime: new Date("2026-08-20T08:00:00Z"),
    });

    const first = buildMonthSealHash(
      "2026-08",
      identity,
      [late, early],
    );

    const second = buildMonthSealHash(
      "2026-08",
      identity,
      [early, late],
    );

    expect(first.contentHash).toBe(second.contentHash);
  });

  it("ändert den Hash bei geändertem Fahrtzweck", () => {
    const original = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    const changed = buildMonthSealHash(
      "2026-08",
      identity,
      [
        makeDrive({
          purpose: "Baustellenbesuch",
        }),
      ],
    );

    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it("ändert den Hash bei geänderter Klassifizierung", () => {
    const original = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    const changed = buildMonthSealHash(
      "2026-08",
      identity,
      [
        makeDrive({
          classification: "private",
        }),
      ],
    );

    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it("ändert den Hash bei geändertem Kilometerstand", () => {
    const original = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    const changed = buildMonthSealHash(
      "2026-08",
      identity,
      [
        makeDrive({
          endOdometerKm: 12026,
        }),
      ],
    );

    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it("ändert den Inhalts-Hash nicht bei geändertem Kennzeichen", () => {
    const original = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    const changed = buildMonthSealHash(
      "2026-08",
      {
        ...identity,
        licensePlate: "MI-DC 2026 E",
      },
      [makeDrive()],
    );

    expect(changed.contentHash).toBe(original.contentHash);
  });

  it("liefert Anzahl und Kilometer passend zum Inhalt", () => {
    const result = buildMonthSealHash(
      "2026-08",
      identity,
      [
        makeDrive({ id: 1, distanceKm: 12.5 }),
        makeDrive({ id: 2, distanceKm: 20 }),
        makeDrive({ id: 3, distanceKm: null }),
      ],
    );

    expect(result.driveCount).toBe(3);
    expect(result.distanceKm).toBe(32.5);
  });
});

describe("gespeicherter Monats-Snapshot", () => {
  it("liefert aus dem gespeicherten Inhalt wieder denselben Hash", () => {
    const result = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    expect(hashMonthSealContent(result.content)).toBe(
      result.contentHash,
    );

    expect(
      verifyMonthSealContentHash(
        result.content,
        result.contentHash,
      ),
    ).toBe(true);
  });

  it("erkennt einen nachträglich veränderten Snapshot", () => {
    const result = buildMonthSealHash(
      "2026-08",
      identity,
      [makeDrive()],
    );

    const manipulated = structuredClone(result.content);
    manipulated.drives[0]!.purpose = "Manipuliert";

    expect(
      verifyMonthSealContentHash(
        manipulated,
        result.contentHash,
      ),
    ).toBe(false);
  });
});

describe("Monatsabschluss-Hash", () => {
  it("verifiziert einen unveränderten Seal-Payload", () => {
    const payload = {
      version: 1 as const,
      vehicleId: 1,
      month: "2026-08",
      revision: 3,
      driverName: "Hans Mustermann",
      licensePlate: "AB-CD 9876 E",
      vehicleDisplayName: "Blitzkarre",
      vehicleVin: "DEMO-VIN",
      driveCount: 101,
      distanceKm: 637.7,
      lastAuditHash: "audit-hash",
      contentHash: "content-hash",
      sealedAt: "2026-09-05T07:00:00.000Z",
      sealedBy: "demo",
    };

    const sealHash = hashMonthSealPayload(payload);

    expect(verifyMonthSealHash(payload, sealHash)).toBe(true);
  });

  it("erkennt eine veränderte Identität im Seal-Payload", () => {
    const payload = {
      version: 1 as const,
      vehicleId: 1,
      month: "2026-08",
      revision: 3,
      driverName: "Hans Mustermann",
      licensePlate: "AB-CD 9876 E",
      vehicleDisplayName: "Blitzkarre",
      vehicleVin: "DEMO-VIN",
      driveCount: 101,
      distanceKm: 637.7,
      lastAuditHash: "audit-hash",
      contentHash: "content-hash",
      sealedAt: "2026-09-05T07:00:00.000Z",
      sealedBy: "demo",
    };

    const sealHash = hashMonthSealPayload(payload);

    const manipulated = {
      ...payload,
      licensePlate: "XY-Z 1234",
    };

    expect(
      verifyMonthSealHash(manipulated, sealHash),
    ).toBe(false);
  });
});

describe("shouldCreateMonthSealRevision", () => {
  it("verhindert eine identische neue Revision", () => {
    expect(
      shouldCreateMonthSealRevision("abc123", "abc123"),
    ).toBe(false);
  });

  it("erlaubt eine Revision bei geändertem Fahrteninhalt", () => {
    expect(
      shouldCreateMonthSealRevision("abc123", "def456"),
    ).toBe(true);
  });

  it("erlaubt den ersten Monatsabschluss", () => {
    expect(
      shouldCreateMonthSealRevision(null, "abc123"),
    ).toBe(true);
  });
});

