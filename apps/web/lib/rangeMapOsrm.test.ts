import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_OSRM_SNAP_DISTANCE_M,
  parseOsrmTableDistances,
} from "./rangeMapOsrm";

describe("parseOsrmTableDistances", () => {
  it("converts OSRM distances from metres to kilometres", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200, 25300, null]],
          destinations: [
            { distance: 12 },
            { distance: 80 },
            { distance: 0 },
          ],
        },
        3,
      ),
    ).toEqual([1.2, 25.3, null]);
  });

  it("rejects destinations that OSRM snapped too far away", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200, 25300]],
          destinations: [
            { distance: 25 },
            { distance: MAX_OSRM_SNAP_DISTANCE_M + 1 },
          ],
        },
        2,
      ),
    ).toEqual([1.2, null]);
  });

  it("keeps a destination exactly at the snap limit", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[50000]],
          destinations: [
            { distance: MAX_OSRM_SNAP_DISTANCE_M },
          ],
        },
        1,
      ),
    ).toEqual([50]);
  });

  it("treats a destination without usable snap metadata as unreachable", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200, 25300]],
          destinations: [
            { distance: 10 },
            {},
          ],
        },
        2,
      ),
    ).toEqual([1.2, null]);
  });

  it("rejects an unexpected number of destinations", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200]],
          destinations: [{ distance: 10 }],
        },
        2,
      ),
    ).toBeNull();
  });

  it("rejects malformed distance values", () => {
    expect(
      parseOsrmTableDistances(
        {
          code: "Ok",
          distances: [[1200, -1]],
          destinations: [
            { distance: 10 },
            { distance: 10 },
          ],
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
          destinations: [{ distance: 10 }],
        },
        1,
      ),
    ).toBeNull();
  });
});
