import { describe, expect, it } from "vitest";
import { getDrivingChargingLegs } from "./drivingLegs";

describe("Fahrstrecken zwischen Ladestopps", () => {
  it("behält Straßenstrecken unverändert", () => {
    expect(getDrivingChargingLegs(
      [1000, 50000, 95000], [1], [],
    )).toEqual([1000, 145000]);
  });

  it("zieht eine Fähre innerhalb einer Ladeetappe ab", () => {
    expect(getDrivingChargingLegs(
      [40000, 20000, 60000], [1],
      [{ startM: 50000, endM: 70000 }],
    )).toEqual([40000, 60000]);
  });

  it("berücksichtigt eine Fähre über eine Etappengrenze", () => {
    expect(getDrivingChargingLegs(
      [40000, 30000], [1],
      [{ startM: 35000, endM: 45000 }],
    )).toEqual([35000, 25000]);
  });

  it("verwirft überlappende Fährabschnitte", () => {
    expect(getDrivingChargingLegs(
      [50000], [],
      [{ startM: 10000, endM: 20000 },
       { startM: 15000, endM: 25000 }],
    )).toBeNull();
  });
});

describe("Gesamtfahrstrecke", () => {
  it("entspricht der Strecke ohne Fährkilometer", () => {
    const legs = getDrivingChargingLegs(
      [40000, 20000, 60000],
      [1],
      [{ startM: 40000, endM: 60000 }],
    );

    expect(legs).not.toBeNull();
    expect(legs!.reduce((sum, km) => sum + km, 0))
      .toBe(100000);
  });
});
