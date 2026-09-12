import { TZDate } from "@date-fns/tz";
import { readSheet } from "read-excel-file/node";

type SheetCell =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type TronityChargerType = "ac" | "dc";

export interface TronityChargingRow {
  rowNumber: number;

  type: string | null;

  startTime: Date;
  endTime: Date;

  startSoc: number | null;
  endSoc: number | null;

  durationSeconds: number;

  chargerType: TronityChargerType | null;

  energyKwh: number | null;
  energyTotalKwh: number | null;

  batteryKwh: number | null;
  rangeKm: number | null;

  maxPowerKw: number | null;

  co2Kg: number | null;
  co2TotalKg: number | null;

  cost: number | null;
  odometerKm: number | null;

  categories: string | null;
  chargingRate: string | null;

  address: string | null;
  chargingPoint: string | null;

  lat: number | null;
  lon: number | null;

  notes: string | null;
}

const REQUIRED_HEADERS = [
  "Start Datum",
  "Ende Datum",
] as const;

function textValue(value: SheetCell): string | null {
  if (value == null) return null;

  const valueText =
    value instanceof Date
      ? value.toISOString()
      : String(value).trim();

  return valueText === "" ? null : valueText;
}

function numberValue(value: SheetCell): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean" || value instanceof Date) {
    return null;
  }

  let normalized = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[€%]/g, "");

  if (!normalized) return null;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      normalized = normalized
        .replace(/\./g, "")
        .replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function percentValue(
  value: SheetCell,
  rowNumber: number,
  field: string,
): number | null {
  const parsed = numberValue(value);

  if (parsed == null) return null;

  const rounded = Math.round(parsed);

  if (rounded < 0 || rounded > 100) {
    throw new Error(
      `TRONITY-Zeile ${rowNumber}: ${field} liegt außerhalb von 0–100 %.`,
    );
  }

  return rounded;
}

function coordinateValue(
  value: SheetCell,
  rowNumber: number,
  field: string,
  min: number,
  max: number,
): number | null {
  const parsed = numberValue(value);

  if (parsed == null) return null;

  if (parsed < min || parsed > max) {
    throw new Error(
      `TRONITY-Zeile ${rowNumber}: ${field} ist ungültig.`,
    );
  }

  return parsed;
}

function localDateValue(
  value: SheetCell,
  timeZone: string,
  rowNumber: number,
  field: string,
): Date {
  if (value instanceof Date) {
    const zoned = new TZDate(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      timeZone,
    );

    return new Date(zoned.getTime());
  }

  const text = textValue(value);

  if (!text) {
    throw new Error(
      `TRONITY-Zeile ${rowNumber}: ${field} fehlt.`,
    );
  }

  const match = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) {
    throw new Error(
      `TRONITY-Zeile ${rowNumber}: ${field} hat ein unbekanntes Datumsformat (${text}).`,
    );
  }

  const [, day, month, year, hour, minute, second] =
    match;

  const zoned = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
    timeZone,
  );

  const result = new Date(zoned.getTime());

  if (Number.isNaN(result.getTime())) {
    throw new Error(
      `TRONITY-Zeile ${rowNumber}: ${field} enthält kein gültiges Datum.`,
    );
  }

  return result;
}

function chargerTypeValue(
  value: SheetCell,
): TronityChargerType | null {
  if (typeof value === "boolean") {
    return value ? "ac" : "dc";
  }

  const text = textValue(value)?.toLowerCase();

  if (!text) return null;

  if (
    text === "true" ||
    text === "wahr" ||
    text === "ja" ||
    text === "1" ||
    text === "ac"
  ) {
    return "ac";
  }

  if (
    text === "false" ||
    text === "falsch" ||
    text === "nein" ||
    text === "0" ||
    text === "dc"
  ) {
    return "dc";
  }

  return null;
}

function buildHeaderMap(
  headerRow: SheetCell[],
): Map<string, number> {
  const headers = new Map<string, number>();

  headerRow.forEach((value, index) => {
    const header = textValue(value);

    if (header && !headers.has(header)) {
      headers.set(header, index);
    }
  });

  for (const required of REQUIRED_HEADERS) {
    if (!headers.has(required)) {
      throw new Error(
        `Ungültiger TRONITY-Export: Spalte „${required}“ fehlt.`,
      );
    }
  }

  return headers;
}

function cell(
  row: SheetCell[],
  headers: Map<string, number>,
  name: string,
): SheetCell {
  const index = headers.get(name);

  return index == null ? null : row[index];
}

export function parseTronityChargingSheetData(
  data: SheetCell[][],
  timeZone: string,
): TronityChargingRow[] {
  if (data.length === 0) {
    throw new Error(
      "Der TRONITY-Export enthält keine Daten.",
    );
  }

  const headers = buildHeaderMap(data[0] ?? []);
  const result: TronityChargingRow[] = [];

  for (let index = 1; index < data.length; index++) {
    const row = data[index] ?? [];
    const rowNumber = index + 1;

    // TRONITY-Exporte können formatierte, aber ansonsten leere
    // Tabellenzeilen enthalten. Ohne Startdatum ist es keine Ladung.
    if (!textValue(cell(row, headers, "Start Datum"))) {
      continue;
    }

    const startTime = localDateValue(
      cell(row, headers, "Start Datum"),
      timeZone,
      rowNumber,
      "Start Datum",
    );

    const endTime = localDateValue(
      cell(row, headers, "Ende Datum"),
      timeZone,
      rowNumber,
      "Ende Datum",
    );

    if (endTime.getTime() < startTime.getTime()) {
      throw new Error(
        `TRONITY-Zeile ${rowNumber}: Ende liegt vor dem Start.`,
      );
    }

    result.push({
      rowNumber,

      type: textValue(
        cell(row, headers, "Typ"),
      ),

      startTime,
      endTime,

      startSoc: percentValue(
        cell(row, headers, "Start Level"),
        rowNumber,
        "Start Level",
      ),

      endSoc: percentValue(
        cell(row, headers, "Ende Level"),
        rowNumber,
        "Ende Level",
      ),

      // Die Zeitstempel sind maßgeblich. Damit bleiben Start/Ende
      // und Dauer auch bei abweichender Excel-Formatierung konsistent.
      durationSeconds: Math.round(
        (endTime.getTime() - startTime.getTime()) /
          1000,
      ),

      chargerType: chargerTypeValue(
        cell(row, headers, "AC"),
      ),

      // Beide TRONITY-Energiewerte zunächst getrennt erhalten.
      energyKwh: numberValue(
        cell(row, headers, "Geladen (kWh)"),
      ),

      energyTotalKwh: numberValue(
        cell(row, headers, "Geladen gesamt (kWh)"),
      ),

      batteryKwh: numberValue(
        cell(row, headers, "Batterie (kWh)"),
      ),

      rangeKm: numberValue(
        cell(row, headers, "Reichweite (km)"),
      ),

      maxPowerKw: numberValue(
        cell(row, headers, "Max (kW)"),
      ),

      co2Kg: numberValue(
        cell(row, headers, "CO2 (kg)"),
      ),

      co2TotalKg: numberValue(
        cell(row, headers, "CO₂ Ges. (kg)"),
      ),

      cost: numberValue(
        cell(row, headers, "Kosten (EUR)"),
      ),

      odometerKm: numberValue(
        cell(row, headers, "Kilometer (km)"),
      ),

      categories: textValue(
        cell(row, headers, "Kategorien"),
      ),

      chargingRate: textValue(
        cell(row, headers, "Ladetarif"),
      ),

      address: textValue(
        cell(row, headers, "Adresse"),
      ),

      chargingPoint: textValue(
        cell(row, headers, "Ladepunkt"),
      ),

      lat: coordinateValue(
        cell(row, headers, "Breitengrad"),
        rowNumber,
        "Breitengrad",
        -90,
        90,
      ),

      lon: coordinateValue(
        cell(row, headers, "Längengrad"),
        rowNumber,
        "Längengrad",
        -180,
        180,
      ),

      notes: textValue(
        cell(row, headers, "Bemerkung"),
      ),
    });
  }

  if (result.length === 0) {
    throw new Error(
      "Im TRONITY-Export wurden keine Ladevorgänge gefunden.",
    );
  }

  return result;
}

export async function parseTronityChargingXlsx(
  buffer: Buffer,
  timeZone: string,
): Promise<TronityChargingRow[]> {
  const data = await readSheet(buffer, "Ladungen");

  return parseTronityChargingSheetData(
    data as SheetCell[][],
    timeZone,
  );
}
