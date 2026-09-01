import { describe, expect, it } from "vitest";

import { computeRouteStats } from "./driveRouteStats";

describe("computeRouteStats", () => {
  it("returns empty route metrics for no points", () => {
    expect(computeRouteStats([])).toEqual({
      gpsDistanceKm: null,
      recordingDurationSeconds: null,
      avgIntervalSeconds: null,
      avgSpeedKmh: null,
      maxSpeedKmh: null,
      startSoc: null,
      endSoc: null,
    });
  });

  it("computes distance, duration, interval and speed", () => {
    const stats = computeRouteStats([
      {
        lat: 0,
        lon: 0,
        ts: new Date("2026-01-01T10:00:00Z"),
        speedKmh: 20,
        soc: 80,
      },
      {
        lat: 0,
        lon: 0.001,
        ts: new Date("2026-01-01T10:00:15Z"),
        speedKmh: 42,
        soc: null,
      },
      {
        lat: 0,
        lon: 0.002,
        ts: new Date("2026-01-01T10:00:30Z"),
        speedKmh: 30,
        soc: 78,
      },
    ]);

    expect(stats.gpsDistanceKm).toBeCloseTo(0.222, 2);
    expect(stats.recordingDurationSeconds).toBe(30);
    expect(stats.avgIntervalSeconds).toBe(15);
    expect(stats.avgSpeedKmh).toBeCloseTo(26.7, 1);
    expect(stats.maxSpeedKmh).toBe(42);
    expect(stats.startSoc).toBe(80);
    expect(stats.endSoc).toBe(78);
  });

  it("uses the first and last available SoC", () => {
    const stats = computeRouteStats([
      {
        lat: 52,
        lon: 8,
        ts: new Date("2026-01-01T10:00:00Z"),
        speedKmh: null,
        soc: null,
      },
      {
        lat: 52,
        lon: 8.001,
        ts: new Date("2026-01-01T10:00:15Z"),
        speedKmh: null,
        soc: 65,
      },
      {
        lat: 52,
        lon: 8.002,
        ts: new Date("2026-01-01T10:00:30Z"),
        speedKmh: null,
        soc: null,
      },
    ]);

    expect(stats.startSoc).toBe(65);
    expect(stats.endSoc).toBe(65);
    expect(stats.maxSpeedKmh).toBeNull();
  });
});
