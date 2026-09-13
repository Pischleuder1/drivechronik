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
import { MetricGrid, MetricItem } from "../../../components/ui/MetricGrid";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
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
      <PageHeader
        visual="charge"
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        actions={
          <>
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
          </>
        }
      />

      {/* Monat / AC-DC Übersicht */}
      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <ChargeMonthFilters month={month} />
      </section>

      {/* Kennzahlen */}
      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={t("page.stats.sessions")}
            valueClassName="mt-1 text-base font-semibold tabular-nums"
          value={sessions.length}
          tone="sky"
          icon={<Zap className="h-4 w-4" />}
          footer={
            <div className="flex items-center gap-1.5">
              <StatusBadge tone="sky">
                AC <span className="ml-1 tabular-nums">{acCount}</span>
              </StatusBadge>

              <StatusBadge tone="violet">
                DC <span className="ml-1 tabular-nums">{dcCount}</span>
              </StatusBadge>
            </div>
          }
        />

        <StatCard
          label={t("page.stats.energyAdded")}
            valueClassName="mt-1 text-base font-semibold tabular-nums"
          value={formatKwh(totalEnergy)}
          tone="emerald"
          icon={<Battery className="h-4 w-4" />}
        />

        <StatCard
          label={t("page.stats.totalCost")}
            valueClassName="mt-1 text-base font-semibold tabular-nums"
          value={
            costsPresent.length > 0
              ? formatCost(String(totalCost), totalCurrency)
              : t("page.session.costMissing")
          }
          hint={
            hasCostsMissing && costsPresent.length > 0
              ? t("page.stats.costsPartial")
              : undefined
          }
          tone="violet"
          icon={<ReceiptText className="h-4 w-4" />}
        />
      </section>

      {/* Ladevorgänge */}
      <section className="mt-6">
        <SectionHeader
          title={t("page.stats.sessions")}
          count={sessions.length}
          tone="sky"
          className="mb-3"
        />

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
                      <StatusBadge
                        tone={s.chargerType === "ac" ? "sky" : "violet"}
                      >
                        {s.chargerType === "ac"
                          ? t("page.session.chargerAc")
                          : t("page.session.chargerDc")}
                      </StatusBadge>
                    )}

                    <ChevronRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700 dark:group-hover:text-neutral-200" />
                  </div>
                </div>

                <MetricGrid columns={5} className="mt-4">
                  <MetricItem
                    label={t("page.session.energy")}
                    icon={
                      <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    }
                    value={
                      s.energyAddedKwh != null
                        ? formatKwh(s.energyAddedKwh, { sign: true })
                        : "–"
                    }
                  />

                  <MetricItem
                    label={t("page.session.soc")}
                    icon={
                      <Battery className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    }
                    value={
                      <>
                        {s.startSoc != null ? formatSoc(s.startSoc) : "–"}
                        {" → "}
                        {s.endSoc != null ? formatSoc(s.endSoc) : "–"}
                      </>
                    }
                  />

                  <MetricItem
                    label={t("page.session.maxPower")}
                    icon={
                      <Gauge className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    }
                    value={
                      s.maxPowerKw != null
                        ? `${s.maxPowerKw.toFixed(1)} kW`
                        : "–"
                    }
                  />

                  <MetricItem
                    label={t("page.session.duration")}
                    icon={
                      <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    }
                    value={
                      s.durationSeconds != null
                        ? formatDuration(s.durationSeconds)
                        : "–"
                    }
                  />

                  <MetricItem
                    label={t("page.session.cost")}
                    icon={
                      <ReceiptText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    }
                    value={
                      s.cost == null
                        ? t("page.session.costMissing")
                        : formatCost(s.cost, s.currency)
                    }
                    muted={s.cost == null}
                    className="col-span-2 sm:col-span-1"
                  />
                </MetricGrid>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
