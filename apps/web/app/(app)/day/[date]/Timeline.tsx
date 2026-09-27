import { getLocale, getTranslations } from "next-intl/server";
import { Zap } from "lucide-react";
import {
  formatDuration,
  formatKwh,
  formatPlaceLabel,
  formatSoc,
  formatTimeRange,
} from "@drivechronik/core";
import type {
  ChargeRow,
  DayTimeline,
  DriveRow,
  ParkRow,
} from "../../../../lib/queries";
import type { ParkLoss } from "../../../../lib/parkAnalytics";
import { toIntlLocale } from "../../../../lib/i18nLocale";
import { DriveEntry } from "./DriveEntry";

type Item =
  | { kind: "park"; start: number; row: ParkRow }
  | { kind: "drive"; start: number; row: DriveRow }
  | { kind: "charge"; start: number; row: ChargeRow };

function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDateTimeShort(
  date: Date,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export async function Timeline({
  timeline,
  tz,
  now,
  parkLossById,
}: {
  timeline: DayTimeline;
  tz: string;
  now: number;
  parkLossById?: Map<number, ParkLoss>;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("day"),
    getLocale(),
  ]);
  const items: Item[] = [
    ...timeline.parks.map((row) => ({
      kind: "park" as const,
      start: row.startTime.getTime(),
      row,
    })),
    ...timeline.drives.map((row) => ({
      kind: "drive" as const,
      start: row.startTime.getTime(),
      row,
    })),
    ...timeline.charges.map((row) => ({
      kind: "charge" as const,
      start: row.startTime.getTime(),
      row,
    })),
  ].sort((a, b) => a.start - b.start);

  return (
    <ol className="flex flex-col gap-2.5 md:gap-3">
      {items.map((item) => {
        if (item.kind === "park") {
          return (
            <ParkEntry
              key={`p${item.row.id}`}
              row={item.row}
              tz={tz}
              loss={parkLossById?.get(item.row.id) ?? null}
              t={t}
              locale={locale}
            />
          );
        }
        if (item.kind === "charge") {
          return (
            <ChargeEntry key={`c${item.row.id}`} row={item.row} tz={tz} t={t} />
          );
        }
        return (
          <DriveEntry
            key={`d${item.row.id}`}
            row={item.row}
            tz={tz}
            now={now}
          />
        );
      })}
    </ol>
  );
}

type DayT = Awaited<ReturnType<typeof getTranslations>>;

function ParkEntry({
  row,
  tz,
  loss,
  t,
  locale,
}: {
  row: ParkRow;
  tz: string;
  loss: ParkLoss | null;
  t: DayT;
  locale: string;
}) {
  const label = formatPlaceLabel(row.placeName, row.address, row.lat, row.lon);
  const dur =
    row.endTime != null
      ? formatDuration((row.endTime.getTime() - row.startTime.getTime()) / 1000)
      : null;

  const spansCalendarDays =
    row.endTime != null &&
    localDateKey(row.startTime, tz) !== localDateKey(row.endTime, tz);

  const timeLabel =
    row.endTime != null && spansCalendarDays
      ? `${formatDateTimeShort(row.startTime, tz, locale)} → ${formatDateTimeShort(
          row.endTime,
          tz,
          locale,
        )}`
      : formatTimeRange(row.startTime, row.endTime, tz);

  // Offener Park (endTime null): kein Vampir-Marker, egal was die Query liefert.
  const showLoss =
    row.endTime != null && loss != null && loss.lossPct != null && loss.lossPct >= 1;
  const showCharged = row.endTime != null && loss != null && loss.hadCharge;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[16px] border border-neutral-200 bg-white px-3 py-2.5 text-[12px] text-neutral-500 shadow-sm md:flex-nowrap md:rounded-none md:border-0 md:bg-transparent md:px-1 md:py-0 md:text-sm md:shadow-none dark:border-neutral-800 dark:bg-neutral-900 md:dark:bg-transparent dark:text-neutral-400">
      <span className="tabular-nums">
        {timeLabel}
      </span>
      <span aria-hidden>·</span>
      <span>{t("parkedAt", { place: label })}</span>
      {dur && (
        <>
          <span aria-hidden>·</span>
          <span>{dur}</span>
        </>
      )}
      {showLoss && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums text-red-400/80 dark:text-red-400/70">
            −{Math.round(loss!.lossPct!)} % SoC
          </span>
        </>
      )}
      {showCharged && (
        <>
          <span aria-hidden>·</span>
          <span>{t("chargedShort")}</span>
        </>
      )}
    </li>
  );
}

function ChargeEntry({ row, tz, t }: { row: ChargeRow; tz: string; t: DayT }) {
  const label = formatPlaceLabel(row.placeName, row.address, row.lat, row.lon);
  const parts: string[] = [];
  if (row.energyAddedKwh != null) {
    parts.push(formatKwh(row.energyAddedKwh, { sign: true }));
  }
  if (row.startSoc != null && row.endSoc != null) {
    parts.push(`${formatSoc(row.startSoc)} → ${formatSoc(row.endSoc)}`);
  }
  if (row.chargerType && row.maxPowerKw != null) {
    parts.push(
      `${row.chargerType.toUpperCase()} ${Math.round(row.maxPowerKw)} kW`,
    );
  }

  return (
    <li className="rounded-[18px] border border-neutral-200 border-l-4 border-l-emerald-400 bg-white px-3 py-3 text-[12px] shadow-sm transition-shadow hover:shadow-md md:rounded-2xl md:border md:border-emerald-200 md:bg-emerald-50 md:px-4 md:text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-neutral-600 md:text-emerald-800 dark:text-emerald-300">
        <Zap aria-hidden size={16} className="shrink-0" />
        <span className="tabular-nums">
          {formatTimeRange(row.startTime, row.endTime, tz)}
        </span>
        <span aria-hidden>·</span>
        <span className="font-medium">{t("chargedAt", { place: label })}</span>
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-2">
            <span aria-hidden>·</span>
            <span>{p}</span>
          </span>
        ))}
      </div>
    </li>
  );
}
