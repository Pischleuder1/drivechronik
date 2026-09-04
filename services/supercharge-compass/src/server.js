// src/server.js
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import { loadConfig } from './config.js';
import { createDatastore } from './datastore.js';
import { createRouting } from './routing/index.js';
import { createNearestService } from './nearest.js';
import { createApp } from './api.js';
import { runGrab } from './grabber/index.js';

export function startServer({
  env = process.env,
  cronImpl = cron,
  runGrabImpl = runGrab,
  createRoutingImpl = createRouting,
  logger = console,
} = {}) {
  const config = loadConfig(env);
  const datastore = createDatastore({ dataFile: config.dataFile, staleHours: config.staleHours });

  if (!datastore.load()) {
    logger.warn(`No data file at ${config.dataFile}. Run "npm run grab" or wait for the daily job.`);
  }

  const routing = config.orsApiKey
    ? createRoutingImpl(config)
    : {
        async geocode() {
          throw new Error('Routing is disabled: ORS_API_KEY is not configured');
        },
        async matrix() {
          throw new Error('Routing is disabled: ORS_API_KEY is not configured');
        },
        async route() {
          throw new Error('Routing is disabled: ORS_API_KEY is not configured');
        },
      };

  if (!config.orsApiKey) {
    logger.log('ORS routing disabled; datastore API remains available.');
  }

  const nearest = createNearestService({ datastore, routing, config });
  const app = createApp({ nearest, datastore, config });

  // Daily grab at 03:15, then reload into memory
  const cronTask = cronImpl.schedule('15 3 * * *', async () => {
    try {
      const res = await runGrabImpl({ dataFile: config.dataFile });
      datastore.load();
      logger.log(`[cron] grabbed ${res.count} from ${res.source}`);
    } catch (e) {
      logger.error(`[cron] grab failed (keeping previous data): ${e.message}`);
    }
  });

  const server = app.listen(config.port, () =>
    logger.log(`Listening on http://localhost:${config.port}`),
  );

  return { app, server, datastore, config, cronTask };
}

// Auto-start only when run directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
