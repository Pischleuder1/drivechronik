import { afterEach, describe, expect, it, vi } from "vitest";

import { loadWorkerEnv } from "./env.js";

const VALID_DB =
  "postgres://drivechronik:drivechronik@localhost:5432/drivechronik";
const VALID_TESLAMATE =
  "postgres://teslamate:teslamate@localhost:5433/teslamate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadWorkerEnv", () => {
  function validEnv() {
    vi.stubEnv("DATABASE_URL", VALID_DB);
    vi.stubEnv("TESLAMATE_DATABASE_URL", VALID_TESLAMATE);
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");
    vi.stubEnv("SYNC_INTERVAL_SECONDS", "60");
    delete process.env.ELEVATION_ENABLED;
    delete process.env.ELEVATION_MAX_POINTS_PER_CYCLE;
  }

  it("loads a valid worker configuration", () => {
    validEnv();

    const env = loadWorkerEnv();

    expect(env.databaseUrl).toBe(VALID_DB);
    expect(env.teslamateDatabaseUrl).toBe(VALID_TESLAMATE);
    expect(env.appTimezone).toBe("Europe/Berlin");
    expect(env.syncIntervalSeconds).toBe(60);
    expect(env.elevationEnabled).toBe(true);
  });

  it("rejects a missing TeslaMate database URL", () => {
    validEnv();
    vi.stubEnv("TESLAMATE_DATABASE_URL", "");

    expect(() => loadWorkerEnv()).toThrow(
      "TESLAMATE_DATABASE_URL: ist erforderlich",
    );
  });

  it("rejects an invalid sync interval", () => {
    validEnv();
    vi.stubEnv("SYNC_INTERVAL_SECONDS", "abc");

    expect(() => loadWorkerEnv()).toThrow("SYNC_INTERVAL_SECONDS");
  });

  it("rejects an invalid timezone", () => {
    validEnv();
    vi.stubEnv("APP_TIMEZONE", "Europe/Falsch");

    expect(() => loadWorkerEnv()).toThrow(
      "APP_TIMEZONE: muss eine gültige IANA-Zeitzone sein",
    );
  });

  it("parses optional elevation settings", () => {
    validEnv();
    vi.stubEnv("ELEVATION_ENABLED", "false");
    vi.stubEnv("ELEVATION_MAX_POINTS_PER_CYCLE", "25");

    const env = loadWorkerEnv();

    expect(env.elevationEnabled).toBe(false);
    expect(env.elevationMaxPointsPerCycle).toBe(25);
  });
});
