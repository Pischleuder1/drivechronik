import Link from "next/link";
import { Route } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  formatDuration,
  formatKm,
} from "@drivechronik/core";

import {
  getRouteHeatmapData,
  type RouteHeatmapFilter,
  type RouteHeatmapRange,
} from "../../../lib/routeHeatmap";

import { EmptyState } from "../../../components/ui/EmptyState";
import { RouteHeatmapMapLoader } from "./RouteHeatmapMapLoader";

function parseRange(
  value?: string,
): RouteHeatmapRange {
  if (
    value === "30d" ||
    value === "all"
  ) {
    return value;
  }

  return "year";
}

function parseFilter(
  value?: string,
): RouteHeatmapFilter {
  if (
    value === "private" ||
    value === "other"
  ) {
    return value;
  }

  return "business";
}

function href(
  vehicleId: number,
  range: RouteHeatmapRange,
  filter: RouteHeatmapFilter,
): string {
  const params =
    new URLSearchParams();

  params.set("view", "routes");
  params.set(
    "vehicle",
    String(vehicleId),
  );

  params.set("range", range);
  params.set("routeFilter", filter);

  return `/insights?${params.toString()}`;
}

export async function RouteHeatmapContent({
  vehicleId,
  range: rawRange,
  filter: rawFilter,
}: {
  vehicleId: number;
  range?: string;
  filter?: string;
}) {
  const t =
    await getTranslations("insights");

  const range = parseRange(rawRange);
  const filter = parseFilter(rawFilter);

  const data =
    await getRouteHeatmapData(
      vehicleId,
      range,
      filter,
    );

  const ranges: Array<{
    key: RouteHeatmapRange;
    label: string;
  }> = [
    {
      key: "30d",
      label: t(
        "routeHeatmap.ranges.days30",
      ),
    },
    {
      key: "year",
      label: t(
        "routeHeatmap.ranges.year",
        { year: data.year },
      ),
    },
    {
      key: "all",
      label: t(
        "routeHeatmap.ranges.all",
      ),
    },
  ];

  const filters: Array<{
    key: RouteHeatmapFilter;
    label: string;
  }> = [
    {
      key: "business",
      label: t(
        "routeHeatmap.filters.business",
      ),
    },
    {
      key: "private",
      label: t(
        "routeHeatmap.filters.private",
      ),
    },
    {
      key: "other",
      label: t(
        "routeHeatmap.filters.other",
      ),
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Link
              key={item.key}
              href={href(
                vehicleId,
                item.key,
                filter,
              )}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === item.key
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={href(
                vehicleId,
                range,
                item.key,
              )}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === item.key
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {data.segments.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={Route}
            title={t(
              "routeHeatmap.empty.title",
            )}
            hint={t(
              "routeHeatmap.empty.hint",
            )}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <RouteHeatmapMapLoader
              segments={data.segments}
              maxDriveCount={
                data.maxDriveCount
              }
              drivesLabel={t(
                "routeHeatmap.map.drives",
              )}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t(
                  "routeHeatmap.map.hint",
                )}
              </p>

              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>
                  {t(
                    "routeHeatmap.map.less",
                  )}
                </span>

                <div className="flex overflow-hidden rounded-full">
                  <span className="h-2.5 w-8 bg-blue-600" />
                  <span className="h-2.5 w-8 bg-green-500" />
                  <span className="h-2.5 w-8 bg-amber-500" />
                  <span className="h-2.5 w-8 bg-red-600" />
                </div>

                <span>
                  {t(
                    "routeHeatmap.map.more",
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold">
                {t(
                  "routeHeatmap.stats.title",
                )}
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
                <Stat
                  label={t(
                    "routeHeatmap.stats.distance",
                  )}
                  value={formatKm(
                    data.distanceKm,
                  )}
                />

                <Stat
                  label={t(
                    "routeHeatmap.stats.drives",
                  )}
                  value={String(
                    data.driveCount,
                  )}
                />

                <Stat
                  label={t(
                    "routeHeatmap.stats.duration",
                  )}
                  value={formatDuration(
                    data.durationSeconds,
                  )}
                />

                <Stat
                  label={t(
                    "routeHeatmap.stats.gpsDrives",
                  )}
                  value={`${data.gpsDriveCount} / ${data.driveCount}`}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold">
                {t(
                  "routeHeatmap.topRoutes.title",
                )}
              </h2>

              {data.topRoutes.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  {t(
                    "routeHeatmap.topRoutes.empty",
                  )}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.topRoutes.map(
                    (route, index) => (
                      <div
                        key={`${route.startLabel}-${route.endLabel}`}
                        className="rounded-xl bg-neutral-50 px-3 py-3 dark:bg-neutral-950"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                            {index + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug text-neutral-900 dark:text-neutral-100">
                              {route.startLabel}
                              {" ↔ "}
                              {route.endLabel}
                            </p>

                            <p className="mt-1 text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                              {t(
                                "routeHeatmap.topRoutes.driveCount",
                                {
                                  count:
                                    route.driveCount,
                                },
                              )}
                              {" · "}
                              {t(
                                "routeHeatmap.topRoutes.averageDistance",
                                {
                                  distance:
                                    formatKm(
                                      route.distanceKm /
                                        route.driveCount,
                                    ),
                                },
                              )}
                            </p>

                            <p className="mt-0.5 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                              {t(
                                "routeHeatmap.topRoutes.totalDistance",
                                {
                                  distance:
                                    formatKm(
                                      route.distanceKm,
                                    ),
                                },
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t(
                  "routeHeatmap.topRoutes.hint",
                )}
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-3 dark:bg-neutral-950">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </div>

      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}
