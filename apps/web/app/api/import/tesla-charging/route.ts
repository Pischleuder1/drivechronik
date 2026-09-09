import { NextResponse } from "next/server";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lte,
} from "drizzle-orm";

import {
  chargeSessions,
  places,
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

async function parseRequestFile(
  request: Request,
): Promise<TeslaChargingCsvRow[]> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (
    !file ||
    typeof file !== "object" ||
    !("arrayBuffer" in file)
  ) {
    throw new Error(
      "Bitte eine Tesla-CSV-Datei auswählen.",
    );
  }

  const size =
    "size" in file && typeof file.size === "number"
      ? file.size
      : 0;

  if (size > MAX_FILE_BYTES) {
    throw new Error(
      "Die Tesla-CSV ist größer als 5 MB.",
    );
  }

  const bytes = await file.arrayBuffer();
  const text = Buffer.from(bytes).toString("utf8");

  const rows = parseTeslaChargingCsv(text);

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `Die Tesla-CSV enthält mehr als ${MAX_ROWS} Einträge.`,
    );
  }

  return rows;
}

export async function POST(request: Request) {
  const user = await validateSession();

  if (!user) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  try {
    const rows = await parseRequestFile(request);

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

    for (
      let index = 0;
      index < rows.length;
      index += 1
    ) {
      const row = rows[index]!;
      const match = matches[index]!;

      const values = {
        chargeSessionId:
          match.status === "matched"
            ? match.chargeSessionId
            : null,

        chargeStartTime:
          row.chargeStartTime,

        name: row.name,
        vin: row.vin,
        model: row.model,
        country: row.country,
        siteLocationName:
          row.siteLocationName,
        description: row.description,

        quantityBaseRaw:
          row.quantityBaseRaw,
        energyKwh: row.energyKwh,
        unitCostBaseRaw:
          row.unitCostBaseRaw,

        vatRaw: row.vatRaw,
        totalExVat:
          numericString(row.totalExVat),
        totalIncVat:
          numericString(row.totalIncVat),
        currency: row.currency,

        invoiceNumber:
          row.invoiceNumber,
        status: row.status,
        invoiceUrl: row.invoiceUrl,

        sourceHash: row.sourceHash,
        rawData: JSON.stringify(row.raw),

        updatedAt: new Date(),
      };

      await db
        .insert(teslaChargingRecords)
        .values(values)
        .onConflictDoUpdate({
          target:
            teslaChargingRecords.sourceHash,
          set: values,
        });
    }

    return NextResponse.json({
      mode: "import",
      summary: {
        ...summary,
        newRecords:
          rows.length -
          existingHashes.size,
        updatedRecords:
          existingHashes.size,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Tesla-CSV konnte nicht verarbeitet werden.",
      },
      { status: 400 },
    );
  }
}
