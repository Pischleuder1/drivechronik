import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Download } from "lucide-react";
import { formatDuration, formatKm, formatKwh } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../../../lib/config";
import {
  formatLongDate,
  isValidDateParam,
  shiftDate,
  todayInAppTz,
} from "../../../../lib/day";
import { getAllTags, getDayTimeline } from "../../../../lib/queries";
import { getActiveVehicle } from "../../../../lib/activeVehicle";
import { getParkLossForSessions } from "../../../../lib/parkAnalytics";
import { buttonClasses } from "../../../../components/ui/Button";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Panel } from "../../../../components/ui/Panel";
import {
  BulkSelectionProvider,
  SelectionToggle,
} from "../../../../components/bulkSelection";
import { DateNav } from "./DateNav";
import { Timeline } from "./Timeline";

import { NoVehicleState } from "../../../../components/NoVehicleState";

export const dynamic = "force-dynamic";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("day"),
    getLocale(),
  ]);
  const { date } = await params;
  if (!isValidDateParam(date)) notFound();

  const today = todayInAppTz();
  const current = await getActiveVehicle();

  if (!current) {
    return (
      <div className="w-full">
        <Panel padding="sm">
          <PageHeader
            visual="gps"
            title={t("pageTitle")}
            className="mb-4"
          />
          <DateNav
            date={date}
            longLabel={formatLongDate(date, locale)}
            prevDate={shiftDate(date, -1)}
            nextDate={shiftDate(date, 1)}
            today={today}
          />
        </Panel>
        <div className="mt-6">
          <NoVehicleState />
        </div>
      </div>
    );
  }

  const timeline = await getDayTimeline(current.id, date);
  const parkLossById = await getParkLossForSessions(
    timeline.parks.map((p) => p.id),
  );
  const allTags = await getAllTags();
  const tagOptions = allTags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));
  const driveIds = timeline.drives.map((d) => d.id);
  const now = Date.now();

  // Day totals (drives only).
  const driveCount = timeline.drives.length;
  const totalKm = timeline.drives.reduce(
    (sum, d) => sum + (d.distanceKm ?? 0),
    0,
  );
  const totalDriveSeconds = timeline.drives.reduce(
    (sum, d) => sum + (d.durationSeconds ?? 0),
    0,
  );
  const totalEnergy = timeline.drives.reduce(
    (sum, d) => sum + (d.consumedEnergyKwh ?? 0),
    0,
  );
  const anyEstimated = timeline.drives.some((d) => d.energyIsEstimated);

  const isEmpty =
    timeline.drives.length === 0 &&
    timeline.parks.length === 0 &&
    timeline.charges.length === 0;

  return (
    <div className="w-full">
      <Panel padding="sm">
        <PageHeader
          visual="gps"
          title={t("pageTitle")}
          className="mb-4"
        />
        <DateNav
          date={date}
          longLabel={formatLongDate(date, locale)}
          prevDate={shiftDate(date, -1)}
          nextDate={shiftDate(date, 1)}
          today={today}
        />

        <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <a
            href={`/api/export/day/${date}?format=csv&vehicle=${current.id}`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            CSV
          </a>
          <a
            href={`/api/export/day/${date}?format=pdf&vehicle=${current.id}`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            PDF
          </a>
        </div>

      </Panel>

      <div className="mt-6">
        {isEmpty ? (
          <EmptyState
            icon={CalendarDays}
            title={t("emptyTitle")}
            hint={t("emptyHint")}
          />
        ) : (
          <BulkSelectionProvider allIds={driveIds} tags={tagOptions}>
            {driveIds.length > 0 && (
              <div className="mb-3 flex items-center justify-end">
                <SelectionToggle />
              </div>
            )}

            <Timeline
              timeline={timeline}
              tz={APP_TIMEZONE}
              now={now}
              parkLossById={parkLossById}
            />

            <div
              className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800"
              data-testid="day-totals"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <span>{t("driveCount", { count: driveCount })}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{formatKm(totalKm)}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {formatDuration(totalDriveSeconds)} {t("driveTime")}
                </span>
                {totalEnergy > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {formatKwh(totalEnergy)}
                      {anyEstimated ? ` (${t("estimated")})` : ""}
                    </span>
                  </>
                )}
              </div>
              {anyEstimated && (
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t("estimatedLegend")}
                </p>
              )}
            </div>
          </BulkSelectionProvider>
        )}
      </div>
    </div>
  );
}
