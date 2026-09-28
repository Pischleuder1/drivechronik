import Link from "next/link";
import {
  Briefcase,
  Car,
  CalendarRange,
  Download,
  Euro,
  HelpCircle,
  Route,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  buildMonthReport,
  formatKm,
  formatTime,
  type Classification,
} from "@drivechronik/core";
import { getBusinessReimbursementRateEurPerKm } from "../../../lib/appSettings";
import { loadMonthReportData } from "../../../lib/exports/data";
import { isValidMonthParam } from "../../../lib/exports/params";
import { todayInAppTz } from "../../../lib/day";
import { buttonClasses } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ReportFilters } from "./ReportFilters";

import { NoVehicleState } from "../../../components/NoVehicleState";
import { getActiveVehicle } from "../../../lib/activeVehicle";
import { getVehicles } from "../../../lib/queries";
import {
  getMonthSealHistory,
  getMonthSealStatus,
} from "../../../lib/monthSealStatus";
import { MonthSealCard } from "./MonthSealCard";
import { MobileReportsHero } from "./MobileReportsHero";

export const dynamic = "force-dynamic";

const ALL_CLASSIFICATIONS: Classification[] = [
  "unclassified",
  "private",
  "business",
  "commute",
];

/** Default filter: only "Geschäftlich" checked (vision.md §8.4 main use case). */
const DEFAULT_CLASSIFICATIONS: Classification[] = ["business"];

function classificationTone(
  classification: Classification,
): "blue" | "emerald" | "amber" | "neutral" {
  switch (classification) {
    case "business":
      return "blue";
    case "private":
      return "emerald";
    case "commute":
      return "amber";
    case "unclassified":
    default:
      return "neutral";
  }
}

function currentMonthInAppTz(): string {
  return todayInAppTz().slice(0, 7);
}

function parseSelected(raw: string | undefined): Classification[] {
  if (raw == null || raw.trim() === "") return DEFAULT_CLASSIFICATIONS;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Classification =>
      ALL_CLASSIFICATIONS.includes(s as Classification),
    );
  if (parts.length === 1 && parts[0] === "business") {
    return DEFAULT_CLASSIFICATIONS;
  }

  if (parts.length === 1 && parts[0] === "private") {
    return ["private"];
  }

  return ALL_CLASSIFICATIONS;
}

function formatDateCell(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; classification?: string }>;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("reports"),
    getTranslations("common"),
    getLocale(),
  ]);
  const sp = await searchParams;
  const month = sp.month && isValidMonthParam(sp.month) ? sp.month : currentMonthInAppTz();
  const selected = parseSelected(sp.classification);

  const [activeVehicle, vehicles] = await Promise.all([
    getActiveVehicle(),
    getVehicles(),
  ]);

  if (!activeVehicle) {
    return (
      <div className="mobile-reports-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
        <MobileReportsHero
          vehicles={vehicles.map((vehicle) => ({
            id: vehicle.id,
            displayName: vehicle.displayName,
          }))}
          initialVehicleId={null}
          title={t("title")}
        />

        <div className="hidden md:block">
          <PageHeader
            visual="document"
            title={t("title")}
            subtitle={t("subtitle")}
          />
        </div>

        <Panel className="relative z-10 -mt-5 md:mt-4" padding="sm">
          <ReportFilters month={month} selected={selected} />
        </Panel>

        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const [data, reimbursementRate] = await Promise.all([
    loadMonthReportData(month, selected, activeVehicle.id),
    getBusinessReimbursementRateEurPerKm(),
  ]);

  const report = buildMonthReport(
    data.drives,
    month,
    data.meta,
    selected,
    reimbursementRate,
  );

  const monthSealStatus = await getMonthSealStatus(
    month,
    data.meta.vehicleId,
  );

  const monthSealHistory = await getMonthSealHistory(
    month,
    data.meta.vehicleId,
  );

  const canSeal = month < currentMonthInAppTz();

  const exportQuery = `?classification=${selected.join(",")}&vehicle=${activeVehicle.id}`;

  return (
    <div className="mobile-reports-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileReportsHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={activeVehicle.id}
        title={t("title")}
      />

      <div className="hidden md:block">
        <PageHeader
          visual="document"
          title={t("title")}
          subtitle={t("subtitle")}
        />
      </div>

      <Panel className="relative z-10 -mt-5 md:mt-4" padding="sm">
        <div className="space-y-3">
          <ReportFilters month={month} selected={selected} />

          <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <a
                  href={`/api/export/month/${month}${exportQuery}&format=csv`}
                  className={buttonClasses("ghost", "sm")}
                >
                  <Download aria-hidden size={14} />
                  {t("exportCsv")}
                </a>

                <a
                  href={`/api/export/month/${month}${exportQuery}&format=pdf`}
                  className={buttonClasses("ghost", "sm")}
                >
                  <Download aria-hidden size={14} />
                  {t("exportPdf")}
                </a>
              </div>

              <Link
                href={`/reports/year?year=${month.slice(0, 4)}&classification=${selected.join(",")}`}
                className={buttonClasses(
                "secondary",
                "sm",
                "!h-8 min-w-[150px] justify-center",
              )}
              >
                <CalendarRange aria-hidden size={14} />
                {t("year.open")}
              </Link>
            </div>

            <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <MonthSealCard
                month={month}
                vehicleId={data.meta.vehicleId}
                status={monthSealStatus}
                history={monthSealHistory}
                canSeal={canSeal}
                embedded
              />
            </div>
          </div>
        </div>
      </Panel>


      <div className="mobile-report-kpis mt-4 grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        {ALL_CLASSIFICATIONS.filter((c) => selected.includes(c)).map((c) => {
          const bucket = report.byClassification[c];

          return (
            <StatCard
              className="p-3"
              valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
              key={c}
              label={tc(`classification.${c}`)}
              value={formatKm(bucket.distanceKm)}
              tone={classificationTone(c)}
              icon={
                c === "business" ? (
                  <Briefcase className="h-4 w-4" />
                ) : c === "private" ? (
                  <Car className="h-4 w-4" />
                ) : c === "commute" ? (
                  <Route className="h-4 w-4" />
                ) : (
                  <HelpCircle className="h-4 w-4" />
                )
              }
              footer={
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("driveCountLabel", { count: bucket.driveCount })}
                </p>
              }
            />
          );
        })}

        <StatCard

          valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
          label={t("total")}
          value={formatKm(report.totals.distanceKm)}
          tone="sky"
          icon={<Route className="h-4 w-4" />}
          footer={
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("driveCountLabel", { count: report.totals.driveCount })}
            </p>
          }
        />
        {report.businessReimbursement.applicable && (
          <StatCard
            className="p-3"
            valueClassName="mt-0.5 text-base font-semibold tracking-tight tabular-nums"
            label={t("reimbursement.title")}
            value={new Intl.NumberFormat(locale, {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(report.businessReimbursement.amountEur)}
            tone="cyan"
            icon={<Euro className="h-4 w-4" />}
            footer={
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("reimbursement.formula", {
                    km: new Intl.NumberFormat(locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(report.businessReimbursement.distanceKm),
                    rate: new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(report.businessReimbursement.rateEurPerKm),
                  })}
                </p>

                {report.businessReimbursement.incomplete && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {t("reimbursement.incomplete")}
                  </p>
                )}
              </div>
            }
          />
        )}

      </div>

      {report.hasIncompleteData && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          {t("incompleteDataHint")}
        </p>
      )}

      <div className="mt-4 space-y-2 md:hidden">
        {report.rows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            {t("table.empty")}
          </div>
        ) : (
          report.rows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/drives/${row.id}`}
                    className="text-[14px] font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
                  >
                    {formatDateCell(row.date)}
                  </Link>

                  <p className="mt-0.5 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400">
                    {formatTime(row.startTime, row.meta.timeZone)}
                    {row.endTime
                      ? ` – ${formatTime(row.endTime, row.meta.timeZone)}`
                      : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {row.distanceKm != null ? formatKm(row.distanceKm) : "–"}
                  </p>

                  <div className="mt-1">
                    <StatusBadge tone={classificationTone(row.classification)}>
                      {tc(`classification.${row.classification}`)}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-950">
                <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                  {row.startPlace}
                </p>

                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-neutral-600 dark:text-neutral-300">
                  <span className="text-blue-500">→</span>
                  <span className="truncate">{row.endPlace}</span>
                </p>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-3xl border border-neutral-200/80 bg-white shadow-sm md:block dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3">{t("table.date")}</th>
              <th className="px-4 py-3">{t("table.time")}</th>
              <th className="px-4 py-3">{t("table.route")}</th>
              <th className="px-4 py-3 text-right">{t("table.km")}</th>
              <th className="px-4 py-3">{t("table.classification")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {report.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-neutral-500 dark:text-neutral-400"
                >
                  {t("table.empty")}
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={`/drives/${row.id}`}
                      className="hover:underline"
                    >
                      {formatDateCell(row.date)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {formatTime(row.startTime, row.meta.timeZone)}
                    {row.endTime ? ` – ${formatTime(row.endTime, row.meta.timeZone)}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {row.startPlace} <span className="text-neutral-400">→</span>{" "}
                    {row.endPlace}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {row.distanceKm != null ? formatKm(row.distanceKm) : "–"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge tone={classificationTone(row.classification)}>
                      {tc(`classification.${row.classification}`)}
                    </StatusBadge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
