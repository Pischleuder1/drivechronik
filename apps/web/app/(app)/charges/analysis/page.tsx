import Link from "next/link";

import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";

import {
  formatDuration,
  formatKwh,
  formatSoc,
  formatTemp,
} from "@drivechronik/core";

import { APP_TIMEZONE } from "../../../../lib/config";
import { getVehicles } from "../../../../lib/queries";
import { getChargingAnalytics } from "../../../../lib/chargeAnalytics";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";
import { StatCard } from "../../../../components/ui/StatCard";
import { SectionHeader } from "../../../../components/ui/SectionHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  MetricGrid,
  MetricItem,
} from "../../../../components/ui/MetricGrid";

export const dynamic = "force-dynamic";

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function formatKw(value: number | null): string {
  return value != null ? `${value.toFixed(1)} kW` : "—";
}

export default async function ChargeAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("charges"),
    getLocale(),
  ]);

  const params = await searchParams;
  const limit: 5 | 10 = params.limit === "10" ? 10 : 5;

  const vehicles = await getVehicles();
  const vehicleId = vehicles[0]?.id;

  const analytics =
    vehicleId != null
      ? await getChargingAnalytics(vehicleId, limit)
      : {
          sessions: [],
          medianPeakKw: null,
          medianTenToEightySeconds: null,
          locationRanking: [],
          slowAlerts: [],
        };

  const slowBySession = new Map(
    analytics.slowAlerts.map((alert) => [alert.sessionId, alert]),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/charges"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {t("analysis.back")}
      </Link>

      <PageHeader
        visual="charge"
        className="mt-3"
        title={t("analysis.title")}
        subtitle={t("analysis.subtitle")}
        actions={
          <div className="flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <Link
              href="/charges/analysis?limit=5"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                limit === 5
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {t("analysis.lastFive")}
            </Link>
            <Link
              href="/charges/analysis?limit=10"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                limit === 10
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {t("analysis.lastTen")}
            </Link>
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("analysis.sessions")}
          value={String(analytics.sessions.length)}
          tone="blue"
        />
        <StatCard
          label={t("analysis.medianTenToEighty")}
          value={
            analytics.medianTenToEightySeconds != null
              ? formatDuration(
                  Math.round(analytics.medianTenToEightySeconds),
                )
              : "—"
          }
          tone="violet"
        />
        <StatCard
          label={t("analysis.medianPeak")}
          value={formatKw(analytics.medianPeakKw)}
          tone="cyan"
        />
        <StatCard
          label={t("analysis.slowSessions")}
          value={String(analytics.slowAlerts.length)}
          tone={analytics.slowAlerts.length > 0 ? "amber" : "emerald"}
        />
      </div>

      <section className="mt-6">
        <SectionHeader
          title={t("analysis.recentTitle")}
          count={analytics.sessions.length}
          tone="blue"
        />

        {analytics.sessions.length === 0 ? (
          <Panel
            className="mt-3"
            bodyClassName="text-sm text-neutral-500 dark:text-neutral-400"
          >
            {t("analysis.noData")}
          </Panel>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {analytics.sessions.map((session) => {
              const slow = slowBySession.get(session.id);

              return (
                <Link
                  key={session.id}
                  href={`/charges/${session.id}`}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(session.startTime, locale)}
                      </p>
                      <p className="mt-0.5 font-medium">
                        {session.placeName ??
                          session.address ??
                          t("analysis.unknownLocation")}
                      </p>
                    </div>

                    {slow && (
                      <StatusBadge tone="amber">
                        {t("analysis.slowBadge")}
                      </StatusBadge>
                    )}
                  </div>

                  <MetricGrid columns={5} className="mt-3">
                    <MetricItem
                      label={t("analysis.tenToEighty")}
                      value={
                        session.tenToEightySeconds != null
                          ? formatDuration(
                              Math.round(session.tenToEightySeconds),
                            )
                          : "—"
                      }
                    />
                    <MetricItem
                      label={t("analysis.peak")}
                      value={formatKw(session.maxPowerKw)}
                    />
                    <MetricItem
                      label={t("analysis.energy")}
                      value={
                        session.energyAddedKwh != null
                          ? formatKwh(session.energyAddedKwh)
                          : "—"
                      }
                    />
                    <MetricItem
                      label={t("analysis.soc")}
                      value={
                        <>
                          {session.startSoc != null
                            ? formatSoc(session.startSoc)
                            : "—"}
                          {" → "}
                          {session.endSoc != null
                            ? formatSoc(session.endSoc)
                            : "—"}
                        </>
                      }
                    />
                    <MetricItem
                      label={t("analysis.temperature")}
                      value={
                        session.outsideTempAvg != null
                          ? formatTemp(session.outsideTempAvg)
                          : "—"
                      }
                    />
                  </MetricGrid>

                  {slow && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                      {t("analysis.slowDetail", {
                        percent: Math.round((slow.ratio - 1) * 100),
                        peers: slow.comparisonCount,
                      })}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {analytics.locationRanking.length > 0 && (
        <section className="mt-6">
          <SectionHeader
            title={t("analysis.locationsTitle")}
            count={analytics.locationRanking.length}
            tone="sky"
          />

          <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {analytics.locationRanking.map((location) => (
              <div
                key={location.key}
                className="grid grid-cols-2 gap-3 border-b border-neutral-100 p-4 last:border-b-0 sm:grid-cols-4 dark:border-neutral-800"
              >
                <div className="col-span-2 sm:col-span-1">
                  <p className="font-medium">{location.label}</p>
                </div>

                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("analysis.locationSessions")}
                  </p>
                  <p className="mt-0.5 font-medium tabular-nums">
                    {location.sessionCount}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("analysis.medianTenToEighty")}
                  </p>
                  <p className="mt-0.5 font-medium tabular-nums">
                    {location.medianTenToEightySeconds != null
                      ? formatDuration(
                          Math.round(
                            location.medianTenToEightySeconds,
                          ),
                        )
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("analysis.medianPeak")}
                  </p>
                  <p className="mt-0.5 font-medium tabular-nums">
                    {formatKw(location.medianPeakKw)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-400">
        {t("analysis.note")}
      </p>
    </div>
  );
}
