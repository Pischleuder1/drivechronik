import { describe, expect, it } from "vitest";

import {
  buildRangeBoundary,
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


describe("buildRangeBoundary", () => {
  it("interpolates between the last reachable and first unreachable ring", () => {
    const origin = { lat: 52, lon: 8.5 };
    const samples = buildRangeSamplePoints(
      origin,
      100,
      4,
      [0.5, 0.75, 1],
    );

    const distances = samples.flatMap((_, index) => {
      const ringIndex = index % 3;
      return [60, 90, 130][ringIndex]!;
    });

    const boundary = buildRangeBoundary(
      origin,
      100,
      samples,
      distances,
    );

    expect(boundary).toHaveLength(4);

    for (const point of boundary) {
      expect(point.ringFactor).toBeCloseTo(0.8125);
    }

    const expectedNorth = destinationPoint(origin, 0, 81.25);

    expect(boundary[0]!.lat).toBeCloseTo(expectedNorth.lat, 6);
    expect(boundary[0]!.lon).toBeCloseTo(expectedNorth.lon, 6);
  });

  it("interpolates from the vehicle when even the innermost point is too far", () => {
    const origin = { lat: 52, lon: 8.5 };
    const samples = buildRangeSamplePoints(
      origin,
      100,
      4,
      [0.5],
    );

    const boundary = buildRangeBoundary(
      origin,
      100,
      samples,
      [200, 200, 200, 200],
    );

    expect(boundary).toHaveLength(4);

    for (const point of boundary) {
      expect(point.ringFactor).toBeCloseTo(0.25);
    }
  });

  it("falls back to the vehicle position when a direction is unreachable", () => {
    const origin = { lat: 52, lon: 8.5 };
    const samples = buildRangeSamplePoints(
      origin,
      100,
      4,
      [0.5],
    );

    const boundary = buildRangeBoundary(
      origin,
      100,
      samples,
      [null, 50, 50, 50],
    );

    expect(boundary[0]).toMatchObject({
      lat: origin.lat,
      lon: origin.lon,
      bearingDeg: 0,
      ringFactor: 0,
    });
  });

  it("rejects mismatching sample and distance counts", () => {
    const origin = { lat: 52, lon: 8.5 };
    const samples = buildRangeSamplePoints(origin, 100, 4, [0.5]);

    expect(
      buildRangeBoundary(
        origin,
        100,
        samples,
        [50],
      ),
    ).toEqual([]);
  });
});
