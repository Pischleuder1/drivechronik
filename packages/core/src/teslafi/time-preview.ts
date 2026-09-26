import {
  isValidIanaTimeZone,
  teslaFiLocalTimeToUtc,
} from "./timezone.js";

export interface TeslaFiTimePreview {
  timeZone: string;
  validTimeZone: boolean;

  convertedRows: number;
  invalidRows: number;
  ambiguousRows: number;

  minUtcIso: string | null;
  maxUtcIso: string | null;
}

export function previewTeslaFiTimes(
  localDateTimes: Array<string | null>,
  timeZone: string,
): TeslaFiTimePreview {
  if (!isValidIanaTimeZone(timeZone)) {
    return {
      timeZone,
      validTimeZone: false,
      convertedRows: 0,
      invalidRows:
        localDateTimes.filter(
          (value) => value != null,
        ).length,
      ambiguousRows: 0,
      minUtcIso: null,
      maxUtcIso: null,
    };
  }

  let convertedRows = 0;
  let invalidRows = 0;
  let ambiguousRows = 0;

  let minUtcMs: number | null = null;
  let maxUtcMs: number | null = null;

  for (const value of localDateTimes) {
    if (!value) {
      invalidRows++;
      continue;
    }

    const result =
      teslaFiLocalTimeToUtc(
        value,
        timeZone,
      );

    if (
      !result.valid ||
      result.utcMs == null
    ) {
      invalidRows++;
      continue;
    }

    convertedRows++;

    if (result.ambiguous) {
      ambiguousRows++;
    }

    if (
      minUtcMs == null ||
      result.utcMs < minUtcMs
    ) {
      minUtcMs = result.utcMs;
    }

    if (
      maxUtcMs == null ||
      result.utcMs > maxUtcMs
    ) {
      maxUtcMs = result.utcMs;
    }
  }

  return {
    timeZone,
    validTimeZone: true,
    convertedRows,
    invalidRows,
    ambiguousRows,

    minUtcIso:
      minUtcMs == null
        ? null
        : new Date(
            minUtcMs,
          ).toISOString(),

    maxUtcIso:
      maxUtcMs == null
        ? null
        : new Date(
            maxUtcMs,
          ).toISOString(),
  };
}
