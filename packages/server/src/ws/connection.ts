import type { ServerMessage } from '@hive/protocol';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { ConnectionLifecycle } from '../domain/connection-registry.js';
import type { Ports } from '../domain/ports.js';
import { otherPlayer } from '../domain/room.js';
import { dispatchClientMessage } from './dispatcher.js';
import { extractIdentity } from './identity.js';
import { parseInbound } from './inbound.js';

export type ConnectionContext = {
  readonly socket: WebSocket;
  readonly req: FastifyRequest;
  readonly ports: Ports;
  readonly lifecycle: ConnectionLifecycle;
};

const send = (socket: WebSocket, msg: ServerMessage): void => {
  socket.send(JSON.stringify(msg));
};

export const handleConnection = ({ socket, req, ports, lifecycle }: ConnectionContext): void => {
  const identity = extractIdentity(req);
  const { playerId } = identity;
  req.log.info({ playerId }, 'ws client connected');

  lifecycle.bind(playerId, async (msg) => {
    send(socket, msg);
  });

  send(socket, { type: 'connected', playerId });

  socket.on('message', (raw: Buffer | string) => {
    const parsed = parseInbound(raw);
    if (!parsed.ok) {
      send(socket, { type: 'error', message: parsed.error });
      return;
    }
    void dispatchClientMessage(identity, parsed.message, ports).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'internal error';
      req.log.error({ err, playerId, kind: parsed.message.type }, 'handler failed');
      send(socket, { type: 'error', message, requestKind: parsed.message.type });
    });
  });

  socket.on('close', async () => {
    // Await the notification BEFORE unbind: unbind tears down the
    // registry's playerRoom mapping, after which findRoomByPlayerId
    // returns undefined. Disconnect ≠ leave — room state (seats) is
    // untouched, so a reconnect lands in joinGame's re-attach branch.
    // Awaiting (rather than fire-and-forget .finally) keeps unbind from
    // racing with a fresh bind() for the same playerId — e.g. a reload
    // that opens a new socket before the old close handler runs.
    try {
      await notifyOpponentOfDisconnect(playerId, ports);
    } finally {
      lifecycle.unbind(playerId);
      req.log.info({ playerId }, 'ws client disconnected');
    }
  });
};

const notifyOpponentOfDisconnect = async (playerId: string, ports: Ports): Promise<void> => {
  const roomId = await ports.connections.findRoomByPlayerId(playerId);
  if (roomId === undefined) return;
  const room = await ports.rooms.get(roomId);
  if (room === undefined) return;
  const opp = otherPlayer(room, playerId);
  if (opp === undefined) return;
  await ports.connections.sendTo(opp.playerId, {
    type: 'presenceUpdate',
    roomId,
    opponent: 'disconnected',
  });
};
