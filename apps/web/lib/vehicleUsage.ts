import { and, eq, gte, lt } from "drizzle-orm";
import { chargeSessions, drives } from "@drivechronik/db";
import { APP_TIMEZONE } from "./config";
import { dayBounds } from "./day";
import { db } from "./db";

export type VehicleUsagePeriod = "day" | "month" | "year" | "all";

export interface VehicleUsageSelection {
  period: VehicleUsagePeriod;
  value: string | null;
  start: Date | null;
  end: Date | null;
}

export interface VehicleUsageSummary {
  driveCount: number;
  distanceKm: number;
  durationSeconds: number;
  consumedEnergyKwh: number;
  avgConsumptionWhKm: number | null;
  energyEstimated: boolean;
  energyIncomplete: boolean;

  chargeCount: number;
  dcChargeCount: number;
  chargedEnergyKwh: number;
  chargeDurationSeconds: number;
  totalCostEur: number;
  avgPricePerKwh: number | null;
  costIncomplete: boolean;
}

function dateKeyInTimeZone(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not resolve current calendar date.");
  }

  return `${year}-${month}-${day}`;
}

export function currentVehicleUsageKeys() {
  const day = dateKeyInTimeZone();

  return {
    day,
    month: day.slice(0, 7),
    year: day.slice(0, 4),
  };
}

function validDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const check = new Date(Date.UTC(year, month - 1, day));

  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

function validMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;

  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function validYear(value: string): boolean {
  return /^\d{4}$/.test(value);
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number);

  const { start } = dayBounds(`${month}-01`);

  const nextYear = monthNumber === 12 ? year! + 1 : year!;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber! + 1;

  const { start: end } = dayBounds(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  );

  return { start, end };
}

function yearBounds(year: string): { start: Date; end: Date } {
  const { start } = dayBounds(`${year}-01-01`);
  const { start: end } = dayBounds(`${Number(year) + 1}-01-01`);

  return { start, end };
}

export function resolveVehicleUsageSelection(
  periodParam?: string,
  valueParam?: string,
): VehicleUsageSelection {
  const current = currentVehicleUsageKeys();

  const period: VehicleUsagePeriod =
    periodParam === "month" ||
    periodParam === "year" ||
    periodParam === "all"
      ? periodParam
      : "day";

  if (period === "all") {
    return {
      period,
      value: null,
      start: null,
      end: null,
    };
  }

  if (period === "month") {
    const value =
      valueParam && validMonth(valueParam)
        ? valueParam
        : current.month;

    const { start, end } = monthBounds(value);

    return { period, value, start, end };
  }

  if (period === "year") {
    const value =
      valueParam && validYear(valueParam)
        ? valueParam
        : current.year;

    const { start, end } = yearBounds(value);

    return { period, value, start, end };
  }

  const value =
    valueParam && validDay(valueParam)
      ? valueParam
      : current.day;

  const { start, end } = dayBounds(value);

  return {
    period: "day",
    value,
    start,
    end,
  };
}

export async function getVehicleUsageSummary(
  vehicleId: number,
  selection: VehicleUsageSelection,
): Promise<VehicleUsageSummary> {
  const driveConditions = [eq(drives.vehicleId, vehicleId)];
  const chargeConditions = [eq(chargeSessions.vehicleId, vehicleId)];

  if (selection.start && selection.end) {
    driveConditions.push(gte(drives.startTime, selection.start));
    driveConditions.push(lt(drives.startTime, selection.end));

    chargeConditions.push(gte(chargeSessions.startTime, selection.start));
    chargeConditions.push(lt(chargeSessions.startTime, selection.end));
  }

  const [driveRows, chargeRows] = await Promise.all([
    db
      .select({
        distanceKm: drives.distanceKm,
        durationSeconds: drives.durationSeconds,
        consumedEnergyKwh: drives.consumedEnergyKwh,
        energyIsEstimated: drives.energyIsEstimated,
      })
      .from(drives)
      .where(and(...driveConditions)),

    db
      .select({
        durationSeconds: chargeSessions.durationSeconds,
        energyAddedKwh: chargeSessions.energyAddedKwh,
        chargerType: chargeSessions.chargerType,
        cost: chargeSessions.cost,
        currency: chargeSessions.currency,
      })
      .from(chargeSessions)
      .where(and(...chargeConditions)),
  ]);

  let distanceKm = 0;
  let durationSeconds = 0;
  let consumedEnergyKwh = 0;
  let consumptionDistanceKm = 0;
  let consumptionEnergyKwh = 0;
  let energyEstimated = false;
  let energyIncomplete = false;

  for (const drive of driveRows) {
    if (drive.distanceKm != null && Number.isFinite(drive.distanceKm)) {
      distanceKm += drive.distanceKm;
    }

    if (
      drive.durationSeconds != null &&
      Number.isFinite(drive.durationSeconds)
    ) {
      durationSeconds += drive.durationSeconds;
    }

    if (
      drive.consumedEnergyKwh != null &&
      Number.isFinite(drive.consumedEnergyKwh)
    ) {
      consumedEnergyKwh += drive.consumedEnergyKwh;

      if (
        drive.distanceKm != null &&
        drive.distanceKm > 0
      ) {
        consumptionEnergyKwh += drive.consumedEnergyKwh;
        consumptionDistanceKm += drive.distanceKm;
      }
    } else {
      energyIncomplete = true;
    }

    if (drive.energyIsEstimated) {
      energyEstimated = true;
    }
  }

  let chargedEnergyKwh = 0;
  let chargeDurationSeconds = 0;
  let dcChargeCount = 0;
  let totalCostEur = 0;
  let energyWithKnownEurCostKwh = 0;
  let costIncomplete = false;

  for (const charge of chargeRows) {
    const energy =
      charge.energyAddedKwh != null &&
      Number.isFinite(charge.energyAddedKwh)
        ? charge.energyAddedKwh
        : null;

    if (energy != null) {
      chargedEnergyKwh += energy;
    }

    if (
      charge.durationSeconds != null &&
      Number.isFinite(charge.durationSeconds)
    ) {
      chargeDurationSeconds += charge.durationSeconds;
    }

    if (charge.chargerType === "dc") {
      dcChargeCount += 1;
    }

    if (charge.cost == null) {
      costIncomplete = true;
      continue;
    }

    const cost = Number(charge.cost);

    if (
      !Number.isFinite(cost) ||
      (charge.currency != null && charge.currency !== "EUR")
    ) {
      costIncomplete = true;
      continue;
    }

    totalCostEur += cost;

    if (energy != null && energy > 0) {
      energyWithKnownEurCostKwh += energy;
    }
  }

  return {
    driveCount: driveRows.length,
    distanceKm,
    durationSeconds,
    consumedEnergyKwh,
    avgConsumptionWhKm:
      consumptionDistanceKm > 0
        ? (consumptionEnergyKwh / consumptionDistanceKm) * 1000
        : null,
    energyEstimated,
    energyIncomplete,

    chargeCount: chargeRows.length,
    dcChargeCount,
    chargedEnergyKwh,
    chargeDurationSeconds,
    totalCostEur,
    avgPricePerKwh:
      energyWithKnownEurCostKwh > 0
        ? totalCostEur / energyWithKnownEurCostKwh
        : null,
    costIncomplete,
  };
}
