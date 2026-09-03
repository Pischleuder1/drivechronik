import { createDb } from "@drivechronik/db";
import { createTeslamateClient, probeTeslamateSchema } from "./teslamate/client.js";
import { runSyncCycle } from "./sync/cycle.js";
import { runNextImportJob } from "./import/jobs.js";
import { loadWorkerEnv } from "./env.js";
import { writeWorkerHeartbeat } from "./health.js";

function loadEnvOrExit() {
  try {
    return loadWorkerEnv();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const env = loadEnvOrExit();
const SYNC_INTERVAL_SECONDS = env.syncIntervalSeconds;

const db = createDb(env.databaseUrl);
const tm = createTeslamateClient(env.teslamateDatabaseUrl);

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runNextImportJob(db, env.importStagingDir);
    await runSyncCycle(db, tm);
  } catch (err) {
    // Fehler ist bereits in sync_state protokolliert — nächster Tick versucht es neu.
    console.error(`[drivechronik-worker] sync fehlgeschlagen:`, err);
  } finally {
    try {
      await writeWorkerHeartbeat();
    } catch (err) {
      console.error(
        "[drivechronik-worker] heartbeat konnte nicht geschrieben werden:",
        err,
      );
    }

    running = false;
    timer = setTimeout(() => void tick(), SYNC_INTERVAL_SECONDS * 1000);
  }
}

function shutdown(signal: string): void {
  console.log(`[drivechronik-worker] received ${signal}, shutting down`);
  if (timer) clearTimeout(timer);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`[drivechronik-worker] starting, interval=${SYNC_INTERVAL_SECONDS}s`);
try {
  await probeTeslamateSchema(tm);
  console.log("[drivechronik-worker] TeslaMate-Schema ok");
  await writeWorkerHeartbeat();
} catch (err) {
  console.error(`[drivechronik-worker] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
void tick();
