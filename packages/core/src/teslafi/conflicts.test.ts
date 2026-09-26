import {
  describe,
  expect,
  it,
} from "vitest";

import {
  findTeslaFiIntervalConflicts,
  teslaFiIntervalsOverlap,
} from "./conflicts.js";

const minute = 60_000;

describe("TeslaFi conflict detection", () => {
  it("detects an overlapping existing drive", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        10,
        0,
        0,
      );

    expect(
      teslaFiIntervalsOverlap(
        {
          startMs: base,
          endMs: base + 10 * minute,
        },
        {
          id: 1,
          source: "teslamate",
          startMs: base + 2 * minute,
          endMs: base + 9 * minute,
        },
      ),
    ).toBe(true);
  });

  it("does not match separate intervals", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        10,
        0,
        0,
      );

    expect(
      teslaFiIntervalsOverlap(
        {
          startMs: base,
          endMs: base + 10 * minute,
        },
        {
          id: 2,
          source: "teslamate",
          startMs: base + 20 * minute,
          endMs: base + 30 * minute,
        },
      ),
    ).toBe(false);
  });

  it("treats an open existing interval as overlapping future time", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        10,
        0,
        0,
      );

    expect(
      teslaFiIntervalsOverlap(
        {
          startMs: base + 10 * minute,
          endMs: base + 20 * minute,
        },
        {
          id: 3,
          source: "teslamate",
          startMs: base,
          endMs: null,
        },
      ),
    ).toBe(true);
  });

  it("reports conflicts per candidate episode", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        10,
        0,
        0,
      );

    const result =
      findTeslaFiIntervalConflicts(
        [
          {
            startMs: base,
            endMs: base + 10 * minute,
          },
          {
            startMs: base + 30 * minute,
            endMs: base + 40 * minute,
          },
        ],
        [
          {
            id: 10,
            source: "teslamate",
            startMs: base + minute,
            endMs: base + 9 * minute,
          },
          {
            id: 11,
            source: "tessie",
            startMs: base + 31 * minute,
            endMs: base + 39 * minute,
          },
        ],
      );

    expect(result).toHaveLength(2);

    expect(result[0]!.conflicts).toEqual([
      {
        id: 10,
        source: "teslamate",
        startMs: base + minute,
        endMs: base + 9 * minute,
      },
    ]);

    expect(result[1]!.conflicts).toEqual([
      {
        id: 11,
        source: "tessie",
        startMs: base + 31 * minute,
        endMs: base + 39 * minute,
      },
    ]);
  });

  it("rejects reversed candidate intervals", () => {
    expect(() =>
      findTeslaFiIntervalConflicts(
        [
          {
            startMs: 2000,
            endMs: 1000,
          },
        ],
        [],
      ),
    ).toThrow(
      "Ungültiges TeslaFi-Kandidatenintervall",
    );
  });
});
