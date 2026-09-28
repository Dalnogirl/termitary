import type { FastifyInstance } from 'fastify';
import type { ConnectionLifecycle } from '../domain/connection-registry.js';
import type { Ports } from '../domain/ports.js';
import { type Gate, requireIdentity } from '../http/gate.js';
import { handleConnection } from './connection.js';

export const registerSocket = (
  app: FastifyInstance,
  { ports, lifecycle, gate }: { ports: Ports; lifecycle: ConnectionLifecycle; gate: Gate },
): void => {
  app.get('/ws', { websocket: true, preValidation: gate }, (socket, req) => {
    handleConnection({ socket, req, identity: requireIdentity(req), ports, lifecycle });
  });
};
