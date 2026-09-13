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
} from "lucide-react";
import { formatDuration } from "@drivechronik/core";
import { getAllPlacesWithUsage } from "../../../lib/queries";
import { getPlaceDwellStats } from "../../../lib/parkAnalytics";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { IconBadge } from "../../../components/ui/IconBadge";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  MetricGrid,
  MetricItem,
} from "../../../components/ui/MetricGrid";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const t = await getTranslations("places");
  const placeRows = await getAllPlacesWithUsage();
  const dwellStatsByPlaceId = await getPlaceDwellStats();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        visual="places"
        title={t("title")}
        subtitle={t("description")}
      />

      <div className="mt-4 flex justify-end">
        <Button
          href="/places/new"
          variant="primary"
          className="shrink-0"
          icon={<Plus aria-hidden size={16} />}
        >
          {t("newPlace")}
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
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
              className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <IconBadge
                    tone={place.type === "customer" ? "emerald" : "violet"}
                    size="sm"
                  >
                    <MapPin aria-hidden size={18} />
                  </IconBadge>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {place.name}
                    </span>

                    <StatusBadge
                      tone={place.type === "customer" ? "emerald" : "violet"}
                    >
                      {t(`placeTypes.${place.type}`)}
                    </StatusBadge>
                  </div>
                </div>

                <StatusBadge tone="neutral">
                  {t("list.radius", { radius: place.radiusM })}
                </StatusBadge>
              </div>

              {place.address && (
                <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
                  {place.address}
                </p>
              )}

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
