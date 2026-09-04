// src/api.js
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const boolParam = (v, def = false) => (v === undefined ? def : v === 'true' || v === '1');

export function createApp({ nearest, datastore, config }) {
  const app = express();
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

  app.get('/api/nearest', async (req, res) => {
    const { address, lat, lon, limit, sort } = req.query;
    const hasCoords = lat !== undefined && lon !== undefined;
    if (!address && !hasCoords) {
      return res.status(400).json({ error: 'MISSING_ORIGIN', message: 'Provide address or lat & lon.' });
    }
    try {
      const out = await nearest.find({
        address,
        lat: hasCoords ? Number(lat) : undefined,
        lon: hasCoords ? Number(lon) : undefined,
        limit: limit ? Number(limit) : config.defaultLimit,
        comingSoon: boolParam(req.query.comingSoon, false),
        openToAllEvs: boolParam(req.query.openToAllEvs, false),
        sort: sort === 'duration' ? 'duration' : 'distance',
      });
      res.json(out);
    } catch (e) {
      if (e.code === 'GEOCODE_NOT_FOUND') {
        return res.status(422).json({ error: 'GEOCODE_NOT_FOUND', message: 'Address could not be located.' });
      }
      res.status(503).json({ error: 'ROUTING_UNAVAILABLE', message: e.message });
    }
  });

  app.get('/api/route', async (req, res) => {
    const { fromLat, fromLon, toLat, toLon } = req.query;
    if ([fromLat, fromLon, toLat, toLon].some((v) => v === undefined)) {
      return res.status(400).json({ error: 'MISSING_COORDS', message: 'fromLat, fromLon, toLat, toLon are required.' });
    }
    try {
      const route = await nearest.routeBetween(
        { lat: Number(fromLat), lon: Number(fromLon) },
        { lat: Number(toLat), lon: Number(toLon) },
      );
      res.json(route);
    } catch (e) {
      res.status(503).json({ error: 'ROUTING_UNAVAILABLE', message: e.message });
    }
  });

  app.get('/api/superchargers', (req, res) => {
    const comingSoon = boolParam(req.query.comingSoon, true);
    const openToAllEvs = boolParam(req.query.openToAllEvs, false);
    const list = datastore.all().filter(
      (s) => (comingSoon || s.status === 'open') && (!openToAllEvs || s.openToAllEvs === true),
    );
    res.json({ superchargers: list, meta: datastore.meta() });
  });

  app.get('/api/meta', (req, res) => res.json(datastore.meta()));

  app.use(express.static(publicDir));
  return app;
}
