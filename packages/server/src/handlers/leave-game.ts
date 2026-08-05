import type { ClientLeaveGame } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, otherPlayer } from '../domain/room.js';
import { sendError } from './send-error.js';

export const handleLeaveGame = async (
  identity: Identity,
  msg: ClientLeaveGame,
  { rooms, connections }: Ports,
): Promise<void> => {
  const room = await rooms.get(msg.roomId);
  // Idempotent: leaving a room that no longer exists is silent. A racing
  // opponent-left teardown can legitimately produce this state.
  if (room === undefined) return;
  if (colorOf(room, identity.playerId) === undefined) {
    await sendError(connections, identity, 'not in room', 'leaveGame');
    return;
  }

  const opponent = otherPlayer(room, identity.playerId);
  if (opponent !== undefined) {
    await connections.sendTo(opponent.playerId, {
      type: 'error',
      message: 'opponent left',
    });
    await connections.leaveRoom(opponent.playerId);
  }
  await connections.leaveRoom(identity.playerId);
  await rooms.delete(room.id);
};
