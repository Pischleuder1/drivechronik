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

type Vehicle = {
  id: number;
  displayName: string;
};

type MatchStatus =
  | "matched"
  | "ambiguous"
  | "unmatched";

type PreviewRow = {
  rowNumber: number;

  startTime: string;
  endTime: string;

  address: string | null;
  energyKwh: number | null;

  startSoc: number | null;
  endSoc: number | null;

  cost: number | null;

  chargerType:
    | "ac"
    | "dc"
    | null;

  matchStatus: MatchStatus;

  chargeSessionId: number | null;
  existingSource: string | null;

  startDiffMinutes: number | null;
  endDiffMinutes: number | null;
  energyDiffKwh: number | null;
  locationDistanceKm: number | null;

  changes: string[];
};

type Summary = {
  total: number;
  matched: number;
  ambiguous: number;
  newRecords: number;
  toUpdate: number;
  unchanged: number;

  inserted?: number;
  updated?: number;
  skippedAmbiguous?: number;
};

type PreviewResponse = {
  mode: "preview";

  vehicle: Vehicle;

  summary: Summary;

  rows: PreviewRow[];

  truncated: boolean;
};

type ImportResponse = {
  mode: "import";

  vehicle: Vehicle;

  summary: Summary;
};

interface Props {
  vehicles: Vehicle[];
}

export function TronityChargingImport({
  vehicles,
}: Props) {
  const t = useTranslations("import");

  const [vehicleId, setVehicleId] =
    useState(
      vehicles.length === 1
        ? String(vehicles[0]!.id)
        : "",
    );

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<PreviewResponse | null>(
      null,
    );

  const [result, setResult] =
    useState<ImportResponse | null>(
      null,
    );

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    mode: "preview" | "import",
  ) {
    if (!file || !vehicleId) return;

    setBusy(true);
    setError(null);

    try {
      const form = new FormData();

      form.set("file", file);
      form.set(
        "vehicleId",
        vehicleId,
      );

      const response = await fetch(
        `/api/import/tronity-charging?mode=${mode}`,
        {
          method: "POST",
          body: form,
        },
      );

      const body = (await response
        .json()
        .catch(() => null)) as
        | PreviewResponse
        | ImportResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body &&
            "error" in body &&
            typeof body.error ===
              "string"
            ? body.error
            : t(
                "tronityCharging.errors.unknown",
              ),
        );
      }

      if (mode === "preview") {
        setPreview(
          body as PreviewResponse,
        );

        setResult(null);
      } else {
        setResult(
          body as ImportResponse,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "tronityCharging.errors.unknown",
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

  function matchLabel(
    status: MatchStatus,
  ) {
    return t(
      `tronityCharging.match.${status}`,
    );
  }

  function matchClass(
    status: MatchStatus,
  ) {
    if (status === "matched") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    }

    if (status === "ambiguous") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    }

    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  }

  function changeLabel(
    field: string,
  ) {
    switch (field) {
      case "endTime":
        return t(
          "tronityCharging.fields.endTime",
        );

      case "lat":
      case "lon":
        return t(
          "tronityCharging.fields.position",
        );

      case "address":
        return t(
          "tronityCharging.fields.address",
        );

      case "startSoc":
        return t(
          "tronityCharging.fields.startSoc",
        );

      case "endSoc":
        return t(
          "tronityCharging.fields.endSoc",
        );

      case "energyAddedKwh":
        return t(
          "tronityCharging.fields.energy",
        );

      case "maxPowerKw":
        return t(
          "tronityCharging.fields.maxPower",
        );

      case "chargerType":
        return t(
          "tronityCharging.fields.chargerType",
        );

      case "durationSeconds":
        return t(
          "tronityCharging.fields.duration",
        );

      case "cost":
      case "currency":
      case "costSource":
        return t(
          "tronityCharging.fields.cost",
        );

      case "notes":
        return t(
          "tronityCharging.fields.notes",
        );

      default:
        return field;
    }
  }

  const canSubmit =
    file != null &&
    vehicleId !== "" &&
    !busy;

  return (
    <div className="mt-5 space-y-5">
      {vehicles.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t(
            "tronityCharging.errors.noVehicles",
          )}
        </p>
      ) : (
        <div>
          <label
            htmlFor="tronity-vehicle"
            className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400"
          >
            {t(
              "tronityCharging.vehicle",
            )}
          </label>

          <select
            id="tronity-vehicle"
            value={vehicleId}
            disabled={busy}
            onChange={(event) => {
              setVehicleId(
                event.target.value,
              );

              setPreview(null);
              setResult(null);
              setError(null);
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {vehicles.length > 1 && (
              <option value="">
                {t(
                  "tronityCharging.vehiclePlaceholder",
                )}
              </option>
            )}

            {vehicles.map(
              (vehicle) => (
                <option
                  key={vehicle.id}
                  value={vehicle.id}
                >
                  {vehicle.displayName}
                </option>
              ),
            )}
          </select>
        </div>
      )}

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
                  "tronityCharging.selectFile",
                )}
          </span>

          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
            {file
              ? t(
                  "tronityCharging.selected",
                  {
                    size: Math.max(
                      1,
                      Math.round(
                        file.size /
                          1024,
                      ),
                    ),
                  },
                )
              : t(
                  "tronityCharging.fileHint",
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
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              [
                t(
                  "tronityCharging.summary.total",
                ),
                preview.summary.total,
              ],

              [
                t(
                  "tronityCharging.summary.matched",
                ),
                preview.summary.matched,
              ],

              [
                t(
                  "tronityCharging.summary.new",
                ),
                preview.summary
                  .newRecords,
              ],

              [
                t(
                  "tronityCharging.summary.toUpdate",
                ),
                preview.summary.toUpdate,
              ],

              [
                t(
                  "tronityCharging.summary.unchanged",
                ),
                preview.summary
                  .unchanged,
              ],

              [
                t(
                  "tronityCharging.summary.ambiguous",
                ),
                preview.summary
                  .ambiguous,
              ],
            ].map(
              ([label, value]) => (
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
              ),
            )}
          </div>

          {preview.summary
            .ambiguous > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t(
                "tronityCharging.reviewHint",
                {
                  count:
                    preview.summary
                      .ambiguous,
                },
              )}
            </p>
          )}

          <div className="max-h-[32rem] space-y-2 overflow-y-auto">
            {preview.rows.map(
              (row) => (
                <div
                  key={`${row.rowNumber}-${row.startTime}`}
                  className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {row.address ??
                          "—"}
                      </p>

                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        {new Date(
                          row.startTime,
                        ).toLocaleString(
                          [],
                          {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                        {" – "}
                        {new Date(
                          row.endTime,
                        ).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${matchClass(
                        row.matchStatus,
                      )}`}
                    >
                      {matchLabel(
                        row.matchStatus,
                      )}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                    <span>
                      {row.energyKwh !=
                      null
                        ? `${row.energyKwh.toFixed(
                            2,
                          )} kWh`
                        : "— kWh"}
                    </span>

                    <span>
                      {row.startSoc !=
                        null ||
                      row.endSoc != null
                        ? `${row.startSoc ?? "—"} → ${row.endSoc ?? "—"} %`
                        : "— %"}
                    </span>

                    <span>
                      {row.cost != null
                        ? `${row.cost.toFixed(
                            2,
                          )} €`
                        : "— €"}
                    </span>

                    <span>
                      {row.chargerType
                        ? row.chargerType.toUpperCase()
                        : "—"}
                    </span>
                  </div>

                  {row.matchStatus ===
                    "unmatched" && (
                    <p className="mt-2 text-xs font-medium text-sky-700 dark:text-sky-300">
                      {t(
                        "tronityCharging.actions.newRecord",
                      )}
                    </p>
                  )}

                  {row.matchStatus ===
                    "ambiguous" && (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                      {t(
                        "tronityCharging.actions.skipped",
                      )}
                    </p>
                  )}

                  {row.matchStatus ===
                    "matched" &&
                    row.changes.length ===
                      0 && (
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {t(
                          "tronityCharging.actions.noChange",
                        )}
                      </p>
                    )}

                  {row.matchStatus ===
                    "matched" &&
                    row.changes.length >
                      0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          {t(
                            "tronityCharging.changes",
                          )}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {[
                            ...new Set(
                              row.changes.map(
                                changeLabel,
                              ),
                            ),
                          ].map(
                            (label) => (
                              <span
                                key={
                                  label
                                }
                                className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                              >
                                {label}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ),
            )}
          </div>

          {preview.truncated && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t(
                "tronityCharging.previewTruncated",
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
              "tronityCharging.completed",
              {
                inserted:
                  result.summary
                    .inserted ?? 0,

                updated:
                  result.summary
                    .updated ?? 0,

                unchanged:
                  result.summary
                    .unchanged ?? 0,

                skipped:
                  result.summary
                    .skippedAmbiguous ??
                  0,
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
            disabled={!canSubmit}
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
              "tronityCharging.check",
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
              "tronityCharging.import",
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
              "tronityCharging.reset",
            )}
          </button>
        )}
      </div>
    </div>
  );
}
