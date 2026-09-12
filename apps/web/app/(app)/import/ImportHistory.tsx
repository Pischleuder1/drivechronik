"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { buttonClasses } from "../../../components/ui/Button";

export type ImportHistoryRun = {
  id: number;
  source: string;
  status: string;
  vehicleName: string | null;
  fileName: string | null;
  createdBy: string;
  summary: Record<string, unknown> | null;
  rollbackSummary: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
  rolledBackAt: string | null;
};

type RollbackDetail = {
  changeId: number;
  entityType: string;
  entityId: number;
  action: string;
  outcome: string;
  conflicts: string[];
};

type RollbackPreview = {
  importRunId: number;
  source: string;
  status: string;
  totalChanges: number;
  deletable: number;
  restorable: number;
  alreadyRolledBack: number;
  conflicts: number;
  details: RollbackDetail[];
};

type RollbackPreviewResponse = {
  mode: "preview";
  preview: RollbackPreview;
};

type RollbackResultResponse = {
  mode: "rollback";
  result: RollbackPreview & {
    deleted: number;
    restored: number;
  };
};

interface Props {
  runs: ImportHistoryRun[];
}

function numericValue(
  value: unknown,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function statusClasses(
  status: string,
): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "rollback_partial":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "rolled_back":
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "running":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  }
}

export function ImportHistory({
  runs,
}: Props) {
  const t = useTranslations("import");
  const router = useRouter();

  const [busyRunId, setBusyRunId] =
    useState<number | null>(null);

  const [preview, setPreview] =
    useState<{
      runId: number;
      data: RollbackPreview;
    } | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  function sourceLabel(
    source: string,
  ): string {
    switch (source) {
      case "tronity":
        return t(
          "history.source.tronity",
        );
      case "tesla_charging":
        return t(
          "history.source.teslaCharging",
        );
      case "tessie":
        return t(
          "history.source.tessie",
        );
      default:
        return source;
    }
  }

  function statusLabel(
    status: string,
  ): string {
    switch (status) {
      case "running":
        return t(
          "history.status.running",
        );
      case "completed":
        return t(
          "history.status.completed",
        );
      case "failed":
        return t(
          "history.status.failed",
        );
      case "rollback_partial":
        return t(
          "history.status.rollbackPartial",
        );
      case "rolled_back":
        return t(
          "history.status.rolledBack",
        );
      default:
        return status;
    }
  }

  function summaryText(
    run: ImportHistoryRun,
  ): string {
    const summary =
      run.summary ?? {};

    const inserted =
      numericValue(
        summary.inserted,
      );

    const updated =
      numericValue(
        summary.updated,
      );

    const unchanged =
      numericValue(
        summary.unchanged,
      );

    if (
      run.source === "tronity"
    ) {
      if (
        inserted === 0 &&
        updated === 0 &&
        unchanged === 0
      ) {
        return t(
          "history.result.none",
        );
      }

      return t(
        "history.result.tronity",
        {
          inserted,
          updated,
          unchanged,
        },
      );
    }

    const changed =
      inserted + updated;

    if (changed > 0) {
      return t(
        "history.result.changes",
        {
          count: changed,
        },
      );
    }

    return t(
      "history.result.none",
    );
  }

  function canRollback(
    run: ImportHistoryRun,
  ): boolean {
    if (
      run.source !== "tronity" &&
      run.source !== "tesla_charging"
    ) {
      return false;
    }

    if (
      run.status !== "completed" &&
      run.status !==
        "rollback_partial"
    ) {
      return false;
    }

    const summary =
      run.summary ?? {};

    return (
      numericValue(
        summary.inserted,
      ) +
        numericValue(
          summary.updated,
        ) >
      0
    );
  }

  async function checkRollback(
    run: ImportHistoryRun,
  ) {
    setBusyRunId(run.id);
    setPreview(null);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/import/runs/${run.id}/rollback`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const body = (await response
        .json()
        .catch(() => null)) as
        | RollbackPreviewResponse
        | { error?: string }
        | null;

      if (
        !response.ok ||
        !body ||
        !("preview" in body)
      ) {
        throw new Error(
          body &&
            "error" in body &&
            typeof body.error ===
              "string"
            ? body.error
            : t(
                "history.errors.preview",
              ),
        );
      }

      setPreview({
        runId: run.id,
        data: body.preview,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "history.errors.preview",
            ),
      );
    } finally {
      setBusyRunId(null);
    }
  }

  async function confirmRollback(
    runId: number,
  ) {
    setBusyRunId(runId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/import/runs/${runId}/rollback`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            confirm: true,
          }),
        },
      );

      const body = (await response
        .json()
        .catch(() => null)) as
        | RollbackResultResponse
        | { error?: string }
        | null;

      if (
        !response.ok ||
        !body ||
        !("result" in body)
      ) {
        throw new Error(
          body &&
            "error" in body &&
            typeof body.error ===
              "string"
            ? body.error
            : t(
                "history.errors.rollback",
              ),
        );
      }

      if (
        body.result.conflicts > 0
      ) {
        setMessage(
          t(
            "history.rollbackPartial",
            {
              count:
                body.result
                  .conflicts,
            },
          ),
        );
      } else {
        setMessage(
          t("history.rollbackDone"),
        );
      }

      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "history.errors.rollback",
            ),
      );
    } finally {
      setBusyRunId(null);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          <History
            aria-hidden
            size={21}
          />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
            {t("history.title")}
          </h2>

          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t(
              "history.description",
            )}
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-5 flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2
            aria-hidden
            size={18}
            className="mt-0.5 shrink-0"
          />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mt-5 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle
            aria-hidden
            size={18}
            className="mt-0.5 shrink-0"
          />
          <span>{error}</span>
        </div>
      )}

      {runs.length === 0 ? (
        <p className="mt-5 text-sm text-neutral-500 dark:text-neutral-400">
          {t("history.empty")}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {runs.map((run) => {
            const selected =
              preview?.runId ===
              run.id;

            const busy =
              busyRunId ===
              run.id;

            return (
              <div
                key={run.id}
                className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {sourceLabel(
                          run.source,
                        )}
                      </p>

                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(
                          run.status,
                        )}`}
                      >
                        {statusLabel(
                          run.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-400">
                      {run.fileName ??
                        t(
                          "history.fileUnknown",
                        )}
                    </p>

                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(
                        run.startedAt,
                      ).toLocaleString(
                        [],
                        {
                          year:
                            "numeric",
                          month:
                            "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute:
                            "2-digit",
                        },
                      )}

                      {" · "}

                      {t(
                        "history.createdBy",
                        {
                          name:
                            run.createdBy,
                        },
                      )}

                      {run.vehicleName
                        ? ` · ${t(
                            "history.vehicle",
                            {
                              name:
                                run.vehicleName,
                            },
                          )}`
                        : ""}
                    </p>

                    <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                      {summaryText(run)}
                    </p>
                  </div>

                  {canRollback(run) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void checkRollback(
                          run,
                        )
                      }
                      className={buttonClasses(
                        "destructive",
                        "sm",
                      )}
                    >
                      {busy ? (
                        <Loader2
                          aria-hidden
                          size={14}
                          className="animate-spin"
                        />
                      ) : (
                        <RotateCcw
                          aria-hidden
                          size={14}
                        />
                      )}

                      {busy
                        ? t(
                            "history.checking",
                          )
                        : t(
                            "history.undo",
                          )}
                    </button>
                  )}
                </div>

                {selected && preview && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                    <div className="flex gap-2">
                      <AlertTriangle
                        aria-hidden
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-amber-900 dark:text-amber-200">
                          {t(
                            "history.previewTitle",
                          )}
                        </p>

                        <div className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200">
                          {preview.data
                            .deletable >
                            0 && (
                            <p>
                              {t(
                                "history.previewDelete",
                                {
                                  count:
                                    preview
                                      .data
                                      .deletable,
                                },
                              )}
                            </p>
                          )}

                          {preview.data
                            .restorable >
                            0 && (
                            <p>
                              {t(
                                "history.previewRestore",
                                {
                                  count:
                                    preview
                                      .data
                                      .restorable,
                                },
                              )}
                            </p>
                          )}

                          {preview.data
                            .alreadyRolledBack >
                            0 && (
                            <p>
                              {t(
                                "history.previewAlready",
                                {
                                  count:
                                    preview
                                      .data
                                      .alreadyRolledBack,
                                },
                              )}
                            </p>
                          )}

                          {preview.data
                            .conflicts >
                            0 && (
                            <p className="font-medium">
                              {t(
                                "history.previewConflicts",
                                {
                                  count:
                                    preview
                                      .data
                                      .conflicts,
                                },
                              )}
                            </p>
                          )}

                          {preview.data
                            .totalChanges ===
                            0 && (
                            <p>
                              {t(
                                "history.previewNothing",
                              )}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setPreview(
                                null,
                              )
                            }
                            className={buttonClasses(
                              "secondary",
                              "sm",
                            )}
                          >
                            {t(
                              "history.cancel",
                            )}
                          </button>

                          {(preview.data
                            .deletable >
                            0 ||
                            preview.data
                              .restorable >
                              0) && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void confirmRollback(
                                  run.id,
                                )
                              }
                              className={buttonClasses(
                                "destructive",
                                "sm",
                              )}
                            >
                              {busy ? (
                                <Loader2
                                  aria-hidden
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <RotateCcw
                                  aria-hidden
                                  size={14}
                                />
                              )}

                              {busy
                                ? t(
                                    "history.rollingBack",
                                  )
                                : t(
                                    "history.confirm",
                                  )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
