import { describe, expect, it } from "vitest";
import { normalizeFerryWaypoints } from "./ferryWaypoints";

describe("Virtuelle Fährhäfen", () => {
  const sassnitz = { lat: 54.486071, lon: 13.587807 };
  const mukran = { lat: 54.511852, lon: 13.628776 };
  const ronne = { lat: 55.099583, lon: 14.692352 };

  it("verschiebt Mukran vor den Hafen Sassnitz", () => {
    expect(normalizeFerryWaypoints(
      [sassnitz, mukran, ronne], sassnitz, ronne,
    )).toEqual([mukran, sassnitz, ronne]);
  });

  it("erhält die Richtung Bornholm nach Deutschland", () => {
    expect(normalizeFerryWaypoints(
      [ronne, mukran, sassnitz], sassnitz, ronne,
    )).toEqual([ronne, sassnitz, mukran]);
  });

  it("verwirft unklare Ladestopps auf der Fähre", () => {
    expect(normalizeFerryWaypoints(
      [sassnitz, { lat: 54.8, lon: 14.1 }, ronne],
      sassnitz, ronne,
    )).toBeNull();
  });
});
