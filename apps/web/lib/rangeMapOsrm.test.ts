import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseOsrmTableDistances } from "./rangeMapOsrm";

describe("parseOsrmTableDistances", () => {
  it("converts OSRM distances from metres to kilometres", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200, 25300, null]],
        },
        3,
      ),
    ).toEqual([1.2, 25.3, null]);
  });

  it("rejects an unexpected number of destinations", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200]],
        },
        2,
      ),
    ).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200, -1]],
        },
        2,
      ),
    ).toBeNull();
  });

  it("rejects non-Ok OSRM responses", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "NoTable",
          distances: [[1200]],
        },
        1,
      ),
    ).toBeNull();
  });
});
