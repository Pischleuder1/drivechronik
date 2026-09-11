"use client";

import { useActionState } from "react";

import {
  sealMonth,
  type SealMonthResult,
} from "../../../lib/actions/monthSeals";
import { buttonClasses } from "../../../components/ui/Button";
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
}: {
  month: string;
  vehicleId: number;
  status: MonthSealStatus;
  history: MonthSealHistoryEntry[];
  canSeal: boolean;
}) {
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
      ? `Abgeschlossen · Revision ${status.revision}`
      : status.state === "sealed_changed"
        ? `Abgeschlossen, danach geändert · Revision ${status.revision}`
        : "Noch nicht abgeschlossen";

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">
            Monatsabschluss
          </p>

          <div className="mt-2">
            <StatusBadge tone={statusTone}>
              {statusLabel}
            </StatusBadge>
          </div>

          {isSealed && status.sealedAt && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Abschluss:{" "}
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(status.sealedAt))}
              {status.sealedBy
                ? ` · ${status.sealedBy}`
                : ""}
            </p>
          )}


          {isSealed &&
            status.revision != null &&
            !status.hasSnapshot && (
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                Für diese ältere Revision ist kein historischer PDF-Export verfügbar.
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
              className={buttonClasses("primary", "md", "!h-9 disabled:cursor-not-allowed")}
            >
              {pending
                ? "Wird abgeschlossen …"
                : isChanged
                  ? "Erneut abschließen"
                  : "Monat abschließen"}
            </button>
          </form>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm font-semibold">
            Abschlusshistorie
          </p>

          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div
                key={entry.revision}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-800/40"
              >
                <div>
                  <p className="text-sm font-medium">
                    Revision {entry.revision}
                  </p>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.sealedAt))}
                    {" · "}
                    {entry.sealedBy}
                  </p>

                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {entry.driveCount}{" "}
                    {entry.driveCount === 1
                      ? "Fahrt"
                      : "Fahrten"}
                    {" · "}
                    {entry.distanceKm.toLocaleString(
                      "de-DE",
                      {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      },
                    )}{" "}
                    km
                  </p>

                  {entry.signatureStatus === "valid" && (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      Signatur gültig · Ed25519
                      {entry.signingKeyId
                        ? " · Schlüssel " +
                          entry.signingKeyId.slice(0, 12) +
                          "…"
                        : ""}
                    </p>
                  )}

                  {entry.signatureStatus === "unsigned" && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Ältere Revision · nicht signiert
                    </p>
                  )}

                  {entry.signatureStatus === "invalid" && (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                      Signaturprüfung fehlgeschlagen
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
                    Snapshot nicht verfügbar
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!canSeal && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          Der aktuelle oder ein zukünftiger Monat kann noch nicht abgeschlossen werden.
        </p>
      )}

      {result.error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">
          {result.error}
        </p>
      )}

      {result.ok && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
          Monat erfolgreich abgeschlossen · Revision {result.revision}
        </p>
      )}
    </div>
  );
}
