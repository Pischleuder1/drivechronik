import "server-only";

import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  notInArray,
} from "drizzle-orm";

import {
  drives,
  places,
  routePoints,
} from "@drivechronik/db";

import { db } from "./db";
import { todayInAppTz } from "./day";
import { monthBounds } from "./exports/data";

import {
  aggregateTopRoutes,
  buildRouteHeatmap,
  type RouteHeatmapDrive,
  type RouteHeatmapSegment,
  type RouteHeatmapTopRoute,
} from "./routeHeatmapLogic";

export type RouteHeatmapRange =
  | "30d"
  | "year"
  | "all";

export type RouteHeatmapFilter =
  | "business"
  | "private"
  | "other";

export interface RouteHeatmapData {
  segments: RouteHeatmapSegment[];
  maxDriveCount: number;

  driveCount: number;
  gpsDriveCount: number;
  gpsPointCount: number;

  distanceKm: number;
  durationSeconds: number;

  topRoutes: RouteHeatmapTopRoute[];

  year: number;
}

function rangeBounds(
  range: RouteHeatmapRange,
): {
  start?: Date;
  end?: Date;
  year: number;
} {
  const year = Number(
    todayInAppTz().slice(0, 4),
  );

  if (range === "30d") {
    return {
      start: new Date(
        Date.now() -
          30 *
            24 *
            60 *
            60 *
            1000,
      ),
      year,
    };
  }

  if (range === "year") {
    return {
      start:
        monthBounds(
          `${year}-01`,
        ).start,

      end:
        monthBounds(
          `${year + 1}-01`,
        ).start,

      year,
    };
  }

  return { year };
}

function endpointKey(
  placeId: number | null,
  address: string | null,
): string | null {
  if (placeId != null) {
    return `place:${placeId}`;
  }

  const normalized =
    address
      ?.trim()
      .toLowerCase();

  if (normalized) {
    return `address:${normalized}`;
  }

  return null;
}

function endpointLabel(
  placeId: number | null,
  address: string | null,
  placeNames: Map<number, string>,
): string {
  if (placeId != null) {
    const name =
      placeNames.get(placeId);

    if (name) {
      return name;
    }
  }

  return (
    address?.trim() ||
    "—"
  );
}

export async function getRouteHeatmapData(
  vehicleId: number,
  range: RouteHeatmapRange,
  filter: RouteHeatmapFilter,
): Promise<RouteHeatmapData> {
  const bounds =
    rangeBounds(range);

  const conditions = [
    eq(
      drives.vehicleId,
      vehicleId,
    ),
    isNotNull(drives.endTime),
  ];

  if (bounds.start) {
    conditions.push(
      gte(
        drives.startTime,
        bounds.start,
      ),
    );
  }

  if (bounds.end) {
    conditions.push(
      lt(
        drives.startTime,
        bounds.end,
      ),
    );
  }

  if (filter === "business") {
    conditions.push(
      eq(
        drives.classification,
        "business",
      ),
    );
  }

  if (filter === "private") {
    conditions.push(
      eq(
        drives.classification,
        "private",
      ),
    );
  }


  if (filter === "other") {
    conditions.push(
      notInArray(
        drives.classification,
        ["business", "private"],
      ),
    );
  }


  const driveRows = await db
    .select({
      id: drives.id,

      distanceKm:
        drives.distanceKm,

      durationSeconds:
        drives.durationSeconds,

      startPlaceId:
        drives.startPlaceId,

      endPlaceId:
        drives.endPlaceId,

      startAddress:
        drives.startAddress,

      endAddress:
        drives.endAddress,
    })
    .from(drives)
    .leftJoin(
      places,
      eq(
        drives.endPlaceId,
        places.id,
      ),
    )
    .where(
      and(...conditions),
    )
    .orderBy(
      asc(drives.startTime),
    );

  if (driveRows.length === 0) {
    return {
      segments: [],
      maxDriveCount: 0,

      driveCount: 0,
      gpsDriveCount: 0,
      gpsPointCount: 0,

      distanceKm: 0,
      durationSeconds: 0,

      topRoutes: [],

      year: bounds.year,
    };
  }

  const placeIds = [
    ...new Set(
      driveRows.flatMap(
        (drive) => [
          drive.startPlaceId,
          drive.endPlaceId,
        ],
      ).filter(
        (
          value,
        ): value is number =>
          value != null,
      ),
    ),
  ];

  const placeRows =
    placeIds.length > 0
      ? await db
          .select({
            id: places.id,
            name: places.name,
          })
          .from(places)
          .where(
            inArray(
              places.id,
              placeIds,
            ),
          )
      : [];

  const placeNames =
    new Map(
      placeRows.map(
        (place) => [
          place.id,
          place.name,
        ],
      ),
    );

  const topRoutes =
    aggregateTopRoutes(
      driveRows.map((drive) => ({
        startKey:
          endpointKey(
            drive.startPlaceId,
            drive.startAddress,
          ),

        endKey:
          endpointKey(
            drive.endPlaceId,
            drive.endAddress,
          ),

        startLabel:
          endpointLabel(
            drive.startPlaceId,
            drive.startAddress,
            placeNames,
          ),

        endLabel:
          endpointLabel(
            drive.endPlaceId,
            drive.endAddress,
            placeNames,
          ),

        distanceKm:
          drive.distanceKm,
      })),

      5,
    );

  const pointRows = await db
    .select({
      driveId:
        routePoints.driveId,

      lat:
        routePoints.lat,

      lon:
        routePoints.lon,

      ts:
        routePoints.ts,
    })
    .from(routePoints)
    .innerJoin(
      drives,
      eq(
        routePoints.driveId,
        drives.id,
      ),
    )
    .leftJoin(
      places,
      eq(
        drives.endPlaceId,
        places.id,
      ),
    )
    .where(
      and(...conditions),
    )
    .orderBy(
      asc(routePoints.driveId),
      asc(routePoints.ts),
    );

  const grouped =
    new Map<
      number,
      RouteHeatmapDrive
    >();

  for (const row of pointRows) {
    let drive =
      grouped.get(
        row.driveId,
      );

    if (!drive) {
      drive = {
        driveId:
          row.driveId,

        points: [],
      };

      grouped.set(
        row.driveId,
        drive,
      );
    }

    drive.points.push({
      lat: row.lat,
      lon: row.lon,
    });
  }

  const heatmap =
    buildRouteHeatmap(
      [...grouped.values()],
    );

  return {
    segments:
      heatmap.segments,

    maxDriveCount:
      heatmap.maxDriveCount,

    driveCount:
      driveRows.length,

    gpsDriveCount:
      heatmap.sourceDriveCount,

    gpsPointCount:
      pointRows.length,

    distanceKm:
      driveRows.reduce(
        (sum, drive) =>
          sum +
          (
            drive.distanceKm ??
            0
          ),
        0,
      ),

    durationSeconds:
      driveRows.reduce(
        (sum, drive) =>
          sum +
          (
            drive.durationSeconds ??
            0
          ),
        0,
      ),

    topRoutes,

    year:
      bounds.year,
  };
}
