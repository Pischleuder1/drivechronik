import { describe, expect, it } from "vitest";
import {
  buildDailyTpmsHistory,
  detectTpmsSlowLeak,
  type DailyTpmsPoint,
} from "./tpmsHistoryLogic";

function day(
  index: number,
  values: Partial<
    Pick<DailyTpmsPoint, "fl" | "fr" | "rl" | "rr">
  > = {},
): DailyTpmsPoint {
  return {
    ts: new Date(
      Date.UTC(2026, 7, 1 + index, 12, 0, 0),
    ),
    fl: values.fl ?? 2.9,
    fr: values.fr ?? 2.9,
    rl: values.rl ?? 2.9,
    rr: values.rr ?? 2.9,
  };
}

describe("TPMS history", () => {
  it("verdichtet mehrere Messungen eines Tages über den Median", () => {
    const result = buildDailyTpmsHistory([
      {
        ts: new Date("2026-08-01T08:00:00Z"),
        tpmsFlBar: 2.8,
        tpmsFrBar: 2.9,
        tpmsRlBar: 2.9,
        tpmsRrBar: 2.9,
      },
      {
        ts: new Date("2026-08-01T12:00:00Z"),
        tpmsFlBar: 3.0,
        tpmsFrBar: 2.9,
        tpmsRlBar: 2.9,
        tpmsRrBar: 2.9,
      },
      {
        ts: new Date("2026-08-01T18:00:00Z"),
        tpmsFlBar: 2.9,
        tpmsFrBar: 2.9,
        tpmsRlBar: 2.9,
        tpmsRrBar: 2.9,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.fl).toBe(2.9);
    expect(result[0]!.ts.toISOString()).toBe(
      "2026-08-01T18:00:00.000Z",
    );
  });

  it("warnt nicht bei gemeinsamem temperaturbedingtem Druckabfall", () => {
    const history = Array.from({ length: 30 }, (_, i) => {
      const pressure = 3.0 - (i / 29) * 0.3;
      return day(i, {
        fl: pressure,
        fr: pressure,
        rl: pressure,
        rr: pressure,
      });
    });

    expect(
      detectTpmsSlowLeak(history, { windowDays: 30 }),
    ).toEqual([]);
  });

  it("erkennt einen relativen schleichenden Verlust hinten links", () => {
    const history = Array.from({ length: 30 }, (_, i) =>
      day(i, {
        fl: 2.9,
        fr: 2.9,
        rl: 2.9 - (i / 29) * 0.35,
        rr: 2.9,
      }),
    );

    const result = detectTpmsSlowLeak(history, {
      windowDays: 30,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.tire).toBe("rl");
    expect(result[0]!.dropBar).toBeGreaterThan(0.2);
    expect(result[0]!.peerDifferenceBar).toBeLessThan(-0.15);
  });

  it("ignoriert einen einzelnen Ausreißer", () => {
    const history = Array.from({ length: 30 }, (_, i) =>
      day(i, {
        rl: i === 29 ? 2.5 : 2.9,
      }),
    );

    expect(
      detectTpmsSlowLeak(history, { windowDays: 30 }),
    ).toEqual([]);
  });

  it("warnt nicht bei zu kurzer Historie", () => {
    const history = Array.from({ length: 7 }, (_, i) =>
      day(i, {
        rl: 2.9 - i * 0.05,
      }),
    );

    expect(
      detectTpmsSlowLeak(history, { windowDays: 30 }),
    ).toEqual([]);
  });
});
