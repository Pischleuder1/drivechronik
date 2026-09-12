import "server-only";

import { createHash } from "node:crypto";

import { stringify } from "csv-stringify/sync";
import {
  asc,
  getTableColumns,
  inArray,
} from "drizzle-orm";
import { strToU8, zipSync } from "fflate";

import {
  auditLog,
  chargePoints,
  chargeSessions,
  chargeSessionTags,
  classificationRules,
  driveTags,
  drives,
  importChanges,
  importRuns,
  journeyItems,
  journeys,
  monthSeals,
  parkSessions,
  places,
  routePoints,
  settings,
  softwareUpdates,
  tags,
  teslaChargingRecords,
  vehicleMetrics,
  vehicles,
  vehicleStatus,
} from "@drivechronik/db";

import { db } from "../db";

const EXPORT_FORMAT = "drivechronik-full-data-export";
const EXPORT_FORMAT_VERSION = 1;

const USER_SETTING_KEYS = [
  "business_reimbursement_rate_eur_per_km",
  "driver_name",
] as const;

type JsonPrimitive =
  | string
  | number
  | boolean
  | null;

type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type ExportRow = Record<string, JsonValue>;

interface ExportTable {
  name: string;
  columns: string[];
  rows: ExportRow[];
}

interface ExportFileManifest {
  path: string;
  sha256: string;
  bytes: number;
}

interface ExportTableManifest {
  rows: number;
  columns: string[];
  json: ExportFileManifest;
  csv: ExportFileManifest;
}

export interface FullDataExportManifest {
  format: typeof EXPORT_FORMAT;
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  createdAt: string;
  tables: Record<string, ExportTableManifest>;
  excluded: {
    table: string;
    reason: string;
  }[];
}

export interface FullDataExportResult {
  filename: string;
  bytes: Uint8Array;
  manifest: FullDataExportManifest;
}

function normalizeJson(
  value: unknown,
): JsonValue {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : String(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>,
      )
        .sort(([left], [right]) =>
          left.localeCompare(right),
        )
        .map(([key, nested]) => [
          key,
          normalizeJson(nested),
        ]),
    );
  }

  return String(value);
}

function normalizeRows(
  rows: Record<string, unknown>[],
): ExportRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(
        ([key, value]) => [
          key,
          normalizeJson(value),
        ],
      ),
    ),
  );
}

function sha256(
  bytes: Uint8Array,
): string {
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function jsonBytes(
  rows: ExportRow[],
): Uint8Array {
  return strToU8(
    `${JSON.stringify(rows, null, 2)}\n`,
  );
}

function csvBytes(
  rows: ExportRow[],
  columns: string[],
): Uint8Array {
  const csvRows = rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => {
        const value = row[column];

        if (value === null) {
          return [column, ""];
        }

        if (
          Array.isArray(value) ||
          typeof value === "object"
        ) {
          return [
            column,
            JSON.stringify(value),
          ];
        }

        return [column, value];
      }),
    ),
  );

  return strToU8(
    stringify(csvRows, {
      bom: true,
      columns,
      header: true,
    }),
  );
}

function exportFilename(
  createdAt: Date,
): string {
  const timestamp = createdAt
    .toISOString()
    .slice(0, 16)
    .replace("T", "_")
    .replace(":", "-");

  return `DriveChronik-Export-${timestamp}Z.zip`;
}

export async function buildFullDataExport(
  createdAt = new Date(),
): Promise<FullDataExportResult> {
  const [
    vehicleRows,
    placeRows,
    driveRows,
    parkSessionRows,
    chargeSessionRows,
    teslaChargingRows,
    routePointRows,
    chargePointRows,
    tagRows,
    driveTagRows,
    chargeSessionTagRows,
    classificationRuleRows,
    vehicleStatusRows,
    vehicleMetricRows,
    softwareUpdateRows,
    journeyRows,
    journeyItemRows,
    auditRows,
    monthSealRows,
    importRunRows,
    importChangeRows,
    settingRows,
  ] = await Promise.all([
    db
      .select()
      .from(vehicles)
      .orderBy(asc(vehicles.id)),
    db
      .select()
      .from(places)
      .orderBy(asc(places.id)),
    db
      .select()
      .from(drives)
      .orderBy(asc(drives.id)),
    db
      .select()
      .from(parkSessions)
      .orderBy(asc(parkSessions.id)),
    db
      .select()
      .from(chargeSessions)
      .orderBy(asc(chargeSessions.id)),
    db
      .select()
      .from(teslaChargingRecords)
      .orderBy(asc(teslaChargingRecords.id)),
    db
      .select()
      .from(routePoints)
      .orderBy(
        asc(routePoints.driveId),
        asc(routePoints.ts),
        asc(routePoints.id),
      ),
    db
      .select()
      .from(chargePoints)
      .orderBy(
        asc(chargePoints.chargeSessionId),
        asc(chargePoints.ts),
        asc(chargePoints.id),
      ),
    db
      .select()
      .from(tags)
      .orderBy(asc(tags.id)),
    db
      .select()
      .from(driveTags)
      .orderBy(
        asc(driveTags.driveId),
        asc(driveTags.tagId),
      ),
    db
      .select()
      .from(chargeSessionTags)
      .orderBy(
        asc(
          chargeSessionTags.chargeSessionId,
        ),
        asc(chargeSessionTags.tagId),
      ),
    db
      .select()
      .from(classificationRules)
      .orderBy(
        asc(classificationRules.priority),
        asc(classificationRules.id),
      ),
    db
      .select()
      .from(vehicleStatus)
      .orderBy(asc(vehicleStatus.vehicleId)),
    db
      .select()
      .from(vehicleMetrics)
      .orderBy(
        asc(vehicleMetrics.vehicleId),
        asc(vehicleMetrics.ts),
        asc(vehicleMetrics.id),
      ),
    db
      .select()
      .from(softwareUpdates)
      .orderBy(
        asc(softwareUpdates.vehicleId),
        asc(softwareUpdates.startTime),
        asc(softwareUpdates.id),
      ),
    db
      .select()
      .from(journeys)
      .orderBy(asc(journeys.id)),
    db
      .select()
      .from(journeyItems)
      .orderBy(
        asc(journeyItems.journeyId),
        asc(journeyItems.id),
      ),
    db
      .select()
      .from(auditLog)
      .orderBy(asc(auditLog.id)),
    db
      .select()
      .from(monthSeals)
      .orderBy(
        asc(monthSeals.vehicleId),
        asc(monthSeals.month),
        asc(monthSeals.revision),
      ),
    db
      .select()
      .from(importRuns)
      .orderBy(asc(importRuns.id)),
    db
      .select()
      .from(importChanges)
      .orderBy(asc(importChanges.id)),
    db
      .select()
      .from(settings)
      .where(
        inArray(
          settings.key,
          [...USER_SETTING_KEYS],
        ),
      )
      .orderBy(asc(settings.key)),
  ]);

  const tables: ExportTable[] = [
    {
      name: "vehicles",
      columns: Object.keys(
        getTableColumns(vehicles),
      ),
      rows: normalizeRows(vehicleRows),
    },
    {
      name: "places",
      columns: Object.keys(
        getTableColumns(places),
      ),
      rows: normalizeRows(placeRows),
    },
    {
      name: "drives",
      columns: Object.keys(
        getTableColumns(drives),
      ),
      rows: normalizeRows(driveRows),
    },
    {
      name: "park_sessions",
      columns: Object.keys(
        getTableColumns(parkSessions),
      ),
      rows: normalizeRows(parkSessionRows),
    },
    {
      name: "charge_sessions",
      columns: Object.keys(
        getTableColumns(chargeSessions),
      ),
      rows: normalizeRows(chargeSessionRows),
    },
    {
      name: "tesla_charging_records",
      columns: Object.keys(
        getTableColumns(teslaChargingRecords),
      ),
      rows: normalizeRows(teslaChargingRows),
    },
    {
      name: "route_points",
      columns: Object.keys(
        getTableColumns(routePoints),
      ),
      rows: normalizeRows(routePointRows),
    },
    {
      name: "charge_points",
      columns: Object.keys(
        getTableColumns(chargePoints),
      ),
      rows: normalizeRows(chargePointRows),
    },
    {
      name: "tags",
      columns: Object.keys(
        getTableColumns(tags),
      ),
      rows: normalizeRows(tagRows),
    },
    {
      name: "drive_tags",
      columns: Object.keys(
        getTableColumns(driveTags),
      ),
      rows: normalizeRows(driveTagRows),
    },
    {
      name: "charge_session_tags",
      columns: Object.keys(
        getTableColumns(chargeSessionTags),
      ),
      rows: normalizeRows(
        chargeSessionTagRows,
      ),
    },
    {
      name: "classification_rules",
      columns: Object.keys(
        getTableColumns(classificationRules),
      ),
      rows: normalizeRows(
        classificationRuleRows,
      ),
    },
    {
      name: "vehicle_status",
      columns: Object.keys(
        getTableColumns(vehicleStatus),
      ),
      rows: normalizeRows(vehicleStatusRows),
    },
    {
      name: "vehicle_metrics",
      columns: Object.keys(
        getTableColumns(vehicleMetrics),
      ),
      rows: normalizeRows(vehicleMetricRows),
    },
    {
      name: "software_updates",
      columns: Object.keys(
        getTableColumns(softwareUpdates),
      ),
      rows: normalizeRows(softwareUpdateRows),
    },
    {
      name: "journeys",
      columns: Object.keys(
        getTableColumns(journeys),
      ),
      rows: normalizeRows(journeyRows),
    },
    {
      name: "journey_items",
      columns: Object.keys(
        getTableColumns(journeyItems),
      ),
      rows: normalizeRows(journeyItemRows),
    },
    {
      name: "audit_log",
      columns: Object.keys(
        getTableColumns(auditLog),
      ),
      rows: normalizeRows(auditRows),
    },
    {
      name: "month_seals",
      columns: Object.keys(
        getTableColumns(monthSeals),
      ),
      rows: normalizeRows(monthSealRows),
    },
    {
      name: "import_runs",
      columns: Object.keys(
        getTableColumns(importRuns),
      ),
      rows: normalizeRows(importRunRows),
    },
    {
      name: "import_changes",
      columns: Object.keys(
        getTableColumns(importChanges),
      ),
      rows: normalizeRows(importChangeRows),
    },
    {
      name: "settings",
      columns: Object.keys(
        getTableColumns(settings),
      ),
      rows: normalizeRows(settingRows),
    },
  ];

  const archiveFiles: Record<
    string,
    Uint8Array
  > = {};

  const tableManifest: Record<
    string,
    ExportTableManifest
  > = {};

  for (const table of tables) {
    const jsonPath =
      `json/${table.name}.json`;
    const csvPath =
      `csv/${table.name}.csv`;

    const json = jsonBytes(table.rows);
    const csv = csvBytes(
      table.rows,
      table.columns,
    );

    archiveFiles[jsonPath] = json;
    archiveFiles[csvPath] = csv;

    tableManifest[table.name] = {
      rows: table.rows.length,
      columns: table.columns,
      json: {
        path: jsonPath,
        sha256: sha256(json),
        bytes: json.byteLength,
      },
      csv: {
        path: csvPath,
        sha256: sha256(csv),
        bytes: csv.byteLength,
      },
    };
  }

  const manifest: FullDataExportManifest = {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    createdAt: createdAt.toISOString(),
    tables: tableManifest,
    excluded: [
      {
        table: "users",
        reason:
          "Authentifizierungsdaten und Passwort-Hashes werden nicht exportiert.",
      },
      {
        table: "sessions",
        reason:
          "Session-IDs und Login-Laufzeitdaten werden nicht exportiert.",
      },
      {
        table: "sync_state",
        reason:
          "Technischer Synchronisationszustand wird nicht exportiert.",
      },
      {
        table: "import_jobs",
        reason:
          "Temporärer Worker-/Staging-Zustand wird nicht exportiert.",
      },
    ],
  };

  archiveFiles["manifest.json"] =
    strToU8(
      `${JSON.stringify(
        manifest,
        null,
        2,
      )}\n`,
    );

  archiveFiles["README.txt"] =
    strToU8(
      [
        "DriveChronik vollständiger Datenexport",
        "",
        `Format-Version: ${EXPORT_FORMAT_VERSION}`,
        `Erstellt: ${createdAt.toISOString()}`,
        "",
        "json/ enthält die vollständigen strukturierten Daten.",
        "csv/ enthält dieselben fachlichen Tabellen in lesbarer Tabellenform.",
        "manifest.json enthält Zeilenzahlen und SHA-256-Prüfsummen.",
        "",
        "Nicht enthalten sind Passwort-Hashes, Sessions, Secrets,",
        "technische Synchronisationszustände und temporäre Import-Jobs.",
        "",
      ].join("\n"),
    );

  const bytes = zipSync(
    archiveFiles,
    {
      level: 6,
    },
  );

  return {
    filename: exportFilename(createdAt),
    bytes,
    manifest,
  };
}
