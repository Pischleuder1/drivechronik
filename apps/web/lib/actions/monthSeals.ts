"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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
  driveTags,
  drives,
  monthSeals,
  places,
  settings,
  tags,
  vehicles,
} from "@drivechronik/db";

import {
  DRIVER_NAME_KEY,
  driverNameSettingKey,
} from "../appSettings";
import { validateSession } from "../auth/session";
import { db } from "../db";
import { monthBounds } from "../exports/data";
import { isLogbookComplete } from "../logbookCompletion";
import {
  buildMonthSealHash,
  hashMonthSealPayload,
  shouldCreateMonthSealRevision,
  type MonthSealPayload,
} from "../monthSeal";
import { loadMonthSealPrivateKey } from "../monthSealSigningKey";
import { signMonthSealHash } from "../monthSealSignature";

const sealMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  vehicleId: z.coerce.number().int().positive(),
});

class SealMonthUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealMonthUserError";
  }
}


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
  const t = await getTranslations("reports.monthSeal.errors");
  const user = await validateSession();

  if (!user) {
    return {
      ok: false,
      error: t("notAuthenticated"),
    };
  }

  const parsed = sealMonthSchema.safeParse({
    month: formData.get("month"),
    vehicleId: formData.get("vehicleId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: t("invalidInput"),
    };
  }

  const { month, vehicleId } = parsed.data;
  const { start, end } = monthBounds(month);

  if (end.getTime() > Date.now()) {
    return {
      ok: false,
      error: t("cannotSealCurrentOrFuture"),
    };
  }

  let privateKey: string;

  try {
    const loadedPrivateKey = await loadMonthSealPrivateKey();

    if (!loadedPrivateKey) {
      return {
        ok: false,
        error: t("signingKeyMissing"),
      };
    }

    privateKey = loadedPrivateKey;
  } catch {
    return {
      ok: false,
      error: t("privateKeyLoadFailed"),
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
          model: vehicles.model,
          vin: vehicles.vin,
          licensePlate: vehicles.licensePlate,
        })
        .from(vehicles)
        .where(eq(vehicles.id, vehicleId))
        .limit(1);

      const vehicle = vehicleRows[0];

      if (!vehicle) {
        throw new SealMonthUserError(t("vehicleNotFound"));
      }

      const driverNameKey = driverNameSettingKey(vehicleId);

      const driverRows = await tx
        .select({
          key: settings.key,
          value: settings.value,
        })
        .from(settings)
        .where(
          inArray(settings.key, [
            driverNameKey,
            DRIVER_NAME_KEY,
          ]),
        );

      const specificDriverName = driverRows.find(
        (row) => row.key === driverNameKey,
      )?.value;

      const legacyDriverName = driverRows.find(
        (row) => row.key === DRIVER_NAME_KEY,
      )?.value;

      const rawDriverName =
        typeof specificDriverName === "string"
          ? specificDriverName
          : legacyDriverName;

      const driverName =
        typeof rawDriverName === "string"
          ? rawDriverName.trim()
          : "";

      if (!driverName) {
        throw new SealMonthUserError(t("driverMissing"));
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
        throw new SealMonthUserError(t("noDrives"));
      }

      const incomplete = driveRows.filter(
        (drive) =>
          !isLogbookComplete(
            drive.classification,
            drive.purpose,
          ),
      );

      if (incomplete.length > 0) {
        throw new SealMonthUserError(t("incompleteDrives", { count: incomplete.length }));
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
        vehicleModel: vehicle.model,
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
        throw new SealMonthUserError(t("alreadySealed"));
      }

      const revision =
        (previousSeal?.revision ?? 0) + 1;

      const sealedAt = new Date();

      const sealPayload: MonthSealPayload = {
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

      const sealHash = hashMonthSealPayload(sealPayload);
      const signedSeal = signMonthSealHash(sealHash, privateKey);

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
          snapshot: hashed.content,
          sealHash,
          signatureAlgorithm: signedSeal.algorithm,
          signature: signedSeal.signature,
          signingPublicKey: signedSeal.publicKey,
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
          signatureAlgorithm: signedSeal.algorithm,
          signingKeyId: signedSeal.keyId,
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
        error instanceof SealMonthUserError
          ? error.message
          : t("failed"),
    };
  }
}
