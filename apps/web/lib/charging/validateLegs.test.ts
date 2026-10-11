import { describe, expect, it } from "vitest";
import { validateChargingLegs } from "./validateLegs";

describe("Energiebilanz der Ladeetappen", () => {
  const legs = [1000, 145000, 94000];
  const stops = [
    { arrivalSoc: 2.5, departureSoc: 80 },
    { arrivalSoc: 9.5, departureSoc: 66 },
  ];

  it("akzeptiert eine fahrbare Mehrstopp-Route", () => {
    expect(validateChargingLegs(
      legs, stops, 3, 62, 72, 20,
    )).toBe(true);
  });

  it("verwirft einen falschen Ankunfts-SoC", () => {
    const wrong = [
      { ...stops[0], arrivalSoc: 15 },
      stops[1],
    ];
    expect(validateChargingLegs(
      legs, wrong, 3, 62, 72, 20,
    )).toBe(false);
  });

  it("verwirft eine fehlende OSRM-Teilstrecke", () => {
    expect(validateChargingLegs(
      [1000, 239000], stops, 3, 62, 72, 20,
    )).toBe(false);
  });

  it("verwirft ungültige Akkustände", () => {
    expect(validateChargingLegs(
      [1000, 239000],
      [{ arrivalSoc: 2.5, departureSoc: 120 }],
      3, 62, 72, 20,
    )).toBe(false);
  });

  it("verwirft ungültige Energieangaben", () => {
    expect(validateChargingLegs(
      [1000, 239000],
      [{ arrivalSoc: 2.5, departureSoc: 80 }],
      3, 62, Number.NaN, 20,
    )).toBe(false);
  });

});
