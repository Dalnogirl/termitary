import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { type Auth, createAuth } from './adapters/auth/better-auth.js';
import { registerAuth } from './adapters/auth/fastify.js';
import { type DbHandle, createDb } from './adapters/db/client.js';
import { createDrizzleArchivedGameStore } from './adapters/drizzle-archived-game-store.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createDrizzleSeekStore } from './adapters/drizzle-seek-store.js';
import { createDrizzleUnitOfWork } from './adapters/drizzle-unit-of-work.js';
import { createDrizzleUserStore } from './adapters/drizzle-user-store.js';
import { createInMemoryConnectionRegistry } from './adapters/in-memory-connection-registry.js';
import type { Ports } from './domain/ports.js';
import { env } from './env.js';
import { gateIdentity } from './http/gate.js';
import { logRequest } from './http/log-request.js';
import { registerRoutes } from './http/routes.js';
import { WEB_DIST, serveWebDist } from './http/web-dist.js';
import { startSweep } from './sweep.js';
import { createIdentityExtractor } from './ws/identity.js';
import { registerSocket } from './ws/route.js';

export type BuildAppOptions = {
  loggerInstance?: FastifyServerOptions['loggerInstance'];
  /** 0 disables the periodic sweep of expired seeks and games out of time. */
  sweepIntervalMs?: number;
  // Test seam: callers may inject a pre-built db + auth (e.g. an in-memory
  // sqlite shared between asserts). Defaults wire from env.
  db?: DbHandle;
  auth?: Auth;
  /** Test seam: the directory the built SPA is served from, or false to serve none. */
  webDist?: string | false;
};

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    ...(options.loggerInstance ? { loggerInstance: options.loggerInstance } : { logger: false }),
    // Fastify logs every request twice, as multi-line req/res dumps. The
    // onResponse hook below replaces both with one line.
    disableRequestLogging: true,
  });

  app.addHook('onResponse', logRequest);

  const dbHandle = options.db ?? createDb(env.databaseUrl);
  const connections = createInMemoryConnectionRegistry();
  // app.log is the Logger port's adapter: pino when index.ts injects one,
  // and Fastify's no-op logger otherwise, which is what keeps tests quiet.
  const ports: Ports = {
    rooms: createDrizzleRoomStore(dbHandle.db),
    seeks: createDrizzleSeekStore(dbHandle.db),
    connections,
    archive: createDrizzleArchivedGameStore(dbHandle.db),
    users: createDrizzleUserStore(dbHandle.db),
    unitOfWork: createDrizzleUnitOfWork(dbHandle.db),
    log: app.log,
  };
  const auth = options.auth ?? createAuth(dbHandle.db, ports.users, app.log);
  const gate = gateIdentity(createIdentityExtractor(auth));

  app.decorateRequest('identity', null);

  const sweepTimer = startSweep(app.log, ports, options.sweepIntervalMs ?? env.sweepIntervalMs);

  app.addHook('onClose', async () => {
    if (sweepTimer !== undefined) clearInterval(sweepTimer);
    if (!options.db) dbHandle.close();
  });

  await app.register(websocket);
  await registerAuth(app, auth);
  registerRoutes(app, { ports, auth, gate });
  registerSocket(app, { ports, lifecycle: connections, gate });

  const webDist = options.webDist ?? WEB_DIST;
  if (webDist !== false) await serveWebDist(app, webDist);

  return app;
};
