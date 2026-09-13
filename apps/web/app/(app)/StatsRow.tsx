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
import { StatCard } from "../../components/ui/StatCard";
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("stats.today")}
        value={formatKm(today.distanceKm)}
        tone="blue"
        valueClassName="mt-1 text-base font-semibold tabular-nums"
        icon={<CalendarDays aria-hidden size={18} />}
        footer={
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("stats.driveCount", { count: today.driveCount })}
          </p>
        }
      />

      <StatCard
        label={t("stats.thisWeek")}
        value={formatKm(week.distanceKm)}
        tone="violet"
        valueClassName="mt-1 text-base font-semibold tabular-nums"
        icon={<CalendarRange aria-hidden size={18} />}
        footer={
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("stats.driveCount", { count: week.driveCount })}
          </p>
        }
      />

      <StatCard
        label={t("stats.lastCharge")}
        value={
          lastCharge
            ? lastCharge.energyAddedKwh != null
              ? formatKwh(lastCharge.energyAddedKwh, { sign: true })
              : tCommon("state.none")
            : t("stats.noData")
        }
        tone="emerald"
        valueClassName="mt-1 text-base font-semibold tabular-nums"
        icon={<Zap aria-hidden size={18} />}
        footer={
          lastCharge ? (
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
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
          ) : undefined
        }
      />

      <StatCard
        label={t("stats.unclassified")}
        value={unclassifiedCount.live}
        tone="amber"
        valueClassName="mt-1 text-base font-semibold tabular-nums"
        icon={<HelpCircle aria-hidden size={18} />}
        footer={
          <>
            {unclassifiedCount.live > 0 ? (
              <Link
                href="/search?classification=unclassified"
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              >
                {t("stats.classifyNow")}
                <ArrowRight aria-hidden size={11} />
              </Link>
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
          </>
        }
      />
    </div>
  );
}
