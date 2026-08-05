import Fastify from 'fastify';
import { env } from './env.js';
import { registerWs } from './ws/plugin.js';

const app = Fastify({
  logger:
    env.nodeEnv === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : true,
});

app.get('/health', async () => ({ ok: true }));

await registerWs(app);

await app.listen({ port: env.port, host: env.host });
