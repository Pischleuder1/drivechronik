export type VehicleStatusKind =
  | "asleep"
  | "online"
  | "offline"
  | "driving"
  | "charging";

export interface VehicleStatusInterval {
  kind: VehicleStatusKind;
  startTime: Date;
  endTime: Date;
}

export type VehicleStatusSegment = VehicleStatusInterval;

const PRIORITY: Record<VehicleStatusKind, number> = {
  offline: 1,
  asleep: 2,
  online: 3,
  driving: 4,
  charging: 5,
};

export function normalizeStatusIntervals(
  intervals: VehicleStatusInterval[],
  windowStart: Date,
  windowEnd: Date,
): VehicleStatusSegment[] {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();

  if (endMs <= startMs) return [];

  const clipped = intervals
    .map((interval) => ({
      ...interval,
      startMs: Math.max(startMs, interval.startTime.getTime()),
      endMs: Math.min(endMs, interval.endTime.getTime()),
    }))
    .filter((interval) => interval.endMs > interval.startMs);

  if (clipped.length === 0) return [];

  const boundaries = new Set<number>([startMs, endMs]);

  for (const interval of clipped) {
    boundaries.add(interval.startMs);
    boundaries.add(interval.endMs);
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const result: VehicleStatusSegment[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;

    if (b <= a) continue;

    const midpoint = a + (b - a) / 2;

    const active = clipped.filter(
      (interval) =>
        interval.startMs <= midpoint &&
        interval.endMs > midpoint,
    );

    if (active.length === 0) continue;

    const winner = active.reduce((best, current) =>
      PRIORITY[current.kind] > PRIORITY[best.kind]
        ? current
        : best,
    );

    const previous = result[result.length - 1];

    if (
      previous &&
      previous.kind === winner.kind &&
      previous.endTime.getTime() === a
    ) {
      previous.endTime = new Date(b);
    } else {
      result.push({
        kind: winner.kind,
        startTime: new Date(a),
        endTime: new Date(b),
      });
    }
  }

  return result;
}

export function sumStatusDurations(
  segments: VehicleStatusSegment[],
): Record<VehicleStatusKind, number> {
  const totals: Record<VehicleStatusKind, number> = {
    asleep: 0,
    online: 0,
    offline: 0,
    driving: 0,
    charging: 0,
  };

  for (const segment of segments) {
    totals[segment.kind] += Math.max(
      0,
      (segment.endTime.getTime() -
        segment.startTime.getTime()) /
        1000,
    );
  }

  return totals;
}
