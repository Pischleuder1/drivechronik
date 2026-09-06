import { describe, expect, it } from "vitest";

import { mergeRouteWaypoints } from "./routeWaypoints";

describe("mergeRouteWaypoints", () => {
  it("sorts manual waypoints and charging stops by route position", () => {
    const geometry: [number, number][] = [
      [52.0, 8.0],
      [52.1, 8.1],
      [52.2, 8.2],
      [52.3, 8.3],
      [52.4, 8.4],
      [52.5, 8.5],
    ];

    const result = mergeRouteWaypoints(
      [
        { lat: 52.2, lon: 8.2 },
        { lat: 52.4, lon: 8.4 },
      ],
      [
        {
          lat: 52.1,
          lon: 8.1,
          routeDistanceKm: 13,
        },
        {
          lat: 52.3,
          lon: 8.3,
          routeDistanceKm: 39,
        },
      ],
      geometry,
    );

    expect(result).toEqual([
      { lat: 52.1, lon: 8.1 },
      { lat: 52.2, lon: 8.2 },
      { lat: 52.3, lon: 8.3 },
      { lat: 52.4, lon: 8.4 },
    ]);
  });

  it("keeps manual waypoint order on looping routes", () => {
    const geometry: [number, number][] = [
      [52.0, 8.0],
      [52.1, 8.1],
      [52.2, 8.2],
      [52.3, 8.3],
      [52.2, 8.2],
      [52.1, 8.1],
      [52.0, 8.0],
    ];

    const result = mergeRouteWaypoints(
      [
        { lat: 52.2, lon: 8.2 },
        { lat: 52.1, lon: 8.1 },
      ],
      [
        {
          lat: 52.25,
          lon: 8.25,
          routeDistanceKm: 45,
        },
      ],
      geometry,
    );

    expect(result).toEqual([
      { lat: 52.2, lon: 8.2 },
      { lat: 52.25, lon: 8.25 },
      { lat: 52.1, lon: 8.1 },
    ]);
  });
});
