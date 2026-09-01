export type BackupHealth =
  | "fresh"
  | "stale"
  | "missing"
  | "invalid"
  | "notConfigured";

export interface BackupMetadata {
  version: 1;
  status: "ok";
  createdAt: string;
  filename: string;
  sizeBytes: number;
  checksumPresent: boolean;
}

export interface BackupStatusSummary {
  health: BackupHealth;
  metadata: BackupMetadata | null;
  error: string | null;
}

export const BACKUP_STALE_AFTER_MS = 36 * 60 * 60 * 1000;

function isBackupMetadata(value: unknown): value is BackupMetadata {
  if (typeof value !== "object" || value === null) return false;

  const row = value as Record<string, unknown>;

  if (row.version !== 1) return false;
  if (row.status !== "ok") return false;

  if (
    typeof row.createdAt !== "string" ||
    !Number.isFinite(Date.parse(row.createdAt))
  ) {
    return false;
  }

  if (
    typeof row.filename !== "string" ||
    !row.filename.startsWith("drivechronik-") ||
    !row.filename.endsWith(".dump")
  ) {
    return false;
  }

  if (
    typeof row.sizeBytes !== "number" ||
    !Number.isInteger(row.sizeBytes) ||
    row.sizeBytes <= 0
  ) {
    return false;
  }

  if (typeof row.checksumPresent !== "boolean") return false;

  return true;
}

export function classifyBackupMetadata(
  metadata: BackupMetadata,
  nowMs = Date.now(),
): BackupHealth {
  const createdMs = Date.parse(metadata.createdAt);

  if (!Number.isFinite(createdMs)) return "invalid";

  const ageMs = Math.max(0, nowMs - createdMs);

  return ageMs >= BACKUP_STALE_AFTER_MS ? "stale" : "fresh";
}

export function parseBackupStatus(
  text: string,
  nowMs = Date.now(),
): BackupStatusSummary {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      health: "invalid",
      metadata: null,
      error: "Backup-Status ist kein gültiges JSON.",
    };
  }

  if (!isBackupMetadata(parsed)) {
    return {
      health: "invalid",
      metadata: null,
      error: "Backup-Status enthält ungültige oder unvollständige Daten.",
    };
  }

  return {
    health: classifyBackupMetadata(parsed, nowMs),
    metadata: parsed,
    error: null,
  };
}
