import type {
  TronityChargerType,
  TronityChargingRow,
} from "./tronityChargingXlsx";

const MATCH_WINDOW_MS = 20 * 60 * 1000;
const END_WINDOW_MS = 45 * 60 * 1000;
const AMBIGUITY_SCORE_GAP = 1.25;
const MAX_LOCATION_DISTANCE_KM = 10;

export interface TronityChargeCandidate {
  id: number;

  startTime: Date;
  endTime: Date | null;

  lat: number | null;
  lon: number | null;

  placeId: number | null;
  placeLocked: boolean;

  address: string | null;

  startSoc: number | null;
  endSoc: number | null;

  energyAddedKwh: number | null;
  energyUsedKwh: number | null;

  maxPowerKw: number | null;
  chargerType: TronityChargerType | null;
  durationSeconds: number | null;

  cost: string | null;
  currency: string | null;
  costSource: string | null;

  notes: string | null;

  source: string;
  sourceId: string;
}

export type TronityMatchStatus =
  | "matched"
  | "ambiguous"
  | "unmatched";

export interface TronityChargeMatch {
  status: TronityMatchStatus;

  chargeSessionId: number | null;

  startDiffMinutes: number | null;
  endDiffMinutes: number | null;
  energyDiffKwh: number | null;
  locationDistanceKm: number | null;

  score: number | null;
}

export interface TronityChargeMergePatch {
  endTime?: Date;

  lat?: number;
  lon?: number;

  address?: string;

  startSoc?: number;
  endSoc?: number;

  energyAddedKwh?: number;

  maxPowerKw?: number;
  chargerType?: TronityChargerType;
  durationSeconds?: number;

  cost?: string;
  currency?: string;
  costSource?: string;

  notes?: string;

  syncedAt?: Date;
}

function sourceEnergy(
  row: TronityChargingRow,
): number | null {
  return row.energyKwh ?? row.energyTotalKwh;
}

function candidateEnergy(
  candidate: TronityChargeCandidate,
): number | null {
  return (
    candidate.energyAddedKwh ??
    candidate.energyUsedKwh
  );
}

function normalizeTokens(
  value: string | null,
): Set<string> {
  if (!value) return new Set();

  const ignored = new Set([
    "germany",
    "deutschland",
    "austria",
    "österreich",
    "switzerland",
    "schweiz",
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

function hasAddressOverlap(
  source: string | null,
  target: string | null,
): boolean {
  const sourceTokens = normalizeTokens(source);
  const targetTokens = normalizeTokens(target);

  if (
    sourceTokens.size === 0 ||
    targetTokens.size === 0
  ) {
    return false;
  }

  for (const token of sourceTokens) {
    if (targetTokens.has(token)) {
      return true;
    }
  }

  return false;
}

export function tronityDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;

  const toRad = (value: number) =>
    (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.asin(Math.sqrt(a))
  );
}

export function chooseTronityChargeMatch(
  row: TronityChargingRow,
  candidates: TronityChargeCandidate[],
): TronityChargeMatch {
  const ranked = candidates
    .map((candidate) => {
      const startDiffMs = Math.abs(
        candidate.startTime.getTime() -
          row.startTime.getTime(),
      );

      if (startDiffMs > MATCH_WINDOW_MS) {
        return null;
      }

      const startDiffMinutes =
        startDiffMs / 60000;

      let score = startDiffMinutes;

      let endDiffMinutes: number | null =
        null;

      if (candidate.endTime) {
        const endDiffMs = Math.abs(
          candidate.endTime.getTime() -
            row.endTime.getTime(),
        );

        if (endDiffMs > END_WINDOW_MS) {
          return null;
        }

        endDiffMinutes = endDiffMs / 60000;

        score += endDiffMinutes * 0.25;
      }

      const rowEnergy = sourceEnergy(row);
      const currentEnergy =
        candidateEnergy(candidate);

      let energyDiffKwh: number | null =
        null;

      if (
        rowEnergy != null &&
        currentEnergy != null
      ) {
        energyDiffKwh = Math.abs(
          rowEnergy - currentEnergy,
        );

        const tolerance = Math.max(
          8,
          rowEnergy * 0.25,
        );

        if (energyDiffKwh > tolerance) {
          return null;
        }

        score += energyDiffKwh * 0.35;
      }

      let locationDistanceKm:
        | number
        | null = null;

      if (
        row.lat != null &&
        row.lon != null &&
        candidate.lat != null &&
        candidate.lon != null
      ) {
        locationDistanceKm =
          tronityDistanceKm(
            row.lat,
            row.lon,
            candidate.lat,
            candidate.lon,
          );

        if (
          locationDistanceKm >
          MAX_LOCATION_DISTANCE_KM
        ) {
          return null;
        }

        score +=
          Math.min(locationDistanceKm, 5) *
          0.4;

        if (locationDistanceKm <= 0.5) {
          score -= 1;
        }
      } else if (
        hasAddressOverlap(
          row.address,
          candidate.address,
        )
      ) {
        score -= 0.75;
      }

      return {
        candidate,
        startDiffMinutes,
        endDiffMinutes,
        energyDiffKwh,
        locationDistanceKm,
        score,
      };
    })
    .filter(
      (
        value,
      ): value is NonNullable<typeof value> =>
        value !== null,
    )
    .sort((a, b) => a.score - b.score);

  if (ranked.length === 0) {
    return {
      status: "unmatched",
      chargeSessionId: null,
      startDiffMinutes: null,
      endDiffMinutes: null,
      energyDiffKwh: null,
      locationDistanceKm: null,
      score: null,
    };
  }

  const best = ranked[0]!;
  const second = ranked[1];

  if (
    second &&
    second.score - best.score <
      AMBIGUITY_SCORE_GAP
  ) {
    return {
      status: "ambiguous",
      chargeSessionId: null,
      startDiffMinutes:
        best.startDiffMinutes,
      endDiffMinutes: best.endDiffMinutes,
      energyDiffKwh:
        best.energyDiffKwh,
      locationDistanceKm:
        best.locationDistanceKm,
      score: best.score,
    };
  }

  return {
    status: "matched",
    chargeSessionId: best.candidate.id,
    startDiffMinutes:
      best.startDiffMinutes,
    endDiffMinutes: best.endDiffMinutes,
    energyDiffKwh: best.energyDiffKwh,
    locationDistanceKm:
      best.locationDistanceKm,
    score: best.score,
  };
}

function emptyText(
  value: string | null,
): boolean {
  return value == null || value.trim() === "";
}

function sameMoney(
  current: string | null,
  next: number,
): boolean {
  if (current == null) return false;

  const parsed = Number(current);

  return (
    Number.isFinite(parsed) &&
    parsed.toFixed(2) === next.toFixed(2)
  );
}

/**
 * Baut ausschließlich die Änderungen, die ein TRONITY-Match
 * an einer bereits vorhandenen charge_session vornehmen darf.
 *
 * Grundsatz:
 * - TeslaMate/Tessie-Daten bleiben führend.
 * - TRONITY ergänzt fehlende technische Daten.
 * - TRONITY-Kosten dürfen automatische/synchronisierte Kosten ersetzen.
 * - manuelle Kosten und vorhandene Notizen bleiben unangetastet.
 * - placeId/placeLocked werden hier nie verändert.
 */
export function buildTronityMergePatch(
  row: TronityChargingRow,
  current: TronityChargeCandidate,
): TronityChargeMergePatch {
  const patch: TronityChargeMergePatch =
    {};

  if (current.endTime == null) {
    patch.endTime = row.endTime;
  }

  if (
    current.lat == null &&
    row.lat != null
  ) {
    patch.lat = row.lat;
  }

  if (
    current.lon == null &&
    row.lon != null
  ) {
    patch.lon = row.lon;
  }

  if (
    emptyText(current.address) &&
    row.address
  ) {
    patch.address = row.address;
  }

  if (
    current.startSoc == null &&
    row.startSoc != null
  ) {
    patch.startSoc = row.startSoc;
  }

  if (
    current.endSoc == null &&
    row.endSoc != null
  ) {
    patch.endSoc = row.endSoc;
  }

  const energy = sourceEnergy(row);

  if (
    current.energyAddedKwh == null &&
    energy != null
  ) {
    patch.energyAddedKwh = energy;
  }

  if (
    current.maxPowerKw == null &&
    row.maxPowerKw != null
  ) {
    patch.maxPowerKw = row.maxPowerKw;
  }

  if (
    current.chargerType == null &&
    row.chargerType != null
  ) {
    patch.chargerType = row.chargerType;
  }

  if (
    current.durationSeconds == null &&
    row.durationSeconds != null
  ) {
    patch.durationSeconds =
      row.durationSeconds;
  }

  if (
    row.cost != null &&
    current.costSource !== "manual"
  ) {
    if (
      !sameMoney(current.cost, row.cost) ||
      current.currency !== "EUR" ||
      current.costSource !== "synced"
    ) {
      patch.cost = row.cost.toFixed(2);
      patch.currency = "EUR";
      patch.costSource = "synced";
    }
  }

  if (
    emptyText(current.notes) &&
    row.notes
  ) {
    patch.notes = row.notes;
  }

  if (Object.keys(patch).length > 0) {
    patch.syncedAt = new Date();
  }

  return patch;
}
