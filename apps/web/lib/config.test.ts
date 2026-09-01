import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("web configuration", () => {
  it("accepts a valid database URL", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://tripatlas:tripatlas@localhost:5432/tripatlas",
    );
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");

    const { getDatabaseUrl } = await import("./config");

    expect(getDatabaseUrl()).toBe(
      "postgres://tripatlas:tripatlas@localhost:5432/tripatlas",
    );
  });

  it("rejects a missing database URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");

    const { getDatabaseUrl } = await import("./config");

    expect(() => getDatabaseUrl()).toThrow(
      "DATABASE_URL: ist erforderlich",
    );
  });

  it("rejects an invalid database URL", async () => {
    vi.stubEnv("DATABASE_URL", "https://example.com/database");
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");

    const { getDatabaseUrl } = await import("./config");

    expect(() => getDatabaseUrl()).toThrow(
      "DATABASE_URL: muss eine gültige PostgreSQL-URL sein",
    );
  });

  it("rejects an invalid application timezone", async () => {
    vi.stubEnv("APP_TIMEZONE", "Europe/Falsch");

    await expect(import("./config")).rejects.toThrow(
      "APP_TIMEZONE: muss eine gültige IANA-Zeitzone sein",
    );
  });

  it("accepts an HTTP OSRM URL", async () => {
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");
    vi.stubEnv("OSRM_URL", "http://osrm.local:5000");

    const { getOsrmUrl } = await import("./config");

    expect(getOsrmUrl()).toBe("http://osrm.local:5000");
  });

  it("rejects a non-HTTP OSRM URL", async () => {
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");
    vi.stubEnv("OSRM_URL", "ftp://falsch.local");

    const { getOsrmUrl } = await import("./config");

    expect(() => getOsrmUrl()).toThrow(
      "OSRM_URL: muss eine gültige HTTP- oder HTTPS-URL sein",
    );
  });

  it("keeps TeslaMate optional in the web app", async () => {
    vi.stubEnv("APP_TIMEZONE", "Europe/Berlin");
    vi.stubEnv("TESLAMATE_DATABASE_URL", "");

    const { getTeslamateDatabaseUrl } = await import("./config");

    expect(getTeslamateDatabaseUrl()).toBeUndefined();
  });
});
