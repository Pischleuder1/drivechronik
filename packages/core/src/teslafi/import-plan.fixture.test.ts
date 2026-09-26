import {
  readFile,
} from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseCsvLine,
} from "../tessie/parse.js";

import {
  buildTeslaFiImportPlan,
} from "./import-plan.js";

import {
  normalizeTeslaFiRow,
  type TeslaFiNormalizedRow,
} from "./normalized.js";

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

      const lines = csv
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter(
          (line) =>
            line.trim().length > 0,
        );

      const headers =
        parseCsvLine(
          lines[0]!,
        ).map(
          (value) =>
            value?.trim() ?? "",
        );

      const headerMap =
        new Map<string, number>();

      headers.forEach(
        (header, index) => {
          if (
            header !== "" &&
            !headerMap.has(header)
          ) {
            headerMap.set(
              header,
              index,
            );
          }
        },
      );

      const rows:
        TeslaFiNormalizedRow[] = [];

      let invalidRows = 0;

      for (
        let lineIndex = 1;
        lineIndex < lines.length;
        lineIndex += 1
      ) {
        const fields =
          parseCsvLine(
            lines[lineIndex]!,
          );

        if (
          fields.length !==
          headers.length
        ) {
          invalidRows++;
          continue;
        }

        const field = (
          name: string,
        ): string | null => {
          const index =
            headerMap.get(name);

          if (index == null) {
            return null;
          }

          return (
            fields[index] ?? null
          );
        };

        const normalized =
          normalizeTeslaFiRow(
            field,
            {
              timeZone:
                "Europe/Berlin",
              distanceUnit:
                "metric",
              lineNumber:
                lineIndex + 1,
            },
          );

        if (!normalized) {
          invalidRows++;
          continue;
        }

        rows.push(normalized);
      }

      expect(invalidRows).toBe(0);
      expect(rows).toHaveLength(15);

      expect(rows[0]?.utcMs).toBe(
        Date.parse(
          "2026-08-01T10:00:00.000Z",
        ),
      );

      expect(
        rows[rows.length - 1]?.utcMs,
      ).toBe(
        Date.parse(
          "2026-08-01T11:04:00.000Z",
        ),
      );

      const plan =
        buildTeslaFiImportPlan(
          rows,
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
       * Die kurze Regression-Fixture besitzt
       * kein Charger_Power-Feld. Deshalb darf
       * aus dem normalen TeslaFi-Power-Feld
       * keine Ladeleistung abgeleitet werden.
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
