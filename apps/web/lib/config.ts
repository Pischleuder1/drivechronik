import "server-only";

import { z } from "zod";

/**
 * App-wide configuration derived from environment variables.
 *
 * Runtime-only values such as DATABASE_URL are validated on first use.
 * This keeps `next build` independent from deployment secrets.
 */

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function validatePostgresUrl(name: string, value: string | undefined): string {
  if (value == null || value.trim() === "") {
    throw new Error(
      `[drivechronik-web] Ungültige Konfiguration:\n  - ${name}: ist erforderlich`,
    );
  }

  try {
    const url = new URL(value);

    if (
      (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      url.hostname.length === 0 ||
      url.pathname.length <= 1
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      `[drivechronik-web] Ungültige Konfiguration:\n  - ${name}: muss eine gültige PostgreSQL-URL sein`,
    );
  }

  return value;
}

const appConfigSchema = z.object({
  APP_TIMEZONE: z
    .string()
    .default("Europe/Zurich")
    .refine(isValidTimeZone, "muss eine gültige IANA-Zeitzone sein"),
});

const parsedAppConfig = appConfigSchema.safeParse({
  APP_TIMEZONE: process.env.APP_TIMEZONE ?? "Europe/Zurich",
});

if (!parsedAppConfig.success) {
  const details = parsedAppConfig.error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "environment";
      return `  - ${key}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(
    `[drivechronik-web] Ungültige Konfiguration:\n${details}`,
  );
}

/** IANA timezone used for all day-boundary math and clock display. */
export const APP_TIMEZONE = parsedAppConfig.data.APP_TIMEZONE;

/** Name of the httpOnly session cookie. */
export const SESSION_COOKIE = "drivechronik_session";

/**
 * Required DriveChronik database URL.
 *
 * Validated only when database access is actually initialized so production
 * builds do not require runtime deployment secrets.
 */
export function getDatabaseUrl(): string {
  return validatePostgresUrl("DATABASE_URL", process.env.DATABASE_URL);
}

/**
 * Optional TeslaMate URL used by web diagnostics only.
 */
export function getTeslamateDatabaseUrl(): string | undefined {
  const value = process.env.TESLAMATE_DATABASE_URL?.trim();
  if (!value) return undefined;

  return validatePostgresUrl("TESLAMATE_DATABASE_URL", value);
}

/**
 * Optional private Ed25519 key file used to sign monthly logbook seals.
 *
 * The key itself must not be stored in environment variables or the database.
 */
export function getMonthSealPrivateKeyFile(): string | undefined {
  const value = process.env.MONTH_SEAL_PRIVATE_KEY_FILE?.trim();

  if (!value) return undefined;

  if (!value.startsWith("/")) {
    throw new Error(
      "[drivechronik-web] Ungültige Konfiguration:\n" +
        "  - MONTH_SEAL_PRIVATE_KEY_FILE: muss ein absoluter Dateipfad sein",
    );
  }

  return value;
}

/**
 * Optional custom OSRM endpoint.
 */
export function getOsrmUrl(): string | undefined {
  const value = process.env.OSRM_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }

    return value;
  } catch {
    throw new Error(
      "[drivechronik-web] Ungültige Konfiguration:\n" +
        "  - OSRM_URL: muss eine gültige HTTP- oder HTTPS-URL sein",
    );
  }
}
