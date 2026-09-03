import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gte, isNull, isNotNull, notInArray, sql } from "drizzle-orm";
import { classificationRules, drives, places, tags } from "@drivechronik/db";
import { analyzeDepartureMinutes, isoWeekday, minuteOfDay, routePatternConfidence } from "@drivechronik/core";
import { APP_TIMEZONE } from "./config";
import { db } from "./db";
import type { Classification } from "./classification";

export interface RuleSuggestion {
  startPlaceId: number;
  startPlaceName: string;
  endPlaceId: number;
  endPlaceName: string;
  driveCount: number;
  lastDriveAt: Date;
  weekdays: number[];
  typicalMinute: number | null;
  spreadMinutes: number | null;
  confidence: "high" | "medium" | "low" | null;
  startMinuteFrom: number | null;
  startMinuteTo: number | null;
}

export interface ClassificationRuleRow {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  startPlaceId: number | null;
  startPlaceName: string | null;
  endPlaceId: number | null;
  endPlaceName: string | null;
  weekdays: number[] | null;
  startMinuteFrom: number | null;
  startMinuteTo: number | null;
  classification: Classification | null;
  tagId: number | null;
  tagName: string | null;
  purpose: string | null;
  customer: string | null;
  project: string | null;
}

function ruleSelect() {
  const startPlace = alias(places, "rule_start_place");
  const endPlace = alias(places, "rule_end_place");
  return db
    .select({
      id: classificationRules.id,
      name: classificationRules.name,
      enabled: classificationRules.enabled,
      priority: classificationRules.priority,
      startPlaceId: classificationRules.startPlaceId,
      startPlaceName: startPlace.name,
      endPlaceId: classificationRules.endPlaceId,
      endPlaceName: endPlace.name,
      weekdays: classificationRules.weekdays,
      startMinuteFrom: classificationRules.startMinuteFrom,
      startMinuteTo: classificationRules.startMinuteTo,
      classification: classificationRules.classification,
      tagId: classificationRules.tagId,
      tagName: tags.name,
      purpose: classificationRules.purpose,
      customer: classificationRules.customer,
      project: classificationRules.project,
    })
    .from(classificationRules)
    .leftJoin(startPlace, eq(classificationRules.startPlaceId, startPlace.id))
    .leftJoin(endPlace, eq(classificationRules.endPlaceId, endPlace.id))
    .leftJoin(tags, eq(classificationRules.tagId, tags.id));
}

/**
 * Alle Klassifizierungs-Regeln mit aufgelösten Start-/Ziel-Ort- und Tag-Namen,
 * sortiert wie die Anwendung sie auswertet (priority ASC, id ASC).
 */
export async function getClassificationRules(): Promise<ClassificationRuleRow[]> {
  return ruleSelect().orderBy(
    asc(classificationRules.priority),
    asc(classificationRules.id),
  );
}

/** Eine einzelne Regel für das Bearbeiten-Formular. */
export async function getRuleById(
  id: number,
): Promise<ClassificationRuleRow | null> {
  const rows = await ruleSelect()
    .where(eq(classificationRules.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// Historische Importquellen zählen nicht als laufender Klassifizierungsbedarf
// (deckungsgleich mit lib/dashboard.ts).
const IMPORTED_SOURCES = ["tessie"];

/**
 * Anzahl unklassifizierter Live-Fahrten, die Regeln noch anfassen würden:
 * abgeschlossen (endTime gesetzt), classification='unclassified', ohne
 * Regel-Provenance, keine Importquelle.
 */
export async function getUnclassifiedLiveCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(drives)
    .where(
      and(
        eq(drives.classification, "unclassified"),
        isNull(drives.classifiedByRuleId),
        isNotNull(drives.endTime),
        notInArray(drives.source, IMPORTED_SOURCES),
      ),
    );
  return rows[0]?.count ?? 0;
}

/**
 * Wiederkehrende unklassifizierte Fahrten der letzten 14 Tage.
 *
 * Ein Vorschlag entsteht ab drei Fahrten mit identischem Start- und Zielort.
 * Existiert bereits eine Regel für diese Ortskombination, wird kein Vorschlag
 * erzeugt.
 */
export async function getRuleSuggestions(): Promise<RuleSuggestion[]> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const startPlace = alias(places, "suggestion_start_place");
  const endPlace = alias(places, "suggestion_end_place");

  const candidates = await db
    .select({
      startPlaceId: drives.startPlaceId,
      startPlaceName: startPlace.name,
      endPlaceId: drives.endPlaceId,
      endPlaceName: endPlace.name,
      driveCount: sql<number>`count(*)::int`,
      lastDriveAt: sql<Date>`max(${drives.startTime})`,
    })
    .from(drives)
    .innerJoin(startPlace, eq(drives.startPlaceId, startPlace.id))
    .innerJoin(endPlace, eq(drives.endPlaceId, endPlace.id))
    .where(
      and(
        eq(drives.classification, "unclassified"),
        isNull(drives.classifiedByRuleId),
        isNotNull(drives.endTime),
        isNotNull(drives.startPlaceId),
        isNotNull(drives.endPlaceId),
        gte(drives.startTime, cutoff),
        notInArray(drives.source, IMPORTED_SOURCES),
      ),
    )
    .groupBy(
      drives.startPlaceId,
      startPlace.name,
      drives.endPlaceId,
      endPlace.name,
    )
    .having(sql`count(*) >= 3`)
    .orderBy(desc(sql`count(*)`))
    .limit(12);

  const suggestionDrives = await db
    .select({
      startPlaceId: drives.startPlaceId,
      endPlaceId: drives.endPlaceId,
      startTime: drives.startTime,
    })
    .from(drives)
    .where(
      and(
        eq(drives.classification, "unclassified"),
        isNull(drives.classifiedByRuleId),
        isNotNull(drives.endTime),
        isNotNull(drives.startPlaceId),
        isNotNull(drives.endPlaceId),
        gte(drives.startTime, cutoff),
        notInArray(drives.source, IMPORTED_SOURCES),
      ),
    );

  const existingRules = await db
    .select({
      startPlaceId: classificationRules.startPlaceId,
      endPlaceId: classificationRules.endPlaceId,
    })
    .from(classificationRules)
    .where(
      and(
        isNotNull(classificationRules.startPlaceId),
        isNotNull(classificationRules.endPlaceId),
      ),
    );

  const existingPairs = new Set(
    existingRules.map(
      (rule) => `${rule.startPlaceId}:${rule.endPlaceId}`,
    ),
  );

  const drivePatterns = new Map<
    string,
    {
      weekdays: Set<number>;
      minutes: number[];
    }
  >();

  for (const drive of suggestionDrives) {
    if (
      drive.startPlaceId == null ||
      drive.endPlaceId == null ||
      drive.startTime == null
    ) {
      continue;
    }

    const key = `${drive.startPlaceId}:${drive.endPlaceId}`;
    const pattern =
      drivePatterns.get(key) ?? {
        weekdays: new Set<number>(),
        minutes: [],
      };

    pattern.weekdays.add(isoWeekday(drive.startTime, APP_TIMEZONE));
    pattern.minutes.push(minuteOfDay(drive.startTime, APP_TIMEZONE));
    drivePatterns.set(key, pattern);
  }

  return candidates
    .filter(
      (candidate) =>
        candidate.startPlaceId != null &&
        candidate.startPlaceName != null &&
        candidate.endPlaceId != null &&
        candidate.endPlaceName != null &&
        !existingPairs.has(
          `${candidate.startPlaceId}:${candidate.endPlaceId}`,
        ),
    )
    .slice(0, 6)
    .map((candidate) => {
      const key = `${candidate.startPlaceId}:${candidate.endPlaceId}`;
      const pattern = drivePatterns.get(key);

      const weekdays = pattern
        ? [...pattern.weekdays].sort((a, b) => a - b)
        : [];

      const minutes = pattern?.minutes ?? [];
      const departurePattern = analyzeDepartureMinutes(minutes);

      return {
        startPlaceId: candidate.startPlaceId!,
        startPlaceName: candidate.startPlaceName!,
        endPlaceId: candidate.endPlaceId!,
        endPlaceName: candidate.endPlaceName!,
        driveCount: candidate.driveCount,
        lastDriveAt: candidate.lastDriveAt,
        weekdays,
        typicalMinute: departurePattern?.typicalMinute ?? null,
        spreadMinutes: departurePattern?.spreadMinutes ?? null,
        confidence: routePatternConfidence(
          candidate.driveCount,
          departurePattern?.medianDeviationMinutes ?? null,
        ),
        startMinuteFrom:
          departurePattern == null
            ? null
            : Math.max(0, departurePattern.minMinute - 15),
        startMinuteTo:
          departurePattern == null
            ? null
            : Math.min(1439, departurePattern.maxMinute + 15),
      };
    });
}
