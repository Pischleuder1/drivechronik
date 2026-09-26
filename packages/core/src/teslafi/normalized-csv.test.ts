import {
  readFile,
} from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseTeslaFiNormalizedCsv,
} from "./normalized-csv.js";

describe(
  "parseTeslaFiNormalizedCsv",
  () => {
    it("normalizes the TeslaFi82026 fixture", async () => {
      const csv = await readFile(
        new URL(
          "./fixtures/TeslaFi82026.csv",
          import.meta.url,
        ),
        "utf8",
      );

      const result =
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
        result.missingRequiredHeaders,
      ).toEqual([]);

      expect(result.rowCount).toBe(15);
      expect(result.validRows).toBe(15);
      expect(result.invalidRows).toBe(0);
      expect(result.rows).toHaveLength(15);

      expect(
        result.rows[0]?.localDateTime,
      ).toBe(
        "2026-08-01 12:00:00",
      );

      expect(
        result.rows[0]?.utcMs,
      ).toBe(
        Date.parse(
          "2026-08-01T10:00:00.000Z",
        ),
      );

      expect(
        result.rows[
          result.rows.length - 1
        ]?.utcMs,
      ).toBe(
        Date.parse(
          "2026-08-01T11:04:00.000Z",
        ),
      );
    });

    it("counts malformed and invalid rows without crashing", () => {
      const csv = [
        [
          "Date_Time",
          "Odometer",
          "Speed",
        ].join(","),

        "2026-08-01 12:00:00,1000,50",

        "not-a-date,1001,50",

        "2026-08-01 12:02:00,not-a-number,50",

        "2026-08-01 12:03:00,1003",
      ].join("\n");

      const result =
        parseTeslaFiNormalizedCsv(
          csv,
          {
            timeZone:
              "Europe/Berlin",
            distanceUnit:
              "metric",
          },
        );

      expect(result.rowCount).toBe(4);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(3);

      expect(result.rows).toHaveLength(
        1,
      );
    });

    it("reports missing required headers", () => {
      const csv = [
        "Date_Time,Speed",
        "2026-08-01 12:00:00,50",
      ].join("\n");

      const result =
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
        result.missingRequiredHeaders,
      ).toEqual([
        "Odometer",
      ]);

      expect(result.rowCount).toBe(1);
      expect(result.validRows).toBe(0);
      expect(result.invalidRows).toBe(1);
    });
  },
);
