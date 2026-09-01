import "server-only";

import { readFile } from "node:fs/promises";

import {
  parseBackupStatus,
  type BackupStatusSummary,
} from "./backupStatusLogic";

export async function getBackupStatus(): Promise<BackupStatusSummary> {
  const filename = process.env.BACKUP_STATUS_FILE?.trim();

  if (!filename) {
    return {
      health: "notConfigured",
      metadata: null,
      error: null,
    };
  }

  let text: string;

  try {
    text = await readFile(filename, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        health: "missing",
        metadata: null,
        error: null,
      };
    }

    return {
      health: "invalid",
      metadata: null,
      error: "Backup-Statusdatei konnte nicht gelesen werden.",
    };
  }

  return parseBackupStatus(text);
}
