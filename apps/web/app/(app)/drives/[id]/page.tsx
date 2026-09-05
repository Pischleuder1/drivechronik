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
  CLASSIFICATION_BADGE,
  type Classification,
} from "../../../../lib/classification";
import { buttonClasses } from "../../../../components/ui/Button";
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

const DAY_MS = 24 * 60 * 60 * 1000;

function calendarDayNumber(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export const dynamic = "force-dynamic";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
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
  const purposeComplete = (drive.purpose?.trim().length ?? 0) > 0;
  const customerMissing =
    classification === "business" &&
    (drive.customer?.trim().length ?? 0) === 0;

  const logbookComplete =
    classificationComplete &&
    (classification !== "business" || purposeComplete);

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

  // Reconstruct classification/purpose changes chronologically. We only flag
  // late completion when the audit history proves that an incomplete drive
  // became complete after the seven-calendar-day period.
  const chronologicalAudit = [...auditEntries].sort(
    (a, b) =>
      a.changedAt.getTime() - b.changedAt.getTime() || a.id - b.id,
  );

  const firstClassificationChange = chronologicalAudit.find(
    (entry) => entry.field === "classification",
  );
  const firstPurposeChange = chronologicalAudit.find(
    (entry) => entry.field === "purpose",
  );

  let historicClassification =
    (firstClassificationChange?.oldValue as Classification | null) ??
    classification;
  let historicPurpose =
    firstPurposeChange != null
      ? firstPurposeChange.oldValue
      : drive.purpose;

  const historicComplete = () =>
    historicClassification !== "unclassified" &&
    (historicClassification !== "business" ||
      (historicPurpose?.trim().length ?? 0) > 0);

  let completionChangedAt: Date | null = null;
  const initiallyComplete = historicComplete();
  let wasComplete = initiallyComplete;

  for (const entry of chronologicalAudit) {
    if (entry.field === "classification" && entry.newValue != null) {
      historicClassification = entry.newValue as Classification;
    } else if (entry.field === "purpose") {
      historicPurpose = entry.newValue;
    } else {
      continue;
    }

    const isCompleteAfterChange = historicComplete();
    if (!wasComplete && isCompleteAfterChange && completionChangedAt == null) {
      completionChangedAt = entry.changedAt;
    }
    wasComplete = isCompleteAfterChange;
  }

  const completedLate =
    isClosed &&
    logbookComplete &&
    !initiallyComplete &&
    completionChangedAt != null &&
    calendarDayNumber(completionChangedAt, APP_TIMEZONE) -
      calendarDayNumber(drive.endTime!, APP_TIMEZONE) >
      7;

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
    <div className="mx-auto max-w-2xl">
      <Link
        href="/day"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronLeft aria-hidden size={16} />
        {tCommon("actions.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {formatLongDate(dateStr, locale)} ·{" "}
            {formatTimeRange(drive.startTime, drive.endTime, APP_TIMEZONE)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {from} <span className="text-neutral-400">→</span> {to}
          </h1>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${CLASSIFICATION_BADGE[classification]}`}
        >
          {tCommon(`classification.${classification}`)}
        </span>
      </div>

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

      <Card title={t("page.cardMetrics")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {kennzahlen.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {drive.energyIsEstimated && drive.consumedEnergyKwh != null && (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            {t("page.estimatedNote")}
          </p>
        )}
      </Card>

      <Card title={t("page.cardRoute")}>
        {route.points.length >= 2 ? (
          <>
            <DriveMapLoader points={route.points} />

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsDistance")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.stats.gpsDistanceKm != null
                    ? formatKm(route.stats.gpsDistanceKm)
                    : "—"}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsPoints")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.totalCount}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsRecording")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.stats.recordingDurationSeconds != null
                    ? formatDuration(
                        Math.round(route.stats.recordingDurationSeconds),
                      )
                    : "—"}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsInterval")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.stats.avgIntervalSeconds != null
                    ? `${route.stats.avgIntervalSeconds.toFixed(1)} s`
                    : "—"}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsAvgSpeed")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.stats.avgSpeedKmh != null
                    ? formatSpeed(route.stats.avgSpeedKmh)
                    : "—"}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsMaxSpeed")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.stats.maxSpeedKmh != null
                    ? formatSpeed(route.stats.maxSpeedKmh)
                    : "—"}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsSoc")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {route.stats.startSoc != null || route.stats.endSoc != null
                    ? `${route.stats.startSoc != null ? formatSoc(route.stats.startSoc) : "—"} → ${route.stats.endSoc != null ? formatSoc(route.stats.endSoc) : "—"}`
                    : "—"}
                </dd>
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("page.gpsCoverage")}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {gpsCoveragePercent != null ? `${gpsCoveragePercent} %` : "—"}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t("page.gpsSource")}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("page.noTrackData")}
          </p>
        )}
      </Card>

      {route.points.length >= 2 && (
        <Card title={t("page.cardCourse")}>
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
        </Card>
      )}

      <Card title={t("page.cardLogbookStatus")}>
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
      </Card>

      <Card title={t("page.cardPostProcessing")}>
        <AnnotationForm
          driveId={drive.id}
          classification={classification}
          purpose={drive.purpose}
          customer={drive.customer}
          project={drive.project}
          notes={drive.notes}
          ruleCreateHref={ruleCreateHref}
        />

      </Card>

      <Card title={t("page.cardTags")}>
        <TagManager
          driveId={drive.id}
          initialTags={drive.tags}
          allTagNames={allTags.map((t) => t.name)}
        />
      </Card>

      <Card title={t("page.cardCorrectPlaces")}>
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
      </Card>

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

      <Card title={t("page.cardExport")}>
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
      </Card>
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
