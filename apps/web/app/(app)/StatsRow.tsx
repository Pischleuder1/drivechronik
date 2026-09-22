import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  HelpCircle,
  Zap,
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
    "rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

  const icon =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300";

  return (
    <div className="grid h-full gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-4">
      <section className={base}>
        <div className="flex items-start gap-3">
          <div className={icon}>
            <CalendarDays aria-hidden size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.today")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
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
          <div className={icon}>
            <CalendarRange aria-hidden size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.thisWeek")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
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
          <div className={icon}>
            <Zap aria-hidden size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.lastCharge")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
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
          <div
            className={
              unclassifiedCount.live > 0
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                : icon
            }
          >
            <HelpCircle aria-hidden size={18} />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("stats.unclassified")}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
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
