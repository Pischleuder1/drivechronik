import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

const REQUIRED_HEADERS = [
  "ChargeStartDateTime",
  "Vin",
  "SiteLocationName",
  "Description",
  "QuantityBase",
  "InvoiceNumber",
  "VAT",
  "Total Exc. VAT",
  "Total Inc. VAT",
  "Status",
  "Invoice",
] as const;

export interface TeslaChargingCsvRow {
  rowNumber: number;
  chargeStartTime: Date;
  name: string | null;
  vin: string;
  model: string | null;
  country: string | null;
  siteLocationName: string | null;
  description: string | null;

  quantityBaseRaw: string | null;
  energyKwh: number | null;

  unitCostBaseRaw: string | null;
  vatRaw: string | null;
  totalExVat: number | null;
  totalIncVat: number | null;

  invoiceNumber: string | null;
  status: string | null;
  invoiceUrl: string | null;

  currency: string | null;
  sourceHash: string;
  raw: Record<string, string>;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();

  if (
    text === "" ||
    text.toUpperCase() === "N/A" ||
    text.toUpperCase() === "NA"
  ) {
    return null;
  }

  return text;
}

function parseDecimal(value: unknown): number | null {
  const text = nullableText(value);
  if (!text) return null;

  let cleaned = text
    .replace(/\s+/g, "")
    .replace(/[^\d,.\-]/g, "");

  if (!cleaned) return null;

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (comma >= 0) {
    cleaned = cleaned.replace(",", ".");
  }

  const valueNumber = Number(cleaned);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

function parseEnergyKwh(value: unknown): number | null {
  const text = nullableText(value);
  if (!text) return null;

  // Zeitbasierte Tesla-Tarife sind keine Energiemenge.
  if (/\bmin\b/i.test(text) && !/kwh/i.test(text)) {
    return null;
  }

  const valueNumber = parseDecimal(text);
  return valueNumber != null && valueNumber >= 0 ? valueNumber : null;
}

function currencyForCountry(country: string | null): string | null {
  if (!country) return null;

  const code = country.trim().toUpperCase();

  if (
    [
      "DE",
      "AT",
      "BE",
      "ES",
      "FI",
      "FR",
      "IE",
      "IT",
      "LU",
      "NL",
      "PT",
    ].includes(code)
  ) {
    return "EUR";
  }

  const map: Record<string, string> = {
    CH: "CHF",
    GB: "GBP",
    DK: "DKK",
    NO: "NOK",
    SE: "SEK",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    RO: "RON",
  };

  return map[code] ?? null;
}

function hashRow(row: Record<string, string>): string {
  // Nur stabile Merkmale des Ladevorgangs verwenden.
  // Rechnungsnummer, Betrag und Zahlungsstatus können sich später ändern
  // und dürfen deshalb keine neue Import-Identität erzeugen.
  const stable = [
    row.ChargeStartDateTime ?? "",
    row.Vin ?? "",
    row.SiteLocationName ?? "",
    row.Description ?? "",
    row.QuantityBase ?? "",
    row.QuantityTier1 ?? "",
    row.QuantityTier2 ?? "",
    row.QuantityTier3 ?? "",
    row.QuantityTier4 ?? "",
  ].join("\u001f");

  return createHash("sha256").update(stable).digest("hex");
}

export function parseTeslaChargingCsv(
  input: string,
): TeslaChargingCsvRow[] {
  const normalized = input
    .replace(/^\uFEFF/, "")
    .replace(/[„“]/g, '"');

  const matrix = parse(normalized, {
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  }) as string[][];

  if (matrix.length === 0) {
    throw new Error("Die Tesla-CSV ist leer.");
  }

  const headers = matrix[0]!.map((value) => String(value).trim());

  const missing = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );

  if (missing.length > 0) {
    throw new Error(
      `Tesla-CSV nicht erkannt. Fehlende Spalten: ${missing.join(", ")}`,
    );
  }

  const rows: TeslaChargingCsvRow[] = [];

  for (let index = 1; index < matrix.length; index += 1) {
    const cells = matrix[index]!;

    const raw: Record<string, string> = {};

    headers.forEach((header, column) => {
      raw[header] = String(cells[column] ?? "").trim();
    });

    const startText = nullableText(raw.ChargeStartDateTime);

    if (!startText) {
      continue;
    }

    const chargeStartTime = new Date(startText);

    if (!Number.isFinite(chargeStartTime.getTime())) {
      throw new Error(
        `Ungültiges Tesla-Datum in CSV-Zeile ${index + 1}: ${startText}`,
      );
    }

    const vin = nullableText(raw.Vin);

    if (!vin) {
      throw new Error(
        `Fehlende VIN in CSV-Zeile ${index + 1}.`,
      );
    }

    const country = nullableText(raw.Country);

    rows.push({
      rowNumber: index + 1,
      chargeStartTime,
      name: nullableText(raw.Name),
      vin: vin.toUpperCase(),
      model: nullableText(raw.Model),
      country,
      siteLocationName: nullableText(raw.SiteLocationName),
      description: nullableText(raw.Description),

      quantityBaseRaw: nullableText(raw.QuantityBase),
      energyKwh: parseEnergyKwh(raw.QuantityBase),

      unitCostBaseRaw: nullableText(raw.UnitCostBase),
      vatRaw: nullableText(raw.VAT),
      totalExVat: parseDecimal(raw["Total Exc. VAT"]),
      totalIncVat: parseDecimal(raw["Total Inc. VAT"]),

      invoiceNumber: nullableText(raw.InvoiceNumber),
      status: nullableText(raw.Status),
      invoiceUrl: nullableText(raw.Invoice),

      currency: currencyForCountry(country),
      sourceHash: hashRow(raw),
      raw,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      "Die Tesla-CSV enthält keine verwertbaren Ladeeinträge.",
    );
  }

  return rows;
}
