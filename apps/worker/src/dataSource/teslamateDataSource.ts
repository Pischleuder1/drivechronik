import {
  createTeslamateClient,
  probeTeslamateSchema,
  type TeslamateSql,
} from "../teslamate/client.js";

import {
  fetchCars,
  fetchCompletedChargingProcessesSince,
  fetchCompletedDrivesSince,
  fetchGeofences,
  fetchInProgressChargingProcesses,
  fetchInProgressDrives,
  fetchLatestPositions,
  fetchLatestStates,
  fetchVehicleStatePeriodsSince,
  fetchChargesForProcess,
  fetchPositionsForDrive,
  fetchUpdates,
  fetchVehicleMetricsSince,
} from "../teslamate/queries.js";

import type {
  SourceChargePoint,
  SourceChargingProcess,
  SourceDrive,
  SourceGeofence,
  SourceLatestPosition,
  SourceLatestState,
  SourceVehicleStatePeriod,
  SourcePosition,
  SourceSoftwareUpdate,
  SourceVehicle,
  SourceVehicleMetric,
  VehicleDataSource,
} from "./vehicleDataSource.js";

/**
 * Adapter zwischen der bisherigen TeslaMate-PostgreSQL-Datenquelle
 * und der neutralen VehicleDataSource-Schnittstelle.
 *
 * Noch findet keinerlei Datenkonvertierung statt:
 * Die heute verwendeten TeslaMate-Abfragen bleiben unverändert.
 */
export class TeslaMateDataSource implements VehicleDataSource {
  readonly source = "teslamate";

  constructor(private readonly sql: TeslamateSql) {}

  probe(): Promise<void> {
    return probeTeslamateSchema(this.sql);
  }

  fetchVehicles(): Promise<SourceVehicle[]> {
    return fetchCars(this.sql);
  }

  fetchCompletedDrivesSince(since: Date): Promise<SourceDrive[]> {
    return fetchCompletedDrivesSince(this.sql, since);
  }

  fetchInProgressDrives(): Promise<SourceDrive[]> {
    return fetchInProgressDrives(this.sql);
  }

  async fetchExistingDriveIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];

    const rows = await this.sql<{ id: number }[]>`
      SELECT id
      FROM drives
      WHERE id = ANY(${ids})
    `;

    return rows.map((row) => row.id);
  }

  fetchCompletedChargingProcessesSince(
    since: Date,
  ): Promise<SourceChargingProcess[]> {
    return fetchCompletedChargingProcessesSince(this.sql, since);
  }

  fetchInProgressChargingProcesses(): Promise<SourceChargingProcess[]> {
    return fetchInProgressChargingProcesses(this.sql);
  }

  fetchGeofences(): Promise<SourceGeofence[]> {
    return fetchGeofences(this.sql);
  }

  fetchPositionsForDrive(
    carId: number,
    start: Date,
    end: Date,
  ): Promise<SourcePosition[]> {
    return fetchPositionsForDrive(this.sql, carId, start, end);
  }

  fetchLatestPositions(): Promise<SourceLatestPosition[]> {
    return fetchLatestPositions(this.sql);
  }

  fetchLatestStates(): Promise<SourceLatestState[]> {
    return fetchLatestStates(this.sql);
  }

  fetchVehicleStatePeriodsSince(
    since: Date,
    limit: number,
  ): Promise<SourceVehicleStatePeriod[]> {
    return fetchVehicleStatePeriodsSince(this.sql, since, limit);
  }

  fetchChargePoints(
    chargingProcessId: number,
  ): Promise<SourceChargePoint[]> {
    return fetchChargesForProcess(this.sql, chargingProcessId);
  }

  fetchSoftwareUpdates(): Promise<SourceSoftwareUpdate[]> {
    return fetchUpdates(this.sql);
  }

  fetchVehicleMetricsSince(
    since: Date,
    limit: number,
  ): Promise<SourceVehicleMetric[]> {
    return fetchVehicleMetricsSince(this.sql, since, limit);
  }
}

export function createTeslaMateDataSource(url: string): TeslaMateDataSource {
  return new TeslaMateDataSource(createTeslamateClient(url));
}
