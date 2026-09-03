import path from "node:path";
import { sql } from "drizzle-orm";
import { importJobs, type Db } from "@drivechronik/db";
import { importTessie } from "./tessie.js";

interface ClaimedImportJob extends Record<string, unknown> {
  id: number;
  source: string;
  staging_path: string;
  vehicle_id: number | null;
}

async function claimNextTessieJob(
  db: Db,
): Promise<ClaimedImportJob | null> {
  const rows = await db.execute<ClaimedImportJob>(sql`
    update import_jobs
    set
      status = 'importing',
      phase = 'starting',
      progress_percent = 0,
      processed = 0,
      started_at = now(),
      finished_at = null,
      error = null,
      result = null,
      updated_at = now()
    where id = (
      select id
      from import_jobs
      where status = 'queued'
        and source = 'tessie'
      order by created_at asc, id asc
      for update skip locked
      limit 1
    )
    returning
      id::int as id,
      source,
      staging_path,
      vehicle_id::int as vehicle_id
  `);

  return rows[0] ?? null;
}

async function completeJob(
  db: Db,
  jobId: number,
  result: unknown,
): Promise<void> {
  await db
    .update(importJobs)
    .set({
      status: "completed",
      phase: "completed",
      progressPercent: 100,
      finishedAt: new Date(),
      result,
      updatedAt: new Date(),
    })
    .where(sql`${importJobs.id} = ${jobId}`);
}

async function failJob(
  db: Db,
  jobId: number,
  err: unknown,
): Promise<void> {
  const message =
    err instanceof Error ? err.message : String(err);

  await db
    .update(importJobs)
    .set({
      status: "failed",
      phase: "failed",
      finishedAt: new Date(),
      error: message,
      updatedAt: new Date(),
    })
    .where(sql`${importJobs.id} = ${jobId}`);
}

export async function runNextImportJob(
  db: Db,
  importStagingDir: string,
): Promise<boolean> {
  const job = await claimNextTessieJob(db);

  if (job == null) return false;

  try {
    const resolvedRoot = path.resolve(importStagingDir);
    const resolvedJobPath = path.resolve(job.staging_path);

    if (
      resolvedJobPath !== resolvedRoot &&
      !resolvedJobPath.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      throw new Error(
        `Ungültiger staging_path für Importjob ${job.id}`,
      );
    }

    console.log(
      `[drivechronik-worker] starte Tessie-Importjob ${job.id}`,
    );

    let lastProgressPercent = -1;

    const result = await importTessie(db, resolvedJobPath, {
      vehicleId: job.vehicle_id ?? undefined,
      onProgress: async (progress) => {
        const shouldWrite =
          progress.progressPercent !== lastProgressPercent ||
          progress.phase === "completed";

        if (!shouldWrite) return;

        lastProgressPercent = progress.progressPercent;

        await db
          .update(importJobs)
          .set({
            phase: progress.phase,
            progressPercent: progress.progressPercent,
            processed: progress.processed,
            total: progress.total,
            updatedAt: new Date(),
          })
          .where(sql`${importJobs.id} = ${job.id}`);
      },
    });

    await completeJob(db, job.id, result);

    console.log(
      `[drivechronik-worker] Tessie-Importjob ${job.id} abgeschlossen`,
    );
  } catch (err) {
    await failJob(db, job.id, err);

    console.error(
      `[drivechronik-worker] Tessie-Importjob ${job.id} fehlgeschlagen:`,
      err,
    );
  }

  return true;
}
