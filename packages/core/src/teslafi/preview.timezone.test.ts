import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  previewTeslaFiCsv,
} from "./preview.js";

describe("TeslaFi preview timezone integration", () => {
  it("adds UTC information when a timezone is supplied", async () => {
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
          timeZone: "Europe/Berlin",
        },
      );

    expect(result.timePreview).not.toBeNull();

    expect(
      result.timePreview?.validTimeZone,
    ).toBe(true);

    expect(
      result.timePreview?.convertedRows,
    ).toBe(15);

    expect(
      result.timePreview?.invalidRows,
    ).toBe(0);

    expect(
      result.timePreview?.ambiguousRows,
    ).toBe(0);

    expect(
      result.timePreview?.minUtcIso,
    ).toBe(
      "2026-08-01T10:00:00.000Z",
    );

    expect(
      result.timePreview?.maxUtcIso,
    ).toBe(
      "2026-08-01T11:04:00.000Z",
    );
  });

  it("keeps timezone preview optional", () => {
    const csv = [
      "Date_Time,Odometer",
      "2026-08-01 12:00:00,1000",
    ].join("\n");

    const result =
      previewTeslaFiCsv(csv);

    expect(result.timePreview).toBeNull();
  });
});
