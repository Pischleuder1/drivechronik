import {
  BatteryCharging,
  Car as CarIcon,
  CarFront,
  MapPin,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKwh, formatOdometer, formatTime } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../lib/config";
import { formatRelativeTime } from "../../lib/day";
import type { OpenSessionStatus, VehicleStatusRow } from "../../lib/dashboard";

type VehicleCardTranslator = Awaited<ReturnType<typeof getTranslations>>;

function socColor(soc: number): string {
  if (soc > 50) return "bg-emerald-500";
  if (soc >= 20) return "bg-amber-500";
  return "bg-red-500";
}

function socTextColor(soc: number): string {
  if (soc > 50) return "text-emerald-600 dark:text-emerald-400";
  if (soc >= 20) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function statusLine(
  t: VehicleCardTranslator,
  openSession: OpenSessionStatus | null,
  status: VehicleStatusRow,
): string {
  if (openSession) {
    if (openSession.kind === "driving") return t("vehicleCard.drivingNow");

    if (openSession.kind === "charging") {
      return openSession.energyAddedKwh != null
        ? t("vehicleCard.chargingNowWithEnergy", {
            energy: formatKwh(openSession.energyAddedKwh, { sign: true }),
          })
        : t("vehicleCard.chargingNow");
    }

    const place = openSession.placeName ?? status.placeName;
    const parked =
      openSession.since != null
        ? t("vehicleCard.parkedSince", {
            time: formatTime(openSession.since, APP_TIMEZONE),
          })
        : t("vehicleCard.parked");

    return [parked, place].filter(Boolean).join(" · ");
  }

  if (status.state === "driving") return t("vehicleCard.drivingNow");
  if (status.state === "charging") return t("vehicleCard.chargingNow");

  if (
    status.state === "online" ||
    status.state === "asleep" ||
    status.state === "offline"
  ) {
    const parked =
      status.stateSince != null
        ? t("vehicleCard.parkedSince", {
            time: formatTime(status.stateSince, APP_TIMEZONE),
          })
        : t("vehicleCard.parked");

    return [parked, status.placeName].filter(Boolean).join(" · ");
  }

  return t("vehicleCard.statusUnknown");
}

export async function VehicleCard({
  status,
  openSession,
}: {
  status: VehicleStatusRow;
  openSession: OpenSessionStatus | null;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("dashboard"),
    getLocale(),
  ]);

  const soc = status.soc;

  return (
    <section className="relative h-full overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div
        aria-hidden
        className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-emerald-100/50 blur-3xl dark:bg-emerald-950/20"
      />

      <div className="relative grid h-full min-h-[255px] gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              <CarIcon aria-hidden size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                Fahrzeug
              </p>
              <h1 className="truncate text-base font-semibold text-neutral-950 dark:text-neutral-50">
                {status.displayName}
              </h1>
            </div>
          </div>

          {soc != null ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="flex items-baseline">
                  <span
                    className={`text-5xl font-semibold tracking-tight tabular-nums ${socTextColor(
                      soc,
                    )}`}
                  >
                    {Math.round(soc)}
                  </span>
                  <span className="ml-1 text-xl font-medium text-neutral-400">
                    %
                  </span>
                </div>

                {status.ratedRangeKm != null && (
                  <span
                    className="mb-1 rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    title={t("vehicleCard.ratedRangeTitle")}
                  >
                    ≈ {Math.round(status.ratedRangeKm)} km
                  </span>
                )}
              </div>

              <div className="mt-4 h-3 w-full max-w-xl overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all ${socColor(soc)}`}
                  style={{ width: `${Math.max(0, Math.min(100, soc))}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-neutral-400">
              {t("vehicleCard.socUnknown")}
            </p>
          )}

          <div className="mt-6 grid gap-2">
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <MapPin
                aria-hidden
                size={15}
                className="shrink-0 text-neutral-400"
              />
              <span className="truncate">
                {status.placeName ?? t("vehicleCard.placeUnknown")}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <BatteryCharging
                aria-hidden
                size={15}
                className="shrink-0 text-neutral-400"
              />
              <span className="truncate">
                {statusLine(t, openSession, status)}
              </span>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <span className="font-medium tabular-nums">
              {status.odometerKm != null
                ? formatOdometer(status.odometerKm)
                : t("vehicleCard.odometerUnknown")}
            </span>

            <span>
              {status.syncedAt != null
                ? t("vehicleCard.lastUpdated", {
                    time: formatRelativeTime(status.syncedAt, locale),
                  })
                : t("vehicleCard.neverSynced")}
            </span>
          </div>
        </div>

        <div className="relative hidden items-center justify-center lg:flex">
          <div className="absolute h-44 w-44 rounded-full bg-neutral-100/80 dark:bg-neutral-800/70" />
          <div className="absolute h-32 w-32 rounded-full border border-neutral-200/80 dark:border-neutral-700" />

          <CarFront
            aria-hidden
            size={112}
            strokeWidth={1.15}
            className="relative text-neutral-500 dark:text-neutral-300"
          />
        </div>
      </div>
    </section>
  );
}
