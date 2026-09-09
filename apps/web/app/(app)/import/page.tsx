import { DatabaseZap, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { TessieImport } from "./TessieImport";
import { TeslaChargingImport } from "./TeslaChargingImport";

export default async function ImportPage() {
  const t = await getTranslations("import");

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
    </div>
  );
}
