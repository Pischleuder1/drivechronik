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
import {
  IconBadge,
  type IconBadgeTone,
} from "../../components/ui/IconBadge";
import type {
  LastChargeStats,
  TodayStats,
  UnclassifiedCount,
  WeekStats,
} from "../../lib/dashboard";

function StatCard({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: React.ComponentType<{
    size?: number;
    "aria-hidden"?: boolean;
    className?: string;
  }>;
  label: string;
  tone: IconBadgeTone;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <IconBadge tone={tone}>
          <Icon aria-hidden size={18} />
        </IconBadge>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {label}
          </p>

          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard icon={CalendarDays} label={t("stats.today")} tone="blue">
        <p className="text-xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {formatKm(today.distanceKm)}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {t("stats.driveCount", { count: today.driveCount })}
        </p>
      </StatCard>

      <StatCard icon={CalendarRange} label={t("stats.thisWeek")} tone="violet">
        <p className="text-xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {formatKm(week.distanceKm)}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {t("stats.driveCount", { count: week.driveCount })}
        </p>
      </StatCard>

      <StatCard icon={Zap} label={t("stats.lastCharge")} tone="emerald">
        {lastCharge ? (
          <>
            <p className="text-xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
              {lastCharge.energyAddedKwh != null
                ? formatKwh(lastCharge.energyAddedKwh, { sign: true })
                : tCommon("state.none")}
            </p>

            <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
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
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            {t("stats.noData")}
          </p>
        )}
      </StatCard>

      <StatCard icon={HelpCircle} label={t("stats.unclassified")} tone="amber">
        <p className="text-xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-neutral-50">
          {unclassifiedCount.live}
        </p>

        {unclassifiedCount.live > 0 ? (
          <Link
            href="/search?classification=unclassified"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            {t("stats.classifyNow")}
            <ArrowRight aria-hidden size={11} />
          </Link>
        ) : (
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
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
      </StatCard>
    </div>
  );
}
