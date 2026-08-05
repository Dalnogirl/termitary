import websocket from '@fastify/websocket';
import { ClientMessageSchema, type ServerMessage } from '@hive/protocol';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

const send = (socket: WebSocket, msg: ServerMessage): void => {
  socket.send(JSON.stringify(msg));
};

export const registerWs = async (app: FastifyInstance): Promise<void> => {
  await app.register(websocket);

  app.get('/ws', { websocket: true }, (socket, req) => {
    req.log.info('ws client connected');

    socket.on('message', (raw: Buffer | string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: 'error', message: 'invalid JSON' });
        return;
      }
      const result = ClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        send(socket, { type: 'error', message: result.error.message });
        return;
      }
      const msg = result.data;
      if (msg.type === 'ping') {
        send(socket, { type: 'pong' });
      }
    });

    socket.on('close', () => {
      req.log.info('ws client disconnected');
    });
  });
};
