import "server-only";

import type {
  ChargingSearchOptions,
  ChargingSite,
} from "./types";

import { getSuperchargeCompassProvider } from "./superchargeCompass";

export async function findChargingSitesAlongRoute(
  geometry: [number, number][],
  options: ChargingSearchOptions = {},
): Promise<ChargingSite[]> {
  const providers = [
    getSuperchargeCompassProvider(),
  ].filter((provider) => provider != null);

  if (providers.length === 0) return [];

  const results = await Promise.all(
    providers.map((provider) =>
      provider.findAlongRoute(geometry, options),
    ),
  );

  const byKey = new Map<string, ChargingSite>();

  for (const sites of results) {
    for (const site of sites) {
      const key = `${site.network}:${site.id}`;

      if (!byKey.has(key)) {
        byKey.set(key, site);
      }
    }
  }

  return [...byKey.values()];
}
