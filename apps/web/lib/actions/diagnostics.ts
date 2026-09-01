"use server";

import postgres from "postgres";
import { findMissingTeslaMateColumns } from "@drivechronik/core";
import { getTranslations } from "next-intl/server";

import { validateSession } from "../auth/session";
import { getTeslamateDatabaseUrl } from "../config";

export interface TeslamateTestResult {
  ok: boolean;
  message: string;
}

/**
 * Read-only-Diagnose gegen die TeslaMate-Datenbank.
 *
 * Prüft:
 * - Verbindung
 * - das von DriveChronik benötigte TeslaMate-Schema
 * - Anzahl Fahrzeuge
 * - Anzahl Fahrten
 */
export async function testTeslamateConnection(): Promise<TeslamateTestResult> {
  const user = await validateSession();
  const t = await getTranslations("settings");

  if (!user) {
    return { ok: false, message: t("errors.notAuthenticated") };
  }

  let url: string | undefined;

  try {
    url = getTeslamateDatabaseUrl();
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : t("diagnostics.teslamateTest.unknownConnectionError"),
    };
  }

  if (!url) {
    return {
      ok: false,
      message: t("diagnostics.teslamateTest.envNotSetMessage"),
    };
  }

  let sql: postgres.Sql | undefined;

  try {
    sql = postgres(url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 5,
      connection: { default_transaction_read_only: true },
    });

    const schemaRows = await sql<
      { table_name: string; column_name: string }[]
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;

    const missing = findMissingTeslaMateColumns(
      schemaRows.map((row) => ({
        tableName: row.table_name,
        columnName: row.column_name,
      })),
    );

    if (missing.length > 0) {
      return {
        ok: false,
        message: t("diagnostics.teslamateTest.schemaError", {
          missing: missing.join(", "),
        }),
      };
    }

    const stats = await sql<{ vehicles: number; drives: number }[]>`
      SELECT
        (SELECT count(*)::int FROM cars) AS vehicles,
        (SELECT count(*)::int FROM drives) AS drives
    `;

    const vehicles = stats[0]?.vehicles ?? 0;
    const drives = stats[0]?.drives ?? 0;

    return {
      ok: true,
      message: t("diagnostics.teslamateTest.successMessage", {
        vehicles: vehicles.toLocaleString("de-DE"),
        drives: drives.toLocaleString("de-DE"),
      }),
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : t("diagnostics.teslamateTest.unknownConnectionError"),
    };
  } finally {
    if (sql) await sql.end({ timeout: 1 });
  }
}
