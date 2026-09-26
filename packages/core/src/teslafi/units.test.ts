import {
  describe,
  expect,
  it,
} from "vitest";

import {
  teslaFiOdometerToKm,
  teslaFiSpeedToKmh,
} from "./units.js";

describe("TeslaFi unit conversion", () => {
  it("keeps metric odometer values unchanged", () => {
    expect(
      teslaFiOdometerToKm(
        12500.8,
        "metric",
      ),
    ).toBe(12500.8);
  });

  it("converts miles to kilometres", () => {
    expect(
      teslaFiOdometerToKm(
        100,
        "imperial",
      ),
    ).toBeCloseTo(
      160.9344,
      6,
    );
  });

  it("keeps km/h unchanged", () => {
    expect(
      teslaFiSpeedToKmh(
        50,
        "metric",
      ),
    ).toBe(50);
  });

  it("converts mph to km/h", () => {
    expect(
      teslaFiSpeedToKmh(
        60,
        "imperial",
      ),
    ).toBeCloseTo(
      96.56064,
      6,
    );
  });

  it("preserves missing values", () => {
    expect(
      teslaFiOdometerToKm(
        null,
        "metric",
      ),
    ).toBeNull();

    expect(
      teslaFiSpeedToKmh(
        null,
        "imperial",
      ),
    ).toBeNull();
  });
});
