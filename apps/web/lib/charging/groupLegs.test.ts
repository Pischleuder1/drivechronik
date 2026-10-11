import { describe, expect, it } from "vitest";
import { groupChargingLegs } from "./groupLegs";

describe("OSRM-Legs zu Ladeetappen zusammenfassen", () => {
  it("fasst Legs vor einem Schnelllader zusammen", () => {
    expect(groupChargingLegs(
      [30000, 40000, 80000], [2],
    )).toEqual([70000, 80000]);
  });

  it("unterstützt mehrere Schnelllader", () => {
    expect(groupChargingLegs(
      [1000, 50000, 95000, 94000], [1, 3],
    )).toEqual([1000, 145000, 94000]);
  });

  it("verwirft doppelte oder ungeordnete Positionen", () => {
    expect(groupChargingLegs(
      [1000, 50000, 95000], [2, 2],
    )).toBeNull();

    expect(groupChargingLegs(
      [1000, 50000, 95000], [3, 1],
    )).toBeNull();
  });

  it("verwirft ungültige OSRM-Distanzen", () => {
    expect(groupChargingLegs(
      [1000, Number.NaN, 50000], [1],
    )).toBeNull();
  });
});
