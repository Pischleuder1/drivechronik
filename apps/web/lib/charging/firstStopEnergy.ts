export interface FirstStopEnergyInput {
  startSoc: number;
  capacityKwh: number;
  drivingDistanceKm: number;
  firstStopDistanceKm: number;
  totalEnergyKwh: number;
  targetArrivalSoc: number;
}

export function calculateFirstStopEnergy(input: FirstStopEnergyInput) {
  const {
    startSoc, capacityKwh, drivingDistanceKm,
    firstStopDistanceKm, totalEnergyKwh, targetArrivalSoc,
  } = input;

  if (
    capacityKwh <= 0 || drivingDistanceKm <= 0 ||
    firstStopDistanceKm <= 0 ||
    firstStopDistanceKm >= drivingDistanceKm ||
    totalEnergyKwh <= 0
  ) return null;

  const energyPerKm = totalEnergyKwh / drivingDistanceKm;
  const arrivalSoc = startSoc -
    firstStopDistanceKm * energyPerKm / capacityKwh * 100;
  const departureSoc = targetArrivalSoc +
    (drivingDistanceKm - firstStopDistanceKm) *
    energyPerKm / capacityKwh * 100;

  return {
    arrivalSoc,
    departureSoc,
    feasible: arrivalSoc > 0 && departureSoc <= 90,
  };
}
