import Link from "next/link";
import { ArrowRight, Map as MapIcon, Route } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatKm, formatPlaceLabel } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../lib/config";
import type { DriveTrack, RecentDriveRow } from "../../lib/dashboard";
import { EmptyState } from "../../components/ui/EmptyState";
import { CLASSIFICATION_DOT, type Classification } from "../../lib/classification";
import { DashboardMapLoader } from "./DashboardMapLoader";

export interface RecentDrivesCarInfo {
  lat: number;
  lon: number;
  displayName: string;
  placeName: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIMEZONE,
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIMEZONE,
});

export async function RecentDrivesCard({
  drives,
  tracks,
  car,
}: {
  drives: RecentDriveRow[];
  tracks: DriveTrack[];
  car: RecentDrivesCarInfo | null;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
  ]);

  const trackByDriveId = new Map(tracks.map((tr) => [tr.driveId, tr]));

  const orderedTracks = drives
    .map((d) => trackByDriveId.get(d.id))
    .filter((tr): tr is DriveTrack => tr != null && tr.points.length >= 2);

  const card =
    "h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("recentDrives.title")}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              {t("recentDrives.subtitle")}
            </p>
          </div>

          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-neutral-100 px-2 text-xs font-medium tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {drives.length}
          </span>
        </div>

        {drives.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={Route} title={t("recentDrives.empty")} />
          </div>
        ) : (
          <>
            <ol className="mt-4 flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
              {drives.map((d) => {
                const classification = d.classification as Classification;

                const from = formatPlaceLabel(
                  d.startPlaceName,
                  d.startAddress,
                  d.startLat,
                  d.startLon,
                );

                const to = formatPlaceLabel(
                  d.endPlaceName,
                  d.endAddress,
                  d.endLat,
                  d.endLon,
                );

                return (
                  <li key={d.id}>
                    <Link
                      href={`/drives/${d.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-3 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                    >
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${CLASSIFICATION_DOT[classification]}`}
                        title={tCommon(`classification.${classification}`)}
                      />

                      <span className="w-16 shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">
                        {dateFormatter.format(d.startTime)}{" "}
                        {timeFormatter.format(d.startTime)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-neutral-800 dark:text-neutral-200">
                          {from}
                        </span>

                        <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                          → {to}
                        </span>
                      </span>

                      {d.distanceKm != null && (
                        <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                          {formatKm(d.distanceKm)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>

            <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <Link
                href="/day"
                className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400"
              >
                {t("recentDrives.dayViewCta")}
                <ArrowRight aria-hidden size={14} />
              </Link>
            </div>
          </>
        )}
      </section>

      <section className={`${card} flex min-h-[360px] flex-col`}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300">
            <MapIcon aria-hidden size={17} strokeWidth={1.8} />
          </span>

          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("recentDrives.mapTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              {t("recentDrives.mapSubtitle")}
            </p>
          </div>
        </div>

        {orderedTracks.length > 0 ? (
          <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl">
            <DashboardMapLoader
              key={`${orderedTracks.map((tr) => tr.driveId).join("-")}:${car?.lat ?? ""},${car?.lon ?? ""}`}
              tracks={orderedTracks}
              car={car}
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-1 items-center">
            <div className="w-full">
              <EmptyState icon={MapIcon} title={t("recentDrives.mapEmpty")} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
