import "server-only";

import { eq } from "drizzle-orm";

import {
  DEFAULT_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM,
} from "@drivechronik/core";
import { settings } from "@drivechronik/db";

import { db } from "./db";
import { parseBusinessReimbursementRate } from "./appSettingsLogic";

export const BUSINESS_REIMBURSEMENT_RATE_KEY =
  "business_reimbursement_rate_eur_per_km";

export async function getBusinessReimbursementRateEurPerKm(): Promise<number> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, BUSINESS_REIMBURSEMENT_RATE_KEY))
    .limit(1);

  return (
    parseBusinessReimbursementRate(rows[0]?.value) ??
    DEFAULT_BUSINESS_REIMBURSEMENT_RATE_EUR_PER_KM
  );
}

export const DRIVER_NAME_KEY = "driver_name";

export function driverNameSettingKey(vehicleId: number): string {
  return `${DRIVER_NAME_KEY}_vehicle_${vehicleId}`;
}

/**
 * Fahrername eines Fahrzeugs.
 *
 * Bestehende Installationen besitzen ggf. nur den früheren globalen
 * `driver_name`-Eintrag. Dieser bleibt als Fallback erhalten, bis für das
 * jeweilige Fahrzeug erstmals ein eigener Fahrername gespeichert wurde.
 */
export async function getDriverName(vehicleId?: number): Promise<string> {
  if (vehicleId != null) {
    const vehicleRows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, driverNameSettingKey(vehicleId)))
      .limit(1);

    if (typeof vehicleRows[0]?.value === "string") {
      return vehicleRows[0].value;
    }
  }

  const legacyRows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, DRIVER_NAME_KEY))
    .limit(1);

  return typeof legacyRows[0]?.value === "string"
    ? legacyRows[0].value
    : "";
}

