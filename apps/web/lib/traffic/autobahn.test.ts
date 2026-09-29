import { describe, expect, it } from "vitest";

import {
  positionPointOnRoute,
  positionTrafficGeometryOnRoute,
} from "./autobahn";

describe("autobahn traffic route matching", () => {
  const route: [number, number][] = [
    [8.0, 52.0],
    [9.0, 52.0],
  ];

  it("positions a nearby event along the route", () => {
    const position = positionPointOnRoute(
      [8.5, 52.005],
      route,
    );

    expect(position).not.toBeNull();

    expect(position!.distanceToRouteKm).toBeLessThan(1);
    expect(position!.routeDistanceKm).toBeGreaterThan(30);
    expect(position!.routeDistanceKm).toBeLessThan(40);
  });

  it("recognizes a far event as far away", () => {
    const position = positionPointOnRoute(
      [8.5, 52.1],
      route,
    );

    expect(position).not.toBeNull();
    expect(position!.distanceToRouteKm).toBeGreaterThan(10);
  });

  it("uses the closest point of an event geometry", () => {
    const position = positionTrafficGeometryOnRoute(
      [
        [8.2, 52.02],
        [8.5, 52.001],
        [8.8, 52.02],
      ],
      route,
    );

    expect(position).not.toBeNull();
    expect(position!.distanceToRouteKm).toBeLessThan(0.2);
  });

  it("returns null for an empty event geometry", () => {
    expect(
      positionTrafficGeometryOnRoute([], route),
    ).toBeNull();
  });
});
