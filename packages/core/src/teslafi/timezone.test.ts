import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isValidIanaTimeZone,
  teslaFiLocalTimeToUtc,
} from "./timezone.js";

describe("TeslaFi timezone conversion", () => {
  it("converts Berlin summer time to UTC", () => {
    const result =
      teslaFiLocalTimeToUtc(
        "2026-08-01 12:00:00",
        "Europe/Berlin",
      );

    expect(result.valid).toBe(true);
    expect(result.ambiguous).toBe(false);

    expect(result.iso).toBe(
      "2026-08-01T10:00:00.000Z",
    );
  });

  it("converts Berlin winter time to UTC", () => {
    const result =
      teslaFiLocalTimeToUtc(
        "2026-01-15 12:00:00",
        "Europe/Berlin",
      );

    expect(result.valid).toBe(true);
    expect(result.ambiguous).toBe(false);

    expect(result.iso).toBe(
      "2026-01-15T11:00:00.000Z",
    );
  });

  it("rejects a nonexistent spring DST time", () => {
    const result =
      teslaFiLocalTimeToUtc(
        "2026-03-29 02:30:00",
        "Europe/Berlin",
      );

    expect(result.valid).toBe(false);
    expect(result.utcMs).toBeNull();
    expect(result.iso).toBeNull();
  });

  it("marks the repeated autumn hour as ambiguous", () => {
    const result =
      teslaFiLocalTimeToUtc(
        "2026-10-25 02:30:00",
        "Europe/Berlin",
      );

    expect(result.valid).toBe(true);
    expect(result.ambiguous).toBe(true);

    expect([
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ]).toContain(result.iso);
  });

  it("rejects an invalid IANA timezone", () => {
    expect(
      isValidIanaTimeZone(
        "Europe/DoesNotExist",
      ),
    ).toBe(false);

    const result =
      teslaFiLocalTimeToUtc(
        "2026-08-01 12:00:00",
        "Europe/DoesNotExist",
      );

    expect(result.valid).toBe(false);
  });
});
