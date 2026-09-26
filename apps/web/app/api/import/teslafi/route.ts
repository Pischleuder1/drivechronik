import {
  and,
  eq,
  gte,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  NextResponse,
} from "next/server";

import {
  getTranslations,
} from "next-intl/server";

import {
  chargePoints,
  chargeSessions,
  completeImportRun,
  createImportRun,
  drives,
  failImportRun,
  recordImportChange,
  routePoints,
  vehicles,
} from "@drivechronik/db";

import {
  buildTeslaFiImportPlan,
  findTeslaFiIntervalConflicts,
  parseTeslaFiNormalizedCsv,
  previewTeslaFiCsv,
  type TeslaFiExistingInterval,
} from "@drivechronik/core";

import {
  db,
} from "../../../../lib/db";

import {
  validateSession,
} from "../../../../lib/auth/session";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES =
  100 * 1024 * 1024;

type DistanceUnit =
  | "metric"
  | "imperial";

type ImportBlockReason =
  | "unrecognized_file"
  | "invalid_timezone"
  | "invalid_rows"
  | "invalid_times"
  | "ambiguous_times";

function validTimeZone(
  value: string,
): boolean {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: value,
      },
    ).format();

    return true;
  } catch {
    return false;
  }
}

function importBlockReasons(
  preview:
    ReturnType<
      typeof previewTeslaFiCsv
    >,
): ImportBlockReason[] {
  const blockedBy:
    ImportBlockReason[] = [];

  if (!preview.recognized) {
    blockedBy.push(
      "unrecognized_file",
    );
  }

  if (preview.invalidRows > 0) {
    blockedBy.push(
      "invalid_rows",
    );
  }

  if (
    preview.timePreview == null ||
    !preview.timePreview.validTimeZone
  ) {
    blockedBy.push(
      "invalid_timezone",
    );
  } else {
    if (
      preview.timePreview.invalidRows > 0
    ) {
      blockedBy.push(
        "invalid_times",
      );
    }

    if (
      preview.timePreview
        .ambiguousRows > 0
    ) {
      blockedBy.push(
        "ambiguous_times",
      );
    }
  }

  return blockedBy;
}

function existingIntervals(
  rows: Array<{
    id: number;
    source: string;
    startTime: Date;
    endTime: Date | null;
  }>,
): TeslaFiExistingInterval[] {
  return rows.map(
    (row) => ({
      id: row.id,
      source: row.source,
      startMs:
        row.startTime.getTime(),
      endMs:
        row.endTime == null
          ? null
          : row.endTime.getTime(),
    }),
  );
}

function persistentSourceId(
  vehicleId: number,
  sourceId: string,
): string {
  /*
   * drives/charge_sessions haben einen
   * globalen UNIQUE-Key auf source/sourceId.
   *
   * Deshalb gehört das DriveChronik-
   * Zielfahrzeug in die persistierte ID.
   */
  return [
    "vehicle",
    vehicleId,
    sourceId,
  ].join(":");
}

export async function POST(
  request: Request,
) {
  const t =
    await getTranslations("import");

  const user =
    await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error:
          t(
            "apiErrors.notAuthenticated",
          ),
      },
      {
        status: 401,
      },
    );
  }

  let importRunId:
    number | null = null;

  try {
    const form =
      await request.formData();

    const file =
      form.get("file");

    const vehicleIdRaw =
      form.get("vehicleId");

    const timezoneRaw =
      form.get("timezone");

    const distanceUnitRaw =
      form.get("distanceUnit");

    if (
      !file ||
      typeof file !== "object" ||
      !("arrayBuffer" in file)
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.errors.selectFile",
            ),
        },
        {
          status: 400,
        },
      );
    }

    const size =
      "size" in file &&
      typeof file.size === "number"
        ? file.size
        : 0;

    if (
      size > MAX_FILE_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.errors.fileTooLarge",
            ),
        },
        {
          status: 413,
        },
      );
    }

    const vehicleId =
      Number(
        typeof vehicleIdRaw ===
          "string"
          ? vehicleIdRaw
          : "",
      );

    if (
      !Number.isInteger(
        vehicleId,
      ) ||
      vehicleId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.errors.vehicleRequired",
            ),
        },
        {
          status: 400,
        },
      );
    }

    const timezone =
      typeof timezoneRaw ===
        "string"
        ? timezoneRaw.trim()
        : "";

    if (
      timezone.length === 0 ||
      !validTimeZone(timezone)
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.errors.invalidTimezone",
            ),
        },
        {
          status: 400,
        },
      );
    }

    const distanceUnit:
      DistanceUnit | null =
      distanceUnitRaw ===
        "metric" ||
      distanceUnitRaw ===
        "imperial"
        ? distanceUnitRaw
        : null;

    if (!distanceUnit) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.errors.invalidDistanceUnit",
            ),
        },
        {
          status: 400,
        },
      );
    }

    const vehicleRows =
      await db
        .select({
          id: vehicles.id,
          displayName:
            vehicles.displayName,
        })
        .from(vehicles)
        .where(
          eq(
            vehicles.id,
            vehicleId,
          ),
        )
        .limit(1);

    const vehicle =
      vehicleRows[0];

    if (!vehicle) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.errors.vehicleNotFound",
            ),
        },
        {
          status: 404,
        },
      );
    }

    const bytes =
      await file.arrayBuffer();

    const csvText =
      Buffer
        .from(bytes)
        .toString("utf8");

    /*
     * Der Import vertraut NICHT auf eine
     * vorherige Browser-Preview.
     *
     * Alle Sicherheitsprüfungen werden
     * serverseitig erneut ausgeführt.
     */
    const preview =
      previewTeslaFiCsv(
        csvText,
        {
          timeZone: timezone,
          distanceUnit,
        },
      );

    const blockedBy =
      importBlockReasons(
        preview,
      );

    if (
      blockedBy.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.importability.blocked",
            ),
          blockedBy,
        },
        {
          status: 400,
        },
      );
    }

    const parsed =
      parseTeslaFiNormalizedCsv(
        csvText,
        {
          timeZone: timezone,
          distanceUnit,
        },
      );

    if (
      parsed.invalidRows > 0 ||
      parsed
        .missingRequiredHeaders
        .length > 0
    ) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.importability.blocked",
            ),
          blockedBy: [
            "invalid_rows",
          ],
        },
        {
          status: 400,
        },
      );
    }

    const plan =
      buildTeslaFiImportPlan(
        parsed.rows,
      );

    if (!plan.importable) {
      return NextResponse.json(
        {
          error:
            t(
              "teslafi.importability.blocked",
            ),
          blockedBy: [
            "invalid_times",
          ],
        },
        {
          status: 400,
        },
      );
    }

    const fileName =
      "name" in file &&
      typeof file.name ===
        "string"
        ? file.name
        : null;

    /*
     * Der Run wird bewusst vor der
     * Datentransaktion angelegt.
     *
     * Schlägt die eigentliche Transaktion
     * fehl, können wir diesen Run danach
     * noch als "failed" markieren.
     */
    importRunId =
      await createImportRun(
        db,
        {
          source: "teslafi",
          vehicleId,
          fileName,
          createdBy:
            user.username,
        },
      );

    const result =
      await db.transaction(
        async (tx) => {
          /*
           * TeslaFi-Importe desselben
           * Zielfahrzeugs werden
           * serialisiert.
           */
          await tx.execute(sql`
            select pg_advisory_xact_lock(
              5443461,
              ${vehicleId}
            )
          `);

          const allIntervals = [
            ...plan.drives.map(
              (drive) => ({
                startMs:
                  drive.startTs,
                endMs:
                  drive.endTs,
              }),
            ),
            ...plan.charges.map(
              (charge) => ({
                startMs:
                  charge.startTs,
                endMs:
                  charge.endTs,
              }),
            ),
          ];

          let existingDriveRows:
            Array<{
              id: number;
              source: string;
              startTime: Date;
              endTime:
                Date | null;
            }> = [];

          let existingChargeRows:
            Array<{
              id: number;
              source: string;
              startTime: Date;
              endTime:
                Date | null;
            }> = [];

          if (
            allIntervals.length > 0
          ) {
            const minMs =
              Math.min(
                ...allIntervals.map(
                  (item) =>
                    item.startMs,
                ),
              );

            const maxMs =
              Math.max(
                ...allIntervals.map(
                  (item) =>
                    item.endMs,
                ),
              );

            const rangeStart =
              new Date(minMs);

            const rangeEnd =
              new Date(maxMs);

            [
              existingDriveRows,
              existingChargeRows,
            ] =
              await Promise.all([
                tx
                  .select({
                    id:
                      drives.id,
                    source:
                      drives.source,
                    startTime:
                      drives.startTime,
                    endTime:
                      drives.endTime,
                  })
                  .from(drives)
                  .where(
                    and(
                      eq(
                        drives.vehicleId,
                        vehicleId,
                      ),
                      lte(
                        drives.startTime,
                        rangeEnd,
                      ),
                      or(
                        isNull(
                          drives.endTime,
                        ),
                        gte(
                          drives.endTime,
                          rangeStart,
                        ),
                      ),
                    ),
                  ),

                tx
                  .select({
                    id:
                      chargeSessions.id,
                    source:
                      chargeSessions.source,
                    startTime:
                      chargeSessions.startTime,
                    endTime:
                      chargeSessions.endTime,
                  })
                  .from(
                    chargeSessions,
                  )
                  .where(
                    and(
                      eq(
                        chargeSessions
                          .vehicleId,
                        vehicleId,
                      ),
                      lte(
                        chargeSessions
                          .startTime,
                        rangeEnd,
                      ),
                      or(
                        isNull(
                          chargeSessions
                            .endTime,
                        ),
                        gte(
                          chargeSessions
                            .endTime,
                          rangeStart,
                        ),
                      ),
                    ),
                  ),
              ]);
          }

          const driveMatches =
            findTeslaFiIntervalConflicts(
              plan.drives.map(
                (drive) => ({
                  startMs:
                    drive.startTs,
                  endMs:
                    drive.endTs,
                }),
              ),
              existingIntervals(
                existingDriveRows,
              ),
            );

          const chargeMatches =
            findTeslaFiIntervalConflicts(
              plan.charges.map(
                (charge) => ({
                  startMs:
                    charge.startTs,
                  endMs:
                    charge.endTs,
                }),
              ),
              existingIntervals(
                existingChargeRows,
              ),
            );

          let insertedDrives = 0;
          let insertedCharges = 0;

          let insertedRoutePoints = 0;
          let insertedChargePoints = 0;

          let skippedDriveConflicts = 0;
          let skippedChargeConflicts = 0;

          let skippedExistingDrives = 0;
          let skippedExistingCharges = 0;

          for (
            let index = 0;
            index <
            plan.drives.length;
            index += 1
          ) {
            const drive =
              plan.drives[index]!;

            const match =
              driveMatches[index];

            if (
              (
                match?.conflicts
                  .length ?? 0
              ) > 0
            ) {
              skippedDriveConflicts++;
              continue;
            }

            const sourceId =
              persistentSourceId(
                vehicleId,
                drive.sourceId,
              );

            const syncedAt =
              new Date();

            /*
             * Alle Felder aus driveSelection
             * werden explizit gesetzt.
             *
             * Dadurch erkennt der Rollback
             * auch spätere manuelle Änderungen
             * an Klassifikation, Notizen,
             * Places usw.
             */
            const driveValues:
              typeof drives.$inferInsert =
              {
                vehicleId,

                startTime:
                  new Date(
                    drive.startTs,
                  ),

                endTime:
                  new Date(
                    drive.endTs,
                  ),

                startOdometerKm:
                  drive
                    .startOdometerKm,

                endOdometerKm:
                  drive
                    .endOdometerKm,

                distanceKm:
                  drive.distanceKm,

                durationSeconds:
                  drive
                    .durationSeconds,

                startLat:
                  drive.startLat,

                startLon:
                  drive.startLon,

                endLat:
                  drive.endLat,

                endLon:
                  drive.endLon,

                startPlaceId:
                  null,

                endPlaceId:
                  null,

                startPlaceLocked:
                  false,

                endPlaceLocked:
                  false,

                startAddress:
                  null,

                endAddress:
                  null,

                startSoc:
                  drive.startSoc,

                endSoc:
                  drive.endSoc,

                consumedEnergyKwh:
                  null,

                energyIsEstimated:
                  true,

                avgConsumptionWhKm:
                  null,

                ascentM:
                  null,

                descentM:
                  null,

                outsideTempAvg:
                  null,

                insideTempAvg:
                  null,

                speedMaxKmh:
                  drive
                    .speedMaxKmh ==
                  null
                    ? null
                    : Math.round(
                        drive
                          .speedMaxKmh,
                      ),

                powerMaxKw:
                  null,

                powerMinKw:
                  null,

                weatherTempC:
                  null,

                weatherPrecipitationMm:
                  null,

                weatherWindKmh:
                  null,

                weatherCode:
                  null,

                weatherSyncedAt:
                  null,

                classification:
                  "unclassified",

                classifiedByRuleId:
                  null,

                purpose:
                  null,

                customer:
                  null,

                project:
                  null,

                notes:
                  null,

                source:
                  "teslafi",

                sourceId,

                syncedAt,
              };

            const inserted =
              await tx
                .insert(drives)
                .values(
                  driveValues,
                )
                .onConflictDoNothing({
                  target: [
                    drives.source,
                    drives.sourceId,
                  ],
                })
                .returning({
                  id: drives.id,
                });

            const insertedDrive =
              inserted[0];

            if (
              !insertedDrive
            ) {
              skippedExistingDrives++;
              continue;
            }

            if (
              drive.routePoints
                .length > 0
            ) {
              await tx
                .insert(
                  routePoints,
                )
                .values(
                  drive.routePoints.map(
                    (
                      point,
                    ): typeof routePoints.$inferInsert => ({
                      driveId:
                        insertedDrive.id,

                      ts:
                        new Date(
                          point.ts,
                        ),

                      lat:
                        point.lat,

                      lon:
                        point.lon,

                      elevationM:
                        null,

                      speedKmh:
                        point
                          .speedKmh,

                      odometerKm:
                        point
                          .odometerKm,

                      soc:
                        point.soc,
                    }),
                  ),
                );

              insertedRoutePoints +=
                drive
                  .routePoints
                  .length;
            }

            /*
             * Wetterdaten werden nach dem Import
             * vom DriveChronik-Worker ergänzt.
             *
             * Sie gehören deshalb nicht zum
             * Rollback-Snapshot des TeslaFi-
             * Imports. Sonst würde der normale
             * Wetter-Backfill fälschlich als
             * Benutzeränderung gelten.
             */
            const driveAfter: Record<string, unknown> = {
              ...driveValues,
            };

            for (const key of [
              "weatherTempC",
              "weatherPrecipitationMm",
              "weatherWindKmh",
              "weatherCode",
              "weatherSyncedAt",
            ]) {
              delete driveAfter[key];
            }

            await recordImportChange(
              tx,
              {
                importRunId:
                  importRunId!,

                entityType:
                  "drive",

                entityId:
                  insertedDrive.id,

                action:
                  "insert",

                after:
                  driveAfter,
              },
            );

            insertedDrives++;
          }

          for (
            let index = 0;
            index <
            plan.charges.length;
            index += 1
          ) {
            const charge =
              plan.charges[index]!;

            const match =
              chargeMatches[index];

            if (
              (
                match?.conflicts
                  .length ?? 0
              ) > 0
            ) {
              skippedChargeConflicts++;
              continue;
            }

            const sourceId =
              persistentSourceId(
                vehicleId,
                charge.sourceId,
              );

            const syncedAt =
              new Date();

            /*
             * Auch hier entspricht der
             * Snapshot vollständig der
             * chargeSessionSelection des
             * Rollbacks.
             *
             * TeslaFi-Felder, deren Einheit
             * noch nicht sicher definiert
             * ist, werden nicht erfunden.
             */
            const chargeValues:
              typeof chargeSessions.$inferInsert =
              {
                vehicleId,

                startTime:
                  new Date(
                    charge.startTs,
                  ),

                endTime:
                  new Date(
                    charge.endTs,
                  ),

                lat:
                  charge.lat,

                lon:
                  charge.lon,

                placeId:
                  null,

                placeLocked:
                  false,

                address:
                  null,

                startSoc:
                  charge.startSoc,

                endSoc:
                  charge.endSoc,

                energyAddedKwh:
                  charge
                    .energyAddedKwh,

                energyUsedKwh:
                  null,

                maxPowerKw:
                  charge.maxPowerKw,

                avgPowerKw:
                  charge.avgPowerKw,

                chargerType:
                  null,

                outsideTempAvg:
                  null,

                durationSeconds:
                  charge
                    .durationSeconds,

                cost:
                  null,

                currency:
                  null,

                costSource:
                  null,

                notes:
                  null,

                source:
                  "teslafi",

                sourceId,

                syncedAt,
              };

            const inserted =
              await tx
                .insert(
                  chargeSessions,
                )
                .values(
                  chargeValues,
                )
                .onConflictDoNothing({
                  target: [
                    chargeSessions
                      .source,
                    chargeSessions
                      .sourceId,
                  ],
                })
                .returning({
                  id:
                    chargeSessions.id,
                });

            const insertedCharge =
              inserted[0];

            if (
              !insertedCharge
            ) {
              skippedExistingCharges++;
              continue;
            }

            let ownedChargePointIds:
              number[] = [];

            if (
              charge.chargePoints
                .length > 0
            ) {
              const insertedPoints =
                await tx
                  .insert(
                    chargePoints,
                  )
                  .values(
                    charge
                      .chargePoints
                      .map(
                        (
                          point,
                        ): typeof chargePoints.$inferInsert => ({
                          chargeSessionId:
                            insertedCharge.id,

                          ts:
                            new Date(
                              point.ts,
                            ),

                          powerKw:
                            point.powerKw,

                          soc:
                            point.soc,

                          outsideTemp:
                            null,
                        }),
                      ),
                  )
                  .returning({
                    id:
                      chargePoints.id,
                  });

              ownedChargePointIds =
                insertedPoints.map(
                  (point) =>
                    point.id,
                );

              insertedChargePoints +=
                insertedPoints.length;
            }

            const chargeAfter = {
              vehicleId:
                chargeValues.vehicleId,

              startTime:
                chargeValues.startTime,

              endTime:
                chargeValues.endTime,

              lat:
                chargeValues.lat,

              lon:
                chargeValues.lon,

              placeId:
                chargeValues.placeId,

              placeLocked:
                chargeValues.placeLocked,

              address:
                chargeValues.address,

              startSoc:
                chargeValues.startSoc,

              endSoc:
                chargeValues.endSoc,

              energyAddedKwh:
                chargeValues.energyAddedKwh,

              energyUsedKwh:
                chargeValues.energyUsedKwh,

              maxPowerKw:
                chargeValues.maxPowerKw,

              avgPowerKw:
                chargeValues.avgPowerKw,

              chargerType:
                chargeValues.chargerType,

              outsideTempAvg:
                chargeValues.outsideTempAvg,

              durationSeconds:
                chargeValues.durationSeconds,

              cost:
                chargeValues.cost,

              currency:
                chargeValues.currency,

              costSource:
                chargeValues.costSource,

              notes:
                chargeValues.notes,

              source:
                chargeValues.source,

              sourceId:
                chargeValues.sourceId,
            };

            await recordImportChange(
              tx,
              {
                importRunId:
                  importRunId!,

                entityType:
                  "charge_session",

                entityId:
                  insertedCharge.id,

                action:
                  "insert",

                after:
                  chargeAfter,

                metadata: {
                  ownedChargePointIds,
                },
              },
            );

            insertedCharges++;
          }

          const summary = {
            sourceRows:
              parsed.rowCount,

            timezone,
            distanceUnit,

            inserted: {
              drives:
                insertedDrives,

              routePoints:
                insertedRoutePoints,

              charges:
                insertedCharges,

              chargePoints:
                insertedChargePoints,
            },

            skipped: {
              driveConflicts:
                skippedDriveConflicts,

              chargeConflicts:
                skippedChargeConflicts,

              existingDrives:
                skippedExistingDrives,

              existingCharges:
                skippedExistingCharges,
            },
          };

          await completeImportRun(
            tx,
            importRunId!,
            summary,
          );

          return summary;
        },
      );

    return NextResponse.json({
      mode: "import",
      imported: true,

      importRunId,

      vehicle,

      file: {
        name:
          fileName,
        size,
      },

      summary:
        result,
    });
  } catch (error) {
    console.error(
      "[web] TeslaFi-Import fehlgeschlagen",
      error,
    );

    if (
      importRunId != null
    ) {
      try {
        await failImportRun(
          db,
          importRunId,
          error,
        );
      } catch (
        failError
      ) {
        console.error(
          "[web] TeslaFi-Importlauf konnte nicht als fehlgeschlagen markiert werden",
          failError,
        );
      }
    }

    return NextResponse.json(
      {
        error:
          t(
            "teslafi.errors.unknown",
          ),
      },
      {
        status: 500,
      },
    );
  }
}
