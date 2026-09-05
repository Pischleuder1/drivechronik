"use server";

import { revalidatePath } from "next/cache";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import type { ReportDrive } from "@drivechronik/core";
import {
  appendAuditEntry,
  auditLog,
  canonicalJson,
  driveTags,
  drives,
  monthSeals,
  places,
  settings,
  sha256,
  tags,
  vehicles,
} from "@drivechronik/db";

import { DRIVER_NAME_KEY } from "../appSettings";
import { validateSession } from "../auth/session";
import { db } from "../db";
import { monthBounds } from "../exports/data";
import { isLogbookComplete } from "../logbookCompletion";
import {
  buildMonthSealHash,
  shouldCreateMonthSealRevision,
} from "../monthSeal";

const sealMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  vehicleId: z.coerce.number().int().positive(),
});

export interface SealMonthResult {
  ok: boolean;
  error?: string;
  revision?: number;
  sealId?: number;
}

export async function sealMonth(
  _prev: SealMonthResult,
  formData: FormData,
): Promise<SealMonthResult> {
  const user = await validateSession();

  if (!user) {
    return {
      ok: false,
      error: "Nicht angemeldet.",
    };
  }

  const parsed = sealMonthSchema.safeParse({
    month: formData.get("month"),
    vehicleId: formData.get("vehicleId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Ungültiger Monat oder ungültiges Fahrzeug.",
    };
  }

  const { month, vehicleId } = parsed.data;
  const { start, end } = monthBounds(month);

  if (end.getTime() > Date.now()) {
    return {
      ok: false,
      error:
        "Der aktuelle oder ein zukünftiger Monat kann noch nicht abgeschlossen werden.",
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const monthKey = Number(month.replace("-", ""));

      await tx.execute(
        sql`select pg_advisory_xact_lock(${vehicleId}, ${monthKey})`,
      );

      // Serialize the complete seal snapshot with all other audit writes.
      // appendAuditEntry() uses the same transaction-level lock again later;
      // PostgreSQL permits this within the same transaction.
      await tx.execute(
        sql`select pg_advisory_xact_lock(441726381)`,
      );

      const vehicleRows = await tx
        .select({
          id: vehicles.id,
          displayName: vehicles.displayName,
          vin: vehicles.vin,
          licensePlate: vehicles.licensePlate,
        })
        .from(vehicles)
        .where(eq(vehicles.id, vehicleId))
        .limit(1);

      const vehicle = vehicleRows[0];

      if (!vehicle) {
        throw new Error("Fahrzeug wurde nicht gefunden.");
      }

      const driverRows = await tx
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, DRIVER_NAME_KEY))
        .limit(1);

      const rawDriverName = driverRows[0]?.value;
      const driverName =
        typeof rawDriverName === "string"
          ? rawDriverName.trim()
          : "";

      if (!driverName) {
        throw new Error(
          "Bitte zuerst in den Einstellungen einen Fahrernamen hinterlegen.",
        );
      }

      const driveRows = await tx
        .select()
        .from(drives)
        .where(
          and(
            eq(drives.vehicleId, vehicleId),
            gte(drives.startTime, start),
            lt(drives.startTime, end),
          ),
        )
        .orderBy(asc(drives.startTime), asc(drives.id));

      if (driveRows.length === 0) {
        throw new Error(
          "Für diesen Monat sind keine Fahrten vorhanden.",
        );
      }

      const incomplete = driveRows.filter(
        (drive) =>
          !isLogbookComplete(
            drive.classification,
            drive.purpose,
          ),
      );

      if (incomplete.length > 0) {
        throw new Error(
          "Der Monat kann noch nicht abgeschlossen werden: " +
            incomplete.length +
            " Fahrt(en) sind noch unvollständig.",
        );
      }

      const placeIds = [
        ...new Set(
          driveRows.flatMap((drive) => [
            drive.startPlaceId,
            drive.endPlaceId,
          ]).filter((id): id is number => id != null),
        ),
      ];

      const placeRows =
        placeIds.length === 0
          ? []
          : await tx
              .select({
                id: places.id,
                name: places.name,
              })
              .from(places)
              .where(inArray(places.id, placeIds));

      const placeNameById = new Map(
        placeRows.map((place) => [place.id, place.name]),
      );

      const driveIds = driveRows.map((drive) => drive.id);

      const tagRows =
        driveIds.length === 0
          ? []
          : await tx
              .select({
                driveId: driveTags.driveId,
                name: tags.name,
              })
              .from(driveTags)
              .innerJoin(tags, eq(driveTags.tagId, tags.id))
              .where(inArray(driveTags.driveId, driveIds))
              .orderBy(asc(driveTags.driveId), asc(tags.name));

      const tagsByDriveId = new Map<number, string[]>();

      for (const row of tagRows) {
        const current = tagsByDriveId.get(row.driveId) ?? [];
        current.push(row.name);
        tagsByDriveId.set(row.driveId, current);
      }

      const reportDrives: ReportDrive[] = driveRows.map((drive) => ({
        id: drive.id,
        startTime: drive.startTime,
        endTime: drive.endTime,
        startPlaceName:
          drive.startPlaceId != null
            ? placeNameById.get(drive.startPlaceId) ?? null
            : null,
        endPlaceName:
          drive.endPlaceId != null
            ? placeNameById.get(drive.endPlaceId) ?? null
            : null,
        startAddress: drive.startAddress,
        endAddress: drive.endAddress,
        startLat: drive.startLat,
        startLon: drive.startLon,
        endLat: drive.endLat,
        endLon: drive.endLon,
        startOdometerKm: drive.startOdometerKm,
        endOdometerKm: drive.endOdometerKm,
        distanceKm: drive.distanceKm,
        durationSeconds: drive.durationSeconds,
        consumedEnergyKwh: drive.consumedEnergyKwh,
        energyIsEstimated: drive.energyIsEstimated,
        avgConsumptionWhKm: drive.avgConsumptionWhKm,
        classification: drive.classification,
        purpose: drive.purpose,
        customer: drive.customer,
        project: drive.project,
        notes: drive.notes,
        tags: tagsByDriveId.get(drive.id) ?? [],
      }));

      const identity = {
        vehicleId,
        driverName,
        licensePlate: vehicle.licensePlate,
        vehicleDisplayName: vehicle.displayName,
        vehicleVin: vehicle.vin,
      };

      const hashed = buildMonthSealHash(
        month,
        identity,
        reportDrives,
      );

      const previousAuditRows = await tx
        .select({
          entryHash: auditLog.entryHash,
        })
        .from(auditLog)
        .where(isNotNull(auditLog.entryHash))
        .orderBy(desc(auditLog.id))
        .limit(1);

      const lastAuditHash =
        previousAuditRows[0]?.entryHash ?? null;

      const previousSealRows = await tx
        .select({
          revision: monthSeals.revision,
          contentHash: monthSeals.contentHash,
        })
        .from(monthSeals)
        .where(
          and(
            eq(monthSeals.vehicleId, vehicleId),
            eq(monthSeals.month, month),
          ),
        )
        .orderBy(desc(monthSeals.revision))
        .limit(1);

      const previousSeal = previousSealRows[0];

      if (
        previousSeal &&
        !shouldCreateMonthSealRevision(
          previousSeal.contentHash,
          hashed.contentHash,
        )
      ) {
        throw new Error(
          "Der Monat ist bereits mit diesem Fahrtenstand abgeschlossen.",
        );
      }

      const revision =
        (previousSeal?.revision ?? 0) + 1;

      const sealedAt = new Date();

      const sealPayload = {
        version: 1,
        vehicleId,
        month,
        revision,
        driverName: identity.driverName,
        licensePlate: identity.licensePlate,
        vehicleDisplayName: identity.vehicleDisplayName,
        vehicleVin: identity.vehicleVin,
        driveCount: hashed.driveCount,
        distanceKm: hashed.distanceKm,
        lastAuditHash,
        contentHash: hashed.contentHash,
        sealedAt: sealedAt.toISOString(),
        sealedBy: user.username,
      };

      const sealHash = sha256(
        canonicalJson(sealPayload),
      );

      const inserted = await tx
        .insert(monthSeals)
        .values({
          vehicleId,
          month,
          revision,
          driverName: identity.driverName,
          licensePlate: identity.licensePlate,
          vehicleDisplayName: identity.vehicleDisplayName,
          vehicleVin: identity.vehicleVin,
          driveCount: hashed.driveCount,
          distanceKm: hashed.distanceKm,
          lastAuditHash,
          contentHash: hashed.contentHash,
          sealHash,
          sealedAt,
          sealedBy: user.username,
        })
        .returning({
          id: monthSeals.id,
        });

      const sealId = inserted[0]!.id;

      await appendAuditEntry(tx, {
        entityType: "month_seal",
        entityId: sealId,
        field: "seal",
        oldValue: null,
        newValue: sealHash,
        changedBy: user.username,
        eventType: "seal",
        metadata: {
          month,
          vehicleId,
          revision,
          contentHash: hashed.contentHash,
          sealHash,
          driveCount: hashed.driveCount,
          distanceKm: hashed.distanceKm,
          lastAuditHash,
        },
      });

      return {
        revision,
        sealId,
      };
    });

    revalidatePath("/reports");

    return {
      ok: true,
      revision: result.revision,
      sealId: result.sealId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Der Monatsabschluss ist fehlgeschlagen.",
    };
  }
}
