import type { ClientJoinGame } from '@hive/protocol';
import { toWire } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, isFull, seatPlayer } from '../domain/room.js';
import { sendError } from './send-error.js';

// TODO(phase-3-s5): on reconnect, treat "already in room" as a re-attach and
// resend the current state via gameJoined instead of erroring.

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
  if (colorOf(room, identity.playerId) !== undefined) {
    await sendError(connections, identity, 'already in room', 'joinGame');
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
