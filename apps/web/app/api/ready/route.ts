import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

const READINESS_TIMEOUT_MS = 3_000;

/**
 * Unauthenticated readiness probe.
 *
 * Liveness remains available at /api/health. This endpoint additionally
 * verifies that the DriveChronik PostgreSQL database can answer a query.
 */
export async function GET() {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database readiness timeout")),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        database: "ready",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
