import { describe, expect, it } from "vitest";
import {
  calculateChargingArrivalSoc,
  isChargingSiteReachable,
} from "./reachability";

describe("Ladestation bei niedrigem SoC erreichen", () => {
  const base = {
    startSoc: 3,
    capacityKwh: 62,
    consumptionWhPerKm: 142,
  };

  it("erreicht einen Schnelllader nach 2 km", () => {
    expect(
      isChargingSiteReachable({ ...base, distanceKm: 2 }),
    ).toBe(true);
  });

  it("erreicht einen Schnelllader nach 10 km", () => {
    expect(
      isChargingSiteReachable({ ...base, distanceKm: 10 }),
    ).toBe(true);
  });

  it("erreicht einen Schnelllader nach 15 km nicht", () => {
    expect(
      isChargingSiteReachable({ ...base, distanceKm: 15 }),
    ).toBe(false);
  });

  it("berechnet den Ankunfts-SoC korrekt", () => {
    expect(
      calculateChargingArrivalSoc({
        ...base,
        distanceKm: 2,
      }),
    ).toBeCloseTo(2.54, 1);
  });

  it("verwirft negative Entfernungen", () => {
    expect(
      isChargingSiteReachable({ ...base, distanceKm: -1 }),
    ).toBe(false);
  });
});
