import { z } from "zod";

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const postgresUrl = z.string().superRefine((value, ctx) => {
  if (value.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ist erforderlich",
    });
    return;
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
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "muss eine gültige PostgreSQL-URL sein",
    });
  }
});

const positiveInteger = z.coerce
  .number()
  .int()
  .positive();

const workerEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  TESLAMATE_DATABASE_URL: postgresUrl,
  SYNC_INTERVAL_SECONDS: positiveInteger.default(60),
  APP_TIMEZONE: z
    .string()
    .default("Europe/Zurich")
    .refine(isValidTimeZone, "muss eine gültige IANA-Zeitzone sein"),
  ELEVATION_ENABLED: z.enum(["true", "false"]).optional(),
  ELEVATION_MAX_POINTS_PER_CYCLE: z
    .union([positiveInteger, z.undefined()])
    .optional(),
});

export interface WorkerEnv {
  databaseUrl: string;
  teslamateDatabaseUrl: string;
  syncIntervalSeconds: number;
  appTimezone: string;
  elevationEnabled: boolean;
  elevationMaxPointsPerCycle?: number;
}

export function loadWorkerEnv(): WorkerEnv {
  const parsed = workerEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    TESLAMATE_DATABASE_URL: process.env.TESLAMATE_DATABASE_URL,
    SYNC_INTERVAL_SECONDS: process.env.SYNC_INTERVAL_SECONDS ?? "60",
    APP_TIMEZONE: process.env.APP_TIMEZONE ?? "Europe/Zurich",
    ELEVATION_ENABLED: process.env.ELEVATION_ENABLED,
    ELEVATION_MAX_POINTS_PER_CYCLE:
      process.env.ELEVATION_MAX_POINTS_PER_CYCLE || undefined,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const key = issue.path.join(".") || "environment";
        return `  - ${key}: ${issue.message}`;
      })
      .join("\n");

    throw new Error(
      `[drivechronik-worker] Ungültige Konfiguration:\n${details}`,
    );
  }

  return {
    databaseUrl: parsed.data.DATABASE_URL,
    teslamateDatabaseUrl: parsed.data.TESLAMATE_DATABASE_URL,
    syncIntervalSeconds: parsed.data.SYNC_INTERVAL_SECONDS,
    appTimezone: parsed.data.APP_TIMEZONE,
    elevationEnabled: parsed.data.ELEVATION_ENABLED !== "false",
    elevationMaxPointsPerCycle:
      parsed.data.ELEVATION_MAX_POINTS_PER_CYCLE,
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`[drivechronik-worker] env ${name} fehlt`);
  }

  return value;
}
