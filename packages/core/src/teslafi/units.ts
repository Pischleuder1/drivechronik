export type TeslaFiDistanceUnit =
  | "metric"
  | "imperial";

const MILES_TO_KM = 1.609344;

export function teslaFiOdometerToKm(
  value: number | null,
  unit: TeslaFiDistanceUnit,
): number | null {
  if (value == null) return null;

  return unit === "imperial"
    ? value * MILES_TO_KM
    : value;
}

export function teslaFiSpeedToKmh(
  value: number | null,
  unit: TeslaFiDistanceUnit,
): number | null {
  if (value == null) return null;

  return unit === "imperial"
    ? value * MILES_TO_KM
    : value;
}
