export interface SourceVehicle {
  id: number;
  name: string | null;
  vin: string | null;
  model: string | null;
  trim_badging: string | null;
  efficiency: number | null;
}

export interface SourceDrive {
  id: number;
  car_id: number;
  start_time: Date;
  end_time: Date | null;
  start_km: number | null;
  end_km: number | null;
  distance: number | null;
  duration_min: number | null;
  ascent: number | null;
  descent: number | null;
  start_rated_range_km: number | null;
  end_rated_range_km: number | null;
  start_lat: number | null;
  start_lon: number | null;
  end_lat: number | null;
  end_lon: number | null;
  start_soc: number | null;
  end_soc: number | null;
  start_address: string | null;
  end_address: string | null;
  outside_temp_avg: number | null;
  inside_temp_avg: number | null;
  speed_max: number | null;
  power_max: number | null;
  power_min: number | null;
}

export interface SourceChargingProcess {
  id: number;
  car_id: number;
  start_time: Date;
  end_time: Date | null;
  charge_energy_added: number | null;
  charge_energy_used: number | null;
  start_battery_level: number | null;
  end_battery_level: number | null;
  duration_min: number | null;
  cost: number | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  max_power_kw: number | null;
  avg_power_kw: number | null;
  is_dc: boolean | null;
  outside_temp_avg: number | null;
}

export interface SourceGeofence {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface SourcePosition {
  date: Date;
  latitude: number;
  longitude: number;
  speed: number | null;
  odometer: number | null;
  soc: number | null;
}

export interface SourceLatestPosition {
  car_id: number;
  date: Date;
  latitude: number;
  longitude: number;
  soc: number | null;
  rated_range_km: number | null;
  odometer: number | null;
  tpms_pressure_fl: number | null;
  tpms_pressure_fr: number | null;
  tpms_pressure_rl: number | null;
  tpms_pressure_rr: number | null;
}

export interface SourceLatestState {
  car_id: number;
  state: string;
  start_date: Date;
}

export interface SourceChargePoint {
  date: Date;
  charger_power: number | null;
  soc: number | null;
  outside_temp: number | null;
}

export interface SourceSoftwareUpdate {
  id: number;
  car_id: number;
  start_time: Date;
  end_time: Date | null;
  version: string | null;
}

export interface SourceVehicleMetric {
  car_id: number;
  source_date: Date;
  bucket_ts: Date;
  soc: number | null;
  rated_range_km: number | null;
  odometer: number | null;
}

/**
 * Neutrale Datenquelle für Fahrzeug-Rohdaten.
 *
 * TeslaMate ist die erste Implementierung. Später kann hier z.B.
 * Tesla Fleet API / Fleet Telemetry ergänzt werden, ohne dass die
 * eigentliche DriveChronik-Sync-Logik die konkrete Quelle kennen muss.
 */
export interface VehicleDataSource {
  readonly source: string;

  probe(): Promise<void>;

  fetchVehicles(): Promise<SourceVehicle[]>;

  fetchCompletedDrivesSince(since: Date): Promise<SourceDrive[]>;
  fetchInProgressDrives(): Promise<SourceDrive[]>;

  fetchCompletedChargingProcessesSince(
    since: Date,
  ): Promise<SourceChargingProcess[]>;

  fetchInProgressChargingProcesses(): Promise<SourceChargingProcess[]>;

  fetchGeofences(): Promise<SourceGeofence[]>;

  fetchPositionsForDrive(
    carId: number,
    start: Date,
    end: Date,
  ): Promise<SourcePosition[]>;

  fetchLatestPositions(): Promise<SourceLatestPosition[]>;
  fetchLatestStates(): Promise<SourceLatestState[]>;

  fetchChargePoints(
    chargingProcessId: number,
  ): Promise<SourceChargePoint[]>;

  fetchSoftwareUpdates(): Promise<SourceSoftwareUpdate[]>;

  fetchVehicleMetricsSince(
    since: Date,
    limit: number,
  ): Promise<SourceVehicleMetric[]>;
}
