import {
  segmentTeslaFiCharges,
  segmentTeslaFiDrives,
} from "./segment.js";

import {
  type TeslaFiNormalizedRow,
} from "./normalized.js";

export interface TeslaFiRoutePointPlan {
  ts: number;
  lat: number;
  lon: number;
  speedKmh: number | null;
  odometerKm: number;
  soc: number | null;
}

export interface TeslaFiDrivePlan {
  sourceId: string;

  startTs: number;
  endTs: number;

  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  durationSeconds: number;

  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;

  startSoc: number | null;
  endSoc: number | null;

  speedMaxKmh: number | null;

  sampleCount: number;
  routePoints: TeslaFiRoutePointPlan[];
}

export interface TeslaFiChargePointPlan {
  ts: number;
  powerKw: number | null;
  soc: number | null;
}

export interface TeslaFiChargePlan {
  sourceId: string;

  startTs: number;
  endTs: number;

  lat: number | null;
  lon: number | null;

  startSoc: number | null;
  endSoc: number | null;

  energyAddedKwh: number | null;
  maxPowerKw: number | null;
  avgPowerKw: number | null;

  durationSeconds: number;

  fastChargerBrand: string | null;
  fastChargerType: string | null;
  connectedChargeCable: string | null;

  sampleCount: number;
  chargePoints: TeslaFiChargePointPlan[];
}

export interface TeslaFiImportPlan {
  importable: boolean;
  unsafeTimeRowCount: number;

  drives: TeslaFiDrivePlan[];
  charges: TeslaFiChargePlan[];
}

function roundedSoc(
  value: number | null,
): number | null {
  return value == null
    ? null
    : Math.round(value);
}

function durationSeconds(
  startTs: number,
  endTs: number,
): number {
  return Math.max(
    0,
    Math.round(
      (endTs - startTs) / 1000,
    ),
  );
}

function maxValue(
  values: Array<number | null>,
): number | null {
  const valid = values.filter(
    (value): value is number =>
      value != null &&
      Number.isFinite(value),
  );

  return valid.length === 0
    ? null
    : Math.max(...valid);
}

function averageValue(
  values: Array<number | null>,
): number | null {
  const valid = values.filter(
    (value): value is number =>
      value != null &&
      Number.isFinite(value),
  );

  if (valid.length === 0) {
    return null;
  }

  return (
    valid.reduce(
      (sum, value) => sum + value,
      0,
    ) / valid.length
  );
}

function firstSoc(
  rows: TeslaFiNormalizedRow[],
): number | null {
  for (const row of rows) {
    if (row.soc != null) {
      return roundedSoc(row.soc);
    }
  }

  return null;
}

function lastSoc(
  rows: TeslaFiNormalizedRow[],
): number | null {
  for (
    let index = rows.length - 1;
    index >= 0;
    index -= 1
  ) {
    const row = rows[index]!;

    if (row.soc != null) {
      return roundedSoc(row.soc);
    }
  }

  return null;
}

function firstGps(
  rows: TeslaFiNormalizedRow[],
): {
  lat: number | null;
  lon: number | null;
} {
  for (const row of rows) {
    if (
      row.lat != null &&
      row.lon != null
    ) {
      return {
        lat: row.lat,
        lon: row.lon,
      };
    }
  }

  return {
    lat: null,
    lon: null,
  };
}

function lastGps(
  rows: TeslaFiNormalizedRow[],
): {
  lat: number | null;
  lon: number | null;
} {
  for (
    let index = rows.length - 1;
    index >= 0;
    index -= 1
  ) {
    const row = rows[index]!;

    if (
      row.lat != null &&
      row.lon != null
    ) {
      return {
        lat: row.lat,
        lon: row.lon,
      };
    }
  }

  return {
    lat: null,
    lon: null,
  };
}

function sourceId(
  type: "drive" | "charge",
  startTs: number,
): string {
  return [
    type,
    new Date(startTs).toISOString(),
  ].join(":");
}

export function buildTeslaFiImportPlan(
  rows: TeslaFiNormalizedRow[],
): TeslaFiImportPlan {
  /*
   * Ein echter Import darf niemals lokale
   * Pseudo-Zeit verwenden. Sobald auch nur eine
   * normalisierte Zeile keinen eindeutigen
   * UTC-Zeitpunkt besitzt, wird KEIN Teilplan
   * erzeugt.
   */
  const unsafeTimeRowCount =
    rows.filter(
      (row) =>
        row.utcMs == null ||
        !row.timeValid ||
        row.timeAmbiguous,
    ).length;

  if (unsafeTimeRowCount > 0) {
    return {
      importable: false,
      unsafeTimeRowCount,
      drives: [],
      charges: [],
    };
  }

  const safeRows = [...rows]
    .sort(
      (a, b) =>
        a.utcMs! - b.utcMs!,
    );

  /*
   * Gleiche UTC-Zeitstempel werden wie im
   * Segmenter "last row wins" behandelt.
   */
  const rowByTs =
    new Map<
      number,
      TeslaFiNormalizedRow
    >();

  for (const row of safeRows) {
    rowByTs.set(
      row.utcMs!,
      row,
    );
  }

  const canonicalRows = [
    ...rowByTs.values(),
  ].sort(
    (a, b) =>
      a.utcMs! - b.utcMs!,
  );

  const driveEpisodes =
    segmentTeslaFiDrives(
      canonicalRows.map(
        (row) => ({
          ts: row.utcMs!,
          shift: row.shiftState,
          speed: row.speedKmh,
          odometer: row.odometerKm,
        }),
      ),
    );

  const chargeEpisodes =
    segmentTeslaFiCharges(
      canonicalRows.map(
        (row) => ({
          ts: row.utcMs!,
          powerKw: row.chargerPowerKw,
          currentA: row.chargerCurrentA,
          chargeRate: row.chargeRateRaw,
          energyAdded:
            row.chargeEnergyAddedKwh,
          soc: row.soc,
        }),
      ),
    );

  const drives: TeslaFiDrivePlan[] =
    driveEpisodes.map((episode) => {
      const episodeRows =
        episode.samples
          .map(
            (sample) =>
              rowByTs.get(sample.ts),
          )
          .filter(
            (
              row,
            ): row is TeslaFiNormalizedRow =>
              row != null,
          );

      const first =
        episodeRows[0]!;

      const last =
        episodeRows[
          episodeRows.length - 1
        ]!;

      const startGps =
        firstGps(episodeRows);

      const endGps =
        lastGps(episodeRows);

      const routePoints =
        episodeRows
          .filter(
            (row) =>
              row.lat != null &&
              row.lon != null,
          )
          .map(
            (row): TeslaFiRoutePointPlan => ({
              ts: row.utcMs!,
              lat: row.lat!,
              lon: row.lon!,
              speedKmh: row.speedKmh,
              odometerKm:
                row.odometerKm,
              soc: roundedSoc(
                row.soc,
              ),
            }),
          );

      return {
        sourceId:
          sourceId(
            "drive",
            episode.startTs,
          ),

        startTs: episode.startTs,
        endTs: episode.endTs,

        startOdometerKm:
          first.odometerKm,

        endOdometerKm:
          last.odometerKm,

        distanceKm:
          Math.max(
            0,
            last.odometerKm -
              first.odometerKm,
          ),

        durationSeconds:
          durationSeconds(
            episode.startTs,
            episode.endTs,
          ),

        startLat: startGps.lat,
        startLon: startGps.lon,
        endLat: endGps.lat,
        endLon: endGps.lon,

        startSoc:
          firstSoc(episodeRows),

        endSoc:
          lastSoc(episodeRows),

        speedMaxKmh:
          maxValue(
            episodeRows.map(
              (row) =>
                row.speedKmh,
            ),
          ),

        sampleCount:
          episodeRows.length,

        routePoints,
      };
    });

  const charges: TeslaFiChargePlan[] =
    chargeEpisodes.map((episode) => {
      const episodeRows =
        episode.samples
          .map(
            (sample) =>
              rowByTs.get(sample.ts),
          )
          .filter(
            (
              row,
            ): row is TeslaFiNormalizedRow =>
              row != null,
          );

      const gps =
        firstGps(episodeRows);

      const chargePoints =
        episodeRows.map(
          (
            row,
          ): TeslaFiChargePointPlan => ({
            ts: row.utcMs!,
            powerKw:
              row.chargerPowerKw,
            soc: roundedSoc(
              row.soc,
            ),
          }),
        );

      const first =
        episodeRows[0]!;

      return {
        sourceId:
          sourceId(
            "charge",
            episode.startTs,
          ),

        startTs: episode.startTs,
        endTs: episode.endTs,

        lat: gps.lat,
        lon: gps.lon,

        startSoc:
          roundedSoc(
            episode.startSoc,
          ),

        endSoc:
          roundedSoc(
            episode.endSoc,
          ),

        /*
         * Charge_Energy_Added ist ein
         * kumulativer TeslaFi-Wert innerhalb
         * des Ladevorgangs. Deshalb verwenden
         * wir den höchsten beobachteten Wert
         * und bilden hier bewusst KEIN
         * Leistungsintegral.
         */
        energyAddedKwh:
          maxValue(
            episodeRows.map(
              (row) =>
                row
                  .chargeEnergyAddedKwh,
            ),
          ),

        maxPowerKw:
          maxValue(
            episodeRows.map(
              (row) =>
                row.chargerPowerKw,
            ),
          ),

        avgPowerKw:
          averageValue(
            episodeRows.map(
              (row) =>
                row.chargerPowerKw,
            ),
          ),

        durationSeconds:
          durationSeconds(
            episode.startTs,
            episode.endTs,
          ),

        fastChargerBrand:
          first.fastChargerBrand,

        fastChargerType:
          first.fastChargerType,

        connectedChargeCable:
          first.connectedChargeCable,

        sampleCount:
          episodeRows.length,

        chargePoints,
      };
    });

  return {
    importable: true,
    unsafeTimeRowCount: 0,
    drives,
    charges,
  };
}
