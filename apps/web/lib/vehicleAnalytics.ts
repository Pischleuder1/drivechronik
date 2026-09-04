import "server-only";

import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  chargeSessions,
  parkSessions,
  vehicleMetrics,
} from "@drivechronik/db";
import { db } from "./db";
import {
  buildDailyVehicleMetrics,
  calculateChargingEfficiency,
  calculateVampireDrain,
  estimateBatteryHealth,
  odometerDelta,
  projectedRangeAt100Percent,
} from "./vehicleAnalyticsLogic";

export interface VehicleAnalyticsResult {
  battery: {
    usableCapacityKwh: number | null;
    baselineCapacityKwh: number | null;
    degradationPercent: number | null;
    sampleCount: number;
  };
  range: {
    currentRatedRangeKm: number | null;
    projectedRange100Km: number | null;
  };
  odometer: {
    currentKm: number | null;
    delta30DaysKm: number | null;
  };
  charging: {
    efficiencyPercent: number | null;
    energyAddedKwh: number;
    energyUsedKwh: number;
    sessionCount: number;
    acSessionCount: number;
    dcSessionCount: number;
  };
  vampireDrain: {
    socLossPer24h: number | null;
    ratedRangeLossPer24hKm: number | null;
    sampleCount: number;
  };
  history: ReturnType<typeof buildDailyVehicleMetrics>;
}

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function getVehicleAnalytics(
  vehicleId: number,
): Promise<VehicleAnalyticsResult> {
  const [metricRows, chargingRows, parkRows] = await Promise.all([
    db
      .select({
        ts: vehicleMetrics.ts,
        soc: vehicleMetrics.soc,
        ratedRangeKm: vehicleMetrics.ratedRangeKm,
        odometerKm: vehicleMetrics.odometerKm,
      })
      .from(vehicleMetrics)
      .where(eq(vehicleMetrics.vehicleId, vehicleId))
      .orderBy(asc(vehicleMetrics.ts)),

    db
      .select({
        startTime: chargeSessions.startTime,
        endTime: chargeSessions.endTime,
        startSoc: chargeSessions.startSoc,
        endSoc: chargeSessions.endSoc,
        energyAddedKwh: chargeSessions.energyAddedKwh,
        energyUsedKwh: chargeSessions.energyUsedKwh,
        chargerType: chargeSessions.chargerType,
      })
      .from(chargeSessions)
      .where(eq(chargeSessions.vehicleId, vehicleId))
      .orderBy(desc(chargeSessions.startTime)),

    db
      .select({
        startTime: parkSessions.startTime,
        endTime: parkSessions.endTime,
        durationSeconds: parkSessions.durationSeconds,
      })
      .from(parkSessions)
      .where(
        and(
          eq(parkSessions.vehicleId, vehicleId),
          isNotNull(parkSessions.endTime),
        ),
      )
      .orderBy(desc(parkSessions.startTime)),
  ]);

  const history = buildDailyVehicleMetrics(metricRows);
  const latest = metricRows.at(-1) ?? null;

  const battery = estimateBatteryHealth(chargingRows);

  const charging = calculateChargingEfficiency(
    chargingRows.map((session) => ({
      energyAddedKwh: session.energyAddedKwh,
      energyUsedKwh: session.energyUsedKwh,
      chargerType: session.chargerType,
    })),
  );

  const completedCharges = chargingRows.filter(
    (
      session,
    ): session is typeof session & { endTime: Date } =>
      session.endTime != null,
  );

  const vampireDrain = calculateVampireDrain(
    parkRows
      .filter(
        (
          park,
        ): park is typeof park & { endTime: Date } =>
          park.endTime != null,
      )
      .map((park) => ({
        startTime: park.startTime,
        endTime: park.endTime,
        durationSeconds: park.durationSeconds,
        hasCharging: completedCharges.some((charge) =>
          overlaps(
            park.startTime,
            park.endTime,
            charge.startTime,
            charge.endTime,
          ),
        ),
      })),
    metricRows,
  );

  return {
    battery,
    range: {
      currentRatedRangeKm: latest?.ratedRangeKm ?? null,
      projectedRange100Km: projectedRangeAt100Percent(
        latest?.soc ?? null,
        latest?.ratedRangeKm ?? null,
      ),
    },
    odometer: {
      currentKm: latest?.odometerKm ?? null,
      delta30DaysKm: odometerDelta(metricRows, 30),
    },
    charging,
    vampireDrain,
    history,
  };
}
