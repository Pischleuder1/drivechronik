export interface TeslaMateSchemaColumn {
  tableName: string;
  columnName: string;
}

export const REQUIRED_TESLAMATE_SCHEMA: Record<string, readonly string[]> = {
  cars: ["id", "name", "vin", "model", "trim_badging", "efficiency"],
  drives: [
    "id",
    "car_id",
    "start_date",
    "end_date",
    "start_km",
    "end_km",
    "distance",
    "duration_min",
    "ascent",
    "descent",
    "start_rated_range_km",
    "end_rated_range_km",
    "start_position_id",
    "end_position_id",
    "start_address_id",
    "end_address_id",
    "start_geofence_id",
    "end_geofence_id",
    "outside_temp_avg",
    "inside_temp_avg",
    "speed_max",
    "power_max",
    "power_min",
  ],
  positions: [
    "id",
    "car_id",
    "latitude",
    "longitude",
    "battery_level",
    "usable_battery_level",
    "date",
    "speed",
    "odometer",
    "rated_battery_range_km",
    "tpms_pressure_fl",
    "tpms_pressure_fr",
    "tpms_pressure_rl",
    "tpms_pressure_rr",
  ],
  addresses: [
    "id",
    "name",
    "road",
    "house_number",
    "city",
    "display_name",
  ],
  charging_processes: [
    "id",
    "car_id",
    "start_date",
    "end_date",
    "charge_energy_added",
    "charge_energy_used",
    "start_battery_level",
    "end_battery_level",
    "duration_min",
    "position_id",
    "address_id",
    "geofence_id",
    "cost",
    "outside_temp_avg",
  ],
  charges: [
    "charging_process_id",
    "charger_power",
    "fast_charger_present",
    "date",
    "battery_level",
    "usable_battery_level",
    "outside_temp",
  ],
  geofences: ["id", "name", "latitude", "longitude", "radius"],
  states: ["car_id", "state", "start_date"],
  updates: ["id", "car_id", "start_date", "end_date", "version"],
};

export function findMissingTeslaMateColumns(
  columns: readonly TeslaMateSchemaColumn[],
): string[] {
  const available = new Set(
    columns.map((column) => `${column.tableName}.${column.columnName}`),
  );

  const missing: string[] = [];

  for (const [table, requiredColumns] of Object.entries(
    REQUIRED_TESLAMATE_SCHEMA,
  )) {
    for (const column of requiredColumns) {
      const key = `${table}.${column}`;
      if (!available.has(key)) missing.push(key);
    }
  }

  return missing;
}
