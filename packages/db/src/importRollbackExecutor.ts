import {
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
  importChanges,
  importRuns,
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

async function evaluateChange(
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
    throw new Error(
      `Import-Lauf ${importRunId} wurde nicht gefunden.`,
    );
  }

  if (run.status === "running") {
    throw new Error(
      "Ein laufender Import kann nicht zurückgesetzt werden.",
    );
  }

  if (run.status === "rolled_back") {
    throw new Error(
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
       * betroffenen charge_sessions gesperrt.
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
        if (
          detail.outcome === "delete"
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
          detail.outcome === "restore" &&
          detail.restore
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
