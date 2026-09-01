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

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("analysis.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("analysis.subtitle")}
          </p>
        </div>

        <div className="flex rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
          <Link
            href="/charges/analysis?limit=5"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              limit === 5
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {t("analysis.lastFive")}
          </Link>

          <Link
            href="/charges/analysis?limit=10"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              limit === 10
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {t("analysis.lastTen")}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("analysis.sessions")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {analytics.sessions.length}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("analysis.medianTenToEighty")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {analytics.medianTenToEightySeconds != null
              ? formatDuration(
                  Math.round(analytics.medianTenToEightySeconds),
                )
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("analysis.medianPeak")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatKw(analytics.medianPeakKw)}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("analysis.slowSessions")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {analytics.slowAlerts.length}
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">
          {t("analysis.recentTitle")}
        </h2>

        {analytics.sessions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            {t("analysis.noData")}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {analytics.sessions.map((session) => {
              const slow = slowBySession.get(session.id);

              return (
                <Link
                  key={session.id}
                  href={`/charges/${session.id}`}
                  className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
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
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {t("analysis.slowBadge")}
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                    <div>
                      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t("analysis.tenToEighty")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {session.tenToEightySeconds != null
                          ? formatDuration(
                              Math.round(session.tenToEightySeconds),
                            )
                          : "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t("analysis.peak")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {formatKw(session.maxPowerKw)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t("analysis.energy")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {session.energyAddedKwh != null
                          ? formatKwh(session.energyAddedKwh)
                          : "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t("analysis.soc")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {session.startSoc != null
                          ? formatSoc(session.startSoc)
                          : "—"}
                        {" → "}
                        {session.endSoc != null
                          ? formatSoc(session.endSoc)
                          : "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t("analysis.temperature")}
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {session.outsideTempAvg != null
                          ? formatTemp(session.outsideTempAvg)
                          : "—"}
                      </dd>
                    </div>
                  </dl>

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
          <h2 className="text-lg font-semibold">
            {t("analysis.locationsTitle")}
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
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
