import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeTeslaFiRow,
} from "./normalized.js";

function reader(
  values: Record<string, string>,
) {
  return (name: string): string | null =>
    values[name] ?? null;
}

describe("normalizeTeslaFiRow", () => {
  it("normalizes a metric TeslaFi row to UTC", () => {
    const row = normalizeTeslaFiRow(
      reader({
        Date_Time:
          "2026-08-01 12:00:00",
        Odometer: "12500.8",
        Speed: "50",
        Latitude: "52.521",
        Longitude: "13.4065",
        Battery_Level: "79",
        Power: "-15",
        Charger_Power: "11",
        Charger_Actual_Current: "16",
        Charger_Voltage: "230",
        Charge_Energy_Added: "4.4",
        Shift_State: "D",
      }),
      {
        timeZone: "Europe/Berlin",
        distanceUnit: "metric",
        lineNumber: 2,
      },
    );

    expect(row).not.toBeNull();

    expect(row?.utcMs).toBe(
      Date.parse(
        "2026-08-01T10:00:00.000Z",
      ),
    );

    expect(row?.segmentTimestamp).toBe(
      row?.utcMs,
    );

    expect(row?.odometerKm).toBe(
      12500.8,
    );

    expect(row?.speedKmh).toBe(50);
    expect(row?.lat).toBe(52.521);
    expect(row?.lon).toBe(13.4065);
    expect(row?.soc).toBe(79);

    expect(row?.vehiclePowerRaw).toBe(
      -15,
    );

    expect(row?.chargerPowerKw).toBe(
      11,
    );

    expect(row?.lineNumber).toBe(2);
  });

  it("keeps Power separate from Charger_Power", () => {
    const row = normalizeTeslaFiRow(
      reader({
        Date_Time:
          "2026-08-01 13:01:00",
        Odometer: "12510",
        Power: "-22",
        Charger_Power: "150",
      }),
      {
        timeZone: "Europe/Berlin",
      },
    );

    expect(row?.vehiclePowerRaw).toBe(
      -22,
    );

    expect(row?.chargerPowerKw).toBe(
      150,
    );
  });

  it("blocks an ambiguous autumn timestamp from the UTC timeline", () => {
    const row = normalizeTeslaFiRow(
      reader({
        Date_Time:
          "2026-10-25 02:30:00",
        Odometer: "1000",
        Speed: "50",
      }),
      {
        timeZone: "Europe/Berlin",
      },
    );

    expect(row).not.toBeNull();
    expect(row?.timeValid).toBe(true);
    expect(row?.timeAmbiguous).toBe(
      true,
    );

    expect(row?.utcMs).toBeNull();
    expect(
      row?.segmentTimestamp,
    ).toBeNull();
  });

  it("blocks a nonexistent spring timestamp from the UTC timeline", () => {
    const row = normalizeTeslaFiRow(
      reader({
        Date_Time:
          "2026-03-29 02:30:00",
        Odometer: "1000",
        Speed: "50",
      }),
      {
        timeZone: "Europe/Berlin",
      },
    );

    expect(row).not.toBeNull();
    expect(row?.timeValid).toBe(false);
    expect(row?.timeAmbiguous).toBe(
      false,
    );

    expect(row?.utcMs).toBeNull();
    expect(
      row?.segmentTimestamp,
    ).toBeNull();
  });

  it("rejects structurally invalid required values", () => {
    expect(
      normalizeTeslaFiRow(
        reader({
          Date_Time: "not-a-date",
          Odometer: "1000",
        }),
      ),
    ).toBeNull();

    expect(
      normalizeTeslaFiRow(
        reader({
          Date_Time:
            "2026-08-01 12:00:00",
          Odometer: "not-a-number",
        }),
      ),
    ).toBeNull();
  });
});
