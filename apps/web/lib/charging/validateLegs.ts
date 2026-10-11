export interface ChargingLegStop {
  arrivalSoc: number;
  departureSoc: number;
}

export function validateChargingLegs(
  legDistancesM: number[],
  stops: ChargingLegStop[],
  startSoc: number,
  capacityKwh: number,
  totalEnergyKwh: number,
  targetSoc: number,
): boolean {
  const validSoc = (value: number) =>
    Number.isFinite(value) && value >= 0 && value <= 100;

  if (!validSoc(startSoc) || !validSoc(targetSoc) ||
      !Number.isFinite(capacityKwh) ||
      !Number.isFinite(totalEnergyKwh) ||
      stops.some(stop =>
        !validSoc(stop.arrivalSoc) ||
        !validSoc(stop.departureSoc) ||
        stop.departureSoc < stop.arrivalSoc
      ) ||
      legDistancesM.length !== stops.length + 1 ||
      capacityKwh <= 0 || totalEnergyKwh < 0 ||
      legDistancesM.some(d => !Number.isFinite(d) || d <= 0))
    return false;

  const totalKm = legDistancesM.reduce((a, b) => a + b, 0) / 1000;
  if (totalKm <= 0) return false;

  let soc = startSoc;
  for (let i = 0; i < legDistancesM.length; i++) {
    soc -= totalEnergyKwh * (legDistancesM[i]! / 1000) /
      totalKm / capacityKwh * 100;
    if (soc <= 0) return false;
    if (i < stops.length) {
      const stop = stops[i]!;
      if (Math.abs(soc - stop.arrivalSoc) > 1 ||
          stop.departureSoc < soc || stop.departureSoc > 100)
        return false;
      soc = stop.departureSoc;
    }
  }
  return soc >= targetSoc - 0.1;
}
