import "server-only";

import type {
  ChargingSearchOptions,
  ChargingSite,
} from "./types";

import { getSuperchargeCompassProvider } from "./superchargeCompass";
import { getBundesnetzagenturProvider } from "./bundesnetzagentur";
import { getNetherlandsNdwProvider } from "./netherlandsNdw";

export async function findChargingSitesAlongRoute(
  geometry: [number, number][],
  options: ChargingSearchOptions = {},
): Promise<ChargingSite[]> {
  const preference = options.preference ?? "tesla-preferred";

  const providers = [
    getSuperchargeCompassProvider(),
    ...(preference === "tesla-only"
      ? []
      : [
          getBundesnetzagenturProvider(),
          getNetherlandsNdwProvider(),
        ]),
  ].filter((provider) => provider != null);

  if (providers.length === 0) return [];

  const results = await Promise.allSettled(
    providers.map((provider) =>
      provider.findAlongRoute(geometry, options),
    ),
  );

  const byKey = new Map<string, ChargingSite>();

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(
        "[charging] Provider failed while searching along route:",
        result.reason,
      );
      continue;
    }

    for (const site of result.value) {
      const key = `${site.network}:${site.id}`;
      if (!byKey.has(key)) {
        byKey.set(key, site);
      }
    }
  }

  return [...byKey.values()];
}
