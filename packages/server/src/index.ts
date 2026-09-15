import { log } from './adapters/logger.js';
import { buildApp } from './app.js';
import { env } from './env.js';

const app = await buildApp({ loggerInstance: log });
await app.listen({ port: env.port, host: env.host });
