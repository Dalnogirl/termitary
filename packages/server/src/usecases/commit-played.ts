import { seatIds, toArchivedGame } from '../domain/archived-game.js';
import type { Ports } from '../domain/ports.js';
import { ConcurrentModificationError } from '../domain/room-store.js';
import { type FinishedRoom, type Room, isFinished } from '../domain/room.js';

type CommitPorts = Pick<Ports, 'rooms' | 'archive' | 'users' | 'unitOfWork' | 'log'>;

type CommitOutcome = 'committed' | 'archive-failed';

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
 * Writes a room its player has just changed. On archive-failed the room keeps
 * its previous state, so the caller broadcasts nothing.
 */
export const commitPlayed = async (
  room: Room,
  expected: number,
  ports: CommitPorts,
): Promise<CommitOutcome> => {
  if (!isFinished(room)) {
    await ports.rooms.save(room, expected);
    return 'committed';
  }
  try {
    await finish(room, expected, ports);
    return 'committed';
  } catch (err) {
    if (err instanceof ConcurrentModificationError) throw err;
    ports.log.error({ roomId: room.id, err }, 'archiving a finished game failed');
    return 'archive-failed';
  }
};
