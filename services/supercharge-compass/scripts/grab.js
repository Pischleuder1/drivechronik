// scripts/grab.js
import { loadConfig } from '../src/config.js';
import { runGrab } from '../src/grabber/index.js';

const config = loadConfig();
try {
  const res = await runGrab({ dataFile: config.dataFile });
  console.log(`Grabbed ${res.count} superchargers from ${res.source} at ${res.generatedAt}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
