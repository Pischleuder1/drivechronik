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
import { getActiveVehicleId } from "../../../lib/activeVehicle";
import {
  getChargeSessionsInRange,
  getVehicles,
} from "../../../lib/queries";
import { getChargingAnalytics } from "../../../lib/chargeAnalytics";
import { getChargeCurve } from "../../../lib/chargeCurve";
import { EmptyState } from "../../../components/ui/EmptyState";
import { MetricGrid, MetricItem } from "../../../components/ui/MetricGrid";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ChargeMonthFilters } from "./ChargeMonthFilters";
import { ChargeCurveComparison } from "./ChargeCurveComparison";
import { MobileChargesHero } from "./MobileChargesHero";

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

  const vehicleId = await getActiveVehicleId();
  const vehicles = await getVehicles();
  const activeVehicle =
    vehicleId != null
      ? vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null
      : null;

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

  // Der Ladekurvenvergleich ist unabhängig vom ausgewählten Monat.
  // Er verwendet immer die letzten bis zu zehn DC-Ladevorgänge.
  const dcAnalytics =
    vehicleId != null
      ? await getChargingAnalytics(vehicleId, 10)
      : {
          sessions: [],
          medianPeakKw: null,
          medianTenToEightySeconds: null,
          locationRanking: [],
          slowAlerts: [],
        };

  const dcCurveComparison = await Promise.all(
    dcAnalytics.sessions.map(async (session) => ({
      id: session.id,
      startTime: session.startTime.getTime(),
      label:
        session.placeName ??
        session.address ??
        t("analysis.unknownLocation"),
      points: await getChargeCurve(session.id),
    })),
  );

  return (
    <div className="mobile-charges-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <div className="md:hidden">
        <MobileChargesHero
          vehicles={vehicles.map((vehicle) => ({
            id: vehicle.id,
            displayName: vehicle.displayName,
          }))}
          initialVehicleId={activeVehicle?.id ?? null}
          displayName={activeVehicle?.displayName ?? null}
          pageTitle={t("page.title")}
        />

        <section className="relative z-10 -mt-8 rounded-[20px] border border-neutral-200 bg-white p-3 shadow-lg shadow-black/10">
          <div className="flex justify-center">
            <ChargeMonthFilters month={month} compact />
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 border-t border-neutral-100 pt-3">
            <Link
              href="/charges/analysis"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 text-[11px] font-medium text-sky-700"
            >
              <Zap aria-hidden className="h-3.5 w-3.5" />
              {t("analysis.title")}
            </Link>

            <Link
              href="/charges/tesla"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 text-[11px] font-medium text-neutral-700"
            >
              <ReceiptText aria-hidden className="h-3.5 w-3.5" />
              {t("teslaOverview.open")}
            </Link>
          </div>
        </section>

        <section className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium leading-tight text-neutral-500">
              {t("page.stats.sessions")}
            </p>

            <p className="mt-1.5 text-[16px] font-semibold tabular-nums text-neutral-950">
              {sessions.length}
            </p>

            <p className="mt-1 text-[9px] text-neutral-400">
              AC {acCount} · DC {dcCount}
            </p>
          </div>

          <div className="rounded-[18px] border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium leading-tight text-neutral-500">
              {t("page.stats.energyAdded")}
            </p>

            <p className="mt-1.5 text-[16px] font-semibold tabular-nums text-neutral-950">
              {formatKwh(totalEnergy)}
            </p>
          </div>

          <div className="rounded-[18px] border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium leading-tight text-neutral-500">
              {t("page.stats.totalCost")}
            </p>

            <p className="mt-1.5 truncate text-[16px] font-semibold tabular-nums text-neutral-950">
              {costsPresent.length > 0
                ? formatCost(String(totalCost), totalCurrency)
                : "–"}
            </p>

            {hasCostsMissing && costsPresent.length > 0 && (
              <p className="mt-1 truncate text-[9px] text-neutral-400">
                {t("page.stats.costsPartial")}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="hidden md:block">
      {/* Header */}
      <PageHeader
        visual="charge"
        title={t("page.title")}
        subtitle={t("page.subtitle")}
      />

      {/* Monat + Aktionen */}
      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChargeMonthFilters month={month} />

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/charges/analysis"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 hover:shadow-sm dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              <Zap className="h-4 w-4" />
              {t("analysis.title")}
            </Link>

            <Link
              href="/charges/tesla"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium transition hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <ReceiptText className="h-4 w-4" />
              {t("teslaOverview.open")}
            </Link>
          </div>
        </div>
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

      </div>

      <div className="hidden md:block">
        <ChargeCurveComparison curves={dcCurveComparison} />
      </div>

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
                className="group relative overflow-hidden rounded-[18px] border border-neutral-200 bg-white p-3 pl-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md md:rounded-2xl md:p-5 md:pl-6 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              >
                {s.chargerType && (
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${CHARGER_BAR[s.chargerType]}`}
                  />
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-xl bg-neutral-100 p-1.5 text-neutral-600 md:p-2 dark:bg-neutral-800 dark:text-neutral-300">
                      <Home className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-neutral-900 md:text-base dark:text-neutral-100">
                        {placeLabel}
                      </p>

                      <p className="mt-0.5 text-[11px] text-neutral-500 md:text-xs dark:text-neutral-400">
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

                <MetricGrid
                  columns={5}
                  mobileColumns={6}
                  className="mt-3 [&>div]:px-2.5 [&>div]:py-2 [&_dt]:text-[11px] [&_dd]:text-[14px] md:mt-4 md:[&>div]:px-3 md:[&>div]:py-2.5 md:[&_dt]:text-xs md:[&_dd]:text-base"
                >
                  <MetricItem
                    label={t("page.session.energy")}
                    className="order-1 col-span-2 sm:order-none sm:col-span-1"
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
                    className="order-2 col-span-2 sm:order-none sm:col-span-1"
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
                    className="order-4 col-span-3 sm:order-none sm:col-span-1"
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
                    className="order-3 col-span-2 sm:order-none sm:col-span-1"
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
                    className="order-5 col-span-3 sm:order-none sm:col-span-1"
                  />
                </MetricGrid>
              </Link>
            );
          })}
        </div>
      </section>
      <details
        open
        className="group mt-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-sm md:hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">
              {t("curveComparison.title")}
            </p>

            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
              {t("analysis.subtitle")}
            </p>
          </div>

          <span
            aria-hidden
            className="shrink-0 text-[22px] leading-none text-neutral-400 transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>

        <div className="border-t border-neutral-100 [&>section]:!mt-0 [&>section]:!rounded-none [&>section]:!border-0 [&>section]:!shadow-none [&>section>div:first-child>div:first-child]:hidden">
          <ChargeCurveComparison curves={dcCurveComparison} />
        </div>
      </details>

    </div>
  );
}
