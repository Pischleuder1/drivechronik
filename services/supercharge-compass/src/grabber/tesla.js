// src/grabber/tesla.js
import { formatAddress } from './normalize.js';

const isSupercharger = (entry) =>
  [].concat(entry.location_type || []).includes('supercharger');

const truthy = (v) => v === true || v === '1' || v === 1;

// Tesla's all-locations feed has no dedicated stall-count / open-to-all fields.
// Both are embedded in the `chargers` HTML blurb, e.g.:
//   "8 Superchargers, available 24/7, up to 150kW"
//   "This Supercharger is open to Tesla vehicles and Non-Tesla vehicles with CCS compatibility"
export function parseChargers(html) {
  if (typeof html !== 'string') return { stallCount: null, openToAllEvs: false };
  const stallMatch = html.match(/(\d+)\s+Supercharger/i);
  return {
    stallCount: stallMatch ? Number(stallMatch[1]) : null,
    openToAllEvs: /non[-\s]?tesla/i.test(html),
  };
}

export function parseTesla(raw) {
  const out = [];
  for (const e of raw) {
    if (!isSupercharger(e)) continue;
    const lat = Number(e.latitude);
    const lon = Number(e.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const { stallCount, openToAllEvs } = parseChargers(e.chargers);
    out.push({
      id: `tesla-${e.location_id}`,
      name: e.title,
      lat,
      lon,
      address: formatAddress([e.address_line_1, `${e.postal_code ?? ''} ${e.city ?? ''}`.trim(), e.country]),
      status: truthy(e.open_soon) ? 'coming_soon' : 'open',
      openToAllEvs,
      stallCount,
      source: 'tesla',
    });
  }
  return out;
}

export async function fetchTesla({ fetchImpl = fetch } = {}) {
  const res = await fetchImpl('https://www.tesla.com/all-locations?translate=de_DE', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Tesla request failed: ${res.status}`);
  return parseTesla(await res.json());
}
