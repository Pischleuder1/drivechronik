import { describe, expect, it } from "vitest";

import type { SourceDrive } from "../dataSource/vehicleDataSource.js";
import { isStationaryDriveArtifact } from "./driveArtifacts.js";

function drive(overrides: Partial<SourceDrive> = {}): SourceDrive {
  return {
    id: 5,
    car_id: 1,
    start_time: new Date("2026-11-16T20:34:17.444Z"),
    end_time: new Date("2026-11-16T20:34:23.876Z"),
    start_km: 133.897421,
    end_km: 133.956006,
    distance: 0.058585,
    duration_min: null,
    ascent: null,
    descent: null,
    start_rated_range_km: null,
    end_rated_range_km: null,
    start_lat: 52.270161,
    start_lon: 8.669735,
    end_lat: 52.270161,
    end_lon: 8.669735,
    start_soc: null,
    end_soc: null,
    start_address: null,
    end_address: null,
    outside_temp_avg: null,
    inside_temp_avg: null,
    speed_max: 0,
    power_max: null,
    power_min: null,
    ...overrides,
  };
}

describe("isStationaryDriveArtifact", () => {
  it("erkennt die beobachtete 58,6-m-Scheinfahrt", () => {
    expect(isStationaryDriveArtifact(drive())).toBe(true);
  });

  it("erkennt den zweiten 9-Sekunden-Fall", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          id: 6,
          start_time: new Date("2026-11-16T21:23:05.475Z"),
          end_time: new Date("2026-11-16T21:23:14.685Z"),
        }),
      ),
    ).toBe(true);
  });

  it("behält echtes kurzes Rangieren mit Geschwindigkeit", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          speed_max: 8,
        }),
      ),
    ).toBe(false);
  });

  it("behält eine Fahrt mit tatsächlicher GPS-Bewegung", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          end_lat: 52.270700,
        }),
      ),
    ).toBe(false);
  });

  it("behält Fahrten ab 100 Metern", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          distance: 0.1,
        }),
      ),
    ).toBe(false);
  });

  it("behält Fahrten ab 30 Sekunden", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          end_time: new Date("2026-11-16T20:34:47.444Z"),
        }),
      ),
    ).toBe(false);
  });

  it("filtert nicht ohne Geschwindigkeitswert", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          speed_max: null,
        }),
      ),
    ).toBe(false);
  });

  it("filtert keine noch laufende Fahrt", () => {
    expect(
      isStationaryDriveArtifact(
        drive({
          end_time: null,
        }),
      ),
    ).toBe(false);
  });
});
