import {
  DEFAULT_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM,
} from "./month.js";
import type { ReportDrive, ReportMeta } from "./types.js";

export interface BusinessYearMonth {
  /** Kalendermonat YYYY-MM. */
  month: string;
  /** Anzahl geschäftlicher Fahrten im Monat. */
  driveCount: number;
  /** Summe der bekannten geschäftlichen Kilometer. */
  distanceKm: number;
  /** Auf Cent gerundete Erstattung des Monats. */
  amountEur: number;
  /** true, falls mindestens einer Business-Fahrt die Distanz fehlt. */
  incomplete: boolean;
}

export interface BusinessYearTotals {
  driveCount: number;
  distanceKm: number;
  amountEur: number;
}

export interface BusinessYearReport {
  year: string;
  months: BusinessYearMonth[];
  totals: BusinessYearTotals;
  rateEurPerKm: number;
  incomplete: boolean;
  meta: ReportMeta;
}

function monthKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  if (year == null || month == null) {
    throw new Error("Could not determine local calendar month.");
  }

  return `${year}-${month}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Baut eine Jahresabrechnung ausschließlich für geschäftliche Fahrten.
 *
 * Fahrten werden anhand ihrer Startzeit in der Zeitzone aus ReportMeta einem
 * Kalendermonat zugeordnet. Private Fahrten, Arbeitswege und unklassifizierte
 * Fahrten werden ignoriert.
 *
 * Der Jahresbetrag ist die Summe der auf Cent gerundeten Monatsbeträge, damit
 * Jahres- und Monatsabrechnungen exakt miteinander übereinstimmen.
 */
export function buildBusinessYearReport(
  drives: ReportDrive[],
  year: string,
  meta: ReportMeta,
  rateEurPerKm =
    DEFAULT_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM,
  classifications: ReportDrive["classification"][] = ["business"],
): BusinessYearReport {
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Year must use YYYY format.");
  }

  if (!Number.isFinite(rateEurPerKm) || rateEurPerKm < 0) {
    throw new Error(
      "Business reimbursement rate must be a non-negative number.",
    );
  }

  const months: BusinessYearMonth[] = Array.from(
    { length: 12 },
    (_, index) => ({
      month: `${year}-${String(index + 1).padStart(2, "0")}`,
      driveCount: 0,
      distanceKm: 0,
      amountEur: 0,
      incomplete: false,
    }),
  );

  const selectedClassifications = new Set(classifications);
  const businessDistanceByMonth = Array.from(
    { length: 12 },
    () => 0,
  );

  for (const drive of drives) {
    if (!selectedClassifications.has(drive.classification)) continue;

    const monthKey = monthKeyInTimeZone(
      drive.startTime,
      meta.timeZone,
    );

    if (!monthKey.startsWith(`${year}-`)) continue;

    const monthIndex = Number(monthKey.slice(5, 7)) - 1;
    const bucket = months[monthIndex];

    if (bucket == null) continue;

    bucket.driveCount += 1;

    if (drive.distanceKm != null) {
      bucket.distanceKm += drive.distanceKm;

      if (drive.classification === "business") {
        businessDistanceByMonth[monthIndex] += drive.distanceKm;
      }
    } else {
      bucket.incomplete = true;
    }
  }

  months.forEach((month, index) => {
    month.amountEur = roundCurrency(
      businessDistanceByMonth[index]! * rateEurPerKm,
    );
  });

  const totals: BusinessYearTotals = {
    driveCount: months.reduce(
      (sum, month) => sum + month.driveCount,
      0,
    ),
    distanceKm: months.reduce(
      (sum, month) => sum + month.distanceKm,
      0,
    ),
    amountEur: roundCurrency(
      months.reduce((sum, month) => sum + month.amountEur, 0),
    ),
  };

  return {
    year,
    months,
    totals,
    rateEurPerKm,
    incomplete: months.some((month) => month.incomplete),
    meta,
  };
}
