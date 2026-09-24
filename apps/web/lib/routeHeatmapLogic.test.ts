import { describe, expect, it } from "vitest";

import {
  aggregateTopRoutes,
  buildRouteHeatmap,
  haversineKm,
  type RouteHeatmapDrive,
} from "./routeHeatmapLogic";

function drive(
  driveId: number,
  points: Array<[number, number]>,
): RouteHeatmapDrive {
  return {
    driveId,
    points: points.map(([lat, lon]) => ({
      lat,
      lon,
    })),
  };
}

describe("routeHeatmapLogic", () => {
  it("calculates geographic distance", () => {
    const distance = haversineKm(
      { lat: 52.0, lon: 8.0 },
      { lat: 52.0, lon: 8.01 },
    );

    expect(distance).toBeGreaterThan(0.6);
    expect(distance).toBeLessThan(0.8);
  });

  it("creates heatmap segments for one drive", () => {
    const result = buildRouteHeatmap([
      drive(1, [
        [52.0, 8.0],
        [52.0, 8.005],
      ]),
    ]);

    expect(result.sourceDriveCount).toBe(1);
    expect(result.segments.length).toBeGreaterThan(1);
    expect(result.maxDriveCount).toBe(1);

    expect(
      result.segments.every(
        (segment) => segment.driveCount === 1,
      ),
    ).toBe(true);
  });

  it("combines nearby GPS traces on the same road", () => {
    const result = buildRouteHeatmap(
      [
        drive(1, [
          [52.0, 8.0],
          [52.0, 8.006],
        ]),
        drive(2, [
          [52.00002, 8.0],
          [52.00002, 8.006],
        ]),
      ],
      {
        cellSizeMeters: 40,
        sampleStepMeters: 20,
      },
    );

    expect(result.maxDriveCount).toBe(2);

    expect(
      result.segments.some(
        (segment) => segment.driveCount === 2,
      ),
    ).toBe(true);
  });

  it("treats both driving directions as the same segment", () => {
    const result = buildRouteHeatmap([
      drive(1, [
        [52.0, 8.0],
        [52.0, 8.005],
      ]),
      drive(2, [
        [52.0, 8.005],
        [52.0, 8.0],
      ]),
    ]);

    expect(result.maxDriveCount).toBe(2);

    expect(
      result.segments.some(
        (segment) => segment.driveCount === 2,
      ),
    ).toBe(true);
  });

  it("counts a segment only once per drive", () => {
    const result = buildRouteHeatmap([
      drive(1, [
        [52.0, 8.0],
        [52.0, 8.004],
        [52.0, 8.0],
        [52.0, 8.004],
      ]),
    ]);

    expect(result.maxDriveCount).toBe(1);

    expect(
      result.segments.every(
        (segment) => segment.driveCount === 1,
      ),
    ).toBe(true);
  });

  it("does not connect large GPS gaps with artificial segments", () => {
    const result = buildRouteHeatmap(
      [
        drive(1, [
          [52.0, 8.0],
          [52.1, 8.1],
        ]),
      ],
      {
        maxGapKm: 2,
      },
    );

    expect(result.sourceDriveCount).toBe(1);
    expect(result.segments).toHaveLength(0);
    expect(result.maxDriveCount).toBe(0);
  });

  it("ignores invalid and insufficient tracks", () => {
    const result = buildRouteHeatmap([
      drive(1, [[52.0, 8.0]]),
      {
        driveId: 2,
        points: [
          { lat: Number.NaN, lon: 8 },
          { lat: 52, lon: Number.NaN },
        ],
      },
    ]);

    expect(result.sourceDriveCount).toBe(0);
    expect(result.segments).toHaveLength(0);
  });
});


describe("aggregateTopRoutes", () => {
  it("combines both driving directions", () => {
    const result = aggregateTopRoutes([
      {
        startKey: "place:1",
        endKey: "place:2",
        startLabel: "Zuhause",
        endLabel: "Büro",
        distanceKm: 15,
      },
      {
        startKey: "place:2",
        endKey: "place:1",
        startLabel: "Büro",
        endLabel: "Zuhause",
        distanceKm: 16,
      },
    ]);

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({
      startLabel: "Zuhause",
      endLabel: "Büro",
      driveCount: 2,
      distanceKm: 31,
    });
  });

  it("sorts routes by number of drives", () => {
    const result = aggregateTopRoutes(
      [
        {
          startKey: "place:1",
          endKey: "place:2",
          startLabel: "Zuhause",
          endLabel: "Büro",
          distanceKm: 10,
        },
        {
          startKey: "place:1",
          endKey: "place:3",
          startLabel: "Zuhause",
          endLabel: "Kunde",
          distanceKm: 80,
        },
        {
          startKey: "place:3",
          endKey: "place:1",
          startLabel: "Kunde",
          endLabel: "Zuhause",
          distanceKm: 80,
        },
      ],
      1,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.driveCount).toBe(2);
    expect(result[0]!.endLabel).toBe(
      "Kunde",
    );
  });

  it("ignores incomplete route pairs", () => {
    const result = aggregateTopRoutes([
      {
        startKey: null,
        endKey: "place:2",
        startLabel: "—",
        endLabel: "Büro",
        distanceKm: 10,
      },
    ]);

    expect(result).toEqual([]);
  });
});
