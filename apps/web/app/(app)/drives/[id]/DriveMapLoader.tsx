"use client";

import dynamic from "next/dynamic";

import type { RoutePointTuple } from "../../../../lib/driveRoute";
import type { TrafficEvent } from "../../../../lib/traffic/types";

const DriveMap = dynamic(
  () => import("./DriveMap").then((m) => m.DriveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[255px] w-full animate-pulse rounded-xl border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:h-[300px]" />
    ),
  },
);

export function DriveMapLoader({
  points,
  activePointIndex = null,
  trafficEvents = [],
}: {
  points: RoutePointTuple[];
  activePointIndex?: number | null;
  trafficEvents?: TrafficEvent[];
}) {
  return (
    <DriveMap
      points={points}
      activePointIndex={activePointIndex}
      trafficEvents={trafficEvents}
    />
  );
}
