import "server-only";

import { readFile } from "node:fs/promises";

import { getMonthSealPrivateKeyFile } from "./config";

export async function loadMonthSealPrivateKey(): Promise<
  string | undefined
> {
  const file = getMonthSealPrivateKeyFile();

  if (!file) return undefined;

  try {
    return await readFile(file, "utf8");
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error);

    throw new Error(
      "Der private Schlüssel für den Monatsabschluss konnte nicht gelesen werden: " +
        detail,
    );
  }
}
