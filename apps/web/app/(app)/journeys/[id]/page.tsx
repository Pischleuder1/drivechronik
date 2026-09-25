import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Battery,
  BatteryCharging,
  ChevronLeft,
  CircleDollarSign,
  Clock,
  Download,
  Gauge,
  Route,
  Zap,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  buildJourneyKpis,
  formatConsumption,
  formatDuration,
  formatKm,
  formatKwh,
  formatTime,
} from "@drivechronik/core";
import { APP_TIMEZONE } from "../../../../lib/config";
import { getActiveVehicleId } from "../../../../lib/activeVehicle";
import {
  getJourneyCandidates,
  getJourneyDetail,
  getJourneyRouteTracks,
  type JourneyTimelineItem,
} from "../../../../lib/journeys";
import { buttonClasses } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { StatCard } from "../../../../components/ui/StatCard";
import { SectionHeader } from "../../../../components/ui/SectionHeader";
import { Panel } from "../../../../components/ui/Panel";
import { DeleteJourneyButton } from "./DeleteJourneyButton";
import { AddItemButton, RemoveItemButton } from "./ItemButtons";
import { JourneyMapLoader } from "./JourneyMapLoader";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

function formatRange(start: Date, end: Date): string {
  return `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
}

function formatDateTimeShort(date: Date): string {
  return `${dateFmt.format(date)} ${formatTime(date, APP_TIMEZONE)}`;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default async function JourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("journeys");
  const tCommon = await getTranslations("common");
  const { id } = await params;
  const journeyId = Number(id);
  if (!Number.isInteger(journeyId) || journeyId <= 0) notFound();

  const vehicleId = await getActiveVehicleId();
  if (vehicleId == null) notFound();

  const detail = await getJourneyDetail(journeyId, vehicleId);
  if (!detail) notFound();

  const { journey, items, kpiDrives, kpiCharges } = detail;
  const kpis = buildJourneyKpis(kpiDrives, kpiCharges);
  const driveIds = items.filter((i) => i.kind === "drive").map((i) => i.id);
  const [candidates, routeTracks] = await Promise.all([
    getJourneyCandidates(journeyId, vehicleId),
    getJourneyRouteTracks(driveIds),
  ]);

  const chargeMarkers = items
    .filter(
      (i): i is Extract<JourneyTimelineItem, { kind: "charge" }> =>
        i.kind === "charge" && i.lat != null && i.lon != null,
    )
    .map((i) => ({ id: i.id, lat: i.lat as number, lon: i.lon as number, placeName: i.placeName }));
  const hasRouteData = routeTracks.some((t) => t.points.length >= 2) || chargeMarkers.length > 0;
  const mapKey = `${routeTracks.map((t) => t.driveId).join("-")}:${chargeMarkers.map((c) => c.id).join("-")}`;

  const socValue =
    kpis.minSoc != null && kpis.maxSoc != null
      ? `${kpis.minSoc} – ${kpis.maxSoc} %`
      : "–";
  const socSub =
    kpis.startSoc != null && kpis.endSoc != null
      ? t("detail.kpi.socRange", { start: kpis.startSoc, end: kpis.endSoc })
      : undefined;

  return (
    <div className="w-full">
      <Link
        href="/journeys"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {t("detail.allJourneys")}
      </Link>

      <PageHeader
        visual="route"
        className="mt-3"
        title={journey.name}
        subtitle={formatRange(journey.startTime, journey.endTime)}
        eyebrow={
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: journey.color ?? "#94a3b8" }}
            />
            <StatusBadge tone="neutral">
              {t(`type.${journey.type}`)}
            </StatusBadge>
          </div>
        }
      />



      {journey.description && (
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          {journey.description}
        </p>
      )}

      {/* Export + Aktionen */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("detail.export")}
          </span>

          <a
            href={`/api/export/journey/${journey.id}?format=csv`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            CSV
          </a>

          <a
            href={`/api/export/journey/${journey.id}?format=pdf`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            PDF
          </a>

          {hasRouteData && (
            <a
              href={`/api/export/journey/${journey.id}?format=gpx`}
              className={buttonClasses("ghost", "sm")}
            >
              <Download aria-hidden size={14} />
              GPX
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/journeys/${journey.id}/edit`}
            className={buttonClasses(
              "secondary",
              "sm",
              "w-24 justify-center",
            )}
          >
            {tCommon("actions.edit")}
          </Link>

          <div className="w-24 [&_button]:w-full [&_button]:justify-center">
            <DeleteJourneyButton
              journeyId={journey.id}
              name={journey.name}
            />
          </div>
        </div>
      </div>

      {hasRouteData && (
        <div className="mt-4">
          <JourneyMapLoader
            key={mapKey}
            tracks={routeTracks}
            charges={chargeMarkers}
            color={journey.color}
          />
        </div>
      )}

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.totalDistance")}
          value={formatKm(kpis.totalDistanceKm)}
          tone="blue"
          icon={<Route aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.driveTime")}
          value={formatDuration(kpis.driveTimeSeconds)}
          tone="violet"
          icon={<Clock aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.chargeTime")}
          value={formatDuration(kpis.chargeTimeSeconds)}
          tone="amber"
          icon={<BatteryCharging aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.avgConsumption")}
          value={
            kpis.avgConsumptionWhKm != null
              ? formatConsumption(kpis.avgConsumptionWhKm, kpis.anyEstimated)
              : "–"
          }
          tone="cyan"
          icon={<Gauge aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.consumedEnergy")}
          value={formatKwh(kpis.consumedEnergyKwh)}
          hint={kpis.anyEstimated ? t("detail.kpi.partiallyEstimated") : undefined}
          tone="rose"
          icon={<Zap aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.chargedEnergy")}
          value={formatKwh(kpis.chargedEnergyKwh)}
          tone="emerald"
          icon={<BatteryCharging aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.chargeStops")}
          value={String(kpis.chargeStopCount)}
          tone="amber"
          icon={<Zap aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.socMinMax")}
          value={socValue}
          hint={socSub}
          tone="sky"
          icon={<Battery aria-hidden size={18} />}
        />

        <StatCard

          valueClassName="mt-1 text-base font-semibold tabular-nums"
          label={t("detail.kpi.cost")}
          value={kpis.totalCost != null ? formatEur(kpis.totalCost) : "–"}
          hint={
            kpis.costPer100Km != null
              ? t("detail.kpi.costPerKm", {
                  value: formatEur(kpis.costPer100Km),
                })
              : kpis.hasIncompleteCost
                ? t("detail.kpi.incomplete")
                : undefined
          }
          tone="emerald"
          icon={<CircleDollarSign aria-hidden size={18} />}
        />
      </div>

      {kpis.hasIncompleteCost && kpis.totalCost != null && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {t("detail.incompleteCostNote")}
        </p>
      )}

      {/* Chronological item list */}
      <SectionHeader
        className="mt-8"
        title={t("detail.itemsHeading")}
        count={items.length}
        tone="blue"
      />
      <Panel className="mt-3 overflow-hidden" padding="none">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("detail.noItems")}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {items.map((item) => (
              <ItemRow key={`${item.kind}-${item.id}`} item={item} journeyId={journey.id} t={t} />
            ))}
          </ul>
        )}
      </Panel>

      {/* Add candidates */}
      <SectionHeader
        className="mt-8"
        title={t("detail.add")}
        subtitle={t("detail.addHint")}
        count={candidates.length}
        tone="emerald"
      />
      <Panel className="mt-3 overflow-hidden" padding="none">
        {candidates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("detail.noCandidates")}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {candidates.map((c) => (
              <li
                key={`${c.kind}-${c.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                {c.kind === "charge" ? (
                  <Zap aria-hidden size={16} className="shrink-0 text-amber-500" />
                ) : (
                  <ArrowRight aria-hidden size={16} className="shrink-0 text-neutral-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-800 dark:text-neutral-200">
                    {c.label}
                    {c.excluded && (
                      <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {t("detail.previouslyRemoved")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {formatDateTimeShort(c.startTime)}
                    {c.kind === "drive" && c.distanceKm != null
                      ? ` · ${formatKm(c.distanceKm)}`
                      : ""}
                    {c.kind === "charge" && c.energyAddedKwh != null
                      ? ` · ${formatKwh(c.energyAddedKwh, { sign: true })}${
                          c.chargerType ? ` · ${c.chargerType.toUpperCase()}` : ""
                        }`
                      : ""}
                  </p>
                </div>
                <AddItemButton
                  journeyId={journey.id}
                  itemType={c.kind}
                  itemId={c.id}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ItemRow({
  item,
  journeyId,
  t,
}: {
  item: JourneyTimelineItem;
  journeyId: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const href = item.kind === "drive" ? `/drives/${item.id}` : `/charges/${item.id}`;

  const title =
    item.kind === "drive"
      ? `${item.startPlaceName ?? item.startAddress ?? "?"} → ${
          item.endPlaceName ?? item.endAddress ?? "?"
        }`
      : item.placeName ?? item.address ?? t("chargingSession");

  const sub =
    item.kind === "drive"
      ? [
          formatDateTimeShort(item.startTime),
          item.distanceKm != null ? formatKm(item.distanceKm) : null,
          item.durationSeconds != null
            ? formatDuration(item.durationSeconds)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          formatDateTimeShort(item.startTime),
          item.energyAddedKwh != null
            ? formatKwh(item.energyAddedKwh, { sign: true })
            : null,
          item.chargerType ? item.chargerType.toUpperCase() : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
      {item.kind === "charge" ? (
        <Zap aria-hidden size={16} className="shrink-0 text-amber-500" />
      ) : (
        <ArrowRight aria-hidden size={16} className="shrink-0 text-neutral-400" />
      )}
      <Link href={href} className="min-w-0 flex-1 hover:underline">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {title}
        </p>
        <p className="truncate text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {sub}
        </p>
      </Link>
      <RemoveItemButton
        journeyId={journeyId}
        itemType={item.kind}
        itemId={item.id}
      />
    </li>
  );
}
