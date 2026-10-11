import { groupChargingLegs } from "./groupLegs";

export interface NonDrivingSegment {
  startM: number;
  endM: number;
}

export function getDrivingChargingLegs(
  legsM: number[],
  chargingIndices: number[],
  nonDriving: NonDrivingSegment[],
): number[] | null {
  const grouped = groupChargingLegs(legsM, chargingIndices);
  if (!grouped) return null;

  const totalM = grouped.reduce((a, b) => a + b, 0);
  const segments = [...nonDriving].sort((a, b) => a.startM - b.startM);

  let previousEnd = 0;
  for (const segment of segments) {
    if (!Number.isFinite(segment.startM) ||
        !Number.isFinite(segment.endM) ||
        segment.startM < previousEnd ||
        segment.endM <= segment.startM ||
        segment.endM > totalM + 1) return null;
    previousEnd = segment.endM;
  }

  let startM = 0;
  return grouped.map(distanceM => {
    const endM = startM + distanceM;
    const ferryM = segments.reduce((sum, segment) =>
      sum + Math.max(0,
        Math.min(endM, segment.endM) -
        Math.max(startM, segment.startM)), 0);
    startM = endM;
    return Math.max(0, distanceM - ferryM);
  });
}
