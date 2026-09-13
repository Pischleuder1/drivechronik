import Link from "next/link";
import { Download } from "lucide-react";
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
import { getVehicles } from "../../../lib/queries";
import {
  getMonthSealHistory,
  getMonthSealStatus,
} from "../../../lib/monthSealStatus";
import { MonthSealCard } from "./MonthSealCard";

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
  return parts.length > 0 ? parts : DEFAULT_CLASSIFICATIONS;
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

  const vehicles = await getVehicles();

  if (vehicles.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          visual="document"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <Link
              href={`/reports/year?year=${month.slice(0, 4)}`}
              className={buttonClasses("secondary", "md")}
            >
              {t("year.open")}
            </Link>
          }
        />

        <Panel className="mt-4" padding="sm">
          <ReportFilters month={month} selected={selected} />
        </Panel>

        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const [data, reimbursementRate] = await Promise.all([
    loadMonthReportData(month, selected),
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

  const exportQuery = `?classification=${selected.join(",")}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        visual="document"
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link
            href={`/reports/year?year=${month.slice(0, 4)}`}
            className={buttonClasses("secondary", "md")}
          >
            {t("year.open")}
          </Link>
        }
      />

      <Panel className="mt-4" padding="sm">
        <ReportFilters month={month} selected={selected} />
      </Panel>

      <div className="mt-4 flex gap-1.5">
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

      <MonthSealCard
        month={month}
        vehicleId={data.meta.vehicleId}
        status={monthSealStatus}
        history={monthSealHistory}
        canSeal={canSeal}
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ALL_CLASSIFICATIONS.filter((c) => selected.includes(c)).map((c) => {
          const bucket = report.byClassification[c];

          return (
            <StatCard
              key={c}
              label={tc(`classification.${c}`)}
              value={formatKm(bucket.distanceKm)}
              tone={classificationTone(c)}
              footer={
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("driveCountLabel", { count: bucket.driveCount })}
                </p>
              }
            />
          );
        })}

        <StatCard
          label={t("total")}
          value={formatKm(report.totals.distanceKm)}
          tone="violet"
          footer={
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("driveCountLabel", { count: report.totals.driveCount })}
            </p>
          }
        />
      </div>

      {report.businessReimbursement.applicable && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {t("reimbursement.title")}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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
            </div>

            <div className="text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("reimbursement.amount")}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(report.businessReimbursement.amountEur)}
              </p>
            </div>
          </div>

          {report.businessReimbursement.incomplete && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              {t("reimbursement.incomplete")}
            </p>
          )}
        </div>
      )}

      {report.hasIncompleteData && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          {t("incompleteDataHint")}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
