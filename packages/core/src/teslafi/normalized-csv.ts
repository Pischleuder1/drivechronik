import {
  parseCsvLine,
} from "../tessie/parse.js";

import {
  normalizeTeslaFiRow,
  type TeslaFiNormalizedRow,
} from "./normalized.js";

import {
  type TeslaFiDistanceUnit,
} from "./units.js";

export const TESLAFI_REQUIRED_HEADERS = [
  "Date_Time",
  "Odometer",
] as const;

export interface TeslaFiNormalizedCsvOptions {
  timeZone?: string;
  distanceUnit: TeslaFiDistanceUnit;
}

export interface TeslaFiNormalizedCsv {
  headers: string[];

  rowCount: number;
  validRows: number;
  invalidRows: number;

  missingRequiredHeaders: string[];

  localDateTimes: Array<string | null>;

  rows: TeslaFiNormalizedRow[];
}

export function parseTeslaFiNormalizedCsv(
  csvText: string,
  options: TeslaFiNormalizedCsvOptions,
): TeslaFiNormalizedCsv {
  const normalized =
    csvText.replace(/^\uFEFF/, "");

  const lines = normalized
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim().length > 0,
    );

  if (lines.length === 0) {
    throw new Error(
      "TeslaFi CSV ist leer.",
    );
  }

  const headers =
    parseCsvLine(
      lines[0]!,
    ).map(
      (value) =>
        value?.trim() ?? "",
    );

  const headerMap =
    new Map<string, number>();

  headers.forEach(
    (header, index) => {
      if (
        header !== "" &&
        !headerMap.has(header)
      ) {
        headerMap.set(
          header,
          index,
        );
      }
    },
  );

  const missingRequiredHeaders =
    TESLAFI_REQUIRED_HEADERS.filter(
      (header) =>
        !headerMap.has(header),
    );

  const rows:
    TeslaFiNormalizedRow[] = [];

  const localDateTimes:
    Array<string | null> = [];

  let invalidRows = 0;

  for (
    let lineIndex = 1;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const fields =
      parseCsvLine(
        lines[lineIndex]!,
      );

    if (
      fields.length !==
      headers.length
    ) {
      invalidRows++;
      continue;
    }

    const field = (
      name: string,
    ): string | null => {
      const index =
        headerMap.get(name);

      if (index == null) {
        return null;
      }

      return (
        fields[index] ?? null
      );
    };

    localDateTimes.push(
      field("Date_Time"),
    );

    const row =
      normalizeTeslaFiRow(
        field,
        {
          timeZone:
            options.timeZone,
          distanceUnit:
            options.distanceUnit,
          lineNumber:
            lineIndex + 1,
        },
      );

    if (!row) {
      invalidRows++;
      continue;
    }

    rows.push(row);
  }

  return {
    headers,

    rowCount:
      Math.max(
        0,
        lines.length - 1,
      ),

    validRows:
      rows.length,

    invalidRows,

    missingRequiredHeaders:
      [
        ...missingRequiredHeaders,
      ],

    localDateTimes,

    rows,
  };
}
