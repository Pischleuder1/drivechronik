import {
  and,
  eq,
  gte,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  chargeSessions,
  drives,
  vehicles,
} from "@drivechronik/db";

import {
  findTeslaFiIntervalConflicts,
  previewTeslaFiCsv,
  teslaFiLocalTimeToUtc,
  type TeslaFiCandidateInterval,
  type TeslaFiExistingInterval,
} from "@drivechronik/core";

import { db } from "../../../../../lib/db";
import { validateSession } from "../../../../../lib/auth/session";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface CandidateWithIndex {
  originalIndex: number;
  interval: TeslaFiCandidateInterval;
  startIso: string;
  endIso: string;
}

function buildCandidateIntervals(
  episodes: Array<{
    startDateTime: string;
    endDateTime: string;
  }>,
  timezone: string,
): {
  valid: CandidateWithIndex[];
  invalidIndexes: number[];
} {
  const valid: CandidateWithIndex[] = [];
  const invalidIndexes: number[] = [];

  episodes.forEach((episode, originalIndex) => {
    const start =
      teslaFiLocalTimeToUtc(
        episode.startDateTime,
        timezone,
      );

    const end =
      teslaFiLocalTimeToUtc(
        episode.endDateTime,
        timezone,
      );

    if (
      !start.valid ||
      !end.valid ||
      start.utcMs == null ||
      end.utcMs == null ||
      start.iso == null ||
      end.iso == null ||
      end.utcMs < start.utcMs
    ) {
      invalidIndexes.push(originalIndex);
      return;
    }

    valid.push({
      originalIndex,
      interval: {
        startMs: start.utcMs,
        endMs: end.utcMs,
      },
      startIso: start.iso,
      endIso: end.iso,
    });
  });

  return {
    valid,
    invalidIndexes,
  };
}

function existingIntervals(
  rows: Array<{
    id: number;
    source: string;
    startTime: Date;
    endTime: Date | null;
  }>,
): TeslaFiExistingInterval[] {
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    startMs: row.startTime.getTime(),
    endMs:
      row.endTime == null
        ? null
        : row.endTime.getTime(),
  }));
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format();

    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("import");
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      {
        error: t("apiErrors.notAuthenticated"),
      },
      { status: 401 },
    );
  }

  try {
    const form = await request.formData();

    const file = form.get("file");
    const vehicleIdRaw = form.get("vehicleId");
    const timezoneRaw = form.get("timezone");
    const distanceUnitRaw = form.get("distanceUnit");

    if (
      !file ||
      typeof file !== "object" ||
      !("arrayBuffer" in file)
    ) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.selectFile",
          ),
        },
        { status: 400 },
      );
    }

    const size =
      "size" in file &&
      typeof file.size === "number"
        ? file.size
        : 0;

    if (size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.fileTooLarge",
          ),
        },
        { status: 413 },
      );
    }

    const vehicleId = Number(
      typeof vehicleIdRaw === "string"
        ? vehicleIdRaw
        : "",
    );

    if (
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0
    ) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.vehicleRequired",
          ),
        },
        { status: 400 },
      );
    }

    const timezone =
      typeof timezoneRaw === "string"
        ? timezoneRaw.trim()
        : "";

    if (
      timezone.length === 0 ||
      !validTimeZone(timezone)
    ) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.invalidTimezone",
          ),
        },
        { status: 400 },
      );
    }

    const distanceUnit =
      distanceUnitRaw === "metric" ||
      distanceUnitRaw === "imperial"
        ? distanceUnitRaw
        : null;

    if (!distanceUnit) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.invalidDistanceUnit",
          ),
        },
        { status: 400 },
      );
    }

    const vehicleRows = await db
      .select({
        id: vehicles.id,
        displayName: vehicles.displayName,
      })
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    const vehicle = vehicleRows[0];

    if (!vehicle) {
      return NextResponse.json(
        {
          error: t(
            "teslafi.errors.vehicleNotFound",
          ),
        },
        { status: 404 },
      );
    }

    const bytes = await file.arrayBuffer();

    const csvText = Buffer
      .from(bytes)
      .toString("utf8");

    const preview =
      previewTeslaFiCsv(
        csvText,
        {
          timeZone: timezone,
          distanceUnit,
        },
      );

    const driveCandidates =
      buildCandidateIntervals(
        preview.driveEpisodes,
        timezone,
      );

    const chargeCandidates =
      buildCandidateIntervals(
        preview.chargeEpisodes,
        timezone,
      );

    const allValidCandidates = [
      ...driveCandidates.valid,
      ...chargeCandidates.valid,
    ];

    let existingDriveRows: Array<{
      id: number;
      source: string;
      startTime: Date;
      endTime: Date | null;
    }> = [];

    let existingChargeRows: Array<{
      id: number;
      source: string;
      startTime: Date;
      endTime: Date | null;
    }> = [];

    if (allValidCandidates.length > 0) {
      const minMs = Math.min(
        ...allValidCandidates.map(
          (candidate) =>
            candidate.interval.startMs,
        ),
      );

      const maxMs = Math.max(
        ...allValidCandidates.map(
          (candidate) =>
            candidate.interval.endMs,
        ),
      );

      const rangeStart = new Date(minMs);
      const rangeEnd = new Date(maxMs);

      [
        existingDriveRows,
        existingChargeRows,
      ] = await Promise.all([
        db
          .select({
            id: drives.id,
            source: drives.source,
            startTime: drives.startTime,
            endTime: drives.endTime,
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
                isNull(drives.endTime),
                gte(
                  drives.endTime,
                  rangeStart,
                ),
              ),
            ),
          ),

        db
          .select({
            id: chargeSessions.id,
            source: chargeSessions.source,
            startTime:
              chargeSessions.startTime,
            endTime:
              chargeSessions.endTime,
          })
          .from(chargeSessions)
          .where(
            and(
              eq(
                chargeSessions.vehicleId,
                vehicleId,
              ),
              lte(
                chargeSessions.startTime,
                rangeEnd,
              ),
              or(
                isNull(
                  chargeSessions.endTime,
                ),
                gte(
                  chargeSessions.endTime,
                  rangeStart,
                ),
              ),
            ),
          ),
      ]);
    }

    const driveExisting =
      existingIntervals(
        existingDriveRows,
      );

    const chargeExisting =
      existingIntervals(
        existingChargeRows,
      );

    const driveMatches =
      findTeslaFiIntervalConflicts(
        driveCandidates.valid.map(
          (candidate) =>
            candidate.interval,
        ),
        driveExisting,
      );

    const chargeMatches =
      findTeslaFiIntervalConflicts(
        chargeCandidates.valid.map(
          (candidate) =>
            candidate.interval,
        ),
        chargeExisting,
      );

    const driveConflictByOriginalIndex =
      new Map(
        driveMatches.map(
          (match, validIndex) => [
            driveCandidates.valid[
              validIndex
            ]!.originalIndex,
            match,
          ],
        ),
      );

    const chargeConflictByOriginalIndex =
      new Map(
        chargeMatches.map(
          (match, validIndex) => [
            chargeCandidates.valid[
              validIndex
            ]!.originalIndex,
            match,
          ],
        ),
      );

    const driveTimeErrors =
      new Set(
        driveCandidates.invalidIndexes,
      );

    const chargeTimeErrors =
      new Set(
        chargeCandidates.invalidIndexes,
      );

    const driveConflicts =
      preview.driveEpisodes.map(
        (episode, index) => {
          const candidate =
            driveCandidates.valid.find(
              (item) =>
                item.originalIndex === index,
            );

          const match =
            driveConflictByOriginalIndex.get(
              index,
            );

          return {
            index,
            startDateTime:
              episode.startDateTime,
            endDateTime:
              episode.endDateTime,
            startUtc:
              candidate?.startIso ?? null,
            endUtc:
              candidate?.endIso ?? null,
            timeError:
              driveTimeErrors.has(index),
            conflict:
              (match?.conflicts.length ?? 0) >
              0,
            existing:
              match?.conflicts ?? [],
          };
        },
      );

    const chargeConflicts =
      preview.chargeEpisodes.map(
        (episode, index) => {
          const candidate =
            chargeCandidates.valid.find(
              (item) =>
                item.originalIndex === index,
            );

          const match =
            chargeConflictByOriginalIndex.get(
              index,
            );

          return {
            index,
            startDateTime:
              episode.startDateTime,
            endDateTime:
              episode.endDateTime,
            startUtc:
              candidate?.startIso ?? null,
            endUtc:
              candidate?.endIso ?? null,
            timeError:
              chargeTimeErrors.has(index),
            conflict:
              (match?.conflicts.length ?? 0) >
              0,
            existing:
              match?.conflicts ?? [],
          };
        },
      );

    const driveConflictCount =
      driveConflicts.filter(
        (item) => item.conflict,
      ).length;

    const chargeConflictCount =
      chargeConflicts.filter(
        (item) => item.conflict,
      ).length;

    const fileName =
      "name" in file &&
      typeof file.name === "string"
        ? file.name
        : null;

    return NextResponse.json({
      mode: "preview",
      dryRun: true,

      file: {
        name: fileName,
        size,
      },

      vehicle,

      timezone,
      distanceUnit,

      preview,

      conflicts: {
        drives: driveConflicts,
        charges: chargeConflicts,

        summary: {
          drives: {
            total:
              preview.driveEpisodes.length,
            new:
              preview.driveEpisodes.length -
              driveConflictCount -
              driveCandidates
                .invalidIndexes.length,
            conflicts:
              driveConflictCount,
            timeErrors:
              driveCandidates
                .invalidIndexes.length,
          },

          charges: {
            total:
              preview.chargeEpisodes.length,
            new:
              preview.chargeEpisodes.length -
              chargeConflictCount -
              chargeCandidates
                .invalidIndexes.length,
            conflicts:
              chargeConflictCount,
            timeErrors:
              chargeCandidates
                .invalidIndexes.length,
          },
        },
      },
    });
  } catch (error) {
    console.error(
      "[web] TeslaFi-Vorschau fehlgeschlagen",
      error,
    );

    return NextResponse.json(
      {
        error: t(
          "teslafi.errors.unknown",
        ),
      },
      { status: 400 },
    );
  }
}
