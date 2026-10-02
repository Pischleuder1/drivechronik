"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  Ban,
  BatteryMedium,
  BriefcaseBusiness,
  Clock3,
  Construction,
  Gauge,
  MapPinned,
  Radio,
  Route,
  TriangleAlert,
  Zap,
} from "lucide-react";

import type {
  ChartRoutePoint,
  RoutePointTuple,
} from "../../../../lib/driveRoute";
import type { TrafficEvent } from "../../../../lib/traffic/types";

import { DriveMapLoader } from "./DriveMapLoader";
import { DriveChart } from "./DriveChart";

interface DriveOverviewMetrics {
  distance: string;
  duration: string;
  avgConsumption: string;
  energy: string;
  avgSpeed: string;
}

interface DriveOverviewStatus {
  classification: string;
  gpsPoints: string;
  soc: string;
  gpsCoverage: string;
}

interface DriveTrafficOverview {
  motorwayRefs: string[];
  events: TrafficEvent[];
}

function StatusChip({
  icon: Icon,
  children,
  tone = "neutral",
}: {
  icon: typeof Route;
  children: React.ReactNode;
  tone?: "blue" | "emerald" | "amber" | "neutral";
}) {
  const tones = {
    blue:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
    neutral:
      "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      <Icon aria-hidden size={13} strokeWidth={1.8} />
      {children}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: typeof Route;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/60 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <Icon
          aria-hidden
          size={14}
          strokeWidth={1.8}
          className="text-sky-600 dark:text-sky-400"
        />
        <span>{label}</span>
      </div>

      <div className="mt-1.5 text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

export function DriveInteractiveAnalysis({
  points,
  chartPoints,
  elevationCoverage,
  teslamateAscentM,
  teslamateDescentM,
  metrics,
  status,
  classificationTone,
  traffic,
}: {
  points: RoutePointTuple[];
  chartPoints: ChartRoutePoint[];
  elevationCoverage: number;
  teslamateAscentM: number | null;
  teslamateDescentM: number | null;
  metrics: DriveOverviewMetrics;
  status: DriveOverviewStatus;
  classificationTone: "blue" | "emerald" | "amber" | "neutral";
  traffic: DriveTrafficOverview;
}) {
  const t = useTranslations("drives");
  const locale = useLocale();
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:hidden">
      <DriveMapLoader
        points={points}
        activePointIndex={activePointIndex}
        trafficEvents={traffic.events}
      />

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard
            icon={Route}
            label={t("metrics.distance")}
            value={metrics.distance}
          />

          <MetricCard
            icon={Clock3}
            label={t("metrics.duration")}
            value={metrics.duration}
          />

          <MetricCard
            icon={Activity}
            label={t("metrics.avgConsumption")}
            value={metrics.avgConsumption}
          />

          <MetricCard
            icon={Zap}
            label={t("metrics.consumedEnergy")}
            value={metrics.energy}
          />

          <MetricCard
            icon={Gauge}
            label={t("metrics.avgSpeed")}
            value={metrics.avgSpeed}
            wide
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatusChip
            icon={BriefcaseBusiness}
            tone={classificationTone}
          >
            {status.classification}
          </StatusChip>

          <StatusChip icon={MapPinned}>
            {status.gpsPoints}
          </StatusChip>

          <StatusChip icon={BatteryMedium}>
            {status.soc}
          </StatusChip>

          <StatusChip icon={Radio}>
            {status.gpsCoverage}
          </StatusChip>
        </div>

        <div className="mb-3 mt-5 flex items-start justify-between gap-3">
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

        {traffic.motorwayRefs.length > 0 && (
          <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t("traffic.title")}
                </h2>

                <p className="mt-0.5 text-[10px] leading-snug text-neutral-500 dark:text-neutral-400">
                  {t("traffic.liveNote")}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {traffic.motorwayRefs.join(" · ")}
              </span>
            </div>

            {traffic.events.length === 0 ? (
              <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-3 text-xs text-neutral-500 dark:bg-neutral-950/50 dark:text-neutral-400">
                {t("traffic.none")}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {traffic.events.map((event) => {
                  const Icon =
                    event.type === "roadwork"
                      ? Construction
                      : event.type === "closure"
                        ? Ban
                        : TriangleAlert;

                  const tone =
                    event.type === "closure"
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                      : event.type === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
                        : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300";

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/50"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone}`}
                      >
                        <Icon aria-hidden size={15} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {event.motorway} ·{" "}
                            {t(`traffic.type.${event.type}`)}
                          </p>

                          <span className="shrink-0 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                            {event.routeDistanceKm.toLocaleString(locale, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{" "}
                            km
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">
                          {event.title}
                        </p>

                        {event.blocked && (
                          <p className="mt-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            {t("traffic.blocked")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
