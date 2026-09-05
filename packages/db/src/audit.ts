import { createHash, randomUUID } from "node:crypto";
import { asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import type { Db } from "./client.js";
import { auditLog } from "./schema.js";

export type DbTransaction =
  Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AuditEventType =
  | "change"
  | "create"
  | "delete"
  | "restore"
  | "seal";

export interface AppendAuditEntryInput {
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  eventType?: AuditEventType;
  metadata?: unknown;
}

export interface AuditHashResult {
  eventId: string;
  entryHash: string;
  previousHash: string | null;
}
export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new TypeError("undefined is not valid audit JSON");
  }

  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("unsupported audit JSON value");
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("non-finite numbers are not valid audit JSON");
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("only plain objects are valid audit JSON");
  }

  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();

  return (
    "{" +
    keys
      .map((key) => JSON.stringify(key) + ":" + canonicalJson(object[key]))
      .join(",") +
    "}"
  );
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
export async function appendAuditEntries(
  tx: DbTransaction,
  inputs: AppendAuditEntryInput[],
): Promise<AuditHashResult[]> {
  if (inputs.length === 0) return [];

  await tx.execute(sql`select pg_advisory_xact_lock(441726381)`);

  const previous = await tx
    .select({ entryHash: auditLog.entryHash })
    .from(auditLog)
    .where(isNotNull(auditLog.entryHash))
    .orderBy(desc(auditLog.id))
    .limit(1);

  let previousHash = previous[0]?.entryHash ?? null;
  const rows: Array<typeof auditLog.$inferInsert> = [];
  const results: AuditHashResult[] = [];
  const eventId = randomUUID();
  const changedAt = new Date();

  for (const input of inputs) {
    const eventType = input.eventType ?? "change";
    const metadata = input.metadata ?? null;

    const payload = {
      version: 1,
      eventId,
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
      oldValue: input.oldValue,
      newValue: input.newValue,
      changedAt: changedAt.toISOString(),
      changedBy: input.changedBy,
      eventType,
      previousHash,
      metadata,
    };

    const entryHash = sha256(canonicalJson(payload));

    rows.push({
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
      oldValue: input.oldValue,
      newValue: input.newValue,
      changedAt,
      changedBy: input.changedBy,
      eventId,
      eventType,
      previousHash,
      entryHash,
      metadata,
    });

    results.push({ eventId, entryHash, previousHash });
    previousHash = entryHash;
  }

  await tx.insert(auditLog).values(rows);
  return results;
}

export async function appendAuditEntry(
  tx: DbTransaction,
  input: AppendAuditEntryInput,
): Promise<AuditHashResult> {
  const results = await appendAuditEntries(tx, [input]);
  return results[0]!;
}

export interface AuditChainRow {
  id: number;
  eventId: string | null;
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
  changedBy: string;
  eventType: string;
  previousHash: string | null;
  entryHash: string | null;
  metadata: unknown;
}

export interface AuditChainVerification {
  ok: boolean;
  checked: number;
  brokenAtId: number | null;
  reason: string | null;
  lastHash: string | null;
}

export function verifyAuditChain(
  rows: AuditChainRow[],
): AuditChainVerification {
  let expectedPreviousHash: string | null = null;
  let checked = 0;

  for (const row of rows) {
    if (!row.eventId || !row.entryHash) {
      return {
        ok: false,
        checked,
        brokenAtId: row.id,
        reason: "missing_hash_data",
        lastHash: expectedPreviousHash,
      };
    }

    if (row.previousHash !== expectedPreviousHash) {
      return {
        ok: false,
        checked,
        brokenAtId: row.id,
        reason: "previous_hash_mismatch",
        lastHash: expectedPreviousHash,
      };
    }

    const payload = {
      version: 1,
      eventId: row.eventId,
      entityType: row.entityType,
      entityId: row.entityId,
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      changedAt: row.changedAt.toISOString(),
      changedBy: row.changedBy,
      eventType: row.eventType,
      previousHash: row.previousHash,
      metadata: row.metadata ?? null,
    };

    const calculatedHash = sha256(canonicalJson(payload));

    if (calculatedHash !== row.entryHash) {
      return {
        ok: false,
        checked,
        brokenAtId: row.id,
        reason: "entry_hash_mismatch",
        lastHash: expectedPreviousHash,
      };
    }

    expectedPreviousHash = row.entryHash;
    checked += 1;
  }

  return {
    ok: true,
    checked,
    brokenAtId: null,
    reason: null,
    lastHash: expectedPreviousHash,
  };
}

export interface AuditBackfillResult {
  updated: number;
  firstId: number | null;
  lastId: number | null;
  lastHash: string | null;
}

export async function backfillLegacyAuditChain(
  db: Db,
): Promise<AuditBackfillResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(441726381)`);

    const rows = await tx
      .select({
        id: auditLog.id,
        eventId: auditLog.eventId,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        field: auditLog.field,
        oldValue: auditLog.oldValue,
        newValue: auditLog.newValue,
        changedAt: auditLog.changedAt,
        changedBy: auditLog.changedBy,
        eventType: auditLog.eventType,
        previousHash: auditLog.previousHash,
        entryHash: auditLog.entryHash,
        metadata: auditLog.metadata,
      })
      .from(auditLog)
      .orderBy(asc(auditLog.id));

    if (rows.length === 0) {
      return {
        updated: 0,
        firstId: null,
        lastId: null,
        lastHash: null,
      };
    }

    const hashedRows = rows.filter(
      (row) => row.eventId !== null || row.entryHash !== null,
    );

    if (hashedRows.length === rows.length) {
      const verification = verifyAuditChain(rows);

      if (!verification.ok) {
        throw new Error(
          "Existing audit chain is invalid at id " +
            verification.brokenAtId +
            ": " +
            verification.reason,
        );
      }

      return {
        updated: 0,
        firstId: rows[0]!.id,
        lastId: rows[rows.length - 1]!.id,
        lastHash: verification.lastHash,
      };
    }

    if (hashedRows.length !== 0) {
      throw new Error(
        "Refusing audit backfill because hashed and unhashed rows are mixed",
      );
    }

    let previousHash: string | null = null;

    for (const row of rows) {
      const eventId = "legacy-" + row.id;

      const payload = {
        version: 1,
        eventId,
        entityType: row.entityType,
        entityId: row.entityId,
        field: row.field,
        oldValue: row.oldValue,
        newValue: row.newValue,
        changedAt: row.changedAt.toISOString(),
        changedBy: row.changedBy,
        eventType: row.eventType,
        previousHash,
        metadata: row.metadata ?? null,
      };

      const entryHash = sha256(canonicalJson(payload));

      await tx
        .update(auditLog)
        .set({
          eventId,
          previousHash,
          entryHash,
        })
        .where(eq(auditLog.id, row.id));

      previousHash = entryHash;
    }

    return {
      updated: rows.length,
      firstId: rows[0]!.id,
      lastId: rows[rows.length - 1]!.id,
      lastHash: previousHash,
    };
  });
}
