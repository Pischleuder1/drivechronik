// src/grabber/merge.js
import { haversineMeters } from '../geo.js';

// Tesla's all-locations feed keeps stale "coming soon" ghosts (e.g. Pforzheim, still
// flagged "Target opening Q1 2023" years after it opened). We keep Tesla as the base
// (official coverage) but correct/enrich each site from supercharge.info when a site
// sits within `matchMeters` of it.
//
// Rules per matched pair:
//   - status: only coming_soon -> open (when enrichment confirms OPEN). Never downgrade.
//   - stallCount: keep Tesla's if present, otherwise take the enrichment value.
//   - openToAllEvs: logical OR (either source knowing it's open to all EVs wins).
export function mergeSuperchargers(base, enrich, { matchMeters = 600 } = {}) {
  return base.map((b) => {
    let best = null;
    let bestDist = Infinity;
    for (const e of enrich) {
      const d = haversineMeters(b, e);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (!best || bestDist > matchMeters) return b;
    return {
      ...b,
      status: b.status === 'coming_soon' && best.status === 'open' ? 'open' : b.status,
      stallCount: b.stallCount ?? best.stallCount,
      openToAllEvs: b.openToAllEvs || best.openToAllEvs,
    };
  });
}
