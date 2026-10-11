export interface ChargingReachabilityInput {
  startSoc: number;
  capacityKwh: number;
  distanceKm: number;
  consumptionWhPerKm: number;
}

export function calculateChargingArrivalSoc(
  input: ChargingReachabilityInput,
): number {
  const energyNeededKwh =
    (input.distanceKm * input.consumptionWhPerKm) / 1000;

  return (
    input.startSoc -
    (energyNeededKwh / input.capacityKwh) * 100
  );
}

export function isChargingSiteReachable(
  input: ChargingReachabilityInput,
): boolean {
  if (
    !Number.isFinite(input.distanceKm) ||
    !Number.isFinite(input.consumptionWhPerKm) ||
    input.distanceKm < 0 ||
    input.consumptionWhPerKm <= 0 ||
    input.capacityKwh <= 0
  ) {
    return false;
  }

  return calculateChargingArrivalSoc(input) > 0;
}
