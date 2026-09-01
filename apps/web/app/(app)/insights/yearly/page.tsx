import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  formatDuration,
  formatKm,
} from "@drivechronik/core";

import { todayInAppTz } from "../../../../lib/day";
import { getVehicles } from "../../../../lib/queries";
import { getYearlyInsights } from "../../../../lib/yearlyInsights";
import { InsightsVehicleSwitcher } from "../InsightsVehicleSwitcher";
import { YearlyDestinationMapLoader } from "./YearlyDestinationMapLoader";

export const dynamic = "force-dynamic";

function parseYear(raw: string | undefined): number {
  const currentYear = Number(todayInAppTz().slice(0, 4));
  if (!raw) return currentYear;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return currentYear;
  }

  return parsed;
}

function monthLabel(monthKey: string, locale: string): string {
  const month = Number(monthKey.slice(5, 7));

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, month - 1, 15)));
}

function dateLabel(dateKey: string, locale: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

function yearHref(
  year: number,
  vehicleId: number,
): string {
  return `/insights/yearly?year=${year}&vehicle=${vehicleId}`;
}

export default async function YearlyInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    vehicle?: string;
  }>;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("insights"),
    getTranslations("common"),
    getLocale(),
  ]);

  const params = await searchParams;
  const year = parseYear(params.year);

  const vehicles = await getVehicles();
  if (vehicles.length === 0) notFound();

  const requestedVehicle = params.vehicle
    ? Number(params.vehicle)
    : NaN;

  const currentVehicle =
    vehicles.find((vehicle) => vehicle.id === requestedVehicle) ??
    vehicles[0]!;

  const result = await getYearlyInsights(currentVehicle.id, year);

  const maxMonthKm = Math.max(
    ...result.months.map((month) => month.distanceKm),
    0,
  );

  const classifiedKm = result.byClassification.reduce(
    (sum, row) =>
      row.classification === "unclassified"
        ? sum
        : sum + row.distanceKm,
    0,
  );

  const classifiedShare =
    result.distanceKm > 0
      ? classifiedKm / result.distanceKm
      : 0;

  const destinationMapPoints = result.destinations.flatMap(
    (destination) =>
      destination.lat != null && destination.lon != null
        ? [
            {
              key: destination.key,
              label: destination.label,
              visitCount: destination.visitCount,
              distanceKm: destination.distanceKm,
              lat: destination.lat,
              lon: destination.lon,
            },
          ]
        : [],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/insights?vehicle=${currentVehicle.id}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {t("yearly.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("yearly.title", { year })}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("yearly.subtitle")}
          </p>
        </div>

        {vehicles.length > 1 && (
          <InsightsVehicleSwitcher
            vehicles={vehicles}
            current={currentVehicle.id}
          />
        )}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
        <Link
          href={yearHref(year - 1, currentVehicle.id)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <ChevronLeft aria-hidden size={16} />
          {year - 1}
        </Link>

        <span className="font-semibold tabular-nums">{year}</span>

        <Link
          href={yearHref(year + 1, currentVehicle.id)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {year + 1}
          <ChevronRight aria-hidden size={16} />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("yearly.kpi.distance")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatKm(result.distanceKm)}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("yearly.kpi.drives")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {result.driveCount}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("yearly.kpi.duration")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatDuration(Math.round(result.durationSeconds))}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("yearly.kpi.classified")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {Math.round(classifiedShare * 100)} %
          </p>
        </div>
      </div>

      {result.driveCount === 0 ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <p className="font-medium">{t("yearly.empty.title")}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("yearly.empty.hint", { year })}
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-semibold">
              {t("yearly.wrapped.title")}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t("yearly.wrapped.subtitle")}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("yearly.wrapped.longest")}
                </p>
                <p className="mt-1 font-semibold">
                  {result.longestDrive?.distanceKm != null
                    ? formatKm(result.longestDrive.distanceKm)
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("yearly.wrapped.busiestMonth")}
                </p>
                <p className="mt-1 font-semibold">
                  {result.busiestMonth
                    ? monthLabel(result.busiestMonth.monthKey, locale)
                    : "—"}
                </p>
                {result.busiestMonth && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatKm(result.busiestMonth.distanceKm)}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("yearly.wrapped.busiestDay")}
                </p>
                <p className="mt-1 font-semibold">
                  {result.busiestDay
                    ? dateLabel(result.busiestDay.dateKey, locale)
                    : "—"}
                </p>
                {result.busiestDay && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatKm(result.busiestDay.distanceKm)}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("yearly.wrapped.topDestination")}
                </p>
                <p className="mt-1 truncate font-semibold">
                  {result.topDestination?.label ?? "—"}
                </p>
                {result.topDestination && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {t("yearly.visits", {
                      count: result.topDestination.visitCount,
                    })}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold">
              {t("yearly.months.title")}
            </h2>

            <div className="mt-4 grid grid-cols-12 gap-2">
              {result.months.map((month) => {
                const height =
                  maxMonthKm > 0
                    ? Math.max(
                        4,
                        Math.round(
                          (month.distanceKm / maxMonthKm) * 100,
                        ),
                      )
                    : 4;

                return (
                  <div
                    key={month.monthKey}
                    className="flex min-w-0 flex-col items-center"
                  >
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className="w-full max-w-7 rounded-t bg-neutral-800 dark:bg-neutral-200"
                        style={{ height: `${height}%` }}
                        title={`${monthLabel(
                          month.monthKey,
                          locale,
                        )}: ${formatKm(month.distanceKm)}`}
                      />
                    </div>

                    <span className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {monthLabel(month.monthKey, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-semibold">
              {t("yearly.classification.title")}
            </h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {result.byClassification.map((row) => (
                <div
                  key={row.classification}
                  className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {tc(`classification.${row.classification}`)}
                  </p>

                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatKm(row.distanceKm)}
                  </p>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("yearly.driveCount", {
                      count: row.driveCount,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {result.topDestinations.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">
                {t("yearly.destinations.title")}
              </h2>

              <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                {result.topDestinations.map((destination, index) => (
                  <div
                    key={destination.key}
                    className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-neutral-100 p-4 last:border-b-0 dark:border-neutral-800"
                  >
                    <span className="text-sm font-semibold text-neutral-400">
                      {index + 1}.
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {destination.label}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatKm(destination.distanceKm)}
                      </p>
                    </div>

                    <span className="text-sm font-medium tabular-nums">
                      {t("yearly.visits", {
                        count: destination.visitCount,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {destinationMapPoints.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">
            {t("yearly.map.title")}
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("yearly.map.subtitle")}
          </p>

          <div className="mt-3">
            <YearlyDestinationMapLoader
              points={destinationMapPoints}
              locale={locale}
              visitsLabel={t("yearly.map.visits")}
              distanceLabel={t("yearly.map.distance")}
            />
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-400">
        {t("yearly.note")}
      </p>
    </div>
  );
}
