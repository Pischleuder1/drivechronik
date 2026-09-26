import { describe, expect, it } from "vitest";

import {
  buildRangeSamplePoints,
  calculateRangeBudgetKm,
  destinationPoint,
} from "./rangeMapLogic";

describe("calculateRangeBudgetKm", () => {
  it("subtracts the requested SoC reserve from the current rated range", () => {
    expect(
      calculateRangeBudgetKm({
        soc: 80,
        ratedRangeKm: 400,
        reserveSoc: 10,
      }),
    ).toBeCloseTo(350);
  });

  it("returns zero when the current SoC is already at the reserve", () => {
    expect(
      calculateRangeBudgetKm({
        soc: 10,
        ratedRangeKm: 50,
        reserveSoc: 10,
      }),
    ).toBe(0);
  });

  it("returns zero for unusable input", () => {
    expect(
      calculateRangeBudgetKm({
        soc: 0,
        ratedRangeKm: 0,
        reserveSoc: 10,
      }),
    ).toBe(0);
  });
});

describe("destinationPoint", () => {
  it("moves roughly 100 km north", () => {
    const point = destinationPoint(
      { lat: 52, lon: 8.5 },
      0,
      100,
    );

    expect(point.lat).toBeGreaterThan(52.8);
    expect(point.lat).toBeLessThan(53);
    expect(point.lon).toBeCloseTo(8.5, 1);
  });

  it("keeps coordinates unchanged at zero distance", () => {
    const point = destinationPoint(
      { lat: 52, lon: 8.5 },
      123,
      0,
    );

    expect(point.lat).toBeCloseTo(52);
    expect(point.lon).toBeCloseTo(8.5);
  });
});

describe("buildRangeSamplePoints", () => {
  it("creates 24 bearings with four rings by default", () => {
    const points = buildRangeSamplePoints(
      { lat: 52, lon: 8.5 },
      200,
    );

    expect(points).toHaveLength(96);

    const bearings = new Set(points.map((point) => point.bearingDeg));
    expect(bearings.size).toBe(24);
  });

  it("creates four samples for every bearing", () => {
    const points = buildRangeSamplePoints(
      { lat: 52, lon: 8.5 },
      200,
    );

    const north = points.filter((point) => point.bearingDeg === 0);

    expect(north.map((point) => point.ringFactor)).toEqual([
      0.4,
      0.65,
      0.9,
      1.1,
    ]);
  });

  it("returns no samples for an empty range budget", () => {
    expect(
      buildRangeSamplePoints(
        { lat: 52, lon: 8.5 },
        0,
      ),
    ).toEqual([]);
  });
});
