import postgres from "postgres";
import { findMissingTeslaMateColumns } from "@drivechronik/core";

export type TeslamateSql = postgres.Sql;

export function createTeslamateClient(url: string): TeslamateSql {
  return postgres(url, {
    max: 2,
    // Wir lesen nur — falls die Rolle doch Schreibrechte hat, schützt das
    // zumindest vor versehentlichen Writes über diese Connection.
    connection: { default_transaction_read_only: true },
  });
}

/**
 * Prüft beim Start, ob die TeslaMate-DB die erwarteten Spalten hat.
 * TeslaMate-Migrationen benennen gelegentlich um — lieber ein klarer
 * Fehler beim Start als stiller Datenmüll.
 */
export async function probeTeslamateSchema(sql: TeslamateSql): Promise<void> {
  const rows = await sql<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `;

  const missing = findMissingTeslaMateColumns(
    rows.map((row) => ({
      tableName: row.table_name,
      columnName: row.column_name,
    })),
  );

  if (missing.length > 0) {
    throw new Error(
      `TeslaMate-Schema passt nicht (fehlende Spalten: ${missing.join(", ")}). ` +
        `Vermutlich inkompatible TeslaMate-Version — getestet mit v4.x.`,
    );
  }
}
