export interface RouteHeatmapPoint {
  lat: number;
  lon: number;
}

export interface RouteHeatmapDrive {
  driveId: number;
  points: RouteHeatmapPoint[];
}

export interface RouteHeatmapSegment {
  key: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;

  /**
   * Anzahl unterschiedlicher Fahrten, die diesen Rasterabschnitt
   * mindestens einmal benutzt haben.
   */
  driveCount: number;
}

export interface RouteHeatmapResult {
  segments: RouteHeatmapSegment[];
  maxDriveCount: number;
  sourceDriveCount: number;
}

export interface RouteHeatmapOptions {
  /**
   * Kantenlänge des geografischen Rasters.
   * 40 m ist klein genug für Straßen, toleriert aber normales GPS-Rauschen.
   */
  cellSizeMeters?: number;

  /**
   * Zwischenschritte zwischen TeslaMate-GPS-Punkten.
   * Verhindert, dass unterschiedliche Sampling-Intervalle dieselbe Straße
   * in völlig unterschiedliche Segmente zerlegen.
   */
  sampleStepMeters?: number;

  /**
   * Größere GPS-Lücken werden nicht mit einer künstlichen Geraden verbunden.
   */
  maxGapKm?: number;
}

interface GridDefinition {
  latStep: number;
  lonStep: number;
}

interface GridCell {
  key: string;
  x: number;
  y: number;
  lat: number;
  lon: number;
}

interface CanonicalSegment {
  key: string;
  from: GridCell;
  to: GridCell;
}

const EARTH_RADIUS_KM = 6371;

const DEFAULT_CELL_SIZE_METERS = 40;
const DEFAULT_SAMPLE_STEP_METERS = 20;
const DEFAULT_MAX_GAP_KM = 2;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function validPoint(point: RouteHeatmapPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

export function haversineKm(
  a: RouteHeatmapPoint,
  b: RouteHeatmapPoint,
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.asin(Math.min(1, Math.sqrt(h)))
  );
}

function buildGrid(
  drives: RouteHeatmapDrive[],
  cellSizeMeters: number,
): GridDefinition {
  const latitudes = drives.flatMap((drive) =>
    drive.points
      .filter(validPoint)
      .map((point) => point.lat),
  );

  const referenceLat =
    latitudes.length > 0
      ? latitudes.reduce((sum, value) => sum + value, 0) /
        latitudes.length
      : 51;

  const metersPerDegreeLat = 111_320;

  const metersPerDegreeLon = Math.max(
    1,
    111_320 * Math.cos(toRad(referenceLat)),
  );

  return {
    latStep: cellSizeMeters / metersPerDegreeLat,
    lonStep: cellSizeMeters / metersPerDegreeLon,
  };
}

function cellForPoint(
  point: RouteHeatmapPoint,
  grid: GridDefinition,
): GridCell {
  const y = Math.round(point.lat / grid.latStep);
  const x = Math.round(point.lon / grid.lonStep);

  return {
    key: `${y}:${x}`,
    x,
    y,
    lat: y * grid.latStep,
    lon: x * grid.lonStep,
  };
}

function canonicalSegment(
  first: GridCell,
  second: GridCell,
): CanonicalSegment | null {
  if (first.key === second.key) {
    return null;
  }

  /*
   * Richtung bewusst ignorieren:
   * A -> B und B -> A sollen dieselbe Straßenbelegung ergeben.
   */
  if (first.key < second.key) {
    return {
      key: `${first.key}|${second.key}`,
      from: first,
      to: second,
    };
  }

  return {
    key: `${second.key}|${first.key}`,
    from: second,
    to: first,
  };
}

function sampledCells(
  from: RouteHeatmapPoint,
  to: RouteHeatmapPoint,
  grid: GridDefinition,
  sampleStepMeters: number,
): GridCell[] {
  const distanceMeters = haversineKm(from, to) * 1000;

  const steps = Math.max(
    1,
    Math.ceil(distanceMeters / sampleStepMeters),
  );

  const cells: GridCell[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;

    const point = {
      lat: from.lat + (to.lat - from.lat) * ratio,
      lon: from.lon + (to.lon - from.lon) * ratio,
    };

    const cell = cellForPoint(point, grid);

    if (cells.at(-1)?.key !== cell.key) {
      cells.push(cell);
    }
  }

  return cells;
}

/**
 * Baut eine richtungsunabhängige, GPS-rauschtolerante Segmentbelegung.
 *
 * Wichtig:
 * - gleiche Straße in Gegenrichtung = gleicher Heatmap-Abschnitt
 * - ein Abschnitt zählt je Fahrt höchstens einmal
 * - kleine GPS-Abweichungen werden über ein Meter-Raster normalisiert
 * - größere Aufzeichnungslücken werden nicht künstlich verbunden
 */
export function buildRouteHeatmap(
  drives: RouteHeatmapDrive[],
  options: RouteHeatmapOptions = {},
): RouteHeatmapResult {
  const cellSizeMeters =
    options.cellSizeMeters ?? DEFAULT_CELL_SIZE_METERS;

  const sampleStepMeters =
    options.sampleStepMeters ?? DEFAULT_SAMPLE_STEP_METERS;

  const maxGapKm =
    options.maxGapKm ?? DEFAULT_MAX_GAP_KM;

  if (
    cellSizeMeters <= 0 ||
    sampleStepMeters <= 0 ||
    maxGapKm <= 0
  ) {
    throw new Error(
      "Route heatmap dimensions must be greater than zero.",
    );
  }

  const grid = buildGrid(drives, cellSizeMeters);

  const aggregated = new Map<
    string,
    RouteHeatmapSegment
  >();

  let sourceDriveCount = 0;

  for (const drive of drives) {
    const points = drive.points.filter(validPoint);

    if (points.length < 2) {
      continue;
    }

    sourceDriveCount += 1;

    /*
     * Pro Fahrt nur einmal zählen.
     * Eine Schleife oder ein U-Turn darf einen Abschnitt also nicht
     * künstlich heißer machen als eine zweite echte Fahrt.
     */
    const segmentsInDrive = new Map<
      string,
      CanonicalSegment
    >();

    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1]!;
      const to = points[index]!;

      const distanceKm = haversineKm(from, to);

      if (
        distanceKm <= 0 ||
        distanceKm > maxGapKm
      ) {
        continue;
      }

      const cells = sampledCells(
        from,
        to,
        grid,
        sampleStepMeters,
      );

      for (
        let cellIndex = 1;
        cellIndex < cells.length;
        cellIndex += 1
      ) {
        const segment = canonicalSegment(
          cells[cellIndex - 1]!,
          cells[cellIndex]!,
        );

        if (segment) {
          segmentsInDrive.set(segment.key, segment);
        }
      }
    }

    for (const segment of segmentsInDrive.values()) {
      const existing = aggregated.get(segment.key);

      if (existing) {
        existing.driveCount += 1;
        continue;
      }

      aggregated.set(segment.key, {
        key: segment.key,
        fromLat: segment.from.lat,
        fromLon: segment.from.lon,
        toLat: segment.to.lat,
        toLon: segment.to.lon,
        driveCount: 1,
      });
    }
  }

  const segments = [...aggregated.values()].sort(
    (a, b) =>
      b.driveCount - a.driveCount ||
      a.key.localeCompare(b.key),
  );

  return {
    segments,
    maxDriveCount:
      segments.length > 0
        ? segments[0]!.driveCount
        : 0,
    sourceDriveCount,
  };
}


export interface RouteHeatmapRouteInput {
  startKey: string | null;
  endKey: string | null;

  startLabel: string;
  endLabel: string;

  distanceKm: number | null;
}

export interface RouteHeatmapTopRoute {
  startLabel: string;
  endLabel: string;

  driveCount: number;
  distanceKm: number;
}

/**
 * Fasst gleiche Start-/Ziel-Paare zusammen.
 *
 * Die Richtung wird bewusst ignoriert:
 *
 *   Zuhause -> Büro
 *   Büro -> Zuhause
 *
 * gehören zur selben häufig gefahrenen Strecke.
 */
export function aggregateTopRoutes(
  rows: RouteHeatmapRouteInput[],
  limit = 5,
): RouteHeatmapTopRoute[] {
  const routes = new Map<
    string,
    RouteHeatmapTopRoute
  >();

  for (const row of rows) {
    if (
      !row.startKey ||
      !row.endKey ||
      row.startKey === row.endKey
    ) {
      continue;
    }

    const forward =
      row.startKey.localeCompare(
        row.endKey,
      ) <= 0;

    const firstKey =
      forward
        ? row.startKey
        : row.endKey;

    const secondKey =
      forward
        ? row.endKey
        : row.startKey;

    const key =
      `${firstKey}|${secondKey}`;

    const startLabel =
      forward
        ? row.startLabel
        : row.endLabel;

    const endLabel =
      forward
        ? row.endLabel
        : row.startLabel;

    const existing =
      routes.get(key);

    if (existing) {
      existing.driveCount += 1;

      existing.distanceKm +=
        row.distanceKm ?? 0;

      continue;
    }

    routes.set(key, {
      startLabel,
      endLabel,

      driveCount: 1,
      distanceKm:
        row.distanceKm ?? 0,
    });
  }

  return [...routes.values()]
    .sort(
      (a, b) =>
        b.driveCount -
          a.driveCount ||
        b.distanceKm -
          a.distanceKm ||
        a.startLabel.localeCompare(
          b.startLabel,
        ),
    )
    .slice(
      0,
      Math.max(
        0,
        Math.floor(limit),
      ),
    );
}
