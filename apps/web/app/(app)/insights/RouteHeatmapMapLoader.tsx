"use client";

import dynamic from "next/dynamic";

import type { RouteHeatmapSegment } from "../../../lib/routeHeatmapLogic";

const RouteHeatmapMap = dynamic(
  () =>
    import("./RouteHeatmapMap").then(
      (module) => module.RouteHeatmapMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800 lg:h-[560px]" />
    ),
  },
);

export function RouteHeatmapMapLoader(
  props: {
    segments: RouteHeatmapSegment[];
    maxDriveCount: number;
    drivesLabel: string;
  },
) {
  return <RouteHeatmapMap {...props} />;
}
