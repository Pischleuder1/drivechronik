import Link from "next/link";
import {
  ArrowRight,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKm, formatKwh, formatPlaceLabel } from "@drivechronik/core";
import { formatRelativeTime } from "../../lib/day";
import type {
  LastChargeStats,
  TodayStats,
  UnclassifiedCount,
  WeekStats,
} from "../../lib/dashboard";

export async function StatsRow({
  today,
  week,
  lastCharge,
  unclassifiedCount,
}: {
  today: TodayStats;
  week: WeekStats;
  lastCharge: LastChargeStats | null;
  unclassifiedCount: UnclassifiedCount;
}) {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
    getLocale(),
  ]);

  const base =
    "rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-5 lg:shadow-none lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-neutral-200 dark:lg:bg-transparent dark:lg:[&:not(:first-child)]:border-neutral-800";

  return (
    <div className="grid h-full gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-1 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white dark:lg:border-neutral-800 dark:lg:bg-neutral-900">
      <section className={base}>
        <div className="flex items-start gap-3">

          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.today")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums lg:text-xl lg:font-bold lg:tracking-tight">
              {formatKm(today.distanceKm)}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">
              {t("stats.driveCount", { count: today.driveCount })}
            </p>
          </div>
        </div>
      </section>

      <section className={base}>
        <div className="flex items-start gap-3">

          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.thisWeek")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums lg:text-xl lg:font-bold lg:tracking-tight">
              {formatKm(week.distanceKm)}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">
              {t("stats.driveCount", { count: week.driveCount })}
            </p>
          </div>
        </div>
      </section>

      <section className={base}>
        <div className="flex items-start gap-3">

          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.lastCharge")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums lg:text-xl lg:font-bold lg:tracking-tight">
              {lastCharge?.energyAddedKwh != null
                ? formatKwh(lastCharge.energyAddedKwh, { sign: true })
                : tCommon("state.none")}
            </p>
            {lastCharge && (
              <p className="mt-0.5 truncate text-xs text-neutral-400">
                {formatRelativeTime(lastCharge.endTime, locale)}
                {lastCharge.placeName || lastCharge.address
                  ? ` · ${formatPlaceLabel(
                      lastCharge.placeName,
                      lastCharge.address,
                      null,
                      null,
                    )}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className={`${base} ${
          unclassifiedCount.live > 0
            ? "border-amber-200 bg-amber-50/25 dark:border-amber-900/40 dark:bg-amber-950/10"
            : ""
        }`}
      >
        <div className="flex items-start gap-3">


          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.unclassified")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums lg:text-xl lg:font-bold lg:tracking-tight">
              {unclassifiedCount.live}
            </p>

            {unclassifiedCount.live > 0 ? (
              <Link
                href="/search?classification=unclassified"
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                {t("stats.classifyNow")}
                <ArrowRight aria-hidden size={11} />
              </Link>
            ) : (
              <p className="mt-0.5 text-xs text-neutral-400">
                {t("stats.allDone")}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
