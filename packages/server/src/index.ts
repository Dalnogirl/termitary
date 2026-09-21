import { log } from './adapters/logger.js';
import { buildApp } from './app.js';
import { env } from './env.js';

const app = await buildApp({ loggerInstance: log });
await app.listen({ port: env.port, host: env.host });

// A supervisor restarts by signal, and app.close() is what clears the sweep
// timer and closes the SQLite handle. Without this every restart leaves one
// half-closed.
const shutdown = (signal: NodeJS.Signals): void => {
  log.info({ signal }, 'shutting down');
  app
    .close()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      log.error({ err }, 'shutdown failed');
      process.exit(1);
    });
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
