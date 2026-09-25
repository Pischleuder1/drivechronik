import Link from "next/link";
import { ArrowLeft, Download, Gauge, ReceiptText, Route } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  buildBusinessYearReport,
  formatKm,
  type Classification,
} from "@drivechronik/core";

import { getBusinessReimbursementRateEurPerKm } from "../../../../lib/appSettings";
import { todayInAppTz } from "../../../../lib/day";
import { loadBusinessYearReportData } from "../../../../lib/exports/data";
import { isValidYearParam } from "../../../../lib/exports/params";
import { buttonClasses } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";
import { StatCard } from "../../../../components/ui/StatCard";
import { YearReportFilters } from "./YearReportFilters";

import { NoVehicleState } from "../../../../components/NoVehicleState";
import { getActiveVehicle } from "../../../../lib/activeVehicle";

export const dynamic = "force-dynamic";

const BUSINESS_ONLY: Classification[] = ["business"];
const PRIVATE_ONLY: Classification[] = ["private"];

const ALL_CLASSIFICATIONS: Classification[] = [
  "business",
  "private",
  "commute",
  "unclassified",
];

function currentYearInAppTz(): string {
  return todayInAppTz().slice(0, 4);
}

export default async function BusinessYearReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; classification?: string }>;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("reports"),
    getLocale(),
  ]);

  const sp = await searchParams;
  const year =
    sp.year != null && isValidYearParam(sp.year)
      ? sp.year
      : currentYearInAppTz();

  const scope: "business" | "private" | "all" =
    sp.classification === "private"
      ? "private"
      : sp.classification == null ||
          sp.classification === "business"
        ? "business"
        : "all";

  const selected =
    scope === "business"
      ? BUSINESS_ONLY
      : scope === "private"
        ? PRIVATE_ONLY
        : ALL_CLASSIFICATIONS;

  const classificationQuery = selected.join(",");

  const activeVehicle = await getActiveVehicle();

  if (!activeVehicle) {
    return (
      <div className="w-full">
        <Link
          href={`/reports?month=${year}-01&classification=${classificationQuery}`}
          className={buttonClasses("ghost", "sm")}
        >
          <ArrowLeft aria-hidden size={14} />
          {t("year.backToMonthly")}
        </Link>

        <PageHeader
          visual="document"
          className="mt-4"
          title={t(
            scope === "business"
              ? "year.title"
              : scope === "private"
                ? "year.privateTitle"
                : "year.allTitle",
            { year },
          )}
          subtitle={t(
            scope === "business"
              ? "year.subtitle"
              : scope === "private"
                ? "year.privateSubtitle"
                : "year.allSubtitle",
          )}
        />

        <Panel className="mt-4" padding="sm">
          <YearReportFilters year={year} scope={scope} />
        </Panel>

        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const [data, reimbursementRate] = await Promise.all([
    loadBusinessYearReportData(year, selected, activeVehicle.id),
    getBusinessReimbursementRateEurPerKm(),
  ]);

  const report = buildBusinessYearReport(
    data.drives,
    year,
    data.meta,
    reimbursementRate,
    selected,
  );

  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  });

  const rate = currency.format(report.rateEurPerKm);

  return (
    <div className="w-full">
      <Link
        href={`/reports?month=${year}-01&classification=${classificationQuery}`}
        className={buttonClasses("ghost", "sm")}
      >
        <ArrowLeft aria-hidden size={14} />
        {t("year.backToMonthly")}
      </Link>

      <PageHeader
        visual="document"
        className="mt-4"
        title={t(
            scope === "business"
              ? "year.title"
              : scope === "private"
                ? "year.privateTitle"
                : "year.allTitle",
            { year },
          )}
        subtitle={t(
            scope === "business"
              ? "year.subtitle"
              : scope === "private"
                ? "year.privateSubtitle"
                : "year.allSubtitle",
          )}
      />

      <Panel className="mt-4" padding="sm">
        <YearReportFilters year={year} scope={scope} />
      </Panel>

      <div className="mt-4 flex gap-1.5">
        <a
          href={`/api/export/year/${year}?format=csv&classification=${classificationQuery}&vehicle=${activeVehicle.id}`}
          className={buttonClasses("ghost", "sm")}
        >
          <Download aria-hidden size={14} />
          {t("exportCsv")}
        </a>

        <a
          href={`/api/export/year/${year}?format=pdf&classification=${classificationQuery}&vehicle=${activeVehicle.id}`}
          className={buttonClasses("ghost", "sm")}
        >
          <Download aria-hidden size={14} />
          {t("exportPdf")}
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          className="p-3"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
          label={t(
            scope === "business"
              ? "year.totalDistance"
              : scope === "private"
                ? "year.privateTotalDistance"
                : "year.allTotalDistance",
          )}
          value={formatKm(report.totals.distanceKm)}
          tone="blue"
          icon={<Route className="h-4 w-4" />}
          footer={
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("driveCountLabel", { count: report.totals.driveCount })}
            </p>
          }
        />

        <StatCard
          className="p-3"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
          label={t("year.rate")}
          value={
            <>
              {rate}
              <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                / km
              </span>
            </>
          }
          tone="amber"
          icon={<Gauge className="h-4 w-4" />}
        />

        <StatCard
          className="p-3"
          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
          label={t("year.totalAmount")}
          value={currency.format(report.totals.amountEur)}
          tone="emerald"
          icon={<ReceiptText className="h-4 w-4" />}
        />
      </div>

      {report.incomplete && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t(
            scope === "business"
              ? "year.incomplete"
              : scope === "private"
                ? "year.privateIncomplete"
                : "year.allIncomplete",
          )}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">{t("year.table.month")}</th>
              <th className="px-4 py-3 text-right">
                {t("year.table.drives")}
              </th>
              <th className="px-4 py-3 text-right">
                {t(
                  scope === "business"
                    ? "year.table.distance"
                    : scope === "private"
                      ? "year.table.privateDistance"
                      : "year.table.allDistance",
                )}
              </th>
              <th className="px-4 py-3 text-right">
                {t("year.table.amount")}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {report.months.map((month) => {
              const monthNumber = Number(month.month.slice(5, 7));
              const monthName = monthFormatter.format(
                new Date(Date.UTC(2020, monthNumber - 1, 1, 12)),
              );

              return (
                <tr
                  key={month.month}
                  className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/reports?month=${month.month}&classification=${classificationQuery}`}
                      className="hover:underline"
                    >
                      {monthName}
                    </Link>

                    {month.incomplete && (
                      <span
                        className="ml-2 text-amber-600 dark:text-amber-400"
                        title={t("year.monthIncomplete")}
                      >
                        *
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right tabular-nums">
                    {month.driveCount}
                  </td>

                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatKm(month.distanceKm)}
                  </td>

                  <td className="px-3 py-2 text-right tabular-nums">
                    {currency.format(month.amountEur)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="border-t border-neutral-200 bg-neutral-50/80 font-semibold dark:border-neutral-800 dark:bg-neutral-800/60">
            <tr>
              <td className="px-3 py-3">{t("total")}</td>
              <td className="px-3 py-3 text-right tabular-nums">
                {report.totals.driveCount}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatKm(report.totals.distanceKm)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {currency.format(report.totals.amountEur)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t("year.roundingNote")}
      </p>
    </div>
  );
}
