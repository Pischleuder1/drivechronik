// src/routing/index.js
import { createOrsProvider } from './providers/ors.js';

export function createRouting(config, { fetchImpl } = {}) {
  if (config.routingProvider === 'ors') {
    if (!config.orsApiKey) throw new Error('ORS_API_KEY is required for routingProvider=ors');
    return createOrsProvider({ apiKey: config.orsApiKey, baseUrl: config.orsBaseUrl, fetchImpl });
  }
  throw new Error(`Unknown routing provider: ${config.routingProvider}`);
}
