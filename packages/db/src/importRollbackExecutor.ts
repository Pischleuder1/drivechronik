import {
  and,
  desc,
  eq,
  sql,
} from "drizzle-orm";

import { appendAuditEntry } from "./audit.js";
import type { Db } from "./client.js";

import {
  chargePoints,
  chargeSessionTags,
  chargeSessions,
  driveTags,
  drives,
  importChanges,
  importRuns,
  journeyItems,
  teslaChargingRecords,
} from "./schema.js";

import {
  canRollbackInsert,
  finishImportRollback,
  importJsonEqual,
  planUpdateRollback,
  toImportJson,
  type ImportDb,
  type ImportSnapshot,
} from "./importRollback.js";

type StoredImportChange =
  typeof importChanges.$inferSelect;

type ChargeSessionPatch =
  Partial<typeof chargeSessions.$inferInsert>;

type TeslaChargingRecordPatch =
  Partial<typeof teslaChargingRecords.$inferInsert>;

export type RollbackOutcome =
  | "delete"
  | "restore"
  | "already_deleted"
  | "already_restored"
  | "conflict";

export interface ImportRollbackDetail {
  changeId: number;
  entityType: string;
  entityId: number;
  action: string;
  outcome: RollbackOutcome;
  conflicts: string[];
  restoreFields: string[];
  alreadyRestoredFields: string[];
  restore?: ImportSnapshot;
}

export interface ImportRollbackPreview {
  importRunId: number;
  source: string;
  status: string;
  totalChanges: number;
  deletable: number;
  restorable: number;
  alreadyRolledBack: number;
  conflicts: number;
  details: ImportRollbackDetail[];
}

export interface ImportRollbackResult
  extends ImportRollbackPreview {
  deleted: number;
  restored: number;
}

const chargeSessionSelection = {
  vehicleId: chargeSessions.vehicleId,
  startTime: chargeSessions.startTime,
  endTime: chargeSessions.endTime,
  lat: chargeSessions.lat,
  lon: chargeSessions.lon,
  placeId: chargeSessions.placeId,
  placeLocked: chargeSessions.placeLocked,
  address: chargeSessions.address,
  startSoc: chargeSessions.startSoc,
  endSoc: chargeSessions.endSoc,
  energyAddedKwh:
    chargeSessions.energyAddedKwh,
  energyUsedKwh:
    chargeSessions.energyUsedKwh,
  maxPowerKw: chargeSessions.maxPowerKw,
  avgPowerKw: chargeSessions.avgPowerKw,
  chargerType: chargeSessions.chargerType,
  outsideTempAvg:
    chargeSessions.outsideTempAvg,
  durationSeconds:
    chargeSessions.durationSeconds,
  cost: chargeSessions.cost,
  currency: chargeSessions.currency,
  costSource: chargeSessions.costSource,
  notes: chargeSessions.notes,
  source: chargeSessions.source,
  sourceId: chargeSessions.sourceId,
};

const driveSelection = {
  vehicleId: drives.vehicleId,
  startTime: drives.startTime,
  endTime: drives.endTime,
  startOdometerKm: drives.startOdometerKm,
  endOdometerKm: drives.endOdometerKm,
  distanceKm: drives.distanceKm,
  durationSeconds: drives.durationSeconds,
  startLat: drives.startLat,
  startLon: drives.startLon,
  endLat: drives.endLat,
  endLon: drives.endLon,
  startPlaceId: drives.startPlaceId,
  endPlaceId: drives.endPlaceId,
  startPlaceLocked: drives.startPlaceLocked,
  endPlaceLocked: drives.endPlaceLocked,
  startAddress: drives.startAddress,
  endAddress: drives.endAddress,
  startSoc: drives.startSoc,
  endSoc: drives.endSoc,
  consumedEnergyKwh: drives.consumedEnergyKwh,
  energyIsEstimated: drives.energyIsEstimated,
  avgConsumptionWhKm: drives.avgConsumptionWhKm,
  ascentM: drives.ascentM,
  descentM: drives.descentM,
  outsideTempAvg: drives.outsideTempAvg,
  insideTempAvg: drives.insideTempAvg,
  speedMaxKmh: drives.speedMaxKmh,
  powerMaxKw: drives.powerMaxKw,
  powerMinKw: drives.powerMinKw,
  weatherTempC: drives.weatherTempC,
  weatherPrecipitationMm:
    drives.weatherPrecipitationMm,
  weatherWindKmh: drives.weatherWindKmh,
  weatherCode: drives.weatherCode,
  weatherSyncedAt: drives.weatherSyncedAt,
  classification: drives.classification,
  classifiedByRuleId: drives.classifiedByRuleId,
  purpose: drives.purpose,
  customer: drives.customer,
  project: drives.project,
  notes: drives.notes,
  source: drives.source,
  sourceId: drives.sourceId,
  syncedAt: drives.syncedAt,
};

const teslaChargingRecordSelection = {
  chargeSessionId:
    teslaChargingRecords.chargeSessionId,
  chargeStartTime:
    teslaChargingRecords.chargeStartTime,
  name: teslaChargingRecords.name,
  vin: teslaChargingRecords.vin,
  model: teslaChargingRecords.model,
  country: teslaChargingRecords.country,
  siteLocationName:
    teslaChargingRecords.siteLocationName,
  description:
    teslaChargingRecords.description,
  quantityBaseRaw:
    teslaChargingRecords.quantityBaseRaw,
  energyKwh:
    teslaChargingRecords.energyKwh,
  unitCostBaseRaw:
    teslaChargingRecords.unitCostBaseRaw,
  vatRaw:
    teslaChargingRecords.vatRaw,
  totalExVat:
    teslaChargingRecords.totalExVat,
  totalIncVat:
    teslaChargingRecords.totalIncVat,
  currency:
    teslaChargingRecords.currency,
  invoiceNumber:
    teslaChargingRecords.invoiceNumber,
  status:
    teslaChargingRecords.status,
  invoiceUrl:
    teslaChargingRecords.invoiceUrl,
  sourceHash:
    teslaChargingRecords.sourceHash,
  rawData:
    teslaChargingRecords.rawData,
};

function jsonDate(
  value: unknown,
  field: string,
  nullable: boolean,
): Date | null {
  if (value === null) {
    if (nullable) return null;

    throw new Error(
      `${field} darf nicht null sein`,
    );
  }

  if (typeof value !== "string") {
    throw new Error(
      `${field} enthält kein gültiges Datum`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${field} enthält kein gültiges Datum`,
    );
  }

  return date;
}

function chargeSessionRestorePatch(
  snapshot: ImportSnapshot,
): ChargeSessionPatch {
  const result: Record<string, unknown> = {};

  const allowed = new Set([
    "vehicleId",
    "startTime",
    "endTime",
    "lat",
    "lon",
    "placeId",
    "placeLocked",
    "address",
    "startSoc",
    "endSoc",
    "energyAddedKwh",
    "energyUsedKwh",
    "maxPowerKw",
    "avgPowerKw",
    "chargerType",
    "outsideTempAvg",
    "durationSeconds",
    "cost",
    "currency",
    "costSource",
    "notes",
    "source",
    "sourceId",
  ]);

  for (const [key, value] of Object.entries(
    snapshot,
  )) {
    if (!allowed.has(key)) {
      throw new Error(
        `Nicht unterstütztes charge_session-Feld: ${key}`,
      );
    }

    if (key === "startTime") {
      result[key] = jsonDate(
        value,
        key,
        false,
      );
      continue;
    }

    if (key === "endTime") {
      result[key] = jsonDate(
        value,
        key,
        true,
      );
      continue;
    }

    result[key] = value;
  }

  return result as ChargeSessionPatch;
}

function teslaChargingRecordRestorePatch(
  snapshot: ImportSnapshot,
): TeslaChargingRecordPatch {
  const result: Record<string, unknown> = {};

  const allowed = new Set([
    "chargeSessionId",
    "chargeStartTime",
    "name",
    "vin",
    "model",
    "country",
    "siteLocationName",
    "description",
    "quantityBaseRaw",
    "energyKwh",
    "unitCostBaseRaw",
    "vatRaw",
    "totalExVat",
    "totalIncVat",
    "currency",
    "invoiceNumber",
    "status",
    "invoiceUrl",
    "sourceHash",
    "rawData",
  ]);

  for (const [key, value] of Object.entries(
    snapshot,
  )) {
    if (!allowed.has(key)) {
      throw new Error(
        `Nicht unterstütztes tesla_charging_record-Feld: ${key}`,
      );
    }

    if (key === "chargeStartTime") {
      result[key] = jsonDate(
        value,
        key,
        false,
      );
      continue;
    }

    result[key] = value;
  }

  return result as TeslaChargingRecordPatch;
}

async function driveBlockers(
  db: ImportDb,
  driveId: number,
): Promise<string[]> {
  const blockers: string[] = [];

  const tags = await db
    .select({
      tagId: driveTags.tagId,
    })
    .from(driveTags)
    .where(
      eq(
        driveTags.driveId,
        driveId,
      ),
    )
    .limit(1);

  if (tags.length > 0) {
    blockers.push("tag_links");
  }

  const journeys = await db
    .select({
      id: journeyItems.id,
    })
    .from(journeyItems)
    .where(
      and(
        eq(
          journeyItems.itemType,
          "drive",
        ),
        eq(
          journeyItems.itemId,
          driveId,
        ),
      ),
    )
    .limit(1);

  if (journeys.length > 0) {
    blockers.push("journey_links");
  }

  return blockers;
}

async function chargeSessionBlockers(
  db: ImportDb,
  chargeSessionId: number,
): Promise<string[]> {
  const blockers: string[] = [];

  const points = await db
    .select({
      id: chargePoints.id,
    })
    .from(chargePoints)
    .where(
      eq(
        chargePoints.chargeSessionId,
        chargeSessionId,
      ),
    )
    .limit(1);

  if (points.length > 0) {
    blockers.push("charge_points");
  }

  const tags = await db
    .select({
      tagId: chargeSessionTags.tagId,
    })
    .from(chargeSessionTags)
    .where(
      eq(
        chargeSessionTags.chargeSessionId,
        chargeSessionId,
      ),
    )
    .limit(1);

  if (tags.length > 0) {
    blockers.push("tag_links");
  }

  const teslaRecords = await db
    .select({
      id: teslaChargingRecords.id,
    })
    .from(teslaChargingRecords)
    .where(
      eq(
        teslaChargingRecords.chargeSessionId,
        chargeSessionId,
      ),
    )
    .limit(1);

  if (teslaRecords.length > 0) {
    blockers.push("tesla_records");
  }

  return blockers;
}

async function evaluateChargeSessionChange(
  db: ImportDb,
  change: StoredImportChange,
  lockRow = false,
): Promise<ImportRollbackDetail> {
  const base = {
    changeId: change.id,
    entityType: change.entityType,
    entityId: change.entityId,
    action: change.action,
    restoreFields: [] as string[],
    alreadyRestoredFields:
      [] as string[],
  };

  if (
    change.entityType !==
    "charge_session"
  ) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "unsupported_entity",
      ],
    };
  }

  if (
    change.action !== "insert" &&
    change.action !== "update"
  ) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "unsupported_action",
      ],
    };
  }

  if (lockRow) {
    await db.execute(sql`
      select id
      from charge_sessions
      where id = ${change.entityId}
      for update
    `);
  }

  const rows = await db
    .select(chargeSessionSelection)
    .from(chargeSessions)
    .where(
      eq(
        chargeSessions.id,
        change.entityId,
      ),
    )
    .limit(1);

  const current = rows[0];

  if (!current) {
    if (change.action === "insert") {
      return {
        ...base,
        outcome: "already_deleted",
        conflicts: [],
      };
    }

    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "row_missing",
      ],
    };
  }

  if (change.action === "insert") {
    if (change.after == null) {
      return {
        ...base,
        outcome: "conflict",
        conflicts: [
          "invalid_after_snapshot",
        ],
      };
    }

    const blockers =
      await chargeSessionBlockers(
        db,
        change.entityId,
      );

    if (blockers.length > 0) {
      return {
        ...base,
        outcome: "conflict",
        conflicts: blockers,
      };
    }

    let unchanged = false;

    try {
      unchanged =
        canRollbackInsert(
          change.after,
          current,
        );
    } catch {
      return {
        ...base,
        outcome: "conflict",
        conflicts: [
          "invalid_after_snapshot",
        ],
      };
    }

    if (!unchanged) {
      return {
        ...base,
        outcome: "conflict",
        conflicts: [
          "row_changed",
        ],
      };
    }

    return {
      ...base,
      outcome: "delete",
      conflicts: [],
    };
  }

  if (
    change.before == null ||
    change.after == null
  ) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "invalid_update_snapshot",
      ],
    };
  }

  try {
    const plan =
      planUpdateRollback(
        change.before,
        change.after,
        current,
      );

    const restoreFields =
      Object.keys(plan.restore);

    if (restoreFields.length > 0) {
      return {
        ...base,
        outcome: "restore",
        conflicts:
          plan.conflicts.map(
            (field) =>
              `field_changed:${field}`,
          ),
        restoreFields,
        alreadyRestoredFields:
          plan.alreadyRestored,
        restore: plan.restore,
      };
    }

    if (plan.conflicts.length > 0) {
      return {
        ...base,
        outcome: "conflict",
        conflicts:
          plan.conflicts.map(
            (field) =>
              `field_changed:${field}`,
          ),
        alreadyRestoredFields:
          plan.alreadyRestored,
      };
    }

    return {
      ...base,
      outcome: "already_restored",
      conflicts: [],
      alreadyRestoredFields:
        plan.alreadyRestored,
    };
  } catch {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "invalid_update_snapshot",
      ],
    };
  }
}

async function evaluateDriveChange(
  db: ImportDb,
  change: StoredImportChange,
  lockRow = false,
): Promise<ImportRollbackDetail> {
  const base = {
    changeId: change.id,
    entityType: change.entityType,
    entityId: change.entityId,
    action: change.action,
    restoreFields: [] as string[],
    alreadyRestoredFields: [] as string[],
  };

  if (change.action !== "insert") {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "unsupported_action",
      ],
    };
  }

  if (lockRow) {
    await db.execute(sql`
      select id
      from drives
      where id = ${change.entityId}
      for update
    `);
  }

  const rows = await db
    .select(driveSelection)
    .from(drives)
    .where(
      eq(
        drives.id,
        change.entityId,
      ),
    )
    .limit(1);

  const current = rows[0];

  if (!current) {
    return {
      ...base,
      outcome: "already_deleted",
      conflicts: [],
    };
  }

  if (change.after == null) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "invalid_after_snapshot",
      ],
    };
  }

  const blockers =
    await driveBlockers(
      db,
      change.entityId,
    );

  if (blockers.length > 0) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: blockers,
    };
  }

  try {
    if (
      !canRollbackInsert(
        change.after,
        current,
      )
    ) {
      return {
        ...base,
        outcome: "conflict",
        conflicts: [
          "row_changed",
        ],
      };
    }
  } catch {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "invalid_after_snapshot",
      ],
    };
  }

  return {
    ...base,
    outcome: "delete",
    conflicts: [],
  };
}

async function evaluateTeslaChargingRecordChange(
  db: ImportDb,
  change: StoredImportChange,
  lockRow = false,
): Promise<ImportRollbackDetail> {
  const base = {
    changeId: change.id,
    entityType: change.entityType,
    entityId: change.entityId,
    action: change.action,
    restoreFields: [] as string[],
    alreadyRestoredFields: [] as string[],
  };

  if (
    change.action !== "insert" &&
    change.action !== "update"
  ) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: ["unsupported_action"],
    };
  }

  if (lockRow) {
    await db.execute(sql`
      select id
      from tesla_charging_records
      where id = ${change.entityId}
      for update
    `);
  }

  const rows = await db
    .select(teslaChargingRecordSelection)
    .from(teslaChargingRecords)
    .where(
      eq(
        teslaChargingRecords.id,
        change.entityId,
      ),
    )
    .limit(1);

  const current = rows[0];

  if (!current) {
    if (change.action === "insert") {
      return {
        ...base,
        outcome: "already_deleted",
        conflicts: [],
      };
    }

    return {
      ...base,
      outcome: "conflict",
      conflicts: ["row_missing"],
    };
  }

  if (change.action === "insert") {
    if (change.after == null) {
      return {
        ...base,
        outcome: "conflict",
        conflicts: [
          "invalid_after_snapshot",
        ],
      };
    }

    try {
      if (
        !canRollbackInsert(
          change.after,
          current,
        )
      ) {
        return {
          ...base,
          outcome: "conflict",
          conflicts: ["row_changed"],
        };
      }
    } catch {
      return {
        ...base,
        outcome: "conflict",
        conflicts: [
          "invalid_after_snapshot",
        ],
      };
    }

    return {
      ...base,
      outcome: "delete",
      conflicts: [],
    };
  }

  if (
    change.before == null ||
    change.after == null
  ) {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "invalid_update_snapshot",
      ],
    };
  }

  try {
    const plan = planUpdateRollback(
      change.before,
      change.after,
      current,
    );

    const restoreFields =
      Object.keys(plan.restore);

    if (restoreFields.length > 0) {
      return {
        ...base,
        outcome: "restore",
        conflicts:
          plan.conflicts.map(
            (field) =>
              `field_changed:${field}`,
          ),
        restoreFields,
        alreadyRestoredFields:
          plan.alreadyRestored,
        restore: plan.restore,
      };
    }

    if (plan.conflicts.length > 0) {
      return {
        ...base,
        outcome: "conflict",
        conflicts:
          plan.conflicts.map(
            (field) =>
              `field_changed:${field}`,
          ),
        alreadyRestoredFields:
          plan.alreadyRestored,
      };
    }

    return {
      ...base,
      outcome: "already_restored",
      conflicts: [],
      alreadyRestoredFields:
        plan.alreadyRestored,
    };
  } catch {
    return {
      ...base,
      outcome: "conflict",
      conflicts: [
        "invalid_update_snapshot",
      ],
    };
  }
}

async function evaluateChange(
  db: ImportDb,
  change: StoredImportChange,
  lockRow = false,
): Promise<ImportRollbackDetail> {
  if (
    change.entityType === "drive"
  ) {
    return evaluateDriveChange(
      db,
      change,
      lockRow,
    );
  }

  if (
    change.entityType ===
    "tesla_charging_record"
  ) {
    return evaluateTeslaChargingRecordChange(
      db,
      change,
      lockRow,
    );
  }

  return evaluateChargeSessionChange(
    db,
    change,
    lockRow,
  );
}

async function buildPreview(
  db: ImportDb,
  importRunId: number,
  lockRows = false,
): Promise<ImportRollbackPreview> {
  const runs = await db
    .select({
      id: importRuns.id,
      source: importRuns.source,
      status: importRuns.status,
    })
    .from(importRuns)
    .where(
      eq(importRuns.id, importRunId),
    )
    .limit(1);

  const run = runs[0];

  if (!run) {
    throw new ImportRollbackError(
      "not_found",
      `Import-Lauf ${importRunId} wurde nicht gefunden.`,
    );
  }

  if (run.status === "running") {
    throw new ImportRollbackError(
      "running",
      "Ein laufender Import kann nicht zurückgesetzt werden.",
    );
  }

  if (run.status === "rolled_back") {
    throw new ImportRollbackError(
      "already_rolled_back",
      "Dieser Import wurde bereits vollständig zurückgesetzt.",
    );
  }

  const changes = await db
    .select()
    .from(importChanges)
    .where(
      eq(
        importChanges.importRunId,
        importRunId,
      ),
    )
    .orderBy(
      desc(importChanges.id),
    );

  const details: ImportRollbackDetail[] =
    [];

  for (const change of changes) {
    details.push(
      await evaluateChange(
        db,
        change,
        lockRows,
      ),
    );
  }

  return {
    importRunId,
    source: run.source,
    status: run.status,
    totalChanges: details.length,
    deletable:
      details.filter(
        (item) =>
          item.outcome === "delete",
      ).length,
    restorable:
      details.filter(
        (item) =>
          item.outcome === "restore",
      ).length,
    alreadyRolledBack:
      details.filter(
        (item) =>
          item.outcome ===
            "already_deleted" ||
          item.outcome ===
            "already_restored",
      ).length,
    conflicts:
      details.filter(
        (item) =>
          item.conflicts.length > 0,
      ).length,
    details,
  };
}

export type ImportRollbackErrorCode =
  | "not_found"
  | "running"
  | "already_rolled_back";

export class ImportRollbackError extends Error {
  constructor(
    public readonly code: ImportRollbackErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportRollbackError";
  }
}

export async function previewImportRollback(
  db: ImportDb,
  importRunId: number,
): Promise<ImportRollbackPreview> {
  return buildPreview(
    db,
    importRunId,
  );
}

export interface RollbackImportRunOptions {
  changedBy: string;
}

export async function rollbackImportRun(
  db: Db,
  importRunId: number,
  options: RollbackImportRunOptions,
): Promise<ImportRollbackResult> {
  return db.transaction(
    async (tx) => {
      /*
       * Nur ein Rollback darf denselben Import-Lauf
       * gleichzeitig bearbeiten.
       */
      await tx.execute(sql`
        select id
        from import_runs
        where id = ${importRunId}
        for update
      `);

      /*
       * Beim echten Rollback werden zusätzlich die
       * betroffenen Import-Datensätze gesperrt.
       * Dadurch kann sich ihr gespeicherter Zustand
       * zwischen Sicherheitsprüfung und Mutation
       * nicht verändern.
       */
      const preview =
        await buildPreview(
          tx,
          importRunId,
          true,
        );

      let deleted = 0;
      let restored = 0;

      for (const detail of preview.details) {
        if (detail.outcome === "delete") {
          if (
            detail.entityType === "drive"
          ) {
            const rows = await tx
              .delete(drives)
              .where(
                eq(
                  drives.id,
                  detail.entityId,
                ),
              )
              .returning({
                id: drives.id,
              });

            if (rows.length > 0) {
              deleted++;
            }

            continue;
          }

          if (
            detail.entityType ===
            "charge_session"
          ) {
            const rows = await tx
              .delete(chargeSessions)
              .where(
                eq(
                  chargeSessions.id,
                  detail.entityId,
                ),
              )
              .returning({
                id: chargeSessions.id,
              });

            if (rows.length > 0) {
              deleted++;
            }

            continue;
          }

          if (
            detail.entityType ===
            "tesla_charging_record"
          ) {
            const rows = await tx
              .delete(
                teslaChargingRecords,
              )
              .where(
                eq(
                  teslaChargingRecords.id,
                  detail.entityId,
                ),
              )
              .returning({
                id:
                  teslaChargingRecords.id,
              });

            if (rows.length > 0) {
              deleted++;
            }

            continue;
          }

          throw new Error(
            `Nicht unterstützter Rollback-Typ: ${detail.entityType}`,
          );
        }

        if (
          detail.outcome === "restore" &&
          detail.restore
        ) {
          if (
            detail.entityType ===
            "charge_session"
          ) {
            const patch =
              chargeSessionRestorePatch(
                detail.restore,
              );

            await tx
              .update(chargeSessions)
              .set({
                ...patch,
                updatedAt: new Date(),
              })
              .where(
                eq(
                  chargeSessions.id,
                  detail.entityId,
                ),
              );

            restored++;
            continue;
          }

          if (
            detail.entityType ===
            "tesla_charging_record"
          ) {
            const patch =
              teslaChargingRecordRestorePatch(
                detail.restore,
              );

            await tx
              .update(
                teslaChargingRecords,
              )
              .set({
                ...patch,
                updatedAt: new Date(),
              })
              .where(
                eq(
                  teslaChargingRecords.id,
                  detail.entityId,
                ),
              );

            restored++;
            continue;
          }

          throw new Error(
            `Nicht unterstützter Rollback-Typ: ${detail.entityType}`,
          );
        }
      }

      const result: ImportRollbackResult = {
        ...preview,
        deleted,
        restored,
      };

      await finishImportRollback(
        tx,
        importRunId,
        {
          conflicts:
            result.conflicts,
          restored,
          deleted,
          details:
            result.details.map(
              (item) => ({
                changeId:
                  item.changeId,
                entityType:
                  item.entityType,
                entityId:
                  item.entityId,
                action:
                  item.action,
                outcome:
                  item.outcome,
                conflicts:
                  item.conflicts,
                restoreFields:
                  item.restoreFields,
                alreadyRestoredFields:
                  item.alreadyRestoredFields,
              }),
            ),
        },
      );

      const finalStatus =
        result.conflicts === 0
          ? "rolled_back"
          : "rollback_partial";

      /*
       * Der Audit-Eintrag liegt in derselben DB-
       * Transaktion wie der eigentliche Rollback.
       * Schlägt das Audit fehl, wird damit auch
       * der Rollback selbst zurückgenommen.
       */
      await appendAuditEntry(
        tx,
        {
          entityType: "import_run",
          entityId: importRunId,
          field: "rollback",
          oldValue: preview.status,
          newValue: finalStatus,
          changedBy:
            options.changedBy,
          eventType: "restore",
          metadata: {
            source:
              preview.source,
            totalChanges:
              result.totalChanges,
            deleted,
            restored,
            conflicts:
              result.conflicts,
          },
        },
      );

      return result;
    },
  );
}

/*
 * Kleine Export-Hilfe für Tests:
 * Zwei Snapshot-Werte gelten als bereits zurückgesetzt,
 * wenn der aktuelle Wert wieder dem alten Wert entspricht.
 */
export function isAlreadyRestored(
  before: unknown,
  current: unknown,
): boolean {
  return importJsonEqual(
    toImportJson(before),
    toImportJson(current),
  );
}
