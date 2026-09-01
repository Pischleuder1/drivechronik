import { describe, expect, it } from "vitest";

import {
  BACKUP_STALE_AFTER_MS,
  classifyBackupMetadata,
  parseBackupStatus,
  type BackupMetadata,
} from "./backupStatusLogic";

const NOW = Date.parse("2026-09-01T14:00:00Z");

function metadata(
  overrides: Partial<BackupMetadata> = {},
): BackupMetadata {
  return {
    version: 1,
    status: "ok",
    createdAt: "2026-09-01T13:00:00Z",
    filename: "drivechronik-20260901T130000Z.dump",
    sizeBytes: 12_345,
    checksumPresent: true,
    ...overrides,
  };
}

describe("backup status logic", () => {
  it("classifies a recent backup as fresh", () => {
    expect(classifyBackupMetadata(metadata(), NOW)).toBe("fresh");
  });

  it("classifies a backup as stale after 36 hours", () => {
    const createdAt = new Date(
      NOW - BACKUP_STALE_AFTER_MS,
    ).toISOString();

    expect(
      classifyBackupMetadata(metadata({ createdAt }), NOW),
    ).toBe("stale");
  });

  it("parses a valid backup status", () => {
    const result = parseBackupStatus(
      JSON.stringify(metadata()),
      NOW,
    );

    expect(result.health).toBe("fresh");
    expect(result.metadata?.sizeBytes).toBe(12_345);
    expect(result.error).toBeNull();
  });

  it("rejects malformed JSON", () => {
    const result = parseBackupStatus("{broken", NOW);

    expect(result.health).toBe("invalid");
    expect(result.metadata).toBeNull();
  });

  it("rejects invalid backup metadata", () => {
    const result = parseBackupStatus(
      JSON.stringify({
        ...metadata(),
        sizeBytes: 0,
      }),
      NOW,
    );

    expect(result.health).toBe("invalid");
    expect(result.metadata).toBeNull();
  });

  it("rejects an invalid backup filename", () => {
    const result = parseBackupStatus(
      JSON.stringify(
        metadata({
          filename: "../database.dump",
        }),
      ),
      NOW,
    );

    expect(result.health).toBe("invalid");
  });
});
