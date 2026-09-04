export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 3000),
    routingProvider: env.ROUTING_PROVIDER ?? 'ors',
    orsApiKey: env.ORS_API_KEY ?? '',
    orsBaseUrl: env.ORS_BASE_URL ?? 'https://api.openrouteservice.org',
    dataFile: env.DATA_FILE ?? 'data/superchargers.json',
    maxCandidates: 25,
    defaultLimit: 5,
    staleHours: 48,
  };
}
