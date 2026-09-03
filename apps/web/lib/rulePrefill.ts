export type RulePrefillClassification =
  | "private"
  | "business"
  | "commute";

export type RulePrefillSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface RulePrefill {
  name: string;
  priority: number;
  enabled: boolean;
  startPlaceId: number | null;
  endPlaceId: number | null;
  weekdays: number[] | null;
  startMinuteFrom: number | null;
  startMinuteTo: number | null;
  classification: RulePrefillClassification | null;
  tagId: number | null;
  purpose: string | null;
  customer: string | null;
  project: string | null;
}

function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function textParam(
  value: string | string[] | undefined,
  maxLength: number,
): string | null {
  const text = first(value)?.trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function placeIdParam(
  value: string | string[] | undefined,
  validPlaceIds: ReadonlySet<number>,
): number | null {
  const raw = first(value);
  if (raw == null || raw.trim() === "") return null;

  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;

  return validPlaceIds.has(id) ? id : null;
}

function weekdaysParam(
  value: string | string[] | undefined,
): number[] | null {
  const values = Array.isArray(value) ? value : value != null ? [value] : [];
  const weekdays = [...new Set(values.map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);

  return weekdays.length > 0 ? weekdays : null;
}

function classificationParam(
  value: string | string[] | undefined,
): RulePrefillClassification | null {
  const raw = first(value);

  if (
    raw === "private" ||
    raw === "business" ||
    raw === "commute"
  ) {
    return raw;
  }

  return null;
}

/**
 * Builds safe defaults for /rules/new.
 *
 * Query parameters only prefill the form. The createRule server action
 * remains the authoritative validation layer when the rule is saved.
 */
export function buildRulePrefill(
  params: RulePrefillSearchParams,
  validPlaceIds: readonly number[],
): RulePrefill {
  const ids = new Set(validPlaceIds);

  return {
    name: textParam(params.name, 200) ?? "",
    priority: 0,
    enabled: true,
    startPlaceId: placeIdParam(params.startPlaceId, ids),
    endPlaceId: placeIdParam(params.endPlaceId, ids),
    weekdays: weekdaysParam(params.weekdays),
    startMinuteFrom: null,
    startMinuteTo: null,
    classification: classificationParam(params.classification),
    tagId: null,
    purpose: null,
    customer: textParam(params.customer, 200),
    project: null,
  };
}
