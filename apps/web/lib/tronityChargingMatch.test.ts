import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  TronityChargingRow,
} from "./tronityChargingXlsx";

import {
  buildTronityMergePatch,
  chooseTronityChargeMatch,
  type TronityChargeCandidate,
} from "./tronityChargingMatch";

function row(
  overrides: Partial<TronityChargingRow> = {},
): TronityChargingRow {
  return {
    rowNumber: 2,

    type: "Privat",

    startTime: new Date(
      "2026-07-07T15:49:00.000Z",
    ),

    endTime: new Date(
      "2026-07-07T17:44:00.000Z",
    ),

    startSoc: 30,
    endSoc: 70,

    durationSeconds: 6900,

    chargerType: "ac",

    energyKwh: 16.73,
    energyTotalKwh: 16.73,

    batteryKwh: null,
    rangeKm: null,

    maxPowerKw: 11,

    co2Kg: null,
    co2TotalKg: null,

    cost: 5.02,
    odometerKm: null,

    categories: null,
    chargingRate: null,

    address:
      "Tramplerstraße 17, 77933 Lahr/Schwarzwald",

    chargingPoint: "27",

    lat: 48.335208,
    lon: 7.864459,

    notes: "TRONITY-Test",

    ...overrides,
  };
}

function candidate(
  overrides: Partial<TronityChargeCandidate> = {},
): TronityChargeCandidate {
  return {
    id: 100,

    startTime: new Date(
      "2026-07-07T15:50:00.000Z",
    ),

    endTime: new Date(
      "2026-07-07T17:45:00.000Z",
    ),

    lat: 48.3353,
    lon: 7.8645,

    placeId: null,
    placeLocked: false,

    address:
      "Tramplerstraße 17, 77933 Lahr/Schwarzwald",

    startSoc: 30,
    endSoc: 70,

    energyAddedKwh: 16.5,
    energyUsedKwh: null,

    maxPowerKw: 11,
    chargerType: "ac",
    durationSeconds: 6900,

    cost: null,
    currency: null,
    costSource: null,

    notes: null,

    source: "teslamate",
    sourceId: "123",

    ...overrides,
  };
}

describe("chooseTronityChargeMatch", () => {
  it("finds the best existing charging session", () => {
    const result =
      chooseTronityChargeMatch(
        row(),
        [
          candidate({
            id: 1,
            startTime: new Date(
              "2026-07-07T16:05:00.000Z",
            ),
          }),
          candidate({
            id: 2,
            startTime: new Date(
              "2026-07-07T15:50:00.000Z",
            ),
          }),
        ],
      );

    expect(result.status).toBe(
      "matched",
    );

    expect(
      result.chargeSessionId,
    ).toBe(2);
  });

  it("marks nearly identical candidates as ambiguous", () => {
    const result =
      chooseTronityChargeMatch(
        row(),
        [
          candidate({
            id: 1,
          }),
          candidate({
            id: 2,
            startTime: new Date(
              "2026-07-07T15:50:20.000Z",
            ),
          }),
        ],
      );

    expect(result.status).toBe(
      "ambiguous",
    );

    expect(
      result.chargeSessionId,
    ).toBeNull();
  });

  it("rejects candidates outside the matching window", () => {
    const result =
      chooseTronityChargeMatch(
        row(),
        [
          candidate({
            startTime: new Date(
              "2026-07-07T14:00:00.000Z",
            ),
          }),
        ],
      );

    expect(result.status).toBe(
      "unmatched",
    );
  });

  it("rejects a candidate at a clearly different location", () => {
    const result =
      chooseTronityChargeMatch(
        row(),
        [
          candidate({
            lat: 52.3759,
            lon: 9.732,
          }),
        ],
      );

    expect(result.status).toBe(
      "unmatched",
    );
  });
});

describe("buildTronityMergePatch", () => {
  it("fills missing values but keeps existing TeslaMate data", () => {
    const patch =
      buildTronityMergePatch(
        row(),
        candidate({
          address: null,
          startSoc: null,
          endSoc: 69,
          energyAddedKwh: null,
          maxPowerKw: null,
          chargerType: null,
        }),
      );

    expect(patch.address).toBe(
      "Tramplerstraße 17, 77933 Lahr/Schwarzwald",
    );

    expect(patch.startSoc).toBe(30);

    expect(patch.endSoc).toBeUndefined();

    expect(
      patch.energyAddedKwh,
    ).toBe(16.73);

    expect(patch.maxPowerKw).toBe(11);

    expect(patch.chargerType).toBe(
      "ac",
    );
  });

  it("never overwrites manual costs or existing notes", () => {
    const patch =
      buildTronityMergePatch(
        row({
          cost: 5.02,
          notes: "Neue TRONITY-Notiz",
        }),
        candidate({
          cost: "9.99",
          currency: "EUR",
          costSource: "manual",
          notes: "Meine Notiz",
        }),
      );

    expect(patch.cost).toBeUndefined();

    expect(
      patch.currency,
    ).toBeUndefined();

    expect(
      patch.costSource,
    ).toBeUndefined();

    expect(patch.notes).toBeUndefined();
  });

  it("replaces automatic costs with actual TRONITY costs", () => {
    const patch =
      buildTronityMergePatch(
        row({
          cost: 5.02,
        }),
        candidate({
          cost: "4.50",
          currency: "EUR",
          costSource: "auto",
        }),
      );

    expect(patch.cost).toBe("5.02");

    expect(patch.currency).toBe("EUR");

    expect(
      patch.costSource,
    ).toBe("synced");
  });
});
