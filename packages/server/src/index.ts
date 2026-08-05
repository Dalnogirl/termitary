import { buildApp } from './app.js';
import { env } from './env.js';

const logger =
  env.nodeEnv === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : true;

const app = await buildApp({ logger });
await app.listen({ port: env.port, host: env.host });
