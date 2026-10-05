import type { Ports } from '../domain/ports.js';
import { finishedOnTime } from '../domain/room.js';
import { broadcastState } from './broadcast-state.js';
import { commitPlayed } from './commit-played.js';
import { retryOnConflict } from './retry-on-conflict.js';

export type RoomSweepPorts = Pick<
  Ports,
  'rooms' | 'archive' | 'users' | 'unitOfWork' | 'connections' | 'log'
>;

// A move that lands between the listing and the read moved the deadline, so
// the re-read finds time on the clock and leaves the room alone.
const finishIfOverdue = async (id: string, ports: RoomSweepPorts, now: Date): Promise<boolean> => {
  const current = await ports.rooms.getForUpdate(id);
  if (current === undefined) return false;
  const finished = finishedOnTime(current.value, now);
  if (finished === undefined) return false;
  if ((await commitPlayed(finished, current.version, ports)) === 'archive-failed') return false;
  await broadcastState(ports.connections, finished, now);
  return true;
};

/**
 * Finishes every game whose side to move ran out of time, for when nobody is
 * left to notice. One room that fails is logged and left for the next sweep.
 */
export const sweepTimedOutRooms = async (
  ports: RoomSweepPorts,
  now: Date = new Date(),
): Promise<number> => {
  let finished = 0;
  for (const id of await ports.rooms.listOverdue(now)) {
    try {
      if (await retryOnConflict(() => finishIfOverdue(id, ports, now))) finished += 1;
    } catch (err) {
      ports.log.error({ roomId: id, err }, 'finishing a game out of time failed');
    }
  }
  return finished;
};
