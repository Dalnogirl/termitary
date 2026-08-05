import type { ClientJoinGame } from '@hive/protocol';
import { toWire } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, isFull, seatPlayer } from '../domain/room.js';
import { sendError } from './send-error.js';

export const handleJoinGame = async (
  identity: Identity,
  msg: ClientJoinGame,
  { rooms, connections }: Ports,
): Promise<void> => {
  const room = await rooms.get(msg.roomId);
  if (room === undefined) {
    await sendError(connections, identity, 'room not found', 'joinGame');
    return;
  }

  const existingColor = colorOf(room, identity.playerId);
  if (existingColor !== undefined) {
    // Re-attach: the same player is rejoining (route remount, reconnect,
    // or "Play online" → /play navigation). Re-bind the connection to the
    // room and resend current state. No mutation, no opponent notification.
    await connections.joinRoom(identity.playerId, room.id);
    await connections.sendTo(identity.playerId, {
      type: 'gameJoined',
      roomId: room.id,
      playerColor: existingColor,
      state: toWire(room.state),
    });
    return;
  }

  if (isFull(room)) {
    await sendError(connections, identity, 'room is full', 'joinGame');
    return;
  }

  const updated = seatPlayer(room, identity);
  await rooms.save(updated);
  await connections.joinRoom(identity.playerId, updated.id);

  const color = colorOf(updated, identity.playerId);
  if (color === undefined) {
    throw new Error('invariant: just-seated player has no color');
  }

  const wireState = toWire(updated.state);
  await connections.sendTo(identity.playerId, {
    type: 'gameJoined',
    roomId: updated.id,
    playerColor: color,
    state: wireState,
  });

  const opponent = updated.players[color === 'white' ? 1 : 0];
  if (opponent !== undefined) {
    await connections.sendTo(opponent.playerId, {
      type: 'stateUpdated',
      roomId: updated.id,
      state: wireState,
    });
  }
};
