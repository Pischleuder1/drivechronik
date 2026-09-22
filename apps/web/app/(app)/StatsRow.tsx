import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  HelpCircle,
  Zap,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  formatKm,
  formatKwh,
  formatPlaceLabel,
} from "@drivechronik/core";
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

  return (
    <section className="grid h-full grid-cols-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-r border-neutral-100 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          <CalendarDays aria-hidden size={17} />
          <p className="text-xs font-medium uppercase tracking-wide">
            {t("stats.today")}
          </p>
        </div>

        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {formatKm(today.distanceKm)}
        </p>

        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("stats.driveCount", { count: today.driveCount })}
        </p>
      </div>

      <div className="border-b border-neutral-100 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          <CalendarRange aria-hidden size={17} />
          <p className="text-xs font-medium uppercase tracking-wide">
            {t("stats.thisWeek")}
          </p>
        </div>

        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {formatKm(week.distanceKm)}
        </p>

        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("stats.driveCount", { count: week.driveCount })}
        </p>
      </div>

      <div className="border-r border-neutral-100 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          <Zap aria-hidden size={17} />
          <p className="text-xs font-medium uppercase tracking-wide">
            {t("stats.lastCharge")}
          </p>
        </div>

        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {lastCharge
            ? lastCharge.energyAddedKwh != null
              ? formatKwh(lastCharge.energyAddedKwh, { sign: true })
              : tCommon("state.none")
            : t("stats.noData")}
        </p>

        {lastCharge && (
          <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
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

      <div className="p-4">
        <div
          className={`flex items-center gap-2 ${
            unclassifiedCount.live > 0
              ? "text-amber-500 dark:text-amber-400"
              : "text-neutral-400 dark:text-neutral-500"
          }`}
        >
          <HelpCircle aria-hidden size={17} />
          <p className="text-xs font-medium uppercase tracking-wide">
            {t("stats.unclassified")}
          </p>
        </div>

        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {unclassifiedCount.live}
        </p>

        {unclassifiedCount.live > 0 ? (
          <Link
            href="/search?classification=unclassified"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            {t("stats.classifyNow")}
            <ArrowRight aria-hidden size={11} />
          </Link>
        ) : (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t("stats.allDone")}
          </p>
        )}

        {unclassifiedCount.imported > 0 && (
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            {t("stats.importedExtra", {
              count: unclassifiedCount.imported,
            })}
          </p>
        )}
      </div>
    </section>
  );
}
