interface OsrmRoadResponse {
  code?: unknown;
  routes?: unknown;
}

interface OsrmRoadRoute {
  legs?: unknown;
}

interface OsrmRoadLeg {
  steps?: unknown;
}

interface OsrmRoadStep {
  ref?: unknown;
}

/**
 * Extrahiert deutsche Autobahnreferenzen aus OSRM-steps.
 *
 * Beispiele:
 *   "A 2"       -> A2
 *   "A30 / E30" -> A30
 */
export function extractMotorwayRefsFromOsrmBody(body: unknown): string[] {
  if (typeof body !== "object" || body === null) return [];

  const response = body as OsrmRoadResponse;

  if (response.code !== "Ok" || !Array.isArray(response.routes)) {
    return [];
  }

  const refs = new Set<string>();

  for (const rawRoute of response.routes) {
    if (typeof rawRoute !== "object" || rawRoute === null) continue;

    const route = rawRoute as OsrmRoadRoute;
    if (!Array.isArray(route.legs)) continue;

    for (const rawLeg of route.legs) {
      if (typeof rawLeg !== "object" || rawLeg === null) continue;

      const leg = rawLeg as OsrmRoadLeg;
      if (!Array.isArray(leg.steps)) continue;

      for (const rawStep of leg.steps) {
        if (typeof rawStep !== "object" || rawStep === null) continue;

        const step = rawStep as OsrmRoadStep;
        if (typeof step.ref !== "string") continue;

        const matches =
          step.ref.toUpperCase().match(/\bA\s*\d+\b/g) ?? [];

        for (const rawRef of matches) {
          refs.add(rawRef.replace(/\s+/g, ""));
        }
      }
    }
  }

  return [...refs].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );
}
