import Link from "next/link";
import {
  Battery,
  ChevronRight,
  Clock,
  Gauge,
  Home,
  ReceiptText,
  Zap,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  formatDuration,
  formatKwh,
  formatPlaceLabel,
  formatSoc,
  formatTimeRange,
} from "@drivechronik/core";
import { APP_TIMEZONE } from "../../../lib/config";
import { todayInAppTz } from "../../../lib/day";
import { monthBounds } from "../../../lib/exports/data";
import { isValidMonthParam } from "../../../lib/exports/params";
import { getChargeSessionsInRange, getVehicles } from "../../../lib/queries";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ChargeMonthFilters } from "./ChargeMonthFilters";

export const dynamic = "force-dynamic";

function currentMonthInAppTz(): string {
  return todayInAppTz().slice(0, 7);
}

function formatDateCell(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatCost(cost: string | null, currency: string | null): string {
  if (cost == null) return "–";

  const cur = currency ?? "CHF";
  let fmt = currencyFormatters.get(cur);

  if (!fmt) {
    fmt = new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: cur,
    });
    currencyFormatters.set(cur, fmt);
  }

  try {
    return fmt.format(Number(cost));
  } catch {
    return `${Number(cost).toFixed(2)} ${cur}`;
  }
}

const CHARGER_BADGE: Record<"ac" | "dc", string> = {
  ac: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  dc: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

const CHARGER_BAR: Record<"ac" | "dc", string> = {
  ac: "bg-sky-500",
  dc: "bg-violet-500",
};

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const t = await getTranslations("charges");
  const sp = await searchParams;
  const month =
    sp.month && isValidMonthParam(sp.month)
      ? sp.month
      : currentMonthInAppTz();

  const vehicles = await getVehicles();
  const vehicleId = vehicles[0]?.id;
  const { start, end } = monthBounds(month);

  const sessions =
    vehicleId != null
      ? await getChargeSessionsInRange(vehicleId, start, end)
      : [];

  const totalEnergy = sessions.reduce(
    (sum, s) => sum + (s.energyAddedKwh ?? 0),
    0,
  );

  const costsPresent = sessions.filter((s) => s.cost != null);
  const totalCost = costsPresent.reduce(
    (sum, s) => sum + Number(s.cost),
    0,
  );

  const hasCostsMissing =
    costsPresent.length < sessions.length && sessions.length > 0;

  const acCount = sessions.filter((s) => s.chargerType === "ac").length;
  const dcCount = sessions.filter((s) => s.chargerType === "dc").length;

  const totalCurrency = costsPresent[0]?.currency ?? "CHF";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <section className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("page.title")}
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t("page.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/charges/analysis"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              <Zap className="h-4 w-4" />
              {t("analysis.title")}
            </Link>

            <Link
              href="/charges/tesla"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <ReceiptText className="h-4 w-4" />
              {t("teslaOverview.open")}
            </Link>
          </div>
        </div>
      </section>

      {/* Monat / AC-DC Übersicht */}
      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <ChargeMonthFilters month={month} />
      </section>

      {/* Kennzahlen */}
      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 border-t-4 border-t-sky-500 bg-white p-4 shadow-sm dark:border-neutral-800 dark:border-t-sky-500 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t("page.stats.sessions")}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {sessions.length}
              </p>

              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  AC <span className="font-semibold tabular-nums">{acCount}</span>
                </span>
                <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                  DC <span className="font-semibold tabular-nums">{dcCount}</span>
                </span>
              </div>
            </div>
            <span className="rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <Zap className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 border-t-4 border-t-emerald-500 bg-white p-4 shadow-sm dark:border-neutral-800 dark:border-t-emerald-500 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t("page.stats.energyAdded")}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatKwh(totalEnergy)}
              </p>
            </div>
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Battery className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 border-t-4 border-t-violet-500 bg-white p-4 shadow-sm dark:border-neutral-800 dark:border-t-violet-500 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t("page.stats.totalCost")}
              </p>

              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {costsPresent.length > 0
                  ? formatCost(String(totalCost), totalCurrency)
                  : t("page.session.costMissing")}
              </p>

              {hasCostsMissing && costsPresent.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t("page.stats.costsPartial")}
                </p>
              )}
            </div>

            <span className="rounded-xl bg-violet-50 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <ReceiptText className="h-4 w-4" />
            </span>
          </div>
        </div>

      </section>

      {/* Ladevorgänge */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-sky-500" />
            <h2 className="text-base font-semibold">
              {t("page.stats.sessions")}
            </h2>
          </div>

          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {sessions.length}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {sessions.length === 0 && (
            <EmptyState
              icon={Zap}
              title={t("page.empty.title")}
              hint={t("page.empty.hint")}
            />
          )}

          {sessions.map((s) => {
            const placeLabel = formatPlaceLabel(
              s.placeName,
              s.address,
              s.lat,
              s.lon,
            );

            return (
              <Link
                key={s.id}
                href={`/charges/${s.id}`}
                className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 pl-5 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md sm:p-5 sm:pl-6 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              >
                {s.chargerType && (
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${CHARGER_BAR[s.chargerType]}`}
                  />
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-xl bg-neutral-100 p-2 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      <Home className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                        {placeLabel}
                      </p>

                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDateCell(s.startTime)} ·{" "}
                        {formatTimeRange(
                          s.startTime,
                          s.endTime,
                          APP_TIMEZONE,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {s.chargerType && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${CHARGER_BADGE[s.chargerType]}`}
                      >
                        {s.chargerType === "ac"
                          ? t("page.session.chargerAc")
                          : t("page.session.chargerDc")}
                      </span>
                    )}

                    <ChevronRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700 dark:group-hover:text-neutral-200" />
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/70">
                    <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t("page.session.energy")}
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {s.energyAddedKwh != null
                        ? formatKwh(s.energyAddedKwh, { sign: true })
                        : "–"}
                    </dd>
                  </div>

                  <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/70">
                    <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <Battery className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t("page.session.soc")}
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {s.startSoc != null ? formatSoc(s.startSoc) : "–"}
                      {" → "}
                      {s.endSoc != null ? formatSoc(s.endSoc) : "–"}
                    </dd>
                  </div>

                  <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/70">
                    <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <Gauge className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      {t("page.session.maxPower")}
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {s.maxPowerKw != null
                        ? `${s.maxPowerKw.toFixed(1)} kW`
                        : "–"}
                    </dd>
                  </div>

                  <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/70">
                    <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      {t("page.session.duration")}
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {s.durationSeconds != null
                        ? formatDuration(s.durationSeconds)
                        : "–"}
                    </dd>
                  </div>

                  <div className="col-span-2 rounded-xl bg-neutral-50 px-3 py-2.5 sm:col-span-1 dark:bg-neutral-800/70">
                    <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <ReceiptText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      {t("page.session.cost")}
                    </dt>
                    <dd
                      className={`mt-1 font-medium tabular-nums ${
                        s.cost == null
                          ? "text-neutral-400 dark:text-neutral-500"
                          : "text-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      {s.cost == null
                        ? t("page.session.costMissing")
                        : formatCost(s.cost, s.currency)}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
