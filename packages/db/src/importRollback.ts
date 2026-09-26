import { eq } from "drizzle-orm";

import type { Db } from "./client.js";
import type { DbTransaction } from "./audit.js";
import { importChanges, importRuns } from "./schema.js";

export type ImportDb = Db | DbTransaction;

export type ImportSource =
  | "tronity"
  | "tesla_charging"
  | "tessie"
  | "teslafi";

export type ImportRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "rollback_partial"
  | "rolled_back";

export type ImportChangeAction =
  | "insert"
  | "update"
  | "replace_children";

export type ImportEntityType =
  | "charge_session"
  | "tesla_charging_record"
  | "drive"
  | "route_points"
  | "charge_points";

export type ImportJson =
  | null
  | boolean
  | number
  | string
  | ImportJson[]
  | { [key: string]: ImportJson };

export type ImportSnapshot =
  Record<string, ImportJson>;

export interface CreateImportRunInput {
  source: ImportSource;
  vehicleId?: number | null;
  importJobId?: number | null;
  fileName?: string | null;
  createdBy?: string;
}

export interface RecordImportChangeInput {
  importRunId: number;
  entityType: ImportEntityType;
  entityId: number;
  action: ImportChangeAction;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export interface UpdateRollbackPlan {
  restore: ImportSnapshot;
  alreadyRestored: string[];
  conflicts: string[];
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

export function toImportJson(
  value: unknown,
): ImportJson {
  if (value === null) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;

    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(
          "non-finite numbers are not valid import JSON",
        );
      }
      return value;

    case "bigint":
      return value.toString();

    case "undefined":
    case "function":
    case "symbol":
      throw new TypeError(
        "unsupported import JSON value",
      );
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      toImportJson(entry),
    );
  }

  if (!isPlainObject(value)) {
    throw new TypeError(
      "only plain objects are valid import JSON",
    );
  }

  const result: Record<string, ImportJson> = {};

  for (const key of Object.keys(value).sort()) {
    const entry = value[key];

    if (entry === undefined) {
      continue;
    }

    result[key] = toImportJson(entry);
  }

  return result;
}

export function importJsonEqual(
  left: unknown,
  right: unknown,
): boolean {
  return (
    JSON.stringify(toImportJson(left)) ===
    JSON.stringify(toImportJson(right))
  );
}

function asSnapshot(
  value: unknown,
  label: string,
): ImportSnapshot {
  const normalized = toImportJson(value);

  if (
    normalized === null ||
    Array.isArray(normalized) ||
    typeof normalized !== "object"
  ) {
    throw new TypeError(
      `${label} must be an object`,
    );
  }

  return normalized;
}

export function planUpdateRollback(
  beforeValue: unknown,
  afterValue: unknown,
  currentValue: unknown,
): UpdateRollbackPlan {
  const before = asSnapshot(
    beforeValue,
    "before",
  );
  const after = asSnapshot(
    afterValue,
    "after",
  );
  const current = asSnapshot(
    currentValue,
    "current",
  );

  const restore: ImportSnapshot = {};
  const alreadyRestored: string[] = [];
  const conflicts: string[] = [];

  for (const key of Object.keys(after)) {
    if (!(key in before)) {
      throw new Error(
        `before snapshot is missing field "${key}"`,
      );
    }

    // Felder, die der Import selbst nicht verändert hat,
    // gehören nicht zum Rollback.
    if (
      importJsonEqual(
        before[key] ?? null,
        after[key],
      )
    ) {
      continue;
    }

    if (
      importJsonEqual(
        current[key] ?? null,
        after[key],
      )
    ) {
      restore[key] = before[key]!;
      continue;
    }

    if (
      importJsonEqual(
        current[key] ?? null,
        before[key],
      )
    ) {
      alreadyRestored.push(key);
      continue;
    }

    conflicts.push(key);
  }

  return {
    restore,
    alreadyRestored,
    conflicts,
  };
}

export function canRollbackInsert(
  afterValue: unknown,
  currentValue: unknown,
): boolean {
  const after = asSnapshot(
    afterValue,
    "after",
  );
  const current = asSnapshot(
    currentValue,
    "current",
  );

  for (const [key, expected] of Object.entries(after)) {
    if (
      !importJsonEqual(
        current[key] ?? null,
        expected,
      )
    ) {
      return false;
    }
  }

  return true;
}

export async function createImportRun(
  db: ImportDb,
  input: CreateImportRunInput,
): Promise<number> {
  const rows = await db
    .insert(importRuns)
    .values({
      source: input.source,
      status: "running",
      vehicleId: input.vehicleId ?? null,
      importJobId: input.importJobId ?? null,
      fileName: input.fileName ?? null,
      createdBy: input.createdBy ?? "system",
    })
    .returning({
      id: importRuns.id,
    });

  return rows[0]!.id;
}

export async function recordImportChange(
  db: ImportDb,
  input: RecordImportChangeInput,
): Promise<void> {
  await db
    .insert(importChanges)
    .values({
      importRunId: input.importRunId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before:
        input.before === undefined
          ? null
          : toImportJson(input.before),
      after:
        input.after === undefined
          ? null
          : toImportJson(input.after),
      metadata:
        input.metadata === undefined
          ? null
          : toImportJson(input.metadata),
    });
}

export async function completeImportRun(
  db: ImportDb,
  importRunId: number,
  summary: unknown,
): Promise<void> {
  await db
    .update(importRuns)
    .set({
      status: "completed",
      summary: toImportJson(summary),
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importRuns.id, importRunId));
}

export async function failImportRun(
  db: ImportDb,
  importRunId: number,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  await db
    .update(importRuns)
    .set({
      status: "failed",
      summary: toImportJson({
        error: message,
      }),
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importRuns.id, importRunId));
}

export async function finishImportRollback(
  db: ImportDb,
  importRunId: number,
  result: {
    conflicts: number;
    restored: number;
    deleted: number;
    details?: unknown;
  },
): Promise<void> {
  await db
    .update(importRuns)
    .set({
      status:
        result.conflicts === 0
          ? "rolled_back"
          : "rollback_partial",
      rollbackSummary:
        toImportJson(result),
      rolledBackAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importRuns.id, importRunId));
}
