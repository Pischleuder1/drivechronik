import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Car,
  Clock3,
  Route,
  Zap,
} from "lucide-react";
import {
  getLocale,
  getTranslations,
} from "next-intl/server";
import {
  formatKm,
  formatKwh,
  formatOdometer,
} from "@drivechronik/core";

import type {
  DashboardWeekDay,
  LastChargeStats,
  OpenSessionStatus,
  VehicleStatusRow,
  WeekStats,
} from "../../lib/dashboard";
import { MobileRangeHero } from "./MobileRangeHero";
import { TeslaTopViewTpmsGraphic } from "./TeslaTopViewTpmsGraphic";
import { formatRelativeTime } from "../../lib/day";

function MiniDistanceBars({
  data,
}: {
  data: DashboardWeekDay[];
}) {
  const max = Math.max(
    ...data.map((day) => day.distanceKm),
    1,
  );

  return (
    <svg
      viewBox="0 0 140 42"
      className="h-[31px] w-full text-blue-500"
      aria-hidden
    >
      {data.map((day, index) => {
        const height =
          day.distanceKm > 0
            ? Math.max(3, (day.distanceKm / max) * 32)
            : 2;

        return (
          <rect
            key={day.date}
            x={5 + index * 19}
            y={37 - height}
            width={10}
            height={height}
            rx={3}
            className="fill-current opacity-75"
          />
        );
      })}
    </svg>
  );
}

function MiniConsumptionLine({
  data,
}: {
  data: DashboardWeekDay[];
}) {
  const values = data
    .map((day, index) =>
      day.avgConsumptionWhKm != null
        ? {
            index,
            value: day.avgConsumptionWhKm / 10,
          }
        : null,
    )
    .filter(
      (
        value,
      ): value is {
        index: number;
        value: number;
      } => value != null,
    );

  if (values.length < 2) {
    return (
      <div className="flex h-[31px] items-center">
        <div className="h-px w-full bg-neutral-100" />
      </div>
    );
  }

  const min = Math.min(...values.map((v) => v.value));
  const max = Math.max(...values.map((v) => v.value));
  const range = Math.max(max - min, 1);

  const points = values
    .map(({ index, value }) => {
      const x = 7 + index * 21;
      const y = 35 - ((value - min) / range) * 27;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 140 42"
      className="h-[31px] w-full"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-cyan-500"
      />

      {values.map(({ index, value }) => {
        const x = 7 + index * 21;
        const y = 35 - ((value - min) / range) * 27;

        return (
          <circle
            key={data[index]!.date}
            cx={x}
            cy={y}
            r={2.5}
            className="fill-cyan-500"
          />
        );
      })}
    </svg>
  );
}

function vehicleStateLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  status: VehicleStatusRow,
  openSession: OpenSessionStatus | null,
) {
  if (openSession?.kind === "driving") {
    return t("vehicleCard.drivingNow");
  }

  if (openSession?.kind === "charging") {
    return t("vehicleCard.chargingNow");
  }

  if (openSession?.kind === "parked") {
    return t("vehicleCard.parked");
  }

  if (status.state === "driving") {
    return t("vehicleCard.drivingNow");
  }

  if (status.state === "charging") {
    return t("vehicleCard.chargingNow");
  }

  if (
    status.state === "online" ||
    status.state === "asleep" ||
    status.state === "offline"
  ) {
    return t("vehicleCard.parked");
  }

  return t("vehicleCard.statusUnknown");
}

export async function MobileMapFirstDashboard({
  status,
  vehicles,
  openSession,
  week,
  lastCharge,
  weekSeries,
}: {
  status: VehicleStatusRow;
  vehicles: Array<{
    id: number;
    displayName: string;
  }>;
  openSession: OpenSessionStatus | null;
  week: WeekStats;
  lastCharge: LastChargeStats | null;
  weekSeries: DashboardWeekDay[];
}) {
  const [t, tm, locale] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("dashboard.mobileMapFirst"),
    getLocale(),
  ]);

  const stateLabel = vehicleStateLabel(
    t,
    status,
    openSession,
  );

  const consumptionDistance = weekSeries.reduce(
    (sum, day) =>
      sum +
      (day.avgConsumptionWhKm != null
        ? day.distanceKm
        : 0),
    0,
  );

  const weightedConsumption =
    consumptionDistance > 0
      ? weekSeries.reduce(
          (sum, day) =>
            sum +
            (day.avgConsumptionWhKm != null
              ? day.distanceKm *
                day.avgConsumptionWhKm
              : 0),
          0,
        ) /
        consumptionDistance /
        10
      : null;

  const card =
    "rounded-[18px] border border-neutral-200 bg-white shadow-sm";

  return (
    <div className="mobile-map-first-dashboard -mx-4 -mt-4 min-h-dvh space-y-2 bg-[#f4f6f8] pb-4 text-neutral-950">
      <MobileRangeHero
        key={status.vehicleId}
        initialVehicleId={status.vehicleId}
        vehicles={vehicles}
        displayName={status.displayName}
        model={status.model}
        trimBadging={status.trimBadging}
        soc={status.soc}
        ratedRangeKm={status.ratedRangeKm}
        placeName={status.placeName}
        positionAvailable={
          status.lat != null && status.lon != null
        }
      />

      <div className="grid grid-cols-2 gap-2 px-4">
        <Link
          href="/day"
          className={`${card} min-h-[108px] p-3`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-neutral-500">
                {tm("drivesTitle")}
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-400">
                {tm("week")}
              </p>
            </div>

            <Route
              aria-hidden
              size={17}
              className="text-blue-500"
            />
          </div>

          <MiniDistanceBars data={weekSeries} />

          <div className="mt-0.5 flex items-end justify-between gap-2">
            <p className="text-[16px] font-semibold tabular-nums">
              {formatKm(week.distanceKm)}
            </p>

            <p className="text-[10px] text-neutral-400">
              {t("stats.driveCount", { count: week.driveCount })}
            </p>
          </div>
        </Link>

        <Link
          href="/insights"
          className={`${card} min-h-[108px] p-3`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-neutral-500">
                {tm("consumption")}
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-400">
                {tm("week")}
              </p>
            </div>

            <BarChart3
              aria-hidden
              size={17}
              className="text-cyan-500"
            />
          </div>

          <MiniConsumptionLine data={weekSeries} />

          <div className="mt-1">
            <p className="text-[16px] font-semibold tabular-nums">
              {weightedConsumption != null
                ? weightedConsumption.toLocaleString(
                    locale,
                    {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    },
                  )
                : "–"}
            </p>

            <p className="text-[10px] text-neutral-400">
              kWh/100 km
            </p>
          </div>
        </Link>
      </div>

      <div className="px-4 pt-1">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
          {tm("vehicle")}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <section className={`${card} overflow-hidden p-3`}>
            <p className="text-[11px] font-semibold text-neutral-800">
              {t("tpms.title")}
            </p>

            <TeslaTopViewTpmsGraphic
              model={status.model}
              fl={status.tpmsFlBar}
              fr={status.tpmsFrBar}
              rl={status.tpmsRlBar}
              rr={status.tpmsRrBar}
              compact
              flLabel={t("tpms.fl")}
              frLabel={t("tpms.fr")}
              rlLabel={t("tpms.rl")}
              rrLabel={t("tpms.rr")}
            />
          </section>

          <Link
            href="/vehicle"
            className={`${card} min-h-[140px] p-3`}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                <Car aria-hidden size={17} />
              </div>

              <ArrowRight
                aria-hidden
                size={14}
                className="text-neutral-300"
              />
            </div>

            <p className="mt-2 text-[11px] font-semibold text-neutral-800">
              {tm("vehicleStatus")}
            </p>

            <p className="mt-1 text-sm font-semibold text-neutral-950">
              {stateLabel}
            </p>

            <p className="mt-0.5 truncate text-[10px] text-neutral-400">
              {status.placeName ?? t("vehicleCard.placeUnknown")}
            </p>

            <p className="mt-2 text-[11px] font-semibold tabular-nums text-neutral-600">
              {status.odometerKm != null
                ? formatOdometer(status.odometerKm)
                : t("vehicleCard.odometerUnknown")}
            </p>
          </Link>

          <Link
            href="/charges"
            className={`${card} min-h-[112px] p-3`}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Zap aria-hidden size={17} />
              </div>

              <ArrowRight
                aria-hidden
                size={14}
                className="text-neutral-300"
              />
            </div>

            <p className="mt-2 text-[11px] font-semibold text-neutral-800">
              {tm("lastCharge")}
            </p>

            <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-950">
              {lastCharge?.energyAddedKwh != null
                ? formatKwh(lastCharge.energyAddedKwh, {
                    sign: true,
                  })
                : "–"}
            </p>

            <p className="mt-0.5 truncate text-[10px] text-neutral-400">
              {lastCharge?.placeName ??
                lastCharge?.address ??
                tm("unknownLocation")}
            </p>
          </Link>

          <section className={`${card} min-h-[112px] p-3`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Clock3 aria-hidden size={17} />
            </div>

            <p className="mt-2 text-[11px] font-semibold text-neutral-800">
              {tm("dataStatus")}
            </p>

            <p className="mt-1 text-sm font-semibold text-neutral-950">
              {status.syncedAt != null
                ? formatRelativeTime(status.syncedAt, locale)
                : "–"}
            </p>

            <p className="mt-0.5 text-[10px] text-neutral-400">
              {tm("lastSynced")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
