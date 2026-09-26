import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  previewTeslaFiCsv,
} from "./preview.js";

describe("TeslaFi preview unit normalization", () => {
  it("reports metric drive distance in kilometres", async () => {
    const csv = await readFile(
      new URL(
        "./fixtures/TeslaFi82026.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const result =
      previewTeslaFiCsv(
        csv,
        {
          distanceUnit: "metric",
        },
      );

    expect(result.driveEpisodes).toHaveLength(1);

    expect(
      result.driveEpisodes[0]!.distanceKm,
    ).toBeCloseTo(7.2, 6);
  });

  it("converts an imperial odometer distance to kilometres", () => {
    const csv = [
      "Date_Time,Odometer,Speed,Shift_State",
      "2026-08-01 12:00:00,100.0,30,D",
      "2026-08-01 12:10:00,105.0,30,D",
    ].join("\n");

    const result =
      previewTeslaFiCsv(
        csv,
        {
          distanceUnit: "imperial",
        },
      );

    expect(result.driveEpisodes).toHaveLength(1);

    expect(
      result.driveEpisodes[0]!.distanceKm,
    ).toBeCloseTo(
      8.04672,
      5,
    );
  });

  it("keeps metric values unchanged by default", async () => {
    const csv = await readFile(
      new URL(
        "./fixtures/TeslaFi82026.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const result =
      previewTeslaFiCsv(csv);

    expect(
      result.driveEpisodes[0]!.distanceKm,
    ).toBeCloseTo(7.2, 6);
  });
});
