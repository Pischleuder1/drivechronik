export function groupChargingLegs(
  legDistancesM: number[],
  chargingWaypointIndices: number[],
): number[] | null {
  if (legDistancesM.some(d => !Number.isFinite(d) || d <= 0))
    return null;

  const result: number[] = [];
  let start = 0;

  for (const index of [...chargingWaypointIndices, legDistancesM.length]) {
    if (!Number.isInteger(index) || index <= start ||
        index > legDistancesM.length)
      return null;

    result.push(
      legDistancesM.slice(start, index)
        .reduce((sum, distance) => sum + distance, 0),
    );
    start = index;
  }

  return result;
}
