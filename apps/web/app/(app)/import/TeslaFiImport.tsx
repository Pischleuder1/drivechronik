"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Search,
  Upload,
  XCircle,
} from "lucide-react";

import {
  buttonClasses,
} from "../../../components/ui/Button";

type Vehicle = {
  id: number;
  displayName: string;
};

type DistanceUnit =
  | "metric"
  | "imperial";

type Capabilities = {
  gps: boolean;
  speed: boolean;
  odometer: boolean;
  soc: boolean;
  charging: boolean;
  shiftState: boolean;
  vehicleState: boolean;
  climate: boolean;
  tpms: boolean;
  navigation: boolean;
  vehicleIdentity: boolean;
};

type Preview = {
  recognized: boolean;

  headerCount: number;
  knownHeaderCount: number;

  unknownHeaders: string[];
  missingKnownHeaders: string[];
  missingRequiredHeaders: string[];

  rowCount: number;
  validRows: number;
  invalidRows: number;

  minDateTime: string | null;
  maxDateTime: string | null;

  vehicleIds: string[];
  displayNames: string[];
  dateFormats: string[];

  gpsRows: number;
  movingRows: number;
  chargingRows: number;

  driveEpisodes: Array<{
    startDateTime: string;
    endDateTime: string;
    distanceKm: number | null;
    sampleCount: number;
  }>;

  chargeEpisodes: Array<{
    startDateTime: string;
    endDateTime: string;
    startSoc: number | null;
    endSoc: number | null;
    maxPowerKw: number | null;
    sampleCount: number;
  }>;

  timePreview: {
    timeZone: string;
    validTimeZone: boolean;
    convertedRows: number;
    invalidRows: number;
    ambiguousRows: number;
    minUtcIso: string | null;
    maxUtcIso: string | null;
  } | null;

  capabilities: Capabilities;
};

type ExistingConflict = {
  id: number;
  source: string;
  startMs: number;
  endMs: number | null;
};

type EpisodeConflict = {
  index: number;
  startDateTime: string;
  endDateTime: string;
  startUtc: string | null;
  endUtc: string | null;
  timeError: boolean;
  conflict: boolean;
  existing: ExistingConflict[];
};

type ConflictSummary = {
  total: number;
  new: number;
  conflicts: number;
  timeErrors: number;
};

type ImportBlockReason =
  | "unrecognized_file"
  | "invalid_timezone"
  | "invalid_rows"
  | "invalid_times"
  | "ambiguous_times";

type PreviewResponse = {
  mode: "preview";
  dryRun: true;

  file: {
    name: string | null;
    size: number;
  };

  vehicle: Vehicle;
  timezone: string;
  distanceUnit: DistanceUnit;

  importable: boolean;
  blockedBy: ImportBlockReason[];

  preview: Preview;

  conflicts: {
    drives: EpisodeConflict[];
    charges: EpisodeConflict[];

    summary: {
      drives: ConflictSummary;
      charges: ConflictSummary;
    };
  };
};

type ImportResponse = {
  mode: "import";
  imported: true;

  importRunId: number;

  vehicle: Vehicle;

  file: {
    name: string | null;
    size: number;
  };

  summary: {
    sourceRows: number;
    timezone: string;
    distanceUnit: DistanceUnit;

    inserted: {
      drives: number;
      routePoints: number;
      charges: number;
      chargePoints: number;
    };

    skipped: {
      driveConflicts: number;
      chargeConflicts: number;
      existingDrives: number;
      existingCharges: number;
    };
  };
};

function sourceLabel(
  source: string,
): string {
  switch (source) {
    case "teslamate":
      return "TeslaMate";
    case "tessie":
      return "Tessie";
    case "teslafi":
      return "TeslaFi";
    default:
      return source;
  }
}

function importBlockReasonKey(
  reason: ImportBlockReason,
):
  | "teslafi.importability.reasons.unrecognizedFile"
  | "teslafi.importability.reasons.invalidTimezone"
  | "teslafi.importability.reasons.invalidRows"
  | "teslafi.importability.reasons.invalidTimes"
  | "teslafi.importability.reasons.ambiguousTimes" {
  switch (reason) {
    case "unrecognized_file":
      return "teslafi.importability.reasons.unrecognizedFile";

    case "invalid_timezone":
      return "teslafi.importability.reasons.invalidTimezone";

    case "invalid_rows":
      return "teslafi.importability.reasons.invalidRows";

    case "invalid_times":
      return "teslafi.importability.reasons.invalidTimes";

    case "ambiguous_times":
      return "teslafi.importability.reasons.ambiguousTimes";
  }
}

function conflictSources(
  conflict: EpisodeConflict | undefined,
): string {
  if (!conflict) return "";

  return [
    ...new Set(
      conflict.existing.map(
        (item) =>
          sourceLabel(item.source),
      ),
    ),
  ].join(", ");
}

interface Props {
  vehicles: Vehicle[];
}

export function TeslaFiImport({
  vehicles,
}: Props) {
  const t = useTranslations("import");
  const router = useRouter();

  const [vehicleId, setVehicleId] =
    useState(
      vehicles.length === 1
        ? String(vehicles[0]!.id)
        : "",
    );

  const [timezone, setTimezone] =
    useState("Europe/Berlin");

  const [distanceUnit, setDistanceUnit] =
    useState<DistanceUnit>("metric");

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<PreviewResponse | null>(null);

  const [result, setResult] =
    useState<ImportResponse | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function checkFile() {
    if (!file || !vehicleId) {
      return;
    }

    setBusy(true);
    setError(null);
    setPreview(null);
    setResult(null);

    try {
      const form = new FormData();

      form.set("file", file);
      form.set("vehicleId", vehicleId);
      form.set("timezone", timezone);
      form.set(
        "distanceUnit",
        distanceUnit,
      );

      const response = await fetch(
        "/api/import/teslafi/preview",
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
                "teslafi.errors.unknown",
              ),
        );
      }

      setPreview(
        body as PreviewResponse,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "teslafi.errors.unknown",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function importFile() {
    if (
      !file ||
      !vehicleId ||
      !preview?.importable
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();

      form.set("file", file);
      form.set(
        "vehicleId",
        vehicleId,
      );
      form.set(
        "timezone",
        timezone,
      );
      form.set(
        "distanceUnit",
        distanceUnit,
      );

      const response = await fetch(
        "/api/import/teslafi",
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
          typeof body.error ===
            "string"
            ? body.error
            : t(
                "teslafi.errors.unknown",
              ),
        );
      }

      if (
        !body ||
        body.mode !== "import" ||
        body.imported !== true
      ) {
        throw new Error(
          t(
            "teslafi.errors.unknown",
          ),
        );
      }

      setResult(
        body as ImportResponse,
      );

      setPreview(null);

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              "teslafi.errors.unknown",
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

  const capabilityRows: Array<
    [keyof Capabilities, string]
  > = [
    ["gps", t("teslafi.capabilities.gps")],
    ["speed", t("teslafi.capabilities.speed")],
    [
      "odometer",
      t("teslafi.capabilities.odometer"),
    ],
    ["soc", t("teslafi.capabilities.soc")],
    [
      "charging",
      t("teslafi.capabilities.charging"),
    ],
    [
      "shiftState",
      t("teslafi.capabilities.shiftState"),
    ],
    [
      "vehicleState",
      t("teslafi.capabilities.vehicleState"),
    ],
    [
      "climate",
      t("teslafi.capabilities.climate"),
    ],
    [
      "tpms",
      t("teslafi.capabilities.tpms"),
    ],
    [
      "navigation",
      t("teslafi.capabilities.navigation"),
    ],
    [
      "vehicleIdentity",
      t(
        "teslafi.capabilities.vehicleIdentity",
      ),
    ],
  ];

  const newEpisodeCount =
    preview == null
      ? 0
      : preview.conflicts.summary.drives.new +
        preview.conflicts.summary.charges.new;

  const skippedCount =
    result == null
      ? 0
      : result.summary.skipped
          .driveConflicts +
        result.summary.skipped
          .chargeConflicts +
        result.summary.skipped
          .existingDrives +
        result.summary.skipped
          .existingCharges;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {t("teslafi.vehicle")}
          </span>

          <select
            value={vehicleId}
            disabled={busy}
            onChange={(event) => {
              setVehicleId(
                event.target.value,
              );
              setPreview(null);
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">
              {t(
                "teslafi.vehiclePlaceholder",
              )}
            </option>

            {vehicles.map((vehicle) => (
              <option
                key={vehicle.id}
                value={vehicle.id}
              >
                {vehicle.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {t("teslafi.timezone")}
          </span>

          <input
            type="text"
            value={timezone}
            disabled={busy}
            onChange={(event) => {
              setTimezone(
                event.target.value,
              );
              setPreview(null);
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {t("teslafi.distanceUnit")}
          </span>

          <select
            value={distanceUnit}
            disabled={busy}
            onChange={(event) => {
              setDistanceUnit(
                event.target.value as DistanceUnit,
              );
              setPreview(null);
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="metric">
              {t("teslafi.units.metric")}
            </option>

            <option value="imperial">
              {t("teslafi.units.imperial")}
            </option>
          </select>
        </label>
      </div>

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
                  "teslafi.selectFile",
                )}
          </span>

          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
            {file
              ? t(
                  "teslafi.selected",
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
                  "teslafi.fileHint",
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
            setError(null);
          }}
        />
      </label>

      {preview && (
        <>
          <div
            className={
              preview.preview.recognized
                ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"
                : "rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40"
            }
          >
            <div className="flex items-start gap-2">
              {preview.preview.recognized ? (
                <CheckCircle2
                  aria-hidden
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
              ) : (
                <XCircle
                  aria-hidden
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
              )}

              <div>
                <p className="font-medium">
                  {preview.preview.recognized
                    ? t(
                        "teslafi.recognized",
                      )
                    : t(
                        "teslafi.notRecognized",
                      )}
                </p>

                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {t("teslafi.dryRun")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [
                t(
                  "teslafi.summary.headers",
                ),
                preview.preview
                  .headerCount,
              ],
              [
                t(
                  "teslafi.summary.knownHeaders",
                ),
                preview.preview
                  .knownHeaderCount,
              ],
              [
                t(
                  "teslafi.summary.rows",
                ),
                preview.preview
                  .rowCount,
              ],
              [
                t(
                  "teslafi.summary.validRows",
                ),
                preview.preview
                  .validRows,
              ],
              [
                t(
                  "teslafi.summary.invalidRows",
                ),
                preview.preview
                  .invalidRows,
              ],
              [
                t(
                  "teslafi.summary.gpsRows",
                ),
                preview.preview
                  .gpsRows,
              ],
              [
                t(
                  "teslafi.summary.movingRows",
                ),
                preview.preview
                  .movingRows,
              ],
              [
                t(
                  "teslafi.summary.chargingRows",
                ),
                preview.preview
                  .chargingRows,
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

          <div
            className={`rounded-xl border p-4 ${
              preview.importable
                ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
                : "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30"
            }`}
          >
            <div className="flex items-start gap-3">
              {preview.importable ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
              )}

              <div className="min-w-0">
                <p
                  className={`font-medium ${
                    preview.importable
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-red-900 dark:text-red-200"
                  }`}
                >
                  {preview.importable
                    ? t(
                        "teslafi.importability.allowed",
                      )
                    : t(
                        "teslafi.importability.blocked",
                      )}
                </p>

                <p
                  className={`mt-1 text-sm ${
                    preview.importable
                      ? "text-emerald-800 dark:text-emerald-300"
                      : "text-red-800 dark:text-red-300"
                  }`}
                >
                  {preview.importable
                    ? t(
                        "teslafi.importability.allowedDescription",
                      )
                    : t(
                        "teslafi.importability.blockedDescription",
                      )}
                </p>

                {!preview.importable &&
                preview.blockedBy.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-800 dark:text-red-300">
                    {preview.blockedBy.map(
                      (reason) => (
                        <li key={reason}>
                          {t(
                            importBlockReasonKey(
                              reason,
                            ),
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="font-medium">
              {t(
                "teslafi.conflictCheck.title",
              )}
            </h3>

            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t(
                "teslafi.conflictCheck.description",
              )}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                [
                  t(
                    "teslafi.conflictCheck.drives",
                  ),
                  preview.conflicts.summary.drives,
                ],
                [
                  t(
                    "teslafi.conflictCheck.charges",
                  ),
                  preview.conflicts.summary.charges,
                ],
              ].map(([label, rawSummary]) => {
                const summary =
                  rawSummary as ConflictSummary;

                return (
                  <div
                    key={String(label)}
                    className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/60"
                  >
                    <p className="text-sm font-medium">
                      {String(label)}
                    </p>

                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      {[
                        [
                          t(
                            "teslafi.conflictCheck.total",
                          ),
                          summary.total,
                          "",
                        ],
                        [
                          t(
                            "teslafi.conflictCheck.new",
                          ),
                          summary.new,
                          "text-emerald-700 dark:text-emerald-400",
                        ],
                        [
                          t(
                            "teslafi.conflictCheck.conflicts",
                          ),
                          summary.conflicts,
                          "text-red-700 dark:text-red-400",
                        ],
                        [
                          t(
                            "teslafi.conflictCheck.timeErrors",
                          ),
                          summary.timeErrors,
                          "text-amber-700 dark:text-amber-400",
                        ],
                      ].map(
                        ([
                          itemLabel,
                          value,
                          valueClass,
                        ]) => (
                          <div
                            key={String(
                              itemLabel,
                            )}
                          >
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {String(
                                itemLabel,
                              )}
                            </p>
                            <p
                              className={`mt-1 font-semibold tabular-nums ${String(
                                valueClass,
                              )}`}
                            >
                              {Number(value)}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">
                  {t("teslafi.episodes.drives")}
                </h3>

                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold tabular-nums dark:bg-neutral-800">
                  {preview.preview.driveEpisodes.length}
                </span>
              </div>

              {preview.preview.driveEpisodes.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  {t("teslafi.episodes.none")}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {preview.preview.driveEpisodes.map(
                    (episode, index) => (
                      <div
                        key={`${episode.startDateTime}-${index}`}
                        className="rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/60"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {t(
                              "teslafi.episodes.drive",
                              {
                                number: index + 1,
                              },
                            )}
                          </p>

                          {preview.conflicts.drives[index]?.timeError ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t(
                                "teslafi.conflictCheck.statusTimeError",
                              )}
                            </span>
                          ) : preview.conflicts.drives[index]?.conflict ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                              {t(
                                "teslafi.conflictCheck.statusConflict",
                                {
                                  source:
                                    conflictSources(
                                      preview.conflicts.drives[
                                        index
                                      ],
                                    ),
                                },
                              )}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {t(
                                "teslafi.conflictCheck.statusNew",
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {episode.startDateTime}
                          {" – "}
                          {episode.endDateTime}
                        </p>

                        {episode.distanceKm != null && (
                          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                            {t(
                              "teslafi.episodes.distance",
                              {
                                distance:
                                  episode.distanceKm.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    },
                                  ),
                              },
                            )}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">
                  {t("teslafi.episodes.charges")}
                </h3>

                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold tabular-nums dark:bg-neutral-800">
                  {preview.preview.chargeEpisodes.length}
                </span>
              </div>

              {preview.preview.chargeEpisodes.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  {t("teslafi.episodes.none")}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {preview.preview.chargeEpisodes.map(
                    (episode, index) => (
                      <div
                        key={`${episode.startDateTime}-${index}`}
                        className="rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/60"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {t(
                              "teslafi.episodes.charge",
                              {
                                number: index + 1,
                              },
                            )}
                          </p>

                          {preview.conflicts.charges[index]?.timeError ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t(
                                "teslafi.conflictCheck.statusTimeError",
                              )}
                            </span>
                          ) : preview.conflicts.charges[index]?.conflict ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                              {t(
                                "teslafi.conflictCheck.statusConflict",
                                {
                                  source:
                                    conflictSources(
                                      preview.conflicts.charges[
                                        index
                                      ],
                                    ),
                                },
                              )}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {t(
                                "teslafi.conflictCheck.statusNew",
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {episode.startDateTime}
                          {" – "}
                          {episode.endDateTime}
                        </p>

                        {(episode.startSoc != null ||
                          episode.endSoc != null) && (
                          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                            {t(
                              "teslafi.episodes.soc",
                              {
                                start:
                                  episode.startSoc ??
                                  "—",
                                end:
                                  episode.endSoc ??
                                  "—",
                              },
                            )}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t(
                    "teslafi.period",
                  )}
                </dt>

                <dd className="mt-1 font-medium">
                  {preview.preview
                    .minDateTime ?? "—"}
                  {" – "}
                  {preview.preview
                    .maxDateTime ?? "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t(
                    "teslafi.utcPeriod",
                  )}
                </dt>

                <dd className="mt-1 font-medium">
                  {preview.preview.timePreview?.minUtcIso
                    ? preview.preview.timePreview.minUtcIso
                    : "—"}
                  {" – "}
                  {preview.preview.timePreview?.maxUtcIso
                    ? preview.preview.timePreview.maxUtcIso
                    : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t(
                    "teslafi.targetVehicle",
                  )}
                </dt>

                <dd className="mt-1 font-medium">
                  {
                    preview.vehicle
                      .displayName
                  }
                </dd>
              </div>

              <div>
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t(
                    "teslafi.timezone",
                  )}
                </dt>

                <dd className="mt-1 font-medium">
                  {preview.timezone}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t(
                    "teslafi.sourceVehicle",
                  )}
                </dt>

                <dd className="mt-1 font-medium">
                  {[
                    ...preview.preview
                      .displayNames,
                    ...preview.preview
                      .vehicleIds,
                  ].join(" · ") || "—"}
                </dd>
              </div>
            </dl>
          </div>

          {preview.preview.timePreview &&
            (preview.preview.timePreview.invalidRows > 0 ||
              preview.preview.timePreview.ambiguousRows > 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {preview.preview.timePreview.invalidRows > 0 && (
                  <p>
                    {t(
                      "teslafi.timeWarnings.invalid",
                      {
                        count:
                          preview.preview.timePreview.invalidRows,
                      },
                    )}
                  </p>
                )}

                {preview.preview.timePreview.ambiguousRows > 0 && (
                  <p>
                    {t(
                      "teslafi.timeWarnings.ambiguous",
                      {
                        count:
                          preview.preview.timePreview.ambiguousRows,
                      },
                    )}
                  </p>
                )}
              </div>
            )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {capabilityRows.map(
              ([key, label]) => {
                const available =
                  preview.preview
                    .capabilities[key];

                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                  >
                    {available ? (
                      <CheckCircle2
                        aria-hidden
                        size={16}
                        className="text-emerald-600"
                      />
                    ) : (
                      <XCircle
                        aria-hidden
                        size={16}
                        className="text-neutral-400"
                      />
                    )}

                    <span>
                      {label}
                    </span>
                  </div>
                );
              },
            )}
          </div>

          {preview.preview
            .unknownHeaders.length >
            0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t(
                "teslafi.unknownHeaders",
                {
                  headers:
                    preview.preview
                      .unknownHeaders
                      .join(", "),
                },
              )}
            </p>
          )}

          {preview.preview
            .missingRequiredHeaders
            .length > 0 && (
            <p className="text-sm text-red-700 dark:text-red-300">
              {t(
                "teslafi.missingRequiredHeaders",
                {
                  headers:
                    preview.preview
                      .missingRequiredHeaders
                      .join(", "),
                },
              )}
            </p>
          )}
        </>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-start gap-2">
            <CheckCircle2
              aria-hidden
              size={17}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-medium">
                {t(
                  "teslafi.completed",
                  {
                    drives:
                      result.summary
                        .inserted.drives,

                    charges:
                      result.summary
                        .inserted.charges,
                  },
                )}
              </p>

              {skippedCount > 0 && (
                <p className="mt-1 text-xs">
                  {t(
                    "teslafi.completedSkipped",
                    {
                      count:
                        skippedCount,
                    },
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
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
            disabled={
              busy ||
              !file ||
              !vehicleId ||
              timezone.trim() === ""
            }
            onClick={() =>
              void checkFile()
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
              <Search
                aria-hidden
                size={16}
              />
            )}

            {t("teslafi.check")}
          </button>
        )}

        {preview &&
          !result &&
          preview.importable &&
          newEpisodeCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void importFile()
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

            {busy
              ? t(
                  "teslafi.importing",
                )
              : t(
                  "teslafi.import",
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
            {t("teslafi.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
