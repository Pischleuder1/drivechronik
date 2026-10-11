import { describe, expect, it } from "vitest";
import { recalculateStops } from "./recalculateStops";

describe("Bestehende Ladestopps neu berechnen", () => {
  it("behält eine fahrbare Mehrstoppfolge bei", () => {
    const stops = recalculateStops(
      [140000, 120000, 35000], 80, 62, 80, 20,
    );

    expect(stops).toHaveLength(2);
    expect(stops![0]!.arrivalSoc).toBeGreaterThan(10);
    expect(stops![1]!.departureSoc).toBeLessThanOrEqual(90);
  });

  it("verwirft einen unerreichbaren ersten Schnelllader", () => {
    expect(recalculateStops(
      [200000, 50000], 30, 62, 75, 20,
    )).toBeNull();
  });

  it("unterstützt niedrige Startladung", () => {
    const stops = recalculateStops(
      [850, 20000], 3, 62, 3, 20,
    );

    expect(stops).toHaveLength(1);
    expect(stops![0]!.arrivalSoc).toBeGreaterThan(0);
  });

  it("verwirft unmögliche Etappen", () => {
    expect(recalculateStops(
      [100000, 250000, 20000], 80, 62, 100, 20,
    )).toBeNull();
  });
});
