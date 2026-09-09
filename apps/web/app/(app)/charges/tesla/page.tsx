import Link from "next/link";
import { and, desc, gte, lt } from "drizzle-orm";
import { ExternalLink, ReceiptText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { teslaChargingRecords } from "@drivechronik/db";
import { formatKwh } from "@drivechronik/core";

import { db } from "../../../../lib/db";
import { APP_TIMEZONE } from "../../../../lib/config";
import { todayInAppTz } from "../../../../lib/day";
import { monthBounds } from "../../../../lib/exports/data";
import { isValidMonthParam } from "../../../../lib/exports/params";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "paid" | "open";
type AssignmentFilter = "all" | "matched" | "unmatched";

function currentMonthInAppTz(): string {
  return todayInAppTz().slice(0, 7);
}

function safeStatus(value: string | undefined): StatusFilter {
  return value === "paid" || value === "open" ? value : "all";
}

function safeAssignment(value: string | undefined): AssignmentFilter {
  return value === "matched" || value === "unmatched" ? value : "all";
}

function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function formatMoney(
  value: string | null,
  currency: string | null,
  locale: string,
): string {
  if (value == null) return "–";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  if (currency) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(amount);
    } catch {
      return `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)} ${currency}`;
    }
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTotals(
  totals: Map<string, number>,
  locale: string,
): string {
  if (totals.size === 0) return "–";

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) =>
      formatMoney(String(amount), currency === "?" ? null : currency, locale),
    )
    .join(" · ");
}

function safeTeslaInvoiceUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function TeslaInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    status?: string;
    assignment?: string;
  }>;
}) {
  const t = await getTranslations("charges");
  const locale = await getLocale();
  const sp = await searchParams;

  const month =
    sp.month && isValidMonthParam(sp.month)
      ? sp.month
      : currentMonthInAppTz();

  const statusFilter = safeStatus(sp.status);
  const assignmentFilter = safeAssignment(sp.assignment);

  const { start, end } = monthBounds(month);

  const rows = await db
    .select({
      id: teslaChargingRecords.id,
      chargeSessionId: teslaChargingRecords.chargeSessionId,
      chargeStartTime: teslaChargingRecords.chargeStartTime,
      siteLocationName: teslaChargingRecords.siteLocationName,
      energyKwh: teslaChargingRecords.energyKwh,
      totalIncVat: teslaChargingRecords.totalIncVat,
      currency: teslaChargingRecords.currency,
      invoiceNumber: teslaChargingRecords.invoiceNumber,
      status: teslaChargingRecords.status,
      invoiceUrl: teslaChargingRecords.invoiceUrl,
    })
    .from(teslaChargingRecords)
    .where(
      and(
        gte(teslaChargingRecords.chargeStartTime, start),
        lt(teslaChargingRecords.chargeStartTime, end),
      ),
    )
    .orderBy(desc(teslaChargingRecords.chargeStartTime));

  const filteredRows = rows.filter((row) => {
    const status = row.status?.trim().toUpperCase() ?? "";

    if (statusFilter === "paid" && status !== "PAID") return false;
    if (statusFilter === "open" && status === "PAID") return false;

    if (assignmentFilter === "matched" && row.chargeSessionId == null) {
      return false;
    }

    if (assignmentFilter === "unmatched" && row.chargeSessionId != null) {
      return false;
    }

    return true;
  });

  const invoiceCount = filteredRows.filter(
    (row) => row.invoiceNumber != null && row.invoiceNumber.trim() !== "",
  ).length;

  const matchedCount = filteredRows.filter(
    (row) => row.chargeSessionId != null,
  ).length;

  const totalEnergy = filteredRows.reduce(
    (sum, row) => sum + (row.energyKwh ?? 0),
    0,
  );

  const totalsByCurrency = new Map<string, number>();

  for (const row of filteredRows) {
    if (row.totalIncVat == null) continue;

    const amount = Number(row.totalIncVat);
    if (!Number.isFinite(amount)) continue;

    const currency = row.currency?.trim() || "?";
    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) ?? 0) + amount,
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/charges"
        className="text-sm text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        ← {t("teslaOverview.back")}
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-950/40 dark:text-red-300">
          <ReceiptText aria-hidden size={22} />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("teslaOverview.title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("teslaOverview.subtitle")}
          </p>
        </div>
      </div>

      <form className="mt-6 grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto] dark:border-neutral-800 dark:bg-neutral-900">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("teslaOverview.filters.month")}
          </span>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("teslaOverview.filters.status")}
          </span>
          <select
            name="status"
            defaultValue={statusFilter}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="all">
              {t("teslaOverview.filters.all")}
            </option>
            <option value="paid">
              {t("teslaOverview.status.paid")}
            </option>
            <option value="open">
              {t("teslaOverview.status.open")}
            </option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("teslaOverview.filters.assignment")}
          </span>
          <select
            name="assignment"
            defaultValue={assignmentFilter}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="all">
              {t("teslaOverview.filters.all")}
            </option>
            <option value="matched">
              {t("teslaOverview.assignment.matched")}
            </option>
            <option value="unmatched">
              {t("teslaOverview.assignment.unmatched")}
            </option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {t("teslaOverview.filters.apply")}
          </button>

          <Link
            href={`/charges/tesla?month=${month}`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
          >
            {t("teslaOverview.filters.reset")}
          </Link>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard
          label={t("teslaOverview.stats.entries")}
          value={String(filteredRows.length)}
        />
        <StatCard
          label={t("teslaOverview.stats.invoices")}
          value={String(invoiceCount)}
        />
        <StatCard
          label={t("teslaOverview.stats.energy")}
          value={formatKwh(totalEnergy)}
        />
        <StatCard
          label={t("teslaOverview.stats.total")}
          value={formatTotals(totalsByCurrency, locale)}
        />
        <StatCard
          label={t("teslaOverview.stats.matched")}
          value={`${matchedCount} / ${filteredRows.length}`}
        />
      </div>

      {filteredRows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
          <ReceiptText
            aria-hidden
            className="mx-auto text-neutral-400"
            size={28}
          />
          <p className="mt-3 font-medium">
            {t("teslaOverview.empty.title")}
          </p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("teslaOverview.empty.hint")}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {filteredRows.map((row) => {
            const status = row.status?.trim().toUpperCase() ?? "";
            const isPaid = status === "PAID";
            const invoiceUrl = safeTeslaInvoiceUrl(row.invoiceUrl);

            return (
              <article
                key={row.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(row.chargeStartTime, locale)}
                    </p>
                    <p className="mt-0.5 truncate font-medium">
                      {row.siteLocationName ||
                        t("teslaOverview.row.unknownLocation")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        isPaid
                          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }
                    >
                      {isPaid
                        ? t("teslaOverview.status.paid")
                        : t("teslaOverview.status.open")}
                    </span>

                    <span
                      className={
                        row.chargeSessionId != null
                          ? "rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      }
                    >
                      {row.chargeSessionId != null
                        ? t("teslaOverview.assignment.matched")
                        : t("teslaOverview.assignment.unmatched")}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("teslaOverview.row.invoice")}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {row.invoiceNumber ||
                        t("teslaOverview.row.noInvoice")}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("teslaOverview.row.energy")}
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {row.energyKwh != null
                        ? formatKwh(row.energyKwh)
                        : "–"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("teslaOverview.row.amount")}
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatMoney(
                        row.totalIncVat,
                        row.currency,
                        locale,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("teslaOverview.row.status")}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {status === "PAID"
                        ? t("teslaOverview.status.paid")
                        : status === "OPEN" || status === "PENDING"
                          ? t("teslaOverview.status.open")
                          : row.status || "–"}
                    </dd>
                  </div>
                </dl>

                {(row.chargeSessionId != null || invoiceUrl) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                    {row.chargeSessionId != null && (
                      <Link
                        href={`/charges/${row.chargeSessionId}`}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium transition hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
                      >
                        {t("teslaOverview.actions.openCharge")}
                      </Link>
                    )}

                    {invoiceUrl && (
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium transition hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600"
                      >
                        {t("teslaOverview.actions.openInvoice")}
                        <ExternalLink aria-hidden size={14} />
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
