import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatKm, formatPlaceLabel } from "@drivechronik/core";
import { APP_TIMEZONE } from "../../lib/config";
import type { DriveTrack, RecentDriveRow } from "../../lib/dashboard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
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

  // Newest-first (matches `drives` order), dropping drives without enough
  // recorded points to draw a line — the map is skipped entirely if none remain.
  const trackByDriveId = new Map(tracks.map((tr) => [tr.driveId, tr]));
  const orderedTracks = drives
    .map((d) => trackByDriveId.get(d.id))
    .filter((tr): tr is DriveTrack => tr != null && tr.points.length >= 2);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <SectionHeader
        title={t("recentDrives.title")}
        count={drives.length}
        tone="neutral"
      />

      {drives.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Route} title={t("recentDrives.empty")} />
        </div>
      ) : (
        <div
          className={`mt-4 grid gap-5 ${
            orderedTracks.length > 0
              ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]"
              : ""
          }`}
        >
          {orderedTracks.length > 0 && (
            <div className="min-w-0 overflow-hidden rounded-xl">
              <DashboardMapLoader
                key={`${orderedTracks.map((tr) => tr.driveId).join("-")}:${car?.lat ?? ""},${car?.lon ?? ""}`}
                tracks={orderedTracks}
                car={car}
              />
            </div>
          )}

          <div
            className={`min-w-0 ${
              orderedTracks.length > 0
                ? "lg:border-l lg:border-neutral-100 lg:pl-5 dark:lg:border-neutral-800"
                : ""
            }`}
          >
            <ol className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
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
                className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              >
                {t("recentDrives.dayViewCta")}
                <ArrowRight aria-hidden size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
