import {
  Battery,
  Gauge,
  Milestone,
  PlugZap,
  Moon,
  TrendingUp,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getVehicles } from "../../../lib/queries";
import { getVehicleAnalytics } from "../../../lib/vehicleAnalytics";
import { getSoftwareUpdates } from "../../../lib/softwareUpdates";
import { SoftwareTimeline } from "../settings/SoftwareTimeline";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";

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

function MetricCard({
  title,
  icon: Icon,
  children,
  hint,
}: {
  title: string;
  icon: typeof Battery;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden size={17} />
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
      {hint && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
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
    <div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {secondary && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {secondary}
        </p>
      )}
    </div>
  );
}

export default async function VehiclePage() {
  const t = await getTranslations("vehicle");

  const vehicles = await getVehicles();
  const vehicle = vehicles[0];

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-5xl">
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

  const [analytics, softwareUpdates] = await Promise.all([
    getVehicleAnalytics(vehicle.id),
    getSoftwareUpdates(vehicle.id),
  ]);

  const battery = analytics.battery;
  const charging = analytics.charging;
  const drain = analytics.vampireDrain;

  const degradation =
    battery.degradationPercent != null
      ? `${battery.degradationPercent > 0 ? "+" : ""}${battery.degradationPercent.toFixed(1)} %`
      : "—";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        visual="vehicle"
        eyebrow={vehicle.displayName}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <MetricCard
          title={t("battery.title")}
          icon={Battery}
          hint={t("battery.estimated")}
        >
          <div className="grid gap-4">
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
          hint={t("range.hint")}
        >
          <div className="grid gap-4">
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
        >
          <div className="grid gap-4">
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

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <MetricCard
          title={t("charging.title")}
          icon={PlugZap}
          hint={t("charging.hint")}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
          hint={t("drain.hint")}
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    <th className="pb-2 pr-4 font-medium">Datum</th>
                    <th className="pb-2 pr-4 text-right font-medium">
                      {t("history.range")}
                    </th>
                    <th className="pb-2 text-right font-medium">
                      {t("history.odometer")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.history.slice(-14).reverse().map((row) => (
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

      <SoftwareTimeline updates={softwareUpdates} />
    </div>
  );
}
