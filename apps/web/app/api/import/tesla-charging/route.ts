import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";

import {
  chargeSessions,
  completeImportRun,
  createImportRun,
  places,
  recordImportChange,
  teslaChargingRecords,
  vehicles,
} from "@drivechronik/db";

import { db } from "../../../../lib/db";
import { validateSession } from "../../../../lib/auth/session";
import {
  parseTeslaChargingCsv,
  type TeslaChargingCsvRow,
} from "../../../../lib/teslaChargingCsv";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const MATCH_WINDOW_MS = 20 * 60 * 1000;

type MatchStatus =
  | "matched"
  | "ambiguous"
  | "unmatched"
  | "vehicle_not_found";

type Candidate = {
  id: number;
  startTime: Date;
  energyAddedKwh: number | null;
  energyUsedKwh: number | null;
  address: string | null;
  placeName: string | null;
};

type MatchResult = {
  status: MatchStatus;
  chargeSessionId: number | null;
  timeDiffMinutes: number | null;
};

function normalizeVin(value: string | null): string | null {
  const vin = value?.trim().toUpperCase();
  return vin ? vin : null;
}

function locationTokens(value: string | null): Set<string> {
  if (!value) return new Set();

  const ignored = new Set([
    "germany",
    "deutschland",
    "austria",
    "österreich",
    "switzerland",
    "schweiz",
    "tesla",
    "supercharger",
  ]);

  return new Set(
    value
      .toLocaleLowerCase("de")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(
        (token) =>
          token.length >= 4 &&
          !ignored.has(token),
      ),
  );
}

function hasLocationOverlap(
  teslaLocation: string | null,
  candidate: Candidate,
): boolean {
  const source = locationTokens(teslaLocation);

  if (source.size === 0) return false;

  const target = locationTokens(
    [candidate.placeName, candidate.address]
      .filter(Boolean)
      .join(" "),
  );

  for (const token of source) {
    if (target.has(token)) return true;
  }

  return false;
}

function chooseMatch(
  row: TeslaChargingCsvRow,
  candidates: Candidate[],
): MatchResult {
  const ranked = candidates
    .map((candidate) => {
      const timeDiffMs = Math.abs(
        candidate.startTime.getTime() -
          row.chargeStartTime.getTime(),
      );

      if (timeDiffMs > MATCH_WINDOW_MS) {
        return null;
      }

      const timeDiffMinutes = timeDiffMs / 60000;

      const sessionEnergy =
        candidate.energyUsedKwh ??
        candidate.energyAddedKwh;

      let energyPenalty = 0;

      if (
        row.energyKwh != null &&
        sessionEnergy != null
      ) {
        const diff = Math.abs(
          row.energyKwh - sessionEnergy,
        );

        const tolerance = Math.max(
          8,
          row.energyKwh * 0.25,
        );

        if (diff > tolerance) {
          return null;
        }

        energyPenalty = diff * 0.35;
      }

      const locationBonus = hasLocationOverlap(
        row.siteLocationName,
        candidate,
      )
        ? -1.5
        : 0;

      return {
        candidate,
        timeDiffMinutes,
        score:
          timeDiffMinutes +
          energyPenalty +
          locationBonus,
      };
    })
    .filter(
      (
        value,
      ): value is {
        candidate: Candidate;
        timeDiffMinutes: number;
        score: number;
      } => value !== null,
    )
    .sort((a, b) => a.score - b.score);

  if (ranked.length === 0) {
    return {
      status: "unmatched",
      chargeSessionId: null,
      timeDiffMinutes: null,
    };
  }

  const best = ranked[0]!;
  const second = ranked[1];

  if (
    second &&
    second.score - best.score < 1.25
  ) {
    return {
      status: "ambiguous",
      chargeSessionId: null,
      timeDiffMinutes:
        best.timeDiffMinutes,
    };
  }

  return {
    status: "matched",
    chargeSessionId: best.candidate.id,
    timeDiffMinutes:
      best.timeDiffMinutes,
  };
}

function numericString(
  value: number | null,
): string | null {
  return value == null ? null : value.toFixed(2);
}

const TESLA_ROLLBACK_FIELDS = [
  "chargeSessionId",
  "chargeStartTime",
  "name",
  "vin",
  "model",
  "country",
  "siteLocationName",
  "description",
  "quantityBaseRaw",
  "energyKwh",
  "unitCostBaseRaw",
  "vatRaw",
  "totalExVat",
  "totalIncVat",
  "currency",
  "invoiceNumber",
  "status",
  "invoiceUrl",
  "sourceHash",
  "rawData",
] as const;

function snapshotTeslaChargingRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    TESLA_ROLLBACK_FIELDS.map(
      (field) => [
        field,
        value[field] ?? null,
      ],
    ),
  );
}

function snapshotsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return (
    JSON.stringify(left) ===
    JSON.stringify(right)
  );
}

type TeslaImportErrorCode =
  | "missing_file"
  | "file_too_large"
  | "too_many_rows"
  | "record_create_failed";

class TeslaImportError extends Error {
  constructor(public readonly code: TeslaImportErrorCode) {
    super(code);
    this.name = "TeslaImportError";
  }
}

async function parseRequestFile(
  request: Request,
): Promise<{
  rows: TeslaChargingCsvRow[];
  fileName: string | null;
}> {
  const formData =
    await request.formData();

  const file = formData.get("file");

  if (
    !file ||
    typeof file !== "object" ||
    !("arrayBuffer" in file)
  ) {
    throw new TeslaImportError("missing_file");
  }

  const size =
    "size" in file &&
    typeof file.size === "number"
      ? file.size
      : 0;

  if (size > MAX_FILE_BYTES) {
    throw new TeslaImportError("file_too_large");
  }

  const fileName =
    "name" in file &&
    typeof file.name === "string"
      ? file.name
      : null;

  const bytes =
    await file.arrayBuffer();

  const csvText =
    Buffer.from(bytes).toString("utf8");

  const rows =
    parseTeslaChargingCsv(csvText);

  if (rows.length > MAX_ROWS) {
    throw new TeslaImportError("too_many_rows");
  }

  return {
    rows,
    fileName,
  };
}

export async function POST(request: Request) {
  const t = await getTranslations("import");
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: t("apiErrors.notAuthenticated") },
      { status: 401 },
    );
  }

  try {
    const {
      rows,
      fileName,
    } = await parseRequestFile(request);

    const vehicleRows = await db
      .select({
        id: vehicles.id,
        vin: vehicles.vin,
      })
      .from(vehicles);

    const vehicleByVin = new Map<string, number>();

    for (const vehicle of vehicleRows) {
      const vin = normalizeVin(vehicle.vin);
      if (vin) vehicleByVin.set(vin, vehicle.id);
    }

    const rowsByVehicle = new Map<
      number,
      TeslaChargingCsvRow[]
    >();

    for (const row of rows) {
      const vehicleId = vehicleByVin.get(
        normalizeVin(row.vin) ?? "",
      );

      if (vehicleId == null) continue;

      const current =
        rowsByVehicle.get(vehicleId) ?? [];

      current.push(row);
      rowsByVehicle.set(vehicleId, current);
    }

    const candidatesByVehicle = new Map<
      number,
      Candidate[]
    >();

    for (const [vehicleId, vehicleRowsForImport] of rowsByVehicle) {
      const timestamps =
        vehicleRowsForImport.map((row) =>
          row.chargeStartTime.getTime(),
        );

      const start = new Date(
        Math.min(...timestamps) -
          MATCH_WINDOW_MS,
      );

      const end = new Date(
        Math.max(...timestamps) +
          MATCH_WINDOW_MS,
      );

      const candidates = await db
        .select({
          id: chargeSessions.id,
          startTime: chargeSessions.startTime,
          energyAddedKwh:
            chargeSessions.energyAddedKwh,
          energyUsedKwh:
            chargeSessions.energyUsedKwh,
          address: chargeSessions.address,
          placeName: places.name,
        })
        .from(chargeSessions)
        .leftJoin(
          places,
          eq(chargeSessions.placeId, places.id),
        )
        .where(
          and(
            eq(
              chargeSessions.vehicleId,
              vehicleId,
            ),
            gte(
              chargeSessions.startTime,
              start,
            ),
            lte(
              chargeSessions.startTime,
              end,
            ),
          ),
        )
        .orderBy(
          asc(chargeSessions.startTime),
        );

      candidatesByVehicle.set(
        vehicleId,
        candidates,
      );
    }

    const matches = rows.map((row) => {
      const vehicleId = vehicleByVin.get(
        normalizeVin(row.vin) ?? "",
      );

      if (vehicleId == null) {
        return {
          status:
            "vehicle_not_found" as const,
          chargeSessionId: null,
          timeDiffMinutes: null,
        };
      }

      return chooseMatch(
        row,
        candidatesByVehicle.get(vehicleId) ?? [],
      );
    });

    const hashes = rows.map(
      (row) => row.sourceHash,
    );

    const existingRows =
      hashes.length > 0
        ? await db
            .select({
              sourceHash:
                teslaChargingRecords.sourceHash,
            })
            .from(teslaChargingRecords)
            .where(
              inArray(
                teslaChargingRecords.sourceHash,
                hashes,
              ),
            )
        : [];

    const existingHashes = new Set(
      existingRows.map(
        (row) => row.sourceHash,
      ),
    );

    const preview = rows.map(
      (row, index) => ({
        rowNumber: row.rowNumber,
        chargeStartTime:
          row.chargeStartTime.toISOString(),
        vin: row.vin,
        siteLocationName:
          row.siteLocationName,
        energyKwh: row.energyKwh,
        invoiceNumber:
          row.invoiceNumber,
        totalIncVat:
          row.totalIncVat,
        currency: row.currency,
        status: row.status,
        existing:
          existingHashes.has(row.sourceHash),
        matchStatus:
          matches[index]!.status,
        chargeSessionId:
          matches[index]!.chargeSessionId,
        timeDiffMinutes:
          matches[index]!.timeDiffMinutes,
      }),
    );

    const summary = {
      total: rows.length,
      matched: matches.filter(
        (match) =>
          match.status === "matched",
      ).length,
      ambiguous: matches.filter(
        (match) =>
          match.status === "ambiguous",
      ).length,
      unmatched: matches.filter(
        (match) =>
          match.status === "unmatched",
      ).length,
      vehicleNotFound: matches.filter(
        (match) =>
          match.status ===
          "vehicle_not_found",
      ).length,
      existing: existingHashes.size,
    };

    const mode = new URL(request.url)
      .searchParams.get("mode");

    if (mode !== "import") {
      return NextResponse.json({
        mode: "preview",
        summary,
        rows: preview.slice(0, 100),
        truncated: preview.length > 100,
      });
    }

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    const importedVehicleIds =
      [...rowsByVehicle.keys()];

    const importVehicleId =
      importedVehicleIds.length === 1
        ? importedVehicleIds[0]!
        : null;

    const importRunId =
      await db.transaction(
        async (tx) => {
          /*
           * Manuelle Tesla-CSV-Importe werden
           * serialisiert. So kann zwischen dem
           * Before-Snapshot und dem Upsert kein
           * zweiter Tesla-Import denselben
           * source_hash verändern.
           */
          await tx.execute(sql`
            select pg_advisory_xact_lock(
              441726382
            )
          `);

          const runId =
            await createImportRun(
              tx,
              {
                source:
                  "tesla_charging",
                vehicleId:
                  importVehicleId,
                fileName,
                createdBy:
                  user.username,
              },
            );

          for (
            let index = 0;
            index < rows.length;
            index += 1
          ) {
            const row = rows[index]!;
            const match =
              matches[index]!;

            const values = {
              chargeSessionId:
                match.status ===
                "matched"
                  ? match
                      .chargeSessionId
                  : null,
              chargeStartTime:
                row.chargeStartTime,
              name: row.name,
              vin: row.vin,
              model: row.model,
              country: row.country,
              siteLocationName:
                row.siteLocationName,
              description:
                row.description,
              quantityBaseRaw:
                row.quantityBaseRaw,
              energyKwh:
                row.energyKwh,
              unitCostBaseRaw:
                row.unitCostBaseRaw,
              vatRaw: row.vatRaw,
              totalExVat:
                numericString(
                  row.totalExVat,
                ),
              totalIncVat:
                numericString(
                  row.totalIncVat,
                ),
              currency:
                row.currency,
              invoiceNumber:
                row.invoiceNumber,
              status: row.status,
              invoiceUrl:
                row.invoiceUrl,
              sourceHash:
                row.sourceHash,
              rawData:
                JSON.stringify(
                  row.raw,
                ),
            };

            const existing =
              await tx
                .select()
                .from(
                  teslaChargingRecords,
                )
                .where(
                  eq(
                    teslaChargingRecords
                      .sourceHash,
                    row.sourceHash,
                  ),
                )
                .limit(1);

            const after =
              snapshotTeslaChargingRecord(
                values as unknown as
                  Record<
                    string,
                    unknown
                  >,
              );

            if (existing.length > 0) {
              const current =
                existing[0]!;

              const before =
                snapshotTeslaChargingRecord(
                  current as unknown as
                    Record<
                      string,
                      unknown
                    >,
                );

              if (
                snapshotsEqual(
                  before,
                  after,
                )
              ) {
                unchanged++;
                continue;
              }

              await tx
                .update(
                  teslaChargingRecords,
                )
                .set({
                  ...values,
                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    teslaChargingRecords.id,
                    current.id,
                  ),
                );

              await recordImportChange(
                tx,
                {
                  importRunId:
                    runId,
                  entityType:
                    "tesla_charging_record",
                  entityId:
                    current.id,
                  action:
                    "update",
                  before,
                  after,
                  metadata: {
                    source:
                      "tesla_charging",
                  },
                },
              );

              updated++;
              continue;
            }

            const insertedRows =
              await tx
                .insert(
                  teslaChargingRecords,
                )
                .values({
                  ...values,
                  updatedAt:
                    new Date(),
                })
                .returning({
                  id:
                    teslaChargingRecords.id,
                });

            const insertedRow =
              insertedRows[0];

            if (!insertedRow) {
              throw new TeslaImportError("record_create_failed");
            }

            await recordImportChange(
              tx,
              {
                importRunId:
                  runId,
                entityType:
                  "tesla_charging_record",
                entityId:
                  insertedRow.id,
                action: "insert",
                after,
                metadata: {
                  source:
                    "tesla_charging",
                },
              },
            );

            inserted++;
          }

          await completeImportRun(
            tx,
            runId,
            {
              ...summary,
              inserted,
              updated,
              unchanged,
              newRecords:
                inserted,
              updatedRecords:
                updated,
            },
          );

          return runId;
        },
      );

    return NextResponse.json({
      mode: "import",
      importRunId,
      summary: {
        ...summary,
        inserted,
        updated,
        unchanged,
        newRecords: inserted,
        updatedRecords: updated,
      },
    });

  } catch (error) {
    let message = t("teslaCharging.errors.unknown");

    if (error instanceof TeslaImportError) {
      switch (error.code) {
        case "missing_file":
          message = t("teslaCharging.errors.selectFile");
          break;
        case "file_too_large":
          message = t("teslaCharging.errors.fileTooLarge");
          break;
        case "too_many_rows":
          message = t("teslaCharging.errors.tooManyRows", {
            max: MAX_ROWS,
          });
          break;
        case "record_create_failed":
          message = t("teslaCharging.errors.recordCreateFailed");
          break;
      }
    }

    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
