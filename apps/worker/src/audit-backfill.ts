import { asc } from "drizzle-orm";

import {
  auditLog,
  backfillLegacyAuditChain,
  createDb,
  verifyAuditChain,
} from "@drivechronik/db";

import { requireEnv } from "./env.js";

async function main(): Promise<void> {
  const url = requireEnv("DATABASE_URL");
  const db = createDb(url);

  console.log("[drivechronik-audit] starting legacy audit backfill...");

  const backfill = await backfillLegacyAuditChain(db);

  console.log(
    "[drivechronik-audit] backfill:",
    JSON.stringify(backfill),
  );

  const rows = await db
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

  const verification = verifyAuditChain(rows);

  if (!verification.ok) {
    throw new Error(
      "Audit chain verification failed at id " +
        verification.brokenAtId +
        ": " +
        verification.reason,
    );
  }

  console.log(
    "[drivechronik-audit] verification:",
    JSON.stringify(verification),
  );

  console.log("[drivechronik-audit] audit chain is valid.");
  process.exit(0);
}

void main().catch((err) => {
  console.error("[drivechronik-audit] failed:", err);
  process.exit(1);
});
