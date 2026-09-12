import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Download,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";

export default async function DataExportPage() {
  const t = await getTranslations("settings");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("dataExport.title")}
        subtitle={t("dataExport.subtitle")}
      />

      <Panel
        className="mt-6"
        title={t("dataExport.full.title")}
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Archive aria-hidden size={21} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t("dataExport.full.description")}
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2
                  aria-hidden
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-neutral-700 dark:text-neutral-300">
                  {t("dataExport.full.contents")}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck
                  aria-hidden
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-neutral-700 dark:text-neutral-300">
                  {t("dataExport.full.security")}
                </span>
              </div>
            </div>

            <a
              href="/api/export/full"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              <Download aria-hidden size={18} />
              {t("dataExport.full.download")}
            </a>

            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t("dataExport.full.hint")}
            </p>
          </div>
        </div>
      </Panel>

      <p className="mt-6 text-sm">
        <Link
          href="/settings"
          className="font-medium text-sky-700 hover:underline dark:text-sky-300"
        >
          {t("dataExport.back")}
        </Link>
      </p>
    </div>
  );
}
