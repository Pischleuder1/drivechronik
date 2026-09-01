import { describe, expect, it } from "vitest";
import { buildMonthReport } from "./month.js";
import type { ReportDrive, ReportMeta } from "./types.js";

const meta: ReportMeta = {
  vehicleName: "Model 3",
  generatedAt: new Date("2026-03-01T08:00:00Z"),
  timeZone: "Europe/Berlin",
};

function makeDrive(overrides: Partial<ReportDrive> = {}): ReportDrive {
  return {
    id: 1,
    startTime: new Date("2026-02-02T08:14:00Z"),
    endTime: new Date("2026-02-02T08:47:00Z"),
    startPlaceName: "Zuhause",
    endPlaceName: "Büro",
    startAddress: null,
    endAddress: null,
    startLat: null,
    startLon: null,
    endLat: null,
    endLon: null,
    startOdometerKm: 12000,
    endOdometerKm: 12027.3,
    distanceKm: 27.3,
    durationSeconds: 1980,
    consumedEnergyKwh: 4.56,
    energyIsEstimated: true,
    avgConsumptionWhKm: 167.03,
    classification: "business",
    purpose: null,
    customer: null,
    project: null,
    notes: null,
    tags: [],
    ...overrides,
  };
}

describe("buildMonthReport", () => {
  it("filtert nach Klassifizierung, falls angegeben", () => {
    const drives = [
      makeDrive({ id: 1, classification: "business", distanceKm: 10 }),
      makeDrive({ id: 2, classification: "private", distanceKm: 20 }),
    ];

    const report = buildMonthReport(drives, "2026-02", meta, ["business"]);

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]!.id).toBe(1);
    expect(report.totals.driveCount).toBe(1);
    expect(report.totals.distanceKm).toBe(10);
  });

  it("berechnet Summen pro Klassifizierung und die Gesamtsumme (vision.md §20.3)", () => {
    const drives = [
      makeDrive({ id: 1, classification: "business", distanceKm: 10 }),
      makeDrive({ id: 2, classification: "business", distanceKm: 5 }),
      makeDrive({ id: 3, classification: "private", distanceKm: 20 }),
      makeDrive({ id: 4, classification: "commute", distanceKm: 8 }),
      makeDrive({ id: 5, classification: "unclassified", distanceKm: 2 }),
    ];

    const report = buildMonthReport(drives, "2026-02", meta);

    expect(report.byClassification.business).toEqual({
      classification: "business",
      driveCount: 2,
      distanceKm: 15,
    });
    expect(report.byClassification.private).toEqual({
      classification: "private",
      driveCount: 1,
      distanceKm: 20,
    });
    expect(report.byClassification.commute).toEqual({
      classification: "commute",
      driveCount: 1,
      distanceKm: 8,
    });
    expect(report.byClassification.unclassified).toEqual({
      classification: "unclassified",
      driveCount: 1,
      distanceKm: 2,
    });
    expect(report.totals).toEqual({ driveCount: 5, distanceKm: 45 });
    expect(report.hasIncompleteData).toBe(false);
  });

  it("zählt Fahrten mit fehlender Distanz in driveCount, aber mit 0 km und flaggt hasIncompleteData", () => {
    const drives = [
      makeDrive({ id: 1, classification: "business", distanceKm: 10 }),
      makeDrive({ id: 2, classification: "business", distanceKm: null }),
    ];

    const report = buildMonthReport(drives, "2026-02", meta);

    expect(report.byClassification.business.driveCount).toBe(2);
    expect(report.byClassification.business.distanceKm).toBe(10);
    expect(report.hasIncompleteData).toBe(true);
  });

  it("liefert leere, aber vollständige Struktur für einen leeren Monat", () => {
    const report = buildMonthReport([], "2026-02", meta);

    expect(report.rows).toEqual([]);
    expect(report.totals).toEqual({ driveCount: 0, distanceKm: 0 });
    expect(report.hasIncompleteData).toBe(false);
    for (const classification of [
      "unclassified",
      "private",
      "business",
      "commute",
    ] as const) {
      expect(report.byClassification[classification]).toEqual({
        classification,
        driveCount: 0,
        distanceKm: 0,
      });
    }
  });

  it("berechnet 0,30 EUR pro geschäftlichem Kilometer", () => {
    const drives = [
      makeDrive({
        id: 1,
        classification: "business",
        distanceKm: 50,
      }),
      makeDrive({
        id: 2,
        classification: "business",
        distanceKm: 75,
      }),
    ];

    const report = buildMonthReport(
      drives,
      "2026-02",
      meta,
      ["business"],
    );

    expect(report.businessReimbursement).toEqual({
      applicable: true,
      distanceKm: 125,
      rateEurPerKm: 0.3,
      amountEur: 37.5,
      incomplete: false,
    });
  });

  it("markiert die Geschäftskilometer-Erstattung bei fehlender Distanz als unvollständig", () => {
    const drives = [
      makeDrive({
        id: 1,
        classification: "business",
        distanceKm: 10,
      }),
      makeDrive({
        id: 2,
        classification: "business",
        distanceKm: null,
      }),
    ];

    const report = buildMonthReport(
      drives,
      "2026-02",
      meta,
      ["business"],
    );

    expect(report.businessReimbursement).toEqual({
      applicable: true,
      distanceKm: 10,
      rateEurPerKm: 0.3,
      amountEur: 3,
      incomplete: true,
    });
  });

  it("unterstützt einen abweichenden Erstattungssatz", () => {
    const report = buildMonthReport(
      [
        makeDrive({
          classification: "business",
          distanceKm: 125,
        }),
      ],
      "2026-02",
      meta,
      ["business"],
      0.35,
    );

    expect(report.businessReimbursement.rateEurPerKm).toBe(0.35);
    expect(report.businessReimbursement.amountEur).toBe(43.75);
  });

  it("kennzeichnet die Erstattung bei einem Report ohne Business-Filter als nicht anwendbar", () => {
    const report = buildMonthReport(
      [
        makeDrive({
          classification: "private",
          distanceKm: 25,
        }),
      ],
      "2026-02",
      meta,
      ["private"],
    );

    expect(report.businessReimbursement).toEqual({
      applicable: false,
      distanceKm: 0,
      rateEurPerKm: 0.3,
      amountEur: 0,
      incomplete: false,
    });
  });

  it("sortiert Zeilen chronologisch, auch bei unsortierter Eingabe", () => {
    const late = makeDrive({ id: 1, startTime: new Date("2026-02-20T08:00:00Z") });
    const early = makeDrive({ id: 2, startTime: new Date("2026-02-01T08:00:00Z") });

    const report = buildMonthReport([late, early], "2026-02", meta);

    expect(report.rows.map((r) => r.id)).toEqual([2, 1]);
  });
});
