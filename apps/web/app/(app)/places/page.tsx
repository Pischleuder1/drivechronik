import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Battery,
  Car,
  Clock3,
  Flag,
  MapPin,
  Play,
  Plus,
  Zap,
  ChevronRight,
} from "lucide-react";
import { formatDuration } from "@drivechronik/core";
import {
  getAllPlacesWithUsage,
  getVehicles,
} from "../../../lib/queries";
import { getPlaceDwellStats } from "../../../lib/parkAnalytics";
import { getActiveVehicle } from "../../../lib/activeVehicle";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { NoVehicleState } from "../../../components/NoVehicleState";
import { IconBadge } from "../../../components/ui/IconBadge";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  MetricGrid,
  MetricItem,
} from "../../../components/ui/MetricGrid";
import { MobilePlacesHero } from "./MobilePlacesHero";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const t = await getTranslations("places");
  const current = await getActiveVehicle();

  if (!current) {
    return (
      <div className="w-full">
        <PageHeader
          visual="places"
          title={t("title")}
          subtitle={t("description")}
        />

        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const [placeRows, dwellStatsByPlaceId, vehicles] = await Promise.all([
    getAllPlacesWithUsage(current.id),
    getPlaceDwellStats(current.id),
    getVehicles(),
  ]);

  return (
    <div className="mobile-places-page -mx-4 -mt-4 min-h-dvh bg-[#f4f6f8] px-4 pt-4 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pt-0">
      <MobilePlacesHero
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          displayName: vehicle.displayName,
        }))}
        initialVehicleId={current.id}
      />

      <div className="hidden md:block">
        <PageHeader
          visual="places"
          title={t("title")}
          subtitle={t("description")}
        />
      </div>

      <div className="relative z-10 -mt-5 flex justify-end md:mt-4">
        <Button
          href="/places/new"
          variant="primary"
          className="shrink-0 shadow-sm md:shadow-none"
          icon={<Plus aria-hidden size={16} />}
        >
          {t("newPlace")}
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 md:mt-6 md:gap-4">
        {placeRows.length === 0 && (
          <EmptyState
            icon={MapPin}
            title={t("empty.title")}
            hint={t("empty.hint")}
            action={{
              label: t("newPlace"),
              href: "/places/new",
              icon: <Plus aria-hidden size={16} />,
            }}
          />
        )}
        {placeRows.map((place) => {
          const totalUsage =
            place.driveStartCount + place.driveEndCount + place.chargeCount + place.parkCount;
          const dwell = dwellStatsByPlaceId.get(place.id);
          return (
            <Link
              key={place.id}
              href={`/places/${place.id}/edit`}
              className="rounded-[18px] border border-neutral-200/80 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md md:rounded-3xl md:p-5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              <div className="flex items-start justify-between gap-2 md:flex-wrap md:items-center md:gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="hidden md:block">
                    <IconBadge
                      tone={place.type === "customer" ? "emerald" : "violet"}
                      size="sm"
                    >
                      <MapPin aria-hidden size={18} />
                    </IconBadge>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:gap-2">
                    <span className="truncate text-[15px] font-semibold text-neutral-900 md:text-base dark:text-neutral-100">
                      {place.name}
                    </span>

                    <StatusBadge
                      tone={place.type === "customer" ? "emerald" : "violet"}
                    >
                      {t(`placeTypes.${place.type}`)}
                    </StatusBadge>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge tone="neutral">
                    {t("list.radius", { radius: place.radiusM })}
                  </StatusBadge>
                  <ChevronRight
                    aria-hidden
                    size={17}
                    className="text-neutral-400 md:hidden"
                  />
                </div>
              </div>

              {place.address && (
                <p className="mt-1 truncate text-[11px] text-neutral-500 md:text-sm dark:text-neutral-400">
                  {place.address}
                </p>
              )}

              <div className="hidden md:block">
                <MetricGrid columns={4} className="mt-3">
                  <MetricItem
                  label={t("list.start")}
                  value={place.driveStartCount}
                  icon={
                    <Play className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  }
                />
                <MetricItem
                  label={t("list.destination")}
                  value={place.driveEndCount}
                  icon={
                    <Flag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  }
                />
                <MetricItem
                  label={t("list.charging")}
                  value={place.chargeCount}
                  icon={
                    <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  }
                />
                <MetricItem
                  label={t("list.parking")}
                  value={place.parkCount}
                  icon={
                    <Car className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  }
                />
                </MetricGrid>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:hidden">
                <div className="rounded-xl bg-neutral-50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <Play className="h-3.5 w-3.5 text-sky-600" />
                    {t("list.start")}
                  </div>
                  <p className="mt-0 text-[15px] font-semibold tabular-nums text-neutral-900">
                    {place.driveStartCount}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <Flag className="h-3.5 w-3.5 text-blue-600" />
                    {t("list.destination")}
                  </div>
                  <p className="mt-0 text-[15px] font-semibold tabular-nums text-neutral-900">
                    {place.driveEndCount}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <Zap className="h-3.5 w-3.5 text-sky-600" />
                    {t("list.charging")}
                  </div>
                  <p className="mt-0 text-[15px] font-semibold tabular-nums text-neutral-900">
                    {place.chargeCount}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <Car className="h-3.5 w-3.5 text-blue-600" />
                    {t("list.parking")}
                  </div>
                  <p className="mt-0 text-[15px] font-semibold tabular-nums text-neutral-900">
                    {place.parkCount}
                  </p>
                </div>
              </div>

              {dwell && dwell.parkCount > 0 && (
                <MetricGrid columns={2} className="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                  <MetricItem
                    label={t("list.avgDwellTime")}
                    value={formatDuration(dwell.avgDwellSeconds)}
                    icon={
                      <Clock3 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    }
                  />
                  <MetricItem
                    label={t("list.totalVampireLoss")}
                    value={t("list.vampireLoss", {
                      pct: dwell.totalVampireLossPct,
                    })}
                    icon={
                      <Battery className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    }
                  />
                </MetricGrid>
              )}

              {totalUsage === 0 && (
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  {t("list.notUsedYet")}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
