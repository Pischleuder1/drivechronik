import {
  readFile,
} from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildTeslaFiImportPlan,
} from "./import-plan.js";

import {
  parseTeslaFiNormalizedCsv,
} from "./normalized-csv.js";

describe(
  "TeslaFi82026 persistence plan",
  () => {
    it("builds the expected UTC-safe import plan", async () => {
      const csv = await readFile(
        new URL(
          "./fixtures/TeslaFi82026.csv",
          import.meta.url,
        ),
        "utf8",
      );

      const parsed =
        parseTeslaFiNormalizedCsv(
          csv,
          {
            timeZone:
              "Europe/Berlin",
            distanceUnit:
              "metric",
          },
        );

      expect(
        parsed.missingRequiredHeaders,
      ).toEqual([]);

      expect(parsed.rowCount).toBe(15);
      expect(parsed.validRows).toBe(15);
      expect(parsed.invalidRows).toBe(0);

      expect(parsed.rows).toHaveLength(
        15,
      );

      expect(
        parsed.rows[0]?.utcMs,
      ).toBe(
        Date.parse(
          "2026-08-01T10:00:00.000Z",
        ),
      );

      expect(
        parsed.rows[
          parsed.rows.length - 1
        ]?.utcMs,
      ).toBe(
        Date.parse(
          "2026-08-01T11:04:00.000Z",
        ),
      );

      const plan =
        buildTeslaFiImportPlan(
          parsed.rows,
        );

      expect(plan.importable).toBe(
        true,
      );

      expect(
        plan.unsafeTimeRowCount,
      ).toBe(0);

      expect(plan.drives).toHaveLength(
        1,
      );

      expect(plan.charges).toHaveLength(
        1,
      );

      const drive =
        plan.drives[0]!;

      expect(drive.sourceId).toBe(
        "drive:2026-08-01T10:00:00.000Z",
      );

      expect(drive.startTs).toBe(
        Date.parse(
          "2026-08-01T10:00:00.000Z",
        ),
      );

      expect(drive.endTs).toBe(
        Date.parse(
          "2026-08-01T10:09:00.000Z",
        ),
      );

      expect(
        drive.distanceKm,
      ).toBeCloseTo(
        7.2,
        8,
      );

      expect(
        drive.sampleCount,
      ).toBe(10);

      expect(
        drive.routePoints.length,
      ).toBeGreaterThan(0);

      expect(
        drive.routePoints[0]?.ts,
      ).toBe(
        Date.parse(
          "2026-08-01T10:00:00.000Z",
        ),
      );

      const charge =
        plan.charges[0]!;

      expect(charge.sourceId).toBe(
        "charge:2026-08-01T11:01:00.000Z",
      );

      expect(charge.startTs).toBe(
        Date.parse(
          "2026-08-01T11:01:00.000Z",
        ),
      );

      expect(charge.endTs).toBe(
        Date.parse(
          "2026-08-01T11:04:00.000Z",
        ),
      );

      expect(charge.startSoc).toBe(
        80,
      );

      expect(charge.endSoc).toBe(
        85,
      );

      expect(
        charge.sampleCount,
      ).toBe(4);

      expect(
        charge.chargePoints,
      ).toHaveLength(4);

      /*
       * Die kurze Fixture besitzt kein
       * Charger_Power-Feld.
       *
       * Das TeslaFi-Feld Power darf deshalb
       * niemals als Ladeleistung verwendet
       * werden.
       */
      expect(
        charge.maxPowerKw,
      ).toBeNull();

      expect(
        charge.avgPowerKw,
      ).toBeNull();
    });
  },
);
