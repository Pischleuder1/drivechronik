import "server-only";

import {
  and,
  eq,
  gt,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import {
  chargeSessions,
  drives,
  vehicleStatePeriods,
} from "@drivechronik/db";

import { db } from "./db";
import {
  dayBounds,
  shiftDate,
  todayInAppTz,
} from "./day";
import {
  normalizeStatusIntervals,
  sumStatusDurations,
  type VehicleStatusInterval,
  type VehicleStatusKind,
  type VehicleStatusSegment,
} from "./vehicleStateTimelineLogic";

export interface VehicleStateTimelineDay {
  dateKey: string;
  startTime: Date;
  endTime: Date;
  segments: VehicleStatusSegment[];
  totals: Record<VehicleStatusKind, number>;
}

export interface VehicleStateTimelineResult {
  days: VehicleStateTimelineDay[];
  totals: Record<VehicleStatusKind, number>;
  sleepSharePercent: number | null;
  coveragePercent: number;
  trackedSeconds: number;
  periodSeconds: number;
}

function stateKind(
  state: string,
): VehicleStatusKind | null {
  if (
    state === "asleep" ||
    state === "online" ||
    state === "offline"
  ) {
    return state;
  }

  return null;
}

export async function getVehicleStateTimeline(
  vehicleId: number,
  days = 30,
): Promise<VehicleStateTimelineResult> {
  const safeDays = Math.max(1, Math.min(90, days));

  const today = todayInAppTz();
  const firstDate = shiftDate(today, -(safeDays - 1));

  const rangeStart = dayBounds(firstDate).start;
  const rangeEnd = dayBounds(today).end;

  const [states, driveRows, chargeRows] =
    await Promise.all([
      db
        .select({
          state: vehicleStatePeriods.state,
          startTime: vehicleStatePeriods.startTime,
          endTime: vehicleStatePeriods.endTime,
        })
        .from(vehicleStatePeriods)
        .where(
          and(
            eq(vehicleStatePeriods.vehicleId, vehicleId),
            lt(vehicleStatePeriods.startTime, rangeEnd),
            or(
              gt(vehicleStatePeriods.endTime, rangeStart),
              isNull(vehicleStatePeriods.endTime),
            ),
          ),
        ),

      db
        .select({
          startTime: drives.startTime,
          endTime: drives.endTime,
        })
        .from(drives)
        .where(
          and(
            eq(drives.vehicleId, vehicleId),
            lt(drives.startTime, rangeEnd),
            or(
              gt(drives.endTime, rangeStart),
              isNull(drives.endTime),
            ),
          ),
        ),

      db
        .select({
          startTime: chargeSessions.startTime,
          endTime: chargeSessions.endTime,
        })
        .from(chargeSessions)
        .where(
          and(
            eq(chargeSessions.vehicleId, vehicleId),
            lt(chargeSessions.startTime, rangeEnd),
            or(
              gt(chargeSessions.endTime, rangeStart),
              isNull(chargeSessions.endTime),
            ),
          ),
        ),
    ]);

  const intervals: VehicleStatusInterval[] = [];

  for (const row of states) {
    const kind = stateKind(row.state);
    if (!kind) continue;

    intervals.push({
      kind,
      startTime: row.startTime,
      endTime: row.endTime ?? rangeEnd,
    });
  }

  for (const row of driveRows) {
    intervals.push({
      kind: "driving",
      startTime: row.startTime,
      endTime: row.endTime ?? rangeEnd,
    });
  }

  for (const row of chargeRows) {
    intervals.push({
      kind: "charging",
      startTime: row.startTime,
      endTime: row.endTime ?? rangeEnd,
    });
  }

  const timelineDays: VehicleStateTimelineDay[] =
    Array.from({ length: safeDays }, (_, index) => {
      const dateKey = shiftDate(firstDate, index);
      const { start, end } = dayBounds(dateKey);

      const segments = normalizeStatusIntervals(
        intervals,
        start,
        end,
      );

      return {
        dateKey,
        startTime: start,
        endTime: end,
        segments,
        totals: sumStatusDurations(segments),
      };
    });

  const allSegments = timelineDays.flatMap(
    (day) => day.segments,
  );
  const totals = sumStatusDurations(allSegments);

  const trackedSeconds = Object.values(totals).reduce(
    (sum, seconds) => sum + seconds,
    0,
  );

  const periodSeconds =
    (rangeEnd.getTime() - rangeStart.getTime()) / 1000;

  return {
    days: timelineDays,
    totals,
    trackedSeconds,
    periodSeconds,
    sleepSharePercent:
      trackedSeconds > 0
        ? (totals.asleep / trackedSeconds) * 100
        : null,
    coveragePercent:
      periodSeconds > 0
        ? Math.min(
            100,
            (trackedSeconds / periodSeconds) * 100,
          )
        : 0,
  };
}
