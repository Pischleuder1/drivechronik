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
