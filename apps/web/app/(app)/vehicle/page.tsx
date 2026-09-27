import {
  Battery,
  Gauge,
  Milestone,
  PlugZap,
  Moon,
  TrendingUp,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getActiveVehicle } from "../../../lib/activeVehicle";
import { getVehicles } from "../../../lib/queries";
import { getVehicleAnalytics } from "../../../lib/vehicleAnalytics";
import { getVehicleStateTimeline } from "../../../lib/vehicleStateTimeline";
import { getSoftwareUpdates } from "../../../lib/softwareUpdates";
import { SoftwareTimeline } from "../settings/SoftwareTimeline";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { formatTeslaModel } from "../../../lib/vehicleDisplay";
import {
  currentVehicleUsageKeys,
  getVehicleUsageSummary,
  resolveVehicleUsageSelection,
} from "../../../lib/vehicleUsage";
import { VehicleUsageFilter } from "./VehicleUsageFilter";
import { VehicleStateTimeline } from "./VehicleStateTimeline";
import { TpmsHistory } from "./TpmsHistory";
import { MobileVehicleHero } from "./MobileVehicleHero";

import { IconBadge, type IconBadgeTone } from "../../../components/ui/IconBadge";

export const dynamic = "force-dynamic";

function valueOrDash(
  value: number | null,
  digits = 1,
  suffix = "",
): string {
  if (value == null || !Number.isFinite(value)) return "—";

  return `${value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
}

function MetricCard({
  title,
  icon: Icon,
  tone = "neutral",
  children,
  hint,
}: {
  title: string;
  icon: typeof Battery;
  tone?: IconBadgeTone;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Panel padding="none">
      <div className="p-3 md:p-5">
        <div className="flex items-center gap-2.5">
          <IconBadge tone={tone} size="sm">
            <Icon aria-hidden size={18} />
          </IconBadge>

          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
        </div>

        <div className="mt-3 md:mt-4">{children}</div>

        {hint && (
          <p className="mt-2 text-[10px] leading-snug text-neutral-500 md:mt-3 md:text-xs md:leading-relaxed dark:text-neutral-400">
            {hint}
          </p>
        )}
      </div>
    </Panel>
  );
}

function DataValue({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] leading-tight text-neutral-500 md:text-xs dark:text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-[18px] font-semibold leading-tight tabular-nums text-neutral-900 md:text-xl dark:text-neutral-100">
        {value}
      </p>

      {secondary && (
        <p className="mt-1 text-[10px] leading-snug text-neutral-500 md:text-xs dark:text-neutral-400">
          {secondary}
        </p>
      )}
    </div>
  );
}

export default async function VehiclePage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    value?: string;
  }>;
}) {
  const t = await getTranslations("vehicle");
  const params = await searchParams;

  const usageSelection = resolveVehicleUsageSelection(
    params.period,
    params.value,
  );
  const currentUsageKeys = currentVehicleUsageKeys();

  const vehicle = await getActiveVehicle();
  const vehicles = await getVehicles();

  if (!vehicle) {
    return (
      <div className="w-full">
        <PageHeader
          visual="vehicle"
          title={t("title")}
        />

        <Panel className="mt-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("noVehicle")}
          </p>
        </Panel>
      </div>
    );
  }

  const [analytics, softwareUpdates, usage, stateTimeline] =
    await Promise.all([
      getVehicleAnalytics(vehicle.id),
      getSoftwareUpdates(vehicle.id),
      getVehicleUsageSummary(vehicle.id, usageSelection),
      getVehicleStateTimeline(vehicle.id, 30),
    ]);

  const battery = analytics.battery;
  const charging = analytics.charging;
  const drain = analytics.vampireDrain;

  const degradation =
    battery.degradationPercent != null
      ? `${battery.degradationPercent > 0 ? "+" : ""}${battery.degradationPercent.toFixed(1)} %`
      : "—";

  return (
    <div className="mobile-vehicle-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobileVehicleHero
        vehicles={vehicles.map((entry) => ({
          id: entry.id,
          displayName: entry.displayName,
        }))}
        initialVehicleId={vehicle.id}
        displayName={vehicle.displayName}
        model={vehicle.model}
        pageTitle={t("title")}
      />

      <div className="hidden md:block">
        <PageHeader
          visual="vehicle"
          eyebrow={vehicle.displayName}
          title={t("title")}
          subtitle={t("subtitle")}
        />
      </div>

      <Panel className="relative z-10 -mt-5 md:mt-6">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {t("identity.title")}
        </h2>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 md:mt-4 md:grid-cols-3 md:gap-4">
          <div>
            <p className="text-[11px] text-neutral-500 md:text-xs dark:text-neutral-400">
              {t("identity.model")}
            </p>
            <p className="mt-0.5 text-[15px] font-medium text-neutral-900 md:mt-1 md:text-base dark:text-neutral-100">
              {formatTeslaModel(vehicle.model) || "—"}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-neutral-500 md:text-xs dark:text-neutral-400">
              {t("identity.licensePlate")}
            </p>
            <p className="mt-0.5 text-[15px] font-medium text-neutral-900 md:mt-1 md:text-base dark:text-neutral-100">
              {vehicle.licensePlate || "—"}
            </p>
          </div>

          <div className="col-span-2 md:col-span-1">
            <p className="text-[11px] text-neutral-500 md:text-xs dark:text-neutral-400">
              {t("identity.vin")}
            </p>
            <p className="mt-0.5 break-all font-mono text-[12px] font-medium text-neutral-900 md:mt-1 md:text-sm dark:text-neutral-100">
              {vehicle.vin || "—"}
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="mt-3 border-t-4 border-t-violet-500 dark:border-t-violet-400">
        <h2 className="text-[17px] font-semibold text-neutral-900 md:text-lg dark:text-neutral-100">
          {t("usage.title")}
        </h2>

        <VehicleUsageFilter
          period={usageSelection.period}
          value={usageSelection.value}
          currentDay={currentUsageKeys.day}
          currentMonth={currentUsageKeys.month}
          currentYear={currentUsageKeys.year}
          labels={{
            day: t("usage.period.day"),
            month: t("usage.period.month"),
            year: t("usage.period.year"),
            all: t("usage.period.all"),
            previous: t("usage.period.previous"),
            next: t("usage.period.next"),
          }}
        />

        <div className="mt-3 grid gap-3 md:mt-5 lg:grid-cols-2">
          <div className="rounded-[16px] border border-neutral-200 border-t-[3px] border-t-sky-500 p-3 md:rounded-2xl md:border-t-4 md:p-4 dark:border-neutral-800 dark:border-t-sky-400">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("usage.driving.title")}
            </h3>

            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px] [&>div:last-child]:col-span-2 md:mt-3 md:grid-cols-1 md:gap-x-6 md:text-base md:[&>div:last-child]:col-span-1 lg:grid-cols-2">
              {[
                [
                  t("usage.driving.drives"),
                  usage.driveCount.toLocaleString("de-DE"),
                ],
                [
                  t("usage.driving.distance"),
                  `${usage.distanceKm.toLocaleString("de-DE", {
                    maximumFractionDigits: 1,
                  })} km`,
                ],
                [
                  t("usage.driving.duration"),
                  formatDuration(usage.durationSeconds),
                ],
                [
                  t("usage.driving.energy"),
                  `${usage.consumedEnergyKwh.toLocaleString("de-DE", {
                    maximumFractionDigits: 1,
                  })} kWh${usage.energyEstimated ? " ~" : ""}`,
                ],
                [
                  t("usage.driving.consumption"),
                  usage.avgConsumptionWhKm != null
                    ? `${Math.round(
                        usage.avgConsumptionWhKm,
                      ).toLocaleString("de-DE")} Wh/km`
                    : "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-h-[58px] flex-col justify-between rounded-xl bg-neutral-50 px-2.5 py-2 md:min-h-0 md:flex-row md:items-center md:gap-3 md:rounded-none md:border-b md:border-neutral-100 md:bg-transparent md:px-0 md:py-1.5 md:last:border-0 dark:bg-neutral-800/60 md:dark:bg-transparent md:dark:border-neutral-800"
                >
                  <dt className="text-[11px] leading-tight text-neutral-500 md:text-base dark:text-neutral-400">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold tabular-nums text-neutral-900 md:mt-0 md:text-base dark:text-neutral-100">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {(usage.energyEstimated || usage.energyIncomplete) && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {[
                  usage.energyEstimated
                    ? t("usage.estimated")
                    : null,
                  usage.energyIncomplete
                    ? t("usage.incomplete")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div className="rounded-[16px] border border-neutral-200 border-t-[3px] border-t-emerald-500 p-3 md:rounded-2xl md:border-t-4 md:p-4 dark:border-neutral-800 dark:border-t-emerald-400">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("usage.charging.title")}
            </h3>

            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px] md:mt-3 md:grid-cols-1 md:gap-x-6 md:text-base lg:grid-cols-2">
              {[
                [
                  t("usage.charging.sessions"),
                  usage.chargeCount.toLocaleString("de-DE"),
                ],
                [
                  t("usage.charging.dcSessions"),
                  usage.dcChargeCount.toLocaleString("de-DE"),
                ],
                [
                  t("usage.charging.energy"),
                  `${usage.chargedEnergyKwh.toLocaleString("de-DE", {
                    maximumFractionDigits: 1,
                  })} kWh`,
                ],
                [
                  t("usage.charging.duration"),
                  formatDuration(usage.chargeDurationSeconds),
                ],
                [
                  t("usage.charging.cost"),
                  `${usage.totalCostEur.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  })}${usage.costIncomplete ? " *" : ""}`,
                ],
                [
                  t("usage.charging.averagePrice"),
                  usage.avgPricePerKwh != null
                    ? usage.avgPricePerKwh.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 3,
                      })
                    : "—",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-h-[58px] flex-col justify-between rounded-xl bg-neutral-50 px-2.5 py-2 md:min-h-0 md:flex-row md:items-center md:gap-3 md:rounded-none md:border-b md:border-neutral-100 md:bg-transparent md:px-0 md:py-1.5 md:last:border-0 dark:bg-neutral-800/60 md:dark:bg-transparent md:dark:border-neutral-800"
                >
                  <dt className="text-[11px] leading-tight text-neutral-500 md:text-base dark:text-neutral-400">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold tabular-nums text-neutral-900 md:mt-0 md:text-base dark:text-neutral-100">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {usage.costIncomplete && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                * {t("usage.incomplete")}
              </p>
            )}
          </div>
        </div>
      </Panel>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3 md:gap-3">
        <MetricCard
          title={t("battery.title")}
          icon={Battery}
          tone="emerald"
          hint={t("battery.estimated")}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
            <DataValue
              label={t("battery.capacity")}
              value={valueOrDash(
                battery.usableCapacityKwh,
                1,
                " kWh",
              )}
              secondary={
                battery.sampleCount > 0
                  ? t("battery.samples", {
                      count: battery.sampleCount,
                    })
                  : undefined
              }
            />

            <DataValue
              label={t("battery.degradation")}
              value={degradation}
              secondary={
                battery.degradationPercent == null
                  ? t("battery.notEnoughForDegradation")
                  : undefined
              }
            />
          </div>
        </MetricCard>

        <MetricCard
          title={t("range.title")}
          icon={Gauge}
          tone="blue"
          hint={t("range.hint")}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
            <DataValue
              label={t("range.current")}
              value={valueOrDash(
                analytics.range.currentRatedRangeKm,
                0,
                " km",
              )}
            />
            <DataValue
              label={t("range.projected")}
              value={valueOrDash(
                analytics.range.projectedRange100Km,
                0,
                " km",
              )}
            />
          </div>
        </MetricCard>

        <MetricCard
          title={t("odometer.title")}
          icon={Milestone}
          tone="indigo"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
            <DataValue
              label={t("odometer.current")}
              value={valueOrDash(
                analytics.odometer.currentKm,
                0,
                " km",
              )}
            />
            <DataValue
              label={t("odometer.last30")}
              value={valueOrDash(
                analytics.odometer.delta30DaysKm,
                0,
                " km",
              )}
            />
          </div>
        </MetricCard>
      </div>

      <div className="mt-2.5 grid gap-2.5 md:mt-3 md:grid-cols-2 md:gap-3">
        <MetricCard
          title={t("charging.title")}
          icon={PlugZap}
          tone="cyan"
          hint={t("charging.hint")}
        >
          <div className="grid grid-cols-2 gap-3 md:gap-x-6 md:gap-y-4">
            <DataValue
              label={t("charging.efficiency")}
              value={valueOrDash(
                charging.efficiencyPercent,
                1,
                " %",
              )}
              secondary={
                charging.sessionCount > 0
                  ? t("charging.sessions", {
                      count: charging.sessionCount,
                      ac: charging.acSessionCount,
                      dc: charging.dcSessionCount,
                    })
                  : undefined
              }
            />

            <DataValue
              label={t("charging.batteryEnergy")}
              value={valueOrDash(
                charging.energyAddedKwh,
                1,
                " kWh",
              )}
            />

            <DataValue
              label={t("charging.gridEnergy")}
              value={valueOrDash(
                charging.energyUsedKwh,
                1,
                " kWh",
              )}
            />
          </div>
        </MetricCard>

        <MetricCard
          title={t("drain.title")}
          icon={Moon}
          tone="violet"
          hint={t("drain.hint")}
        >
          <div className="grid grid-cols-2 gap-3 md:gap-x-6 md:gap-y-4">
            <DataValue
              label={t("drain.soc")}
              value={valueOrDash(
                drain.socLossPer24h,
                1,
                " %",
              )}
            />

            <DataValue
              label={t("drain.range")}
              value={valueOrDash(
                drain.ratedRangeLossPer24hKm,
                1,
                " km",
              )}
            />
          </div>

          {drain.sampleCount > 0 && (
            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
              {t("drain.samples", {
                count: drain.sampleCount,
              })}
            </p>
          )}
        </MetricCard>
      </div>

      <VehicleStateTimeline
        timeline={stateTimeline}
        labels={{
          title: t("status.title"),
          subtitle: t("status.subtitle"),
          sleepShare: t("status.sleepShare"),
          sleepTime: t("status.sleepTime"),
          onlineTime: t("status.onlineTime"),
          coverage: t("status.coverage"),
          asleep: t("status.asleep"),
          online: t("status.online"),
          offline: t("status.offline"),
          driving: t("status.driving"),
          charging: t("status.charging"),
          sleep: t("status.sleep"),
          empty: t("status.empty"),
          hint: t("status.hint"),
          lowCoverage: t("status.lowCoverage"),
        }}
      />

      <Panel className="mt-6">
        <div className="flex items-center gap-2">
          <TrendingUp
            aria-hidden
            size={17}
            className="text-neutral-500 dark:text-neutral-400"
          />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("history.title")}
          </h2>
        </div>

        {analytics.history.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            {t("history.empty")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t("history.days", {
                count: analytics.history.length,
              })}
            </p>

            <div className="mt-3 space-y-2 md:hidden">
              {analytics.history.slice(-7).reverse().map((row) => (
                <div
                  key={row.ts.toISOString()}
                  className="rounded-[14px] border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-800/60"
                >
                  <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {row.ts.toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>

                  <div className="mt-1.5 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {t("history.range")}
                      </p>

                      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {valueOrDash(
                          row.projectedRange100Km,
                          0,
                          " km",
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {t("history.odometer")}
                      </p>

                      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {valueOrDash(
                          row.odometerKm,
                          0,
                          " km",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    <th className="pb-2 pr-4 font-medium">
                      Datum
                    </th>

                    <th className="pb-2 pr-4 text-right font-medium">
                      {t("history.range")}
                    </th>

                    <th className="pb-2 text-right font-medium">
                      {t("history.odometer")}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {analytics.history.slice(-7).reverse().map((row) => (
                    <tr
                      key={row.ts.toISOString()}
                      className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                    >
                      <td className="py-2 pr-4">
                        {row.ts.toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-2 pr-4 text-right tabular-nums">
                        {valueOrDash(
                          row.projectedRange100Km,
                          0,
                          " km",
                        )}
                      </td>

                      <td className="py-2 text-right tabular-nums">
                        {valueOrDash(
                          row.odometerKm,
                          0,
                          " km",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <TpmsHistory
        history={analytics.tpms.history}
        alerts30={analytics.tpms.alerts30}
        alerts90={analytics.tpms.alerts90}
      />

      <SoftwareTimeline updates={softwareUpdates} compact />
    </div>
  );
}
