export type LogbookClassification =
  | "unclassified"
  | "private"
  | "business"
  | "commute";

export interface LogbookAuditEntry {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDayNumber(date: Date, timeZone: string): number {
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

export function isLogbookComplete(
  classification: LogbookClassification,
  purpose: string | null,
): boolean {
  return (
    classification !== "unclassified" &&
    (classification !== "business" || (purpose?.trim().length ?? 0) > 0)
  );
}

export function detectLateLogbookCompletion({
  classification,
  purpose,
  endTime,
  auditEntries,
  timeZone,
}: {
  classification: LogbookClassification;
  purpose: string | null;
  endTime: Date | null;
  auditEntries: LogbookAuditEntry[];
  timeZone: string;
}): boolean {
  if (endTime == null || !isLogbookComplete(classification, purpose)) {
    return false;
  }

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
    (firstClassificationChange?.oldValue as LogbookClassification | null) ??
    classification;

  let historicPurpose =
    firstPurposeChange != null ? firstPurposeChange.oldValue : purpose;

  const historicComplete = () =>
    isLogbookComplete(historicClassification, historicPurpose);

  let completionChangedAt: Date | null = null;
  const initiallyComplete = historicComplete();
  let wasComplete = initiallyComplete;

  for (const entry of chronologicalAudit) {
    if (entry.field === "classification" && entry.newValue != null) {
      historicClassification =
        entry.newValue as LogbookClassification;
    } else if (entry.field === "purpose") {
      historicPurpose = entry.newValue;
    } else {
      continue;
    }

    const completeAfterChange = historicComplete();

    if (!wasComplete && completeAfterChange && completionChangedAt == null) {
      completionChangedAt = entry.changedAt;
    }

    wasComplete = completeAfterChange;
  }

  return (
    !initiallyComplete &&
    completionChangedAt != null &&
    calendarDayNumber(completionChangedAt, timeZone) -
      calendarDayNumber(endTime, timeZone) >
      7
  );
}
