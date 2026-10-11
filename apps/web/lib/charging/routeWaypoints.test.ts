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

describe("Reihenfolge der Schnelllader", () => {
  it("setzt den ersten Schnelllader vor weitere Ladestopps", () => {
    const geometry: [number, number][] = [
      [52.27, 8.66],
      [52.5, 8.7],
      [53.0, 9.0],
    ];

    const stops = [
      { lat: 53.0, lon: 9.0, routeDistanceKm: 100 },
      { lat: 52.28, lon: 8.67, routeDistanceKm: 0.85 },
    ];

    const result = mergeRouteWaypoints([], stops, geometry);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ lat: 52.28, lon: 8.67 });
    expect(result[1]).toEqual({ lat: 53.0, lon: 9.0 });
  });
});

describe("Virtuelle Fähre Sassnitz–Rønne", () => {
  it("ordnet den Schnelllader vor dem Fährhafen ein", () => {
    const sassnitz = { lat: 54.486071, lon: 13.587807 };
    const mukran = { lat: 54.511852, lon: 13.628776 };
    const ronne = { lat: 55.099583, lon: 14.692352 };

    const geometry: [number, number][] = [
      [54.1, 13.2],
      [mukran.lat, mukran.lon],
      [sassnitz.lat, sassnitz.lon],
      [ronne.lat, ronne.lon],
      [55.15, 14.8],
    ];

    const result = mergeRouteWaypoints(
      [sassnitz, ronne],
      [{ ...mukran, routeDistanceKm: 999 }],
      geometry,
      true,
    );

    expect(result).toEqual([mukran, sassnitz, ronne]);
  });
});
