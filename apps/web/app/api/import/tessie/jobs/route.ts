import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { importJobs } from "@drivechronik/db";

import { validateSession } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

const IMPORT_STAGING_DIR =
  process.env.IMPORT_STAGING_DIR ?? "/import-staging";

export async function POST() {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  const stagingName = `tessie-${randomUUID()}`;
  const stagingPath = path.join(IMPORT_STAGING_DIR, stagingName);

  try {
    await mkdir(stagingPath, { recursive: false });

    const rows = await db
      .insert(importJobs)
      .values({
        source: "tessie",
        status: "staged",
        phase: "awaiting_upload",
        progressPercent: 0,
        processed: 0,
        stagingPath,
      })
      .returning({
        id: importJobs.id,
        status: importJobs.status,
      });

    const job = rows[0];

    if (!job) {
      await rm(stagingPath, { recursive: true, force: true });

      return NextResponse.json(
        { error: "Importjob konnte nicht angelegt werden." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
      },
      { status: 201 },
    );
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true }).catch(() => {});

    console.error("[web] Tessie-Importjob konnte nicht angelegt werden", error);

    return NextResponse.json(
      { error: "Importjob konnte nicht angelegt werden." },
      { status: 500 },
    );
  }
}
