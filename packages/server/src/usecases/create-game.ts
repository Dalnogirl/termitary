import { randomUUID } from 'node:crypto';
import type { ClientCreateGame } from '@hive/protocol';
import { toWire } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { createRoom } from '../domain/room.js';

export const createGame = async (
  identity: Identity,
  _msg: ClientCreateGame,
  { rooms, connections }: Ports,
): Promise<void> => {
  const room = createRoom(randomUUID(), identity);
  await rooms.create(room);
  await connections.joinRoom(identity.playerId, room.id);
  await connections.sendTo(identity.playerId, {
    type: 'gameCreated',
    roomId: room.id,
    playerColor: 'white',
    state: toWire(room.state),
  });
};
