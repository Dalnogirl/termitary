import type { ClientLeaveGame } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import { colorOf, otherPlayer } from '../domain/room.js';
import type { Services } from '../domain/services.js';

export const handleLeaveGame = async (
  identity: Identity,
  msg: ClientLeaveGame,
  { rooms, connections }: Services,
): Promise<void> => {
  const room = await rooms.get(msg.roomId);
  if (room === undefined) return;
  if (colorOf(room, identity.playerId) === undefined) return;

  const opponent = otherPlayer(room, identity.playerId);
  await connections.leaveRoom(identity.playerId);
  if (opponent !== undefined) {
    await connections.sendTo(opponent.playerId, {
      type: 'error',
      message: 'opponent left',
    });
    await connections.leaveRoom(opponent.playerId);
  }
  await rooms.delete(room.id);
};
