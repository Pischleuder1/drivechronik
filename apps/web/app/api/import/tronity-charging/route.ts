import { NextResponse } from "next/server";
import {
  and,
  asc,
  eq,
  gte,
  lte,
} from "drizzle-orm";
import {
  chargeSessions,
  places,
  vehicles,
} from "@drivechronik/db";
import { matchPlace } from "@drivechronik/core";

import { db } from "../../../../lib/db";
import { validateSession } from "../../../../lib/auth/session";
import { APP_TIMEZONE } from "../../../../lib/config";

import {
  parseTronityChargingXlsx,
  type TronityChargingRow,
} from "../../../../lib/tronityChargingXlsx";

import {
  buildTronityMergePatch,
  chooseTronityChargeMatch,
  type TronityChargeCandidate,
} from "../../../../lib/tronityChargingMatch";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const MATCH_WINDOW_MS = 20 * 60 * 1000;

function sourceEnergy(
  row: TronityChargingRow,
): number | null {
  return row.energyKwh ?? row.energyTotalKwh;
}

function sourceId(
  vehicleId: number,
  row: TronityChargingRow,
): string {
  return [
    "charge",
    vehicleId,
    row.startTime.toISOString(),
    row.endTime.toISOString(),
  ].join(":");
}

function errorResponse(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

export async function POST(request: Request) {
  const user = await validateSession();

  if (!user) {
    return errorResponse(
      "Nicht angemeldet.",
      401,
    );
  }

  try {
    const formData =
      await request.formData();

    const file = formData.get("file");

    if (
      !file ||
      typeof file !== "object" ||
      !("arrayBuffer" in file)
    ) {
      throw new Error(
        "Bitte eine TRONITY-XLSX-Datei auswählen.",
      );
    }

    const size =
      "size" in file &&
      typeof file.size === "number"
        ? file.size
        : 0;

    if (size > MAX_FILE_BYTES) {
      throw new Error(
        "Die TRONITY-Datei ist größer als 10 MB.",
      );
    }

    const fileName =
      "name" in file &&
      typeof file.name === "string"
        ? file.name
        : "";

    if (
      fileName &&
      !fileName
        .toLowerCase()
        .endsWith(".xlsx")
    ) {
      throw new Error(
        "Bitte einen TRONITY-Export im XLSX-Format auswählen.",
      );
    }

    const vehicleRows = await db
      .select({
        id: vehicles.id,
        displayName:
          vehicles.displayName,
      })
      .from(vehicles)
      .orderBy(asc(vehicles.id));

    if (vehicleRows.length === 0) {
      throw new Error(
        "Es ist noch kein Fahrzeug in DriveChronik vorhanden.",
      );
    }

    const rawVehicleId =
      formData.get("vehicleId");

    let vehicle:
      | (typeof vehicleRows)[number]
      | undefined;

    if (
      rawVehicleId != null &&
      String(rawVehicleId).trim() !== ""
    ) {
      const vehicleId = Number(
        rawVehicleId,
      );

      if (
        !Number.isInteger(vehicleId) ||
        vehicleId <= 0
      ) {
        throw new Error(
          "Ungültige Fahrzeugauswahl.",
        );
      }

      vehicle = vehicleRows.find(
        (entry) =>
          entry.id === vehicleId,
      );

      if (!vehicle) {
        throw new Error(
          "Das ausgewählte Fahrzeug wurde nicht gefunden.",
        );
      }
    } else if (
      vehicleRows.length === 1
    ) {
      vehicle = vehicleRows[0];
    } else {
      throw new Error(
        "Bitte ein Fahrzeug für den TRONITY-Import auswählen.",
      );
    }

    const buffer = Buffer.from(
      await file.arrayBuffer(),
    );

    const rows =
      await parseTronityChargingXlsx(
        buffer,
        APP_TIMEZONE,
      );

    if (rows.length > MAX_ROWS) {
      throw new Error(
        `Der TRONITY-Export enthält mehr als ${MAX_ROWS} Ladevorgänge.`,
      );
    }

    const firstStart = Math.min(
      ...rows.map((row) =>
        row.startTime.getTime(),
      ),
    );

    const lastStart = Math.max(
      ...rows.map((row) =>
        row.startTime.getTime(),
      ),
    );

    const candidateRows = await db
      .select({
        id: chargeSessions.id,

        startTime:
          chargeSessions.startTime,

        endTime:
          chargeSessions.endTime,

        lat: chargeSessions.lat,
        lon: chargeSessions.lon,

        placeId:
          chargeSessions.placeId,

        placeLocked:
          chargeSessions.placeLocked,

        address:
          chargeSessions.address,

        startSoc:
          chargeSessions.startSoc,

        endSoc:
          chargeSessions.endSoc,

        energyAddedKwh:
          chargeSessions.energyAddedKwh,

        energyUsedKwh:
          chargeSessions.energyUsedKwh,

        maxPowerKw:
          chargeSessions.maxPowerKw,

        chargerType:
          chargeSessions.chargerType,

        durationSeconds:
          chargeSessions.durationSeconds,

        cost: chargeSessions.cost,

        currency:
          chargeSessions.currency,

        costSource:
          chargeSessions.costSource,

        notes: chargeSessions.notes,

        source:
          chargeSessions.source,

        sourceId:
          chargeSessions.sourceId,
      })
      .from(chargeSessions)
      .where(
        and(
          eq(
            chargeSessions.vehicleId,
            vehicle.id,
          ),
          gte(
            chargeSessions.startTime,
            new Date(
              firstStart -
                MATCH_WINDOW_MS,
            ),
          ),
          lte(
            chargeSessions.startTime,
            new Date(
              lastStart +
                MATCH_WINDOW_MS,
            ),
          ),
        ),
      )
      .orderBy(
        asc(chargeSessions.startTime),
      );

    const candidates: TronityChargeCandidate[] =
      candidateRows;

    const candidateById = new Map(
      candidates.map((candidate) => [
        candidate.id,
        candidate,
      ]),
    );

    /*
     * Ein bestehender Ladevorgang darf innerhalb
     * derselben XLSX nur genau einer TRONITY-Zeile
     * zugeordnet werden.
     */
    const usedCandidateIds =
      new Set<number>();

    const decisions = rows.map((row) => {
      const available =
        candidates.filter(
          (candidate) =>
            !usedCandidateIds.has(
              candidate.id,
            ),
        );

      const match =
        chooseTronityChargeMatch(
          row,
          available,
        );

      let candidate:
        | TronityChargeCandidate
        | null = null;

      let changes: string[] = [];

      if (
        match.status === "matched" &&
        match.chargeSessionId != null
      ) {
        candidate =
          candidateById.get(
            match.chargeSessionId,
          ) ?? null;

        if (!candidate) {
          throw new Error(
            "Interner Fehler bei der TRONITY-Zuordnung.",
          );
        }

        usedCandidateIds.add(
          candidate.id,
        );

        const patch =
          buildTronityMergePatch(
            row,
            candidate,
          );

        changes = Object.keys(
          patch,
        ).filter(
          (key) =>
            key !== "syncedAt",
        );
      }

      return {
        row,
        match,
        candidate,
        changes,
      };
    });

    const summary = {
      total: decisions.length,

      matched: decisions.filter(
        (item) =>
          item.match.status ===
          "matched",
      ).length,

      ambiguous: decisions.filter(
        (item) =>
          item.match.status ===
          "ambiguous",
      ).length,

      newRecords: decisions.filter(
        (item) =>
          item.match.status ===
          "unmatched",
      ).length,

      toUpdate: decisions.filter(
        (item) =>
          item.match.status ===
            "matched" &&
          item.changes.length > 0,
      ).length,

      unchanged: decisions.filter(
        (item) =>
          item.match.status ===
            "matched" &&
          item.changes.length === 0,
      ).length,
    };

    const previewRows =
      decisions.map(
        ({
          row,
          match,
          candidate,
          changes,
        }) => ({
          rowNumber: row.rowNumber,

          startTime:
            row.startTime.toISOString(),

          endTime:
            row.endTime.toISOString(),

          address: row.address,

          energyKwh:
            sourceEnergy(row),

          startSoc: row.startSoc,
          endSoc: row.endSoc,

          cost: row.cost,

          chargerType:
            row.chargerType,

          matchStatus:
            match.status,

          chargeSessionId:
            match.chargeSessionId,

          existingSource:
            candidate?.source ??
            null,

          startDiffMinutes:
            match.startDiffMinutes,

          endDiffMinutes:
            match.endDiffMinutes,

          energyDiffKwh:
            match.energyDiffKwh,

          locationDistanceKm:
            match.locationDistanceKm,

          changes,
        }),
      );

    const mode = new URL(
      request.url,
    ).searchParams.get("mode");

    if (mode !== "import") {
      return NextResponse.json({
        mode: "preview",

        vehicle: {
          id: vehicle.id,
          displayName:
            vehicle.displayName,
        },

        summary,

        rows: previewRows.slice(
          0,
          100,
        ),

        truncated:
          previewRows.length > 100,
      });
    }

    let inserted = 0;
    let updated = 0;
    let skippedAmbiguous = 0;
    let unchanged = 0;

    const matchablePlaces =
      await db
        .select({
          id: places.id,
          lat: places.lat,
          lon: places.lon,
          radiusM: places.radiusM,
        })
        .from(places);

    await db.transaction(
      async (tx) => {
        for (const decision of decisions) {
          const {
            row,
            match,
            candidate,
          } = decision;

          if (
            match.status ===
            "ambiguous"
          ) {
            skippedAmbiguous++;
            continue;
          }

          if (
            match.status ===
            "matched"
          ) {
            if (!candidate) {
              throw new Error(
                "Interner Fehler beim TRONITY-Merge.",
              );
            }

            const patch =
              buildTronityMergePatch(
                row,
                candidate,
              );

            if (
              Object.keys(patch)
                .length === 0
            ) {
              unchanged++;
              continue;
            }

            await tx
              .update(chargeSessions)
              .set({
                ...patch,
                updatedAt:
                  new Date(),
              })
              .where(
                eq(
                  chargeSessions.id,
                  candidate.id,
                ),
              );

            updated++;
            continue;
          }

          const energy =
            sourceEnergy(row);

          const placeId =
            matchPlace(
              row.lat,
              row.lon,
              matchablePlaces,
            );

          const insertedRows =
            await tx
              .insert(chargeSessions)
              .values({
                vehicleId:
                  vehicle.id,

                startTime:
                  row.startTime,

                endTime:
                  row.endTime,

                lat: row.lat,
                lon: row.lon,

                placeId,
                placeLocked: false,

                address:
                  row.address,

                startSoc:
                  row.startSoc,

                endSoc:
                  row.endSoc,

                energyAddedKwh:
                  energy,

                energyUsedKwh: null,

                maxPowerKw:
                  row.maxPowerKw,

                avgPowerKw: null,

                chargerType:
                  row.chargerType,

                outsideTempAvg: null,

                durationSeconds:
                  row.durationSeconds,

                cost:
                  row.cost != null
                    ? row.cost.toFixed(
                        2,
                      )
                    : null,

                currency:
                  row.cost != null
                    ? "EUR"
                    : null,

                costSource:
                  row.cost != null
                    ? "synced"
                    : null,

                notes: row.notes,

                source: "tronity",

                sourceId: sourceId(
                  vehicle.id,
                  row,
                ),

                syncedAt:
                  new Date(),
              })
              .onConflictDoNothing({
                target: [
                  chargeSessions.source,
                  chargeSessions.sourceId,
                ],
              })
              .returning({
                id: chargeSessions.id,
              });

          if (
            insertedRows.length > 0
          ) {
            inserted++;
          } else {
            unchanged++;
          }
        }
      },
    );

    return NextResponse.json({
      mode: "import",

      vehicle: {
        id: vehicle.id,
        displayName:
          vehicle.displayName,
      },

      summary: {
        ...summary,
        inserted,
        updated,
        skippedAmbiguous,
        unchanged,
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "TRONITY-Export konnte nicht verarbeitet werden.",
    );
  }
}
