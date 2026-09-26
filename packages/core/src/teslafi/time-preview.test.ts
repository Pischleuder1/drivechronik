import {
  describe,
  expect,
  it,
} from "vitest";

import {
  previewTeslaFiTimes,
} from "./time-preview.js";

describe("TeslaFi time preview", () => {
  it("converts a summer period to UTC", () => {
    const result =
      previewTeslaFiTimes(
        [
          "2026-08-01 12:00:00",
          "2026-08-01 13:04:00",
        ],
        "Europe/Berlin",
      );

    expect(result.validTimeZone).toBe(true);

    expect(result.convertedRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(result.ambiguousRows).toBe(0);

    expect(result.minUtcIso).toBe(
      "2026-08-01T10:00:00.000Z",
    );

    expect(result.maxUtcIso).toBe(
      "2026-08-01T11:04:00.000Z",
    );
  });

  it("counts nonexistent DST timestamps as invalid", () => {
    const result =
      previewTeslaFiTimes(
        [
          "2026-03-29 01:59:00",
          "2026-03-29 02:30:00",
          "2026-03-29 03:01:00",
        ],
        "Europe/Berlin",
      );

    expect(result.convertedRows).toBe(2);
    expect(result.invalidRows).toBe(1);
  });

  it("counts ambiguous autumn timestamps", () => {
    const result =
      previewTeslaFiTimes(
        [
          "2026-10-25 01:59:00",
          "2026-10-25 02:30:00",
          "2026-10-25 03:01:00",
        ],
        "Europe/Berlin",
      );

    expect(result.convertedRows).toBe(3);
    expect(result.invalidRows).toBe(0);
    expect(result.ambiguousRows).toBe(1);
  });

  it("rejects an invalid timezone", () => {
    const result =
      previewTeslaFiTimes(
        [
          "2026-08-01 12:00:00",
        ],
        "Europe/Invalid",
      );

    expect(result.validTimeZone).toBe(false);
    expect(result.convertedRows).toBe(0);
    expect(result.invalidRows).toBe(1);
  });
});
