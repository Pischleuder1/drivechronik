import type { ReportDrive } from "./types.js";

export interface MonthSealIdentity {
  vehicleId: number;
  driverName: string;
  licensePlate: string | null;
  vehicleDisplayName: string;
  vehicleVin: string | null;
}

export interface MonthSealDrive {
  id: number;
  startTime: string;
  endTime: string | null;
  startPlaceName: string | null;
  endPlaceName: string | null;
  startAddress: string | null;
  endAddress: string | null;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  classification: ReportDrive["classification"];
  purpose: string | null;
  customer: string | null;
  project: string | null;
  notes: string | null;
  tags: string[];
}

export interface MonthSealContent {
  schemaVersion: 1;
  month: string;
  identity: MonthSealIdentity;
  drives: MonthSealDrive[];
}

export function createMonthSealContent(
  month: string,
  identity: MonthSealIdentity,
  drives: ReportDrive[],
): MonthSealContent {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Month must use YYYY-MM format.");
  }

  const driverName = identity.driverName.trim();
  if (!driverName) {
    throw new Error("Driver name is required for a month seal.");
  }

  const sorted = [...drives].sort(
    (a, b) =>
      a.startTime.getTime() - b.startTime.getTime() ||
      a.id - b.id,
  );

  return {
    schemaVersion: 1,
    month,
    identity: {
      vehicleId: identity.vehicleId,
      driverName,
      licensePlate: identity.licensePlate?.trim() || null,
      vehicleDisplayName: identity.vehicleDisplayName,
      vehicleVin: identity.vehicleVin,
    },
    drives: sorted.map((drive) => ({
      id: drive.id,
      startTime: drive.startTime.toISOString(),
      endTime: drive.endTime?.toISOString() ?? null,
      startPlaceName: drive.startPlaceName,
      endPlaceName: drive.endPlaceName,
      startAddress: drive.startAddress,
      endAddress: drive.endAddress,
      startLat: drive.startLat,
      startLon: drive.startLon,
      endLat: drive.endLat,
      endLon: drive.endLon,
      startOdometerKm: drive.startOdometerKm,
      endOdometerKm: drive.endOdometerKm,
      distanceKm: drive.distanceKm,
      durationSeconds: drive.durationSeconds,
      classification: drive.classification,
      purpose: drive.purpose,
      customer: drive.customer,
      project: drive.project,
      notes: drive.notes,
      tags: [...drive.tags].sort(),
    })),
  };
}

export function monthSealTotals(content: MonthSealContent): {
  driveCount: number;
  distanceKm: number;
} {
  return {
    driveCount: content.drives.length,
    distanceKm: content.drives.reduce(
      (sum, drive) => sum + (drive.distanceKm ?? 0),
      0,
    ),
  };
}

/**
 * Rekonstruiert die für Reports benötigten Fahrtdaten ausschließlich aus
 * einem gespeicherten Monats-Snapshot.
 *
 * Energie-/Verbrauchswerte sind bewusst nicht Bestandteil des versiegelten
 * Fahrtenbuchinhalts und werden deshalb nicht nachträglich ergänzt.
 */
export function monthSealContentToReportDrives(
  content: MonthSealContent,
): ReportDrive[] {
  return content.drives.map((drive) => ({
    id: drive.id,
    startTime: new Date(drive.startTime),
    endTime:
      drive.endTime != null
        ? new Date(drive.endTime)
        : null,
    startPlaceName: drive.startPlaceName,
    endPlaceName: drive.endPlaceName,
    startAddress: drive.startAddress,
    endAddress: drive.endAddress,
    startLat: drive.startLat,
    startLon: drive.startLon,
    endLat: drive.endLat,
    endLon: drive.endLon,
    startOdometerKm: drive.startOdometerKm,
    endOdometerKm: drive.endOdometerKm,
    distanceKm: drive.distanceKm,
    durationSeconds: drive.durationSeconds,
    consumedEnergyKwh: null,
    energyIsEstimated: false,
    avgConsumptionWhKm: null,
    classification: drive.classification,
    purpose: drive.purpose,
    customer: drive.customer,
    project: drive.project,
    notes: drive.notes,
    tags: [...drive.tags],
  }));
}
