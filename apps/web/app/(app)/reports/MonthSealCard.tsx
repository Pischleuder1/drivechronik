"use client";

import { useActionState } from "react";

import {
  sealMonth,
  type SealMonthResult,
} from "../../../lib/actions/monthSeals";
import type { MonthSealStatus } from "../../../lib/monthSealStatus";

const initialState: SealMonthResult = {
  ok: false,
};

export function MonthSealCard({
  month,
  vehicleId,
  status,
  canSeal,
}: {
  month: string;
  vehicleId: number;
  status: MonthSealStatus;
  canSeal: boolean;
}) {
  const [result, action, pending] = useActionState(
    sealMonth,
    initialState,
  );

  const isChanged = status.state === "sealed_changed";
  const isSealed = status.state !== "unsealed";

  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">
            Monatsabschluss
          </p>

          {status.state === "unsealed" && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Noch nicht abgeschlossen
            </p>
          )}

          {status.state === "sealed_unchanged" && (
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Abgeschlossen · Revision {status.revision}
            </p>
          )}

          {status.state === "sealed_changed" && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Abgeschlossen, danach geändert · Revision {status.revision}
            </p>
          )}

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
              className="inline-flex h-9 items-center justify-center rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
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
