import {
  describe,
  expect,
  it,
} from "vitest";

import {
  previewTeslaFiCsv,
} from "./preview.js";

describe("previewTeslaFiCsv", () => {
  it("recognizes a reduced TeslaFi CSV with original headers", () => {
    const csv = [
      [
        "Date",
        "Date_Format",
        "Date_Time",
        "Latitude",
        "Longitude",
        "Speed",
        "Odometer",
        "Battery_Level",
        "Usable_Battery_Level",
        "Charge_Energy_Added",
        "Power",
        "Heading",
        "Elevation",
        "Inside_Temp",
        "Outside_Temp",
        "Fan_Status",
        "Climate_On",
        "Is_Climate_On",
      ].join(","),

      "2026-08-01 12:00:00,YYYY-MM-DD HH:MM:SS,2026-08-01 12:00:00,52.521,13.4065,0,12500.0,79,79,0.0,0,45,45,21.5,24.0,1,0,0",

      "2026-08-01 12:01:00,YYYY-MM-DD HH:MM:SS,2026-08-01 12:01:00,52.522,13.4080,50,12500.8,79,79,0.0,-15,45,45,21.5,24.0,1,0,0",

      "2026-08-01 12:02:00,YYYY-MM-DD HH:MM:SS,2026-08-01 12:02:00,52.523,13.4095,50,12501.6,78,78,0.0,-15,45,45,21.5,24.0,1,0,0",
    ].join("\n");

    const result =
      previewTeslaFiCsv(csv);

    expect(result.recognized).toBe(true);
    expect(result.headerCount).toBe(18);
    expect(result.knownHeaderCount).toBe(18);

    expect(result.rowCount).toBe(3);
    expect(result.validRows).toBe(3);
    expect(result.invalidRows).toBe(0);

    expect(result.gpsRows).toBe(3);
    expect(result.movingRows).toBe(2);

    expect(result.minDateTime).toBe(
      "2026-08-01 12:00:00",
    );

    expect(result.maxDateTime).toBe(
      "2026-08-01 12:02:00",
    );
  });

  it("detects charging activity from TeslaFi charger fields", () => {
    const csv = [
      [
        "Date_Time",
        "Odometer",
        "Battery_Level",
        "Charge_Energy_Added",
        "Charger_Actual_Current",
        "Charger_Power",
        "Charger_Voltage",
        "Charge_Rate",
      ].join(","),

      "2026-08-01 13:00:00,12510.0,30,0.0,0,0,230,0",
      "2026-08-01 13:01:00,12510.0,31,0.1,16,11,230,40",
      "2026-08-01 13:02:00,12510.0,32,0.3,16,11,230,40",
    ].join("\n");

    const result =
      previewTeslaFiCsv(csv);

    expect(result.recognized).toBe(true);
    expect(result.validRows).toBe(3);
    expect(result.chargingRows).toBe(2);
    expect(result.capabilities.charging).toBe(true);
  });

  it("tolerates unknown future TeslaFi columns", () => {
    const csv = [
      "Date_Time,Odometer,Battery_Level,Future_Field",
      "2026-08-01 12:00:00,1000.0,80,test",
    ].join("\n");

    const result =
      previewTeslaFiCsv(csv);

    expect(result.unknownHeaders).toEqual([
      "Future_Field",
    ]);
  });

  it("marks malformed data rows as invalid instead of crashing", () => {
    const csv = [
      "Date_Time,Odometer,Battery_Level",
      "2026-08-01 12:00:00,1000.0,80",
      "not-a-date,1001.0,79",
      "2026-08-01 12:02:00,not-a-number,79",
    ].join("\n");

    const result =
      previewTeslaFiCsv(csv);

    expect(result.rowCount).toBe(3);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(2);
  });

  it("parses the TeslaFi82026 regression fixture", async () => {
    const { readFile } = await import("node:fs/promises");

    const csv = await readFile(
      new URL(
        "./fixtures/TeslaFi82026.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const result =
      previewTeslaFiCsv(csv);

    expect(result.recognized).toBe(true);

    expect(result.headerCount).toBe(18);
    expect(result.knownHeaderCount).toBe(18);

    expect(result.rowCount).toBe(15);
    expect(result.validRows).toBe(15);
    expect(result.invalidRows).toBe(0);

    expect(result.gpsRows).toBe(15);
    expect(result.movingRows).toBe(10);
    expect(result.chargingRows).toBe(4);

    expect(result.minDateTime).toBe(
      "2026-08-01 12:00:00",
    );

    expect(result.maxDateTime).toBe(
      "2026-08-01 13:04:00",
    );

    expect(result.capabilities.gps).toBe(true);
    expect(result.capabilities.speed).toBe(true);
    expect(result.capabilities.odometer).toBe(true);
    expect(result.capabilities.soc).toBe(true);
    expect(result.capabilities.charging).toBe(true);

    expect(result.vehicleIds).toEqual([]);
    expect(result.displayNames).toEqual([]);
  });


  it("segments across a DST spring jump on the UTC timeline", () => {
    const csv = [
      [
        "Date_Time",
        "Odometer",
        "Speed",
        "Battery_Level",
        "Charge_Energy_Added",
        "Charger_Actual_Current",
        "Charger_Power",
        "Shift_State",
      ].join(","),
      "2026-03-29 01:58:00,1000.0,50,80,0,0,0,D",
      "2026-03-29 03:02:00,1001.0,50,79,0,0,0,D",
    ].join("\n");

    const result =
      previewTeslaFiCsv(
        csv,
        {
          timeZone:
            "Europe/Berlin",
        },
      );

    expect(
      result.timePreview?.invalidRows,
    ).toBe(0);

    expect(
      result.timePreview?.ambiguousRows,
    ).toBe(0);

    expect(
      result.driveEpisodes,
    ).toHaveLength(1);

    expect(
      result.driveEpisodes[0]?.sampleCount,
    ).toBe(2);

    expect(
      result.driveEpisodes[0]?.startDateTime,
    ).toBe(
      "2026-03-29 01:58:00",
    );

    expect(
      result.driveEpisodes[0]?.endDateTime,
    ).toBe(
      "2026-03-29 03:02:00",
    );
  });

  it("excludes ambiguous DST rows from segmentation", () => {
    const csv = [
      [
        "Date_Time",
        "Odometer",
        "Speed",
        "Battery_Level",
        "Charge_Energy_Added",
        "Charger_Actual_Current",
        "Charger_Power",
        "Shift_State",
      ].join(","),
      "2026-10-25 02:30:00,1000.0,50,80,0,0,0,D",
      "2026-10-25 03:10:00,1001.0,50,79,0,0,0,D",
    ].join("\n");

    const result =
      previewTeslaFiCsv(
        csv,
        {
          timeZone:
            "Europe/Berlin",
        },
      );

    expect(
      result.timePreview?.ambiguousRows,
    ).toBe(1);

    expect(
      result.driveEpisodes,
    ).toHaveLength(1);

    expect(
      result.driveEpisodes[0]?.sampleCount,
    ).toBe(1);

    expect(
      result.driveEpisodes[0]?.startDateTime,
    ).toBe(
      "2026-10-25 03:10:00",
    );

    expect(
      result.driveEpisodes[0]?.endDateTime,
    ).toBe(
      "2026-10-25 03:10:00",
    );
  });

});
