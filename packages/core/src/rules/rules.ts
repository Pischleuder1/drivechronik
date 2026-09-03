/**
 * Auto-Klassifizierungs-Regeln — reine Matching-Engine (kein Drizzle, kein I/O).
 *
 * Semantik (siehe schema.ts / Vision §13):
 * - Bedingungen (startPlaceId, endPlaceId, weekdays) sind AND-verknüpft.
 * - null bzw. leeres weekdays-Array = beliebig (keine Einschränkung).
 * - Eine Regel ganz OHNE Bedingung matcht NIE (schützt davor, dass eine
 *   versehentlich leere Regel pauschal alle Fahrten klassifiziert).
 * - Anwendung: erste passende Regel nach priority ASC, id ASC gewinnt.
 *
 * Der Aufrufer reicht `weekdayIso` fertig berechnet herein (aus startTime +
 * Timezone), damit die Engine frei von Zeitzonen-/DB-Abhängigkeiten bleibt;
 * `isoWeekday` steht als reiner Helper dafür bereit.
 */

/** Nur die zum Matchen nötigen Regel-Felder — Aktionen ignoriert die Engine. */
export interface MatchableRule {
  id: number;
  priority: number;
  startPlaceId: number | null;
  endPlaceId: number | null;
  /** ISO-Wochentage 1=Mo … 7=So; null oder [] = alle Tage. */
  weekdays: number[] | null;
  /** Minuten seit Mitternacht; null = keine Zeitgrenze. */
  startMinuteFrom: number | null;
  startMinuteTo: number | null;
}

/** Fahrt-Merkmale, gegen die eine Regel prüft. */
export interface DriveLike {
  startPlaceId: number | null;
  endPlaceId: number | null;
  /** ISO-Wochentag der Startzeit (1..7) oder null, wenn unbekannt. */
  weekdayIso: number | null;
  /** Startzeit als Minuten seit Mitternacht oder null, wenn unbekannt. */
  startMinuteOfDay?: number | null;
}

/** Hat die Regel überhaupt eine gesetzte Bedingung? */
function hasAnyCondition(rule: MatchableRule): boolean {
  return (
    rule.startPlaceId != null ||
    rule.endPlaceId != null ||
    (rule.weekdays != null && rule.weekdays.length > 0) ||
    rule.startMinuteFrom != null ||
    rule.startMinuteTo != null
  );
}

/**
 * Prüft, ob `drive` alle gesetzten Bedingungen von `rule` erfüllt (AND).
 * Eine Regel ohne jede Bedingung matcht nie.
 */
export function matchRule(drive: DriveLike, rule: MatchableRule): boolean {
  if (!hasAnyCondition(rule)) return false;

  if (rule.startPlaceId != null && drive.startPlaceId !== rule.startPlaceId) {
    return false;
  }
  if (rule.endPlaceId != null && drive.endPlaceId !== rule.endPlaceId) {
    return false;
  }
  if (rule.weekdays != null && rule.weekdays.length > 0) {
    if (drive.weekdayIso == null || !rule.weekdays.includes(drive.weekdayIso)) {
      return false;
    }
  }
  if (rule.startMinuteFrom != null || rule.startMinuteTo != null) {
    if (drive.startMinuteOfDay == null) return false;

    const from = rule.startMinuteFrom;
    const to = rule.startMinuteTo;
    const minute = drive.startMinuteOfDay;

    if (from != null && to != null) {
      const matches =
        from <= to
          ? minute >= from && minute <= to
          : minute >= from || minute <= to;

      if (!matches) return false;
    } else if (from != null && minute < from) {
      return false;
    } else if (to != null && minute > to) {
      return false;
    }
  }

  return true;
}

/**
 * Findet die erste passende Regel nach priority ASC, id ASC. Sortiert intern
 * (robust gegen unsortierte Eingabe) und gibt das komplette Regel-Objekt
 * zurück, damit der Aufrufer dessen Aktionsfelder anwenden kann.
 */
export function findMatchingRule<R extends MatchableRule>(
  drive: DriveLike,
  rules: readonly R[],
): R | null {
  const ordered = [...rules].sort(
    (a, b) => a.priority - b.priority || a.id - b.id,
  );
  for (const rule of ordered) {
    if (matchRule(drive, rule)) return rule;
  }
  return null;
}

const ISO_WEEKDAY_BY_SHORT: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * ISO-Wochentag (1=Mo … 7=So) eines Zeitpunkts in einer IANA-Zeitzone.
 * Nutzt Intl, damit DST/Zonenübergänge korrekt berücksichtigt werden.
 */
export function isoWeekday(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const iso = ISO_WEEKDAY_BY_SHORT[short];
  if (iso == null) {
    throw new Error(`Unerwarteter Wochentag "${short}" für Zone ${timeZone}`);
  }
  return iso;
}

export function minuteOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Unerwartete Uhrzeit für Zone ${timeZone}`);
  }

  return hour * 60 + minute;
}

/**
 * Zeitliches Muster wiederkehrender Abfahrten.
 *
 * `typicalMinute` ist der Median der beobachteten Startzeiten.
 * `spreadMinutes` beschreibt die gesamte Spannweite zwischen frühester
 * und spätester beobachteter Abfahrt.
 */
export interface DepartureTimePattern {
  typicalMinute: number;
  minMinute: number;
  maxMinute: number;
  spreadMinutes: number;
  medianDeviationMinutes: number;
}

export function analyzeDepartureMinutes(
  minutes: readonly number[],
): DepartureTimePattern | null {
  const valid = minutes
    .filter(
      (minute) =>
        Number.isInteger(minute) &&
        minute >= 0 &&
        minute <= 1439,
    )
    .sort((a, b) => a - b);

  if (valid.length === 0) {
    return null;
  }

  const middle = Math.floor(valid.length / 2);
  const typicalMinute =
    valid.length % 2 === 1
      ? valid[middle]!
      : Math.round((valid[middle - 1]! + valid[middle]!) / 2);

  const minMinute = valid[0]!;
  const maxMinute = valid[valid.length - 1]!;

  const deviations = valid
    .map((minute) => Math.abs(minute - typicalMinute))
    .sort((a, b) => a - b);

  const deviationMiddle = Math.floor(deviations.length / 2);
  const medianDeviationMinutes =
    deviations.length % 2 === 1
      ? deviations[deviationMiddle]!
      : Math.round(
          (deviations[deviationMiddle - 1]! +
            deviations[deviationMiddle]!) /
            2,
        );

  return {
    typicalMinute,
    minMinute,
    maxMinute,
    spreadMinutes: maxMinute - minMinute,
    medianDeviationMinutes,
  };
}

export type RoutePatternConfidence = "high" | "medium" | "low";

/**
 * Bewertet, wie belastbar ein wiederkehrendes zeitliches Fahrmuster ist.
 *
 * high:
 *   mindestens 6 Beobachtungen und mediane Zeitabweichung <= 15 Minuten
 *
 * medium:
 *   mindestens 4 Beobachtungen und mediane Zeitabweichung <= 30 Minuten
 *
 * low:
 *   mindestens 3 Beobachtungen
 *
 * Unter drei Beobachtungen entsteht noch kein belastbares Muster.
 */
export function routePatternConfidence(
  driveCount: number,
  medianDeviationMinutes: number | null,
): RoutePatternConfidence | null {
  if (driveCount < 3 || medianDeviationMinutes == null) {
    return null;
  }

  if (driveCount >= 6 && medianDeviationMinutes <= 15) {
    return "high";
  }

  if (driveCount >= 4 && medianDeviationMinutes <= 30) {
    return "medium";
  }

  return "low";
}
