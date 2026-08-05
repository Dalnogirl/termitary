import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { CreateRoomRequestSchema } from '@hive/protocol';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createInMemoryConnectionRegistry } from './adapters/in-memory-connection-registry.js';
import { createInMemoryRoomStore } from './adapters/in-memory-room-store.js';
import type { Identity } from './domain/identity.js';
import type { Ports } from './domain/ports.js';
import { createRoom } from './usecases/create-room.js';
import { listRooms } from './usecases/list-rooms.js';
import { handleConnection } from './ws/connection.js';

export const buildApp = async (
  options: { logger?: FastifyServerOptions['logger'] } = {},
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: options.logger ?? false });

  const rooms = createInMemoryRoomStore();
  const connections = createInMemoryConnectionRegistry();
  const ports: Ports = { rooms, connections };

  // Phase 3: permissive CORS so the local dev web client (any vite port)
  // can hit /rooms. Lock down to an allowlist in Phase 6+.
  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/health', async () => ({ ok: true }));
  app.get('/rooms', async () => listRooms(rooms));
  app.post('/rooms', async (req, reply) => {
    const parsed = CreateRoomRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid request body' });
    }
    const identity: Identity = { playerId: parsed.data.playerId };
    return createRoom(identity, rooms);
  });
  app.get('/ws', { websocket: true }, (socket, req) => {
    handleConnection({ socket, req, ports, lifecycle: connections });
  });

  return app;
};
