import { archivedSeatOf } from '../domain/archived-game.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { sendError } from './send-error.js';

/**
 * A room is deleted the moment its game is archived under the same id, so a
 * player who sat in it is sent there. Anyone else learns only that there is no
 * room.
 */
export const answerMissingRoom = async (
  identity: Identity,
  roomId: string,
  requestKind: string,
  { archive, connections }: Pick<Ports, 'archive' | 'connections'>,
): Promise<void> => {
  const archived = await archive.get(roomId);
  if (archived !== undefined && archivedSeatOf(archived.players, identity.playerId) !== undefined) {
    await connections.sendTo(identity.playerId, { type: 'gameArchived', roomId });
    return;
  }
  await sendError(connections, identity, 'room not found', requestKind);
};
