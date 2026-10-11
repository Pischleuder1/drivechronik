import { describe, expect, it } from "vitest";
import { calculateFirstStopEnergy } from "./firstStopEnergy";

describe("Erster Schnelllader bei niedrigem SoC", () => {
  it("plant Hüllhorst nach Minden", () => {
    const result = calculateFirstStopEnergy({
      startSoc: 3,
      capacityKwh: 62,
      drivingDistanceKm: 21.8,
      firstStopDistanceKm: 0.8508,
      totalEnergyKwh: 3.0,
      targetArrivalSoc: 20,
    });

    expect(result).not.toBeNull();
    expect(result!.feasible).toBe(true);
    expect(result!.arrivalSoc).toBeCloseTo(2.81, 1);
    expect(result!.departureSoc).toBeCloseTo(24.65, 1);
  });

  it("lehnt einen einzelnen Ladestopp bei zu langer Fahrt ab", () => {
    const result = calculateFirstStopEnergy({
      startSoc: 3,
      capacityKwh: 62,
      drivingDistanceKm: 500,
      firstStopDistanceKm: 1,
      totalEnergyKwh: 90,
      targetArrivalSoc: 20,
    });

    expect(result!.feasible).toBe(false);
    expect(result!.departureSoc).toBeGreaterThan(90);
  });

  it("lehnt einen unerreichbaren ersten Ladestopp ab", () => {
    const result = calculateFirstStopEnergy({
      startSoc: 3,
      capacityKwh: 62,
      drivingDistanceKm: 100,
      firstStopDistanceKm: 20,
      totalEnergyKwh: 20,
      targetArrivalSoc: 20,
    });

    expect(result!.feasible).toBe(false);
    expect(result!.arrivalSoc).toBeLessThan(0);
  });
});
