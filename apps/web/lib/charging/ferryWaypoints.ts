import type { RoutePoint } from "./routeWaypoints";

const same = (a: RoutePoint, b: RoutePoint) =>
  a.lat === b.lat && a.lon === b.lon;

const distanceKm = (a: RoutePoint, b: RoutePoint) => {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad *
    Math.cos((a.lat + b.lat) * rad / 2);
  const y = (b.lat - a.lat) * rad;
  return 6371 * Math.hypot(x, y);
};

export function normalizeFerryWaypoints(
  points: RoutePoint[],
  portA: RoutePoint,
  portB: RoutePoint,
): RoutePoint[] | null {
  const first = points.findIndex(p => same(p, portA) || same(p, portB));
  if (first < 0) return null;

  const entry = points[first]!;
  const exit = same(entry, portA) ? portB : portA;
  const last = points.findIndex((p, i) => i > first && same(p, exit));
  if (last < 0) return null;

  const before: RoutePoint[] = [];
  const after: RoutePoint[] = [];

  for (const point of points.slice(first + 1, last)) {
    const d1 = distanceKm(point, entry);
    const d2 = distanceKm(point, exit);
    if (Math.min(d1, d2) > 20 || Math.abs(d1 - d2) < 1)
      return null;
    (d1 < d2 ? before : after).push(point);
  }

  return [
    ...points.slice(0, first),
    ...before,
    entry,
    exit,
    ...after,
    ...points.slice(last + 1),
  ];
}
