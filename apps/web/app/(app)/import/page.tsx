import {
  BatteryCharging,
  DatabaseZap,
  ReceiptText,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import {
  importRuns,
  vehicles as vehicleTable,
} from "@drivechronik/db";

import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { db } from "../../../lib/db";
import { getVehicles } from "../../../lib/queries";

import {
  ImportHistory,
  type ImportHistoryRun,
} from "./ImportHistory";
import { TeslaChargingImport } from "./TeslaChargingImport";
import { TeslaFiImport } from "./TeslaFiImport";
import { TessieImport } from "./TessieImport";
import { TronityChargingImport } from "./TronityChargingImport";

function ImportPanelTitle({
  icon,
  title,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  tone:
    | "sky"
    | "emerald"
    | "blue";
}) {
  const toneClasses = {
    sky:
      "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    blue:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
      >
        {icon}
      </span>

      <span className="text-base">
        {title}
      </span>
    </div>
  );
}

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
    <div className="w-full">
      <PageHeader
        visual="document"
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="mt-6 space-y-6">
        <Panel
          title={
            <ImportPanelTitle
              icon={
                <DatabaseZap
                  aria-hidden
                  size={20}
                />
              }
              title={t("tessie.title")}
              tone="sky"
            />
          }
          subtitle={t(
            "tessie.description",
          )}
        >
          <p className="mb-5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {t("tessie.details")}
          </p>

          <TessieImport />
        </Panel>

                  <Panel
            title={
              <ImportPanelTitle
                icon={
                  <DatabaseZap
                    aria-hidden
                    size={20}
                  />
                }
                title={t("teslafi.title")}
                tone="blue"
              />
            }
            subtitle={t(
              "teslafi.description",
            )}
          >
            <p className="mb-5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {t("teslafi.details")}
            </p>

            <TeslaFiImport
              vehicles={vehicles}
            />
          </Panel>

<Panel
          title={
            <ImportPanelTitle
              icon={
                <ReceiptText
                  aria-hidden
                  size={20}
                />
              }
              title={t(
                "teslaCharging.title",
              )}
              tone="emerald"
            />
          }
          subtitle={t(
            "teslaCharging.description",
          )}
        >
          <p className="mb-5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {t("teslaCharging.details")}
          </p>

          <TeslaChargingImport />
        </Panel>

        <Panel
          title={
            <ImportPanelTitle
              icon={
                <BatteryCharging
                  aria-hidden
                  size={20}
                />
              }
              title={t(
                "tronityCharging.title",
              )}
              tone="blue"
            />
          }
          subtitle={t(
            "tronityCharging.description",
          )}
        >
          <p className="mb-5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {t("tronityCharging.details")}
          </p>

          <TronityChargingImport
            vehicles={vehicles}
          />
        </Panel>

        <ImportHistory
          runs={historyRuns}
        />
      </div>
    </div>
  );
}
