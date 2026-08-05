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
import { createInMemoryConnectionRegistry } from './adapters/in-memory-connection-registry.js';
import { createInMemoryRoomStore } from './adapters/in-memory-room-store.js';
import type { Identity } from './domain/identity.js';
import type { Ports } from './domain/ports.js';
import { env } from './env.js';
import { createRoom } from './usecases/create-room.js';
import { listRooms } from './usecases/list-rooms.js';
import { handleConnection } from './ws/connection.js';
import { type IdentityExtractor, createIdentityExtractor } from './ws/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null;
  }
}

export type BuildAppOptions = {
  logger?: FastifyServerOptions['logger'];
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

  const rooms = createInMemoryRoomStore();
  const connections = createInMemoryConnectionRegistry();
  const ports: Ports = { rooms, connections };

  app.decorateRequest('identity', null);

  app.addHook('onClose', async () => {
    if (!options.db) dbHandle.close();
  });

  // Phase 3: permissive CORS so the local dev web client (any vite port)
  // can hit /rooms. Lock down to an allowlist in Phase 6+.
  await app.register(cors, { origin: true });
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
