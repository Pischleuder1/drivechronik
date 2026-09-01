import { describe, expect, it } from "vitest";

import {
  dayFilename,
  driveFilename,
  journeyFilename,
  monthFilename,
  yearFilename,
} from "./filenames";

describe("export filenames", () => {
  it("uses DriveChronik branding for drive exports", () => {
    expect(driveFilename("2026-09-01", 42, "pdf")).toBe(
      "drivechronik-fahrt-2026-09-01-42.pdf",
    );
  });

  it("uses DriveChronik branding for day exports", () => {
    expect(dayFilename("2026-09-01", "csv")).toBe(
      "drivechronik-tag-2026-09-01.csv",
    );
  });

  it("includes the classification in business month exports", () => {
    expect(
      monthFilename("2026-09", "pdf", ["business"]),
    ).toBe(
      "drivechronik-monat-2026-09-geschaeftlich.pdf",
    );
  });

  it("uses the simple filename for an unfiltered month export", () => {
    expect(monthFilename("2026-09", "csv")).toBe(
      "drivechronik-monat-2026-09.csv",
    );
  });

  it("creates the business year report filename", () => {
    expect(yearFilename("2026", "pdf")).toBe(
      "drivechronik-jahr-2026-geschaeftlich.pdf",
    );
    expect(yearFilename("2026", "csv")).toBe(
      "drivechronik-jahr-2026-geschaeftlich.csv",
    );
  });

  it("creates a DriveChronik journey filename", () => {
    expect(
      journeyFilename(12, "Alpen Rundfahrt", "gpx"),
    ).toBe(
      "drivechronik-reise-alpen-rundfahrt-12.gpx",
    );
  });
});
