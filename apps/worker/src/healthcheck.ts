import { stat } from "node:fs/promises";

import {
  workerHealthFile,
  workerHealthMaxAgeMs,
} from "./health.js";

const interval = Number(
  process.env.SYNC_INTERVAL_SECONDS ?? "60",
);

if (!Number.isFinite(interval) || interval <= 0) {
  process.exit(1);
}

try {
  const info = await stat(workerHealthFile());
  const ageMs = Date.now() - info.mtimeMs;
  const maxAgeMs = workerHealthMaxAgeMs(interval);

  process.exit(ageMs <= maxAgeMs ? 0 : 1);
} catch {
  process.exit(1);
}
