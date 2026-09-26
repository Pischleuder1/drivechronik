import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildTeslaFiImportPlan,
} from "./import-plan.js";

import {
  normalizeTeslaFiRow,
  type TeslaFiNormalizedRow,
} from "./normalized.js";

function row(
  values: Record<string, string>,
): TeslaFiNormalizedRow {
  const result =
    normalizeTeslaFiRow(
      (name) =>
        values[name] ?? null,
      {
        timeZone:
          "Europe/Berlin",
        distanceUnit: "metric",
      },
    );

  if (!result) {
    throw new Error(
      "Test row normalization failed",
    );
  }

  return result;
}

describe(
  "buildTeslaFiImportPlan",
  () => {
    it("builds a drive with route points", () => {
      const rows = [
        row({
          Date_Time:
            "2026-08-01 12:00:00",
          Odometer: "1000.0",
          Speed: "0",
          Latitude: "52.1",
          Longitude: "8.6",
          Battery_Level: "80",
          Shift_State: "D",
        }),
        row({
          Date_Time:
            "2026-08-01 12:01:00",
          Odometer: "1000.8",
          Speed: "50",
          Latitude: "52.2",
          Longitude: "8.7",
          Battery_Level: "79",
          Shift_State: "D",
        }),
        row({
          Date_Time:
            "2026-08-01 12:02:00",
          Odometer: "1001.6",
          Speed: "60",
          Latitude: "52.3",
          Longitude: "8.8",
          Battery_Level: "78",
          Shift_State: "D",
        }),
      ];

      const plan =
        buildTeslaFiImportPlan(rows);

      expect(plan.importable).toBe(
        true,
      );

      expect(plan.drives).toHaveLength(
        1,
      );

      const drive = plan.drives[0]!;

      expect(drive.sourceId).toBe(
        "drive:2026-08-01T10:00:00.000Z",
      );

      expect(
        drive.startOdometerKm,
      ).toBe(1000);

      expect(
        drive.endOdometerKm,
      ).toBe(1001.6);

      expect(drive.distanceKm).toBeCloseTo(
        1.6,
        8,
      );

      expect(
        drive.durationSeconds,
      ).toBe(120);

      expect(drive.startSoc).toBe(80);
      expect(drive.endSoc).toBe(78);
      expect(drive.speedMaxKmh).toBe(60);

      expect(
        drive.routePoints,
      ).toHaveLength(3);

      expect(
        drive.routePoints[0]?.ts,
      ).toBe(
        Date.parse(
          "2026-08-01T10:00:00.000Z",
        ),
      );
    });

    it("builds a charging session and charge points", () => {
      const rows = [
        row({
          Date_Time:
            "2026-08-01 13:00:00",
          Odometer: "1010",
          Battery_Level: "30",
          Charge_Energy_Added: "0",
          Charger_Actual_Current: "0",
          Charger_Power: "0",
          Charge_Rate: "0",
          Latitude: "52.1",
          Longitude: "8.6",
        }),
        row({
          Date_Time:
            "2026-08-01 13:01:00",
          Odometer: "1010",
          Battery_Level: "31",
          Charge_Energy_Added: "0.1",
          Charger_Actual_Current: "16",
          Charger_Power: "11",
          Charge_Rate: "40",
          Latitude: "52.1",
          Longitude: "8.6",
        }),
        row({
          Date_Time:
            "2026-08-01 13:02:00",
          Odometer: "1010",
          Battery_Level: "32",
          Charge_Energy_Added: "0.3",
          Charger_Actual_Current: "16",
          Charger_Power: "11",
          Charge_Rate: "40",
          Latitude: "52.1",
          Longitude: "8.6",
        }),
      ];

      const plan =
        buildTeslaFiImportPlan(rows);

      expect(plan.charges).toHaveLength(
        1,
      );

      const charge =
        plan.charges[0]!;

      expect(charge.sourceId).toBe(
        "charge:2026-08-01T11:01:00.000Z",
      );

      expect(charge.startSoc).toBe(31);
      expect(charge.endSoc).toBe(32);

      expect(
        charge.energyAddedKwh,
      ).toBeCloseTo(
        0.3,
        8,
      );

      expect(charge.maxPowerKw).toBe(
        11,
      );

      expect(charge.avgPowerKw).toBe(
        11,
      );

      expect(
        charge.chargePoints,
      ).toHaveLength(2);
    });

    it("blocks the entire plan when a timestamp is ambiguous", () => {
      const safe = row({
        Date_Time:
          "2026-10-25 03:10:00",
        Odometer: "1001",
        Speed: "50",
        Shift_State: "D",
      });

      const ambiguous = row({
        Date_Time:
          "2026-10-25 02:30:00",
        Odometer: "1000",
        Speed: "50",
        Shift_State: "D",
      });

      const plan =
        buildTeslaFiImportPlan([
          ambiguous,
          safe,
        ]);

      expect(plan.importable).toBe(
        false,
      );

      expect(
        plan.unsafeTimeRowCount,
      ).toBe(1);

      expect(plan.drives).toEqual([]);
      expect(plan.charges).toEqual([]);
    });

    it("requires real UTC timestamps for persistence plans", () => {
      const result =
        normalizeTeslaFiRow(
          (name) => {
            const values:
              Record<string, string> = {
                Date_Time:
                  "2026-08-01 12:00:00",
                Odometer: "1000",
                Speed: "50",
                Shift_State: "D",
              };

            return values[name] ?? null;
          },
          {
            distanceUnit: "metric",
          },
        );

      if (!result) {
        throw new Error(
          "Test row normalization failed",
        );
      }

      const plan =
        buildTeslaFiImportPlan([
          result,
        ]);

      expect(plan.importable).toBe(
        false,
      );

      expect(
        plan.unsafeTimeRowCount,
      ).toBe(1);
    });
  },
);
