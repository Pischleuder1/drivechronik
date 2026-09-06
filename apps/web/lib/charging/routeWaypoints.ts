export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface PositionedRoutePoint extends RoutePoint {
  routeDistanceKm: number;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}

function cumulativeRouteDistances(
  geometry: [number, number][],
): number[] {
  const cumulativeKm: number[] = [0];

  for (let i = 1; i < geometry.length; i += 1) {
    const previous = geometry[i - 1]!;
    const current = geometry[i]!;

    cumulativeKm.push(
      cumulativeKm[i - 1]! +
        haversineKm(
          previous[0],
          previous[1],
          current[0],
          current[1],
        ),
    );
  }

  return cumulativeKm;
}

export function locatePointAlongRoute(
  point: RoutePoint,
  geometry: [number, number][],
  startIndex = 0,
): {
  routeDistanceKm: number;
  index: number;
} | null {
  if (geometry.length < 2) return null;

  const cumulativeKm = cumulativeRouteDistances(geometry);

  let bestIndex = -1;
  let bestDistanceKm = Number.POSITIVE_INFINITY;

  for (
    let i = Math.max(0, startIndex);
    i < geometry.length;
    i += 1
  ) {
    const current = geometry[i]!;

    const distanceKm = haversineKm(
      point.lat,
      point.lon,
      current[0],
      current[1],
    );

    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) return null;

  return {
    routeDistanceKm: cumulativeKm[bestIndex]!,
    index: bestIndex,
  };
}

export function mergeRouteWaypoints(
  manualWaypoints: RoutePoint[],
  chargingStops: PositionedRoutePoint[],
  geometry: [number, number][],
): RoutePoint[] {
  const positionedManual: Array<{
    point: RoutePoint;
    routeDistanceKm: number;
  }> = [];

  let searchStartIndex = 0;

  for (const point of manualWaypoints) {
    const positioned = locatePointAlongRoute(
      point,
      geometry,
      searchStartIndex,
    );

    if (!positioned) continue;

    positionedManual.push({
      point,
      routeDistanceKm: positioned.routeDistanceKm,
    });

    searchStartIndex = positioned.index;
  }

  const combined = [
    ...positionedManual.map(({ point, routeDistanceKm }) => ({
      point,
      routeDistanceKm,
      priority: 0,
    })),
    ...chargingStops.map((stop) => ({
      point: { lat: stop.lat, lon: stop.lon },
      routeDistanceKm: stop.routeDistanceKm,
      priority: 1,
    })),
  ];

  combined.sort(
    (a, b) =>
      a.routeDistanceKm - b.routeDistanceKm ||
      a.priority - b.priority,
  );

  return combined.map(({ point }) => point);
}
