import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  formatConsumption,
  formatDuration,
  formatKm,
  formatKw,
  formatKwh,
  formatOdometer,
  formatPlaceLabel,
  formatSoc,
  formatSpeed,
  formatTemp,
  formatTimeRange,
  isoWeekday,
} from "@drivechronik/core";
import { weatherCodeIcon, weatherCodeKey } from "../../../../lib/weatherCodes";
import { APP_TIMEZONE } from "../../../../lib/config";
import { formatLongDate } from "../../../../lib/day";
import {
  getAllPlacesLite,
  getAllTags,
  getAuditLogFor,
  getDriveById,
} from "../../../../lib/queries";
import { getRoutePoints } from "../../../../lib/driveRoute";
import {
  type Classification,
} from "../../../../lib/classification";
import {
  calendarDayNumber,
  detectLateLogbookCompletion,
  isLogbookComplete,
} from "../../../../lib/logbookCompletion";
import { buttonClasses } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Panel } from "../../../../components/ui/Panel";
import { MetricGrid, MetricItem } from "../../../../components/ui/MetricGrid";
import { AnnotationForm } from "./AnnotationForm";
import { TagManager } from "./TagManager";
import { AuditLogList } from "./AuditLogList";
import { PlaceCorrection } from "./PlaceCorrection";
import { DriveMapLoader } from "./DriveMapLoader";
import { DriveChart } from "./DriveChart";

// Ab diesem Anteil befüllter elevation_m-Werte gilt das Höhenprofil als nutzbar
// (die Chart-Komponente wendet dieselbe Schwelle intern an); darunter zeigen wir
// den Hintergrund-Hinweis und das Chart fällt auf SoC/Tempo zurück.
const MIN_ELEVATION_COVERAGE = 0.6;

export const dynamic = "force-dynamic";

function classificationTone(
  classification: Classification,
): "blue" | "emerald" | "amber" | "neutral" {
  switch (classification) {
    case "business":
      return "blue";
    case "private":
      return "emerald";
    case "commute":
      return "amber";
    case "unclassified":
    default:
      return "neutral";
  }
}

export default async function DriveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const driveId = Number(id);
  if (!Number.isInteger(driveId) || driveId <= 0) notFound();

  const drive = await getDriveById(driveId);
  if (!drive) notFound();

  const [t, tWeather, tCommon, locale] = await Promise.all([
    getTranslations("drives"),
    getTranslations("weather"),
    getTranslations("common"),
    getLocale(),
  ]);

  const [auditEntries, allTags, allPlaces, route] = await Promise.all([
    getAuditLogFor("drive", driveId),
    getAllTags(),
    getAllPlacesLite(),
    getRoutePoints(driveId),
  ]);

  const from = formatPlaceLabel(
    drive.startPlaceName,
    drive.startAddress,
    drive.startLat,
    drive.startLon,
  );
  const to = formatPlaceLabel(
    drive.endPlaceName,
    drive.endAddress,
    drive.endLat,
    drive.endLon,
  );

  const dateStr = toDateParam(drive.startTime);
  const ruleWeekday = isoWeekday(drive.startTime, APP_TIMEZONE);
  const ruleName = `${drive.startPlaceName ?? from} → ${drive.endPlaceName ?? to}`;
  const ruleCreateHref =
    drive.startPlaceId != null && drive.endPlaceId != null
      ? `/rules/new?${new URLSearchParams({
          startPlaceId: String(drive.startPlaceId),
          endPlaceId: String(drive.endPlaceId),
          weekdays: String(ruleWeekday),
          name: ruleName,
        }).toString()}`
      : null;
  const classification = drive.classification as Classification;

  const isClosed = drive.endTime != null;
  const classificationComplete = classification !== "unclassified";
  const customerMissing =
    classification === "business" &&
    (drive.customer?.trim().length ?? 0) === 0;

  const logbookComplete = isLogbookComplete(
    classification,
    drive.purpose,
  );

  const daysSinceEnd =
    drive.endTime != null
      ? Math.max(
          0,
          calendarDayNumber(new Date(), APP_TIMEZONE) -
            calendarDayNumber(drive.endTime, APP_TIMEZONE),
        )
      : 0;

  const daysRemaining = Math.max(0, 7 - daysSinceEnd);
  const deadlineExceeded = isClosed && daysSinceEnd > 7;

  const completedLate = detectLateLogbookCompletion({
    classification,
    purpose: drive.purpose,
    endTime: drive.endTime,
    auditEntries,
    timeZone: APP_TIMEZONE,
  });

  const gpsCoveragePercent =
    drive.durationSeconds != null &&
    drive.durationSeconds > 0 &&
    route.stats.recordingDurationSeconds != null
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (route.stats.recordingDurationSeconds / drive.durationSeconds) * 100,
            ),
          ),
        )
      : null;

  const kennzahlen: Array<[string, React.ReactNode]> = [
    [t("metrics.distance"), drive.distanceKm != null ? formatKm(drive.distanceKm) : "—"],
    [
      t("metrics.duration"),
      drive.durationSeconds != null ? formatDuration(drive.durationSeconds) : "—",
    ],
    [
      t("metrics.avgConsumption"),
      drive.avgConsumptionWhKm != null
        ? formatConsumption(drive.avgConsumptionWhKm, drive.energyIsEstimated)
        : "—",
    ],
    [
      t("metrics.consumedEnergy"),
      drive.consumedEnergyKwh != null
        ? `${formatKwh(drive.consumedEnergyKwh)}${drive.energyIsEstimated ? " ~" : ""}`
        : "—",
    ],
    [
      t("metrics.startSoc"),
      drive.startSoc != null ? formatSoc(drive.startSoc) : "—",
    ],
    [t("metrics.endSoc"), drive.endSoc != null ? formatSoc(drive.endSoc) : "—"],
    [
      t("metrics.startOdometer"),
      drive.startOdometerKm != null ? (
        <span className="font-mono">{formatOdometer(drive.startOdometerKm)}</span>
      ) : (
        "—"
      ),
    ],
    [
      t("metrics.endOdometer"),
      drive.endOdometerKm != null ? (
        <span className="font-mono">{formatOdometer(drive.endOdometerKm)}</span>
      ) : (
        "—"
      ),
    ],
  ];

  if (drive.ascentM != null || drive.descentM != null) {
    kennzahlen.push([
      t("metrics.ascent"),
      drive.ascentM != null ? `${drive.ascentM} m` : "—",
    ]);
    kennzahlen.push([
      t("metrics.descent"),
      drive.descentM != null ? `${drive.descentM} m` : "—",
    ]);
  }

  // Angereicherte Kennzahlen (M18) — nur zeigen, wenn befüllt (kein „—"-Rauschen).
  if (drive.outsideTempAvg != null) {
    kennzahlen.push([t("metrics.outsideTempAvg"), formatTemp(drive.outsideTempAvg)]);
  }
  if (drive.insideTempAvg != null) {
    kennzahlen.push([t("metrics.insideTempAvg"), formatTemp(drive.insideTempAvg)]);
  }
  if (drive.speedMaxKmh != null) {
    kennzahlen.push([t("metrics.maxSpeed"), formatSpeed(drive.speedMaxKmh)]);
  }
  if (drive.powerMaxKw != null) {
    kennzahlen.push([t("metrics.maxPower"), formatKw(drive.powerMaxKw)]);
  }
  // powerMinKw ist negativ (stärkste Rekuperation) — positiv anzeigen.
  if (drive.powerMinKw != null && drive.powerMinKw < 0) {
    kennzahlen.push([t("metrics.maxRegen"), formatKw(drive.powerMinKw)]);
  }

  kennzahlen.push([t("metrics.startAddress"), drive.startAddress ?? "—"]);
  kennzahlen.push([t("metrics.endAddress"), drive.endAddress ?? "—"]);

  return (
    <div className="w-full">
      <Link
        href="/day"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <PageHeader
        visual="gps"
        className="mt-3"
        title={`${from} → ${to}`}
        subtitle={`${formatLongDate(dateStr, locale)} · ${formatTimeRange(
          drive.startTime,
          drive.endTime,
          APP_TIMEZONE,
        )}`}
        eyebrow={
          <StatusBadge tone={classificationTone(classification)}>
            {tCommon(`classification.${classification}`)}
          </StatusBadge>
        }
      />

      <Link
        href={`/day/${dateStr}`}
        className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
      >
        {t("page.backToDayView", { date: dateStr })}
        <ChevronRight aria-hidden size={14} />
      </Link>

      {drive.weatherTempC != null &&
        (() => {
          // Wetter zur Fahrtzeit aus drives.weather_* (historisch, Open-Meteo).
          const WeatherIcon =
            drive.weatherCode != null ? weatherCodeIcon(drive.weatherCode) : null;
          const parts: string[] = [`${Math.round(drive.weatherTempC)} °C`];
          if (drive.weatherCode != null) {
            parts.push(tWeather(`code.${weatherCodeKey(drive.weatherCode)}`));
          }
          if (drive.weatherWindKmh != null) {
            parts.push(
              t("page.weatherWind", { speed: Math.round(drive.weatherWindKmh) }),
            );
          }
          return (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600 dark:text-neutral-300">
              {WeatherIcon && (
                <WeatherIcon
                  aria-hidden
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
              )}
              <span className="tabular-nums">{parts.join(" · ")}</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {t("page.weatherHistoricalNote")}
              </span>
            </div>
          );
        })()}

      <Panel className="mt-6" title={t("page.cardMetrics")}>
        <MetricGrid columns={2}>
          {kennzahlen.map(([label, value]) => (
            <MetricItem
              key={label}
              label={label}
              value={value}
            />
          ))}
        </MetricGrid>
        {drive.energyIsEstimated && drive.consumedEnergyKwh != null && (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            {t("page.estimatedNote")}
          </p>
        )}
      </Panel>

      <Panel className="mt-6" title={t("page.cardRoute")}>
        {route.points.length >= 2 ? (
          <>
            <DriveMapLoader points={route.points} />

            <MetricGrid className="mt-4" columns={4}>
              <MetricItem
                label={t("page.gpsDistance")}
                value={
                  route.stats.gpsDistanceKm != null
                    ? formatKm(route.stats.gpsDistanceKm)
                    : "—"
                }
              />

              <MetricItem
                label={t("page.gpsPoints")}
                value={String(route.totalCount)}
              />

              <MetricItem
                label={t("page.gpsRecording")}
                value={
                  route.stats.recordingDurationSeconds != null
                    ? formatDuration(
                        Math.round(route.stats.recordingDurationSeconds),
                      )
                    : "—"
                }
              />

              <MetricItem
                label={t("page.gpsInterval")}
                value={
                  route.stats.avgIntervalSeconds != null
                    ? `${route.stats.avgIntervalSeconds.toFixed(1)} s`
                    : "—"
                }
              />

              <MetricItem
                label={t("page.gpsAvgSpeed")}
                value={
                  route.stats.avgSpeedKmh != null
                    ? formatSpeed(route.stats.avgSpeedKmh)
                    : "—"
                }
              />

              <MetricItem
                label={t("page.gpsMaxSpeed")}
                value={
                  route.stats.maxSpeedKmh != null
                    ? formatSpeed(route.stats.maxSpeedKmh)
                    : "—"
                }
              />

              <MetricItem
                label={t("page.gpsSoc")}
                value={
                  route.stats.startSoc != null || route.stats.endSoc != null
                    ? `${
                        route.stats.startSoc != null
                          ? formatSoc(route.stats.startSoc)
                          : "—"
                      } → ${
                        route.stats.endSoc != null
                          ? formatSoc(route.stats.endSoc)
                          : "—"
                      }`
                    : "—"
                }
              />

              <MetricItem
                label={t("page.gpsCoverage")}
                value={
                  gpsCoveragePercent != null
                    ? `${gpsCoveragePercent} %`
                    : "—"
                }
              />
            </MetricGrid>

            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t("page.gpsSource")}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("page.noTrackData")}
          </p>
        )}
      </Panel>

      {route.points.length >= 2 && (
        <Panel className="mt-6" title={t("page.cardCourse")}>
          <DriveChart
            points={route.chartPoints}
            elevationCoverage={route.elevationCoverage}
            teslamateAscentM={drive.ascentM}
            teslamateDescentM={drive.descentM}
          />
          {route.elevationCoverage < MIN_ELEVATION_COVERAGE && (
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t("page.elevationBackgroundNote")}
            </p>
          )}
        </Panel>
      )}

      <Panel className="mt-6" title={t("page.cardLogbookStatus")}>
        <div className="space-y-2">
          <div
            className={
              !isClosed
                ? "rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                : logbookComplete
                  ? "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
                  : deadlineExceeded
                    ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
                    : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            }
          >
            <span className="font-medium">
              {!isClosed
                ? t("logbookStatus.open")
                : logbookComplete
                  ? completedLate
                    ? t("logbookStatus.completeLate")
                    : t("logbookStatus.complete")
                  : deadlineExceeded
                    ? t("logbookStatus.overdue")
                    : t("logbookStatus.pending", { days: daysRemaining })}
            </span>

            {!logbookComplete && isClosed && (
              <p className="mt-1 text-xs opacity-80">
                {!classificationComplete
                  ? t("logbookStatus.missingClassification")
                  : t("logbookStatus.missingPurpose")}
              </p>
            )}
          </div>

          {completedLate && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("logbookStatus.completedLateHint")}
            </p>
          )}

          {customerMissing && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("logbookStatus.customerHint")}
            </p>
          )}

          {deadlineExceeded && !logbookComplete && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("logbookStatus.lateChangeHint")}
            </p>
          )}
        </div>
      </Panel>

      <Panel className="mt-6" title={t("page.cardPostProcessing")}>
        <AnnotationForm
          driveId={drive.id}
          classification={classification}
          purpose={drive.purpose}
          customer={drive.customer}
          project={drive.project}
          notes={drive.notes}
          ruleCreateHref={ruleCreateHref}
        />

      </Panel>

      <Panel className="mt-6" title={t("page.cardTags")}>
        <TagManager
          driveId={drive.id}
          initialTags={drive.tags}
          allTagNames={allTags.map((t) => t.name)}
        />
      </Panel>

      <Panel className="mt-6" title={t("page.cardCorrectPlaces")}>
        <PlaceCorrection
          driveId={drive.id}
          start={{
            placeId: drive.startPlaceId,
            placeName: drive.startPlaceName,
            address: drive.startAddress,
            lat: drive.startLat,
            lon: drive.startLon,
            locked: drive.startPlaceLocked,
          }}
          end={{
            placeId: drive.endPlaceId,
            placeName: drive.endPlaceName,
            address: drive.endAddress,
            lat: drive.endLat,
            lon: drive.endLon,
            locked: drive.endPlaceLocked,
          }}
          allPlaces={allPlaces}
        />
      </Panel>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t("page.auditHistory")}
          </summary>
          <div className="mt-3">
            <AuditLogList entries={auditEntries} />
          </div>
        </details>
      </section>

      <Panel className="mt-6" title={t("page.cardExport")}>
        <div className="flex gap-1.5">
          <a
            href={`/api/export/drive/${drive.id}?format=csv`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            CSV
          </a>
          <a
            href={`/api/export/drive/${drive.id}?format=pdf`}
            className={buttonClasses("ghost", "sm")}
          >
            <Download aria-hidden size={14} />
            PDF
          </a>
          {route.points.length >= 2 && (
            <a
              href={`/api/export/drive/${drive.id}?format=gpx`}
              className={buttonClasses("ghost", "sm")}
            >
              <Download aria-hidden size={14} />
              GPX
            </a>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** Renders a drive's start_time as a YYYY-MM-DD in APP_TIMEZONE for the day-view link. */
function toDateParam(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(date);
}
