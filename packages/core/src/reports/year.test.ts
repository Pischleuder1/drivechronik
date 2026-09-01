import { describe, expect, it } from "vitest";

import { buildBusinessYearReport } from "./year.js";
import type { ReportDrive, ReportMeta } from "./types.js";

const meta: ReportMeta = {
  vehicleName: "Model Y",
  generatedAt: new Date("2026-12-31T12:00:00Z"),
  timeZone: "Europe/Berlin",
};

function drive(
  startTime: string,
  distanceKm: number | null,
  classification: ReportDrive["classification"] = "business",
): ReportDrive {
  return {
    startTime: new Date(startTime),
    distanceKm,
    classification,
  } as ReportDrive;
}

describe("buildBusinessYearReport", () => {
  it("creates all 12 months and aggregates business drives", () => {
    const report = buildBusinessYearReport(
      [
        drive("2026-01-10T08:00:00Z", 50),
        drive("2026-01-20T08:00:00Z", 75),
        drive("2026-02-05T08:00:00Z", 40),
      ],
      "2026",
      meta,
    );

    expect(report.months).toHaveLength(12);

    expect(report.months[0]).toMatchObject({
      month: "2026-01",
      driveCount: 2,
      distanceKm: 125,
      amountEur: 37.5,
      incomplete: false,
    });

    expect(report.months[1]).toMatchObject({
      month: "2026-02",
      driveCount: 1,
      distanceKm: 40,
      amountEur: 12,
      incomplete: false,
    });

    expect(report.totals).toEqual({
      driveCount: 3,
      distanceKm: 165,
      amountEur: 49.5,
    });
  });

  it("ignores non-business drives", () => {
    const report = buildBusinessYearReport(
      [
        drive("2026-03-01T08:00:00Z", 100, "business"),
        drive("2026-03-02T08:00:00Z", 50, "private"),
        drive("2026-03-03T08:00:00Z", 20, "commute"),
        drive("2026-03-04T08:00:00Z", 10, "unclassified"),
      ],
      "2026",
      meta,
    );

    expect(report.totals.driveCount).toBe(1);
    expect(report.totals.distanceKm).toBe(100);
    expect(report.totals.amountEur).toBe(30);
  });

  it("marks missing business distance as incomplete", () => {
    const report = buildBusinessYearReport(
      [
        drive("2026-04-01T08:00:00Z", 10),
        drive("2026-04-02T08:00:00Z", null),
      ],
      "2026",
      meta,
    );

    expect(report.months[3]).toMatchObject({
      driveCount: 2,
      distanceKm: 10,
      amountEur: 3,
      incomplete: true,
    });

    expect(report.incomplete).toBe(true);
  });

  it("uses a custom reimbursement rate", () => {
    const report = buildBusinessYearReport(
      [drive("2026-05-01T08:00:00Z", 125)],
      "2026",
      meta,
      0.35,
    );

    expect(report.rateEurPerKm).toBe(0.35);
    expect(report.totals.amountEur).toBe(43.75);
  });

  it("assigns drives by the configured local timezone", () => {
    const report = buildBusinessYearReport(
      [
        // In Europe/Berlin already 01.01.2026 00:30.
        drive("2025-12-31T23:30:00Z", 20),

        // In Europe/Berlin already 01.01.2027 00:30.
        drive("2026-12-31T23:30:00Z", 30),
      ],
      "2026",
      meta,
    );

    expect(report.months[0]?.distanceKm).toBe(20);
    expect(report.totals.distanceKm).toBe(20);
  });

  it("rejects invalid year and reimbursement rates", () => {
    expect(() =>
      buildBusinessYearReport([], "26", meta),
    ).toThrow();

    expect(() =>
      buildBusinessYearReport([], "2026", meta, -0.01),
    ).toThrow();

    expect(() =>
      buildBusinessYearReport([], "2026", meta, Number.NaN),
    ).toThrow();
  });
});
