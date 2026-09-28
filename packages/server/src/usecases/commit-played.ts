import { seatIds, toArchivedGame } from '../domain/archived-game.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { ConcurrentModificationError } from '../domain/room-store.js';
import { type FinishedRoom, type Room, isFinished } from '../domain/room.js';
import { sendError } from './send-error.js';

type CommitPorts = Pick<
  Ports,
  'rooms' | 'archive' | 'users' | 'unitOfWork' | 'connections' | 'log'
>;

// A finished game lives in the archive, so its room goes in the same commit
// that writes it there. The delete comes first so a lost compare-and-swap
// surfaces as the conflict, not as whatever the insert would have thrown.
const finish = async (
  room: FinishedRoom,
  expected: number,
  { rooms, archive, users, unitOfWork }: CommitPorts,
): Promise<void> => {
  const names = await users.namesOf(seatIds(room));
  await unitOfWork.commit([
    rooms.deleteOp(room.id, expected),
    archive.recordOp(toArchivedGame(room, names)),
  ]);
};

/**
 * Writes a room its player has just changed. False when the game ended and
 * could not be archived: the room keeps its previous state and the player has
 * been told, so the caller broadcasts nothing.
 */
export const commitPlayed = async (
  identity: Identity,
  room: Room,
  expected: number,
  requestKind: string,
  ports: CommitPorts,
): Promise<boolean> => {
  if (!isFinished(room)) {
    await ports.rooms.save(room, expected);
    return true;
  }
  try {
    await finish(room, expected, ports);
    return true;
  } catch (err) {
    if (err instanceof ConcurrentModificationError) throw err;
    ports.log.error({ roomId: room.id, err }, 'archiving a finished game failed');
    await sendError(ports.connections, identity, 'could not finish the game', requestKind);
    return false;
  }
};
