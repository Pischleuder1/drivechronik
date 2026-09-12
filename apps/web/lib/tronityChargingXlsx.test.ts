import { describe, expect, it } from "vitest";

import {
  parseTronityChargingSheetData,
} from "./tronityChargingXlsx";

const headers = [
  "Typ",
  "Start Datum",
  "Ende Datum",
  "Start Level",
  "Ende Level",
  "Dauer",
  "AC",
  "Geladen (kWh)",
  "Geladen gesamt (kWh)",
  "Batterie (kWh)",
  "Reichweite (km)",
  "Max (kW)",
  "CO2 (kg)",
  "CO₂ Ges. (kg)",
  "Kosten (EUR)",
  "Kilometer (km)",
  "Kategorien",
  "Ladetarif",
  "Adresse",
  "Ladepunkt",
  "Breitengrad",
  "Längengrad",
  "Bemerkung",
];

describe("parseTronityChargingSheetData", () => {
  it("parses a German TRONITY charging export", () => {
    const rows = parseTronityChargingSheetData(
      [
        headers,
        [
          "Privat",
          "07.07.2026 17:49",
          "07.07.2026 19:44",
          null,
          null,
          "01:55",
          true,
          16.73,
          16.73,
          null,
          null,
          null,
          0.5,
          null,
          5.02,
          null,
          "27",
          null,
          "Tramplerstraße 17, 77933 Lahr/Schwarzwald",
          "27",
          48.335208,
          7.864459,
          "27",
        ],
        [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "27",
        ],
      ],
      "Europe/Berlin",
    );

    expect(rows).toHaveLength(1);

    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      type: "Privat",
      startSoc: null,
      endSoc: null,
      durationSeconds: 6900,
      chargerType: "ac",
      energyKwh: 16.73,
      energyTotalKwh: 16.73,
      cost: 5.02,
      address:
        "Tramplerstraße 17, 77933 Lahr/Schwarzwald",
      chargingPoint: "27",
      lat: 48.335208,
      lon: 7.864459,
      notes: "27",
    });

    // 17:49 Uhr Ortszeit im Juli = 15:49 UTC.
    expect(rows[0]?.startTime.toISOString()).toBe(
      "2026-07-07T15:49:00.000Z",
    );

    expect(rows[0]?.endTime.toISOString()).toBe(
      "2026-07-07T17:44:00.000Z",
    );
  });

  it("maps AC=false to DC", () => {
    const rows = parseTronityChargingSheetData(
      [
        headers,
        [
          "Privat",
          "01.01.2026 10:00",
          "01.01.2026 10:30",
          20,
          70,
          "00:30",
          false,
          30,
          31,
          60,
          200,
          150,
          null,
          null,
          12.5,
          12345,
          null,
          null,
          "Test",
          "Test Charger",
          52.5,
          9.7,
          null,
        ],
      ],
      "Europe/Berlin",
    );

    expect(rows[0]?.chargerType).toBe("dc");
    expect(rows[0]?.startSoc).toBe(20);
    expect(rows[0]?.endSoc).toBe(70);
    expect(rows[0]?.energyKwh).toBe(30);
    expect(rows[0]?.energyTotalKwh).toBe(31);
    expect(rows[0]?.maxPowerKw).toBe(150);
  });

  it("rejects exports without the required columns", () => {
    expect(() =>
      parseTronityChargingSheetData(
        [["Typ", "Start Datum"]],
        "Europe/Berlin",
      ),
    ).toThrow(
      "Spalte „Ende Datum“ fehlt",
    );
  });
});
