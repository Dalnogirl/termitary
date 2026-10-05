import type { Ports } from '../domain/ports.js';
import { finishedOnTime, isAbandoned } from '../domain/room.js';
import { broadcastState } from './broadcast-state.js';
import { commitPlayed } from './commit-played.js';
import { abortRoom } from './end-on-time.js';
import { retryOnConflict } from './retry-on-conflict.js';

export type RoomSweepPorts = Pick<
  Ports,
  'rooms' | 'archive' | 'users' | 'unitOfWork' | 'connections' | 'log'
>;

export type RoomSweepResult = { readonly finished: number; readonly aborted: number };

type Ending = keyof RoomSweepResult | 'none';

// A move that lands between the listing and the read moved the deadline, so
// the re-read finds time on the clock and leaves the room alone.
const endIfOverdue = async (id: string, ports: RoomSweepPorts, now: Date): Promise<Ending> => {
  const current = await ports.rooms.getForUpdate(id);
  if (current === undefined) return 'none';
  if (isAbandoned(current.value, now)) {
    const outcome = await abortRoom(current.value, current.version, ports);
    return outcome === 'aborted' ? 'aborted' : 'none';
  }
  const finished = finishedOnTime(current.value, now);
  if (finished === undefined) return 'none';
  if ((await commitPlayed(finished, current.version, ports)) === 'archive-failed') return 'none';
  await broadcastState(ports.connections, finished, now);
  return 'finished';
};

/**
 * Ends every game whose side to move ran out of time or missed its first move,
 * for when nobody is left to notice. One room that fails is logged and left
 * for the next sweep.
 */
export const sweepTimedOutRooms = async (
  ports: RoomSweepPorts,
  now: Date = new Date(),
): Promise<RoomSweepResult> => {
  const result = { finished: 0, aborted: 0 };
  for (const id of await ports.rooms.listOverdue(now)) {
    try {
      const ending = await retryOnConflict(() => endIfOverdue(id, ports, now));
      if (ending !== 'none') result[ending] += 1;
    } catch (err) {
      ports.log.error({ roomId: id, err }, 'ending a game out of time failed');
    }
  }
  return result;
};
