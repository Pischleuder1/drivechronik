export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface RangeSamplePoint extends GeoPoint {
  bearingDeg: number;
  ringFactor: number;
}

export interface RangeBudgetInput {
  soc: number;
  ratedRangeKm: number;
  reserveSoc: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function toDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeLon(lon: number): number {
  return ((lon + 540) % 360) - 180;
}

/**
 * Verbleibendes Straßenkilometer-Budget unter Beibehaltung einer SoC-Reserve.
 *
 * ratedRangeKm ist die vom Fahrzeug für den aktuellen SoC gemeldete
 * Restreichweite. Deshalb wird nur der Anteil oberhalb der Reserve verwendet.
 */
export function calculateRangeBudgetKm({
  soc,
  ratedRangeKm,
  reserveSoc,
}: RangeBudgetInput): number {
  if (
    !Number.isFinite(soc) ||
    !Number.isFinite(ratedRangeKm) ||
    !Number.isFinite(reserveSoc)
  ) {
    return 0;
  }

  if (soc <= 0 || ratedRangeKm <= 0) {
    return 0;
  }

  const safeSoc = Math.min(100, Math.max(0, soc));
  const safeReserve = Math.min(100, Math.max(0, reserveSoc));

  if (safeSoc <= safeReserve) {
    return 0;
  }

  return ratedRangeKm * ((safeSoc - safeReserve) / safeSoc);
}

/**
 * Zielpunkt auf einer Großkreislinie.
 */
export function destinationPoint(
  origin: GeoPoint,
  bearingDeg: number,
  distanceKm: number,
): GeoPoint {
  const angularDistance = Math.max(0, distanceKm) / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);

  const lat1 = toRad(origin.lat);
  const lon1 = toRad(origin.lon);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const lat2 = Math.asin(
    sinLat1 * cosAngular +
      cosLat1 * sinAngular * Math.cos(bearing),
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * sinAngular * cosLat1,
      cosAngular - sinLat1 * Math.sin(lat2),
    );

  return {
    lat: toDeg(lat2),
    lon: normalizeLon(toDeg(lon2)),
  };
}

const DEFAULT_BEARING_COUNT = 24;
const DEFAULT_RING_FACTORS = [0.4, 0.65, 0.9, 1.1] as const;

/**
 * Kandidaten für die OSRM-Table-Abfrage.
 *
 * Die äußere Stufe liegt bewusst außerhalb des rechnerischen Straßenbudgets.
 * Da Straßenentfernung normalerweise >= Luftlinie ist, liefert sie einen
 * sinnvollen äußeren Grenzpunkt für die spätere Interpolation.
 */
export function buildRangeSamplePoints(
  origin: GeoPoint,
  rangeBudgetKm: number,
  bearingCount = DEFAULT_BEARING_COUNT,
  ringFactors: readonly number[] = DEFAULT_RING_FACTORS,
): RangeSamplePoint[] {
  if (
    !Number.isFinite(rangeBudgetKm) ||
    rangeBudgetKm <= 0 ||
    !Number.isInteger(bearingCount) ||
    bearingCount < 4
  ) {
    return [];
  }

  const points: RangeSamplePoint[] = [];

  for (let index = 0; index < bearingCount; index += 1) {
    const bearingDeg = (360 / bearingCount) * index;

    for (const ringFactor of ringFactors) {
      if (!Number.isFinite(ringFactor) || ringFactor <= 0) {
        continue;
      }

      const point = destinationPoint(
        origin,
        bearingDeg,
        rangeBudgetKm * ringFactor,
      );

      points.push({
        ...point,
        bearingDeg,
        ringFactor,
      });
    }
  }

  return points;
}


export interface RangeBoundaryPoint extends GeoPoint {
  bearingDeg: number;
  ringFactor: number;
}

/**
 * Ermittelt aus den radialen Testpunkten und den von OSRM gelieferten
 * Straßenentfernungen je Richtung einen Grenzpunkt.
 *
 * Zwischen dem letzten erreichbaren und dem ersten nicht mehr erreichbaren
 * Testpunkt wird linear interpoliert. Existiert kein erreichbarer Testpunkt,
 * wird zwischen Ursprung (0 km) und dem ersten gültigen OSRM-Punkt interpoliert.
 *
 * `null` bedeutet: OSRM konnte diesen Zielpunkt nicht über das Straßennetz
 * erreichen. Gibt es für eine Richtung überhaupt keine gültige Distanz,
 * fällt die Grenze für diese Richtung auf den Fahrzeugstandort zurück.
 */
export function buildRangeBoundary(
  origin: GeoPoint,
  rangeBudgetKm: number,
  samples: readonly RangeSamplePoint[],
  roadDistancesKm: readonly (number | null)[],
): RangeBoundaryPoint[] {
  if (
    !Number.isFinite(rangeBudgetKm) ||
    rangeBudgetKm <= 0 ||
    samples.length === 0 ||
    samples.length !== roadDistancesKm.length
  ) {
    return [];
  }

  const byBearing = new Map<
    number,
    Array<{
      sample: RangeSamplePoint;
      roadDistanceKm: number | null;
    }>
  >();

  samples.forEach((sample, index) => {
    const distance = roadDistancesKm[index];
    const roadDistanceKm =
      distance != null && Number.isFinite(distance) && distance >= 0
        ? distance
        : null;

    const rows = byBearing.get(sample.bearingDeg) ?? [];
    rows.push({ sample, roadDistanceKm });
    byBearing.set(sample.bearingDeg, rows);
  });

  const boundary: RangeBoundaryPoint[] = [];

  for (const [bearingDeg, rows] of [...byBearing.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    rows.sort((a, b) => a.sample.ringFactor - b.sample.ringFactor);

    const valid = rows.filter(
      (
        row,
      ): row is {
        sample: RangeSamplePoint;
        roadDistanceKm: number;
      } => row.roadDistanceKm != null,
    );

    if (valid.length === 0) {
      boundary.push({
        ...origin,
        bearingDeg,
        ringFactor: 0,
      });
      continue;
    }

    const reachable = valid.filter(
      (row) => row.roadDistanceKm <= rangeBudgetKm,
    );

    let boundaryFactor: number;

    if (reachable.length === 0) {
      const first = valid[0]!;
      boundaryFactor =
        first.roadDistanceKm > 0
          ? first.sample.ringFactor *
            Math.min(1, rangeBudgetKm / first.roadDistanceKm)
          : 0;
    } else {
      const lower = reachable[reachable.length - 1]!;
      const upper = valid.find(
        (row) =>
          row.sample.ringFactor > lower.sample.ringFactor &&
          row.roadDistanceKm > rangeBudgetKm,
      );

      if (!upper) {
        boundaryFactor = lower.sample.ringFactor;
      } else {
        const roadDelta = upper.roadDistanceKm - lower.roadDistanceKm;

        if (roadDelta <= 0) {
          boundaryFactor = lower.sample.ringFactor;
        } else {
          const fraction = Math.min(
            1,
            Math.max(
              0,
              (rangeBudgetKm - lower.roadDistanceKm) / roadDelta,
            ),
          );

          boundaryFactor =
            lower.sample.ringFactor +
            (upper.sample.ringFactor - lower.sample.ringFactor) * fraction;
        }
      }
    }

    const point = destinationPoint(
      origin,
      bearingDeg,
      rangeBudgetKm * boundaryFactor,
    );

    boundary.push({
      ...point,
      bearingDeg,
      ringFactor: boundaryFactor,
    });
  }

  return boundary;
}
