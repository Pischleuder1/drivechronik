import type { ChargingStopSelection } from "./planner";
import type { PlannedChargingStop } from "./types";

export function combineChargingStops(
  first: PlannedChargingStop,
  next: ChargingStopSelection,
): ChargingStopSelection {
  const stops = [first, ...next.stops];

  return {
    stop: first,
    stops,
    chargingNeeded: true,
    planningComplete: next.planningComplete,
    plannedArrivalSoc: next.plannedArrivalSoc,
    targetArrivalSoc: next.targetArrivalSoc,
  };
}
