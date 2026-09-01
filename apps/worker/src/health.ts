import { writeFile } from "node:fs/promises";

export const DEFAULT_WORKER_HEALTH_FILE =
  "/tmp/drivechronik-worker-health";

export function workerHealthFile(): string {
  return (
    process.env.WORKER_HEALTH_FILE?.trim() ||
    DEFAULT_WORKER_HEALTH_FILE
  );
}

export function workerHealthMaxAgeMs(
  syncIntervalSeconds: number,
): number {
  // Mindestens 5 Minuten Toleranz. Bei längeren Sync-Intervallen:
  // drei Intervalle plus eine Minute Reserve.
  return Math.max(
    5 * 60 * 1000,
    (syncIntervalSeconds * 3 + 60) * 1000,
  );
}

export async function writeWorkerHeartbeat(): Promise<void> {
  await writeFile(
    workerHealthFile(),
    new Date().toISOString(),
    "utf8",
  );
}
