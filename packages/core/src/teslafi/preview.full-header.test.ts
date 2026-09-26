import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  previewTeslaFiCsv,
  TESLAFI_KNOWN_HEADERS,
} from "./preview.js";

describe("TeslaFi full 76-column export", () => {
  it("recognizes all documented TeslaFi columns", async () => {
    const csv = await readFile(
      new URL(
        "./fixtures/TeslaFi-full-header.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const result =
      previewTeslaFiCsv(csv);

    expect(
      TESLAFI_KNOWN_HEADERS.length,
    ).toBe(76);

    expect(result.recognized).toBe(true);

    expect(result.headerCount).toBe(76);
    expect(result.knownHeaderCount).toBe(76);

    expect(result.unknownHeaders).toEqual([]);
    expect(result.missingKnownHeaders).toEqual([]);
    expect(result.missingRequiredHeaders).toEqual([]);

    expect(result.rowCount).toBe(3);
    expect(result.validRows).toBe(3);
    expect(result.invalidRows).toBe(0);

    expect(result.gpsRows).toBe(3);
    expect(result.movingRows).toBe(1);
    expect(result.chargingRows).toBe(1);

    expect(result.vehicleIds).toEqual([
      "123456789",
    ]);

    expect(result.displayNames).toEqual([
      "Demo TeslaFi",
    ]);

    expect(result.minDateTime).toBe(
      "2026-08-01 12:00:00",
    );

    expect(result.maxDateTime).toBe(
      "2026-08-01 13:00:00",
    );

    expect(result.capabilities).toEqual({
      gps: true,
      speed: true,
      odometer: true,
      soc: true,
      charging: true,
      shiftState: true,
      vehicleState: true,
      climate: true,
      tpms: true,
      navigation: true,
      vehicleIdentity: true,
    });
  });
});
