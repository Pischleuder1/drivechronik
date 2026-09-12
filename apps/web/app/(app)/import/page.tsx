import { BatteryCharging, DatabaseZap, ReceiptText } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import {
  importRuns,
  vehicles as vehicleTable,
} from "@drivechronik/db";

import { TessieImport } from "./TessieImport";
import { TeslaChargingImport } from "./TeslaChargingImport";
import { TronityChargingImport } from "./TronityChargingImport";
import {
  ImportHistory,
  type ImportHistoryRun,
} from "./ImportHistory";
import { db } from "../../../lib/db";
import { getVehicles } from "../../../lib/queries";

export default async function ImportPage() {
  const t = await getTranslations("import");

  const [vehicles, historyRows] =
    await Promise.all([
      getVehicles(),
      db
        .select({
          id: importRuns.id,
          source: importRuns.source,
          status: importRuns.status,
          vehicleName:
            vehicleTable.displayName,
          fileName:
            importRuns.fileName,
          createdBy:
            importRuns.createdBy,
          summary:
            importRuns.summary,
          rollbackSummary:
            importRuns.rollbackSummary,
          startedAt:
            importRuns.startedAt,
          finishedAt:
            importRuns.finishedAt,
          rolledBackAt:
            importRuns.rolledBackAt,
        })
        .from(importRuns)
        .leftJoin(
          vehicleTable,
          eq(
            importRuns.vehicleId,
            vehicleTable.id,
          ),
        )
        .orderBy(
          desc(importRuns.startedAt),
          desc(importRuns.id),
        )
        .limit(20),
    ]);

  const historyRuns: ImportHistoryRun[] =
    historyRows.map((run) => ({
      ...run,
      summary:
        run.summary &&
        typeof run.summary === "object" &&
        !Array.isArray(run.summary)
          ? run.summary as Record<
              string,
              unknown
            >
          : null,
      rollbackSummary:
        run.rollbackSummary &&
        typeof run.rollbackSummary ===
          "object" &&
        !Array.isArray(
          run.rollbackSummary,
        )
          ? run.rollbackSummary as Record<
              string,
              unknown
            >
          : null,
      startedAt:
        run.startedAt.toISOString(),
      finishedAt:
        run.finishedAt?.toISOString() ??
        null,
      rolledBackAt:
        run.rolledBackAt?.toISOString() ??
        null,
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("title")}
      </h1>

      <p className="mt-3 text-neutral-500 dark:text-neutral-400">
        {t("subtitle")}
      </p>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <DatabaseZap aria-hidden size={21} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {t("tessie.title")}
            </h2>

            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {t("tessie.description")}
            </p>

            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {t("tessie.details")}
            </p>
          </div>
        </div>

        <TessieImport />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ReceiptText aria-hidden size={21} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {t("teslaCharging.title")}
            </h2>

            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {t("teslaCharging.description")}
            </p>

            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {t("teslaCharging.details")}
            </p>
          </div>
        </div>

        <TeslaChargingImport />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <BatteryCharging aria-hidden size={21} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {t("tronityCharging.title")}
            </h2>

            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {t("tronityCharging.description")}
            </p>

            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {t("tronityCharging.details")}
            </p>
          </div>
        </div>

        <TronityChargingImport vehicles={vehicles} />
      </section>

      <ImportHistory runs={historyRuns} />
    </div>
  );
}
