import { describe, expect, it, vi } from "vitest";

import { probeTeslamateSchema, type TeslamateSql } from "./client.js";

function makeSql(columns: string[]): TeslamateSql {
  const rows = columns.map((entry) => {
    const [table_name, column_name] = entry.split(".");
    return { table_name, column_name };
  });

  const sql = vi.fn(async () => rows);

  return sql as unknown as TeslamateSql;
}

const REQUIRED = [
  "cars.id",
  "cars.name",
  "cars.vin",
  "cars.model",
  "cars.trim_badging",
  "cars.efficiency",

  "drives.id",
  "drives.car_id",
  "drives.start_date",
  "drives.end_date",
  "drives.start_km",
  "drives.end_km",
  "drives.distance",
  "drives.duration_min",
  "drives.ascent",
  "drives.descent",
  "drives.start_rated_range_km",
  "drives.end_rated_range_km",
  "drives.start_position_id",
  "drives.end_position_id",
  "drives.start_address_id",
  "drives.end_address_id",
  "drives.start_geofence_id",
  "drives.end_geofence_id",
  "drives.outside_temp_avg",
  "drives.inside_temp_avg",
  "drives.speed_max",
  "drives.power_max",
  "drives.power_min",

  "positions.id",
  "positions.car_id",
  "positions.latitude",
  "positions.longitude",
  "positions.battery_level",
  "positions.usable_battery_level",
  "positions.date",
  "positions.speed",
  "positions.odometer",
  "positions.rated_battery_range_km",
  "positions.tpms_pressure_fl",
  "positions.tpms_pressure_fr",
  "positions.tpms_pressure_rl",
  "positions.tpms_pressure_rr",

  "addresses.id",
  "addresses.name",
  "addresses.road",
  "addresses.house_number",
  "addresses.city",
  "addresses.display_name",

  "charging_processes.id",
  "charging_processes.car_id",
  "charging_processes.start_date",
  "charging_processes.end_date",
  "charging_processes.charge_energy_added",
  "charging_processes.charge_energy_used",
  "charging_processes.start_battery_level",
  "charging_processes.end_battery_level",
  "charging_processes.duration_min",
  "charging_processes.position_id",
  "charging_processes.address_id",
  "charging_processes.geofence_id",
  "charging_processes.cost",
  "charging_processes.outside_temp_avg",

  "charges.charging_process_id",
  "charges.charger_power",
  "charges.fast_charger_present",
  "charges.date",
  "charges.battery_level",
  "charges.usable_battery_level",
  "charges.outside_temp",

  "geofences.id",
  "geofences.name",
  "geofences.latitude",
  "geofences.longitude",
  "geofences.radius",

  "states.id",
  "states.car_id",
  "states.state",
  "states.start_date",
  "states.end_date",

  "updates.id",
  "updates.car_id",
  "updates.start_date",
  "updates.end_date",
  "updates.version",
];

describe("probeTeslamateSchema", () => {
  it("accepts a complete compatible TeslaMate schema", async () => {
    const sql = makeSql(REQUIRED);

    await expect(probeTeslamateSchema(sql)).resolves.toBeUndefined();
  });

  it("reports missing required columns", async () => {
    const sql = makeSql(
      REQUIRED.filter(
        (column) =>
          column !== "states.state" &&
          column !== "positions.rated_battery_range_km",
      ),
    );

    await expect(probeTeslamateSchema(sql)).rejects.toThrow(
      "states.state",
    );

    await expect(probeTeslamateSchema(sql)).rejects.toThrow(
      "positions.rated_battery_range_km",
    );
  });

  it("reports charging_processes.duration_min as required", async () => {
    const sql = makeSql(
      REQUIRED.filter(
        (column) => column !== "charging_processes.duration_min",
      ),
    );

    await expect(probeTeslamateSchema(sql)).rejects.toThrow(
      "charging_processes.duration_min",
    );
  });
});
