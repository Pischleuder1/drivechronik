import { createWriteStream } from "node:fs";
import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { importJobs } from "@drivechronik/db";

import { validateSession } from "../../../../../../../lib/auth/session";
import { db } from "../../../../../../../lib/db";

export const dynamic = "force-dynamic";

const IMPORT_STAGING_DIR =
  process.env.IMPORT_STAGING_DIR ?? "/import-staging";

const ALLOWED_FILES = new Set([
  "driving_states.csv",
  "charging_states.csv",
  "climate_states.csv",
  "battery_states.csv",
]);

function isPathInsideStaging(stagingPath: string): boolean {
  const root = path.resolve(IMPORT_STAGING_DIR);
  const resolved = path.resolve(stagingPath);

  return resolved.startsWith(`${root}${path.sep}`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("import");
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: t("apiErrors.notAuthenticated") },
      { status: 401 },
    );
  }

  const { id } = await params;
  const jobId = Number(id);

  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json(
      { error: t("tessie.errors.invalidJobId") },
      { status: 400 },
    );
  }

  const filename = request.nextUrl.searchParams.get("file");

  if (!filename || !ALLOWED_FILES.has(filename)) {
    return NextResponse.json(
      { error: t("tessie.errors.invalidFilename") },
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
      { error: t("tessie.errors.jobNotFound") },
      { status: 404 },
    );
  }

  if (job.status !== "staged") {
    return NextResponse.json(
      { error: t("tessie.errors.uploadsClosed") },
      { status: 409 },
    );
  }

  if (!isPathInsideStaging(job.stagingPath)) {
    return NextResponse.json(
      { error: t("tessie.errors.invalidStagingPath") },
      { status: 500 },
    );
  }

  if (!request.body) {
    return NextResponse.json(
      { error: t("tessie.errors.fileContentMissing") },
      { status: 400 },
    );
  }

  await mkdir(job.stagingPath, { recursive: true });
  await access(job.stagingPath);

  const targetPath = path.join(job.stagingPath, filename);
  const temporaryPath = path.join(
    job.stagingPath,
    `${filename}.part-${randomUUID()}`,
  );

  try {
    const output = createWriteStream(temporaryPath, {
      flags: "wx",
    });

    try {
      const reader = request.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!output.write(Buffer.from(value))) {
          await once(output, "drain");
        }
      }

      output.end();

      await once(output, "finish");
    } catch (error) {
      output.destroy();
      throw error;
    }

    await rename(temporaryPath, targetPath);

    return NextResponse.json({
      ok: true,
      id: jobId,
      file: filename,
    });
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);

    console.error(
      `[web] Tessie-Datei konnte nicht gespeichert werden: Job ${jobId}, ${filename}`,
      error,
    );

    return NextResponse.json(
      { error: t("tessie.errors.fileSaveFailed") },
      { status: 500 },
    );
  }
}
