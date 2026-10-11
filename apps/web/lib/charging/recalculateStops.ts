export interface RecalculatedStop {
  arrivalSoc: number;
  departureSoc: number;
}

export function recalculateStops(
  drivingLegsM: number[],
  startSoc: number,
  capacityKwh: number,
  energyKwh: number,
  targetSoc: number,
): RecalculatedStop[] | null {
  if (
    drivingLegsM.length < 2 ||
    drivingLegsM.some(d => !Number.isFinite(d) || d <= 0) ||
    !Number.isFinite(startSoc) || startSoc <= 0 || startSoc > 100 ||
    !Number.isFinite(targetSoc) || targetSoc < 0 || targetSoc > 100 ||
    !Number.isFinite(capacityKwh) || capacityKwh <= 0 ||
    !Number.isFinite(energyKwh) || energyKwh < 0
  ) return null;

  const totalM = drivingLegsM.reduce((a, b) => a + b, 0);
  const consumption = energyKwh / capacityKwh * 100 / totalM;
  const stops: RecalculatedStop[] = [];
  let soc = startSoc;

  for (let i = 0; i < drivingLegsM.length; i++) {
    soc -= drivingLegsM[i]! * consumption;

    const reserve = i === drivingLegsM.length - 1
      ? targetSoc : i === 0 && startSoc < 10 ? 0 : 10;

    if (soc < reserve - 0.01 || soc <= 0) return null;
    if (i === drivingLegsM.length - 1) break;

    const nextReserve = i === drivingLegsM.length - 2
      ? targetSoc : 10;
    const required = drivingLegsM[i + 1]! * consumption + nextReserve;
    const departure = i === drivingLegsM.length - 2
      ? Math.max(soc, required)
      : Math.max(soc, 80, required);

    if (departure > 90 || departure - soc < 0.5) return null;

    stops.push({
      arrivalSoc: soc,
      departureSoc: departure,
    });
    soc = departure;
  }

  return stops;
}
