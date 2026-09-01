import { buildDriveReport, type DriveReport } from "./drive.js";
import type { Classification, ReportDrive, ReportMeta } from "./types.js";

const ALL_CLASSIFICATIONS: Classification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

/**
 * Default für die dienstliche Kilometererstattung.
 *
 * Bewusst als eigener Core-Wert geführt, damit der Satz später aus einer
 * Einstellung kommen kann, ohne die Report-Struktur erneut ändern zu müssen.
 */
export const DEFAULT_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM = 0.3;

export interface ClassificationTotals {
  classification: Classification;
  driveCount: number;
  distanceKm: number;
}

export interface MonthReportTotals {
  driveCount: number;
  distanceKm: number;
}

export interface BusinessReimbursement {
  /** Ob "business" Teil des aktuellen Report-Filters ist. */
  applicable: boolean;
  /** Summe der bekannten geschäftlichen Kilometer. */
  distanceKm: number;
  /** Verwendeter Erstattungssatz in EUR pro Kilometer. */
  rateEurPerKm: number;
  /** Auf Cent gerundeter Erstattungsbetrag. */
  amountEur: number;
  /** true, falls mindestens einer geschäftlichen Fahrt die Distanz fehlt. */
  incomplete: boolean;
}

export interface MonthReport {
  month: string; // YYYY-MM
  rows: DriveReport[];
  /** Summen pro Klassifizierung, gemäß vision.md §20.3. */
  byClassification: Record<Classification, ClassificationTotals>;
  /** Gesamtsumme über alle (gefilterten) Fahrten. */
  totals: MonthReportTotals;
  /** Dienstliche Kilometererstattung für die im Report enthaltenen Business-Fahrten. */
  businessReimbursement: BusinessReimbursement;
  /** true, falls mindestens einer Fahrt die Distanz fehlte (geht mit 0 km in die Summe ein). */
  hasIncompleteData: boolean;
  meta: ReportMeta;
}

/**
 * Baut den Monatsreport gemäß vision.md §20.3 (Business-Nachweis über einen
 * Monat, gruppiert nach Klassifizierung). `filter` schränkt optional auf
 * bestimmte Klassifizierungen ein (Default: alle). Fahrten ohne Distanz
 * zählen weiterhin in driveCount, tragen aber 0 km zur Summe bei und setzen
 * `hasIncompleteData`.
 *
 * `businessReimbursementRateEurPerKm` ist bewusst ein Parameter mit Default,
 * damit der Satz später konfigurierbar gemacht werden kann.
 */
export function buildMonthReport(
  drives: ReportDrive[],
  month: string,
  meta: ReportMeta,
  filter?: Classification[],
  businessReimbursementRateEurPerKm =
    DEFAULT_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM,
): MonthReport {
  if (
    !Number.isFinite(businessReimbursementRateEurPerKm) ||
    businessReimbursementRateEurPerKm < 0
  ) {
    throw new Error("Business reimbursement rate must be a non-negative number.");
  }

  const allowed = filter != null ? new Set(filter) : null;

  const filtered = drives.filter(
    (drive) => allowed === null || allowed.has(drive.classification),
  );

  const sorted = [...filtered].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  const rows = sorted.map((drive) => buildDriveReport(drive, meta));

  const byClassification: Record<Classification, ClassificationTotals> =
    Object.fromEntries(
      ALL_CLASSIFICATIONS.map((classification) => [
        classification,
        { classification, driveCount: 0, distanceKm: 0 },
      ]),
    ) as Record<Classification, ClassificationTotals>;

  let hasIncompleteData = false;
  let businessDistanceIncomplete = false;

  for (const drive of sorted) {
    const bucket = byClassification[drive.classification];
    bucket.driveCount += 1;

    if (drive.distanceKm != null) {
      bucket.distanceKm += drive.distanceKm;
    } else {
      hasIncompleteData = true;

      if (drive.classification === "business") {
        businessDistanceIncomplete = true;
      }
    }
  }

  const totals: MonthReportTotals = {
    driveCount: sorted.length,
    distanceKm: ALL_CLASSIFICATIONS.reduce(
      (sum, classification) =>
        sum + byClassification[classification].distanceKm,
      0,
    ),
  };

  const businessApplicable =
    allowed === null || allowed.has("business");

  const businessDistanceKm =
    byClassification.business.distanceKm;

  const businessReimbursement: BusinessReimbursement = {
    applicable: businessApplicable,
    distanceKm: businessDistanceKm,
    rateEurPerKm: businessReimbursementRateEurPerKm,
    amountEur:
      Math.round(
        businessDistanceKm *
          businessReimbursementRateEurPerKm *
          100,
      ) / 100,
    incomplete: businessDistanceIncomplete,
  };

  return {
    month,
    rows,
    byClassification,
    totals,
    businessReimbursement,
    hasIncompleteData,
    meta,
  };
}
