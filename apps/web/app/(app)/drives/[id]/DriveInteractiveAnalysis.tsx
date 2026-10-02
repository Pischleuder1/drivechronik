"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type {
  ChartRoutePoint,
  RoutePointTuple,
} from "../../../../lib/driveRoute";

import { DriveMapLoader } from "./DriveMapLoader";
import { DriveChart } from "./DriveChart";

export function DriveInteractiveAnalysis({
  points,
  chartPoints,
  elevationCoverage,
  teslamateAscentM,
  teslamateDescentM,
}: {
  points: RoutePointTuple[];
  chartPoints: ChartRoutePoint[];
  elevationCoverage: number;
  teslamateAscentM: number | null;
  teslamateDescentM: number | null;
}) {
  const t = useTranslations("drives");
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:hidden">
      <DriveMapLoader
        points={points}
        activePointIndex={activePointIndex}
      />

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("page.cardInteractiveCourse")}
          </h2>

          <span className="max-w-[180px] text-right text-[10px] leading-snug text-neutral-500 dark:text-neutral-400">
            {t("chart.mapSyncHint")}
          </span>
        </div>

        <DriveChart
          points={chartPoints}
          elevationCoverage={elevationCoverage}
          teslamateAscentM={teslamateAscentM}
          teslamateDescentM={teslamateDescentM}
          onActivePointChange={setActivePointIndex}
        />
      </div>
    </section>
  );
}
