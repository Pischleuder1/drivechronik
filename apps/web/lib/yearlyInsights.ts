import "server-only";

import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  lt,
} from "drizzle-orm";

import {
  drives,
  places,
} from "@drivechronik/db";

import { APP_TIMEZONE } from "./config";
import { db } from "./db";
import { monthBounds } from "./exports/data";
import { buildYearlyInsights } from "./yearlyInsightsLogic";
import type {
  YearlyDrive,
  YearlyInsightsResult,
} from "./yearlyInsightsTypes";

/**
 * Liefert YYYY-MM-DD für einen Zeitpunkt in der konfigurierten
 * DriveChronik-Zeitzone. formatToParts vermeidet Abhängigkeiten
 * vom Ausgabeformat einer bestimmten Locale.
 */
function dateKeyInAppTimeZone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Lädt ausschließlich abgeschlossene Fahrten eines Fahrzeugs,
 * deren Startzeit im angegebenen Kalenderjahr in APP_TIMEZONE liegt.
 */
export async function getYearlyInsights(
  vehicleId: number,
  year: number,
): Promise<YearlyInsightsResult> {
  const start = monthBounds(`${year}-01`).start;
  const end = monthBounds(`${year + 1}-01`).start;

  const rows = await db
    .select({
      id: drives.id,
      startTime: drives.startTime,
      endTime: drives.endTime,
      distanceKm: drives.distanceKm,
      durationSeconds: drives.durationSeconds,
      classification: drives.classification,

      endPlaceId: drives.endPlaceId,
      endPlaceName: places.name,
      endAddress: drives.endAddress,
      endLat: drives.endLat,
      endLon: drives.endLon,
    })
    .from(drives)
    .leftJoin(places, eq(drives.endPlaceId, places.id))
    .where(
      and(
        eq(drives.vehicleId, vehicleId),
        gte(drives.startTime, start),
        lt(drives.startTime, end),
        isNotNull(drives.endTime),
      ),
    )
    .orderBy(asc(drives.startTime));

  const yearlyDrives: YearlyDrive[] = rows.map((row) => {
    const dateKey = dateKeyInAppTimeZone(row.startTime);

    return {
      id: row.id,
      dateKey,
      monthKey: dateKey.slice(0, 7),
      startTime: row.startTime,
      // Durch isNotNull() in der Query garantiert.
      endTime: row.endTime!,
      distanceKm: row.distanceKm,
      durationSeconds: row.durationSeconds,
      classification: row.classification,

      endPlaceId: row.endPlaceId,
      endPlaceName: row.endPlaceName,
      endAddress: row.endAddress,
      endLat: row.endLat,
      endLon: row.endLon,
    };
  });

  return buildYearlyInsights(year, yearlyDrives);
}
