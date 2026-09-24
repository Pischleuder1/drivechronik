import { describe, expect, it } from "vitest";

import {
  normalizeStatusIntervals,
  sumStatusDurations,
} from "./vehicleStateTimelineLogic";

function interval(
  kind: "asleep" | "online" | "offline" | "driving" | "charging",
  startHour: number,
  endHour: number,
) {
  return {
    kind,
    startTime: new Date(
      Date.UTC(2026, 8, 15, startHour),
    ),
    endTime: new Date(
      Date.UTC(2026, 8, 15, endHour),
    ),
  };
}

const dayStart = new Date(Date.UTC(2026, 8, 15, 0));
const dayEnd = new Date(Date.UTC(2026, 8, 16, 0));

describe("vehicle state timeline logic", () => {
  it("keeps a simple state interval", () => {
    const result = normalizeStatusIntervals(
      [interval("asleep", 0, 6)],
      dayStart,
      dayEnd,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("asleep");
  });

  it("lets driving override an overlapping online state", () => {
    const result = normalizeStatusIntervals(
      [
        interval("online", 6, 9),
        interval("driving", 7, 8),
      ],
      dayStart,
      dayEnd,
    );

    expect(result.map((row) => row.kind)).toEqual([
      "online",
      "driving",
      "online",
    ]);
  });

  it("lets charging override other vehicle states", () => {
    const result = normalizeStatusIntervals(
      [
        interval("online", 10, 13),
        interval("charging", 11, 12),
      ],
      dayStart,
      dayEnd,
    );

    expect(result.map((row) => row.kind)).toEqual([
      "online",
      "charging",
      "online",
    ]);
  });

  it("calculates durations after normalization", () => {
    const result = normalizeStatusIntervals(
      [
        interval("asleep", 0, 6),
        interval("online", 6, 8),
        interval("driving", 7, 8),
      ],
      dayStart,
      dayEnd,
    );

    const totals = sumStatusDurations(result);

    expect(totals.asleep).toBe(6 * 3600);
    expect(totals.online).toBe(1 * 3600);
    expect(totals.driving).toBe(1 * 3600);
  });
});
