import { stat } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { importJobs } from "@drivechronik/db";

import { validateSession } from "../../../../../../../lib/auth/session";
import { db } from "../../../../../../../lib/db";

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

async function hasRequiredFiles(stagingPath: string): Promise<boolean> {
  for (const filename of REQUIRED_FILES) {
    try {
      const info = await stat(path.join(stagingPath, filename));

      if (!info.isFile() || info.size <= 0) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

export async function POST(
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
      stagingPath: importJobs.stagingPath,
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

  if (job.status !== "staged") {
    return NextResponse.json(
      { error: "Dieser Importjob kann nicht gestartet werden." },
      { status: 409 },
    );
  }

  if (!isPathInsideStaging(job.stagingPath)) {
    return NextResponse.json(
      { error: "Ungültiger Staging-Pfad." },
      { status: 500 },
    );
  }

  if (!(await hasRequiredFiles(job.stagingPath))) {
    return NextResponse.json(
      { error: "Es fehlen Tessie-Pflichtdateien." },
      { status: 400 },
    );
  }

  const updated = await db
    .update(importJobs)
    .set({
      status: "queued",
      phase: "queued",
      progressPercent: 0,
      processed: 0,
      total: null,
      error: null,
      result: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(importJobs.id, jobId),
        eq(importJobs.status, "staged"),
      ),
    )
    .returning({
      id: importJobs.id,
      status: importJobs.status,
      phase: importJobs.phase,
    });

  const result = updated[0];

  if (!result) {
    return NextResponse.json(
      { error: "Importjob konnte nicht gestartet werden." },
      { status: 409 },
    );
  }

  return NextResponse.json(result);
}
