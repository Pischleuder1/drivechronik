import { describe, expect, it } from "vitest";

import {
  buildLocationRanking,
  buildSlowAlerts,
  durationBetweenSoc,
  median,
  timeAtSoc,
} from "./chargeAnalyticsLogic";
import type {
  ChargeAnalyticsPoint,
  ChargeAnalyticsSession,
} from "./chargeAnalyticsTypes";

function point(
  seconds: number,
  soc: number | null,
): ChargeAnalyticsPoint {
  return {
    ts: seconds * 1000,
    soc,
    powerKw: null,
    outsideTemp: null,
  };
}

function session(
  id: number,
  duration20to60: number,
  temp = 20,
  placeId = 1,
): ChargeAnalyticsSession {
  return {
    id,
    startTime: new Date(0),
    endTime: new Date(1),
    placeId,
    placeName: "Test-Lader",
    address: null,
    startSoc: 20,
    endSoc: 60,
    energyAddedKwh: 30,
    maxPowerKw: 150 + id,
    outsideTempAvg: temp,
    points: [
      point(0, 20),
      point(duration20to60, 60),
    ],
  };
}

describe("charge analytics logic", () => {
  it("calculates odd and even medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("interpolates the timestamp at a target SoC", () => {
    const points = [
      point(0, 8),
      point(60, 12),
    ];

    expect(timeAtSoc(points, 10)).toBe(30_000);
  });

  it("uses the earliest chronological SoC crossing", () => {
    const points = [
      point(0, 8),
      point(60, 12),
      point(120, 9),
      point(180, 10),
    ];

    expect(timeAtSoc(points, 10)).toBe(30_000);
  });

  it("calculates 10–80 duration using interpolation", () => {
    const points = [
      point(0, 8),
      point(60, 12),
      point(600, 78),
      point(660, 82),
    ];

    expect(durationBetweenSoc(points, 10, 80)).toBe(600);
  });

  it("returns null if the requested SoC window is not covered", () => {
    const points = [
      point(0, 30),
      point(300, 70),
    ];

    expect(durationBetweenSoc(points, 10, 80)).toBeNull();
  });

  it("groups sessions by charging location", () => {
    const sessions = [
      session(1, 600, 20, 1),
      session(2, 660, 21, 1),
      session(3, 620, 20, 2),
    ];

    const ranking = buildLocationRanking(sessions);

    expect(ranking).toHaveLength(2);
    expect(ranking[0]?.sessionCount).toBe(2);
    expect(ranking[0]?.medianPeakKw).toBe(151.5);
  });

  it("does not flag a slow charge without enough peers", () => {
    expect(
      buildSlowAlerts([
        session(1, 600),
        session(2, 620),
        session(3, 1200),
      ]),
    ).toEqual([]);
  });

  it("flags a materially slower charge when enough peers exist", () => {
    const alerts = buildSlowAlerts([
      session(1, 600),
      session(2, 610),
      session(3, 620),
      session(4, 1100),
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.sessionId).toBe(4);
    expect(alerts[0]?.ratio).toBeGreaterThan(1.25);
  });

  it("uses temperature peers when at least three are available", () => {
    const alerts = buildSlowAlerts([
      session(1, 600, 20),
      session(2, 610, 21),
      session(3, 620, 19),
      session(4, 1000, 20),
      session(5, 1100, -10),
      session(6, 1150, -12),
      session(7, 1200, -11),
    ]);

    expect(alerts.some((alert) => alert.sessionId === 4)).toBe(true);
  });
});
