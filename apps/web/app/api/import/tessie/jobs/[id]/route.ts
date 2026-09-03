import { stat } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { importJobs } from "@drivechronik/db";

import { validateSession } from "../../../../../../lib/auth/session";
import { db } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

const IMPORT_STAGING_DIR =
  process.env.IMPORT_STAGING_DIR ?? "/import-staging";

const REQUIRED_FILES = [
  "driving_states.csv",
  "charging_states.csv",
  "climate_states.csv",
  "battery_states.csv",
] as const;

function isPathInsideStaging(stagingPath: string): boolean {
  const root = path.resolve(IMPORT_STAGING_DIR);
  const resolved = path.resolve(stagingPath);

  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const jobId = Number(id);

  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json(
      { error: "Ungültige Importjob-ID." },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: importJobs.id,
      source: importJobs.source,
      status: importJobs.status,
      phase: importJobs.phase,
      progressPercent: importJobs.progressPercent,
      processed: importJobs.processed,
      total: importJobs.total,
      stagingPath: importJobs.stagingPath,
      error: importJobs.error,
      result: importJobs.result,
    })
    .from(importJobs)
    .where(
      and(
        eq(importJobs.id, jobId),
        eq(importJobs.source, "tessie"),
      ),
    )
    .limit(1);

  const job = rows[0];

  if (!job) {
    return NextResponse.json(
      { error: "Importjob nicht gefunden." },
      { status: 404 },
    );
  }

  if (!isPathInsideStaging(job.stagingPath)) {
    return NextResponse.json(
      { error: "Ungültiger Staging-Pfad." },
      { status: 500 },
    );
  }

  const files = await Promise.all(
    REQUIRED_FILES.map(async (filename) => {
      try {
        const info = await stat(path.join(job.stagingPath, filename));

        return {
          name: filename,
          uploaded: info.isFile(),
          size: info.isFile() ? info.size : 0,
        };
      } catch {
        return {
          name: filename,
          uploaded: false,
          size: 0,
        };
      }
    }),
  );

  return NextResponse.json({
    id: job.id,
    status: job.status,
    phase: job.phase,
    progressPercent: job.progressPercent,
    processed: job.processed,
    total: job.total,
    error: job.error,
    result: job.result,
    files,
    ready: files.every((file) => file.uploaded && file.size > 0),
  });
}
