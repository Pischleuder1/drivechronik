// src/grabber/index.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fetchTesla } from './tesla.js';
import { fetchSupercharge } from './superchargeInfo.js';
import { mergeSuperchargers } from './merge.js';

async function trySource(fn, label, errors) {
  try {
    const list = await fn();
    if (Array.isArray(list) && list.length > 0) return list;
    errors.push(`${label}: empty result`);
  } catch (e) {
    errors.push(`${label}: ${e.message}`);
  }
  return null;
}

// Tesla is the base (official coverage); supercharge.info enriches/corrects it
// (fixes stale "coming soon" ghosts, fills stall counts / open-to-all flags).
// Falls back to whichever single source is available; refuses to overwrite good
// data when both fail.
export async function runGrab({
  dataFile,
  fetchBase = () => fetchTesla(),
  fetchEnrich = () => fetchSupercharge(),
  matchMeters = 600,
  now = () => new Date(),
} = {}) {
  const errors = [];
  const base = await trySource(fetchBase, 'tesla', errors);
  const enrich = await trySource(fetchEnrich, 'supercharge.info', errors);

  let superchargers;
  let source;
  if (base && enrich) {
    superchargers = mergeSuperchargers(base, enrich, { matchMeters });
    source = 'tesla+supercharge.info';
  } else if (base) {
    superchargers = base;
    source = 'tesla';
  } else if (enrich) {
    superchargers = enrich;
    source = 'supercharge.info';
  } else {
    throw new Error(`grab failed: ${errors.join(' | ')}`); // do NOT overwrite good file
  }

  const payload = { generatedAt: now().toISOString(), source, superchargers };
  mkdirSync(dirname(dataFile), { recursive: true });
  writeFileSync(dataFile, JSON.stringify(payload), 'utf8');
  return { source, count: superchargers.length, generatedAt: payload.generatedAt };
}
