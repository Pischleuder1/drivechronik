import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  formatDuration,
  formatKm,
} from "@drivechronik/core";

import { todayInAppTz } from "../../../../lib/day";
import { getBusinessReimbursementRateEurPerKm } from "../../../../lib/appSettings";
import { getActiveVehicle } from "../../../../lib/activeVehicle";
import { getYearlyInsights } from "../../../../lib/yearlyInsights";
import { YearlyDestinationMapLoader } from "./YearlyDestinationMapLoader";

import { NoVehicleState } from "../../../../components/NoVehicleState";
import { PageHeaderVisual } from "../../../../components/ui/PageHeaderVisual";
import { StatCard } from "../../../../components/ui/StatCard";
import { Panel } from "../../../../components/ui/Panel";
import { SectionHeader } from "../../../../components/ui/SectionHeader";

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

type DestinationView = "all" | "business" | "customers";

function parseDestinationView(
  raw: string | undefined,
): DestinationView {
  if (raw === "business" || raw === "customers") {
    return raw;
  }

  return "all";
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
  view: DestinationView,
): string {
  return `/insights?view=yearly&year=${year}&destination=${view}`;
}

export async function YearlyInsightsContent({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    destination?: string;
    view?: string;
  }>;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("insights"),
    getTranslations("common"),
    getLocale(),
  ]);

  const params = await searchParams;
  const year = parseYear(params.year);
  const destinationView = parseDestinationView(params.destination ?? params.view);

  const currentVehicle = await getActiveVehicle();
  if (!currentVehicle) {
    return (
      <div className="mt-6">
        <NoVehicleState />
      </div>
    );
  }

  const [result, reimbursementRateEurPerKm] = await Promise.all([
    getYearlyInsights(currentVehicle.id, year),
    getBusinessReimbursementRateEurPerKm(),
  ]);

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

  const businessSummary = result.byClassification.find(
    (row) => row.classification === "business",
  );

  const businessDistanceKm = businessSummary?.distanceKm ?? 0;

  const averageDriveDistanceKm =
    result.driveCount > 0
      ? result.distanceKm / result.driveCount
      : 0;

  const reimbursementAmountEur =
    businessDistanceKm * reimbursementRateEurPerKm;

  const customerDestinations = result.destinations.filter(
    (destination) => destination.placeType === "customer",
  );

  const customerVisitCount = customerDestinations.reduce(
    (sum, destination) => sum + destination.visitCount,
    0,
  );

  const topCustomer =
    [...customerDestinations].sort(
      (a, b) =>
        b.visitCount - a.visitCount ||
        b.distanceKm - a.distanceKm ||
        a.label.localeCompare(b.label),
    )[0] ?? null;

  const businessCustomerDistanceKm = customerDestinations.reduce(
    (sum, destination) => sum + destination.businessDistanceKm,
    0,
  );

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });

  const destinationRows = result.destinations
    .filter((destination) => {
      if (destinationView === "business") {
        return destination.businessVisitCount > 0;
      }

      if (destinationView === "customers") {
        return destination.placeType === "customer";
      }

      return true;
    })
    .map((destination) => {
      if (destinationView !== "business") {
        return destination;
      }

      return {
        ...destination,
        visitCount: destination.businessVisitCount,
        distanceKm: destination.businessDistanceKm,
      };
    })
    .sort(
      (a, b) =>
        b.visitCount - a.visitCount ||
        b.distanceKm - a.distanceKm ||
        a.label.localeCompare(b.label),
    );

  const topDestinationRows = destinationRows.slice(0, 10);

  const destinationMapPoints = destinationRows.flatMap(
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
    <div className="w-full">
      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between sm:min-w-[280px]">
          <Link
            href={yearHref(year - 1, destinationView)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ChevronLeft aria-hidden size={16} />
            {year - 1}
          </Link>

          <span className="px-3 text-sm font-semibold tabular-nums">
            {year}
          </span>

          <Link
            href={yearHref(year + 1, destinationView)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {year + 1}
            <ChevronRight aria-hidden size={16} />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link
            href={`/reports/year?year=${year}`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <FileText aria-hidden size={15} />
            {t("yearly.actions.report")}
          </Link>

          <a
            href={`/api/export/year/${year}?format=pdf&vehicle=${currentVehicle.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <Download aria-hidden size={15} />
            {t("yearly.actions.pdf")}
          </a>
        </div>
      </div>

      {result.driveCount > 0 && (
        <>
          <Panel
                      className="mt-5"
                      title={t("yearly.months.title")}
                      subtitle={t("yearly.months.subtitle")}
                    >

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-blue-600 dark:bg-blue-400" />
                          {tc("classification.business")}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-400" />
                          {tc("classification.private")}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 dark:bg-amber-400" />
                          {tc("classification.commute")}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-neutral-400 dark:bg-neutral-500" />
                          {tc("classification.unclassified")}
                        </span>
                      </div>

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

                          const percentage = (distanceKm: number): number =>
                            month.distanceKm > 0
                              ? (distanceKm / month.distanceKm) * 100
                              : 0;

                          const tooltip = [
                            `${monthLabel(month.monthKey, locale)}: ${formatKm(
                              month.distanceKm,
                            )}`,
                            `${tc("classification.business")}: ${formatKm(
                              month.businessDistanceKm,
                            )}`,
                            `${tc("classification.private")}: ${formatKm(
                              month.privateDistanceKm,
                            )}`,
                            `${tc("classification.commute")}: ${formatKm(
                              month.commuteDistanceKm,
                            )}`,
                            `${tc("classification.unclassified")}: ${formatKm(
                              month.unclassifiedDistanceKm,
                            )}`,
                          ].join(" · ");

                          return (
                            <div
                              key={month.monthKey}
                              className="flex min-w-0 flex-col items-center"
                            >
                              <div className="flex h-36 w-full items-end justify-center">
                                <div
                                  className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t bg-neutral-100 dark:bg-neutral-800"
                                  style={{ height: `${height}%` }}
                                  title={tooltip}
                                >
                                  {month.businessDistanceKm > 0 && (
                                    <div
                                      className="w-full shrink-0 bg-blue-600 dark:bg-blue-400"
                                      style={{
                                        height: `${percentage(
                                          month.businessDistanceKm,
                                        )}%`,
                                      }}
                                    />
                                  )}

                                  {month.privateDistanceKm > 0 && (
                                    <div
                                      className="w-full shrink-0 bg-emerald-600 dark:bg-emerald-400"
                                      style={{
                                        height: `${percentage(
                                          month.privateDistanceKm,
                                        )}%`,
                                      }}
                                    />
                                  )}

                                  {month.commuteDistanceKm > 0 && (
                                    <div
                                      className="w-full shrink-0 bg-amber-500 dark:bg-amber-400"
                                      style={{
                                        height: `${percentage(
                                          month.commuteDistanceKm,
                                        )}%`,
                                      }}
                                    />
                                  )}

                                  {month.unclassifiedDistanceKm > 0 && (
                                    <div
                                      className="w-full shrink-0 bg-neutral-400 dark:bg-neutral-500"
                                      style={{
                                        height: `${percentage(
                                          month.unclassifiedDistanceKm,
                                        )}%`,
                                      }}
                                    />
                                  )}
                                </div>
                              </div>

                              <span className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                {monthLabel(month.monthKey, locale)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Panel>

                    <section className="mt-5">
                      <SectionHeader
                        title={t("yearly.classification.title")}
                        count={result.byClassification.length}
                        tone="blue"
                      />

                      <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-sm dark:border-neutral-800 dark:bg-neutral-800">
                        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
                          {result.byClassification.map((row) => (
                            <div
                              key={row.classification}
                              className="min-w-0 bg-white px-3 py-2.5 dark:bg-neutral-900"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  aria-hidden
                                  className={`h-2 w-2 shrink-0 rounded-full ${
                                    row.classification === "business"
                                      ? "bg-blue-600 dark:bg-blue-400"
                                      : row.classification === "private"
                                        ? "bg-emerald-600 dark:bg-emerald-400"
                                        : row.classification === "commute"
                                          ? "bg-amber-500 dark:bg-amber-400"
                                          : "bg-neutral-400 dark:bg-neutral-500"
                                  }`}
                                />
                                <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                  {tc(`classification.${row.classification}`)}
                                </span>
                              </div>

                              <div className="mt-1 text-base font-semibold tracking-tight tabular-nums">
                                {formatKm(row.distanceKm)}
                              </div>

                              <div className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                                {t("yearly.driveCount", {
                                  count: row.driveCount,
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
        </>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          className="px-3 py-2.5 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.distance")}
          value={formatKm(result.distanceKm)}
          tone="blue"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
        <StatCard
          className="px-3 py-2.5 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.drives")}
          value={String(result.driveCount)}
          tone="sky"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
        <StatCard
          className="px-3 py-2.5 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.duration")}
          value={formatDuration(Math.round(result.durationSeconds))}
          tone="violet"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
        <StatCard
          className="px-3 py-2.5 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.classified")}
          value={`${Math.round(classifiedShare * 100)} %`}
          tone="indigo"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          className="px-3 py-2.5 !bg-neutral-50 !shadow-none dark:!bg-neutral-900 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.businessDistance")}
          value={formatKm(businessDistanceKm)}
          tone="cyan"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
        <StatCard
          className="px-3 py-2.5 !bg-neutral-50 !shadow-none dark:!bg-neutral-900 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.reimbursement")}
          value={currencyFormatter.format(reimbursementAmountEur)}
          hint={t("yearly.kpi.reimbursementRate", {
            rate: currencyFormatter.format(reimbursementRateEurPerKm),
          })}
          tone="emerald"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
        <StatCard
          className="px-3 py-2.5 !bg-neutral-50 !shadow-none dark:!bg-neutral-900 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.averageDrive")}
          value={formatKm(averageDriveDistanceKm)}
          tone="neutral"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
        <StatCard
          className="px-3 py-2.5 !bg-neutral-50 !shadow-none dark:!bg-neutral-900 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
          label={t("yearly.kpi.customerVisits")}
          value={String(customerVisitCount)}
          hint={t("yearly.kpi.customerCount", {
            count: customerDestinations.length,
          })}
          tone="amber"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
        />
      </div>

      {result.driveCount === 0 ? (
        <Panel
          className="mt-6"
          bodyClassName="text-center"
        >
          <p className="font-medium">{t("yearly.empty.title")}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("yearly.empty.hint", { year })}
          </p>
        </Panel>
      ) : (
        <>
          <section className="mt-5">
            <SectionHeader
              title={t("yearly.wrapped.title")}
              subtitle={t("yearly.wrapped.subtitle")}
              tone="blue"
            />

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                className="p-3 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
                label={t("yearly.wrapped.longest")}
                value={
                  result.longestDrive?.distanceKm != null
                    ? formatKm(result.longestDrive.distanceKm)
                    : "—"
                }
                tone="blue"
                valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
              />

              <StatCard
                className="p-3 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
                label={t("yearly.wrapped.busiestMonth")}
                value={
                  result.busiestMonth
                    ? monthLabel(result.busiestMonth.monthKey, locale)
                    : "—"
                }
                hint={
                  result.busiestMonth
                    ? formatKm(result.busiestMonth.distanceKm)
                    : undefined
                }
                tone="violet"
                valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
              />

              <StatCard
                className="p-3 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
                label={t("yearly.wrapped.busiestDay")}
                value={
                  result.busiestDay
                    ? dateLabel(result.busiestDay.dateKey, locale)
                    : "—"
                }
                hint={
                  result.busiestDay
                    ? formatKm(result.busiestDay.distanceKm)
                    : undefined
                }
                tone="cyan"
                valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
              />

              <StatCard
                className="p-3 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
                label={t("yearly.wrapped.topDestination")}
                value={result.topDestination?.label ?? "—"}
                hint={
                  result.topDestination
                    ? t("yearly.visits", {
                        count: result.topDestination.visitCount,
                      })
                    : undefined
                }
                tone="amber"
                valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
              />
            </div>
          </section>

                    {customerDestinations.length > 0 && (
            <section className="mt-5">
              <SectionHeader
                title={t("yearly.customers.title")}
                subtitle={t("yearly.customers.subtitle")}
                tone="blue"
              />

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <StatCard
                  className="p-3 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
                  label={t("yearly.customers.top")}
                  value={topCustomer?.label ?? "—"}
                  hint={
                    topCustomer
                      ? `${t("yearly.visits", {
                          count: topCustomer.visitCount,
                        })} · ${formatKm(topCustomer.distanceKm)}`
                      : undefined
                  }
                  tone="emerald"
                  valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
                />

                <StatCard
                  className="p-3 !border-t !border-t-neutral-200 dark:!border-t-neutral-800"
                  label={t("yearly.customers.businessDistance")}
                  value={formatKm(businessCustomerDistanceKm)}
                  hint={t("yearly.customers.businessDistanceHint")}
                  tone="cyan"
                  valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
                />
              </div>
            </section>
          )}

          {result.destinations.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-neutral-500 dark:text-neutral-400">
                {t("yearly.destinations.filters.label")}
              </span>

              <Link
                href={yearHref(
                  year,
                  "all",
                )}
                className={`rounded-full border px-2.5 py-1 text-sm font-medium ${
                  destinationView === "all"
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 bg-white hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                }`}
              >
                {t("yearly.destinations.filters.all")}
              </Link>

              <Link
                href={yearHref(
                  year,
                  "business",
                )}
                className={`rounded-full border px-2.5 py-1 text-sm font-medium ${
                  destinationView === "business"
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 bg-white hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                }`}
              >
                {t("yearly.destinations.filters.business")}
              </Link>

              <Link
                href={yearHref(
                  year,
                  "customers",
                )}
                className={`rounded-full border px-2.5 py-1 text-sm font-medium ${
                  destinationView === "customers"
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 bg-white hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                }`}
              >
                {t("yearly.destinations.filters.customers")}
              </Link>
            </div>
          )}

          {topDestinationRows.length > 0 && (
            <section className="mt-3">
              <SectionHeader
                title={t("yearly.destinations.title")}
                count={topDestinationRows.length}
                tone="blue"
              />

              <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                {topDestinationRows.map((destination, index) => (
                  <div
                    key={destination.key}
                    className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-neutral-100 p-3 last:border-b-0 dark:border-neutral-800"
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
                        {" · "}
                        {t("yearly.destinations.businessVisits", {
                          count: destination.businessVisitCount,
                        })}
                        {" · "}
                        {t("yearly.destinations.privateVisits", {
                          count: destination.privateVisitCount,
                        })}
                        {" · "}
                        {t("yearly.destinations.commuteVisits", {
                          count: destination.commuteVisitCount,
                        })}
                        {" · "}
                        {t("yearly.destinations.lastVisit", {
                          date: dateLabel(
                            destination.lastVisitDateKey,
                            locale,
                          ),
                        })}
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
          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950">
            <PageHeaderVisual variant="heatmap" compact />

            <div className="relative z-10">
              <SectionHeader
                title={t("yearly.map.title")}
                subtitle={t("yearly.map.subtitle")}
                count={destinationMapPoints.length}
                tone="emerald"
              />
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
