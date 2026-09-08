import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import { type Auth, createAuth } from './adapters/auth/better-auth.js';
import { registerAuth } from './adapters/auth/fastify.js';
import { type DbHandle, createDb } from './adapters/db/client.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createInMemoryConnectionRegistry } from './adapters/in-memory-connection-registry.js';
import type { Identity } from './domain/identity.js';
import type { Ports } from './domain/ports.js';
import type { RoomStore } from './domain/room-store.js';
import { env } from './env.js';
import { createRoom } from './usecases/create-room.js';
import { listRooms } from './usecases/list-rooms.js';
import { sweepAbandonedRooms } from './usecases/sweep-abandoned-rooms.js';
import { handleConnection } from './ws/connection.js';
import { type IdentityExtractor, createIdentityExtractor } from './ws/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null;
  }
}

export type BuildAppOptions = {
  logger?: FastifyServerOptions['logger'];
  /** 0 disables the periodic sweep. */
  roomSweepIntervalMs?: number;
  // Test seam: callers may inject a pre-built db + auth (e.g. an in-memory
  // sqlite shared between asserts). Defaults wire from env.
  db?: DbHandle;
  auth?: Auth;
};

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({ logger: options.logger ?? false });

  const dbHandle = options.db ?? createDb(env.databaseUrl);
  const auth = options.auth ?? createAuth(dbHandle.db);
  const extractIdentity = createIdentityExtractor(auth);

  const rooms = createDrizzleRoomStore(dbHandle.db);
  const connections = createInMemoryConnectionRegistry();
  const ports: Ports = { rooms, connections };

  app.decorateRequest('identity', null);

  const sweepTimer = startRoomSweep(
    app,
    rooms,
    options.roomSweepIntervalMs ?? env.roomSweepIntervalMs,
  );

  app.addHook('onClose', async () => {
    if (sweepTimer !== undefined) clearInterval(sweepTimer);
    if (!options.db) dbHandle.close();
  });

  // origin must be an explicit value, not `true`: a reflected origin is
  // incompatible with credentials, and the web client cannot send its session
  // cookie without them. Phase 6 turns webOrigin into a deployed allowlist.
  await app.register(cors, { origin: env.webOrigin, credentials: true });
  await app.register(websocket);
  await registerAuth(app, auth);

  const gate = gateIdentity(extractIdentity);

  app.get('/health', async () => ({ ok: true }));
  app.get('/rooms', { preHandler: gate }, async () => listRooms(rooms));
  app.post('/rooms', { preHandler: gate }, async (req) => createRoom(requireIdentity(req), rooms));
  app.get('/ws', { websocket: true, preValidation: gate }, (socket, req) => {
    handleConnection({
      socket,
      req,
      identity: requireIdentity(req),
      ports,
      lifecycle: connections,
    });
  });

  return app;
};

const sweepAndLog = (app: FastifyInstance, rooms: RoomStore): void => {
  void sweepAbandonedRooms(rooms)
    .then((removed) => {
      if (removed > 0) app.log.info({ removed }, 'swept abandoned rooms');
    })
    .catch((err: unknown) => app.log.error({ err }, 'room sweep failed'));
};

const startRoomSweep = (
  app: FastifyInstance,
  rooms: RoomStore,
  intervalMs: number,
): NodeJS.Timeout | undefined => {
  if (intervalMs <= 0) return undefined;
  sweepAndLog(app, rooms);
  // unref'd so the timer never holds the process open; onClose clears it.
  return setInterval(() => sweepAndLog(app, rooms), intervalMs).unref();
};

const gateIdentity =
  (extract: IdentityExtractor) =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const identity = await extract(req);
    if (identity === null) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    req.identity = identity;
  };

// The gate hook either sets req.identity or sends 401. Reaching a handler
// without identity is a framework invariant violation, not a runtime branch.
const requireIdentity = (req: FastifyRequest): Identity => {
  if (req.identity === null) throw new Error('unreachable: gate did not set identity');
  return req.identity;
};
