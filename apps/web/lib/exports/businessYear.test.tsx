import { describe, expect, it } from "vitest";

import {
  buildBusinessYearReport,
  type ReportDrive,
  type ReportMeta,
} from "@drivechronik/core";

import {
  renderBusinessYearCsv,
  renderBusinessYearPdf,
  type BusinessYearExportLabels,
} from "./businessYear";

const meta: ReportMeta = {
  vehicleName: "Model Y",
  generatedAt: new Date("2026-12-31T12:00:00Z"),
  timeZone: "Europe/Berlin",
};

const labels: BusinessYearExportLabels = {
  locale: "de-DE",
  title: (year) => `DriveChronik — Dienstfahrten ${year}`,
  vehicle: "Fahrzeug",
  month: "Monat",
  drives: "Fahrten",
  distance: "Geschäftliche Kilometer",
  rate: "Erstattungssatz",
  amount: "Erstattungsbetrag",
  total: "Gesamt",
  incomplete: "Unvollständige Distanzdaten.",
  roundingNote:
    "Die Jahreserstattung entspricht der Summe der Monatserstattungen.",
  footer: (date) => `Erstellt am ${date} · DriveChronik`,
};

function drive(
  startTime: string,
  distanceKm: number | null,
): ReportDrive {
  return {
    startTime: new Date(startTime),
    distanceKm,
    classification: "business",
  } as ReportDrive;
}

describe("business year exports", () => {
  it("renders the annual reimbursement as CSV", () => {
    const report = buildBusinessYearReport(
      [
        drive("2026-01-10T08:00:00Z", 100),
        drive("2026-02-10T08:00:00Z", 50),
      ],
      "2026",
      meta,
      0.3,
    );

    const csv = renderBusinessYearCsv(report, labels);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("DriveChronik — Dienstfahrten 2026");
    expect(csv).toContain("Januar;1;100,0;30,00");
    expect(csv).toContain("Februar;1;50,0;15,00");
    expect(csv).toContain("Gesamt;2;150,0;45,00");
  });

  it("marks incomplete mileage data in CSV", () => {
    const report = buildBusinessYearReport(
      [
        drive("2026-03-10T08:00:00Z", 25),
        drive("2026-03-11T08:00:00Z", null),
      ],
      "2026",
      meta,
      0.3,
    );

    const csv = renderBusinessYearCsv(report, labels);

    expect(report.incomplete).toBe(true);
    expect(csv).toContain("Unvollständige Distanzdaten.");
  });

  it("renders a real PDF document", async () => {
    const report = buildBusinessYearReport(
      [drive("2026-01-10T08:00:00Z", 100)],
      "2026",
      meta,
      0.3,
    );

    const pdf = await renderBusinessYearPdf(report, labels);

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
