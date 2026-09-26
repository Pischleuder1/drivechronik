import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  previewTeslaFiCsv,
} from "./preview.js";

describe("TeslaFi preview episodes", () => {
  it("reports drive and charge episodes in dry-run preview", async () => {
    const csv = await readFile(
      new URL(
        "./fixtures/TeslaFi82026.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const result =
      previewTeslaFiCsv(csv);

    expect(result.driveEpisodes).toHaveLength(1);

    expect(result.driveEpisodes[0]).toMatchObject({
      startDateTime:
        "2026-08-01 12:00:00",
      endDateTime:
        "2026-08-01 12:09:00",
      sampleCount: 10,
    });

    expect(
      result.driveEpisodes[0]!.distanceKm,
    ).toBeCloseTo(7.2, 6);

    expect(result.chargeEpisodes).toHaveLength(1);

    expect(result.chargeEpisodes[0]).toEqual({
      startDateTime:
        "2026-08-01 13:01:00",
      endDateTime:
        "2026-08-01 13:04:00",
      startSoc: 80,
      endSoc: 85,
      maxPowerKw: 0,
      sampleCount: 4,
    });
  });
});
