import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
} from "drizzle-orm";

import {
  chargePoints,
  chargeSessions,
  places,
} from "@drivechronik/db";

import { db } from "./db";
import {
  buildLocationRanking,
  buildSlowAlerts,
  durationBetweenSoc,
  median,
} from "./chargeAnalyticsLogic";
import type {
  ChargeAnalyticsPoint,
  ChargeAnalyticsSession,
  LocationRanking,
  SlowChargeAlert,
} from "./chargeAnalyticsTypes";

export interface ChargeAnalyticsSessionResult
  extends ChargeAnalyticsSession {
  tenToEightySeconds: number | null;
  twentyToSixtySeconds: number | null;
}

export interface ChargeAnalyticsResult {
  sessions: ChargeAnalyticsSessionResult[];
  medianPeakKw: number | null;
  medianTenToEightySeconds: number | null;
  locationRanking: LocationRanking[];
  slowAlerts: SlowChargeAlert[];
}

export async function getChargingAnalytics(
  vehicleId: number,
  limit: 5 | 10,
): Promise<ChargeAnalyticsResult> {
  const rows = await db
    .select({
      id: chargeSessions.id,
      startTime: chargeSessions.startTime,
      endTime: chargeSessions.endTime,
      placeId: chargeSessions.placeId,
      placeName: places.name,
      address: chargeSessions.address,
      startSoc: chargeSessions.startSoc,
      endSoc: chargeSessions.endSoc,
      energyAddedKwh: chargeSessions.energyAddedKwh,
      maxPowerKw: chargeSessions.maxPowerKw,
      outsideTempAvg: chargeSessions.outsideTempAvg,
    })
    .from(chargeSessions)
    .leftJoin(places, eq(chargeSessions.placeId, places.id))
    .where(
      and(
        eq(chargeSessions.vehicleId, vehicleId),
        eq(chargeSessions.chargerType, "dc"),
        isNotNull(chargeSessions.endTime),
      ),
    )
    .orderBy(desc(chargeSessions.startTime))
    .limit(limit);

  if (rows.length === 0) {
    return {
      sessions: [],
      medianPeakKw: null,
      medianTenToEightySeconds: null,
      locationRanking: [],
      slowAlerts: [],
    };
  }

  const sessionIds = rows.map((row) => row.id);

  const pointRows = await db
    .select({
      chargeSessionId: chargePoints.chargeSessionId,
      ts: chargePoints.ts,
      powerKw: chargePoints.powerKw,
      soc: chargePoints.soc,
      outsideTemp: chargePoints.outsideTemp,
    })
    .from(chargePoints)
    .where(inArray(chargePoints.chargeSessionId, sessionIds))
    .orderBy(
      asc(chargePoints.chargeSessionId),
      asc(chargePoints.ts),
    );

  const pointsBySession = new Map<number, ChargeAnalyticsPoint[]>();

  for (const point of pointRows) {
    const list = pointsBySession.get(point.chargeSessionId) ?? [];

    list.push({
      ts: point.ts.getTime(),
      powerKw: point.powerKw,
      soc: point.soc,
      outsideTemp: point.outsideTemp,
    });

    pointsBySession.set(point.chargeSessionId, list);
  }

  const sessions: ChargeAnalyticsSession[] = rows.map((row) => ({
    id: row.id,
    startTime: row.startTime,
    // Durch isNotNull(endTime) oben garantiert.
    endTime: row.endTime!,
    placeId: row.placeId,
    placeName: row.placeName,
    address: row.address,
    startSoc: row.startSoc,
    endSoc: row.endSoc,
    energyAddedKwh: row.energyAddedKwh,
    maxPowerKw: row.maxPowerKw,
    outsideTempAvg: row.outsideTempAvg,
    points: pointsBySession.get(row.id) ?? [],
  }));

  const resultSessions: ChargeAnalyticsSessionResult[] =
    sessions.map((session) => ({
      ...session,
      tenToEightySeconds: durationBetweenSoc(
        session.points,
        10,
        80,
      ),
      twentyToSixtySeconds: durationBetweenSoc(
        session.points,
        20,
        60,
      ),
    }));

  const peakValues = sessions
    .map((session) => session.maxPowerKw)
    .filter((value): value is number => value != null);

  const tenToEightyValues = resultSessions
    .map((session) => session.tenToEightySeconds)
    .filter((value): value is number => value != null);

  return {
    sessions: resultSessions,
    medianPeakKw: median(peakValues),
    medianTenToEightySeconds: median(tenToEightyValues),
    locationRanking: buildLocationRanking(sessions),
    slowAlerts: buildSlowAlerts(sessions),
  };
}
