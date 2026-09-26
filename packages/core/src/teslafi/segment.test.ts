import {
  describe,
  expect,
  it,
} from "vitest";

import {
  segmentTeslaFiCharges,
  segmentTeslaFiDrives,
} from "./segment.js";

const minute = 60 * 1000;

describe("segmentTeslaFiDrives", () => {
  it("detects separate driving episodes", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        12,
        0,
        0,
      );

    const result =
      segmentTeslaFiDrives([
        {
          ts: base,
          shift: "P",
          speed: 0,
          odometer: 1000,
        },
        {
          ts: base + minute,
          shift: "D",
          speed: 20,
          odometer: 1000.2,
        },
        {
          ts: base + 2 * minute,
          shift: "D",
          speed: 40,
          odometer: 1000.7,
        },
        {
          ts: base + 3 * minute,
          shift: "P",
          speed: 0,
          odometer: 1000.7,
        },
        {
          ts: base + 9 * minute,
          shift: "P",
          speed: 0,
          odometer: 1000.7,
        },
        {
          ts: base + 20 * minute,
          shift: "D",
          speed: 30,
          odometer: 1001.0,
        },
        {
          ts: base + 21 * minute,
          shift: "D",
          speed: 30,
          odometer: 1001.5,
        },
      ]);

    expect(result).toHaveLength(2);

    expect(result[0]!.startTs).toBe(
      base + minute,
    );

    expect(result[0]!.endTs).toBe(
      base + 2 * minute,
    );

    expect(result[1]!.startTs).toBe(
      base + 20 * minute,
    );

    expect(result[1]!.endTs).toBe(
      base + 21 * minute,
    );
  });

  it("uses speed and odometer as fallbacks", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        12,
        0,
        0,
      );

    const result =
      segmentTeslaFiDrives([
        {
          ts: base,
          shift: null,
          speed: 0,
          odometer: 2000,
        },
        {
          ts: base + minute,
          shift: null,
          speed: 10,
          odometer: 2000.1,
        },
        {
          ts: base + 2 * minute,
          shift: null,
          speed: 0,
          odometer: 2000.2,
        },
      ]);

    expect(result).toHaveLength(1);
  });
});

describe("segmentTeslaFiCharges", () => {
  it("detects charging activity from multiple signals", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        13,
        0,
        0,
      );

    const result =
      segmentTeslaFiCharges([
        {
          ts: base,
          powerKw: 0,
          currentA: 0,
          chargeRate: 0,
          energyAdded: 0,
          soc: 30,
        },
        {
          ts: base + minute,
          powerKw: 11,
          currentA: 16,
          chargeRate: 50,
          energyAdded: 0.5,
          soc: 31,
        },
        {
          ts: base + 2 * minute,
          powerKw: 11,
          currentA: 16,
          chargeRate: 50,
          energyAdded: 1.0,
          soc: 32,
        },
        {
          ts: base + 3 * minute,
          powerKw: 0,
          currentA: 0,
          chargeRate: 0,
          energyAdded: 1.0,
          soc: 32,
        },
        {
          ts: base + 12 * minute,
          powerKw: 7,
          currentA: 10,
          chargeRate: 30,
          energyAdded: 1.5,
          soc: 33,
        },
      ]);

    expect(result).toHaveLength(1);

    expect(result[0]!.startTs).toBe(
      base + minute,
    );

    expect(result[0]!.endTs).toBe(
      base + 12 * minute,
    );

    expect(result[0]!.startSoc).toBe(31);
    expect(result[0]!.endSoc).toBe(33);
    expect(result[0]!.maxPowerKw).toBe(11);
  });

  it("splits charging episodes after a long gap", () => {
    const base =
      Date.UTC(
        2026,
        7,
        1,
        13,
        0,
        0,
      );

    const result =
      segmentTeslaFiCharges([
        {
          ts: base,
          powerKw: 11,
          currentA: 16,
          chargeRate: 50,
          energyAdded: 1,
          soc: 40,
        },
        {
          ts: base + 5 * minute,
          powerKw: 11,
          currentA: 16,
          chargeRate: 50,
          energyAdded: 2,
          soc: 42,
        },
        {
          ts: base + 30 * minute,
          powerKw: 11,
          currentA: 16,
          chargeRate: 50,
          energyAdded: 1,
          soc: 50,
        },
      ]);

    expect(result).toHaveLength(2);
  });
});
