import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { ConcurrentModificationError } from '../domain/room-store.js';
import { type Room, finishedOnTime, isAbandoned } from '../domain/room.js';
import { broadcastState } from './broadcast-state.js';
import { commitPlayed } from './commit-played.js';
import { sendError } from './send-error.js';

type ClockOutcome = 'in-time' | 'finished' | 'aborted' | 'archive-failed';

type AbortPorts = Pick<Ports, 'rooms' | 'archive' | 'unitOfWork' | 'connections'>;

// Every trigger checks for an abort before writing anything else, so a room
// that vanished without an archive row was aborted by whoever beat this one.
// Anything else that won the race goes back through the retry.
const lostToAnotherAbort = async (id: string, { rooms, archive }: AbortPorts) =>
  (await rooms.get(id)) === undefined && (await archive.get(id)) === undefined;

/**
 * Deletes a room nobody started, archiving nothing, and tells whoever is in it.
 * 'already-aborted' means another trigger got there first and told them.
 */
export const abortRoom = async (
  room: Room,
  expected: number,
  ports: AbortPorts,
): Promise<'aborted' | 'already-aborted'> => {
  try {
    await ports.unitOfWork.commit([ports.rooms.deleteOp(room.id, expected)]);
  } catch (err) {
    if (err instanceof ConcurrentModificationError && (await lostToAnotherAbort(room.id, ports))) {
      return 'already-aborted';
    }
    throw err;
  }
  await ports.connections.broadcast(room.id, { type: 'gameAborted', roomId: room.id });
  return 'aborted';
};

/**
 * Ends the game if the side to move ran out of time by `now`, whoever asked:
 * a missed first move aborts it, a flag finishes it. The request that noticed
 * is not carried out: the game ended before it arrived.
 */
export const endIfOutOfTime = async (
  room: Room,
  version: number,
  identity: Identity,
  requestKind: string,
  now: Date,
  ports: Ports,
): Promise<ClockOutcome> => {
  if (isAbandoned(room, now)) {
    await abortRoom(room, version, ports);
    return 'aborted';
  }
  const finished = finishedOnTime(room, now);
  if (finished === undefined) return 'in-time';
  if ((await commitPlayed(finished, version, ports)) === 'archive-failed') {
    await sendError(ports.connections, identity, 'could not finish the game', requestKind);
    return 'archive-failed';
  }
  await broadcastState(ports.connections, finished, now);
  return 'finished';
};
