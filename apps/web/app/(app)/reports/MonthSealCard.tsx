"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, History } from "lucide-react";

import {
  sealMonth,
  type SealMonthResult,
} from "../../../lib/actions/monthSeals";
import { buttonClasses } from "../../../components/ui/Button";
import { IconBadge } from "../../../components/ui/IconBadge";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type {
  MonthSealHistoryEntry,
  MonthSealStatus,
} from "../../../lib/monthSealStatus";

const initialState: SealMonthResult = {
  ok: false,
};

export function MonthSealCard({
  month,
  vehicleId,
  status,
  history,
  canSeal,
  embedded = false,
}: {
  month: string;
  vehicleId: number;
  status: MonthSealStatus;
  history: MonthSealHistoryEntry[];
  canSeal: boolean;
  embedded?: boolean;
}) {
  const t = useTranslations("reports.monthSeal");
  const locale = useLocale();

  const [result, action, pending] = useActionState(
    sealMonth,
    initialState,
  );

  const isChanged = status.state === "sealed_changed";
  const isSealed = status.state !== "unsealed";

  const statusTone =
    status.state === "sealed_unchanged"
      ? "emerald"
      : status.state === "sealed_changed"
        ? "amber"
        : "neutral";

  const statusLabel =
    status.state === "sealed_unchanged"
      ? t("sealed", { revision: status.revision ?? "—" })
      : status.state === "sealed_changed"
        ? t("sealedChanged", { revision: status.revision ?? "—" })
        : t("unsealed");

  return (
    <div
      className={
        embedded
          ? "w-full"
          : "rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-3">
            {!embedded && (
              <IconBadge tone={statusTone} size="sm">
                <CalendarCheck className="h-4 w-4" />
              </IconBadge>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t("title")}
              </p>
              <StatusBadge tone={statusTone}>
                {statusLabel}
              </StatusBadge>
            </div>
          </div>

          {isSealed && status.sealedAt && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t("sealedAt", {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(status.sealedAt)),
              })}
              {status.sealedBy
                ? ` · ${status.sealedBy}`
                : ""}
            </p>
          )}


          {isSealed &&
            status.revision != null &&
            !status.hasSnapshot && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {t("noHistoricPdf")}
              </p>
            )}
        </div>

        {(!isSealed || isChanged) && (
          <form action={action}>
            <input type="hidden" name="month" value={month} />
            <input
              type="hidden"
              name="vehicleId"
              value={vehicleId}
            />

            <button
              type="submit"
              disabled={!canSeal || pending}
              className={buttonClasses(
                "primary",
                embedded ? "sm" : "md",
                embedded
                  ? "!h-8 min-w-[150px] justify-center disabled:cursor-not-allowed"
                  : "!h-9 disabled:cursor-not-allowed",
              )}
            >
              {pending
                ? t("sealing")
                : isChanged
                  ? t("reseal")
                  : t("seal")}
            </button>
          </form>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-semibold">
              {t("history")}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div
                key={entry.revision}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-800/40"
              >
                <div>
                  <p className="text-sm font-medium">
                    {t("revision", { revision: entry.revision })}
                  </p>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.sealedAt))}
                    {" · "}
                    {entry.sealedBy}
                  </p>

                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {t("drives", { count: entry.driveCount })}
                    {" · "}
                    {entry.distanceKm.toLocaleString(
                      locale,
                      {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      },
                    )}{" "}
                    km
                  </p>

                  {entry.signatureStatus === "valid" && (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      {t("signatureValid")}
                      {entry.signingKeyId
                        ? " · " +
                          t("signingKey", {
                            key: entry.signingKeyId.slice(0, 12) + "…",
                          })
                        : ""}
                    </p>
                  )}

                  {entry.signatureStatus === "unsigned" && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {t("unsigned")}
                    </p>
                  )}

                  {entry.signatureStatus === "invalid" && (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                      {t("signatureInvalid")}
                    </p>
                  )}
                </div>

                {entry.hasSnapshot ? (
                  <a
                    href={
                      "/api/export/month/" +
                      month +
                      "/sealed/" +
                      entry.revision +
                      "?vehicleId=" +
                      vehicleId
                    }
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-300 px-3 text-xs font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    PDF
                  </a>
                ) : (
                  <span className="text-xs text-neutral-400">
                    {t("snapshotUnavailable")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!canSeal && (
        <p className={embedded
          ? "mt-2 text-xs text-neutral-400 dark:text-neutral-500"
          : "mt-3 text-xs text-neutral-500 dark:text-neutral-400"}>
          {t("cannotSeal")}
        </p>
      )}

      {result.error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">
          {result.error}
        </p>
      )}

      {result.ok && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          {t("success", { revision: result.revision ?? "—" })}
        </p>
      )}
    </div>
  );
}
