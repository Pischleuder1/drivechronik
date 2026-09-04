// src/datastore.js
import { readFileSync } from 'node:fs';
import { haversineMeters } from './geo.js';

export function createDatastore({ dataFile, staleHours = 48, now = () => new Date() }) {
  let data = { generatedAt: null, source: null, superchargers: [] };

  const store = {
    dataFile,
    load() {
      try {
        const parsed = JSON.parse(readFileSync(store.dataFile, 'utf8'));
        if (!Array.isArray(parsed.superchargers)) throw new Error('bad shape');
        data = parsed;
        return true;
      } catch {
        return false; // keep last-good data
      }
    },
    all() {
      return data.superchargers;
    },
    meta() {
      const ts = data.generatedAt ? new Date(data.generatedAt) : null;
      const ageMs = ts ? now().getTime() - ts.getTime() : Infinity;
      return {
        dataTimestamp: data.generatedAt,
        source: data.source,
        count: data.superchargers.length,
        stale: ageMs > staleHours * 3600 * 1000,
      };
    },
    nearestByAir(origin, k, filterFn = () => true) {
      return data.superchargers
        .filter(filterFn)
        .map((s) => ({ s, d: haversineMeters(origin, s) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, k)
        .map((x) => x.s);
    },
  };
  return store;
}
