"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";

import {
  buttonClasses,
} from "../../../components/ui/Button";

type Vehicle = {
  id: number;
  displayName: string;
};

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

  capabilities: Capabilities;
};

type PreviewResponse = {
  mode: "preview";
  dryRun: true;

  file: {
    name: string | null;
    size: number;
  };

  vehicle: Vehicle;
  timezone: string;

  preview: Preview;
};

interface Props {
  vehicles: Vehicle[];
}

export function TeslaFiImport({
  vehicles,
}: Props) {
  const t = useTranslations("import");

  const [vehicleId, setVehicleId] =
    useState(
      vehicles.length === 1
        ? String(vehicles[0]!.id)
        : "",
    );

  const [timezone, setTimezone] =
    useState("Europe/Berlin");

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<PreviewResponse | null>(null);

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

    try {
      const form = new FormData();

      form.set("file", file);
      form.set("vehicleId", vehicleId);
      form.set("timezone", timezone);

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

  function reset() {
    setFile(null);
    setPreview(null);
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

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
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
                        <p className="font-medium">
                          {t(
                            "teslafi.episodes.drive",
                            {
                              number: index + 1,
                            },
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {episode.startDateTime}
                          {" – "}
                          {episode.endDateTime}
                        </p>
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
                        <p className="font-medium">
                          {t(
                            "teslafi.episodes.charge",
                            {
                              number: index + 1,
                            },
                          )}
                        </p>

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
        {!preview && (
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

        {preview && (
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
