// src/nearest.js
export function createNearestService({ datastore, routing, config }) {
  return {
    // Road route between two arbitrary points (used to lazy-load a route to a
    // result the user selects, or to draw every result's route at once).
    async routeBetween(from, to) {
      return routing.route(from, to);
    },

    async find({ address, lat, lon, limit, comingSoon = false, openToAllEvs = false, sort = 'distance' }) {
      // 1. Resolve origin
      let origin;
      if (typeof lat === 'number' && typeof lon === 'number') {
        origin = { lat, lon, label: `${lat}, ${lon}` };
      } else {
        const geo = await routing.geocode(address);
        if (!geo) {
          const err = new Error('GEOCODE_NOT_FOUND');
          err.code = 'GEOCODE_NOT_FOUND';
          throw err;
        }
        origin = geo;
      }

      // 2. Filter predicate
      const filterFn = (s) =>
        (comingSoon || s.status === 'open') &&
        (!openToAllEvs || s.openToAllEvs === true);

      // 3. Air pre-filter → K candidates
      const candidates = datastore.nearestByAir(origin, config.maxCandidates, filterFn);
      if (candidates.length === 0) {
        return { origin, results: [], route: null, meta: datastore.meta() };
      }

      // 4. Road matrix
      const rows = await routing.matrix(origin, candidates);
      const enriched = candidates.map((s, i) => ({
        id: s.id, name: s.name, lat: s.lat, lon: s.lon, address: s.address,
        status: s.status, openToAllEvs: s.openToAllEvs, stallCount: s.stallCount,
        distanceMeters: rows[i].distanceMeters, durationSeconds: rows[i].durationSeconds,
      }));

      // 5. Sort + top N
      const key = sort === 'duration' ? 'durationSeconds' : 'distanceMeters';
      enriched.sort((a, b) => a[key] - b[key]);
      const results = enriched.slice(0, limit ?? config.defaultLimit);

      // 6. Route geometry for #1
      const top = results[0];
      const route = top
        ? { toId: top.id, ...(await routing.route(origin, { lat: top.lat, lon: top.lon })) }
        : null;

      return { origin, results, route, meta: datastore.meta() };
    },
  };
}
