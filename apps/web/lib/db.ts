import "server-only";
import { createDb, type Db } from "@drivechronik/db";
import { getDatabaseUrl } from "./config";

/**
 * Server-only singleton database handle.
 *
 * Next.js may re-evaluate modules across HMR reloads and route bundles, so the
 * connection is cached on `globalThis` to avoid exhausting the Postgres
 * connection pool during development.
 */
const globalForDb = globalThis as unknown as { __drivechronikDb?: Db };

export const db: Db =
  globalForDb.__drivechronikDb ??
  createDb(
    process.env.NEXT_PHASE === "phase-production-build"
      ? "postgres://build:build@localhost:5432/build"
      : getDatabaseUrl(),
  );

if (process.env.NODE_ENV !== "production") {
  globalForDb.__drivechronikDb = db;
}
