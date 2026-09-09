"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { buttonClasses } from "../../../components/ui/Button";

type PreviewRow = {
  rowNumber: number;
  chargeStartTime: string;
  vin: string;
  siteLocationName: string | null;
  energyKwh: number | null;
  invoiceNumber: string | null;
  totalIncVat: number | null;
  currency: string | null;
  status: string | null;
  existing: boolean;
  matchStatus:
    | "matched"
    | "ambiguous"
    | "unmatched"
    | "vehicle_not_found";
  chargeSessionId: number | null;
  timeDiffMinutes: number | null;
};

type Summary = {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  vehicleNotFound: number;
  existing: number;
  newRecords?: number;
  updatedRecords?: number;
};

type PreviewResponse = {
  mode: "preview";
  summary: Summary;
  rows: PreviewRow[];
  truncated: boolean;
};

type ImportResponse = {
  mode: "import";
  summary: Summary;
};

export function TeslaChargingImport() {
  const t = useTranslations("import");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] =
    useState<PreviewResponse | null>(null);
  const [result, setResult] =
    useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    mode: "preview" | "import",
  ) {
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("file", file);

      const response = await fetch(
        `/api/import/tesla-charging?mode=${mode}`,
        {
          method: "POST",
          body: form,
        },
      );

      const body = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          body &&
          typeof body.error === "string"
            ? body.error
            : t(
                "teslaCharging.errors.unknown",
              ),
        );
      }

      if (mode === "preview") {
        setPreview(body);
        setResult(null);
      } else {
        setResult(body);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "teslaCharging.errors.unknown",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  function statusLabel(
    status: PreviewRow["matchStatus"],
  ) {
    return t(
      `teslaCharging.match.${status}`,
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <FileSpreadsheet
            aria-hidden
            size={18}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {file
              ? file.name
              : t(
                  "teslaCharging.selectFile",
                )}
          </span>

          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
            {file
              ? t(
                  "teslaCharging.selected",
                  {
                    size: Math.max(
                      1,
                      Math.round(
                        file.size / 1024,
                      ),
                    ),
                  },
                )
              : t(
                  "teslaCharging.fileHint",
                )}
          </span>
        </span>

        {file && (
          <CheckCircle2
            aria-hidden
            size={18}
            className="shrink-0 text-emerald-600 dark:text-emerald-400"
          />
        )}

        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            setFile(
              event.target.files?.[0] ??
                null,
            );
            setPreview(null);
            setResult(null);
            setError(null);
          }}
        />
      </label>

      {preview && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [
                t(
                  "teslaCharging.summary.total",
                ),
                preview.summary.total,
              ],
              [
                t(
                  "teslaCharging.summary.matched",
                ),
                preview.summary.matched,
              ],
              [
                t(
                  "teslaCharging.summary.unmatched",
                ),
                preview.summary.unmatched,
              ],
              [
                t(
                  "teslaCharging.summary.existing",
                ),
                preview.summary.existing,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/60"
              >
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {(preview.summary.ambiguous >
            0 ||
            preview.summary
              .vehicleNotFound > 0) && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t(
                "teslaCharging.reviewHint",
              )}
            </p>
          )}

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {preview.rows.map((row) => (
              <div
                key={`${row.rowNumber}-${row.chargeStartTime}`}
                className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {row.siteLocationName ??
                        "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(
                        row.chargeStartTime,
                      ).toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={
                      row.matchStatus ===
                      "matched"
                        ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : row.matchStatus ===
                            "ambiguous"
                          ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                    }
                  >
                    {statusLabel(
                      row.matchStatus,
                    )}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <span>
                    {row.energyKwh != null
                      ? `${row.energyKwh.toFixed(
                          2,
                        )} kWh`
                      : "— kWh"}
                  </span>

                  <span>
                    {row.totalIncVat !=
                    null
                      ? `${row.totalIncVat.toFixed(
                          2,
                        )} ${
                          row.currency ?? ""
                        }`
                      : "—"}
                  </span>

                  <span>
                    {row.invoiceNumber ??
                      t(
                        "teslaCharging.noInvoice",
                      )}
                  </span>

                  {row.existing && (
                    <span>
                      {t(
                        "teslaCharging.alreadyImported",
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {preview.truncated && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t(
                "teslaCharging.previewTruncated",
              )}
            </p>
          )}
        </>
      )}

      {result && (
        <p
          role="status"
          className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2
            aria-hidden
            size={17}
            className="mt-0.5 shrink-0"
          />
          <span>
            {t(
              "teslaCharging.completed",
              {
                total:
                  result.summary.total,
                matched:
                  result.summary.matched,
              },
            )}
          </span>
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
        >
          <XCircle
            aria-hidden
            size={17}
            className="mt-0.5 shrink-0"
          />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!preview && !result && (
          <button
            type="button"
            disabled={busy || !file}
            onClick={() =>
              void submit("preview")
            }
            className={buttonClasses(
              "primary",
              "sm",
            )}
          >
            {busy ? (
              <Loader2
                aria-hidden
                size={16}
                className="animate-spin"
              />
            ) : (
              <Upload
                aria-hidden
                size={16}
              />
            )}

            {t(
              "teslaCharging.check",
            )}
          </button>
        )}

        {preview && !result && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void submit("import")
            }
            className={buttonClasses(
              "primary",
              "sm",
            )}
          >
            {busy && (
              <Loader2
                aria-hidden
                size={16}
                className="animate-spin"
              />
            )}

            {t(
              "teslaCharging.import",
            )}
          </button>
        )}

        {(preview || result) && (
          <button
            type="button"
            disabled={busy}
            onClick={reset}
            className={buttonClasses(
              "secondary",
              "sm",
            )}
          >
            {t(
              "teslaCharging.reset",
            )}
          </button>
        )}
      </div>
    </div>
  );
}
