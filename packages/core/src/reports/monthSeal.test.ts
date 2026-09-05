import { describe, expect, it } from "vitest";

import {
  createMonthSealContent,
  monthSealTotals,
  type MonthSealIdentity,
} from "./monthSeal.js";
import type { ReportDrive } from "./types.js";

const identity: MonthSealIdentity = {
  vehicleId: 1,
  driverName: " Hans Mustermann ",
  licensePlate: " AB-ES 2345 E ",
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

describe("createMonthSealContent", () => {
  it("erzeugt bei unterschiedlicher Eingabereihenfolge denselben Inhalt", () => {
    const early = makeDrive({
      id: 2,
      startTime: new Date("2026-08-01T08:00:00Z"),
    });

    const late = makeDrive({
      id: 1,
      startTime: new Date("2026-08-20T08:00:00Z"),
    });

    const first = createMonthSealContent(
      "2026-08",
      identity,
      [late, early],
    );

    const second = createMonthSealContent(
      "2026-08",
      identity,
      [early, late],
    );

    expect(first).toEqual(second);
    expect(first.drives.map((drive) => drive.id)).toEqual([2, 1]);
  });

  it("sortiert Tags deterministisch", () => {
    const first = createMonthSealContent(
      "2026-08",
      identity,
      [makeDrive({ tags: ["Kunde", "Außendienst"] })],
    );

    const second = createMonthSealContent(
      "2026-08",
      identity,
      [makeDrive({ tags: ["Außendienst", "Kunde"] })],
    );

    expect(first).toEqual(second);
    expect(first.drives[0]!.tags).toEqual(["Außendienst", "Kunde"]);
  });

  it("verwendet bei gleichem Startzeitpunkt die ID als stabile Reihenfolge", () => {
    const first = makeDrive({ id: 8 });
    const second = makeDrive({ id: 3 });

    const content = createMonthSealContent(
      "2026-08",
      identity,
      [first, second],
    );

    expect(content.drives.map((drive) => drive.id)).toEqual([3, 8]);
  });

  it("normalisiert Fahrername und Kennzeichen", () => {
    const content = createMonthSealContent(
      "2026-08",
      identity,
      [],
    );

    expect(content.identity.driverName).toBe("Hans Mustermann");
    expect(content.identity.licensePlate).toBe("AB-ES 2345 E");
  });

  it("wandelt ein leeres Kennzeichen in null um", () => {
    const content = createMonthSealContent(
      "2026-08",
      {
        ...identity,
        licensePlate: "   ",
      },
      [],
    );

    expect(content.identity.licensePlate).toBeNull();
  });

  it("verweigert einen Abschluss ohne Fahrername", () => {
    expect(() =>
      createMonthSealContent(
        "2026-08",
        {
          ...identity,
          driverName: " ",
        },
        [],
      ),
    ).toThrow("Driver name is required");
  });

  it("verweigert ein ungültiges Monatsformat", () => {
    expect(() =>
      createMonthSealContent(
        "08-2026",
        identity,
        [],
      ),
    ).toThrow("YYYY-MM");
  });
});

describe("monthSealTotals", () => {
  it("berechnet Anzahl und Kilometer aus allen Fahrten", () => {
    const content = createMonthSealContent(
      "2026-08",
      identity,
      [
        makeDrive({ id: 1, distanceKm: 12.5 }),
        makeDrive({ id: 2, distanceKm: 20 }),
        makeDrive({ id: 3, distanceKm: null }),
      ],
    );

    expect(monthSealTotals(content)).toEqual({
      driveCount: 3,
      distanceKm: 32.5,
    });
  });
});
