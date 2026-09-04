// src/grabber/superchargeInfo.js
import { formatAddress } from './normalize.js';

const STATUS_MAP = {
  OPEN: 'open',
  CONSTRUCTION: 'coming_soon',
  PERMIT: 'coming_soon',
};

export function parseSupercharge(raw) {
  const out = [];
  for (const site of raw) {
    const status = STATUS_MAP[site.status];
    if (!status) continue; // drop CLOSED_* / unknown
    const a = site.address ?? {};
    out.push({
      id: `sci-${site.id}`,
      name: site.name,
      lat: site.gps.latitude,
      lon: site.gps.longitude,
      address: formatAddress([a.street, `${a.zip ?? ''} ${a.city ?? ''}`.trim(), a.country]),
      status,
      openToAllEvs: site.otherEVs === true,
      stallCount: typeof site.stallCount === 'number' ? site.stallCount : null,
      source: 'supercharge.info',
    });
  }
  return out;
}

export async function fetchSupercharge({ fetchImpl = fetch } = {}) {
  const res = await fetchImpl('https://supercharge.info/service/supercharge/allSites', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`supercharge.info request failed: ${res.status}`);
  return parseSupercharge(await res.json());
}
