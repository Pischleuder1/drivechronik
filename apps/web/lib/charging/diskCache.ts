import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ChargingSite } from "./types";

interface StoredChargingCache {
  loadedAt: number;
  sites: ChargingSite[];
}

function cachePath(): string | null {
  const dir = process.env.CHARGING_CACHE_DIR?.trim();
  return dir ? join(dir, "bundesnetzagentur.json") : null;
}

export async function readChargingCache():
  Promise<StoredChargingCache | null> {
  const path = cachePath();
  if (!path) return null;

  try {
    const data: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!data || typeof data !== "object") return null;

    const value = data as Partial<StoredChargingCache>;
    if (!Number.isFinite(value.loadedAt) ||
        !Array.isArray(value.sites)) return null;

    return value as StoredChargingCache;
  } catch {
    return null;
  }
}

export async function writeChargingCache(
  data: StoredChargingCache,
): Promise<void> {
  const path = cachePath();
  if (!path) return;

  const dir = process.env.CHARGING_CACHE_DIR!.trim();
  const temporaryPath = `${path}.${process.pid}.tmp`;

  await mkdir(dir, { recursive: true });

  try {
    await writeFile(temporaryPath, JSON.stringify(data), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  } catch (error) {
    const { unlink } = await import("node:fs/promises");
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
